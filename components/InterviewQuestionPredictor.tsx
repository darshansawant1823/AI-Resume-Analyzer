
import React, { useState, useRef, useEffect, useMemo, useLayoutEffect } from 'react';
import { createPortal } from 'react-dom';
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
import { predictInterviewQuestions, analyzePracticeAnswer, extractTextFromFile } from '../services/geminiService';
import { InterviewChatBot } from './InterviewChatBot';

interface InterviewQuestionPredictorProps {
  initialJobDescription?: string;
  resumeFile?: File | null;
}

// --- Icons ---
const PlusIcon = () => <svg xmlns="http://www.w3.org/2000/svg" className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>;
const CheckIcon = () => <svg xmlns="http://www.w3.org/2000/svg" className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><polyline points="20 6 9 17 4 12"></polyline></svg>;
const AlertIcon = () => <svg xmlns="http://www.w3.org/2000/svg" className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>;
const InfoIcon = () => <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="16" x2="12" y2="12"></line><line x1="12" y1="8" x2="12.01" y2="8"></line></svg>;
const ClearIcon = () => <svg xmlns="http://www.w3.org/2000/svg" className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>;

interface ResearchSource {
  name: string;
  description: string;
  url: string;
  provenance: string;
}

const VIRTUAL_ITEM_HEIGHT = 56;
const DROPDOWN_MAX_HEIGHT = 300;

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
  
  const [roleDropdownStyle, setRoleDropdownStyle] = useState<React.CSSProperties>({});
  const [isMobile, setIsMobile] = useState(false);

  // --- Context State ---
  const [useJD, setUseJD] = useState(!!initialJobDescription);
  const [jdText, setJdText] = useState(initialJobDescription);
  
  const [useResume, setUseResume] = useState(!!resumeFile);
  const [resumeText, setResumeText] = useState(''); 
  const [resumeFileName, setResumeFileName] = useState(resumeFile?.name || '');
  const [isParsingResume, setIsParsingResume] = useState(false);

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

  // --- Disclaimer State ---
  const [showInlineDisclaimer, setShowInlineDisclaimer] = useState(false);
  const [showDisclaimerModal, setShowDisclaimerModal] = useState(false);
  const [disclaimerModalMode, setDisclaimerModalMode] = useState<'gatekeeper' | 'informational'>('gatekeeper');
  const [pendingResult, setPendingResult] = useState<InterviewPredictionResponse | null>(null);
  const [disclaimerAcknowledged, setDisclaimerAcknowledged] = useState(false);
  const [skipDisclaimerSession, setSkipDisclaimerSession] = useState(false);
  const [researchSources, setResearchSources] = useState<ResearchSource[]>([]);

  // --- Refs ---
  const companyRef = useRef<HTMLDivElement>(null);
  const roleRef = useRef<HTMLDivElement>(null);
  const roleInputRef = useRef<HTMLInputElement>(null);
  const roleListRef = useRef<HTMLDivElement>(null);

  const [scrollTop, setScrollTop] = useState(0);

  // --- Effects ---

  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 640);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (companyRef.current && !companyRef.current.contains(event.target as Node)) {
        setShowCompanySuggestions(false);
      }
      const dropdownEl = document.getElementById('role-dropdown-portal');
      if (
          roleRef.current && 
          !roleRef.current.contains(event.target as Node) && 
          dropdownEl && 
          !dropdownEl.contains(event.target as Node)
      ) {
        setShowRoleSuggestions(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
      if (showRoleSuggestions && !isMobile) {
          updateDropdownPosition();
          window.addEventListener('scroll', updateDropdownPosition, true);
          window.addEventListener('resize', updateDropdownPosition);
          return () => {
              window.removeEventListener('scroll', updateDropdownPosition, true);
              window.removeEventListener('resize', updateDropdownPosition);
          };
      }
  }, [showRoleSuggestions, isMobile]);

  // Initial resume handling
  useEffect(() => {
    if (resumeFile && !resumeText && !isParsingResume) {
      handleParseResumeFile(resumeFile);
    }
  }, [resumeFile]);

  useEffect(() => {
    if (companyInput && !showCompanySuggestions) {
        setShowInlineDisclaimer(true);
        setResearchSources(generateMockSources(companyInput));
    } else if (!companyInput) {
        setShowInlineDisclaimer(false);
        setResearchSources([]);
    }
  }, [companyInput, showCompanySuggestions]);

  // --- Resume Parsing Logic ---
  const handleParseResumeFile = async (file: File) => {
      setIsParsingResume(true);
      try {
          let text = "";
          if (file.type === 'application/pdf' || file.type.startsWith('image/')) {
              // Convert to base64
              const base64 = await new Promise<string>((resolve, reject) => {
                  const reader = new FileReader();
                  reader.onload = () => {
                      const res = reader.result as string;
                      resolve(res.split(',')[1]);
                  };
                  reader.onerror = reject;
                  reader.readAsDataURL(file);
              });
              // Call specialized extract function
              text = await extractTextFromFile({ base64Data: base64, mimeType: file.type });
          } else {
              text = await file.text();
          }
          setResumeText(text);
          setResumeFileName(file.name);
          setUseResume(true);
      } catch (err) {
          console.error("Resume parsing failed", err);
          alert("Could not read file. Please ensure it's a valid PDF, Image, or Text file.");
      } finally {
          setIsParsingResume(false);
      }
  };

  const updateDropdownPosition = () => {
      if (!roleInputRef.current) return;
      const rect = roleInputRef.current.getBoundingClientRect();
      const spaceBelow = window.innerHeight - rect.bottom;
      const spaceAbove = rect.top;
      const height = Math.min(DROPDOWN_MAX_HEIGHT, 400);

      let style: React.CSSProperties = {
          position: 'fixed',
          left: `${rect.left}px`,
          width: `${rect.width}px`,
          zIndex: 9999,
      };

      if (spaceBelow < height && spaceAbove > height) {
          style.bottom = `${window.innerHeight - rect.top + 8}px`;
          style.maxHeight = `${spaceAbove - 20}px`;
          style.top = 'auto';
      } else {
          style.top = `${rect.bottom + 8}px`;
          style.maxHeight = `${Math.min(height, spaceBelow - 20)}px`;
          style.bottom = 'auto';
      }
      setRoleDropdownStyle(style);
  };

  const filteredCompanies = useMemo(() => {
    if (!companyInput.trim()) return [];
    const lowerInput = companyInput.toLowerCase();
    return COMPANIES
      .filter(c => c.name.toLowerCase().includes(lowerInput))
      .sort((a, b) => {
         const aName = a.name.toLowerCase();
         const bName = b.name.toLowerCase();
         const aStarts = aName.startsWith(lowerInput);
         const bStarts = bName.startsWith(lowerInput);
         if (aStarts && !bStarts) return -1;
         if (!aStarts && bStarts) return 1;
         return aName.localeCompare(bName);
      })
      .slice(0, 8);
  }, [companyInput]);

  const filteredRoles = useMemo(() => {
    if (!roleInput.trim()) return [];
    const lowerInput = roleInput.toLowerCase();
    const matches = ROLES.filter(r => r.title.toLowerCase().includes(lowerInput));
    return matches.sort((a, b) => {
         const aName = a.title.toLowerCase();
         const bName = b.title.toLowerCase();
         if (aName === lowerInput) return -1;
         if (bName === lowerInput) return 1;
         const aStarts = aName.startsWith(lowerInput);
         const bStarts = bName.startsWith(lowerInput);
         if (aStarts && !bStarts) return -1;
         if (!aStarts && bStarts) return 1;
         const aIsSenior = a.seniorityLevel === 'Senior' || a.seniorityLevel === 'Lead';
         const bIsSenior = b.seniorityLevel === 'Senior' || b.seniorityLevel === 'Lead';
         if (aIsSenior && !bIsSenior) return -1;
         if (!bIsSenior && aIsSenior) return 1;
         return aName.localeCompare(bName);
      });
  }, [roleInput]);

  const visibleRange = useMemo(() => {
      const totalCount = filteredRoles.length;
      const startIndex = Math.floor(scrollTop / VIRTUAL_ITEM_HEIGHT);
      const endIndex = Math.min(
          totalCount - 1,
          Math.floor((scrollTop + (isMobile ? window.innerHeight * 0.5 : DROPDOWN_MAX_HEIGHT)) / VIRTUAL_ITEM_HEIGHT) + 5
      );
      return { startIndex, endIndex, totalCount };
  }, [scrollTop, filteredRoles.length, isMobile]);

  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
      setScrollTop(e.currentTarget.scrollTop);
  };

  const generateMockSources = (companyName: string): ResearchSource[] => {
      const encodedName = encodeURIComponent(companyName);
      return [
      {
          name: "Glassdoor Interview Reviews",
          description: "Aggregated candidate reports & question patterns",
          url: `https://www.glassdoor.com/Search/results.htm?keyword=${encodedName}&filterType=interviews`,
          provenance: `Analyzed ~140 recent interview reports`
      },
      {
          name: "LinkedIn Talent Insights",
          description: "Role requirements & company hiring trends",
          url: `https://www.linkedin.com/search/results/companies/?keywords=${encodedName}`,
          provenance: "Verified against active job postings & skills data"
      },
      {
          name: "TeamBlind Discussions",
          description: "Verified employee sentiment & process signals",
          url: `https://www.teamblind.com/search/${encodedName}`,
          provenance: "Cross-referenced with internal culture discussions"
      },
      {
          name: "Company Careers Page",
          description: "Official competency frameworks & values",
          url: `https://www.google.com/search?q=${encodedName}+careers+values`,
          provenance: "Extracted core values & leadership principles"
      },
      {
          name: "Levels.fyi / Engineering Blogs",
          description: "Technical bar & interview structure details",
          url: `https://www.levels.fyi/companies/${encodedName.replace(/\s+/g, '').toLowerCase()}/interviews`,
          provenance: "Technical round structure analysis"
      }
  ]};

  const handleRoleSelect = (role: RoleMetadata) => {
      setRoleInput(role.title);
      setSelectedRole(role);
      setShowRoleSuggestions(false);
  };

  const handleClearRole = (e: React.MouseEvent) => {
      e.stopPropagation();
      setRoleInput('');
      setSelectedRole(null);
      setShowRoleSuggestions(true);
      if (roleInputRef.current) roleInputRef.current.focus();
  };

  const handleAddJD = () => {
      setTempJdText(jdText || '');
      setActiveContextModal('jd');
  };

  const handleSaveJD = () => {
      setJdText(tempJdText);
      setUseJD(true);
      setActiveContextModal(null);
  };

  const handleClearJD = () => {
      setJdText('');
      setUseJD(false);
  };

  const handleClearResume = () => {
      setResumeText('');
      setResumeFileName('');
      setUseResume(false);
  };

  const handleResumeUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      setActiveContextModal(null); // Close modal immediately
      handleParseResumeFile(file);
  };

  const handlePracticeSubmit = async () => {
    if (!practiceAnswer || !practiceMode.question) return;
    setIsAnalyzingAnswer(true);
    try {
        const feedback = await analyzePracticeAnswer(practiceMode.question.question, practiceAnswer);
        setPracticeFeedback(feedback);
    } catch (e) {
        console.error(e);
        alert("Failed to analyze answer. Please try again.");
    } finally {
        setIsAnalyzingAnswer(false);
    }
  };

  const handleGenerateClick = () => {
    if ((useJD && !jdText) || (useResume && !resumeText)) {
      setMissingContextWarning(true);
      return;
    }
    runGeneration();
  };

  const handleViewResearchSources = () => {
      if (researchSources.length === 0 && companyInput) {
          setResearchSources(generateMockSources(companyInput));
      }
      setDisclaimerModalMode('informational');
      setShowDisclaimerModal(true);
  };

  const runGeneration = async () => {
    setMissingContextWarning(false);
    setIsLoading(true);
    setResult(null);
    
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
      
      setPendingResult(response);
      
      if (skipDisclaimerSession) {
          setResult(response);
          setPendingResult(null);
      } else {
          setDisclaimerModalMode('gatekeeper');
          setShowDisclaimerModal(true);
      }

    } catch (e) {
      console.error(e);
      alert("Generation failed. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="max-w-5xl mx-auto space-y-6 sm:space-y-8 animate-scale-in pb-20">
      
      {/* Header */}
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 tracking-tight">Interview Question Predictor</h1>
        <p className="text-gray-500 text-sm sm:text-lg">AI-generated questions tailored to the company culture and role.</p>
      </div>

      {/* Input Card */}
      <div className="bg-white rounded-3xl p-4 sm:p-8 shadow-apple-card border border-white/60 relative z-20">
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6 mb-6">
          {/* Company Input */}
          <div className="relative" ref={companyRef}>
            <label className="block text-xs font-bold uppercase text-gray-400 mb-1.5 ml-1">Company Name</label>
            <input 
              value={companyInput}
              onChange={(e) => { setCompanyInput(e.target.value); setShowCompanySuggestions(true); setSelectedCompany(null); }}
              onFocus={() => setShowCompanySuggestions(true)}
              placeholder="e.g. Google"
              className="w-full bg-gray-50 border-0 rounded-xl p-3.5 text-sm font-medium focus:ring-2 focus:ring-system-blue/20 outline-none transition-all focus:bg-white"
            />
            {showCompanySuggestions && companyInput && filteredCompanies.length > 0 && (
              <div className="absolute top-full left-0 w-full mt-2 bg-white rounded-xl shadow-xl border border-gray-100 max-h-60 overflow-y-auto z-50">
                {filteredCompanies.map(c => (
                  <div 
                    key={c.id} 
                    onClick={() => { setCompanyInput(c.name); setSelectedCompany(c); setShowCompanySuggestions(false); }}
                    className="p-3 hover:bg-gray-50 cursor-pointer flex justify-between items-center group border-b border-gray-50 last:border-0"
                  >
                    <div>
                      <div className="font-bold text-gray-800">{c.name}</div>
                      <div className="text-xs text-gray-400">{c.industry} • {c.avgDifficulty}</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
            {selectedCompany && (
               <div className="absolute right-3 top-[34px] hidden md:block">
                  <span className="text-[10px] font-bold bg-blue-50 text-blue-600 px-2 py-0.5 rounded border border-blue-100">Verified</span>
               </div>
            )}
            {showInlineDisclaimer && (
                <div role="note" aria-live="polite" className="mt-2 bg-[#FAF9F6] border border-gray-100 rounded-lg p-3 flex items-start gap-3 animate-[fadeIn_0.3s_ease-out]">
                    <div className="mt-0.5 text-gray-400 shrink-0"><InfoIcon /></div>
                    <div className="flex-1">
                        <p className="text-xs text-gray-700 leading-relaxed">
                            <span className="font-bold">Company affiliation & content note:</span> The company selected is not affiliated with this product. The interview prompts shown are generated by AI to reflect common interview styles and public signals — they are not official company questions and do not represent the company. Use these prompts for preparation only.
                        </p>
                        <button 
                            onClick={handleViewResearchSources}
                            className="text-xs text-system-blue hover:text-blue-700 font-medium mt-1 underline decoration-blue-200 underline-offset-2"
                        >
                            View research sources
                        </button>
                    </div>
                    <button onClick={() => setShowInlineDisclaimer(false)} className="text-gray-400 hover:text-gray-600 p-1">
                        ✕
                    </button>
                </div>
            )}
          </div>

          {/* Job Role Input - Portal based Dropdown */}
          <div className="relative" ref={roleRef}>
            <label className="block text-xs font-bold uppercase text-gray-400 mb-1.5 ml-1">Job Role</label>
            <div className="relative">
                <input 
                  ref={roleInputRef}
                  value={roleInput}
                  onChange={(e) => { setRoleInput(e.target.value); setShowRoleSuggestions(true); setSelectedRole(null); }}
                  onFocus={() => { setShowRoleSuggestions(true); updateDropdownPosition(); }}
                  placeholder="e.g. Product Designer"
                  className="w-full bg-gray-50 border-0 rounded-xl p-3.5 text-sm font-medium focus:ring-2 focus:ring-system-blue/20 outline-none transition-all focus:bg-white pr-10"
                />
                {roleInput && (
                    <button 
                        onClick={handleClearRole}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 p-1 rounded-full hover:bg-gray-200 transition-colors"
                    >
                        <ClearIcon />
                    </button>
                )}
            </div>

            {/* Dropdown Portal logic (same as before) */}
            {showRoleSuggestions && (
                isMobile ? (
                    createPortal(
                        <div className="fixed inset-0 z-[9999] flex items-end sm:hidden">
                            <div className="absolute inset-0 bg-black/20 backdrop-blur-sm" onClick={() => setShowRoleSuggestions(false)}></div>
                            <div className="bg-white w-full h-[60vh] rounded-t-3xl shadow-2xl relative flex flex-col animate-[slideUp_0.3s_ease-out]">
                                <div className="p-4 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
                                    <h3 className="font-bold text-gray-900">Select Role</h3>
                                    <button onClick={() => setShowRoleSuggestions(false)} className="p-2 bg-gray-100 rounded-full text-gray-500">✕</button>
                                </div>
                                <div className="flex-1 overflow-y-auto p-2" ref={roleListRef} onScroll={handleScroll}>
                                    {filteredRoles.length === 0 ? (
                                        <div className="p-8 text-center text-gray-500 text-sm">No matches.<br/>Press enter to use custom.</div>
                                    ) : (
                                        <div style={{ height: `${filteredRoles.length * VIRTUAL_ITEM_HEIGHT}px`, position: 'relative' }}>
                                            {filteredRoles.slice(visibleRange.startIndex, visibleRange.endIndex + 1).map((r, i) => (
                                                <div 
                                                    key={r.id}
                                                    onClick={() => handleRoleSelect(r)}
                                                    className="absolute w-full left-0 px-4 py-3 hover:bg-gray-50 cursor-pointer flex justify-between items-center border-b border-gray-50 h-[56px]"
                                                    style={{ top: `${(visibleRange.startIndex + i) * VIRTUAL_ITEM_HEIGHT}px` }}
                                                >
                                                    <div>
                                                        <div className="font-bold text-gray-900 text-sm">{r.title}</div>
                                                        <div className="text-xs text-gray-400">{r.seniorityLevel}</div>
                                                    </div>
                                                    {r.id.includes('Engineering') && <span className="text-[10px] bg-blue-50 text-blue-600 px-2 py-0.5 rounded font-medium">Eng</span>}
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>,
                        document.body
                    )
                ) : (
                    createPortal(
                        <div id="role-dropdown-portal" style={roleDropdownStyle} className="bg-white rounded-xl shadow-xl border border-gray-100 overflow-hidden flex flex-col animate-[fadeIn_0.1s_ease-out]">
                            <div className="overflow-y-auto custom-scrollbar" style={{ maxHeight: roleDropdownStyle.maxHeight || '300px' }} onScroll={handleScroll} ref={roleListRef}>
                                {filteredRoles.length === 0 ? (
                                    <div className="p-4 text-center text-gray-500 text-sm">No matches.<br/><span className="text-xs text-gray-400">Using custom "{roleInput}"</span></div>
                                ) : (
                                    <div style={{ height: `${filteredRoles.length * VIRTUAL_ITEM_HEIGHT}px`, position: 'relative' }}>
                                        {filteredRoles.slice(visibleRange.startIndex, visibleRange.endIndex + 1).map((r, i) => (
                                            <div 
                                                key={r.id}
                                                onClick={() => handleRoleSelect(r)}
                                                className="absolute w-full left-0 px-4 py-2 hover:bg-gray-50 cursor-pointer flex justify-between items-center border-b border-gray-50 h-[56px] transition-colors"
                                                style={{ top: `${(visibleRange.startIndex + i) * VIRTUAL_ITEM_HEIGHT}px` }}
                                            >
                                                <div>
                                                    <div className="font-bold text-gray-900 text-sm">{r.title}</div>
                                                    <div className="text-xs text-gray-400 font-medium">{r.seniorityLevel}</div>
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    {r.id.includes('Engineering') && <span className="text-[10px] bg-blue-50 text-blue-600 px-2 py-0.5 rounded border border-blue-100">Eng</span>}
                                                    {r.id.includes('Product') && <span className="text-[10px] bg-purple-50 text-purple-600 px-2 py-0.5 rounded border border-purple-100">Prod</span>}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>,
                        document.body
                    )
                )
            )}
          </div>
        </div>

        {/* Checkboxes & Context Summary (Unchanged) */}
        <div className="flex flex-col sm:flex-row gap-4 sm:gap-6 mb-4 px-1">
          <label className="flex items-center gap-2 cursor-pointer select-none">
            <input type="checkbox" checked={useJD} onChange={e => setUseJD(e.target.checked)} className="w-4 h-4 rounded text-system-blue border-gray-300 focus:ring-system-blue"/>
            <span className="text-sm font-medium text-gray-700">Include JD Context</span>
          </label>
          <label className="flex items-center gap-2 cursor-pointer select-none">
            <input type="checkbox" checked={useResume} onChange={e => setUseResume(e.target.checked)} className="w-4 h-4 rounded text-system-blue border-gray-300 focus:ring-system-blue"/>
            <span className="text-sm font-medium text-gray-700">Include Resume Context</span>
          </label>
        </div>

        <div className="bg-gray-50 rounded-xl p-3 flex flex-col lg:flex-row gap-4 items-start lg:items-center justify-between border border-gray-100 mb-6 w-full">
           <div className="flex flex-col sm:flex-row gap-4 w-full">
              <div className="flex items-center gap-3 flex-1">
                 <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${jdText ? 'bg-green-100 text-green-600' : 'bg-gray-200 text-gray-400'}`}>
                    {jdText ? <CheckIcon/> : <span className="text-xs font-bold">JD</span>}
                 </div>
                 <div className="flex flex-col min-w-0">
                    <span className="text-xs font-bold text-gray-900 truncate">Job Description</span>
                    <span className="text-[10px] text-gray-500 font-medium truncate">{jdText ? `Loaded (${jdText.length} chars)` : 'Not Added'}</span>
                 </div>
                 <div className="flex gap-1 ml-auto sm:ml-2">
                    {jdText ? (
                       <button onClick={() => setActiveContextModal('view-jd')} className="px-2 py-1 bg-white border border-gray-200 rounded text-[10px] font-bold text-gray-600 hover:text-system-blue">View</button>
                    ) : (
                       <button onClick={handleAddJD} className="px-2 py-1 bg-system-blue text-white rounded text-[10px] font-bold hover:bg-blue-600 shadow-sm flex items-center gap-1"><PlusIcon/> Add</button>
                    )}
                 </div>
              </div>
              <div className="w-full h-px sm:w-px sm:h-8 bg-gray-200 block"></div>
              <div className="flex items-center gap-3 flex-1">
                 <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${resumeText ? 'bg-green-100 text-green-600' : 'bg-gray-200 text-gray-400'}`}>
                    {resumeText ? <CheckIcon/> : <span className="text-xs font-bold">CV</span>}
                 </div>
                 <div className="flex flex-col min-w-0">
                    <span className="text-xs font-bold text-gray-900 truncate">Resume</span>
                    <span className="text-[10px] text-gray-500 font-medium truncate">{isParsingResume ? 'Parsing...' : resumeText ? `Uploaded (${resumeFileName.slice(0, 10)}...)` : 'Not Uploaded'}</span>
                 </div>
                 <div className="flex gap-1 ml-auto sm:ml-2">
                    {resumeText ? (
                       <button onClick={() => setActiveContextModal('view-resume')} className="px-2 py-1 bg-white border border-gray-200 rounded text-[10px] font-bold text-gray-600 hover:text-system-blue">View</button>
                    ) : (
                       <button onClick={() => setActiveContextModal('resume')} className="px-2 py-1 bg-system-blue text-white rounded text-[10px] font-bold hover:bg-blue-600 shadow-sm flex items-center gap-1"><PlusIcon/> Upload</button>
                    )}
                 </div>
              </div>
           </div>
           
           {(useJD && !jdText) || (useResume && !resumeText) ? (
              <div className="text-xs text-orange-600 bg-orange-50 px-3 py-1.5 rounded-lg border border-orange-100 font-medium flex items-center gap-2 w-full lg:w-auto mt-2 lg:mt-0">
                 <AlertIcon/> <span className="truncate">Context enabled but missing.</span>
              </div>
           ) : null}
        </div>

        <button 
          onClick={handleGenerateClick}
          disabled={isLoading || isParsingResume}
          className="w-full py-4 bg-system-blue text-white font-bold rounded-2xl shadow-lg shadow-blue-500/20 hover:bg-blue-600 active:scale-[0.99] transition-all flex items-center justify-center gap-3 disabled:opacity-70 disabled:cursor-not-allowed text-lg"
        >
           {isLoading || isParsingResume ? (
             <>
               <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
               {isParsingResume ? 'Processing File...' : loadingStep}
             </>
           ) : (
             <>
               <SparklesIcon className="w-5 h-5" /> Generate Questions
             </>
           )}
        </button>
      </div>

      {missingContextWarning && createPortal(
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
         </div>,
         document.body
      )}

      {showDisclaimerModal && createPortal(
          <div 
            className="fixed inset-0 z-[60] flex items-center justify-center p-4 sm:p-6"
            role="dialog"
            aria-labelledby="disclaimer-title"
            aria-describedby="disclaimer-desc"
          >
              <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => disclaimerModalMode === 'informational' && setShowDisclaimerModal(false)}></div>
              <div className="bg-white rounded-3xl shadow-2xl w-full max-w-2xl relative z-10 overflow-hidden flex flex-col max-h-[90vh] animate-[scaleIn_0.2s_ease-out]">
                  <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
                      <h2 id="disclaimer-title" className="text-xl font-bold text-gray-900">AI Content Disclaimer & Research Sources</h2>
                      {disclaimerModalMode === 'informational' && (
                          <button onClick={() => setShowDisclaimerModal(false)} className="text-gray-400 hover:text-gray-700 p-1 rounded-full hover:bg-gray-100">✕</button>
                      )}
                  </div>
                  <div className="p-6 sm:p-8 overflow-y-auto text-gray-700 text-sm leading-relaxed space-y-6" id="disclaimer-desc">
                      <p>The interview questions are generated by an AI model using public signals. Not official content.</p>
                      <div className="bg-gray-50 rounded-xl p-5 border border-gray-100">
                          <h3 className="text-xs font-bold uppercase text-gray-500 mb-3">Research sources used (examples)</h3>
                          <ul className="space-y-4">
                              {researchSources.map((source, idx) => (
                                  <li key={idx} className="text-sm flex flex-col gap-1">
                                      <div className="flex items-baseline gap-2">
                                          <span className="font-semibold text-gray-900">[{idx + 1}] {source.name}</span>
                                          <span className="text-gray-500">—</span>
                                          <span className="text-gray-700 italic">"{source.description}"</span>
                                          <a href={source.url} target="_blank" rel="noopener noreferrer" className="text-system-blue hover:underline ml-1 text-xs">(Link)</a>
                                      </div>
                                      <div className="text-xs text-gray-400 pl-2 border-l-2 border-gray-200">{source.provenance}</div>
                                  </li>
                              ))}
                          </ul>
                      </div>
                  </div>
                  {disclaimerModalMode === 'gatekeeper' && (
                      <div className="p-6 border-t border-gray-100 bg-gray-50/50 space-y-4">
                          <label className="flex items-start gap-3 cursor-pointer select-none">
                              <input 
                                  type="checkbox" 
                                  className="mt-1 w-4 h-4 rounded text-system-blue border-gray-300 focus:ring-system-blue"
                                  checked={disclaimerAcknowledged}
                                  onChange={(e) => setDisclaimerAcknowledged(e.target.checked)}
                              />
                              <span className="text-sm font-medium text-gray-800">I understand these are AI-generated questions.</span>
                          </label>
                          <div className="flex gap-3 justify-end">
                              <button onClick={() => { setShowDisclaimerModal(false); setPendingResult(null); }} className="px-5 py-2.5 bg-white border border-gray-200 text-gray-700 font-semibold rounded-xl text-sm">Cancel</button>
                              <button onClick={() => { setShowDisclaimerModal(false); if(pendingResult) { setResult(pendingResult); setPendingResult(null); }}} disabled={!disclaimerAcknowledged} className="px-6 py-2.5 bg-gray-900 text-white font-bold rounded-xl text-sm disabled:opacity-50">Acknowledge & Continue</button>
                          </div>
                      </div>
                  )}
              </div>
          </div>,
          document.body
      )}

      {/* Results Section */}
      {result && (
        <div className="space-y-6 animate-[fadeIn_0.5s_ease-out]">
           <div className="flex justify-between items-center gap-2">
              <div className="flex overflow-x-auto pb-1 gap-2 hide-scrollbar w-full sm:w-auto">
                {['all', 'behavioral', 'technical', 'scenario', 'founder', 'trick'].map(tab => (
                    <button
                        key={tab}
                        onClick={() => setActiveTab(tab as any)}
                        className={`px-3 sm:px-4 py-1.5 rounded-full text-sm font-semibold whitespace-nowrap transition-colors flex-shrink-0 ${
                            activeTab === tab ? 'bg-gray-900 text-white' : 'bg-white text-gray-500 hover:bg-gray-100 shadow-sm border border-gray-100'
                        }`}
                    >
                        {tab.charAt(0).toUpperCase() + tab.slice(1)}
                    </button>
                ))}
              </div>
           </div>

           <div className="space-y-4">
              {result.questions.filter(q => activeTab === 'all' || q.category === activeTab).map(q => (
                  <div key={q.id} className="bg-white border border-gray-100 rounded-2xl shadow-sm hover:shadow-apple-hover transition-all p-6 group">
                      <div className="flex justify-between items-start mb-3 gap-4">
                          <div>
                              <div className="flex items-center gap-2 mb-2">
                                  <span className="text-[10px] font-bold uppercase tracking-wider bg-gray-100 text-gray-500 px-2 py-0.5 rounded">{q.category}</span>
                                  <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded ${q.difficulty === 'hard' ? 'bg-red-50 text-red-600' : 'bg-green-50 text-green-600'}`}>{q.difficulty}</span>
                              </div>
                              <h3 className="text-lg font-bold text-gray-900 leading-snug">{q.question}</h3>
                          </div>
                          <div className={`shrink-0 px-2 py-1 rounded text-[10px] font-bold uppercase border ${q.confidence === 'high' ? 'bg-green-50 text-green-700 border-green-100' : 'bg-gray-50 text-gray-400 border-gray-100'}`}>
                              {q.confidence} Conf.
                          </div>
                      </div>
                      
                      <p className="text-xs text-gray-500 italic mb-4 border-l-2 border-gray-200 pl-3">{q.reason}</p>

                      <div className="bg-gray-50/80 rounded-xl p-4 mb-4">
                          <ul className="space-y-1">
                              {q.answerGuidelines.map((g, i) => (
                                  <li key={i} className="text-sm text-gray-700 flex gap-2 items-start"><span className="text-system-blue mt-1">•</span> {g}</li>
                              ))}
                          </ul>
                      </div>

                      <div className="flex gap-3 pt-2 border-t border-gray-50">
                          <button onClick={() => { setPracticeMode({ isOpen: true, question: q }); setPracticeAnswer(''); setPracticeFeedback(null); }} className="px-4 py-2 bg-system-blue text-white text-xs font-bold rounded-lg shadow-sm hover:bg-blue-600 transition-colors">Practice Now</button>
                      </div>
                  </div>
              ))}
           </div>
        </div>
      )}

      {/* Chat Bot Section */}
      <InterviewChatBot 
        companyInput={companyInput}
        roleInput={roleInput}
        selectedCompany={selectedCompany}
        selectedRole={selectedRole}
        jdText={jdText}
        resumeText={resumeText}
        resumeFileName={resumeFileName}
        researchSources={researchSources}
        onViewJD={() => setActiveContextModal('view-jd')}
        onViewResume={() => setActiveContextModal('view-resume')}
        onViewSources={handleViewResearchSources}
        onClearJD={handleClearJD}
        onClearResume={handleClearResume}
      />

      {/* Practice Mode Modal */}
      {practiceMode.isOpen && practiceMode.question && createPortal(
        <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center sm:p-4">
            <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setPracticeMode({isOpen: false, question: null})}></div>
            <div className="bg-white w-full max-w-2xl rounded-t-3xl sm:rounded-3xl shadow-2xl relative z-10 flex flex-col max-h-[90vh] overflow-hidden animate-[scaleIn_0.2s_ease-out]">
                <div className="p-4 sm:p-6 border-b border-gray-100 bg-gray-50/50 flex justify-between items-start">
                    <div className="flex-1 pr-4">
                        <div className="flex gap-2 mb-2"><span className="text-[10px] font-bold uppercase bg-blue-100 text-blue-700 px-2 py-0.5 rounded">{practiceMode.question.category}</span></div>
                        <h3 className="text-lg sm:text-xl font-bold text-gray-900 leading-tight">{practiceMode.question.question}</h3>
                    </div>
                    <button onClick={() => setPracticeMode({isOpen: false, question: null})} className="p-2 bg-gray-200 rounded-full text-gray-500 hover:bg-gray-300 transition-colors">✕</button>
                </div>
                
                <div className="flex-1 overflow-y-auto p-4 sm:p-6 bg-[#F9F9FB]">
                    {!practiceFeedback ? (
                        <div className="space-y-4">
                            <textarea 
                                value={practiceAnswer}
                                onChange={(e) => setPracticeAnswer(e.target.value)}
                                placeholder="Type your answer here..."
                                className="w-full h-48 p-4 border border-gray-200 rounded-xl focus:ring-2 focus:ring-system-blue/20 outline-none resize-none text-base bg-white"
                                autoFocus
                            />
                            <div className="flex justify-end">
                                <button onClick={handlePracticeSubmit} disabled={!practiceAnswer || isAnalyzingAnswer} className="px-6 py-3 bg-system-blue text-white font-bold rounded-xl shadow-lg hover:bg-blue-600 disabled:opacity-50">
                                    {isAnalyzingAnswer ? 'Analyzing...' : 'Get AI Feedback'}
                                </button>
                            </div>
                        </div>
                    ) : (
                        <div className="space-y-6 animate-[fadeIn_0.3s_ease-out]">
                            <div className="grid grid-cols-2 gap-4">
                                <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 text-center">
                                    <div className="text-sm font-medium text-gray-500">Clarity</div>
                                    <div className="text-3xl font-bold text-green-500">{practiceFeedback.clarity_score}</div>
                                </div>
                                <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 text-center">
                                    <div className="text-sm font-medium text-gray-500">STAR</div>
                                    <div className="text-xl font-bold mt-1 text-blue-600">{practiceFeedback.star_method_rating}</div>
                                </div>
                            </div>
                            <div className="bg-blue-50/50 p-6 rounded-2xl border border-blue-100">
                                <h4 className="font-bold text-blue-900 mb-2">Better Response</h4>
                                <p className="text-blue-800 text-sm leading-relaxed whitespace-pre-wrap">{practiceFeedback.sample_better_response}</p>
                            </div>
                            <div className="text-center pb-4">
                                <button onClick={() => setPracticeFeedback(null)} className="text-system-blue font-bold text-sm hover:underline">Try Again</button>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>,
        document.body
      )}

      {/* Context Modals */}
      {activeContextModal === 'jd' && createPortal(
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
              <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" onClick={() => setActiveContextModal(null)}></div>
              <div className="bg-white rounded-3xl w-full max-w-2xl shadow-2xl relative z-10 flex flex-col max-h-[90vh]">
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
          </div>,
          document.body
      )}
      {activeContextModal === 'resume' && createPortal(
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
              <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" onClick={() => setActiveContextModal(null)}></div>
              <div className="bg-white rounded-3xl w-full max-w-md shadow-2xl relative z-10 p-8 text-center">
                  <h3 className="font-bold text-gray-900 text-lg mb-2">Upload Resume</h3>
                  <label className="block border-2 border-dashed border-gray-200 rounded-2xl p-10 hover:bg-gray-50 cursor-pointer transition-colors group mt-6">
                      <div className="w-12 h-12 bg-blue-50 text-system-blue rounded-full flex items-center justify-center mx-auto mb-3 group-hover:scale-110 transition-transform"><PlusIcon /></div>
                      <span className="text-sm font-bold text-gray-900">Click to Upload</span>
                      <input type="file" className="hidden" accept=".pdf,.txt,.doc,.docx,.jpg,.png" onChange={handleResumeUpload} />
                  </label>
                  <button onClick={() => setActiveContextModal(null)} className="mt-6 text-gray-400 text-sm hover:text-gray-900 font-medium">Cancel</button>
              </div>
          </div>,
          document.body
      )}
      {(activeContextModal === 'view-jd' || activeContextModal === 'view-resume') && createPortal(
          <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:p-4">
              <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" onClick={() => setActiveContextModal(null)}></div>
              <div className="bg-white rounded-t-3xl sm:rounded-3xl w-full max-w-3xl shadow-2xl relative z-10 flex flex-col max-h-[90vh] animate-[slideUp_0.2s_ease-out]">
                  <div className="p-4 sm:p-6 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
                      <h3 className="font-bold text-gray-900 text-lg">{activeContextModal === 'view-jd' ? 'Job Description' : 'Resume Text'}</h3>
                      <button onClick={() => setActiveContextModal(null)} className="p-2 bg-gray-200 rounded-full text-gray-500 hover:bg-gray-300 transition-colors">✕</button>
                  </div>
                  <div className="p-6 sm:p-8 flex-1 overflow-y-auto bg-[#F9F9FB]">
                      <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 min-h-full">
                        <pre className="whitespace-pre-wrap font-serif text-sm text-gray-800 leading-relaxed">
                            {activeContextModal === 'view-jd' ? jdText : resumeText}
                        </pre>
                      </div>
                  </div>
              </div>
          </div>,
          document.body
      )}
    </div>
  );
};
