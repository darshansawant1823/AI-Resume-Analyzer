
export interface ScoreDetail {
  score: number;
  details: string[];
}

export interface Breakdown {
  core_skills: ScoreDetail;
  title_alignment: ScoreDetail;
  experience_relevance: ScoreDetail;
  achievements: ScoreDetail;
  education_certifications: ScoreDetail;
  ats_readiness: ScoreDetail;
  soft_skills: ScoreDetail;
  red_flags: ScoreDetail;
}

export interface MissingItem {
  type: 'skill' | 'certification' | 'experience' | 'keyword' | 'format';
  importance: 'high' | 'medium' | 'low';
  suggestion: string;
}

export interface RecruiterScanResult {
  firstNoticed: string[];
  missedItems: string[];
  redFlags: string[];
  recruiterImpression: string;
}

export interface AnalysisResult {
  match_score: number;
  verdict: 'Eligible' | 'Borderline' | 'Not Eligible';
  breakdown: Breakdown;
  missing_items_prioritized: MissingItem[];
  custom_resume_text: string;
  diff_summary: string[];
  cover_line: string | null;
  cover_letter: string;
  top_3_rewritten_achievements: string[];
  explanations: string[];
}

// --- Recruiter Portal Types ---

export interface DomainEvidence {
  text: string;
  startChar: number;
  endChar: number;
}

export interface TransferDomain {
  domainName: string;
  transferabilityScore: number;
  confidence: 'low' | 'medium' | 'high';
  primarySkills: string[];
  evidence: DomainEvidence[];
  suggestedBullets: string[];
  interviewQuestions: string[];
  upskillChecklist: string[];
  timeToProductivityWeeks: number;
}

export interface CrossDomainAnalysis {
  candidateId: string;
  domains: TransferDomain[];
}

export interface CandidateAnalysis {
  match_score: number;
  potential_score: number; // Upside/Growth potential
  red_flags: string[];
  strengths: string[];
  summary: string;
  training_estimate: string; // e.g., "2 weeks to upskill"
  years_experience: number;
  seniority_level: string;
  // New fields for Comparison
  breakdown?: {
    core_skills: number;
    title_alignment: number;
    experience_relevance: number;
    ats_readiness: number;
    soft_skills: number;
  };
  gaps?: string[];
}

export interface Candidate {
  id: string;
  name: string; // Extracted from filename or analysis
  file: File;
  status: 'pending' | 'processing' | 'analyzed' | 'error';
  analysis?: CandidateAnalysis;
  crossDomainAnalysis?: CrossDomainAnalysis; // Cache for 24h
}

export interface JDAnalysis {
  clarity_score: number;
  bias_score: number; // Lower is better
  market_fit_score: number;
  must_haves: string[];
  nice_to_haves: string[];
  red_flags_in_jd: string[];
  rewritten_jd: string;
  competency_model: string[];
}

export interface InterviewQuestion {
  question: string;
  type: 'technical' | 'behavioral' | 'situational' | 'risk-probe';
  expected_answer: string;
  score_criteria: string;
}

export interface InterviewScript {
  questions: InterviewQuestion[];
  recommendation_template: string;
}

// --- Interview Predictor Types ---

export interface CompanyMetadata {
  id: string;
  name: string;
  industry: string;
  sizeCategory: 'Startup' | 'SMB' | 'Mid-Market' | 'Enterprise';
  headquartersCountry: string;
  commonInterviewStyle: string[];
  typicalRounds: string;
  avgDifficulty: 'Easy' | 'Medium' | 'Hard';
  publicSignalNotes: string;
  mockAssetUrl?: string;
}

export interface RoleMetadata {
  id: string;
  title: string;
  seniorityLevel: 'Junior' | 'Mid' | 'Senior' | 'Lead' | 'Manager';
  coreCompetencies: string[];
  likelyQuestionTypes: string[];
  typicalDeliverables: string;
  exampleJDs: string;
}

export interface SourceToken {
  text: string;
  startChar: number;
  endChar: number;
}

export interface PredictedQuestion {
  id: string;
  category: 'behavioral' | 'technical' | 'scenario' | 'founder' | 'trick' | 'practice';
  question: string;
  difficulty: 'easy' | 'medium' | 'hard';
  confidence: 'high' | 'medium' | 'low';
  answerGuidelines: string[];
  reason: string;
  sourceTokens: SourceToken[];
}

export interface InterviewPredictionSummary {
  topCategories: string[];
  overallConfidence: 'high' | 'medium' | 'low';
  notes: string;
}

export interface InterviewPredictionResponse {
  requestId: string;
  metadata: { generatedAt: string; model: string };
  questions: PredictedQuestion[];
  summary: InterviewPredictionSummary;
}

export interface PracticeFeedback {
  clarity_score: number;
  star_method_rating: 'Strong' | 'Average' | 'Weak';
  strengths: string[];
  improvements: string[];
  sample_better_response: string;
}

// --- Interview Chat Types ---

export interface ChatSource {
  id: string;
  title: string; // e.g. "JD", "Glassdoor"
  type: 'jd' | 'resume' | 'web' | 'metadata';
  snippet?: string;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'ai';
  content: string;
  sources?: ChatSource[]; // If AI, list sources used
  timestamp: number;
}

export interface ChatRequest {
  history: ChatMessage[];
  userQuestion: string;
  context: {
    company?: CompanyMetadata | null;
    companyString?: string;
    role?: RoleMetadata | null;
    roleString?: string;
    jdText?: string;
    resumeText?: string;
    researchSources?: { name: string; description: string; provenance: string }[];
  };
}

export interface InterviewChatResponse {
  answerText: string;
  usedSources: ChatSource[]; // The AI should return which sources it actually referenced
  suggestedFollowUps: string[];
}
