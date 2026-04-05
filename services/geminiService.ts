
import { GoogleGenAI, ThinkingLevel } from "@google/genai";
import type { 
  Candidate,
  AnalysisResult, 
  ScoreDetail,
  RecruiterScanResult, 
  CandidateAnalysis, 
  JDAnalysis, 
  InterviewScript, 
  CrossDomainAnalysis,
  InterviewPredictionResponse,
  PracticeFeedback,
  CompanyMetadata,
  RoleMetadata,
  ChatRequest,
  InterviewChatResponse
} from '../types';

const API_KEY = process.env.API_KEY;

if (!API_KEY) {
  throw new Error("API_KEY environment variable not set.");
}

const ai = new GoogleGenAI({ apiKey: API_KEY });

// Using gemini-3.1-pro-preview for advanced reasoning and complex tasks
const PRO_MODEL = 'gemini-3.1-pro-preview';
// Using gemini-3-flash-preview for speed and cost-efficiency
const FLASH_MODEL = 'gemini-3-flash-preview';

const buildSystemInstruction = (): string => {
  return `
    You are an expert product/UX engineer and a world-class resume/job-matching AI assistant. Your task is to analyze a provided resume against a job description and produce a detailed analysis in a specific JSON format.

    **CRITICAL INSTRUCTION: ZERO HALLUCINATION POLICY**
    1.  **STRICT ADHERENCE**: Use ONLY the facts (companies, dates, roles, skills, education) explicitly present in the provided resume.
    2.  **FORBIDDEN**: Do NOT invent or "fill in" missing information to make the candidate look better for the JD.
        - **NEVER** add a skill the candidate hasn't listed.
        - **NEVER** add a project the candidate hasn't described.
        - **NEVER** upgrade a job title (e.g., "Developer" to "Lead Developer") if the source doesn't support it.
        - **NEVER** change employment dates or add "missing" years.
    3.  **STYLING ONLY**: Your "optimization" should be limited to rephrasing existing bullet points for better impact, clarity, and ATS keyword prominence *of existing concepts only*. If the user is a bad fit, acknowledge it honestly.
    4.  **VERIFICATION**: In your internal monologue, cross-reference every claim in your output against the source resume. If it's not there, delete it.
    5.  **BREAKDOWN ACCURACY**: Every score in the 'breakdown' must be strictly justified by the 'details' provided for that category. If a candidate is missing 50% of the required core skills, the 'core_skills' score MUST be 50 or lower. Do NOT default to high scores.

    **CONDITIONAL OPTIMIZATION RULE:**
    - If the candidate's core profile is fundamentally mismatched with the Job Description (e.g., "Not Eligible" verdict, match_score < 60):
        - Set "custom_resume_text" to "" (empty string).
        - Set "cover_letter" to "" (empty string).
        - Set "cover_line" to null.
        - In "explanations", explicitly state that the profile is not a sufficient match for a professional optimization and that you refuse to fabricate experience.

    **SCORING LOGIC (weights):**
    - Core skills match (30%)
    - Role/title alignment (20%)
    - Experience relevance (15%)
    - Achievement/results (10%)
    - Education & certifications (5%)
    - ATS/format readiness & keyword density (10%)
    - Soft skill & culture fit signals (5%)
    - Red flags (negative -5 to -15)

    **IMPORTANT**: Each category in the 'breakdown' should be scored from 0 to 100. The 'match_score' is the weighted average of these scores (minus red flags).

    **THRESHOLDS:**
    - 80–100 => "Eligible"
    - 60–79 => "Borderline"
    - 0–59 => "Not Eligible"

    **OUTPUT JSON SCHEMA:**
    {
      "match_score": number (0-100),
      "verdict": "Eligible"|"Borderline"|"Not Eligible",
      "breakdown": {
        "core_skills": {"score": number (0-100), "details": [string]},
        "title_alignment": {"score": number (0-100), "details": [string]},
        "experience_relevance": {"score": number (0-100), "details": [string]},
        "achievements": {"score": number (0-100), "details":[string]},
        "education_certifications": {"score": number (0-100), "details":[string]},
        "ats_readiness": {"score": number (0-100), "details":[string]},
        "soft_skills": {"score": number (0-100), "details":[string]},
        "red_flags": {"score": number (negative value, e.g. -10), "details":[string]}
      },
      "missing_items_prioritized": [
        {"type":"skill"|"certification"|"experience"|"keyword"|"format", "importance": "high"|"medium"|"low", "suggestion": "string"}
      ],
      "custom_resume_text": "string (The full text of the optimized resume or empty string if not eligible)",
      "diff_summary": ["string"],
      "cover_line": "string|null",
      "cover_letter": "string (The full text of the cover letter or empty string if not eligible)",
      "top_3_rewritten_achievements": ["string"],
      "explanations": ["short human readable strings, each < 120 chars"],
      "highlight_keywords": ["string (3-5 high-impact keywords from the JD that the candidate has)"],
      "career_path_suggestions": [
        {
          "role": "string (alternative job title)",
          "reason": "string (why this is a good pivot)",
          "skills_to_add": ["string"],
          "roadmap": [
            {
              "phase": "string (e.g., Phase 1: Knowledge)",
              "duration": "string (e.g., 4 weeks)",
              "tasks": ["string (specific actionable tasks)"]
            }
          ],
          "salary_impact": "string (e.g., +20% or $120k avg)",
          "ease_of_pivot": "number (0-100 score)"
        }
      ],
      "market_fit": [
        {
          "industry": "string",
          "score": number (0-100),
          "reason": "string"
        }
      ],
      "skill_gaps": [
        {
          "skill": "string",
          "priority": "high"|"medium"|"low",
          "recommendation": "string"
        }
      ],
      "interview_readiness": {
        "score": number (0-100),
        "feedback": "string",
        "top_questions": ["string"]
      },
      "contact_info_missing": {
        "email": "boolean",
        "phone": "boolean"
      }
    }

    CRITICAL CONSTRAINTS:
    - NEVER add skills, tools, or experiences that are not explicitly mentioned in the source resume.
    - If a skill is required by the JD but missing from the resume, list it in 'missing_items_prioritized' but DO NOT include it in the 'custom_resume_text'.
    - Check for the presence of an email address and a phone number. Set the corresponding boolean in 'contact_info_missing' to true if they are missing.
    - The match_score should be objective based on the resume's actual content.
  `;
};

