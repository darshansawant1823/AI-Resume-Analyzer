
import React, { useState, useRef, useEffect } from 'react';
import type { Candidate, CandidateAnalysis, JDAnalysis, InterviewScript, CrossDomainAnalysis, TransferDomain } from '../types';
import { analyzeCandidate, analyzeJobDescription, simplifyResume, generateInterviewScript, performCrossDomainAnalysis } from '../services/geminiService';
import { UploadIcon } from './icons/UploadIcon';
import { SparklesIcon } from './icons/SparklesIcon';
import { ClipboardIcon } from './icons/ClipboardIcon';
import { MaximizeIcon } from './icons/MaximizeIcon';

interface RecruiterDashboardProps {}

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
  medium: { bg: 'bg-[#FFF6E5]', text: 'text-[#F5A623]', border: 'border-[#F5A623]' },
  low: { bg: 'bg-gray-100', text: 'text-gray-400', border: 'border-gray-200' }
};

export const RecruiterDashboard: React.FC<RecruiterDashboardProps> = () => {
  const [activeTab, setActiveTab] = useState<'dashboard' | 'jd-intel'>('dashboard');
  const [jobDescription, setJobDescription] = useState('');
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [selectedCandidateId, setSelectedCandidateId] = useState<string | null>(null);
  
  const [jdAnalysis, setJdAnalysis] = useState<JDAnalysis | null>(null);
  const [isAnalyzingJd, setIsAnalyzingJd] = useState(false);
  const [jdCopied, setJdCopied] = useState(false);
  const [isJDMaximized, setIsJDMaximized] = useState(false);

  const [cleanResume, setCleanResume] = useState<string | null>(null);
  const [interviewScript, setInterviewScript] = useState<InterviewScript | null>(null);
  const [modalTab, setModalTab] = useState<'profile' | 'clean' | 'interview'>('profile');
  const [isLoadingModal, setIsLoadingModal] = useState(false);
  const [modalError, setModalError] = useState<string | null>(null);

  // Cross Domain State
  const [isCrossDomainLoading, setIsCrossDomainLoading] = useState(false);
  const [selectedDomain, setSelectedDomain] = useState<TransferDomain | null>(null);

  // Bulk Selection States
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [showEmailModal, setShowEmailModal] = useState(false);
  const [emailCopied, setEmailCopied] = useState(false);
  const [allEmailsCopied, setAllEmailsCopied] = useState(false);
  
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
           if (candidate.file.type.startsWith('image/') || candidate.file.type === 'application/pdf') {
             const { base64Data, mimeType } = await fileToBase64(candidate.file);
             payload = { base64Data, mimeType };
           } else {
             const text = await candidate.file.text();
             payload = { text };
           }
           const analysis = await analyzeCandidate(jd, payload);
           setCandidates(prev => prev.map(c => c.id === candidate.id ? { ...c, status: 'analyzed', analysis } : c));
      } catch (err) {
           console.error(`Analysis failed for candidate ${candidate.id}:`, err);
           setCandidates(prev => prev.map(c => c.id === candidate.id ? { ...c, status: 'error' } : c));
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
  }, [candidates.map(c => c.status).join(','), sortedCandidates]); // Re-run when statuses change or sort order updates

  const handleAnalyzeJD = async () => {
      if(!jobDescription) return;
      setIsAnalyzingJd(true);
      setJdAnalysis(null); // Clear previous results to show loader
      try {
          const result = await analyzeJobDescription(jobDescription);
          setJdAnalysis(result);
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
      setSelectedDomain(null); // Reset selected domain
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
      } catch (e) {
          setModalError("Failed to simplify resume.");
      } finally { setIsLoadingModal(false); }
  }

  const handleLoadInterview = async () => {
      const candidate = candidates.find(c => c.id === selectedCandidateId);
      if (!candidate || !candidate.analysis) return;
      
      // If we already have the script for this session, don't reload unless it was an error
      if (interviewScript && !modalError) return;

      setIsLoadingModal(true);
      setModalError(null);
      try {
          const result = await generateInterviewScript(jobDescription, candidate.analysis.summary, candidate.analysis.red_flags);
          setInterviewScript(result);
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
        
        // Update candidates state with the new analysis to cache it
        setCandidates(prev => prev.map(c => c.id === candidate.id ? { ...c, crossDomainAnalysis: result } : c));
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
        newSet.add(id);
    }
    setSelectedIds(newSet);
  };

  const toggleSelectAll = () => {
      if (selectedIds.size === sortedCandidates.length) {
          setSelectedIds(new Set());
      } else {
          setSelectedIds(new Set(sortedCandidates.map(c => c.id)));
      }
  };

  const handleDeselectAll = () => {
      setSelectedIds(new Set());
  };

  const handleBulkEmail = () => {
      setShowEmailModal(true);
  };

  const getEmailDraft = () => {
    // Generate a professional email draft
    // Since this is BCC bulk, we keep placeholders generic or use the most common strength
    
    // Simulate email addresses for UI demo purposes since we don't parse them from PDF yet
    const selectedEmails = sortedCandidates
        .filter(c => selectedIds.has(c.id))
        .map(c => c.name.toLowerCase().replace(/\s/g, '.') + '@example.com');

    const subject = `Update on your application for ${jobDescription.split(' ').slice(0, 4).join(' ')}...`; // Simple heuristic for role name
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

    // Donut Chart Calculations
    const radius = 60;
    const circumference = 2 * Math.PI * radius;
    let cumulativePercent = 0;

    return (
        <div className="bg-white rounded-3xl p-6 shadow-sm border border-gray-100 relative overflow-hidden">
            {/* Visual Background Reference Styling (Mock Asset) */}
            <div className="absolute top-0 right-0 w-full h-2 bg-gradient-to-r from-blue-400 to-purple-500 opacity-20"></div>

            <div className="mb-6">
                <h3 className="text-lg font-bold text-gray-900">Cross-Domain Transferability</h3>
                <p className="text-xs text-gray-500">Probabilistic analysis based on resume patterns.</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-12 gap-8">
                {/* Left: Chart */}
                <div className="md:col-span-4 flex flex-col items-center justify-center">
                    <div className="relative w-48 h-48">
                         <svg className="w-full h-full transform -rotate-90" viewBox="0 0 160 160">
                            {/* Background Circle */}
                            <circle cx="80" cy="80" r={radius} stroke="#F2F2F7" strokeWidth="12" fill="none" />
                            {/* Segments */}
                            {topDomains.map((domain, i) => {
                                const percent = domain.transferabilityScore / (topDomains.length * 100); // Normalize to total chart
                                const strokeDasharray = `${(domain.transferabilityScore / 100) * circumference} ${circumference}`; // Just show score as arc length relative to 100
                                // For visual stacking, we can use a simpler approach: Concentric rings or just one main ring.
                                // Let's use the average score as the main ring for clarity, and render segments as decorative
                                return null; 
                            })}
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
                                {/* Expandable Detail Drawer */}
                                {selectedDomain?.domainName === domain.domainName && (
                                    <div className="mt-4 pt-4 border-t border-gray-200/50 animate-[fadeIn_0.3s_ease-out]">
                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
                                            <div>
                                                <h5 className="text-[10px] font-bold uppercase text-gray-400 mb-2">Top Transferable Skills</h5>
                                                <div className="flex flex-wrap gap-1.5">
                                                    {domain.primarySkills.map(skill => (
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
                                                {domain.suggestedBullets.map((bullet, idx) => (
                                                    <li key={idx} className="text-xs text-gray-700 italic">"{bullet}"</li>
                                                ))}
                                            </ul>
                                        </div>
                                        
                                        <div className="flex gap-2">
                                            <button 
                                                className="flex-1 py-2 bg-gray-900 text-white text-xs font-bold rounded-lg hover:bg-black transition-colors"
                                            >
                                                Use in Interview Script
                                            </button>
                                            <button className="px-4 py-2 bg-gray-100 text-gray-600 text-xs font-bold rounded-lg hover:bg-gray-200">
                                                Export Brief
                                            </button>
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

  // --- End Cross Domain Helper ---

  return (
    <div className="max-w-[1400px] mx-auto p-4 sm:p-8 animate-scale-in relative">
      
      {/* Top Controls */}
      <div className="flex items-center gap-1 bg-gray-200/50 p-1 rounded-xl w-fit mb-8 backdrop-blur-md">
        <button 
            onClick={() => setActiveTab('dashboard')}
            className={`px-5 py-2 rounded-lg text-sm font-semibold transition-all ${activeTab === 'dashboard' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
        >
            Candidate Screening
        </button>
        <button 
            onClick={() => setActiveTab('jd-intel')}
            className={`px-5 py-2 rounded-lg text-sm font-semibold transition-all ${activeTab === 'jd-intel' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
        >
            JD Intelligence
        </button>
      </div>

      {/* JD Area */}
      <div className="bg-white rounded-3xl p-6 shadow-apple-card border border-white/60 mb-8 transition-all hover:shadow-apple-hover group">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-bold text-gray-900">Target Role</h3>
            {activeTab === 'jd-intel' && (
                isAnalyzingJd ? (
                    <div className="flex items-center gap-2 px-4 py-2 bg-gray-50 rounded-full border border-gray-100">
                        <div className="w-4 h-4 border-2 border-system-blue border-t-transparent rounded-full animate-spin"></div>
                        <span className="text-xs font-semibold text-gray-600">AI Auditing...</span>
                    </div>
                ) : (
                    <button 
                      onClick={handleAnalyzeJD} 
                      className="px-4 py-2 bg-system-blue text-white text-sm font-semibold rounded-full hover:bg-blue-600 transition-colors flex items-center gap-2"
                    >
                        <SparklesIcon className="w-4 h-4" /> {jdAnalysis ? 'Re-Analyze' : 'Analyze'}
                    </button>
                )
            )}
          </div>
          <div className="relative">
              <textarea 
                className="w-full bg-gray-50 rounded-xl p-4 text-sm focus:ring-2 focus:ring-system-blue/20 outline-none border-0 resize-y min-h-[100px] pr-12"
                placeholder="Paste Job Description..."
                value={jobDescription}
                onChange={(e) => setJobDescription(e.target.value)}
              />
              <button
                onClick={() => setIsJDMaximized(true)}
                className="absolute top-2 right-2 p-2 text-gray-400 hover:text-system-blue hover:bg-white rounded-lg transition-all opacity-0 group-hover:opacity-100"
                title="Maximize"
              >
                  <MaximizeIcon className="w-4 h-4" />
              </button>
          </div>
      </div>

      {activeTab === 'jd-intel' && (
          isAnalyzingJd ? (
            <div className="py-20 text-center animate-scale-in bg-white rounded-3xl shadow-apple-card border border-white/60">
                 <div className="w-16 h-16 bg-blue-50 rounded-full flex items-center justify-center mx-auto mb-4 text-system-blue">
                     <SparklesIcon className="w-8 h-8 animate-pulse" />
                 </div>
                 <h3 className="text-lg font-bold text-gray-900">Auditing Job Description</h3>
                 <p className="text-gray-500 text-sm mt-2 max-w-md mx-auto">Gemini is checking for bias, clarity, and market competitiveness...</p>
            </div>
          ) : jdAnalysis ? (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-10 animate-scale-in">
                <div className="bg-white p-8 rounded-3xl shadow-apple-card border border-white/60">
                    <div className="flex items-center justify-between mb-6">
                        <h3 className="text-xl font-bold text-gray-900">Analysis</h3>
                        <div className="bg-gray-100 text-xs font-bold px-3 py-1 rounded-full uppercase tracking-wide">AI Audit</div>
                    </div>
                    <div className="space-y-6">
                        <div className="space-y-2">
                            <div className="flex justify-between text-sm font-medium"><span>Clarity</span> <span>{jdAnalysis.clarity_score}/100</span></div>
                            <div className="h-2 bg-gray-100 rounded-full"><div className="h-full bg-system-green rounded-full" style={{width: `${jdAnalysis.clarity_score}%`}}></div></div>
                        </div>
                        <div className="space-y-2">
                            <div className="flex justify-between text-sm font-medium"><span>Bias Level</span> <span>{jdAnalysis.bias_score}/100</span></div>
                            <div className="h-2 bg-gray-100 rounded-full"><div className="h-full bg-system-red rounded-full" style={{width: `${jdAnalysis.bias_score}%`}}></div></div>
                        </div>
                    </div>
                    <div className="mt-8 p-4 bg-red-50 rounded-2xl border border-red-100">
                        <h4 className="font-bold text-red-900 text-sm mb-2">Red Flag Terms</h4>
                        <div className="flex flex-wrap gap-2">
                            {jdAnalysis.red_flags_in_jd?.map((f, i) => <span key={i} className="px-2 py-1 bg-white rounded-md text-xs text-red-600 border border-red-100 shadow-sm">{f}</span>)}
                        </div>
                    </div>
                </div>
                <div className="bg-gradient-to-br from-indigo-900 to-purple-900 text-white p-8 rounded-3xl shadow-2xl flex flex-col">
                    <div className="flex justify-between items-center mb-4">
                        <h3 className="text-xl font-bold opacity-90">Optimized Description</h3>
                        <button 
                            onClick={handleCopyJD}
                            className="flex items-center gap-2 px-3 py-1.5 bg-white/10 hover:bg-white/20 rounded-lg text-xs font-medium transition-all text-white border border-white/10"
                        >
                            {jdCopied ? (
                                <>
                                    <span className="text-green-300">✓</span> Copied
                                </>
                            ) : (
                                <>
                                    <ClipboardIcon className="w-3.5 h-3.5" /> Copy
                                </>
                            )}
                        </button>
                    </div>
                    <div className="prose prose-invert prose-sm max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
                        <pre className="whitespace-pre-wrap font-sans opacity-80">{jdAnalysis.rewritten_jd}</pre>
                    </div>
                </div>
            </div>
          ) : null
      )}

      {activeTab === 'dashboard' && (
        <>
          <div 
            onClick={() => fileInputRef.current?.click()}
            className="group border-2 border-dashed border-gray-200 hover:border-system-blue/50 rounded-3xl p-10 text-center bg-gray-50/50 hover:bg-blue-50/30 transition-all cursor-pointer mb-8"
          >
            <div className="w-14 h-14 bg-white rounded-2xl shadow-sm flex items-center justify-center mx-auto mb-4 group-hover:scale-110 transition-transform">
                <UploadIcon className="w-6 h-6 text-system-blue" />
            </div>
            <h3 className="text-lg font-bold text-gray-900">Import Candidates</h3>
            <p className="text-gray-500 text-sm mt-1">PDF or Text files supported</p>
            <input type="file" multiple ref={fileInputRef} className="hidden" onChange={handleFileUpload} accept=".pdf,.jpg,.png,.txt" />
          </div>

          {/* Bulk Actions Bar */}
          {selectedIds.size > 0 && (
            <div className="mb-6 bg-gray-900 text-white p-4 rounded-2xl shadow-lg flex items-center justify-between animate-[scaleIn_0.2s_ease-out]">
                <div className="flex items-center gap-4">
                    <div className="bg-white/20 text-white text-xs font-bold px-3 py-1 rounded-full border border-white/10">
                        {selectedIds.size} Selected
                    </div>
                    <span className="text-sm text-gray-300 font-medium">Candidates ready for action</span>
                </div>
                <div className="flex items-center gap-3">
                    <button 
                        onClick={handleDeselectAll}
                        className="px-4 py-2 text-sm font-semibold text-gray-400 hover:text-white transition-colors"
                    >
                        Deselect All
                    </button>
                    <button 
                        onClick={handleBulkEmail}
                        className="px-5 py-2 bg-white text-gray-900 rounded-xl text-sm font-bold hover:bg-gray-100 transition-colors flex items-center gap-2 shadow-sm"
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="4" width="20" height="16" rx="2"></rect><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"></path></svg>
                        Bulk Email
                    </button>
                </div>
            </div>
          )}

          {candidates.length > 0 && (
              <div className="bg-white rounded-3xl shadow-apple-card border border-white/60 overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
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
                                                    <span className="text-xs font-semibold">Analyzing...</span>
                                                </div>
                                            ) : c.status === 'error' ? (
                                                <div className="flex items-center gap-2">
                                                    <span className="text-xs text-red-500 font-medium bg-red-50 px-2 py-1 rounded">Failed</span>
                                                    <button 
                                                        onClick={(e) => { e.stopPropagation(); handleReanalyze(c); }}
                                                        className="text-xs text-system-blue hover:text-blue-700 font-medium bg-blue-50 px-2 py-1 rounded transition-colors"
                                                    >
                                                        Retry
                                                    </button>
                                                </div>
                                            ) : c.analysis ? (
                                                <span className={`text-sm font-bold px-2 py-1 rounded-md ${c.analysis.match_score >= 80 ? 'bg-green-50 text-green-700' : 'bg-gray-100 text-gray-600'}`}>{c.analysis.match_score}%</span>
                                            ) : (
                                                <span className="text-xs text-gray-400">Queued</span>
                                            )}
                                        </td>
                                        <td className="p-5 text-sm text-gray-500">{c.analysis?.potential_score || '-'}</td>
                                        <td className="p-5 text-sm text-gray-500">{c.analysis?.years_experience ? `${c.analysis.years_experience}y` : '-'}</td>
                                        <td className="p-5 text-right pr-8">
                                            <button 
                                                onClick={() => handleOpenCandidate(c)}
                                                disabled={c.status !== 'analyzed'}
                                                className="text-system-blue text-sm font-semibold transition-opacity disabled:opacity-0"
                                            >
                                                View &rarr;
                                            </button>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
              </div>
          )}
        </>
      )}

      {/* Email Modal */}
      {showEmailModal && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
              <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setShowEmailModal(false)}></div>
              <div className="bg-white rounded-3xl shadow-2xl w-full max-w-2xl relative z-10 overflow-hidden animate-[scaleIn_0.2s_ease-out]">
                  <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
                      <h3 className="text-xl font-bold text-gray-900">Bulk Email Shortlist</h3>
                      <button onClick={() => setShowEmailModal(false)} className="p-2 hover:bg-gray-200 rounded-full transition-colors text-gray-500">
                         <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                      </button>
                  </div>
                  
                  <div className="p-6 space-y-6">
                      {/* Recipients Preview */}
                      <div className="bg-gray-50 p-4 rounded-xl border border-gray-200">
                          <div className="flex justify-between items-center mb-2">
                            <label className="text-xs font-bold uppercase text-gray-400 block">Recipients (BCC)</label>
                            <button
                                onClick={() => {
                                    // Clean email extraction: removing .pdf artefacts from mock email generation
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

                  <div className="p-6 border-t border-gray-100 flex justify-end gap-3 bg-gray-50/50 relative">
                      {allEmailsCopied && (
                          <div className="absolute left-6 bottom-6 bg-gray-900 text-white text-xs font-medium py-2 px-4 rounded-full shadow-lg animate-[fadeIn_0.2s_ease-out]">
                              All email addresses copied to clipboard.
                          </div>
                      )}
                      <button 
                        onClick={() => setShowEmailModal(false)}
                        className="px-6 py-2.5 text-sm font-semibold text-gray-600 hover:text-gray-900"
                      >
                          Cancel
                      </button>
                      <button 
                         onClick={() => {
                             navigator.clipboard.writeText(`${subject}\n\n${body}`);
                             setEmailCopied(true);
                             setTimeout(() => setEmailCopied(false), 2000);
                         }}
                         className="px-6 py-2.5 bg-white border border-gray-200 text-gray-900 rounded-full text-sm font-bold hover:bg-gray-50 transition-colors flex items-center gap-2"
                      >
                         {emailCopied ? <span className="text-green-600">Copied!</span> : 'Copy Draft'}
                      </button>
                      <a 
                          href={gmailLink}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="px-6 py-2.5 bg-system-blue text-white rounded-full text-sm font-bold hover:bg-blue-600 shadow-lg shadow-blue-500/20 transition-all transform hover:scale-105 active:scale-95 flex items-center gap-2"
                      >
                          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor"><path d="M24 5.457v13.909c0 .904-.732 1.636-1.636 1.636h-3.819V11.73L12 16.64l-6.545-4.91v9.273H1.636A1.636 1.636 0 0 1 0 19.366V5.457c0-2.023 2.309-3.178 3.927-1.964L5.455 4.64 12 9.548l6.545-4.91 1.528-1.145C21.69 2.28 24 3.434 24 5.457z"></path></svg>
                          Open in Gmail
                      </a>
                  </div>
              </div>
          </div>
      )}

      {/* iOS Sheet Modal for Candidate Details */}
      {selectedCandidate && selectedCandidate.analysis && !showEmailModal && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:p-6">
            <div className="absolute inset-0 bg-black/20 backdrop-blur-sm" onClick={() => setSelectedCandidateId(null)}></div>
            <div className="relative w-full max-w-5xl h-[92vh] sm:h-[85vh] bg-white rounded-t-3xl sm:rounded-3xl shadow-2xl flex flex-col overflow-hidden animate-[translateY_0.3s_ease-out]">
                {/* Header */}
                <div className="bg-white border-b border-gray-100 p-6 flex justify-between items-center z-10">
                    <div>
                        <h2 className="text-2xl font-bold text-gray-900 tracking-tight">{selectedCandidate.name}</h2>
                        <p className="text-gray-500 text-sm mt-1">{selectedCandidate.analysis.seniority_level} • {selectedCandidate.analysis.years_experience} Years</p>
                    </div>
                    <button onClick={() => setSelectedCandidateId(null)} className="p-2 bg-gray-100 rounded-full hover:bg-gray-200 transition-colors">
                        <svg className="w-5 h-5 text-gray-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                    </button>
                </div>

                <div className="flex border-b border-gray-100 bg-gray-50/50">
                    {['profile', 'clean', 'interview'].map((t) => (
                        <button 
                            key={t}
                            onClick={() => { setModalTab(t as any); if(t === 'clean') handleLoadCleanResume(); if(t === 'interview') handleLoadInterview(); }}
                            className={`flex-1 py-4 text-sm font-semibold capitalize border-b-2 transition-all ${modalTab === t ? 'border-system-blue text-system-blue bg-white' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
                        >
                            {t}
                        </button>
                    ))}
                </div>

                <div className="flex-1 overflow-y-auto bg-[#F9F9FB] p-8">
                     {modalTab === 'profile' && (
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                            <div className="md:col-span-2 space-y-6">
                                <div className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100">
                                    <h4 className="text-xs font-bold uppercase text-gray-400 mb-4">Executive Summary</h4>
                                    <p className="text-gray-800 leading-relaxed text-lg">{selectedCandidate.analysis.summary}</p>
                                </div>
                                <div className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100">
                                    <h4 className="text-xs font-bold uppercase text-gray-400 mb-4">Key Strengths</h4>
                                    <div className="flex flex-wrap gap-2">
                                        {selectedCandidate.analysis.strengths.map((s,i) => <span key={i} className="bg-blue-50 text-blue-700 px-3 py-1.5 rounded-lg text-sm font-medium">{s}</span>)}
                                    </div>
                                </div>
                                {/* Cross Domain Card */}
                                {renderCrossDomainCard()}
                            </div>
                            <div className="space-y-6">
                                <div className="bg-gradient-to-br from-system-blue to-blue-600 text-white p-6 rounded-3xl shadow-lg">
                                    <div className="text-blue-100 text-sm font-medium mb-1">Match Score</div>
                                    <div className="text-5xl font-bold tracking-tight mb-6">{selectedCandidate.analysis.match_score}%</div>
                                    <div className="text-blue-100 text-sm font-medium mb-1">Potential</div>
                                    <div className="text-3xl font-bold tracking-tight opacity-90">{selectedCandidate.analysis.potential_score}%</div>
                                </div>
                                <div className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100">
                                    <h4 className="text-xs font-bold uppercase text-gray-400 mb-4">Training Effort</h4>
                                    <p className="text-gray-900 font-medium">{selectedCandidate.analysis.training_estimate}</p>
                                </div>
                            </div>
                        </div>
                     )}
                     
                     {modalTab === 'clean' && (
                         <div className="max-w-3xl mx-auto bg-white p-12 shadow-sm rounded-xl min-h-full">
                             {isLoadingModal ? (
                                <div className="flex justify-center py-20">
                                    <div className="w-8 h-8 border-2 border-system-blue border-t-transparent rounded-full animate-spin"></div>
                                </div>
                             ) : modalError ? (
                                <p className="text-center text-red-500 py-20">{modalError}</p>
                             ) : (
                                <pre className="whitespace-pre-wrap font-serif text-gray-800 leading-7">{cleanResume}</pre>
                             )}
                         </div>
                     )}

                     {modalTab === 'interview' && (
                         <div className="max-w-3xl mx-auto space-y-6">
                             {isLoadingModal ? (
                                 <div className="flex flex-col items-center justify-center py-20">
                                     <div className="w-8 h-8 border-2 border-system-blue border-t-transparent rounded-full animate-spin mb-4"></div>
                                     <p className="text-gray-400 font-medium">Drafting custom interview script...</p>
                                 </div>
                             ) : modalError ? (
                                <div className="text-center py-20 bg-white rounded-3xl shadow-sm border border-red-100">
                                    <div className="w-12 h-12 bg-red-50 rounded-full flex items-center justify-center mx-auto mb-4 text-red-500">⚠️</div>
                                    <p className="text-gray-800 font-medium mb-4">{modalError}</p>
                                    <button 
                                        onClick={handleLoadInterview}
                                        className="px-6 py-2 bg-system-blue text-white rounded-full font-medium hover:bg-blue-600 transition-colors"
                                    >
                                        Try Again
                                    </button>
                                </div>
                             ) : interviewScript && (
                                 <>
                                    <div className="bg-indigo-50 border border-indigo-100 p-6 rounded-2xl animate-scale-in">
                                        <h4 className="font-bold text-indigo-900 mb-2">Recommendation</h4>
                                        <p className="text-indigo-800 leading-relaxed">{interviewScript.recommendation_template}</p>
                                    </div>
                                    {interviewScript.questions.map((q, i) => (
                                        <div key={i} className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 animate-scale-in" style={{animationDelay: `${i * 100}ms`}}>
                                            <span className="text-[10px] font-bold uppercase bg-gray-100 text-gray-500 px-2 py-1 rounded mb-3 inline-block">{q.type}</span>
                                            <h4 className="font-bold text-lg text-gray-900 mb-4">{q.question}</h4>
                                            <div className="text-sm bg-green-50/50 p-4 rounded-xl border border-green-50 text-gray-700">
                                                <span className="font-bold text-green-700 block mb-1">Look for:</span> {q.expected_answer}
                                            </div>
                                        </div>
                                    ))}
                                 </>
                             )}
                         </div>
                     )}
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
               <span className="text-xs font-medium text-gray-400">{jobDescription.length} chars</span>
               <button
                onClick={() => setIsJDMaximized(false)}
                className="px-6 py-2 bg-gray-900 text-white text-sm font-semibold rounded-full hover:bg-gray-800 transition-colors shadow-lg"
              >
                Done
              </button>
            </div>
          </div>
          <div className="flex-1 overflow-y-auto bg-gray-50 p-6 sm:p-10">
             <div className="max-w-4xl mx-auto bg-white shadow-sm min-h-full p-12">
                <textarea
                  autoFocus
                  value={jobDescription}
                  onChange={(e) => setJobDescription(e.target.value)}
                  placeholder="Paste Job Description..."
                  className="w-full h-full min-h-[80vh] resize-none outline-none text-lg leading-relaxed text-gray-800 font-sans"
                />
             </div>
          </div>
        </div>
      )}
    </div>
  );
};
