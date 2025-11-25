
import React, { useState, useRef, useEffect } from 'react';
import { SparklesIcon } from './icons/SparklesIcon';
import { DownloadIcon } from './icons/DownloadIcon';
import { ClipboardIcon } from './icons/ClipboardIcon';
import { MaximizeIcon } from './icons/MaximizeIcon';
import { EditIcon } from './icons/EditIcon';
import type { 
  InterviewPredictionResponse, 
  PredictedQuestion, 
  PracticeFeedback, 
  CompanyMetadata, 
  RoleMetadata 
} from '../types';
import { COMPANIES, ROLES } from '../data/interviewData';
import { predictInterviewQuestions, analyzePracticeAnswer } from '../services/geminiService';

interface InterviewQuestionPredictorProps {
  initialJobDescription?: string;
  resumeFile?: File | null;
}

// --- Icons ---
const PlusIcon = () => <svg xmlns="http://www.w3.org/2000/svg" className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>;
const CheckIcon = () => <svg xmlns="http://www.w3.org/2000/svg" className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><polyline points="20 6 9 17 4 12"></polyline></svg>;
const AlertIcon = () => <svg xmlns="http://www.w3.org/2000/svg" className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>;

export const InterviewQuestionPredictor: React.FC<InterviewQuestionPredictorProps> = ({ 
  initialJobDescription = '', 
  resumeFile 
}) => {
  // --- Inputs State ---
  const [companyInput, setCompanyInput] = useState('');
  const [selectedCompany, setSelectedCompany] = useState<CompanyMetadata | null>(null);
  const [showCompanySuggestions, setShowCompanySuggestions] = useState(false);
  
  const [roleInput, setRoleInput] = useState('');
  const [selectedRole, setSelectedRole] = useState<RoleMetadata | null>(null);
  const [showRoleSuggestions, setShowRoleSuggestions] = useState(false);
  
  // --- Context State ---
  const [useJD, setUseJD] = useState(!!initialJobDescription);
  const [jdText, setJdText] = useState(initialJobDescription);
  
  const [useResume, setUseResume] = useState(!!resumeFile);
  const [resumeText, setResumeText] = useState(''); // Parsed text
  const [resumeFileName, setResumeFileName] = useState(resumeFile?.name || '');

  // --- Modals State ---
  const [activeContextModal, setActiveContextModal] = useState<'jd' | 'resume' | 'view-jd' | 'view-resume' | null>(null);
  const [tempJdText, setTempJdText] = useState('');
  const [missingContextWarning, setMissingContextWarning] = useState(false);

  // --- Generation State ---
  const [isLoading, setIsLoading] = useState(false);
  const [loadingStep, setLoadingStep] = useState('');
  const [result, setResult] = useState<InterviewPredictionResponse | null>(null);
  const [activeTab, setActiveTab] = useState<'all' | 'behavioral' | 'technical' | 'scenario' | 'founder' | 'trick' | 'practice'>('all');
  
  // --- Practice Mode State ---
  const [practiceMode, setPracticeMode] = useState<{ isOpen: boolean; question: PredictedQuestion | null }>({ isOpen: false, question: null });
  const [practiceAnswer, setPracticeAnswer] = useState('');
  const [isAnalyzingAnswer, setIsAnalyzingAnswer] = useState(false);
  const [practiceFeedback, setPracticeFeedback] = useState<PracticeFeedback | null>(null);

  // --- Refs for Click Outside ---
  const companyRef = useRef<HTMLDivElement>(null);
  const roleRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (companyRef.current && !companyRef.current.contains(event.target as Node)) {
        setShowCompanySuggestions(false);
      }
      if (roleRef.current && !roleRef.current.contains(event.target as Node)) {
        setShowRoleSuggestions(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Initialize Resume Text if file provided initially
  useEffect(() => {
    if (resumeFile && !resumeText) {
      resumeFile.text().then(text => setResumeText(text));
    }
  }, [resumeFile]);

  // --- Logic: Autocomplete ---
  const filteredCompanies = COMPANIES.filter(c => c.name.toLowerCase().includes(companyInput.toLowerCase()));
  const filteredRoles = ROLES.filter(r => r.title.toLowerCase().includes(roleInput.toLowerCase()));

  // --- Logic: Context Management ---
  const handleAddJD = () => {
    setTempJdText(jdText);
    setActiveContextModal('jd');
  };
  const handleSaveJD = () => {
    setJdText(tempJdText);
    setActiveContextModal(null);
  };

  const handleResumeUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setResumeFileName(file.name);
      // Mock OCR/Extraction - in real app, reuse service logic
      const text = await file.text();
      setResumeText(text);
      setActiveContextModal(null);
    }
  };

  // --- Logic: Generation ---
  const handleGenerateClick = () => {
    if ((useJD && !jdText) || (useResume && !resumeText)) {
      setMissingContextWarning(true);
      return;
    }
    runGeneration();
  };

  const runGeneration = async () => {
    setMissingContextWarning(false);
    setIsLoading(true);
    setResult(null);
    
    // Progress Simulation
    setLoadingStep('Analyzing Context...');
    await new Promise(r => setTimeout(r, 800));
    setLoadingStep('Matching signals to Role...');
    await new Promise(r => setTimeout(r, 800));
    setLoadingStep('Crafting targeted questions...');

    try {
      const response = await predictInterviewQuestions({
        companyProfile: selectedCompany,
        companyString: companyInput,
        jobRole: selectedRole,
        jobRoleString: roleInput,
        jobDescription: useJD ? jdText : '',
        resumeText: useResume ? resumeText : '',
        numQuestions: 8
      });
      setResult(response);
    } catch (e) {
      console.error(e);
      alert("Generation failed. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  // --- Logic: Practice Mode ---
  const handlePracticeSubmit = async () => {
    if (!practiceAnswer || !practiceMode.question) return;
    setIsAnalyzingAnswer(true);
    try {
      const feedback = await analyzePracticeAnswer(practiceMode.question.question, practiceAnswer);
      setPracticeFeedback(feedback);
    } catch (e) {
      console.error(e);
    } finally {
      setIsAnalyzingAnswer(false);
    }
  };

  // --- Logic: Export ---
  const handleExport = () => {
    if (!result) return;
    const content = `INTERVIEW PREP\nCompany: ${companyInput}\nRole: ${roleInput}\n\n` + 
      result.questions.map(q => `Q: ${q.question}\nGuidelines: ${q.answerGuidelines.join('; ')}`).join('\n\n');
      
    const blob = new Blob([content], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "Interview_Prep.txt";
    a.click();
  };

  return (
    <div className="max-w-5xl mx-auto space-y-8 animate-scale-in">
      
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-gray-900 tracking-tight">Interview Question Predictor</h1>
        <p className="text-gray-500 text-lg">AI-generated questions tailored to the company culture and role.</p>
      </div>

      {/* Input Card */}
      <div className="bg-white rounded-3xl p-6 sm:p-8 shadow-apple-card border border-white/60 relative z-20">
        
        {/* Company & Role Inputs */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
          <div className="relative" ref={companyRef}>
            <label className="block text-xs font-bold uppercase text-gray-400 mb-1.5 ml-1">Company Name</label>
            <input 
              value={companyInput}
              onChange={(e) => { setCompanyInput(e.target.value); setShowCompanySuggestions(true); setSelectedCompany(null); }}
              onFocus={() => setShowCompanySuggestions(true)}
              placeholder="e.g. Google"
              className="w-full bg-gray-50 border-0 rounded-xl p-3.5 text-sm font-medium focus:ring-2 focus:ring-system-blue/20 outline-none transition-all focus:bg-white"
            />
            {showCompanySuggestions && companyInput && (
              <div className="absolute top-full left-0 w-full mt-2 bg-white rounded-xl shadow-xl border border-gray-100 max-h-60 overflow-y-auto z-50">
                {filteredCompanies.length > 0 ? filteredCompanies.map(c => (
                  <div 
                    key={c.id} 
                    onClick={() => { setCompanyInput(c.name); setSelectedCompany(c); setShowCompanySuggestions(false); }}
                    className="p-3 hover:bg-gray-50 cursor-pointer flex justify-between items-center group"
                  >
                    <div>
                      <div className="font-bold text-gray-800">{c.name}</div>
                      <div className="text-xs text-gray-400">{c.industry} • {c.avgDifficulty} Difficulty</div>
                    </div>
                    {c.typicalRounds && <span className="text-[10px] bg-gray-100 px-2 py-1 rounded text-gray-500 group-hover:bg-white transition-colors">{c.typicalRounds}</span>}
                  </div>
                )) : (
                  <div className="p-3 text-sm text-gray-400 italic">No matches found. Using custom input.</div>
                )}
              </div>
            )}
            {selectedCompany && (
               <div className="absolute right-3 top-[34px] hidden md:block">
                  <span className="text-[10px] font-bold bg-blue-50 text-blue-600 px-2 py-0.5 rounded border border-blue-100">Verified Metadata</span>
               </div>
            )}
          </div>

          <div className="relative" ref={roleRef}>
            <label className="block text-xs font-bold uppercase text-gray-400 mb-1.5 ml-1">Job Role</label>
            <input 
              value={roleInput}
              onChange={(e) => { setRoleInput(e.target.value); setShowRoleSuggestions(true); setSelectedRole(null); }}
              onFocus={() => setShowRoleSuggestions(true)}
              placeholder="e.g. Product Designer"
              className="w-full bg-gray-50 border-0 rounded-xl p-3.5 text-sm font-medium focus:ring-2 focus:ring-system-blue/20 outline-none transition-all focus:bg-white"
            />
            {showRoleSuggestions && roleInput && (
              <div className="absolute top-full left-0 w-full mt-2 bg-white rounded-xl shadow-xl border border-gray-100 max-h-60 overflow-y-auto z-50">
                {filteredRoles.length > 0 ? filteredRoles.map(r => (
                   <div 
                    key={r.id}
                    onClick={() => { setRoleInput(r.title); setSelectedRole(r); setShowRoleSuggestions(false); }}
                    className="p-3 hover:bg-gray-50 cursor-pointer flex justify-between items-center group"
                  >
                    <div>
                      <div className="font-bold text-gray-800">{r.title}</div>
                      <div className="text-xs text-gray-400">{r.seniorityLevel} Level</div>
                    </div>
                  </div>
                )) : (
                   <div className="p-3 text-sm text-gray-400 italic">No matches found. Using custom input.</div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Checkboxes */}
        <div className="flex gap-6 mb-4 px-1">
          <label className="flex items-center gap-2 cursor-pointer select-none">
            <input type="checkbox" checked={useJD} onChange={e => setUseJD(e.target.checked)} className="w-4 h-4 rounded text-system-blue border-gray-300 focus:ring-system-blue"/>
            <span className="text-sm font-medium text-gray-700">Include JD Context</span>
          </label>
          <label className="flex items-center gap-2 cursor-pointer select-none">
            <input type="checkbox" checked={useResume} onChange={e => setUseResume(e.target.checked)} className="w-4 h-4 rounded text-system-blue border-gray-300 focus:ring-system-blue"/>
            <span className="text-sm font-medium text-gray-700">Include Resume Context</span>
          </label>
        </div>

        {/* Context Summary Bar */}
        <div className="bg-gray-50 rounded-xl p-3 flex flex-col sm:flex-row gap-4 sm:items-center justify-between border border-gray-100 mb-6">
           <div className="flex flex-col sm:flex-row gap-4">
              {/* JD Chip */}
              <div className="flex items-center gap-3">
                 <div className={`w-8 h-8 rounded-full flex items-center justify-center ${jdText ? 'bg-green-100 text-green-600' : 'bg-gray-200 text-gray-400'}`}>
                    {jdText ? <CheckIcon/> : <span className="text-xs font-bold">JD</span>}
                 </div>
                 <div className="flex flex-col">
                    <span className="text-xs font-bold text-gray-900">Job Description</span>
                    <span className="text-[10px] text-gray-500 font-medium">{jdText ? `Loaded (${jdText.length} chars)` : 'Not Added'}</span>
                 </div>
                 <div className="flex gap-1 ml-2">
                    {jdText ? (
                       <button onClick={() => setActiveContextModal('view-jd')} className="px-2 py-1 bg-white border border-gray-200 rounded text-[10px] font-bold text-gray-600 hover:text-system-blue">View</button>
                    ) : (
                       <button onClick={handleAddJD} className="px-2 py-1 bg-system-blue text-white rounded text-[10px] font-bold hover:bg-blue-600 shadow-sm flex items-center gap-1"><PlusIcon/> Add</button>
                    )}
                 </div>
              </div>
              <div className="w-px h-8 bg-gray-200 hidden sm:block"></div>
              {/* Resume Chip */}
              <div className="flex items-center gap-3">
                 <div className={`w-8 h-8 rounded-full flex items-center justify-center ${resumeText ? 'bg-green-100 text-green-600' : 'bg-gray-200 text-gray-400'}`}>
                    {resumeText ? <CheckIcon/> : <span className="text-xs font-bold">CV</span>}
                 </div>
                 <div className="flex flex-col">
                    <span className="text-xs font-bold text-gray-900">Resume</span>
                    <span className="text-[10px] text-gray-500 font-medium">{resumeText ? `Uploaded (${resumeFileName.slice(0, 10)}...)` : 'Not Uploaded'}</span>
                 </div>
                 <div className="flex gap-1 ml-2">
                    {resumeText ? (
                       <button onClick={() => setActiveContextModal('view-resume')} className="px-2 py-1 bg-white border border-gray-200 rounded text-[10px] font-bold text-gray-600 hover:text-system-blue">View</button>
                    ) : (
                       <button onClick={() => setActiveContextModal('resume')} className="px-2 py-1 bg-system-blue text-white rounded text-[10px] font-bold hover:bg-blue-600 shadow-sm flex items-center gap-1"><PlusIcon/> Upload</button>
                    )}
                 </div>
              </div>
           </div>
           
           {(useJD && !jdText) || (useResume && !resumeText) ? (
              <div className="text-xs text-orange-600 bg-orange-50 px-3 py-1.5 rounded-lg border border-orange-100 font-medium flex items-center gap-2">
                 <AlertIcon/> Context enabled but missing.
              </div>
           ) : null}
        </div>

        {/* CTA */}
        <button 
          onClick={handleGenerateClick}
          disabled={isLoading}
          className="w-full py-4 bg-system-blue text-white font-bold rounded-2xl shadow-lg shadow-blue-500/20 hover:bg-blue-600 active:scale-[0.99] transition-all flex items-center justify-center gap-3 disabled:opacity-70 disabled:cursor-not-allowed text-lg"
        >
           {isLoading ? (
             <>
               <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
               {loadingStep}
             </>
           ) : (
             <>
               <SparklesIcon className="w-5 h-5" /> Generate Questions
             </>
           )}
        </button>
        <p className="text-center text-[10px] text-gray-400 mt-4 font-medium">
           We process your JD and resume in memory only. Nothing is stored beyond your session.
        </p>
      </div>

      {/* Missing Context Warning Modal */}
      {missingContextWarning && (
         <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
             <div className="absolute inset-0 bg-black/20 backdrop-blur-sm" onClick={() => setMissingContextWarning(false)}></div>
             <div className="bg-white rounded-2xl p-6 max-w-sm w-full relative z-10 shadow-2xl animate-[scaleIn_0.1s_ease-out]">
                 <h3 className="text-lg font-bold text-gray-900 mb-2">Context Missing</h3>
                 <p className="text-gray-600 text-sm mb-6">You enabled context checkboxes but haven't added the data yet. Results will be generic.</p>
                 <div className="flex gap-3">
                     <button onClick={() => setMissingContextWarning(false)} className="flex-1 py-2.5 bg-gray-100 font-semibold rounded-xl text-sm hover:bg-gray-200 text-gray-700">Go Back</button>
                     <button onClick={runGeneration} className="flex-1 py-2.5 bg-system-blue text-white font-bold rounded-xl text-sm hover:bg-blue-600 shadow-lg shadow-blue-500/20">Continue Anyway</button>
                 </div>
             </div>
         </div>
      )}

      {/* Results Section */}
      {result && (
        <div className="space-y-6 animate-[fadeIn_0.5s_ease-out]">
           <div className="flex justify-between items-center">
              {/* Tabs */}
              <div className="flex overflow-x-auto pb-1 gap-2 hide-scrollbar">
                {['all', 'behavioral', 'technical', 'scenario', 'founder', 'trick'].map(tab => (
                    <button
                        key={tab}
                        onClick={() => setActiveTab(tab as any)}
                        className={`px-4 py-1.5 rounded-full text-sm font-semibold whitespace-nowrap transition-colors ${
                            activeTab === tab ? 'bg-gray-900 text-white' : 'bg-white text-gray-500 hover:bg-gray-100 shadow-sm border border-gray-100'
                        }`}
                    >
                        {tab.charAt(0).toUpperCase() + tab.slice(1)}
                    </button>
                ))}
              </div>
              <button onClick={handleExport} className="text-gray-500 hover:text-gray-900 p-2 rounded-full hover:bg-gray-100 transition-colors" title="Export PDF">
                 <DownloadIcon className="w-5 h-5"/>
              </button>
           </div>

           <div className="space-y-4">
              {result.questions.filter(q => activeTab === 'all' || q.category === activeTab).map(q => (
                  <div key={q.id} className="bg-white border border-gray-100 rounded-2xl shadow-sm hover:shadow-apple-hover transition-all p-6 group">
                      <div className="flex justify-between items-start mb-3 gap-4">
                          <div className="flex-1">
                              <div className="flex items-center gap-2 mb-2">
                                  <span className="text-[10px] font-bold uppercase tracking-wider bg-gray-100 text-gray-500 px-2 py-0.5 rounded">{q.category}</span>
                                  <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded ${
                                      q.difficulty === 'hard' ? 'bg-red-50 text-red-600' : 
                                      q.difficulty === 'medium' ? 'bg-orange-50 text-orange-600' : 'bg-green-50 text-green-600'
                                  }`}>{q.difficulty}</span>
                              </div>
                              <h3 className="text-lg font-bold text-gray-900 leading-snug">{q.question}</h3>
                          </div>
                          <div className={`shrink-0 px-2 py-1 rounded text-[10px] font-bold uppercase border ${
                             q.confidence === 'high' ? 'bg-green-50 text-green-700 border-green-100' : 'bg-gray-50 text-gray-400 border-gray-100'
                          }`}>
                              {q.confidence} Conf.
                          </div>
                      </div>
                      
                      <p className="text-xs text-gray-500 italic mb-4 border-l-2 border-gray-200 pl-3">
                          {q.reason}
                      </p>

                      <div className="bg-gray-50/80 rounded-xl p-4 mb-4">
                          <h4 className="text-[10px] font-bold uppercase text-gray-400 mb-2">Guidance</h4>
                          <ul className="space-y-1">
                              {q.answerGuidelines.map((g, i) => (
                                  <li key={i} className="text-sm text-gray-700 flex gap-2 items-start">
                                      <span className="text-system-blue mt-1">•</span>
                                      {g}
                                  </li>
                              ))}
                          </ul>
                      </div>

                      <div className="flex gap-3 pt-2 border-t border-gray-50">
                          <button 
                             onClick={() => { setPracticeMode({ isOpen: true, question: q }); setPracticeAnswer(''); setPracticeFeedback(null); }}
                             className="px-4 py-2 bg-system-blue text-white text-xs font-bold rounded-lg shadow-sm hover:bg-blue-600 transition-colors"
                          >
                              Practice Now
                          </button>
                          <button 
                             onClick={() => navigator.clipboard.writeText(q.question)}
                             className="px-4 py-2 bg-white border border-gray-200 text-gray-600 text-xs font-bold rounded-lg hover:bg-gray-50 transition-colors flex items-center gap-1"
                          >
                              <ClipboardIcon className="w-3 h-3"/> Copy
                          </button>
                      </div>
                  </div>
              ))}
           </div>
        </div>
      )}

      {/* --- Context Modals --- */}
      
      {/* Add/Edit JD Modal */}
      {activeContextModal === 'jd' && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
              <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" onClick={() => setActiveContextModal(null)}></div>
              <div className="bg-white rounded-3xl w-full max-w-2xl shadow-2xl relative z-10 animate-[scaleIn_0.1s_ease-out] flex flex-col max-h-[90vh]">
                  <div className="p-6 border-b border-gray-100 flex justify-between items-center">
                      <h3 className="font-bold text-gray-900 text-lg">Job Description</h3>
                      <button onClick={() => setActiveContextModal(null)} className="text-gray-400 hover:text-gray-900">Close</button>
                  </div>
                  <div className="p-6 flex-1 overflow-hidden">
                      <textarea 
                        className="w-full h-full min-h-[300px] resize-none outline-none text-sm leading-relaxed text-gray-800 font-sans"
                        placeholder="Paste text here..."
                        value={tempJdText}
                        onChange={e => setTempJdText(e.target.value)}
                        autoFocus
                      />
                  </div>
                  <div className="p-4 border-t border-gray-100 bg-gray-50 rounded-b-3xl flex justify-between items-center">
                      <span className="text-xs text-gray-500 font-medium">{tempJdText.length} chars</span>
                      <button onClick={handleSaveJD} className="px-6 py-2 bg-gray-900 text-white rounded-full text-sm font-bold shadow-lg hover:bg-black">Save Context</button>
                  </div>
              </div>
          </div>
      )}

      {/* Upload Resume Modal */}
      {activeContextModal === 'resume' && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
              <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" onClick={() => setActiveContextModal(null)}></div>
              <div className="bg-white rounded-3xl w-full max-w-md shadow-2xl relative z-10 animate-[scaleIn_0.1s_ease-out] p-8 text-center">
                  <h3 className="font-bold text-gray-900 text-lg mb-2">Upload Resume</h3>
                  <p className="text-gray-500 text-sm mb-6">We'll extract text to tailor questions.</p>
                  <label className="block border-2 border-dashed border-gray-200 rounded-2xl p-10 hover:bg-gray-50 cursor-pointer transition-colors group">
                      <div className="w-12 h-12 bg-blue-50 text-system-blue rounded-full flex items-center justify-center mx-auto mb-3 group-hover:scale-110 transition-transform">
                          <PlusIcon />
                      </div>
                      <span className="text-sm font-bold text-gray-900">Click to Upload</span>
                      <input type="file" className="hidden" accept=".pdf,.txt,.doc,.docx" onChange={handleResumeUpload} />
                  </label>
                  <button onClick={() => setActiveContextModal(null)} className="mt-6 text-gray-400 text-sm hover:text-gray-900 font-medium">Cancel</button>
              </div>
          </div>
      )}

      {/* Viewers (Drawers) */}
      {(activeContextModal === 'view-jd' || activeContextModal === 'view-resume') && (
           <div className="fixed inset-0 z-50 flex justify-end">
               <div className="absolute inset-0 bg-black/20 backdrop-blur-sm" onClick={() => setActiveContextModal(null)}></div>
               <div className="w-full max-w-lg bg-white h-full shadow-2xl relative z-10 animate-[slideInRight_0.3s_ease-out] flex flex-col">
                   <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-gray-50/80">
                       <div>
                          <h3 className="font-bold text-gray-900 text-lg">{activeContextModal === 'view-jd' ? 'Job Description' : 'Resume Context'}</h3>
                          <p className="text-xs text-gray-500 font-mono mt-1">{activeContextModal === 'view-jd' ? `${jdText.length} chars` : resumeFileName}</p>
                       </div>
                       <div className="flex gap-2">
                           <button onClick={() => activeContextModal === 'view-jd' ? setActiveContextModal('jd') : setActiveContextModal('resume')} className="p-2 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 text-gray-600"><EditIcon className="w-4 h-4"/></button>
                           <button onClick={() => setActiveContextModal(null)} className="p-2 hover:bg-gray-100 rounded-lg text-gray-400">✕</button>
                       </div>
                   </div>
                   <div className="flex-1 overflow-y-auto p-6">
                       <pre className="whitespace-pre-wrap font-sans text-sm text-gray-700 leading-relaxed">
                           {activeContextModal === 'view-jd' ? jdText : resumeText}
                       </pre>
                   </div>
               </div>
           </div>
      )}

      {/* Practice Mode Modal */}
      {practiceMode.isOpen && practiceMode.question && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setPracticeMode({isOpen: false, question: null})}></div>
            <div className="bg-white w-full max-w-2xl rounded-3xl shadow-2xl relative z-10 flex flex-col max-h-[90vh] overflow-hidden animate-[scaleIn_0.2s_ease-out]">
                {/* Header */}
                <div className="p-6 border-b border-gray-100 bg-gray-50/50 flex justify-between items-start">
                    <div>
                        <div className="flex gap-2 mb-2">
                            <span className="text-[10px] font-bold uppercase bg-blue-100 text-blue-700 px-2 py-0.5 rounded">{practiceMode.question.category}</span>
                        </div>
                        <h3 className="text-xl font-bold text-gray-900">{practiceMode.question.question}</h3>
                    </div>
                    <button onClick={() => setPracticeMode({isOpen: false, question: null})} className="p-2 bg-gray-200 rounded-full hover:bg-gray-300 text-gray-500">
                        ✕
                    </button>
                </div>
                
                <div className="flex-1 overflow-y-auto p-6 bg-[#F9F9FB]">
                    {!practiceFeedback ? (
                        <div className="space-y-4">
                            <label className="block text-sm font-bold text-gray-700">Your Answer</label>
                            <textarea 
                                value={practiceAnswer}
                                onChange={(e) => setPracticeAnswer(e.target.value)}
                                placeholder="Type your answer here... (Focus on STAR method)"
                                className="w-full h-48 p-4 border border-gray-200 rounded-xl focus:ring-2 focus:ring-system-blue/20 outline-none resize-none text-base bg-white"
                                autoFocus
                            />
                            <div className="flex justify-end">
                                <button 
                                    onClick={handlePracticeSubmit}
                                    disabled={!practiceAnswer || isAnalyzingAnswer}
                                    className="px-6 py-3 bg-system-blue text-white font-bold rounded-xl shadow-lg hover:bg-blue-600 disabled:opacity-50 transition-all flex items-center gap-2"
                                >
                                    {isAnalyzingAnswer ? (
                                        <>
                                            <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                                            Analyzing...
                                        </>
                                    ) : 'Get AI Feedback'}
                                </button>
                            </div>
                        </div>
                    ) : (
                        <div className="space-y-6 animate-[fadeIn_0.3s_ease-out]">
                            <div className="grid grid-cols-2 gap-4">
                                <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 text-center">
                                    <div className="text-sm font-medium text-gray-500 mb-1">Clarity Score</div>
                                    <div className={`text-3xl font-bold ${practiceFeedback.clarity_score >= 80 ? 'text-green-500' : 'text-orange-500'}`}>
                                        {practiceFeedback.clarity_score}
                                    </div>
                                </div>
                                <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 text-center">
                                    <div className="text-sm font-medium text-gray-500 mb-1">STAR Method</div>
                                    <div className={`text-xl font-bold mt-1 ${
                                        practiceFeedback.star_method_rating === 'Strong' ? 'text-green-500' : 
                                        practiceFeedback.star_method_rating === 'Average' ? 'text-orange-500' : 'text-red-500'
                                    }`}>
                                        {practiceFeedback.star_method_rating}
                                    </div>
                                </div>
                            </div>
                            
                            <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                                    <div>
                                        <h5 className="text-xs font-bold uppercase text-green-600 mb-2">Strengths</h5>
                                        <ul className="space-y-1">
                                            {practiceFeedback.strengths.map((s,i) => <li key={i} className="text-sm text-gray-700 flex gap-2"><span className="text-green-500">✓</span> {s}</li>)}
                                        </ul>
                                    </div>
                                    <div>
                                        <h5 className="text-xs font-bold uppercase text-orange-600 mb-2">Improvements</h5>
                                        <ul className="space-y-1">
                                            {practiceFeedback.improvements.map((s,i) => <li key={i} className="text-sm text-gray-700 flex gap-2"><span className="text-orange-500">↑</span> {s}</li>)}
                                        </ul>
                                    </div>
                                </div>
                            </div>
                            
                            <div className="bg-blue-50/50 p-6 rounded-2xl border border-blue-100">
                                <h4 className="font-bold text-blue-900 mb-2">Sample Better Response</h4>
                                <p className="text-blue-800 text-sm leading-relaxed whitespace-pre-wrap">{practiceFeedback.sample_better_response}</p>
                            </div>
                            
                            <div className="text-center">
                                <button 
                                    onClick={() => setPracticeFeedback(null)}
                                    className="text-system-blue font-bold text-sm hover:underline"
                                >
                                    Try Again
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
      )}

    </div>
  );
};
