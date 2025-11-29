
import { GoogleGenAI } from "@google/genai";
import type { 
  AnalysisResult, 
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

// Using gemini-3-pro-preview for advanced reasoning and complex tasks
const model = 'gemini-3-pro-preview';

const buildPrompt = (jobDescription: string): string => {
  return `
    You are an expert product/UX engineer and a world-class resume/job-matching AI assistant. Your task is to analyze a provided resume against a job description and produce a detailed analysis in a specific JSON format.

    **CRITICAL INSTRUCTION: FACTUAL ACCURACY & NO HALLUCINATIONS**
    1.  **STRICT ADHERENCE**: You must ONLY use facts explicitly present in the provided resume text.
    2.  **NO FABRICATION**: Do NOT invent companies, job titles, dates, universities, degrees, or contact details (phone/email).
        - If the resume says "Software Engineer", do NOT change it to "Senior Software Engineer" unless the context implies it, but NEVER change the company name.
        - **NEVER** add a company to the work history that is not in the source text (e.g., do not add "Capgemini" or "Google" if the user didn't work there).
        - **NEVER** change the user's phone number or email address. Copy them exactly as they appear.
    3.  **CONTENT CHECKER**: Before generating the final JSON, perform a "content check" in your thinking process:
        - Verify that every company listed in the "custom_resume_text" exists in the input resume.
        - Verify that the contact info matches the input exactly.
        - If you find any information in your draft that isn't in the source, **DELETE IT**.
    4.  **OPTIMIZATION, NOT INVENTION**: You can rephrase sentences to be more impactful (e.g., active voice, keyword matching), but the underlying *facts* (who, what, where, when) must remain true to the source.

    **SCORING LOGIC (weights):**
    - Core skills match (30%)
    - Role/title alignment (20%)
    - Experience relevance (15%)
    - Achievement/results (10%)
    - Education & certifications (5%)
    - ATS/format readiness & keyword density (10%)
    - Soft skill & culture fit signals (5%)
    - Red flags (negative -5 to -15)

    **THRESHOLDS:**
    - 80–100 => "Eligible"
    - 60–79 => "Borderline"
    - 0–59 => "Not Eligible"

    **JOB DESCRIPTION:**
    ---
    ${jobDescription}
    ---

    **ANALYSIS TASK:**
    1.  **Extract & Verify**: First, extract the candidate's actual work history and contact info.
    2.  Analyze the extracted resume text against the job description.
    3.  Compute the match score and sub-scores based on the provided logic.
    4.  Generate a clear, itemized verdict and actionable suggestions.
    5.  **Rewrite Resume**: Rewrite the resume text to be optimized for the job description and ATS-friendly.
        - **Constraint**: The Contact Information header MUST match the original resume exactly.
        - **Constraint**: Work Experience entries must map 1:1 to the original resume's employers and dates. Do not add or remove employers.
    6.  Create a summary of the changes made.
    7.  Generate a "cover line" (a one-sentence hook).
    8.  Generate a **complete, professional cover letter** tailored to this specific job application.
        - Base the cover letter ONLY on the user's actual experience.
        - Do not claim the user has skills or experience they do not have.
    9.  Rewrite top achievements if applicable.
    10. Return a single JSON object with the specified schema.

    **OUTPUT JSON SCHEMA (RETURN EXACTLY THIS):**
    {
      "match_score": number,
      "verdict": "Eligible"|"Borderline"|"Not Eligible",
      "breakdown": {
        "core_skills": {"score": number, "details": [string]},
        "title_alignment": {"score": number, "details": [string]},
        "experience_relevance": {"score": number, "details": [string]},
        "achievements": {"score": number, "details":[string]},
        "education_certifications": {"score": number, "details":[string]},
        "ats_readiness": {"score": number, "details":[string]},
        "soft_skills": {"score": number, "details":[string]},
        "red_flags": {"score": number, "details":[string]}
      },
      "missing_items_prioritized": [
        {"type":"skill"|"certification"|"experience"|"keyword"|"format", "importance": "high"|"medium"|"low", "suggestion": "string"}
      ],
      "custom_resume_text": "string (The full text of the optimized resume)",
      "diff_summary": ["string"],
      "cover_line": "string",
      "cover_letter": "string (The full text of the cover letter)",
      "top_3_rewritten_achievements": ["string"],
      "explanations": ["short human readable strings, each < 120 chars"]
    }
  `;
};

const buildRecruiterScanPrompt = (jobDescription: string): string => {
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

    JOB DESCRIPTION:
    ${jobDescription}

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
  const prompt = buildPrompt(jobDescription);
  const contents = [];

  if (resume.text) {
    contents.push({ text: `Here is the resume text:\n\n${resume.text}` });
    contents.push({ text: prompt });
  } else if (resume.base64Data && resume.mimeType) {
    contents.push({
      inlineData: {
        data: resume.base64Data,
        mimeType: resume.mimeType,
      },
    });
    contents.push({ text: prompt });
  } else {
    throw new Error('Invalid resume data provided.');
  }

  try {
    const response = await ai.models.generateContent({
      model,
      contents: [{ parts: contents }],
      config: {
        thinkingConfig: { thinkingBudget: 32768 }, // Max thinking budget for verification
        temperature: 0.0, // Strict adherence to instructions
        responseMimeType: "application/json",
      }
    });

    const jsonString = response.text.trim();
    const cleanedJsonString = jsonString.replace(/^```json\s*|```$/g, '');
    const result: AnalysisResult = JSON.parse(cleanedJsonString);
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
  const prompt = buildRecruiterScanPrompt(jobDescription);
  const contents = [];

   if (resume.text) {
    contents.push({ text: `Here is the resume text:\n\n${resume.text}` });
    contents.push({ text: prompt });
  } else if (resume.base64Data && resume.mimeType) {
    contents.push({
      inlineData: {
        data: resume.base64Data,
        mimeType: resume.mimeType,
      },
    });
    contents.push({ text: prompt });
  } else {
    throw new Error('Invalid resume data provided.');
  }

  try {
    const response = await ai.models.generateContent({
      model,
      contents: [{ parts: contents }],
      config: {
        temperature: 0.0,
        responseMimeType: "application/json",
      }
    });

    const jsonString = response.text.trim();
    const cleanedJsonString = jsonString.replace(/^```json\s*|```$/g, '');
    return JSON.parse(cleanedJsonString);
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
  const prompt = `
    You are an AI recruitment assistant. Analyze this resume against the provided Job Description.
    
    JOB DESCRIPTION:
    ${jobDescription}

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
    contents.push({ text: `RESUME:\n${resume.text}` });
  } else if (resume.base64Data && resume.mimeType) {
    contents.push({ inlineData: { data: resume.base64Data, mimeType: resume.mimeType } });
  }
  contents.push({ text: prompt });

  const response = await ai.models.generateContent({
    model,
    contents: [{ parts: contents }],
    config: { temperature: 0.0, responseMimeType: "application/json" }
  });

  return JSON.parse(response.text.replace(/^```json\s*|```$/g, ''));
};

export const analyzeJobDescription = async (jobDescription: string): Promise<JDAnalysis> => {
  const prompt = `
    Analyze and improve this Job Description.
    
    JD:
    ${jobDescription}

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
    model,
    contents: [{ parts: [{ text: prompt }] }],
    config: { temperature: 0.0, responseMimeType: "application/json" }
  });

  return JSON.parse(response.text.replace(/^```json\s*|```$/g, ''));
};

export const simplifyResume = async (resume: { text?: string; base64Data?: string; mimeType?: string; }): Promise<string> => {
  const prompt = `
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
  contents.push({ text: prompt });

  const response = await ai.models.generateContent({
    model,
    contents: [{ parts: contents }],
    config: { temperature: 0.0 } // Markdown output
  });

  return response.text;
};

export const generateInterviewScript = async (
  jobDescription: string, 
  candidateSummary: string,
  redFlags: string[]
): Promise<InterviewScript> => {
  const prompt = `
    Generate a structured interview script for a candidate based on this JD and their profile summary.
    
    JD: ${jobDescription.substring(0, 1000)}...
    Candidate Summary: ${candidateSummary}
    Identified Risks: ${redFlags.join(', ')}

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
    model,
    contents: [{ parts: [{ text: prompt }] }],
    config: { temperature: 0.2, responseMimeType: "application/json" }
  });

  return JSON.parse(response.text.replace(/^```json\s*|```$/g, ''));
};