const buildRecruiterScanSystemInstruction = (): string => {
  return `
    You are a senior recruiter with 15 years of screening experience.
    Simulate a 6-second resume scan.
    DO NOT rewrite the resume. DO NOT hallucinate.
    Use only the text provided. Temperature=0.0.

    TASKS:
    1. Identify the FIRST elements you would notice (max 5 items). These are the things that jump out visually or due to placement.
    2. Identify CRITICAL elements you would completely MISS in a 6-second scan (e.g., buried skills, bottom of page details).
    3. Identify RED FLAGS visible within 6 seconds (e.g., employment gaps, typos, weird formatting, irrelevant titles).
    4. Provide a short "recruiter impression" (max 30 words) summarizing your gut feeling.

    OUTPUT JSON ONLY.

    ⭐ OUTPUT SCHEMA
    {
      "firstNoticed": ["string"],
      "missedItems": ["string"],
      "redFlags": ["string"],
      "recruiterImpression": "string"
    }
  `;
};


export const analyzeResume = async (
  jobDescription: string, 
  resume: { text?: string; base64Data?: string; mimeType?: string; }
): Promise<AnalysisResult> => {
  const contents = [];

  if (resume.text) {
    contents.push({ text: `JOB DESCRIPTION:\n${jobDescription}\n\nRESUME TEXT:\n${resume.text}` });
  } else if (resume.base64Data && resume.mimeType) {
    contents.push({
      inlineData: {
        data: resume.base64Data,
        mimeType: resume.mimeType,
      },
    });
    contents.push({ text: `JOB DESCRIPTION:\n${jobDescription}` });
  } else {
    throw new Error('Invalid resume data provided.');
  }

  try {
    const response = await ai.models.generateContent({
      model: PRO_MODEL,
      contents: [{ parts: contents }],
      config: {
        systemInstruction: buildSystemInstruction(),
        thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
        temperature: 0.0,
        responseMimeType: "application/json",
      }
    });

    const jsonString = response.text.trim();
    // More robust JSON cleaning
    const cleanedJsonString = jsonString.replace(/^```json\s*|```$/g, '').trim();
    
    let result: AnalysisResult;
    try {
      result = JSON.parse(cleanedJsonString);
    } catch (parseError) {
      console.error("JSON Parse Error:", parseError, "Raw Response:", jsonString);
      throw new Error("The AI returned an invalid response format. Please try again.");
    }
    
    // Validate required fields to prevent "details not loading"
    const emptyScore: ScoreDetail = { score: 0, details: [] };
    if (!result.match_score && result.match_score !== 0) result.match_score = 0;
    if (!result.verdict) result.verdict = 'Not Eligible';
    if (!result.explanations) result.explanations = [];
    if (!result.missing_items_prioritized) result.missing_items_prioritized = [];
    if (!result.highlight_keywords) result.highlight_keywords = [];
    if (!result.career_path_suggestions) result.career_path_suggestions = [];
    if (!result.market_fit) result.market_fit = [];
    if (!result.skill_gaps) result.skill_gaps = [];
    if (!result.interview_readiness) {
      result.interview_readiness = {
        score: 0,
        feedback: "Analysis pending",
        top_questions: []
      };
    }
    if (!result.breakdown) {
      result.breakdown = {
        core_skills: emptyScore,
        title_alignment: emptyScore,
        experience_relevance: emptyScore,
        achievements: emptyScore,
        education_certifications: emptyScore,
        ats_readiness: emptyScore,
        soft_skills: emptyScore,
        red_flags: emptyScore,
        growth_potential: emptyScore
      };
    }
    if (!result.custom_resume_text) result.custom_resume_text = "";
    
    // Add usage metadata
    if (response.usageMetadata) {
      result.usage = {
        promptTokenCount: response.usageMetadata.promptTokenCount,
        candidatesTokenCount: response.usageMetadata.candidatesTokenCount,
        totalTokenCount: response.usageMetadata.totalTokenCount
      };
    }
    
    return result;
  } catch (error) {
    console.error("Error calling Gemini API or parsing response:", error);
    throw new Error("Failed to get a valid analysis from the AI model.");
  }
};

