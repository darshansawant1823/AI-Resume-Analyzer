
import React, { useState, useRef, useEffect } from 'react';
import { User } from 'firebase/auth';
import { useRecruiterData } from '../src/hooks/useRecruiterData';
import type { Candidate, CandidateAnalysis, JDAnalysis, InterviewScript, CrossDomainAnalysis, TransferDomain } from '../types';
// Add extractTextFromFile to the imported services
import { ChevronRight, AlertTriangle, RefreshCw } from 'lucide-react';
import { motion } from 'framer-motion';
import { analyzeCandidate, analyzeJobDescription, simplifyResume, generateInterviewScript, performCrossDomainAnalysis, extractTextFromFile } from '../services/geminiService';
import { UploadIcon } from './icons/UploadIcon';
import { SparklesIcon } from './icons/SparklesIcon';
import { ClipboardIcon } from './icons/ClipboardIcon';
import { MaximizeIcon } from './icons/MaximizeIcon';
import { CompareProfiles } from './CompareProfiles';
import { RecruiterChatView } from './RecruiterChatView';

import { RecruiterScan } from './RecruiterScan';

// UI Constants for Donut Chart
const DONUT_COLORS = [
  '#007AFF', // Blue
  '#34C759', // Green
  '#5856D6', // Indigo
  '#FF9500', // Orange
  '#FF2D55', // Pink
  '#AF52DE', // Purple
];

const CONFIDENCE_COLORS = {
  high: { bg: 'bg-[#E8F8F0]', text: 'text-[#2DBE7E]', border: 'border-[#2DBE7E]' },
  medium: { bg: 'bg-[#FFF6E5]', text: 'text-[#F5A623]', border: 'border-[#2DBE7E]' },
  low: { bg: 'bg-gray-100', text: 'text-gray-400', border: 'border-gray-200' }
};

interface RecruiterDashboardProps {
  user: User | null;
}