export const performCrossDomainAnalysis = async (
  candidateId: string,
  resume: { text?: string; base64Data?: string; mimeType?: string; }
): Promise<CrossDomainAnalysis> => {
  const prompt = `
SYSTEM: You are an expert career translator and recruiter analyst. Temperature=0.0. NEVER INVENT facts. Use ONLY the resumeText provided. Output JSON per the required schema.

USER: Given this resumeText and this list of targetDomains, for each domain evaluate if the candidate’s experience transfers. For each domain produce transferabilityScore 0-100, confidence, top 3-5 transferable skills, exact evidence substrings with start and end characters, 1-2 suggested resume bullet rewrites (reframing existing facts, do not invent numbers), 3 interview questions to validate transferability, a 3-item upskill checklist (practical, cheap, fast), and estimated timeToProductivityWeeks. If the resume does not support transfer to a domain, set transferabilityScore low and confidence low and explain briefly in 'reason' field.

INPUT:
{
 "candidateId":"${candidateId}",
 "resumeText":"<full extracted text>",
 "targetDomains": ["healthcare->fintech","edtech->SaaS", "government->enterprise","consumer->B2B","startup->corporate","academia->R&D", "retail->commerce","manufacturing->iot","nonprofit->public","agency->product-studio","hospitality->travel-tech","telecom->cloud","logistics->supplychain","media->streaming"]
}

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
  contents.push({ text: prompt });

  const response = await ai.models.generateContent({
    model,
    contents: [{ parts: contents }],
    config: { temperature: 0.0, responseMimeType: "application/json" }
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
  
  // Construct a stringified profile to pass to LLM
  const companyContext = inputs.companyProfile 
    ? JSON.stringify(inputs.companyProfile) 
    : inputs.companyString;
  
  const roleContext = inputs.jobRole
    ? JSON.stringify(inputs.jobRole)
    : inputs.jobRoleString;

  const prompt = `
    SYSTEM:
    "You are an expert interviewer and hiring strategist. Temperature=0.0. Only use the provided text. Do not invent facts. If evidence for a question is missing, mark confidence=low and evidence=[]. Output only JSON."

    USER:
    "Generate predicted interview questions for the inputs below. For each question, produce:
    id, category (behavioral|technical|scenario|founder|trick), question, difficulty (easy|medium|hard), confidence, answerGuidelines (3 bullets), reason (why this question appears, referencing input text), and sourceTokens (substring with startChar/endChar). Output MUST follow the exact JSON schema below.

    INPUT:
    {
      'requestId': '${requestId}',
      'companyProfile': '${companyContext.replace(/'/g, "")}',
      'jobRole': '${roleContext.replace(/'/g, "")}',
      'jobDescription': '${inputs.jobDescription.replace(/'/g, "").substring(0, 5000)}',
      'resumeText': '${inputs.resumeText.replace(/'/g, "").substring(0, 5000)}',
      'numQuestions': ${inputs.numQuestions},
      'options': { 'includeFounderStyle': true, 'includeTrickQuestions': true }
    }

    OUTPUT SCHEMA:
    {
    'requestId':'string',
    'metadata':{'generatedAt':'ISO8601','model':'gemini-3-pro-preview'},
    'questions':[{
        'id':'string',
        'category':'behavioral'|'technical'|'scenario'|'founder'|'trick',
        'question':'string',
        'difficulty':'easy'|'medium'|'hard',
        'confidence':'high'|'medium'|'low',
        'answerGuidelines':['string','string','string'],
        'reason':'string',
        'sourceTokens':[{'text':'string','startChar':int,'endChar':int}]
    }],
    'summary':{
        'topCategories':['string'],
        'overallConfidence':'high'|'medium'|'low',
        'notes':'string'
    }
    }
  `;

  const response = await ai.models.generateContent({
    model,
    contents: [{ parts: [{ text: prompt }] }],
    config: { temperature: 0.0, responseMimeType: "application/json" }
  });

  return JSON.parse(response.text.replace(/^```json\s*|```$/g, ''));
};

export const analyzePracticeAnswer = async (
  question: string,
  answer: string
): Promise<PracticeFeedback> => {
  const prompt = `
    You are an expert interview coach. Analyze the user's answer to the interview question below.
    
    Question: "${question}"
    User Answer: "${answer}"

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
    model,
    contents: [{ parts: [{ text: prompt }] }],
    config: { temperature: 0.2, responseMimeType: "application/json" }
  });

  return JSON.parse(response.text.replace(/^```json\s*|```$/g, ''));
};

// --- Helper: Extract Text from File (Multimodal) ---
export const extractTextFromFile = async (
  file: { base64Data: string; mimeType: string; }
): Promise<string> => {
  const prompt = `Extract all text from this document verbatim. Return ONLY the text content. Do not add any markdown or commentary.`;
  
  const response = await ai.models.generateContent({
    model,
    contents: [{
      parts: [
        { inlineData: { data: file.base64Data, mimeType: file.mimeType } },
        { text: prompt }
      ]
    }],
    config: { temperature: 0.0 }
  });
  
  return response.text.trim();
};

export const interviewChat = async (request: ChatRequest): Promise<InterviewChatResponse> => {
  const { history, userQuestion, context } = request;

  // Strict RAG System Prompt
  const prompt = `
    SYSTEM:
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

    **CONTEXT INFORMATION:**
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

  const response = await ai.models.generateContent({
    model,
    contents: [{ parts: [{ text: prompt }] }],
    config: { temperature: 0.0, responseMimeType: "application/json" }
  });

  return JSON.parse(response.text.replace(/^```json\s*|```$/g, ''));
};