export const performRecruiterScan = async (
  jobDescription: string,
  resume: { text?: string; base64Data?: string; mimeType?: string; }
): Promise<RecruiterScanResult> => {
  const contents = [];

   if (resume.text) {
    contents.push({ text: `JOB DESCRIPTION:\n${jobDescription}\n\nRESUME TEXT:\n${resume.text}` });
  } else if (resume.base64Data && resume.mimeType) {
    contents.push({
      inlineData: {
        data: resume.base64Data,
        mimeType: resume.mimeType,
      },
    });
    contents.push({ text: `JOB DESCRIPTION:\n${jobDescription}` });
  } else {
    throw new Error('Invalid resume data provided.');
  }

  try {
    const response = await ai.models.generateContent({
      model: FLASH_MODEL,
      contents: [{ parts: contents }],
      config: {
        systemInstruction: buildRecruiterScanSystemInstruction(),
        temperature: 0.0,
        responseMimeType: "application/json",
      }
    });

    const jsonString = response.text.trim();
    const cleanedJsonString = jsonString.replace(/^```json\s*|```$/g, '');
    const result: RecruiterScanResult = JSON.parse(cleanedJsonString);

    // Add usage metadata
    if (response.usageMetadata) {
      result.usage = {
        promptTokenCount: response.usageMetadata.promptTokenCount,
        candidatesTokenCount: response.usageMetadata.candidatesTokenCount,
        totalTokenCount: response.usageMetadata.totalTokenCount
      };
    }

    return result;
  } catch (error) {
    console.error("Recruiter Scan Error:", error);
    throw new Error("Failed to perform recruiter scan.");
  }
}

