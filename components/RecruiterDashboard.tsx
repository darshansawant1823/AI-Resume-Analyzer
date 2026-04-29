
import React, { useState, useRef, useEffect, useMemo } from 'react';
import { User } from 'firebase/auth';
import { useRecruiterData } from '../src/hooks/useRecruiterData';
import type { Candidate, CandidateAnalysis, JDAnalysis, InterviewScript, CrossDomainAnalysis, TransferDomain } from '../types';
// Add extractTextFromFile to the imported services
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { ChevronRight, AlertTriangle, RefreshCw, Clock, Trash2, Save, Bookmark, User as UserIcon } from 'lucide-react';
import { motion } from 'framer-motion';
import { analyzeCandidate, analyzeJobDescription, simplifyResume, generateInterviewScript, performCrossDomainAnalysis, extractTextFromFile, performFlashScan } from '../services/geminiService';
import { UploadIcon } from './icons/UploadIcon';
import { SparklesIcon } from './icons/SparklesIcon';
import { ClipboardIcon } from './icons/ClipboardIcon';
import { DownloadIcon } from './icons/DownloadIcon';
import { MaximizeIcon } from './icons/MaximizeIcon';
import { CompareProfiles } from './CompareProfiles';
import { RecruiterChatView } from './RecruiterChatView';
import { ScoreCard } from './ScoreCard';
import { BreakdownAccordion } from './BreakdownAccordion';

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
  const { candidates: persistedCandidates, saveCandidate, deleteCandidate, saveJDAnalysis, archiveAllCandidates, saveProject, updateProject, toggleShortlist, projects } = useRecruiterData(user);
  const [activeTab, setActiveTab] = useState<'dashboard' | 'jd-audit'>('dashboard');
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
      // 1. Keep local candidates that are NOT in persistedCandidates (meaning they are new uploads)
      const localOnly = prev.filter(c => !persistedCandidates.some(pc => pc.id === c.id) && !!c.file);
      
      // 2. Map persisted candidates, preserving File objects from current state if they exist
      const updatedPersisted = persistedCandidates.map(pc => {
        const existing = prev.find(c => c.id === pc.id);
        return { ...pc, file: existing?.file || pc.file };
      });
      
      return [...updatedPersisted, ...localOnly];
    });
  }, [persistedCandidates]);
  const [selectedCandidateId, setSelectedCandidateId] = useState<string | null>(null);
  
  const [jdAnalysis, setJdAnalysis] = useState<JDAnalysis | null>(null);
  const [isAnalyzingJd, setIsAnalyzingJd] = useState(false);
  const [jdCopied, setJdCopied] = useState(false);
  const [isJDMaximized, setIsJDMaximized] = useState(false);
  const [biasFreeMode, setBiasFreeMode] = useState(false);
  const [topPickFilter, setTopPickFilter] = useState(false);
  const [topPicksCount, setTopPicksCount] = useState(3);
  const [showTopPicksDropdown, setShowTopPicksDropdown] = useState(false);

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
  const [emailSubject, setEmailSubject] = useState('');
  const [emailBody, setEmailBody] = useState('');
  const [emailTemplate, setEmailTemplate] = useState<'invite' | 'reject' | 'more-info'>('invite');
  
  // Toast for Compare Limit
  const [showCompareToast, setShowCompareToast] = useState(false);
  const [showShortlistToast, setShowShortlistToast] = useState(false);
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [isChatPanelOpen, setIsChatPanelOpen] = useState(false);
  const [currentProjectId, setCurrentProjectId] = useState<string | null>(null);

  // Delete Confirmation State
  const [candidateToDelete, setCandidateToDelete] = useState<Candidate | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  // Track auto-selected candidates to prevent re-selecting after user deselects
  const autoSelectedRef = useRef<Set<string>>(new Set());

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Auto-analyze JD when it changes (debounced)
  useEffect(() => {
    if (!jobDescription || jobDescription.trim().length < 50) return;
    
    const timer = setTimeout(() => {
      handleAnalyzeJD();
    }, 2000);

    return () => clearTimeout(timer);
  }, [jobDescription]);

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
 
            // Trigger Flash Scan for immediate feedback (fire and forget)
            performFlashScan(jd, payload).then(flashScan => {
              setCandidates(prev => prev.map(c => c.id === candidate.id ? { ...c, flashScan } : c));
            }).catch(err => console.error("Flash scan failed:", err));
 
            // Full analysis (multimodal)
            const analysis = await analyzeCandidate(jd, payload);
            
            // Store the extracted text in candidate for chat context
            const updatedCandidate: Candidate = { 
              ...candidate, 
              status: 'analyzed' as const, 
              analysis, 
              extractedText: analysis.extracted_text || candidate.extractedText
            };
            setCandidates(prev => prev.map(c => c.id === candidate.id ? updatedCandidate : c));
            await saveCandidate(updatedCandidate);

            // Update current project if exists
            if (user && currentProjectId) {
              const currentProject = projects.find(p => p.id === currentProjectId);
              if (currentProject) {
                const newCandidateIds = Array.from(new Set([...(currentProject.candidateIds || []), updatedCandidate.id]));
                await updateProject(currentProjectId, { candidateIds: newCandidateIds });
              }
            }
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
      const currentCount = candidates.length;
      if (currentCount >= 10) {
        alert("Maximum limit of 10 resumes per screening reached. Please clear candidates or start a new session to add more.");
        return;
      }

      let newFiles: File[] = Array.from(e.target.files);
      
      // Filter out duplicates within the current session
      const duplicates: string[] = [];
      newFiles = newFiles.filter(file => {
          const isDuplicate = candidates.some(c => c.name === file.name);
          if (isDuplicate) duplicates.push(file.name);
          return !isDuplicate;
      });

      if (duplicates.length > 0) {
          const message = duplicates.length === 1 
            ? `The resume "${duplicates[0]}" is already uploaded.`
            : `${duplicates.length} resumes are already uploaded: ${duplicates.join(', ')}`;
          alert(message);
      }

      if (newFiles.length === 0) return;

      if (currentCount + newFiles.length > 10) {
        alert(`Limit reached: Only 10 resumes allowed per screening. Adding the first ${10 - currentCount} resumes from your selection.`);
        newFiles = newFiles.slice(0, 10 - currentCount);
      }

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
      
      // Process in parallel with a small stagger to avoid immediate burst rejection
      // We use a map to create a list of promises and then await them all
      await Promise.all(newCandidates.map(async (candidate, index) => {
        // Stagger starts by 500ms each to be gentle on the API
        await new Promise(resolve => setTimeout(resolve, index * 500));
        return processCandidate(candidate, jobDescription);
      }));
    }
  };

  const handleDeleteCandidate = async (id: string) => {
    // Optimistic update
    setCandidates(prev => prev.filter(c => c.id !== id));
    setSelectedIds(prev => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
    
    try {
      await deleteCandidate(id);
    } catch (err) {
      console.error("Failed to delete candidate:", err);
    }
  };

  const confirmDeleteSelected = async () => {
    const idsToDelete = Array.from(selectedIds);
    // Optimistic update
    setCandidates(prev => prev.filter(c => !selectedIds.has(c.id)));
    setSelectedIds(new Set());
    setShowClearConfirm(false);
    
    try {
      await Promise.all(idsToDelete.map(id => deleteCandidate(id)));
    } catch (err) {
      console.error("Bulk delete failed:", err);
    }
  };

  const handleAnalyzeAll = async () => {
    if (!jobDescription) return;
    const pending = candidates.filter(c => c.status === 'pending' || c.status === 'error');
    for (const c of pending) {
      await processCandidate(c, jobDescription);
    }
  };

  const handleReanalyze = async (candidate: Candidate) => {
      if (!jobDescription) return;
      await processCandidate(candidate, jobDescription);
  };

  const handleShortlistSelected = async () => {
    if (selectedIds.size === 0 || !user) return;
    
    // Intelligently name the Job Title
    let title = jdAnalysis?.jobTitle;
    if (!title && jobDescription) {
        try {
            const analysis = await analyzeJobDescription(jobDescription);
            title = analysis.jobTitle;
            setJdAnalysis(analysis);
        } catch (e) {
            title = "Untitled Recruitment Project";
        }
    }
    if (!title) title = "Recruitment Project";

    // Mark selected candidates as shortlisted individually
    const selectedCandidatesList = candidates.filter(c => selectedIds.has(c.id));
    for (const c of selectedCandidatesList) {
      if (!c.isShortlisted) {
        await toggleShortlist(c.id);
      }
    }
    
    // Create a project for this recruitment session
    await saveProject({
      name: title,
      jobTitle: title,
      jd: jobDescription,
      jdAnalysis: jdAnalysis,
      candidateIds: Array.from(selectedIds),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    });
    
    // Show feedback
    setShowShortlistToast(true);
    setTimeout(() => setShowShortlistToast(false), 3000);
    
    // Clear selection
    setSelectedIds(new Set());
  };

  const handleToggleShortlist = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    await toggleShortlist(id);
  };

  useEffect(() => {
    setCurrentPage(1);
  }, [candidates.length]);

  const Pagination = ({ currentPage, totalItems, onPageChange }: { currentPage: number, totalItems: number, onPageChange: (page: number) => void }) => {
    const totalPages = Math.ceil(totalItems / itemsPerPage);
    if (totalPages <= 1) return null;

    return (
      <div className="flex items-center justify-center gap-2 p-6 border-t border-gray-100 bg-gray-50/30">
        <button
          onClick={() => onPageChange(Math.max(1, currentPage - 1))}
          disabled={currentPage === 1}
          className="p-2 rounded-xl hover:bg-white disabled:opacity-30 disabled:cursor-not-allowed transition-all border border-transparent hover:border-gray-200"
        >
          <ChevronRight className="w-4 h-4 text-gray-600 rotate-180" />
        </button>
        <div className="flex items-center gap-1">
          {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
            <button
              key={page}
              onClick={() => onPageChange(page)}
              className={`w-8 h-8 rounded-xl text-xs font-bold transition-all ${
                currentPage === page
                  ? 'bg-system-blue text-white shadow-lg shadow-blue-200'
                  : 'text-gray-500 hover:bg-white border border-transparent hover:border-gray-200'
              }`}
            >
              {page}
            </button>
          ))}
        </div>
        <button
          onClick={() => onPageChange(Math.min(totalPages, currentPage + 1))}
          disabled={currentPage === totalPages}
          className="p-2 rounded-xl hover:bg-white disabled:opacity-30 disabled:cursor-not-allowed transition-all border border-transparent hover:border-gray-200"
        >
          <ChevronRight className="w-4 h-4 text-gray-600" />
        </button>
      </div>
    );
  };

  const sortedCandidates = useMemo(() => {
    return [...candidates].sort((a, b) => {
      const dateA = new Date(a.createdAt || 0).getTime();
      const dateB = new Date(b.createdAt || 0).getTime();
      return dateA - dateB;
    });
  }, [candidates]);
  
  const filteredCandidates = sortedCandidates.filter((c, idx) => {
    // Always show pending/processing/error candidates so the user sees progress
    if (c.status !== 'analyzed') return true;
    
    if (topPickFilter && idx >= topPicksCount) return false;
    return true;
  });

  // Automatically select Top Picks when they are analyzed or count changes
  useEffect(() => {
    if (candidates.length === 0) return;

    const newSelection = new Set(selectedIds);
    let changed = false;

    // If top pick filter is active, we should ensure the top N are selected
    // but only if they are analyzed.
    sortedCandidates.forEach((c, idx) => {
      if (idx < topPicksCount && c.status === 'analyzed') {
        if (!selectedIds.has(c.id)) {
          newSelection.add(c.id);
          changed = true;
        }
      }
    });

    if (changed) {
      setSelectedIds(newSelection);
    }
  }, [candidates.map(c => c.status).join(','), sortedCandidates.length, topPicksCount]);

  const handleAnalyzeJD = async () => {
    if(!jobDescription) return;
    setIsAnalyzingJd(true);
    setJdAnalysis(null);
    try {
      const result = await analyzeJobDescription(jobDescription);
      setJdAnalysis(result);
      if (user) {
        await saveJDAnalysis(jobDescription, result);
        if (result.jobTitle) {
          const pid = await saveProject({
            name: result.jobTitle,
            jobTitle: result.jobTitle,
            jd: jobDescription,
            jdAnalysis: result,
            candidateIds: [],
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
          });
          if (pid) setCurrentProjectId(pid);
        }
      }
    } catch (e) { alert("Failed to analyze JD"); } finally { setIsAnalyzingJd(false); }
  }

  const handleCopyJD = () => {
      if (!jdAnalysis?.rewritten_jd) return;
      navigator.clipboard.writeText(jdAnalysis.rewritten_jd);
      setJdCopied(true);
      setTimeout(() => setJdCopied(false), 2000);
  };

  const handleVerify = async (candidateId: string) => {
    const candidate = candidates.find(c => c.id === candidateId);
    if (!candidate) return;
    
    const updatedCandidate = { ...candidate, isVerified: !candidate.isVerified };
    setCandidates(prev => prev.map(c => c.id === candidateId ? updatedCandidate : c));
    await saveCandidate(updatedCandidate);
  };

  const handleOpenCandidate = async (candidate: Candidate) => {
      if (candidate.status !== 'analyzed') return;
      setSelectedCandidateId(candidate.id);
      setCleanResume(candidate.cleanResume || null); 
      setInterviewScript(candidate.interviewScript || null); 
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
        if (candidate.file) {
            if (candidate.file.type.startsWith('image/') || candidate.file.type === 'application/pdf') {
                const { base64Data, mimeType } = await fileToBase64(candidate.file);
                payload = { base64Data, mimeType };
            } else {
                const text = await candidate.file.text();
                payload = { text };
            }
        } else if (candidate.extractedText) {
            payload = { text: candidate.extractedText };
        } else {
            throw new Error("No resume content available for analysis.");
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
      const { subject, body } = getEmailDraft('invite');
      setEmailSubject(subject);
      setEmailBody(body);
      setEmailTemplate('invite');
      setShowEmailModal(true);
  };

  const handleTemplateChange = (template: 'invite' | 'reject' | 'more-info') => {
      const { subject, body } = getEmailDraft(template);
      setEmailSubject(subject);
      setEmailBody(body);
      setEmailTemplate(template);
  };

  const getEmailDraft = (template: 'invite' | 'reject' | 'more-info') => {
    const selectedEmails = sortedCandidates
        .filter(c => selectedIds.has(c.id))
        .map(c => c.analysis?.email || (c.name.toLowerCase().replace(/\s/g, '.').replace('.pdf', '') + '@example.com'));

    let subject = '';
    let body = '';

    if (template === 'invite') {
        subject = `Interview Invitation: ${jobDescription.split(' ').slice(0, 4).join(' ')}...`;
        body = `Hi [Candidate Name],\n\nI hope you're having a great week.\n\nI'm reaching out from [Company Name] regarding your application. We've reviewed your profile and were impressed by your experience and strong alignment with our requirements.\n\nYour background stands out, and we'd love to discuss how your skills could translate to success in this role.\n\nAre you available for a brief 15-minute chat later this week to discuss next steps?\n\nBest regards,\n[Your Name]`;
    } else if (template === 'reject') {
        subject = `Application Update: ${jobDescription.split(' ').slice(0, 4).join(' ')}...`;
        body = `Hi [Candidate Name],\n\nThank you for your interest in the position at [Company Name].\n\nAfter careful consideration, we have decided to move forward with other candidates whose experience more closely aligns with our current needs.\n\nWe appreciate the time you took to apply and wish you the best in your job search.\n\nBest regards,\n[Your Name]`;
    } else {
        subject = `Information Request: ${jobDescription.split(' ').slice(0, 4).join(' ')}...`;
        body = `Hi [Candidate Name],\n\nI hope you're doing well.\n\nI'm reviewing your application for the position at [Company Name] and had a few follow-up questions regarding your experience with [Specific Skill/Project].\n\nCould you please provide a bit more detail on this when you have a moment?\n\nLooking forward to hearing from you.\n\nBest regards,\n[Your Name]`;
    }

    return { subject, body, emails: selectedEmails };
  };

  const handleCompare = () => {
      setViewMode('compare');
  };

  const handleChat = () => {
    setViewMode('chat');
  };

  const selectedCandidate = candidates.find(c => c.id === selectedCandidateId);

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

  const selectedCandidates = useMemo(() => 
    candidates.filter(c => selectedIds.has(c.id)),
  [candidates, selectedIds]);

  if (viewMode === 'compare') {
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
            <div className="flex-1">
              <div className="flex items-center gap-3">
                <h2 className="text-xl sm:text-2xl font-bold text-gray-900 tracking-tight">{selectedCandidate.name}</h2>
                <button 
                  onClick={() => handleVerify(selectedCandidate.id)}
                  className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider transition-all ${
                    selectedCandidate.isVerified 
                      ? 'bg-system-green text-white shadow-lg shadow-green-100' 
                      : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                  }`}
                >
                  {selectedCandidate.isVerified ? (
                    <>
                      <svg xmlns="http://www.w3.org/2000/svg" className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
                      Verified
                    </>
                  ) : (
                    'Verify Analysis'
                  )}
                </button>
              </div>
              <div className="flex flex-wrap items-center gap-2 mt-1">
                <span className="text-xs font-bold px-2 py-0.5 bg-blue-50 text-system-blue rounded-md uppercase tracking-wider">
                  {selectedCandidate.analysis.seniority_level}
                </span>
                <span className="text-gray-400 text-xs sm:text-sm font-medium">
                  {selectedCandidate.analysis.years_experience} Years Experience
                </span>
                <span className="w-1 h-1 bg-gray-300 rounded-full mx-1"></span>
                <span className="text-xs font-bold text-gray-500 uppercase tracking-widest">
                  {selectedCandidate.analysis.category}
                </span>
              </div>
            </div>
          </div>
          <div className="hidden sm:flex items-center gap-3">
             <button 
                onClick={() => {
                    if (!selectedCandidate.analysis) return;
                    const doc = new jsPDF();
                    const analysis = selectedCandidate.analysis;

                    // Header
                    doc.setFontSize(22);
                    doc.setTextColor(0, 122, 255); // System Blue
                    doc.text('Candidate Analysis Report', 20, 20);
                    
                    doc.setFontSize(10);
                    doc.setTextColor(150, 150, 150);
                    doc.text(`Generated by ResumeAI Intelligence • ${new Date().toLocaleDateString()}`, 20, 28);

                    // Candidate Info
                    doc.setFontSize(18);
                    doc.setTextColor(0, 0, 0);
                    doc.text(selectedCandidate.name, 20, 45);
                    
                    doc.setFontSize(11);
                    doc.setTextColor(100, 100, 100);
                    doc.text(`${analysis.seniority_level} • ${analysis.years_experience} Years Experience • ${analysis.category}`, 20, 52);

                    // Score Summary Card
                    doc.setDrawColor(230, 230, 230);
                    doc.setFillColor(249, 249, 251);
                    doc.roundedRect(20, 60, 170, 30, 3, 3, 'FD');
                    
                    doc.setFontSize(9);
                    doc.setTextColor(150, 150, 150);
                    doc.text('MATCH SCORE', 35, 72);
                    doc.text('POTENTIAL', 110, 72);
                    
                    doc.setFontSize(22);
                    doc.setTextColor(0, 122, 255);
                    doc.text(`${analysis.match_score}%`, 35, 82);
                    doc.text(`${analysis.potential_score}%`, 110, 82);

                    // Executive Summary
                    doc.setFontSize(14);
                    doc.setTextColor(0, 122, 255);
                    doc.text('Executive Summary', 20, 105);
                    
                    doc.setFontSize(10);
                    doc.setTextColor(60, 60, 60);
                    const summaryLines = doc.splitTextToSize(analysis.summary, 170);
                    doc.text(summaryLines, 20, 112);
                    
                    let currentY = 112 + (summaryLines.length * 5) + 10;

                    // Strengths & Gaps
                    autoTable(doc, {
                      startY: currentY,
                      head: [['Key Strengths', 'Identified Gaps']],
                      body: [
                        [
                          analysis.strengths.map(s => `• ${s}`).join('\n'),
                          analysis.gaps.map(g => `• ${g}`).join('\n')
                        ]
                      ],
                      theme: 'grid',
                      headStyles: { fillColor: [0, 122, 255], textColor: [255, 255, 255], fontStyle: 'bold' },
                      styles: { fontSize: 9, cellPadding: 5, overflow: 'linebreak' },
                      columnStyles: {
                        0: { cellWidth: 85 },
                        1: { cellWidth: 85 }
                      }
                    });

                    currentY = (doc as any).lastAutoTable.finalY + 15;

                    // Score Breakdown
                    doc.setFontSize(14);
                    doc.setTextColor(0, 122, 255);
                    doc.text('Score Breakdown', 20, currentY);
                    
                    const breakdownData = [
                      ['Core Skills', `${analysis.breakdown.core_skills.score}/30`],
                      ['Title Alignment', `${analysis.breakdown.title_alignment.score}/20`],
                      ['Experience Relevance', `${analysis.breakdown.experience_relevance.score}/15`],
                      ['Achievements', `${analysis.breakdown.achievements.score}/10`],
                      ['ATS Readiness', `${analysis.breakdown.ats_readiness.score}/10`],
                      ['Soft Skills', `${analysis.breakdown.soft_skills.score}/5`],
                      ['Growth Potential', `${analysis.breakdown.growth_potential.score}/10`]
                    ];

                    autoTable(doc, {
                      startY: currentY + 5,
                      head: [['Metric', 'Raw Score']],
                      body: breakdownData,
                      theme: 'striped',
                      headStyles: { fillColor: [245, 245, 247], textColor: [100, 100, 100], fontStyle: 'bold' },
                      styles: { fontSize: 9 }
                    });

                    doc.save(`${selectedCandidate.name.replace(/\s+/g, '_')}_Analysis_Report.pdf`);
                }}
                className="px-6 py-2.5 bg-white border border-gray-200 text-gray-900 rounded-full text-sm font-bold hover:bg-gray-50 transition-all shadow-sm flex items-center gap-2"
             >
                <DownloadIcon className="w-4 h-4" />
                Download Report
             </button>
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
                          <div key={i} className="flex flex-col gap-2 p-4 bg-green-50/50 rounded-2xl border border-green-100/50 group/strength">
                            <div className="flex items-start gap-3">
                              <span className="text-system-green font-bold">✓</span>
                              <span className="text-sm font-bold text-gray-900">{s}</span>
                            </div>
                            {selectedCandidate.analysis?.evidence?.[s] && (
                              <div className="ml-7 p-2 bg-white/60 rounded-xl border border-green-100/30">
                                <p className="text-[10px] text-gray-500 italic leading-relaxed">
                                  <span className="font-bold text-system-green not-italic mr-1">"</span>
                                  {selectedCandidate.analysis.evidence[s]}
                                  <span className="font-bold text-system-green not-italic ml-1">"</span>
                                </p>
                              </div>
                            )}
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
                  {/* Score Card - Small Version */}
                  <ScoreCard 
                    score={selectedCandidate.analysis.match_score} 
                    verdict={selectedCandidate.analysis.match_score >= 80 ? 'Eligible' : selectedCandidate.analysis.match_score >= 40 ? 'Borderline' : 'Not Eligible'} 
                    confidenceScore={selectedCandidate.analysis.confidence_score}
                    explanations={selectedCandidate.analysis.explanations || [selectedCandidate.analysis.summary]} 
                    size="sm"
                  />

                  {/* Breakdown Accordion */}
                  <BreakdownAccordion breakdown={selectedCandidate.analysis.breakdown as any} />

                  {/* Training Effort */}
                  <section className="bg-white p-6 sm:p-8 rounded-[2rem] shadow-apple-card border border-white/60">
                    <h4 className="text-[10px] font-bold uppercase tracking-[0.2em] text-gray-400 mb-6">Training Effort</h4>
                    <div className="flex items-center gap-4 p-4 bg-gray-50 rounded-2xl border border-gray-100">
                      <div className="w-10 h-10 bg-white rounded-xl shadow-sm flex items-center justify-center text-xl">⏱️</div>
                      <p className="text-gray-900 font-bold text-lg leading-tight">{selectedCandidate.analysis.training_estimate}</p>
                    </div>
                  </section>

                  {/* Interview Questions Upfront */}
                  <section className="bg-white p-6 sm:p-8 rounded-[2rem] shadow-apple-card border border-white/60">
                    <div className="flex justify-between items-center mb-6">
                      <h4 className="text-[10px] font-bold uppercase tracking-[0.2em] text-gray-400">Interview Prep</h4>
                      {interviewScript && (
                        <button 
                          onClick={() => setModalTab('interview')}
                          className="text-[10px] font-bold text-system-blue uppercase tracking-widest hover:underline"
                        >
                          View Full Script
                        </button>
                      )}
                    </div>
                    
                    {interviewScript ? (
                      <div className="space-y-4">
                        {interviewScript.questions.slice(0, 3).map((q, i) => (
                          <div key={i} className="p-4 bg-gray-50 rounded-2xl border border-gray-100 group/q">
                            <div className="flex items-center gap-2 mb-2">
                              <span className={`text-[8px] font-black uppercase px-2 py-0.5 rounded-md ${
                                q.type === 'technical' ? 'bg-blue-100 text-blue-700' :
                                q.type === 'behavioral' ? 'bg-purple-100 text-purple-700' :
                                q.type === 'risk-probe' ? 'bg-red-100 text-red-700' :
                                'bg-gray-100 text-gray-700'
                              }`}>
                                {q.type}
                              </span>
                            </div>
                            <p className="text-xs font-bold text-gray-900 leading-snug group-hover/q:text-system-blue transition-colors">
                              {q.question}
                            </p>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <button 
                        onClick={handleLoadInterview}
                        disabled={isLoadingModal}
                        className="w-full py-4 bg-system-blue/5 border border-dashed border-system-blue/30 rounded-2xl text-system-blue text-xs font-bold uppercase tracking-widest hover:bg-system-blue/10 transition-all flex flex-col items-center gap-2"
                      >
                        {isLoadingModal ? (
                          <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin"></div>
                        ) : (
                          <>
                            <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path></svg>
                            Generate Interview Questions
                          </>
                        )}
                      </button>
                    )}
                  </section>
                </div>
              </div>
            )}

            {modalTab === 'scan' && (
              <div className="max-w-5xl mx-auto pb-20 animate-scale-in">
                <RecruiterScan 
                  jobDescription={jobDescription} 
                  resumeFile={selectedCandidate.file} 
                  extractedText={selectedCandidate.extractedText}
                  user={user}
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
                    <div className="bg-white p-8 sm:p-10 rounded-[2.5rem] shadow-apple-card border border-white/60 relative overflow-hidden">
                      <h4 className="text-[10px] font-bold uppercase tracking-[0.2em] text-gray-400 mb-6">Hiring Recommendation</h4>
                      <p className="text-xl sm:text-2xl font-medium leading-relaxed font-serif italic text-gray-900">
                        "{interviewScript.recommendation_template}"
                      </p>
                    </div>

                    <div className="space-y-6">
                      <h3 className="text-xl font-bold text-gray-900 px-2">Interview Questions</h3>
                      {interviewScript.questions.map((q, i) => (
                        <div key={i} className="bg-white p-6 sm:p-10 rounded-[2rem] shadow-apple-card border border-white/60 group hover:shadow-apple-hover transition-all">
                          <div className="flex items-center justify-between mb-6">
                            <span className={`text-[10px] font-bold uppercase px-3 py-1 rounded-full tracking-wider ${
                              q.type === 'technical' ? 'bg-blue-50 text-blue-600' :
                              q.type === 'behavioral' ? 'bg-purple-50 text-purple-600' :
                              q.type === 'situational' ? 'bg-orange-50 text-orange-600' :
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
      
      {/* Hidden File Input */}
      <input 
        type="file" 
        ref={fileInputRef} 
        onChange={handleFileUpload} 
        multiple 
        accept=".pdf,.png,.jpg,.jpeg,.txt,.md" 
        className="hidden" 
      />

      {/* Top Controls */}
      <div className="flex items-center gap-1 bg-gray-200/50 p-1 rounded-xl w-full sm:w-fit mb-6 sm:mb-8 backdrop-blur-md overflow-x-auto">
        <button 
            onClick={() => setActiveTab('dashboard')}
            className={`flex-1 sm:flex-none px-4 sm:px-5 py-2 rounded-lg text-sm font-semibold whitespace-nowrap transition-all ${activeTab === 'dashboard' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
        >
            Candidate Screening
        </button>
        <button 
            onClick={() => setActiveTab('jd-audit')}
            className={`flex-1 sm:flex-none px-4 sm:px-5 py-2 rounded-lg text-sm font-semibold whitespace-nowrap transition-all ${activeTab === 'jd-audit' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
        >
            JD Audit
        </button>
      </div>

      {/* JD Area - Always visible as a card at the top */}
      <div className="bg-white p-6 sm:p-8 rounded-[2.5rem] shadow-apple-card border border-white/60 mb-8">
          <div className="flex justify-between items-center mb-6">
              <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-blue-50 rounded-2xl flex items-center justify-center text-system-blue">
                      <ClipboardIcon className="w-5 h-5" />
                  </div>
                  <div>
                      <h3 className="text-lg font-bold text-gray-900">Target Role</h3>
                      <p className="text-xs text-gray-500 font-medium">Define the job context for AI screening</p>
                  </div>
              </div>
              {isAnalyzingJd && (
                  <div className="flex items-center gap-2 px-4 py-2 bg-blue-50 rounded-full border border-blue-100 animate-pulse">
                      <div className="w-3 h-3 border-2 border-system-blue border-t-transparent rounded-full animate-spin"></div>
                      <span className="text-[10px] font-bold text-system-blue uppercase tracking-widest">AI Auditing...</span>
                  </div>
              )}
          </div>
          <div className="relative group">
              <textarea 
                  className="w-full bg-gray-50 rounded-2xl p-5 text-sm focus:ring-4 focus:ring-system-blue/10 outline-none border border-gray-100 transition-all resize-y min-h-[120px] pr-12"
                  placeholder="Paste Job Description here... AI will automatically audit it for bias and clarity."
                  value={jobDescription}
                  onChange={(e) => setJobDescription(e.target.value)}
              />
              <button
                  onClick={() => setIsJDMaximized(true)}
                  className="absolute top-4 right-4 p-2 text-gray-400 hover:text-system-blue hover:bg-white rounded-xl transition-all shadow-sm opacity-0 group-hover:opacity-100"
                  title="Maximize"
              >
                  <MaximizeIcon className="w-4 h-4" />
              </button>
          </div>
      </div>

      {activeTab === 'jd-audit' && (
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
          {candidates.length === 0 ? (
            <div className="py-20 text-center animate-scale-in bg-white rounded-[3rem] shadow-apple-card border-2 border-dashed border-gray-200 hover:border-system-blue transition-colors group">
                 <div className="w-20 h-20 bg-blue-50 rounded-full flex items-center justify-center mx-auto mb-8 text-system-blue group-hover:scale-110 transition-transform duration-500">
                     <UploadIcon className="w-10 h-10 animate-bounce" />
                 </div>
                 <h3 className="text-3xl font-bold text-gray-900 tracking-tight">Upload Candidate Resumes to Start</h3>
                 <p className="text-gray-500 text-base mt-3 max-w-md mx-auto px-4 font-medium leading-relaxed">Screen up to 10 candidates at once against your job description.</p>
                 <div className="flex flex-col items-center justify-center gap-4 mt-10">
                    <button 
                        onClick={() => fileInputRef.current?.click()}
                        className="px-10 py-4 bg-gray-900 text-white font-bold rounded-full hover:bg-black transition-all shadow-xl active:scale-95 flex items-center gap-3 text-lg"
                    >
                        <UploadIcon className="w-5 h-5" />
                        Select Resumes
                    </button>
                    <p className="text-xs text-gray-400 font-bold uppercase tracking-widest">Supports PDF, DOCX, and TXT</p>
                 </div>
            </div>
          ) : (
            <div className="space-y-8">
              {/* Analysis Progress Banner */}
              {candidates.some(c => c.status === 'processing' || c.status === 'pending') && (
                <motion.div 
                  initial={{ opacity: 0, y: -20 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="bg-blue-50 border border-blue-100 p-4 rounded-3xl flex flex-col sm:flex-row items-center justify-between gap-4 shadow-sm"
                >
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-white rounded-2xl flex items-center justify-center text-system-blue shadow-sm">
                      <Clock className="w-6 h-6 animate-pulse" />
                    </div>
                    <div>
                      <h4 className="text-sm font-bold text-gray-900">Analysis in Progress</h4>
                      <p className="text-xs text-gray-500 mt-0.5">
                        Our analysis agent does a very detailed scan and helps you hand-pick the best candidate.
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-6 px-4 py-2 bg-white rounded-2xl border border-blue-50 shadow-sm">
                    <div className="text-center">
                      <div className="text-[10px] font-bold uppercase text-gray-400 tracking-widest">Est. Time</div>
                      <div className="text-sm font-black text-system-blue">
                        ~{candidates.filter(c => c.status === 'processing' || c.status === 'pending').length * 15}s
                      </div>
                    </div>
                    <div className="w-px h-8 bg-gray-100"></div>
                    <div className="text-center">
                      <div className="text-[10px] font-bold uppercase text-gray-400 tracking-widest">Per Resume</div>
                      <div className="text-sm font-black text-gray-900">~15s</div>
                    </div>
                  </div>
                </motion.div>
              )}

              {/* Bulk Actions Bar - Always Present Above List */}
              <div className="space-y-4">
              <div className="flex flex-col sm:flex-row gap-4 items-center justify-between">
                <div className="flex items-center gap-3 w-full sm:w-auto">
                  <div className="relative">
                    <button 
                      onClick={() => setTopPickFilter(!topPickFilter)}
                      className={`px-4 py-2 rounded-xl text-xs font-bold transition-all border flex items-center gap-2 ${topPickFilter ? 'bg-system-blue text-white border-system-blue shadow-lg shadow-blue-200' : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300'}`}
                    >
                      <SparklesIcon className={`w-3.5 h-3.5 ${topPickFilter ? 'text-white' : 'text-system-blue'}`} />
                      {topPickFilter ? `Top ${topPicksCount} Selected` : 'Filter Top Picks'}
                      <div 
                        onClick={(e) => {
                          e.stopPropagation();
                          setShowTopPicksDropdown(!showTopPicksDropdown);
                        }}
                        className="ml-1 p-0.5 hover:bg-white/20 rounded transition-colors"
                      >
                        <ChevronRight className={`w-3 h-3 transition-transform ${showTopPicksDropdown ? 'rotate-90' : ''}`} />
                      </div>
                    </button>
                    
                    {showTopPicksDropdown && (
                      <div className="absolute top-full left-0 mt-2 w-32 bg-white rounded-xl shadow-2xl border border-gray-100 z-[70] py-2 animate-scale-in">
                        <div className="px-3 py-1 text-[10px] font-bold text-gray-400 uppercase tracking-widest">Select Count</div>
                        {[1, 2, 3, 4, 5, 10].map(num => (
                          <button
                            key={num}
                            onClick={() => {
                              setTopPicksCount(num);
                              setShowTopPicksDropdown(false);
                              setTopPickFilter(true);
                            }}
                            className={`w-full text-left px-4 py-2 text-xs font-bold hover:bg-gray-50 transition-colors ${topPicksCount === num ? 'text-system-blue' : 'text-gray-600'}`}
                          >
                            Top {num}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                  <button 
                    onClick={() => setBiasFreeMode(!biasFreeMode)}
                    className={`px-4 py-2 rounded-xl text-xs font-bold transition-all border flex items-center gap-2 ${biasFreeMode ? 'bg-gray-900 text-white border-gray-900 shadow-lg' : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300'}`}
                  >
                    <span className="text-sm">{biasFreeMode ? '👁️' : '🕶️'}</span>
                    {biasFreeMode ? 'Bias-Free: ON' : 'Bias-Free Mode'}
                  </button>
                </div>
                <div className="flex items-center gap-3 w-full sm:w-auto">
                  <button 
                    onClick={() => fileInputRef.current?.click()}
                    disabled={candidates.length >= 10}
                    className={`px-6 py-3 rounded-full text-xs font-bold transition-all flex items-center gap-2 shadow-none border-0 ${
                      candidates.length >= 10 
                        ? 'bg-gray-100 text-gray-400 cursor-not-allowed' 
                        : 'bg-black text-white hover:bg-gray-900 active:scale-95'
                    }`}
                  >
                    <UploadIcon className="w-4 h-4" />
                    <span>{candidates.length > 0 ? 'Upload More Resumes' : 'Upload Resumes'}</span>
                    <span className="opacity-60 font-medium">({candidates.length}/10)</span>
                  </button>
                </div>
              </div>

              <div className="sticky top-4 z-[60] w-full max-w-3xl mx-auto animate-scale-in">
                <div className="bg-gray-900/95 backdrop-blur-xl text-white p-3 sm:p-4 rounded-full shadow-2xl border border-white/10 flex items-center justify-between gap-4">
                    {/* Limit Toast */}
                    {showCompareToast && (
                        <div className="absolute -top-14 left-1/2 -translate-x-1/2 bg-gray-800 text-white text-xs font-bold py-2 px-4 rounded-full shadow-lg animate-[fadeIn_0.2s_ease-out] whitespace-nowrap z-30 border border-white/5">
                            Compare supports up to 3 profiles.
                        </div>
                    )}
                    {showShortlistToast && (
                        <div className="absolute -top-14 left-1/2 -translate-x-1/2 bg-system-blue text-white text-xs font-bold py-2 px-4 rounded-full shadow-lg animate-[fadeIn_0.2s_ease-out] whitespace-nowrap z-30 border border-white/5">
                            Candidates shortlisted successfully!
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
                        <button 
                            onClick={handleShortlistSelected}
                            disabled={selectedIds.size === 0}
                            className="p-2.5 sm:px-5 sm:py-2.5 bg-system-blue text-white rounded-full transition-all flex items-center gap-2 hover:scale-105 active:scale-95 group disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-blue-500/20"
                            title="Shortlist Selected"
                        >
                            <Bookmark className="w-5 h-5 sm:w-4 sm:h-4 fill-current" />
                            <span className="hidden sm:inline text-xs font-bold">Shortlist</span>
                        </button>
                        <div className="w-px h-6 bg-white/10 mx-1 hidden sm:block"></div>
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
            </div>

            <div className="flex flex-col lg:flex-row gap-8">
        <div className="flex-1 min-w-0 space-y-8 w-full">
          <div className="bg-white rounded-3xl shadow-apple-card border border-white/60">
                <div className="w-full">
                    {/* Desktop Table View */}
                    <table className="w-full text-left border-collapse hidden md:table">
                        <thead>
                            <tr className="border-b border-gray-100 bg-gray-50/50">
                                        <th className="p-5 pl-8 w-24">
                                            <div className="flex items-center gap-2">
                                                <input 
                                                    type="checkbox" 
                                                    className="w-4 h-4 rounded text-system-blue border-gray-300 focus:ring-system-blue cursor-pointer"
                                                    checked={selectedIds.size === sortedCandidates.length && sortedCandidates.length > 0}
                                                    onChange={toggleSelectAll}
                                                />
                                                <button
                                                    onClick={() => setShowClearConfirm(true)}
                                                    disabled={selectedIds.size === 0}
                                                    className={`p-1.5 rounded-lg transition-all ${selectedIds.size > 0 ? 'text-red-500 hover:bg-red-50' : 'text-gray-300 cursor-not-allowed'}`}
                                                    title="Delete selected candidates"
                                                >
                                                    <Trash2 className="w-4 h-4" />
                                                </button>
                                            </div>
                                        </th>
                                <th className="p-5 text-xs font-bold text-gray-500 uppercase tracking-wider">Rank</th>
                                <th className="p-5 text-xs font-bold text-gray-500 uppercase tracking-wider">Candidate</th>
                                <th className="p-5 text-xs font-bold text-gray-500 uppercase tracking-wider text-center">Score</th>
                                <th className="p-5 text-xs font-bold text-gray-500 uppercase tracking-wider group relative">
                                    Potential
                                    <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-48 p-2 bg-gray-900 text-white text-[10px] rounded-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50 font-medium normal-case tracking-normal">
                                        Measures transferable skills, career trajectory, and growth potential beyond direct JD matches.
                                    </div>
                                </th>
                                <th className="p-5 text-xs font-bold text-gray-500 uppercase tracking-wider">Exp</th>
                                <th className="p-5 text-xs font-bold text-gray-500 uppercase tracking-wider text-right pr-8">Action</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-50">
                            {filteredCandidates.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage).map((c, idx) => {
                                const actualIdx = (currentPage - 1) * itemsPerPage + idx;
                                const isTopPick = actualIdx < topPicksCount && c.status === 'analyzed' && c.analysis && c.analysis.match_score >= 40;
                                const isSelected = selectedIds.has(c.id);
                                const isNotEligible = c.analysis && c.analysis.match_score < 40;
                                return (
                                    <tr key={c.id} className={`transition-colors group ${isSelected ? 'bg-blue-50/50' : 'hover:bg-gray-50/80'} ${isNotEligible ? 'opacity-75' : ''}`}>
                                        <td className="p-5 pl-8">
                                            <input 
                                                type="checkbox" 
                                                className="w-4 h-4 rounded text-system-blue border-gray-300 focus:ring-system-blue cursor-pointer"
                                                checked={isSelected}
                                                onChange={() => toggleSelection(c.id)}
                                            />
                                        </td>
                                        <td className="p-5 font-medium text-gray-400">#{actualIdx + 1}</td>
                                        <td className="p-5">
                                            <div className="font-bold text-gray-900">
                                              {biasFreeMode ? `Candidate #${actualIdx + 1}` : c.name}
                                            </div>
                                            {c.flashScan && c.status !== 'analyzed' && (
                                                <div className="text-[10px] text-gray-500 italic mt-1 leading-tight max-w-[200px] animate-pulse">
                                                    "{c.flashScan}"
                                                </div>
                                            )}
                                            <div className="flex items-center gap-2 mt-1">
                                                {isTopPick && <span className="text-[10px] bg-yellow-100 text-yellow-700 px-2 py-0.5 rounded-full font-bold">TOP PICK</span>}
                                                {isNotEligible && <span className="text-[10px] bg-red-100 text-red-700 px-2 py-0.5 rounded-full font-bold uppercase">Low Match Profile</span>}
                                            </div>
                                        </td>
                                        <td className="p-5">
                                            {c.status === 'processing' ? (
                                                <div className="flex flex-col items-center gap-1 text-system-blue">
                                                    <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin"></div>
                                                    <span className="text-[9px] font-black uppercase tracking-widest">Analyzing</span>
                                                </div>
                                            ) : c.status === 'error' ? (
                                                <div className="flex flex-col items-center gap-2">
                                                    <span className="text-[9px] font-black uppercase tracking-widest text-red-500 bg-red-50 px-2 py-1 rounded">Failed</span>
                                                    <button 
                                                        onClick={(e) => { e.stopPropagation(); handleReanalyze(c); }}
                                                        className="text-[9px] font-black uppercase tracking-widest text-system-blue hover:text-blue-700 bg-blue-50 px-2 py-1 rounded transition-colors"
                                                    >
                                                        Retry
                                                    </button>
                                                </div>
                                            ) : c.analysis ? (
                                                <div className="flex flex-col items-center gap-1 group/score relative">
                                                    <div className="flex items-center gap-2">
                                                        <div className="w-10 bg-gray-100 h-1.5 rounded-full overflow-hidden">
                                                            <div className={`h-full rounded-full ${c.analysis.match_score >= 80 ? 'bg-system-green' : c.analysis.match_score >= 40 ? 'bg-system-orange' : 'bg-system-red'}`} style={{ width: `${c.analysis.match_score}%` }}></div>
                                                        </div>
                                                        <span className={`text-sm font-black ${c.analysis.match_score >= 80 ? 'text-system-green' : c.analysis.match_score >= 40 ? 'text-system-orange' : 'text-system-red'}`}>{c.analysis.match_score}%</span>
                                                    </div>
                                                    <span className={`text-[9px] font-black uppercase tracking-widest leading-none ${c.analysis.match_score >= 80 ? 'text-system-green' : c.analysis.match_score >= 40 ? 'text-system-orange' : 'text-system-red'}`}>
                                                        {c.analysis.match_score >= 80 ? 'High' : c.analysis.match_score >= 40 ? 'Medium' : 'Low'}
                                                    </span>

                                                    {/* Match Insights Popover */}
                                                    <div className="absolute top-1/2 left-full ml-4 -translate-y-1/2 w-64 bg-gray-900 shadow-2xl border border-white/10 p-4 opacity-0 pointer-events-none group-hover/score:opacity-100 transition-all z-[100] scale-95 group-hover/score:scale-100 rounded-2xl">
                                                        <div className="flex items-center justify-between mb-3">
                                                            <span className="text-[10px] font-black uppercase tracking-widest text-white/40">Match Insights</span>
                                                            <div className="px-2 py-0.5 bg-system-blue text-white text-[9px] font-bold rounded-md shadow-lg shadow-blue-500/20">AI Verified</div>
                                                        </div>
                                                        <div className="space-y-3">
                                                            {c.analysis.grounding_evidence?.map((evidence, idx) => (
                                                                <div key={idx} className="space-y-1.5">
                                                                    <div className="flex justify-between items-center text-[10px]">
                                                                        <span className="font-bold text-white/70">{evidence.parameter}</span>
                                                                        <span className="text-system-blue font-black">{evidence.score}%</span>
                                                                    </div>
                                                                    <div className="w-full h-1 bg-white/5 rounded-full overflow-hidden">
                                                                        <div className="h-full bg-system-blue rounded-full" style={{ width: `${evidence.score}%` }}></div>
                                                                    </div>
                                                                    <p className="text-[9px] text-white/50 leading-tight italic">
                                                                        {evidence.details}
                                                                    </p>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    </div>
                                                </div>
                                            ) : (
                                                <div className="text-center">
                                                    <span className="text-[9px] font-black uppercase tracking-widest text-gray-400">Queued</span>
                                                </div>
                                            )}
                                        </td>
                                        <td className="p-5 text-sm font-bold text-gray-900">{c.analysis?.potential_score ? `${c.analysis.potential_score}%` : '-'}</td>
                                        <td className="p-5 text-sm font-bold text-gray-900">{c.analysis?.years_experience ? `${c.analysis.years_experience}y` : '-'}</td>
                                        <td className="p-5 text-right pr-8">
                                            <div className="flex items-center justify-end gap-6">
                                              <button 
                                                  onClick={() => setContactCandidate(c)}
                                                  disabled={c.status !== 'analyzed'}
                                                  className={`text-sm font-bold transition-all hover:scale-105 active:scale-95 ${c.status !== 'analyzed' ? 'text-gray-300 cursor-not-allowed' : 'text-gray-500 hover:text-system-blue'}`}
                                              >
                                                  Contact
                                              </button>
                                              <button 
                                                  onClick={() => handleOpenCandidate(c)}
                                                  disabled={c.status !== 'analyzed'}
                                                  className={`text-sm font-bold transition-all hover:scale-105 active:scale-95 flex items-center gap-1 ${c.status !== 'analyzed' ? 'text-gray-300 cursor-not-allowed' : 'text-system-blue'}`}
                                              >
                                                  View Details {c.status === 'analyzed' && <ChevronRight className="w-4 h-4" />}
                                              </button>
                                              <button 
                                                   onClick={(e) => handleToggleShortlist(e, c.id)}
                                                   disabled={c.status !== 'analyzed'}
                                                   className={`p-2 rounded-full transition-all hover:scale-110 active:scale-90 ${c.status !== 'analyzed' ? 'text-gray-200 cursor-not-allowed' : c.isShortlisted ? 'text-system-blue bg-blue-50' : 'text-gray-400 hover:text-system-blue hover:bg-blue-50'}`}
                                                   title={c.isShortlisted ? "Remove from Shortlist" : "Add to Shortlist"}
                                               >
                                                   <Save className={`w-4 h-4 ${c.isShortlisted ? 'fill-current' : ''}`} />
                                               </button>
                                              <button 
                                                  onClick={() => setCandidateToDelete(c)}
                                                  className="p-2 text-gray-400 hover:text-red-500 transition-colors hover:bg-red-50 rounded-full"
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
                        {filteredCandidates.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage).map((c, idx) => {
                             const actualIdx = (currentPage - 1) * itemsPerPage + idx;
                             const isTopPick = actualIdx < topPicksCount && c.status === 'analyzed' && c.analysis && c.analysis.match_score >= 40;
                             const isSelected = selectedIds.has(c.id);
                             const isNotEligible = c.analysis && c.analysis.match_score < 40;
                             return (
                                <div key={c.id} className={`p-4 border-b border-gray-100 last:border-0 ${isSelected ? 'bg-blue-50/30' : ''} ${isNotEligible ? 'opacity-75' : ''}`} onClick={() => toggleSelection(c.id)}>
                                    <div className="flex justify-between items-start mb-3">
                                        <div className="flex items-center gap-3">
                                            <input 
                                                type="checkbox" 
                                                className="w-5 h-5 rounded text-system-blue border-gray-300 focus:ring-system-blue cursor-pointer"
                                                checked={isSelected}
                                                onChange={(e) => { e.stopPropagation(); toggleSelection(c.id); }}
                                            />
                                            <div>
                                                <div className="font-bold text-gray-900">
                                                  {biasFreeMode ? `Candidate #${actualIdx + 1}` : c.name}
                                                </div>
                                                {c.flashScan && c.status !== 'analyzed' && (
                                                    <div className="text-[10px] text-gray-500 italic mt-0.5 leading-tight animate-pulse">
                                                        "{c.flashScan}"
                                                    </div>
                                                )}
                                                <div className="flex items-center gap-2 mt-1">
                                                    <span className="text-xs font-bold text-gray-400">#{actualIdx + 1}</span>
                                                    {isTopPick && <span className="text-[10px] bg-yellow-100 text-yellow-700 px-2 py-0.5 rounded-full font-bold">TOP PICK</span>}
                                                    {isNotEligible && <span className="text-[10px] bg-red-100 text-red-700 px-2 py-0.5 rounded-full font-bold uppercase">Low Match Profile</span>}
                                                </div>
                                            </div>
                                        </div>
                                        
                                        <div>
                                             {c.status === 'processing' ? (
                                                <div className="w-4 h-4 border-2 border-system-blue border-t-transparent rounded-full animate-spin"></div>
                                            ) : c.analysis ? (
                                                <span className={`text-sm font-bold px-2 py-1 rounded-md ${c.analysis.match_score >= 80 ? 'bg-green-50 text-green-700' : c.analysis.match_score >= 40 ? 'bg-orange-50 text-orange-700' : 'bg-red-50 text-red-700'}`}>{c.analysis.match_score}%</span>
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
                                                className={`px-4 py-2 text-xs font-bold rounded-lg transition-all ${c.status !== 'analyzed' ? 'bg-gray-50 text-gray-300 cursor-not-allowed' : isNotEligible ? 'bg-orange-50 text-orange-600' : 'bg-gray-100 text-gray-900'}`}
                                            >
                                                {isNotEligible ? 'Low Match' : 'View Details'}
                                            </button>
                                            <button 
                                                onClick={(e) => handleToggleShortlist(e, c.id)}
                                                disabled={c.status !== 'analyzed'}
                                                className={`p-2 rounded-full transition-all ${c.status !== 'analyzed' ? 'text-gray-200 cursor-not-allowed' : c.isShortlisted ? 'text-system-blue bg-blue-50' : 'text-gray-400'}`}
                                                title={c.isShortlisted ? "Remove from Shortlist" : "Add to Shortlist"}
                                            >
                                                <Save className={`w-4 h-4 ${c.isShortlisted ? 'fill-current' : ''}`} />
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
                    <Pagination 
                      currentPage={currentPage} 
                      totalItems={filteredCandidates.length} 
                      onPageChange={setCurrentPage} 
                    />
                </div>
              </div>

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
                      {/* Template Selection */}
                      <div className="flex gap-2 mb-2">
                          <button 
                            onClick={() => handleTemplateChange('invite')}
                            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all border ${emailTemplate === 'invite' ? 'bg-system-blue text-white border-system-blue' : 'bg-white text-gray-600 border-gray-200'}`}
                          >
                            Invite to Screen
                          </button>
                          <button 
                            onClick={() => handleTemplateChange('more-info')}
                            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all border ${emailTemplate === 'more-info' ? 'bg-system-blue text-white border-system-blue' : 'bg-white text-gray-600 border-gray-200'}`}
                          >
                            Request Info
                          </button>
                          <button 
                            onClick={() => handleTemplateChange('reject')}
                            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all border ${emailTemplate === 'reject' ? 'bg-system-blue text-white border-system-blue' : 'bg-white text-gray-600 border-gray-200'}`}
                          >
                            Polite Rejection
                          </button>
                      </div>

                      {/* Recipients Preview */}
                      <div className="bg-gray-50 p-4 rounded-xl border border-gray-200">
                          <div className="flex justify-between items-center mb-2">
                            <label className="text-xs font-bold uppercase text-gray-400 block">Recipients (BCC)</label>
                            <button
                                onClick={() => {
                                    const selectedEmails = sortedCandidates
                                        .filter(c => selectedIds.has(c.id))
                                        .map(c => c.analysis?.email || (c.name.toLowerCase().replace(/\s/g, '.').replace('.pdf', '') + '@example.com'));
                                    const cleanList = selectedEmails.join(', ');
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
                              {sortedCandidates
                                .filter(c => selectedIds.has(c.id))
                                .map(c => c.analysis?.email || (c.name.toLowerCase().replace(/\s/g, '.').replace('.pdf', '') + '@example.com'))
                                .map((email, i) => (
                                  <span key={i} className="px-2 py-1 bg-white border border-gray-200 rounded text-xs text-gray-600">{email}</span>
                              ))}
                          </div>
                      </div>

                      {/* Content Draft */}
                      <div className="space-y-4">
                          <div>
                              <label className="text-xs font-bold uppercase text-gray-400 mb-1 block">Subject</label>
                              <input 
                                type="text" 
                                value={emailSubject} 
                                onChange={(e) => setEmailSubject(e.target.value)}
                                className="w-full bg-white border border-gray-200 rounded-lg p-3 text-sm font-medium text-gray-900 focus:ring-2 focus:ring-system-blue/20 outline-none" 
                              />
                          </div>
                          <div>
                               <label className="text-xs font-bold uppercase text-gray-400 mb-1 block">Message</label>
                               <textarea 
                                value={emailBody} 
                                onChange={(e) => setEmailBody(e.target.value)}
                                className="w-full h-40 bg-white border border-gray-200 rounded-lg p-3 text-sm text-gray-700 resize-none leading-relaxed focus:ring-2 focus:ring-system-blue/20 outline-none"
                               ></textarea>
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
                        className="px-6 py-2.5 text-sm font-bold text-gray-500 hover:text-gray-900 transition-colors"
                      >
                          Cancel
                      </button>
                      <button 
                        onClick={() => {
                            const selectedEmails = sortedCandidates
                                .filter(c => selectedIds.has(c.id))
                                .map(c => c.name.toLowerCase().replace(/\s/g, '.') + '@example.com');
                            const mailtoUrl = `mailto:?bcc=${selectedEmails.join(',')}&subject=${encodeURIComponent(emailSubject)}&body=${encodeURIComponent(emailBody)}`;
                            window.open(mailtoUrl);
                            setShowEmailModal(false);
                        }}
                        className="px-8 py-2.5 bg-gray-900 text-white text-sm font-bold rounded-xl hover:bg-black transition-all shadow-lg active:scale-95 flex items-center justify-center gap-2"
                      >
                          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="22" y1="2" x2="11" y2="13"></line><polygon points="22 2 15 22 11 13 2 9 22 2"></polygon></svg>
                          Open in Mail
                      </button>
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
                                  <p className="text-sm font-medium text-gray-900">{contactCandidate.analysis?.phone || 'NA'}</p>
                              </div>
                          </div>

                          <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl border border-gray-100">
                              <div className="w-8 h-8 bg-white rounded-lg flex items-center justify-center text-gray-400 shadow-sm">
                                  <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"></path><polyline points="22,6 12,13 2,6"></polyline></svg>
                              </div>
                              <div>
                                  <p className="text-[10px] font-bold text-gray-400 uppercase">Email Address</p>
                                  <p className="text-sm font-medium text-gray-900">{contactCandidate.analysis?.email || 'NA'}</p>
                              </div>
                          </div>

                          <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl border border-gray-100">
                              <div className="w-8 h-8 bg-white rounded-lg flex items-center justify-center text-gray-400 shadow-sm">
                                  <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path><circle cx="12" cy="10" r="3"></circle></svg>
                              </div>
                              <div>
                                  <p className="text-[10px] font-bold text-gray-400 uppercase">Address</p>
                                  <p className="text-sm font-medium text-gray-900">{contactCandidate.analysis?.address || 'NA'}</p>
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

      {/* Delete Selected Confirmation Modal */}
      {showClearConfirm && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-fade-in">
          <motion.div 
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            className="bg-white rounded-[2rem] shadow-2xl max-w-md w-full p-8 border border-gray-100"
          >
            <div className="w-12 h-12 bg-red-50 rounded-2xl flex items-center justify-center mb-6">
              <AlertTriangle className="w-6 h-6 text-red-500" />
            </div>
            <h3 className="text-xl font-bold text-gray-900 mb-2">Delete Selected Candidates?</h3>
            <p className="text-gray-500 text-sm leading-relaxed mb-8">
              This will remove the {selectedIds.size} selected candidate{selectedIds.size > 1 ? 's' : ''} from this list. This action cannot be undone.
            </p>
            <div className="flex gap-3">
              <button 
                onClick={() => setShowClearConfirm(false)}
                className="flex-1 px-6 py-3 rounded-xl font-bold text-gray-500 hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button 
                onClick={confirmDeleteSelected}
                className="flex-1 px-6 py-3 rounded-xl font-bold bg-red-500 text-white hover:bg-red-600 transition-colors shadow-lg shadow-red-200"
              >
                Delete Selected
              </button>
            </div>
          </motion.div>
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
                                  if (candidateToDelete) {
                                      handleDeleteCandidate(candidateToDelete.id);
                                      setCandidateToDelete(null);
                                  }
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