export const RecruiterDashboard: React.FC<RecruiterDashboardProps> = ({ user }) => {
  const { candidates: persistedCandidates, saveCandidate, deleteCandidate, saveJDAnalysis, archiveAllCandidates } = useRecruiterData(user);
  const [activeTab, setActiveTab] = useState<'dashboard' | 'jd-intel'>('dashboard');
  const [viewMode, setViewMode] = useState<'list' | 'compare' | 'chat' | 'candidate-details'>('list'); 
  const [jobDescription, setJobDescription] = useState('');
  const [candidates, setCandidates] = useState<Candidate[]>([]);

  useEffect(() => {
    const sessionKey = `recruiter_session_archived_${user?.uid}`;
    if (user && !sessionStorage.getItem(sessionKey)) {
      archiveAllCandidates().then(() => {
        sessionStorage.setItem(sessionKey, 'true');
      });
    }
  }, [user?.uid]);

  useEffect(() => {
    setCandidates(prev => {
      // Map persisted candidates, preserving File objects from current state if they exist
      return persistedCandidates.map(pc => {
        const existing = prev.find(c => c.id === pc.id);
        return { ...pc, file: existing?.file || pc.file };
      });
    });
  }, [persistedCandidates]);
  const [selectedCandidateId, setSelectedCandidateId] = useState<string | null>(null);
  
  const [jdAnalysis, setJdAnalysis] = useState<JDAnalysis | null>(null);
  const [isAnalyzingJd, setIsAnalyzingJd] = useState(false);
  const [jdCopied, setJdCopied] = useState(false);
  const [isJDMaximized, setIsJDMaximized] = useState(false);

  const [cleanResume, setCleanResume] = useState<string | null>(null);
  const [interviewScript, setInterviewScript] = useState<InterviewScript | null>(null);
  const [modalTab, setModalTab] = useState<'profile' | 'scan' | 'interview'>('profile');
  const [isLoadingModal, setIsLoadingModal] = useState(false);
  const [modalError, setModalError] = useState<string | null>(null);
  const [showContactPopup, setShowContactPopup] = useState(false);
  const [contactCandidate, setContactCandidate] = useState<Candidate | null>(null);

  // Cross Domain State
  const [isCrossDomainLoading, setIsCrossDomainLoading] = useState(false);
  const [selectedDomain, setSelectedDomain] = useState<TransferDomain | null>(null);

  // Bulk Selection States
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [showEmailModal, setShowEmailModal] = useState(false);
  const [emailCopied, setEmailCopied] = useState(false);
  const [allEmailsCopied, setAllEmailsCopied] = useState(false);
  
  // Toast for Compare Limit
  const [showCompareToast, setShowCompareToast] = useState(false);

  // Delete Confirmation State
  const [candidateToDelete, setCandidateToDelete] = useState<Candidate | null>(null);

  // Track auto-selected candidates to prevent re-selecting after user deselects
  const autoSelectedRef = useRef<Set<string>>(new Set());

  const fileInputRef = useRef<HTMLInputElement>(null);

  const fileToBase64 = (file: File): Promise<{base64Data: string; mimeType: string}> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => {
        const result = reader.result as string;
        const base64Data = result.split(',')[1];
        resolve({ base64Data, mimeType: file.type });
      };
      reader.onerror = (error) => reject(error);
    });
  };

  const processCandidate = async (candidate: Candidate, jd: string) => {
      // Update status to processing
      setCandidates(prev => prev.map(c => c.id === candidate.id ? { ...c, status: 'processing' } : c));
      
      try {
           let payload;
           let extractedText = "";
           if (candidate.file.type.startsWith('image/') || candidate.file.type === 'application/pdf') {
             const { base64Data, mimeType } = await fileToBase64(candidate.file);
             payload = { base64Data, mimeType };
             extractedText = await extractTextFromFile(payload);
           } else {
             extractedText = await candidate.file.text();
             payload = { text: extractedText };
           }

           const analysis = await analyzeCandidate(jd, payload);
           // Store the extracted text in candidate for chat context
           const updatedCandidate: Candidate = { 
             ...candidate, 
             status: 'analyzed' as const, 
             analysis, 
             extractedText
           };
           setCandidates(prev => prev.map(c => c.id === candidate.id ? updatedCandidate : c));
           await saveCandidate(updatedCandidate);
      } catch (err) {
           console.error(`Analysis failed for candidate ${candidate.id}:`, err);
           const errorCandidate = { ...candidate, status: 'error' as const };
           setCandidates(prev => prev.map(c => c.id === candidate.id ? errorCandidate : c));
           await saveCandidate(errorCandidate);
      }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!jobDescription) { alert("Please enter a Job Description first."); return; }
    if (e.target.files) {
      const newFiles: File[] = Array.from(e.target.files);
      const newCandidates: Candidate[] = newFiles.map(file => ({
        id: Math.random().toString(36).substr(2, 9),
        name: file.name,
        file,
        status: 'pending'
      }));
      setCandidates(prev => [...prev, ...newCandidates]);
      
      // Save pending candidates to Firestore immediately
      if (user) {
        for (const candidate of newCandidates) {
          await saveCandidate(candidate);
        }
      }
      
      // Process sequentially to avoid rate limits
      for (const candidate of newCandidates) {
        await processCandidate(candidate, jobDescription);
        // Add a 2-second delay between requests to be safe with rate limits
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    }
  };

  const handleReanalyze = async (candidate: Candidate) => {
      if (!jobDescription) return;
      await processCandidate(candidate, jobDescription);
  };

  const sortedCandidates = [...candidates].sort((a, b) => (b.analysis?.match_score || 0) - (a.analysis?.match_score || 0));

  // Automatically select Top Picks (Rank #1-3) when they are analyzed
  useEffect(() => {
    const newSelection = new Set(selectedIds);
    let changed = false;

    sortedCandidates.forEach((c, idx) => {
      // If it's a top pick (top 3) and successfully analyzed
      if (idx < 3 && c.status === 'analyzed') {
        // If we haven't auto-selected this specific candidate yet
        if (!autoSelectedRef.current.has(c.id)) {
            newSelection.add(c.id);
            autoSelectedRef.current.add(c.id);
            changed = true;
        }
      }
    });

    if (changed) {
        setSelectedIds(newSelection);
    }
  }, [candidates.map(c => c.status).join(','), sortedCandidates]);

  const handleAnalyzeJD = async () => {
      if(!jobDescription) return;
      setIsAnalyzingJd(true);
      setJdAnalysis(null);
      try {
          const result = await analyzeJobDescription(jobDescription);
          setJdAnalysis(result);
          if (user) {
              await saveJDAnalysis(jobDescription, result);
          }
      } catch (e) { alert("Failed to analyze JD"); } finally { setIsAnalyzingJd(false); }
  }

  const handleCopyJD = () => {
      if (!jdAnalysis?.rewritten_jd) return;
      navigator.clipboard.writeText(jdAnalysis.rewritten_jd);
      setJdCopied(true);
      setTimeout(() => setJdCopied(false), 2000);
  };

  const handleOpenCandidate = async (candidate: Candidate) => {
      if (candidate.status !== 'analyzed') return;
      setSelectedCandidateId(candidate.id);
      setCleanResume(null); 
      setInterviewScript(null); 
      setModalTab('profile');
      setModalError(null);
      setSelectedDomain(null);
      setShowContactPopup(false);
      setViewMode('candidate-details');
  }

  const handleLoadCleanResume = async () => {
      const candidate = candidates.find(c => c.id === selectedCandidateId);
      if (!candidate || cleanResume) return;
      setIsLoadingModal(true);
      setModalError(null);
      try {
         let payload;
         if (candidate.file.type.startsWith('image/') || candidate.file.type === 'application/pdf') {
            const { base64Data, mimeType } = await fileToBase64(candidate.file);
            payload = { base64Data, mimeType };
         } else { const text = await candidate.file.text(); payload = { text }; }
         const result = await simplifyResume(payload);
         setCleanResume(result);
         
         // Save to Firestore
         const updatedCandidate = { ...candidate, cleanResume: result };
         setCandidates(prev => prev.map(c => c.id === candidate.id ? updatedCandidate : c));
         await saveCandidate(updatedCandidate);
      } catch (e) {
          setModalError("Failed to simplify resume.");
      } finally { setIsLoadingModal(false); }
  }

  const handleLoadInterview = async () => {
      const candidate = candidates.find(c => c.id === selectedCandidateId);
      if (!candidate || !candidate.analysis) return;
      
      if (interviewScript && !modalError) return;

      setIsLoadingModal(true);
      setModalError(null);
      try {
          const result = await generateInterviewScript(jobDescription, candidate.analysis.summary, candidate.analysis.red_flags);
          setInterviewScript(result);
          
          // Save to Firestore
          const updatedCandidate = { ...candidate, interviewScript: result };
          setCandidates(prev => prev.map(c => c.id === candidate.id ? updatedCandidate : c));
          await saveCandidate(updatedCandidate);
      } catch(e) {
          console.error("Interview Generation Error:", e);
          setModalError("Failed to generate interview script. Please try again.");
      } finally { setIsLoadingModal(false); }
  }

  const handleCrossDomainAnalysis = async () => {
    const candidate = candidates.find(c => c.id === selectedCandidateId);
    if (!candidate || candidate.crossDomainAnalysis) return;

    setIsCrossDomainLoading(true);
    try {
        let payload;
        if (candidate.file.type.startsWith('image/') || candidate.file.type === 'application/pdf') {
            const { base64Data, mimeType } = await fileToBase64(candidate.file);
            payload = { base64Data, mimeType };
        } else {
            const text = await candidate.file.text();
            payload = { text };
        }
        const result = await performCrossDomainAnalysis(candidate.id, payload);
        const updatedCandidate = { ...candidate, crossDomainAnalysis: result };
        setCandidates(prev => prev.map(c => c.id === candidate.id ? updatedCandidate : c));
        await saveCandidate(updatedCandidate);
    } catch (e) {
        console.error("Cross Domain Analysis Failed", e);
    } finally {
        setIsCrossDomainLoading(false);
    }
  }

  // --- Bulk Selection Handlers ---

  const toggleSelection = (id: string) => {
    const newSet = new Set(selectedIds);
    if (newSet.has(id)) {
        newSet.delete(id);
    } else {
        // Toast limit warning if selecting more than 3
        if (newSet.size >= 3) {
            setShowCompareToast(true);
            setTimeout(() => setShowCompareToast(false), 3000);
        }
        newSet.add(id);
    }
    setSelectedIds(newSet);
  };

  const toggleSelectAll = () => {
      if (selectedIds.size === sortedCandidates.length) {
          setSelectedIds(new Set());
      } else {
          setSelectedIds(new Set(sortedCandidates.map(c => c.id)));
          if (sortedCandidates.length > 3) {
              setShowCompareToast(true);
              setTimeout(() => setShowCompareToast(false), 3000);
          }
      }
  };

  const handleDeselectAll = () => {
      setSelectedIds(new Set());
  };

  const handleBulkEmail = () => {
      setShowEmailModal(true);
  };

  const handleCompare = () => {
      setViewMode('compare');
  };

  const handleChat = () => {
      setViewMode('chat');
  };

  const getEmailDraft = () => {
    const selectedEmails = sortedCandidates
        .filter(c => selectedIds.has(c.id))
        .map(c => c.name.toLowerCase().replace(/\s/g, '.') + '@example.com');

    const subject = `Update on your application for ${jobDescription.split(' ').slice(0, 4).join(' ')}...`;
    const body = `Hi [Candidate Name],

I hope you're having a great week.

I'm reaching out from [Company Name] regarding your application. We've reviewed your profile and were impressed by your experience and strong alignment with our requirements.

Your background stands out, and we'd love to discuss how your skills could translate to success in this role.

Are you available for a brief 15-minute chat later this week to discuss next steps?

Best regards,

[Recruiter Name]
Hiring Team`;

    const gmailLink = `https://mail.google.com/mail/?view=cm&fs=1&bcc=${selectedEmails.join(',')}&su=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;

    return { subject, body, selectedEmails, gmailLink };
  };

  const selectedCandidate = candidates.find(c => c.id === selectedCandidateId);
  const { subject, body, selectedEmails, gmailLink } = getEmailDraft();

  // Removed redundant local extractTextFromFile definition which was causing 'ai' not found error.

  // --- Cross Domain Visualization Helper ---
  const renderCrossDomainCard = () => {
    if (!selectedCandidate) return null;
    if (isCrossDomainLoading) {
      return (
        <div className="bg-white rounded-3xl p-8 shadow-sm border border-gray-100 flex flex-col items-center justify-center min-h-[300px]">
           <div className="w-10 h-10 border-4 border-system-blue border-t-transparent rounded-full animate-spin mb-4"></div>
           <p className="font-semibold text-gray-900">Analyzing Cross-Domain Fit...</p>
           <p className="text-sm text-gray-400 mt-2">Comparing experience against 14+ industries</p>
        </div>
      );
    }

    const data = selectedCandidate.crossDomainAnalysis;
    if (!data) {
        return (
            <div className="bg-white rounded-3xl p-8 shadow-sm border border-gray-100 flex flex-col items-center justify-center min-h-[200px] text-center">
                 <div className="w-12 h-12 bg-blue-50 rounded-full flex items-center justify-center mb-4 text-system-blue">
                     <svg xmlns="http://www.w3.org/2000/svg" className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" /></svg>
                 </div>
                 <h3 className="text-lg font-bold text-gray-900 mb-2">Cross-Domain Transferability</h3>
                 <p className="text-gray-500 max-w-md mb-6">Analyze how this candidate's skills map to 14 different industries like Fintech, SaaS, and Enterprise.</p>
                 <button 
                    onClick={handleCrossDomainAnalysis}
                    className="px-6 py-2 bg-gray-900 text-white font-bold rounded-full hover:bg-black transition-colors shadow-lg"
                 >
                    Run Analysis
                 </button>
            </div>
        );
    }

    const topDomains = data.domains
        .sort((a, b) => b.transferabilityScore - a.transferabilityScore)
        .slice(0, 6);

    const averageScore = Math.round(topDomains.reduce((acc, curr) => acc + curr.transferabilityScore, 0) / topDomains.length);

    const radius = 60;
    const circumference = 2 * Math.PI * radius;

    return (
        <div className="bg-white rounded-3xl p-4 sm:p-6 shadow-sm border border-gray-100 relative overflow-hidden">
            <div className="absolute top-0 right-0 w-full h-2 bg-gradient-to-r from-blue-400 to-purple-500 opacity-20"></div>

            <div className="mb-6">
                <h3 className="text-lg font-bold text-gray-900">Cross-Domain Transferability</h3>
                <p className="text-xs text-gray-500">Probabilistic analysis based on resume patterns.</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-12 gap-8">
                {/* Left: Chart */}
                <div className="md:col-span-4 flex flex-col items-center justify-center py-4 md:py-0">
                    <div className="relative w-40 h-40 sm:w-48 sm:h-48">
                         <svg className="w-full h-full transform -rotate-90" viewBox="0 0 160 160">
                            <circle cx="80" cy="80" r={radius} stroke="#F2F2F7" strokeWidth="12" fill="none" />
                             <circle 
                                cx="80" 
                                cy="80" 
                                r={radius} 
                                stroke="#007AFF" 
                                strokeWidth="12" 
                                fill="none" 
                                strokeDasharray={circumference} 
                                strokeDashoffset={circumference - (averageScore / 100) * circumference} 
                                strokeLinecap="round" 
                                className="transition-all duration-1000 ease-out"
                            />
                         </svg>
                         <div className="absolute inset-0 flex flex-col items-center justify-center">
                             <span className="text-3xl font-bold text-gray-900">{averageScore}%</span>
                             <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider mt-1">Crossover Fit</span>
                         </div>
                    </div>
                </div>

                {/* Right: List */}
                <div className="md:col-span-8 space-y-3">
                    {topDomains.map((domain, i) => {
                         const style = CONFIDENCE_COLORS[domain.confidence];
                         return (
                            <div 
                                key={domain.domainName}
                                onClick={() => setSelectedDomain(selectedDomain?.domainName === domain.domainName ? null : domain)}
                                className={`group p-3 rounded-xl border transition-all cursor-pointer relative overflow-hidden ${selectedDomain?.domainName === domain.domainName ? 'border-system-blue bg-blue-50/50' : 'border-gray-100 hover:border-gray-300 hover:bg-gray-50'}`}
                            >
                                <div className="flex items-center justify-between mb-2 relative z-10">
                                    <div className="flex items-center gap-2">
                                        <span className="font-bold text-sm text-gray-900">{domain.domainName}</span>
                                        <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${style.bg} ${style.text} border ${style.border}`}>
                                            {domain.confidence.toUpperCase()}
                                        </span>
                                    </div>
                                    <span className="font-bold text-sm text-gray-900">{domain.transferabilityScore}%</span>
                                </div>
                                <div className="w-full bg-gray-100 rounded-full h-1.5 overflow-hidden relative z-10">
                                    <div 
                                        className="h-full rounded-full transition-all duration-500"
                                        style={{ 
                                            width: `${domain.transferabilityScore}%`,
                                            backgroundColor: DONUT_COLORS[i % DONUT_COLORS.length]
                                        }}
                                    />
                                </div>
                                {selectedDomain?.domainName === domain.domainName && (
                                    <div className="mt-4 pt-4 border-t border-gray-200/50 animate-[fadeIn_0.3s_ease-out]">
                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
                                            <div>
                                                <h5 className="text-[10px] font-bold uppercase text-gray-400 mb-2">Top Transferable Skills</h5>
                                                <div className="flex flex-wrap gap-1.5">
                                                    {(domain.primarySkills || []).map(skill => (
                                                        <span key={skill} className="px-2 py-1 bg-white border border-gray-200 rounded text-xs text-gray-700 font-medium shadow-sm">{skill}</span>
                                                    ))}
                                                </div>
                                            </div>
                                            <div>
                                                <h5 className="text-[10px] font-bold uppercase text-gray-400 mb-2">Ramp-Up Time</h5>
                                                <span className="text-sm font-bold text-gray-900 flex items-center gap-1">
                                                    ⏱️ {domain.timeToProductivityWeeks} weeks 
                                                    <span className="text-gray-400 font-normal text-xs">(estimated)</span>
                                                </span>
                                            </div>
                                        </div>

                                        <div className="mb-4 bg-white p-3 rounded-lg border border-gray-200">
                                            <div className="flex justify-between items-center mb-2">
                                                <h5 className="text-[10px] font-bold uppercase text-system-blue">Suggested Resume Rewrite</h5>
                                                <button 
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        navigator.clipboard.writeText(domain.suggestedBullets.join('\n'));
                                                    }}
                                                    className="text-[10px] font-bold text-gray-400 hover:text-system-blue flex items-center gap-1"
                                                >
                                                    <ClipboardIcon className="w-3 h-3"/> Copy
                                                </button>
                                            </div>
                                            <ul className="list-disc pl-4 space-y-1">
                                                {(domain.suggestedBullets || []).map((bullet, idx) => (
                                                    <li key={idx} className="text-xs text-gray-700 italic">"{bullet}"</li>
                                                ))}
                                            </ul>
                                        </div>
                                    </div>
                                )}
                            </div>
                         );
                    })}
                </div>
            </div>
        </div>
    );
  };

  if (viewMode === 'compare') {
    const selectedCandidates = persistedCandidates.filter(c => selectedIds.has(c.id));
    return (
      <CompareProfiles 
        candidates={selectedCandidates} 
        jdText={jobDescription}
        onBack={() => setViewMode('list')} 
      />
    );
  }

  if (viewMode === 'chat') {
    const selectedCandidates = persistedCandidates.filter(c => selectedIds.has(c.id));
    return (
      <RecruiterChatView 
        candidates={selectedCandidates} 
        jdText={jobDescription}
        onBack={() => setViewMode('list')} 
      />
    );
  }

  if (viewMode === 'candidate-details' && selectedCandidate && selectedCandidate.analysis) {
    return (
      <div className="min-h-screen bg-[#F9F9FB] animate-scale-in flex flex-col">
        {/* Navigation Header */}
        <div className="bg-white border-b border-gray-100 px-4 sm:px-8 py-4 flex items-center justify-between sticky top-0 z-50 backdrop-blur-md bg-white/80">
          <div className="flex items-center gap-4">
            <button 
              onClick={() => setViewMode('list')}
              className="p-2 hover:bg-gray-100 rounded-full transition-all text-gray-500 hover:text-gray-900 group"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="w-6 h-6 transition-transform group-hover:-translate-x-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
            </button>
            <div>
              <h2 className="text-xl sm:text-2xl font-bold text-gray-900 tracking-tight">{selectedCandidate.name}</h2>
              <div className="flex items-center gap-2 mt-0.5">
                <span className="text-xs font-bold px-2 py-0.5 bg-blue-50 text-system-blue rounded-md uppercase tracking-wider">
                  {selectedCandidate.analysis.seniority_level}
                </span>
                <span className="text-gray-400 text-xs sm:text-sm font-medium">
                  {selectedCandidate.analysis.years_experience} Years Experience
                </span>
              </div>
            </div>
          </div>
          <div className="hidden sm:flex items-center gap-3">
             <button 
                onClick={() => setShowContactPopup(true)}
                className="px-6 py-2.5 bg-white border border-gray-200 text-gray-900 rounded-full text-sm font-bold hover:bg-gray-50 transition-all shadow-sm"
             >
                Contact Candidate
             </button>
             <button 
                onClick={() => setViewMode('list')}
                className="px-6 py-2.5 bg-gray-900 text-white rounded-full text-sm font-bold hover:bg-black transition-all shadow-lg"
             >
                Done
             </button>
          </div>
        </div>

        {/* Contact Popup */}
        {showContactPopup && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setShowContactPopup(false)}></div>
            <div className="bg-white rounded-[2.5rem] shadow-2xl w-full max-w-md relative z-10 overflow-hidden animate-scale-in p-8 sm:p-10">
              <div className="flex justify-between items-start mb-8">
                <div>
                  <h3 className="text-2xl font-bold text-gray-900 tracking-tight">Contact Info</h3>
                  <p className="text-sm text-gray-500 mt-1">Direct candidate details</p>
                </div>
                <button onClick={() => setShowContactPopup(false)} className="p-2 hover:bg-gray-100 rounded-full transition-colors text-gray-400">
                  <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                </button>
              </div>
              
              <div className="space-y-6">
                <div className="flex items-center gap-4 p-4 bg-gray-50 rounded-2xl border border-gray-100">
                  <div className="w-10 h-10 bg-white rounded-xl shadow-sm flex items-center justify-center text-system-blue">
                    <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"></path></svg>
                  </div>
                  <div>
                    <div className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-0.5">Mobile</div>
                    <div className="text-sm font-bold text-gray-900">{selectedCandidate.analysis?.phone || 'NA'}</div>
                  </div>
                </div>

                <div className="flex items-center gap-4 p-4 bg-gray-50 rounded-2xl border border-gray-100">
                  <div className="w-10 h-10 bg-white rounded-xl shadow-sm flex items-center justify-center text-system-blue">
                    <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"></path><polyline points="22,6 12,13 2,6"></polyline></svg>
                  </div>
                  <div>
                    <div className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-0.5">Email</div>
                    <div className="text-sm font-bold text-gray-900">{selectedCandidate.analysis?.email || 'NA'}</div>
                  </div>
                </div>

                <div className="flex items-center gap-4 p-4 bg-gray-50 rounded-2xl border border-gray-100">
                  <div className="w-10 h-10 bg-white rounded-xl shadow-sm flex items-center justify-center text-system-blue">
                    <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path><circle cx="12" cy="10" r="3"></circle></svg>
                  </div>
                  <div>
                    <div className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-0.5">Address</div>
                    <div className="text-sm font-bold text-gray-900">{selectedCandidate.analysis?.address || 'NA'}</div>
                  </div>
                </div>
              </div>

              <button 
                onClick={() => setShowContactPopup(false)}
                className="w-full mt-10 py-4 bg-gray-900 text-white font-bold rounded-2xl hover:bg-black transition-all shadow-lg active:scale-95"
              >
                Close
              </button>
            </div>
          </div>
        )}

        {/* Tab Navigation */}
        <div className="bg-white border-b border-gray-100 flex justify-center sticky top-[73px] z-40">
          <div className="flex w-full max-w-4xl">
            {['profile', 'scan', 'interview'].map((t) => (
              <button 
                key={t}
                onClick={() => { setModalTab(t as any); if(t === 'interview') handleLoadInterview(); }}
                className={`flex-1 py-4 text-sm font-bold capitalize border-b-2 transition-all relative ${modalTab === t ? 'text-system-blue border-system-blue' : 'text-gray-400 border-transparent hover:text-gray-600'}`}
              >
                {t === 'scan' ? 'Recruiter Scan' : t === 'interview' ? 'Interview Prep' : 'Candidate Profile'}
                {modalTab === t && <div className="absolute bottom-0 left-0 w-full h-0.5 bg-system-blue animate-[scaleX_0.2s_ease-out]"></div>}
              </button>
            ))}
          </div>
        </div>

        {/* Content Area */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-8">
          <div className="max-w-6xl mx-auto">
            {modalTab === 'profile' && (
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 pb-20">
                {/* Left Column: Main Info */}
                <div className="lg:col-span-8 space-y-8">
                  {/* Summary Card */}
                  <section className="bg-white p-6 sm:p-10 rounded-[2rem] shadow-apple-card border border-white/60">
                    <h4 className="text-[10px] font-bold uppercase tracking-[0.2em] text-gray-400 mb-6">Executive Summary</h4>
                    <p className="text-gray-800 leading-relaxed text-lg sm:text-xl font-medium font-serif italic">
                      "{selectedCandidate.analysis.summary}"
                    </p>
                  </section>

                  {/* Strengths & Gaps */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <section className="bg-white p-6 sm:p-8 rounded-[2rem] shadow-apple-card border border-white/60">
                      <h4 className="text-[10px] font-bold uppercase tracking-[0.2em] text-system-green mb-6">Key Strengths</h4>
                      <div className="space-y-3">
                        {(selectedCandidate.analysis.strengths || []).map((s, i) => (
                          <div key={i} className="flex items-start gap-3 p-3 bg-green-50/50 rounded-2xl border border-green-100/50">
                            <span className="text-system-green font-bold">✓</span>
                            <span className="text-sm font-semibold text-gray-700">{s}</span>
                          </div>
                        ))}
                      </div>
                    </section>
                    <section className="bg-white p-6 sm:p-8 rounded-[2rem] shadow-apple-card border border-white/60">
                      <h4 className="text-[10px] font-bold uppercase tracking-[0.2em] text-system-orange mb-6">Identified Gaps</h4>
                      <div className="space-y-3">
                        {(selectedCandidate.analysis.gaps || []).map((g, i) => (
                          <div key={i} className="flex items-start gap-3 p-3 bg-orange-50/50 rounded-2xl border border-orange-100/50">
                            <span className="text-system-orange font-bold">!</span>
                            <span className="text-sm font-semibold text-gray-700">{g}</span>
                          </div>
                        ))}
                      </div>
                    </section>
                  </div>

                  {/* Cross Domain Analysis */}
                  {renderCrossDomainCard()}
                </div>

                {/* Right Column: Stats & Meta */}
                <div className="lg:col-span-4 space-y-8">
                  {/* Score Card */}
                  <div className="bg-gradient-to-br from-gray-900 to-black text-white p-8 rounded-[2.5rem] shadow-2xl relative overflow-hidden group">
                    <div className="absolute top-0 right-0 -mt-10 -mr-10 w-40 h-40 bg-system-blue blur-[80px] opacity-40 group-hover:opacity-60 transition-opacity"></div>
                    <div className="relative z-10">
                      <div className="flex justify-between items-end mb-8">
                        <div>
                          <div className="text-gray-400 text-[10px] font-bold uppercase tracking-widest mb-1">Match Score</div>
                          <div className="text-6xl font-bold tracking-tighter">{selectedCandidate.analysis.match_score}%</div>
                        </div>
                        <div className="text-right">
                          <div className="text-gray-400 text-[10px] font-bold uppercase tracking-widest mb-1">Potential</div>
                          <div className="text-3xl font-bold tracking-tight text-blue-400">{selectedCandidate.analysis.potential_score}%</div>
                        </div>
                      </div>
                      
                      <div className="space-y-4 pt-6 border-t border-white/10">
                        {Object.entries(selectedCandidate.analysis.breakdown || {}).map(([key, val]) => (
                          <div key={key} className="space-y-1.5">
                            <div className="flex justify-between text-[10px] font-bold uppercase tracking-wider text-gray-400">
                              <span>{key.replace('_', ' ')}</span>
                              <span>{val}%</span>
                            </div>
                            <div className="h-1 bg-white/10 rounded-full overflow-hidden">
                              <div className="h-full bg-system-blue transition-all duration-1000" style={{ width: `${val}%` }}></div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Training Effort */}
                  <section className="bg-white p-6 sm:p-8 rounded-[2rem] shadow-apple-card border border-white/60">
                    <h4 className="text-[10px] font-bold uppercase tracking-[0.2em] text-gray-400 mb-6">Training Effort</h4>
                    <div className="flex items-center gap-4 p-4 bg-gray-50 rounded-2xl border border-gray-100">
                      <div className="w-10 h-10 bg-white rounded-xl shadow-sm flex items-center justify-center text-xl">⏱️</div>
                      <p className="text-gray-900 font-bold text-lg leading-tight">{selectedCandidate.analysis.training_estimate}</p>
                    </div>
                  </section>

                  {/* Red Flags */}
                  {(selectedCandidate.analysis.red_flags || []).length > 0 && (
                    <section className="bg-white p-6 sm:p-8 rounded-[2rem] shadow-apple-card border border-white/60 border-t-system-red border-t-4">
                      <h4 className="text-[10px] font-bold uppercase tracking-[0.2em] text-system-red mb-6">Red Flags</h4>
                      <div className="space-y-3">
                        {(selectedCandidate.analysis.red_flags || []).map((flag, i) => (
                          <div key={i} className="flex items-start gap-3 p-3 bg-red-50/50 rounded-2xl border border-red-100/50">
                            <span className="text-system-red font-bold">⚠️</span>
                            <span className="text-sm font-semibold text-red-700">{flag}</span>
                          </div>
                        ))}
                      </div>
                    </section>
                  )}
                </div>
              </div>
            )}

            {modalTab === 'scan' && (
              <div className="max-w-5xl mx-auto pb-20 animate-scale-in">
                <RecruiterScan 
                  jobDescription={jobDescription} 
                  resumeFile={selectedCandidate.file} 
                />
              </div>
            )}

            {modalTab === 'interview' && (
              <div className="max-w-4xl mx-auto space-y-8 pb-20 animate-scale-in">
                {isLoadingModal ? (
                  <div className="flex flex-col items-center justify-center py-40 bg-white rounded-[2.5rem] shadow-apple-card border border-white/60">
                    <div className="w-12 h-12 border-4 border-system-blue border-t-transparent rounded-full animate-spin mb-6"></div>
                    <p className="text-gray-400 font-bold uppercase tracking-widest text-xs">Drafting Custom Script...</p>
                  </div>
                ) : modalError ? (
                  <div className="text-center py-40 bg-white rounded-[2.5rem] shadow-apple-card border border-white/60">
                    <div className="text-4xl mb-4">⚠️</div>
                    <p className="text-gray-800 font-bold mb-4">{modalError}</p>
                    <button onClick={handleLoadInterview} className="px-8 py-3 bg-system-blue text-white rounded-full font-bold shadow-lg">Retry</button>
                  </div>
                ) : interviewScript && (
                  <>
                    <div className="bg-gradient-to-br from-indigo-600 to-purple-700 p-8 sm:p-10 rounded-[2.5rem] shadow-xl text-white relative overflow-hidden">
                      <div className="absolute top-0 right-0 -mt-10 -mr-10 w-40 h-40 bg-white/10 blur-[60px] rounded-full"></div>
                      <h4 className="text-[10px] font-bold uppercase tracking-[0.2em] text-white/60 mb-6">Hiring Recommendation</h4>
                      <p className="text-xl sm:text-2xl font-medium leading-relaxed font-serif italic">
                        "{interviewScript.recommendation_template}"
                      </p>
                    </div>

                    <div className="space-y-6">
                      <h3 className="text-xl font-bold text-gray-900 px-2">Interview Questions</h3>
                      {interviewScript.questions.map((q, i) => (
                        <div key={i} className="bg-white p-6 sm:p-10 rounded-[2rem] shadow-apple-card border border-white/60 group hover:shadow-apple-hover transition-all">
                          <div className="flex items-center justify-between mb-6">
                            <span className={`text-[10px] font-bold uppercase px-3 py-1 rounded-full tracking-wider ${
                              q.type === 'Technical' ? 'bg-blue-50 text-blue-600' :
                              q.type === 'Behavioral' ? 'bg-purple-50 text-purple-600' :
                              q.type === 'Situational' ? 'bg-orange-50 text-orange-600' :
                              'bg-red-50 text-red-600'
                            }`}>
                              {q.type} Question
                            </span>
                            <span className="text-gray-300 font-bold text-sm">0{i + 1}</span>
                          </div>
                          <h4 className="text-xl sm:text-2xl font-bold text-gray-900 mb-8 leading-tight">{q.question}</h4>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div className="bg-green-50/50 p-6 rounded-2xl border border-green-100/50">
                              <h5 className="text-[10px] font-bold uppercase text-system-green mb-3 tracking-widest">Ideal Answer Signals</h5>
                              <p className="text-sm text-gray-700 leading-relaxed font-medium">{q.expected_answer}</p>
                            </div>
                            <div className="bg-gray-50 p-6 rounded-2xl border border-gray-100">
                              <h5 className="text-[10px] font-bold uppercase text-gray-400 mb-3 tracking-widest">Scoring Criteria</h5>
                              <p className="text-sm text-gray-600 leading-relaxed">{q.score_criteria}</p>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-[1400px] mx-auto p-4 sm:p-8 animate-scale-in relative">
      
      {/* Top Controls */}
      <div className="flex items-center gap-1 bg-gray-200/50 p-1 rounded-xl w-full sm:w-fit mb-6 sm:mb-8 backdrop-blur-md overflow-x-auto">
        <button 
            onClick={() => setActiveTab('dashboard')}
            className={`flex-1 sm:flex-none px-4 sm:px-5 py-2 rounded-lg text-sm font-semibold whitespace-nowrap transition-all ${activeTab === 'dashboard' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
        >
            Candidate Screening
        </button>
        <button 
            onClick={() => setActiveTab('jd-intel')}
            className={`flex-1 sm:flex-none px-4 sm:px-5 py-2 rounded-lg text-sm font-semibold whitespace-nowrap transition-all ${activeTab === 'jd-intel' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
        >
            JD Intelligence
        </button>
      </div>

      {/* JD Area */}
      <div className="bg-white rounded-3xl p-4 sm:p-6 shadow-apple-card border border-white/60 mb-8 transition-all hover:shadow-apple-hover group">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-bold text-gray-900">Target Role</h3>
            {activeTab === 'jd-intel' && (
                isAnalyzingJd ? (
                    <div className="flex items-center gap-2 px-3 py-1.5 sm:px-4 sm:py-2 bg-gray-50 rounded-full border border-gray-100">
                        <div className="w-3 h-3 sm:w-4 sm:h-4 border-2 border-system-blue border-t-transparent rounded-full animate-spin"></div>
                        <span className="text-xs font-semibold text-gray-600 hidden sm:inline">AI Auditing...</span>
                        <span className="text-xs font-semibold text-gray-600 sm:hidden">Auditing...</span>
                    </div>
                ) : (
                    <button 
                      onClick={handleAnalyzeJD} 
                      className="px-3 py-1.5 sm:px-4 sm:py-2 bg-system-blue text-white text-xs sm:text-sm font-semibold rounded-full hover:bg-blue-600 transition-colors flex items-center gap-2"
                    >
                        <SparklesIcon className="w-3 h-3 sm:w-4 sm:h-4" /> {jdAnalysis ? 'Re-Analyze' : 'Analyze'}
                    </button>
                )
            )}
          </div>
          <div className="relative">
              <textarea 
                className="w-full bg-gray-50 rounded-xl p-4 text-sm focus:ring-2 focus:ring-system-blue/20 outline-none border-0 resize-y min-h-[100px] pr-10 sm:pr-12"
                placeholder="Paste Job Description..."
                value={jobDescription}
                onChange={(e) => setJobDescription(e.target.value)}
              />
              <button
                onClick={() => setIsJDMaximized(true)}
                className="absolute top-2 right-2 p-2 text-gray-400 hover:text-system-blue hover:bg-white rounded-lg transition-all opacity-100 sm:opacity-0 group-hover:opacity-100"
                title="Maximize"
              >
                  <MaximizeIcon className="w-4 h-4" />
              </button>
          </div>
      </div>

      {activeTab === 'jd-intel' && (
          isAnalyzingJd ? (
            <div className="py-20 text-center animate-scale-in bg-white rounded-[2.5rem] shadow-apple-card border border-white/60">
                 <div className="w-16 h-16 sm:w-20 sm:h-20 bg-blue-50 rounded-full flex items-center justify-center mx-auto mb-8 text-system-blue">
                     <SparklesIcon className="w-8 h-8 sm:w-10 sm:h-10 animate-pulse" />
                 </div>
                 <h3 className="text-2xl font-bold text-gray-900 tracking-tight">Auditing Job Description</h3>
                 <p className="text-gray-500 text-sm mt-3 max-w-md mx-auto px-4 font-medium">Gemini is checking for bias, clarity, and market competitiveness...</p>
            </div>
          ) : jdAnalysis ? (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 mb-10 animate-scale-in">
                <div className="lg:col-span-5 space-y-8">
                    <div className="bg-white p-8 sm:p-10 rounded-[2.5rem] shadow-apple-card border border-white/60">
                        <div className="flex items-center justify-between mb-10">
                            <h3 className="text-[10px] font-bold uppercase tracking-[0.2em] text-gray-400">JD Audit Insights</h3>
                            <div className="bg-gray-100 text-[10px] font-bold px-3 py-1 rounded-full uppercase tracking-widest text-gray-500">AI Powered</div>
                        </div>
                        <div className="space-y-8">
                            <div className="space-y-3">
                                <div className="flex justify-between text-xs font-bold uppercase tracking-wider text-gray-500">
                                    <span>Clarity Score</span> 
                                    <span className="text-gray-900">{jdAnalysis.clarity_score}%</span>
                                </div>
                                <div className="h-1.5 bg-gray-50 rounded-full overflow-hidden">
                                    <div className="h-full bg-system-green rounded-full transition-all duration-1000" style={{width: `${jdAnalysis.clarity_score}%`}}></div>
                                </div>
                            </div>
                            <div className="space-y-3">
                                <div className="flex justify-between text-xs font-bold uppercase tracking-wider text-gray-500">
                                    <span>Bias Level</span> 
                                    <span className="text-gray-900">{jdAnalysis.bias_score}%</span>
                                </div>
                                <div className="h-1.5 bg-gray-50 rounded-full overflow-hidden">
                                    <div className="h-full bg-system-red rounded-full transition-all duration-1000" style={{width: `${jdAnalysis.bias_score}%`}}></div>
                                </div>
                            </div>
                        </div>
                        
                        {jdAnalysis.red_flags_in_jd && jdAnalysis.red_flags_in_jd.length > 0 && (
                            <div className="mt-12 p-6 bg-red-50/50 rounded-3xl border border-red-100/50">
                                <h4 className="text-[10px] font-bold uppercase tracking-widest text-system-red mb-4">Red Flag Terms</h4>
                                <div className="flex flex-wrap gap-2">
                                    {jdAnalysis.red_flags_in_jd.map((f, i) => (
                                        <span key={i} className="px-3 py-1.5 bg-white rounded-xl text-[11px] font-bold text-red-600 border border-red-100 shadow-sm">
                                            {f}
                                        </span>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>

                    <div className="bg-white p-8 rounded-[2.5rem] shadow-apple-card border border-white/60">
                        <h4 className="text-[10px] font-bold uppercase tracking-[0.2em] text-gray-400 mb-6">Market Competitiveness</h4>
                        <div className="flex items-center gap-4 p-4 bg-gray-50 rounded-2xl border border-gray-100">
                            <div className="w-10 h-10 bg-white rounded-xl shadow-sm flex items-center justify-center text-xl">📊</div>
                            <div>
                                <div className="text-xs font-bold text-gray-400 uppercase tracking-widest">Market Fit</div>
                                <div className="text-lg font-bold text-gray-900">High Demand</div>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="lg:col-span-7 bg-gray-900 text-white p-8 sm:p-12 rounded-[2.5rem] shadow-2xl flex flex-col relative overflow-hidden group">
                    <div className="absolute top-0 right-0 -mt-20 -mr-20 w-60 h-60 bg-system-blue blur-[100px] opacity-20 group-hover:opacity-30 transition-opacity"></div>
                    <div className="relative z-10 flex flex-col h-full">
                        <div className="flex justify-between items-center mb-10">
                            <h3 className="text-xl font-bold tracking-tight">Optimized Description</h3>
                            <button 
                                onClick={handleCopyJD}
                                className="flex items-center gap-2 px-5 py-2.5 bg-white/10 hover:bg-white/20 rounded-2xl text-xs font-bold transition-all text-white border border-white/10 active:scale-95"
                            >
                                {jdCopied ? (
                                    <>
                                        <span className="text-green-400">✓ Copied</span>
                                    </>
                                ) : (
                                    <>
                                        <ClipboardIcon className="w-4 h-4" />
                                        <span>Copy JD</span>
                                    </>
                                )}
                            </button>
                        </div>
                        <div className="flex-1 overflow-y-auto pr-4 custom-scrollbar-white">
                            <div className="prose prose-invert prose-lg max-w-none">
                                <pre className="whitespace-pre-wrap font-serif italic text-white/80 leading-relaxed text-base sm:text-lg border-0 bg-transparent p-0 m-0">
                                    {jdAnalysis.rewritten_jd}
                                </pre>
                            </div>
                        </div>
                        <div className="mt-10 pt-8 border-t border-white/10 flex items-center gap-4">
                            <div className="w-10 h-10 bg-white/10 rounded-xl flex items-center justify-center text-lg">✨</div>
                            <p className="text-xs text-white/50 font-medium leading-relaxed">
                                This version is optimized for SEO, clarity, and inclusivity to attract top-tier talent.
                            </p>
                        </div>
                    </div>
                </div>
            </div>
          ) : null
      )}

      {activeTab === 'dashboard' && (
        <>
          <div 
            onClick={() => fileInputRef.current?.click()}
            className="group border-2 border-dashed border-gray-200 hover:border-system-blue/50 rounded-3xl p-6 sm:p-10 text-center bg-gray-50/50 hover:bg-blue-50/30 transition-all cursor-pointer mb-6 sm:mb-8"
          >
            <div className="w-12 h-12 sm:w-14 sm:h-14 bg-white rounded-2xl shadow-sm flex items-center justify-center mx-auto mb-4 group-hover:scale-110 transition-transform">
                <UploadIcon className="w-6 h-6 text-system-blue" />
            </div>
            <h3 className="text-lg font-bold text-gray-900">Import Candidates</h3>
            <p className="text-gray-500 text-sm mt-1">PDF or Text files supported</p>
            <input type="file" multiple ref={fileInputRef} className="hidden" onChange={handleFileUpload} accept=".pdf,.jpg,.png,.txt" />
          </div>

          {/* Bulk Actions Bar - Always Present Above List */}
          {candidates.length > 0 && (
            <div className="sticky top-4 z-[60] w-full max-w-3xl mx-auto mb-8 animate-scale-in">
                <div className="bg-gray-900/95 backdrop-blur-xl text-white p-3 sm:p-4 rounded-full shadow-2xl border border-white/10 flex items-center justify-between gap-4">
                    {/* Limit Toast */}
                    {showCompareToast && (
                        <div className="absolute -top-14 left-1/2 -translate-x-1/2 bg-gray-800 text-white text-xs font-bold py-2 px-4 rounded-full shadow-lg animate-[fadeIn_0.2s_ease-out] whitespace-nowrap z-30 border border-white/5">
                            Compare supports up to 3 profiles.
                        </div>
                    )}

                    <div className="flex items-center gap-3 pl-2">
                        <div className="w-8 h-8 bg-system-blue rounded-full flex items-center justify-center text-xs font-black shadow-lg shadow-blue-500/20">
                            {selectedIds.size}
                        </div>
                        <div className="hidden sm:block">
                            <div className="text-[10px] font-bold uppercase tracking-widest text-gray-400 leading-none mb-1">Selected</div>
                            <div className="text-xs font-bold leading-none">Candidates</div>
                        </div>
                    </div>

                    <div className="flex items-center gap-2">
                        <div className="relative group">
                            <button 
                                onClick={async () => {
                                    if (window.confirm("All the JD and candidate from the list will be removed. Are you sure?")) {
                                        await archiveAllCandidates();
                                        setJobDescription('');
                                        setJdAnalysis(null);
                                        setCandidates([]);
                                        setSelectedIds(new Set());
                                    }
                                }}
                                className="p-2.5 bg-white/10 hover:bg-white/20 rounded-full transition-all flex items-center justify-center group"
                            >
                                <RefreshCw className="w-5 h-5 sm:w-4 sm:h-4 text-white" />
                            </button>
                            <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-1.5 bg-gray-800 text-white text-[10px] font-bold rounded-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-[70] shadow-xl border border-white/5">
                                All the JD and candidate from the list will be removed
                                <div className="absolute top-full left-1/2 -translate-x-1/2 border-8 border-transparent border-t-gray-800"></div>
                            </div>
                        </div>
                        <button 
                            onClick={handleChat}
                            disabled={selectedIds.size === 0}
                            className="p-2.5 sm:px-5 sm:py-2.5 bg-white/10 hover:bg-white/20 rounded-full transition-all flex items-center gap-2 group disabled:opacity-30 disabled:cursor-not-allowed"
                            title="AI Chat"
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5 sm:w-4 sm:h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 0 1-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" /></svg>
                            <span className="hidden sm:inline text-xs font-bold">Ask AI</span>
                        </button>
                        <button 
                            onClick={handleCompare}
                            disabled={selectedIds.size < 2}
                            className="p-2.5 sm:px-5 sm:py-2.5 bg-white/10 hover:bg-white/20 rounded-full transition-all flex items-center gap-2 disabled:opacity-30 disabled:cursor-not-allowed group"
                            title="Compare Profiles"
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5 sm:w-4 sm:h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path strokeLinecap="round" strokeLinejoin="round" d="M9 4.5v15m6-15v15m-10.875 0h15.75c.621 0 1.125-.504 1.125-1.125V5.625c0-.621-.504-1.125-1.125-1.125H4.125C3.504 4.5 3 5.004 3 5.625v12.75c0 .621.504 1.125 1.125 1.125z" /></svg>
                            <span className="hidden sm:inline text-xs font-bold">Compare</span>
                        </button>
                        <button 
                            onClick={handleBulkEmail}
                            disabled={selectedIds.size === 0}
                            className="p-2.5 sm:px-5 sm:py-2.5 bg-white text-gray-900 rounded-full transition-all flex items-center gap-2 hover:scale-105 active:scale-95 group disabled:opacity-50 disabled:cursor-not-allowed"
                            title="Bulk Email"
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5 sm:w-4 sm:h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="4" width="20" height="16" rx="2"></rect><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"></path></svg>
                            <span className="hidden sm:inline text-xs font-bold">Email</span>
                        </button>
                        <div className="w-px h-6 bg-white/10 mx-1 hidden sm:block"></div>
                    </div>
                </div>
            </div>
          )}

          {candidates.length > 0 && (
              <div className="bg-white rounded-3xl shadow-apple-card border border-white/60 overflow-hidden">
                <div className="w-full">
                    {/* Desktop Table View */}
                    <table className="w-full text-left border-collapse hidden md:table">
                        <thead>
                            <tr className="border-b border-gray-100 bg-gray-50/50">
                                <th className="p-5 pl-8 w-16">
                                    <input 
                                        type="checkbox" 
                                        className="w-4 h-4 rounded text-system-blue border-gray-300 focus:ring-system-blue cursor-pointer"
                                        checked={selectedIds.size === sortedCandidates.length && sortedCandidates.length > 0}
                                        onChange={toggleSelectAll}
                                    />
                                </th>
                                <th className="p-5 text-xs font-bold text-gray-500 uppercase tracking-wider">Rank</th>
                                <th className="p-5 text-xs font-bold text-gray-500 uppercase tracking-wider">Candidate</th>
                                <th className="p-5 text-xs font-bold text-gray-500 uppercase tracking-wider">Score</th>
                                <th className="p-5 text-xs font-bold text-gray-500 uppercase tracking-wider">Potential</th>
                                <th className="p-5 text-xs font-bold text-gray-500 uppercase tracking-wider">Exp</th>
                                <th className="p-5 text-xs font-bold text-gray-500 uppercase tracking-wider text-right pr-8">Action</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-50">
                            {sortedCandidates.map((c, idx) => {
                                const isTopPick = idx < 3 && c.status === 'analyzed';
                                const isSelected = selectedIds.has(c.id);
                                return (
                                    <tr key={c.id} className={`transition-colors group ${isSelected ? 'bg-blue-50/50' : 'hover:bg-gray-50/80'}`}>
                                        <td className="p-5 pl-8">
                                            <input 
                                                type="checkbox" 
                                                className="w-4 h-4 rounded text-system-blue border-gray-300 focus:ring-system-blue cursor-pointer"
                                                checked={isSelected}
                                                onChange={() => toggleSelection(c.id)}
                                            />
                                        </td>
                                        <td className="p-5 font-medium text-gray-400">#{idx + 1}</td>
                                        <td className="p-5">
                                            <div className="font-bold text-gray-900">{c.name}</div>
                                            {isTopPick && <span className="text-[10px] bg-yellow-100 text-yellow-700 px-2 py-0.5 rounded-full font-bold">TOP PICK</span>}
                                        </td>
                                        <td className="p-5">
                                            {c.status === 'processing' ? (
                                                <div className="flex items-center gap-2 text-system-blue">
                                                    <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin"></div>
                                                    <span className="text-[10px] font-black uppercase tracking-widest">Analyzing</span>
                                                </div>
                                            ) : c.status === 'error' ? (
                                                <div className="flex items-center gap-2">
                                                    <span className="text-[10px] font-black uppercase tracking-widest text-red-500 bg-red-50 px-2 py-1 rounded">Failed</span>
                                                    <button 
                                                        onClick={(e) => { e.stopPropagation(); handleReanalyze(c); }}
                                                        className="text-[10px] font-black uppercase tracking-widest text-system-blue hover:text-blue-700 bg-blue-50 px-2 py-1 rounded transition-colors"
                                                    >
                                                        Retry
                                                    </button>
                                                </div>
                                            ) : c.analysis ? (
                                                <div className="flex items-center gap-2">
                                                    <div className="w-10 bg-gray-100 h-1.5 rounded-full overflow-hidden">
                                                        <div className={`h-full rounded-full ${c.analysis.match_score >= 80 ? 'bg-system-green' : c.analysis.match_score >= 60 ? 'bg-system-orange' : 'bg-system-red'}`} style={{ width: `${c.analysis.match_score}%` }}></div>
                                                    </div>
                                                    <span className={`text-sm font-black ${c.analysis.match_score >= 80 ? 'text-system-green' : c.analysis.match_score >= 60 ? 'text-system-orange' : 'text-system-red'}`}>{c.analysis.match_score}%</span>
                                                </div>
                                            ) : (
                                                <span className="text-[10px] font-black uppercase tracking-widest text-gray-400">Queued</span>
                                            )}
                                        </td>
                                        <td className="p-5 text-sm font-bold text-gray-900">{c.analysis?.potential_score ? `${c.analysis.potential_score}%` : '-'}</td>
                                        <td className="p-5 text-sm font-bold text-gray-900">{c.analysis?.years_experience ? `${c.analysis.years_experience}y` : '-'}</td>
                                        <td className="p-5 text-right pr-8">
                                            <div className="flex items-center justify-end gap-2">
                                              <button 
                                                  onClick={() => setContactCandidate(c)}
                                                  disabled={c.status !== 'analyzed'}
                                                  className="text-gray-500 hover:text-system-blue text-sm font-semibold transition-opacity disabled:opacity-0"
                                              >
                                                  Contact
                                              </button>
                                              <button 
                                                  onClick={() => handleOpenCandidate(c)}
                                                  disabled={c.status !== 'analyzed'}
                                                  className="text-system-blue text-sm font-semibold transition-opacity disabled:opacity-0"
                                              >
                                                  View &rarr;
                                              </button>
                                              <button 
                                                  onClick={() => setCandidateToDelete(c)}
                                                  className="p-2 text-gray-400 hover:text-red-500 transition-colors"
                                              >
                                                  <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 6h18"></path><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"></path><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"></path></svg>
                                              </button>
                                            </div>
                                         </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>

                    {/* Mobile Card View */}
                    <div className="md:hidden">
                        {sortedCandidates.map((c, idx) => {
                             const isTopPick = idx < 3 && c.status === 'analyzed';
                             const isSelected = selectedIds.has(c.id);
                             return (
                                <div key={c.id} className={`p-4 border-b border-gray-100 last:border-0 ${isSelected ? 'bg-blue-50/30' : ''}`} onClick={() => toggleSelection(c.id)}>
                                    <div className="flex justify-between items-start mb-3">
                                        <div className="flex items-center gap-3">
                                            <input 
                                                type="checkbox" 
                                                className="w-5 h-5 rounded text-system-blue border-gray-300 focus:ring-system-blue cursor-pointer"
                                                checked={isSelected}
                                                onChange={(e) => { e.stopPropagation(); toggleSelection(c.id); }}
                                            />
                                            <div>
                                                <div className="font-bold text-gray-900">{c.name}</div>
                                                <div className="flex items-center gap-2 mt-1">
                                                    <span className="text-xs font-bold text-gray-400">#{idx + 1}</span>
                                                    {isTopPick && <span className="text-[10px] bg-yellow-100 text-yellow-700 px-2 py-0.5 rounded-full font-bold">TOP PICK</span>}
                                                </div>
                                            </div>
                                        </div>
                                        
                                        <div>
                                             {c.status === 'processing' ? (
                                                <div className="w-4 h-4 border-2 border-system-blue border-t-transparent rounded-full animate-spin"></div>
                                            ) : c.analysis ? (
                                                <span className={`text-sm font-bold px-2 py-1 rounded-md ${c.analysis.match_score >= 80 ? 'bg-green-50 text-green-700' : 'bg-gray-100 text-gray-600'}`}>{c.analysis.match_score}%</span>
                                            ) : (
                                                <span className="text-xs text-gray-400">...</span>
                                            )}
                                        </div>
                                    </div>
                                    
                                    <div className="flex justify-between items-center text-sm text-gray-500 pl-8">
                                        <div className="flex gap-4">
                                            <div className="flex flex-col">
                                                <span className="text-[10px] font-bold uppercase text-gray-400">Potential</span>
                                                <span className="font-medium">{c.analysis?.potential_score || '-'}</span>
                                            </div>
                                            <div className="flex flex-col">
                                                <span className="text-[10px] font-bold uppercase text-gray-400">Exp</span>
                                                <span className="font-medium">{c.analysis?.years_experience ? `${c.analysis.years_experience}y` : '-'}</span>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <button 
                                                onClick={(e) => { e.stopPropagation(); handleOpenCandidate(c); }}
                                                disabled={c.status !== 'analyzed'}
                                                className="px-4 py-2 bg-gray-100 text-gray-900 text-xs font-bold rounded-lg disabled:opacity-50"
                                            >
                                                View Profile
                                            </button>
                                            <button 
                                                onClick={(e) => { e.stopPropagation(); setCandidateToDelete(c); }}
                                                className="p-2 text-gray-400 hover:text-red-500 transition-colors"
                                            >
                                                <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 6h18"></path><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"></path><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"></path></svg>
                                            </button>
                                        </div>
                                    </div>
                                    
                                    {c.status === 'error' && (
                                        <div className="mt-3 pl-8">
                                            <button 
                                                onClick={(e) => { e.stopPropagation(); handleReanalyze(c); }}
                                                className="text-xs text-red-600 font-bold bg-red-50 px-3 py-1.5 rounded-lg w-full"
                                            >
                                                Analysis Failed — Retry
                                            </button>
                                        </div>
                                    )}
                                </div>
                             );
                        })}
                    </div>
                </div>
              </div>
          )}
        </>
      )}

      {/* Email Modal */}
      {showEmailModal && (
          <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center sm:p-4">
              <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setShowEmailModal(false)}></div>
              <div className="bg-white rounded-t-3xl sm:rounded-3xl shadow-2xl w-full max-w-2xl relative z-10 overflow-hidden animate-[translateY_0.2s_ease-out] max-h-[90vh] flex flex-col">
                  <div className="p-4 sm:p-6 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
                      <h3 className="text-lg sm:text-xl font-bold text-gray-900">Bulk Email Shortlist</h3>
                      <button onClick={() => setShowEmailModal(false)} className="p-2 hover:bg-gray-200 rounded-full transition-colors text-gray-500">
                         <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                      </button>
                  </div>
                  
                  <div className="p-4 sm:p-6 space-y-4 sm:space-y-6 overflow-y-auto">
                      {/* Recipients Preview */}
                      <div className="bg-gray-50 p-4 rounded-xl border border-gray-200">
                          <div className="flex justify-between items-center mb-2">
                            <label className="text-xs font-bold uppercase text-gray-400 block">Recipients (BCC)</label>
                            <button
                                onClick={() => {
                                    const cleanList = selectedEmails
                                        .map(e => e.replace('.pdf@', '@').replace('.pdf', ''))
                                        .join(', ');
                                    navigator.clipboard.writeText(cleanList);
                                    setAllEmailsCopied(true);
                                    setTimeout(() => setAllEmailsCopied(false), 2000);
                                }}
                                className="text-xs font-medium text-gray-500 hover:text-gray-900 flex items-center gap-1 transition-colors border border-transparent hover:border-gray-200 px-2 py-0.5 rounded-md"
                            >
                                <ClipboardIcon className="w-3 h-3" /> Copy All
                            </button>
                          </div>
                          <div className="flex flex-wrap gap-2 max-h-20 overflow-y-auto">
                              {selectedEmails.map((email, i) => (
                                  <span key={i} className="px-2 py-1 bg-white border border-gray-200 rounded text-xs text-gray-600">{email}</span>
                              ))}
                          </div>
                      </div>

                      {/* Content Draft */}
                      <div className="space-y-4">
                          <div>
                              <label className="text-xs font-bold uppercase text-gray-400 mb-1 block">Subject</label>
                              <input type="text" readOnly value={subject} className="w-full bg-white border border-gray-200 rounded-lg p-3 text-sm font-medium text-gray-900" />
                          </div>
                          <div>
                               <label className="text-xs font-bold uppercase text-gray-400 mb-1 block">Message</label>
                               <textarea readOnly value={body} className="w-full h-40 bg-white border border-gray-200 rounded-lg p-3 text-sm text-gray-700 resize-none leading-relaxed"></textarea>
                          </div>
                      </div>
                  </div>

                  <div className="p-4 sm:p-6 border-t border-gray-100 flex flex-col sm:flex-row justify-end gap-3 bg-gray-50/50 relative">
                      {allEmailsCopied && (
                          <div className="absolute left-6 bottom-20 sm:bottom-6 bg-gray-900 text-white text-xs font-medium py-2 px-4 rounded-full shadow-lg animate-[fadeIn_0.2s_ease-out] z-20">
                              All email addresses copied to clipboard.
                          </div>
                      )}
                      <button 
                        onClick={() => setShowEmailModal(false)}
                        className="px-6 py-2.5 text-sm font-semibold text-gray-600 hover:text-gray-900 w-full sm:w-auto order-1 sm:order-none"
                      >
                          Cancel
                      </button>
                      <button 
                         onClick={() => {
                             navigator.clipboard.writeText(`${subject}\n\n${body}`);
                             setEmailCopied(true);
                             setTimeout(() => setEmailCopied(false), 2000);
                         }}
                         className="px-6 py-2.5 bg-white border border-gray-200 text-gray-900 rounded-full text-sm font-bold hover:bg-gray-50 transition-colors flex items-center justify-center gap-2 w-full sm:w-auto"
                      >
                         {emailCopied ? <span className="text-green-600">Copied!</span> : 'Copy Draft'}
                      </button>
                      <a 
                          href={gmailLink}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="px-6 py-2.5 bg-system-blue text-white rounded-full text-sm font-bold hover:bg-blue-600 shadow-lg shadow-blue-500/20 transition-all transform hover:scale-105 active:scale-95 flex items-center justify-center gap-2 w-full sm:w-auto"
                      >
                          Open in Gmail
                      </a>
                  </div>
              </div>
          </div>
      )}

      {/* Candidate Details Modal - REMOVED and replaced by viewMode === 'candidate-details' */}

      {/* Contact Modal */}
      {contactCandidate && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
              <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setContactCandidate(null)}></div>
              <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md relative z-10 overflow-hidden animate-[scaleIn_0.2s_ease-out]">
                  <div className="p-6 border-b border-gray-100 flex justify-between items-center">
                      <h2 className="text-xl font-bold text-gray-900">Contact Candidate</h2>
                      <button onClick={() => setContactCandidate(null)} className="text-gray-400 hover:text-gray-700 p-1 rounded-full hover:bg-gray-100">✕</button>
                  </div>
                  <div className="p-8 space-y-6">
                      <div className="flex items-center gap-4">
                          <div className="w-16 h-16 bg-blue-50 rounded-2xl flex items-center justify-center text-system-blue text-2xl font-bold">
                              {contactCandidate.name.charAt(0)}
                          </div>
                          <div>
                              <h3 className="text-lg font-bold text-gray-900">{contactCandidate.name}</h3>
                              <p className="text-sm text-gray-500">{contactCandidate.analysis?.seniority_level || 'Candidate'}</p>
                          </div>
                      </div>

                      <div className="space-y-4">
                          <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl border border-gray-100">
                              <div className="w-8 h-8 bg-white rounded-lg flex items-center justify-center text-gray-400 shadow-sm">
                                  <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"></path></svg>
                              </div>
                              <div>
                                  <p className="text-[10px] font-bold text-gray-400 uppercase">Mobile Number</p>
                                  <p className="text-sm font-medium text-gray-900">+1 (555) 012-3456</p>
                              </div>
                          </div>

                          <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl border border-gray-100">
                              <div className="w-8 h-8 bg-white rounded-lg flex items-center justify-center text-gray-400 shadow-sm">
                                  <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"></path><polyline points="22,6 12,13 2,6"></polyline></svg>
                              </div>
                              <div>
                                  <p className="text-[10px] font-bold text-gray-400 uppercase">Email Address</p>
                                  <p className="text-sm font-medium text-gray-900">{contactCandidate.name.toLowerCase().replace(/\s+/g, '.')}@example.com</p>
                              </div>
                          </div>

                          <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl border border-gray-100">
                              <div className="w-8 h-8 bg-white rounded-lg flex items-center justify-center text-gray-400 shadow-sm">
                                  <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path><circle cx="12" cy="10" r="3"></circle></svg>
                              </div>
                              <div>
                                  <p className="text-[10px] font-bold text-gray-400 uppercase">Address</p>
                                  <p className="text-sm font-medium text-gray-900">San Francisco, CA</p>
                              </div>
                          </div>
                      </div>

                      <button 
                          onClick={() => setContactCandidate(null)}
                          className="w-full py-4 bg-gray-900 text-white font-bold rounded-2xl hover:bg-gray-800 transition-colors shadow-lg shadow-gray-900/10"
                      >
                          Close
                      </button>
                  </div>
              </div>
          </div>
      )}

      {/* Delete Confirmation Modal */}
      {candidateToDelete && (
          <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
              <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setCandidateToDelete(null)}></div>
              <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md relative z-10 overflow-hidden animate-[scaleIn_0.2s_ease-out]">
                  <div className="p-6 border-b border-gray-100 flex justify-between items-center">
                      <h2 className="text-xl font-bold text-gray-900">Are you sure?</h2>
                      <button onClick={() => setCandidateToDelete(null)} className="text-gray-400 hover:text-gray-700 p-1 rounded-full hover:bg-gray-100">✕</button>
                  </div>
                  <div className="p-8 space-y-6">
                      <div className="flex flex-col items-center text-center">
                          <div className="w-16 h-16 bg-red-50 rounded-full flex items-center justify-center text-system-red text-2xl mb-4">
                              ⚠️
                          </div>
                          <p className="text-gray-600 leading-relaxed">
                              You are about to delete <span className="font-bold text-gray-900">{candidateToDelete.name}</span>. 
                              This data will be deleted forever from the database and cannot be recovered.
                          </p>
                      </div>

                      <div className="flex gap-3">
                          <button 
                              onClick={() => setCandidateToDelete(null)}
                              className="flex-1 py-3 bg-gray-100 text-gray-700 font-bold rounded-2xl hover:bg-gray-200 transition-colors"
                          >
                              Cancel
                          </button>
                          <button 
                              onClick={() => {
                                  deleteCandidate(candidateToDelete.id);
                                  setCandidateToDelete(null);
                              }}
                              className="flex-1 py-3 bg-system-red text-white font-bold rounded-2xl hover:bg-red-600 transition-colors shadow-lg shadow-red-500/20"
                          >
                              Sure, Delete
                          </button>
                      </div>
                  </div>
              </div>
          </div>
      )}

       {/* Full Screen Modal for JD */}
      {isJDMaximized && (
        <div className="fixed inset-0 z-[100] bg-white animate-scale-in flex flex-col">
          <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 bg-gray-50/50 backdrop-blur-md">
            <div>
              <h2 className="text-lg font-bold text-gray-900">Target Role</h2>
              <p className="text-xs text-gray-500">Job Description Editor</p>
            </div>
            <div className="flex items-center gap-4">
               <span className="text-xs font-medium text-gray-400 hidden sm:inline">{jobDescription.length} chars</span>
               <button
                onClick={() => setIsJDMaximized(false)}
                className="px-6 py-2 bg-gray-900 text-white text-sm font-semibold rounded-full hover:bg-gray-800 transition-colors shadow-lg"
              >
                Done
              </button>
            </div>
          </div>
          <div className="flex-1 overflow-y-auto bg-gray-50 p-4 sm:p-10">
             <div className="max-w-4xl mx-auto bg-white shadow-sm min-h-full p-6 sm:p-12">
                <textarea
                  autoFocus
                  value={jobDescription}
                  onChange={(e) => setJobDescription(e.target.value)}
                  placeholder="Paste Job Description..."
                  className="w-full h-full min-h-[80vh] resize-none outline-none text-base sm:text-lg leading-relaxed text-gray-800 font-sans"
                />
             </div>
          </div>
        </div>
      )}
    </div>
  );
};