// --- RECRUITER PORTAL SERVICES ---

export const analyzeCandidate = async (
  jobDescription: string,
  resume: { text?: string; base64Data?: string; mimeType?: string; }
): Promise<CandidateAnalysis> => {
  const systemInstruction = `
    You are an AI recruitment assistant. Analyze this resume against the provided Job Description.
    
    **CRITICAL INSTRUCTION: ZERO HALLUCINATION POLICY**
    - Use ONLY the information found in the provided resume.
    - DO NOT use any external knowledge about the candidate.
    - If a field is not present in the resume, use "NA" or 0 as appropriate.
    - DO NOT invent or "fill in" missing information.

    OUTPUT JSON ONLY:
    {
        "match_score": number (0-100),
        "potential_score": number (0-100) - based on transferrable skills and growth trajectory,
        "red_flags": ["string"],
        "strengths": ["string"],
        "summary": "string (max 50 words)",
        "training_estimate": "string (e.g. 'None', '2 weeks for X tool', 'Significant upskilling required')",
        "years_experience": number,
        "seniority_level": "Junior" | "Mid" | "Senior" | "Principal" | "Executive",
        "email": "string (extracted from resume, use 'NA' if not found)",
        "phone": "string (extracted from resume, use 'NA' if not found)",
        "address": "string (extracted from resume, use 'NA' if not found)",
        "jobType": "string (the candidate's current or target job title)",
        "category": "string (Smartly categorize the candidate into a broad field like 'UX Design', 'Frontend Development', 'Backend Development', 'Data Science', 'Product Management', 'Marketing', 'Sales', etc. based on their overall profile)",
        "outreach_draft": "string (A personalized, professional outreach message for this specific candidate based on their strengths and the JD)",
        "breakdown": {
            "core_skills": number (0-100),
            "title_alignment": number (0-100),
            "experience_relevance": number (0-100),
            "ats_readiness": number (0-100),
            "soft_skills": number (0-100)
        },
        "gaps": ["string (3-5 items of missing skills or experience)"]
    }
  `;

  const contents = [];
  if (resume.text) {
    contents.push({ text: `JOB DESCRIPTION:\n${jobDescription}\n\nRESUME:\n${resume.text}` });
  } else if (resume.base64Data && resume.mimeType) {
    contents.push({ inlineData: { data: resume.base64Data, mimeType: resume.mimeType } });
    contents.push({ text: `JOB DESCRIPTION:\n${jobDescription}` });
  }

  const response = await ai.models.generateContent({
    model: FLASH_MODEL,
    contents: [{ parts: contents }],
    config: { 
      systemInstruction,
      temperature: 0.0, 
      responseMimeType: "application/json" 
    }
  });

  const result: CandidateAnalysis = JSON.parse(response.text.replace(/^```json\s*|```$/g, ''));
  
  if (response.usageMetadata) {
    result.usage = {
      promptTokenCount: response.usageMetadata.promptTokenCount,
      candidatesTokenCount: response.usageMetadata.candidatesTokenCount,
      totalTokenCount: response.usageMetadata.totalTokenCount
    };
  }
  
  return result;
};

export const analyzeJobDescription = async (jobDescription: string): Promise<JDAnalysis> => {
  const systemInstruction = `
    Analyze and improve this Job Description.
    
    Tasks:
    1. Score clarity (0-100).
    2. Score potential bias (0-100, lower is less biased).
    3. Score market competitiveness (0-100).
    4. Extract Must-Haves vs Nice-to-Haves.
    5. Identify red flags in the writing (e.g. "rockstar", "unlimited overtime").
    6. Rewrite the JD to be perfect, inclusive, and structured.
    7. Create a competency model (list of competencies required).

    OUTPUT JSON ONLY. The response must match this schema exactly:
    {
      "clarity_score": number,
      "bias_score": number,
      "market_fit_score": number,
      "must_haves": ["string"],
      "nice_to_haves": ["string"],
      "red_flags_in_jd": ["string"],
      "rewritten_jd": "string",
      "competency_model": ["string"]
    }
  `;

  const response = await ai.models.generateContent({
    model: FLASH_MODEL,
    contents: [{ parts: [{ text: `JOB DESCRIPTION:\n${jobDescription}` }] }],
    config: { 
      systemInstruction,
      temperature: 0.0, 
      responseMimeType: "application/json" 
    }
  });

  return JSON.parse(response.text.replace(/^```json\s*|```$/g, ''));
};

export const simplifyResume = async (resume: { text?: string; base64Data?: string; mimeType?: string; }): Promise<string> => {
  const systemInstruction = `
    Take the provided resume and convert it into a "Clean Standardized View" using Markdown.
    - Remove all decorative formatting.
    - Normalize fonts and headers.
    - Extract text from complex layouts into a linear top-down format.
    - Fix section structure (Header, Summary, Experience, Skills, Education).
    - Convert paragraphs to bullet points where appropriate for readability.
    - Highlight key metrics in bold.
    
    Return ONLY the Markdown string.
  `;
  
  const contents = [];
  if (resume.text) {
    contents.push({ text: `RESUME:\n${resume.text}` });
  } else if (resume.base64Data && resume.mimeType) {
    contents.push({ inlineData: { data: resume.base64Data, mimeType: resume.mimeType } });
  }

  const response = await ai.models.generateContent({
    model: FLASH_MODEL,
    contents: [{ parts: contents }],
    config: { 
      systemInstruction,
      temperature: 0.0 
    }
  });

  return response.text;
};

export const generateInterviewScript = async (
  jobDescription: string, 
  candidateSummary: string,
  redFlags: string[]
): Promise<InterviewScript> => {
  const systemInstruction = `
    Generate a structured interview script for a candidate based on this JD and their profile summary.
    
    Generate:
    - 3 Technical Questions (hard skills)
    - 3 Behavioral Questions (soft skills/culture)
    - 2 Situational Questions
    - 2 Risk-Probing Questions (addressing the identified risks)
    
    OUTPUT JSON ONLY matching this EXACT schema:
    {
      "questions": [
        {
          "question": "string",
          "type": "Technical" | "Behavioral" | "Situational" | "Risk-Probe",
          "expected_answer": "string",
          "score_criteria": "string"
        }
      ],
      "recommendation_template": "string"
    }
  `;

  const response = await ai.models.generateContent({
    model: FLASH_MODEL,
    contents: [{ parts: [{ text: `JD: ${jobDescription.substring(0, 1000)}...\nCandidate Summary: ${candidateSummary}\nIdentified Risks: ${redFlags.join(', ')}` }] }],
    config: { 
      systemInstruction,
      temperature: 0.2, 
      responseMimeType: "application/json" 
    }
  });

  return JSON.parse(response.text.replace(/^```json\s*|```$/g, ''));
};

export const performCrossDomainAnalysis = async (
  candidateId: string,
  resume: { text?: string; base64Data?: string; mimeType?: string; }
): Promise<CrossDomainAnalysis> => {
  const systemInstruction = `
    You are an expert career translator and recruiter analyst. Temperature=0.0. NEVER INVENT facts. Use ONLY the resumeText provided. Output JSON per the required schema.

    Given this resumeText and this list of targetDomains, for each domain evaluate if the candidate’s experience transfers. For each domain produce transferabilityScore 0-100, confidence, top 3-5 transferable skills, exact evidence substrings with start and end characters, 1-2 suggested resume bullet rewrites (reframing existing facts, do not invent numbers), 3 interview questions to validate transferability, a 3-item upskill checklist (practical, cheap, fast), and estimated timeToProductivityWeeks. If the resume does not support transfer to a domain, set transferabilityScore low and confidence low and explain briefly in 'reason' field.

    OUTPUT JSON ONLY. The response must match this schema exactly:
    {
      "candidateId": "string",
      "domains": [
        {
          "domainName": "string",
          "transferabilityScore": number,
          "confidence": "low"|"medium"|"high",
          "primarySkills": ["string"],
          "evidence": [{"text":"string","startChar":number,"endChar":number}],
          "suggestedBullets": ["string"],
          "interviewQuestions": ["string"],
          "upskillChecklist": ["string"],
          "timeToProductivityWeeks": number
        }
      ]
    }
  `;

  const contents = [];
  if (resume.text) {
    contents.push({ text: `RESUME:\n${resume.text}` });
  } else if (resume.base64Data && resume.mimeType) {
    contents.push({ inlineData: { data: resume.base64Data, mimeType: resume.mimeType } });
  }
  
  const targetDomains = ["healthcare->fintech","edtech->SaaS", "government->enterprise","consumer->B2B","startup->corporate","academia->R&D", "retail->commerce","manufacturing->iot","nonprofit->public","agency->product-studio","hospitality->travel-tech","telecom->cloud","logistics->supplychain","media->streaming"];
  contents.push({ text: `CANDIDATE_ID: ${candidateId}\nTARGET_DOMAINS: ${targetDomains.join(', ')}` });

  const response = await ai.models.generateContent({
    model: PRO_MODEL,
    contents: [{ parts: contents }],
    config: { 
      systemInstruction,
      temperature: 0.0, 
      responseMimeType: "application/json" 
    }
  });

  return JSON.parse(response.text.replace(/^```json\s*|```$/g, ''));
};

export const predictInterviewQuestions = async (
  inputs: {
    companyProfile: CompanyMetadata | null;
    jobRole: RoleMetadata | null;
    jobRoleString: string; // Fallback string if no metadata
    companyString: string; // Fallback string if no metadata
    jobDescription: string;
    resumeText: string;
    numQuestions: number;
  }
): Promise<InterviewPredictionResponse> => {
  const requestId = Math.random().toString(36).substr(2, 9);
  
  const systemInstruction = `
    You are an expert interviewer and hiring strategist. Temperature=0.0. Only use the provided text. Do not invent facts. If evidence for a question is missing, mark confidence=low and evidence=[]. Output only JSON.

    Generate predicted interview questions for the inputs below. For each question, produce:
    id, category (behavioral|technical|scenario|founder|trick), question, difficulty (easy|medium|hard), confidence, answerGuidelines (3 bullets), reason (why this question appears, referencing input text), and sourceTokens (substring with startChar/endChar). Output MUST follow the exact JSON schema below.

    OUTPUT SCHEMA:
    {
    "requestId":"string",
    "metadata":{"generatedAt":"ISO8601","model":"gemini-3.1-pro-preview"},
    "questions":[{
        "id":"string",
        "category":"behavioral"|"technical"|"scenario"|"founder"|"trick",
        "question":"string",
        "difficulty":"easy"|"medium"|"hard",
        "confidence":"high"|"medium"|"low",
        "answerGuidelines":["string","string","string"],
        "reason":"string",
        "sourceTokens":[{"text":"string","startChar":number,"endChar":number}]
    }],
    "summary":{
        "topCategories":["string"],
        "overallConfidence":"high"|"medium"|"low",
        "notes":"string"
    }
    }
  `;

  const companyContext = inputs.companyProfile 
    ? JSON.stringify(inputs.companyProfile) 
    : inputs.companyString;
  
  const roleContext = inputs.jobRole
    ? JSON.stringify(inputs.jobRole)
    : inputs.jobRoleString;

  const response = await ai.models.generateContent({
    model: PRO_MODEL,
    contents: [{ parts: [{ text: `REQUEST_ID: ${requestId}\nCOMPANY: ${companyContext}\nROLE: ${roleContext}\nJD: ${inputs.jobDescription.substring(0, 5000)}\nRESUME: ${inputs.resumeText.substring(0, 5000)}\nNUM_QUESTIONS: ${inputs.numQuestions}` }] }],
    config: { 
      systemInstruction,
      temperature: 0.0, 
      responseMimeType: "application/json" 
    }
  });

  return JSON.parse(response.text.replace(/^```json\s*|```$/g, ''));
};

export const analyzePracticeAnswer = async (
  question: string,
  answer: string
): Promise<PracticeFeedback> => {
  const systemInstruction = `
    You are an expert interview coach. Analyze the user's answer to the interview question below.
    
    Provide constructive feedback in JSON format:
    1. Score clarity (0-100).
    2. Rate STAR method usage (Strong, Average, Weak).
    3. List 2-3 key strengths.
    4. List 2-3 key improvements.
    5. Write a "Sample Better Response" that improves on the user's answer while keeping their core content.

    OUTPUT JSON SCHEMA:
    {
      "clarity_score": number,
      "star_method_rating": "Strong"|"Average"|"Weak",
      "strengths": ["string"],
      "improvements": ["string"],
      "sample_better_response": "string"
    }
  `;

  const response = await ai.models.generateContent({
    model: PRO_MODEL,
    contents: [{ parts: [{ text: `QUESTION: "${question}"\nUSER_ANSWER: "${answer}"` }] }],
    config: { 
      systemInstruction,
      temperature: 0.2, 
      responseMimeType: "application/json" 
    }
  });

  return JSON.parse(response.text.replace(/^```json\s*|```$/g, ''));
};

// --- Helper: Extract Text from File (Multimodal) ---
export const extractTextFromFile = async (
  file: { base64Data: string; mimeType: string; }
): Promise<string> => {
  const systemInstruction = `Extract all text from this document verbatim. Return ONLY the text content. Do not add any markdown or commentary.`;
  
  const response = await ai.models.generateContent({
    model: FLASH_MODEL,
    contents: [{
      parts: [
        { inlineData: { data: file.base64Data, mimeType: file.mimeType } }
      ]
    }],
    config: { 
      systemInstruction,
      temperature: 0.0 
    }
  });
  
  return response.text.trim();
};

export const interviewChat = async (request: ChatRequest): Promise<InterviewChatResponse> => {
  const { history, userQuestion, context } = request;

  const systemInstruction = `
    You are a highly intelligent, context-aware Interview Assistant.
    You MUST answer the user's question using **ONLY** the provided Context Information below.
    
    **CORE DIRECTIVE: NO HALLUCINATIONS.**
    - If the answer is not found in the Job Description (JD), Resume, Company/Role Metadata, or Research Sources, you MUST explicitly state that you have "insufficient data" or "cannot find reliable information" to answer accurately.
    - Do NOT use general world knowledge to guess specifics about the company culture, benefits, or role unless specifically allowed (e.g. definitions).
    - If you are asked general questions (e.g., "What is a PM?"), you may use general knowledge but must label it as "General Industry Information".
    
    **SOURCE PRIORITY:**
    1. **Job Description (JD)**: Highest authority for role specifics.
    2. **Resume**: Highest authority for candidate experience.
    3. **Research Sources**: Trusted public info (Glassdoor, Company Site).
    4. **General Role Info**: Lowest priority, use only if nothing else matches.

    **INSTRUCTIONS:**
    - Answer the user's question directly and concisely.
    - **CITE YOUR SOURCES**: For every claim, you must identify where it came from.
    - Populate the "usedSources" array in the JSON response with the specific IDs or Titles of sources used.
    
    **OUTPUT JSON SCHEMA:**
    {
      "answerText": "string (markdown allowed)",
      "usedSources": [
        { "id": "string", "title": "JD" | "Resume" | "Company Metadata" | "Glassdoor" | "LinkedIn" | "General Knowledge", "type": "jd" | "resume" | "web" | "metadata" }
      ],
      "suggestedFollowUps": ["string", "string", "string"]
    }
  `;

  const contextText = `
    [JOB_DESCRIPTION]:
    ${context.jdText ? context.jdText.substring(0, 8000) : "Not provided"}
    
    [RESUME]:
    ${context.resumeText ? context.resumeText.substring(0, 8000) : "Not provided"}
    
    [COMPANY_METADATA]:
    ${JSON.stringify(context.company || { name: context.companyString || "Not Selected" })}
    
    [ROLE_METADATA]:
    ${JSON.stringify(context.role || { title: context.roleString || "Not Selected" })}
    
    [RESEARCH_SOURCES]:
    ${JSON.stringify(context.researchSources || [])}

    **CONVERSATION HISTORY:**
    ${history.map(msg => `${msg.role.toUpperCase()}: ${msg.content}`).join('\n')}
    
    **USER QUESTION:**
    ${userQuestion}
  `;

  const response = await ai.models.generateContent({
    model: FLASH_MODEL,
    contents: [{ parts: [{ text: contextText }] }],
    config: { 
      systemInstruction,
      temperature: 0.0, 
      responseMimeType: "application/json" 
    }
  });

  return JSON.parse(response.text.replace(/^```json\s*|```$/g, ''));
};

export const generateComparisonSummary = async (candidates: Candidate[], jdText: string): Promise<string> => {
  const systemInstruction = `
    You are a senior talent acquisition specialist.
    Compare the following candidates for the job description provided.
    Provide a concise, high-level summary (max 150 words) that highlights who is the best fit, who has the most potential, and any critical trade-offs the recruiter should consider.
  `;

  const context = candidates
    .map(c => `[CANDIDATE: ${c.name}]\nScore: ${c.analysis?.match_score}%\nPotential: ${c.analysis?.potential_score}%\nStrengths: ${c.analysis?.strengths?.join(', ')}\nGaps: ${c.analysis?.gaps?.join(', ')}`)
    .join('\n\n');

  const prompt = `
    JOB DESCRIPTION:
    ${jdText}
    
    CANDIDATES:
    ${context}
  `;

  const response = await ai.models.generateContent({
    model: FLASH_MODEL,
    contents: [{ parts: [{ text: prompt }] }],
    config: { 
      systemInstruction,
      temperature: 0.2 
    }
  });

  return response.text.trim();
};

export const getAdminInsights = async (stats: {
  totalUsers: number;
  totalResumes: number;
  totalInterviews: number;
  totalTokens: number;
  avgProcessingTime: number;
  totalCostUSD: number;
  avgMatchScore?: number;
  avgPotentialScore?: number;
  health?: number;
}, view: 'overview' | 'jobseekers' | 'recruiters' = 'overview'): Promise<string> => {
  const systemInstruction = `
    You are an AI System Architect and Senior Business Analyst. 
    Analyze the platform metrics for the ${view.toUpperCase()} view and provide 3-4 concise, high-impact "AI Insights".
    
    Your insights MUST be:
    1. **Actionable**: Specific steps to improve metrics.
    2. **Strategic**: Connect data points to business outcomes.
    3. **Cost-Optimized**: Advice on reducing LLM costs without sacrificing quality.
    4. **Intelligent**: Look for correlations (e.g., "High match scores but low interview counts suggest X").
    
    Context for ${view.toUpperCase()}:
    - Overview: Focus on platform health, growth, and overall ROI.
    - Job Seekers: Focus on resume quality, match scores, and processing efficiency.
    - Recruiters: Focus on candidate potential, interview engagement, and hiring velocity.
    
    Return the response as a Markdown list.
  `;

  const prompt = `
    METRICS:
    - Total Users: ${stats.totalUsers}
    - Total Resumes: ${stats.totalResumes}
    - Total Interviews: ${stats.totalInterviews}
    - Total Tokens: ${stats.totalTokens}
    - Avg Processing Time: ${stats.avgProcessingTime}s
    - Total Cost: $${stats.totalCostUSD.toFixed(2)}
    ${stats.avgMatchScore ? `- Avg Match Score: ${stats.avgMatchScore.toFixed(1)}%` : ''}
    ${stats.avgPotentialScore ? `- Avg Potential Score: ${stats.avgPotentialScore.toFixed(1)}%` : ''}
    ${stats.health ? `- Platform Health: ${stats.health.toFixed(1)}%` : ''}
  `;

  const response = await ai.models.generateContent({
    model: FLASH_MODEL,
    contents: [{ parts: [{ text: prompt }] }],
    config: { 
      systemInstruction,
      temperature: 0.2 
    }
  });

  return response.text.trim();
};
