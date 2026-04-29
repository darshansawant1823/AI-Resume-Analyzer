
import React, { useState, useCallback, useEffect } from 'react';
import { onAuthStateChanged, User } from 'firebase/auth';
import { auth } from './src/firebase';
import { useFirestoreSync } from './src/hooks/useFirebase';
import { useInterviewData } from './src/hooks/useInterviewData';
import { AuthPage } from './src/components/AuthPage';
import { ProfilePage } from './components/ProfilePage';
import type { AnalysisResult } from './types';
import { analyzeResume, extractTextFromFile } from './services/geminiService';
import { Header } from './components/Header';
import { JobDescriptionInput } from './components/JobDescriptionInput';
import { ResumeUploader } from './components/ResumeUploader';
import { ResultsDisplay } from './components/ResultsDisplay';
import { SparklesIcon } from './components/icons/SparklesIcon';
import { RecruiterDashboard } from './components/RecruiterDashboard';
import { AdminDashboard } from './components/AdminDashboard';
import { LegalPages } from './components/LegalPages';
import { InterviewQuestionPredictor } from './components/InterviewQuestionPredictor';

import { useRecruiterData } from './src/hooks/useRecruiterData';
import { RefreshCw, FileText, Trash2 as TrashIcon, Eye } from 'lucide-react';
import type { ResumeEntry } from './types';

const App: React.FC = () => {
  const [user, setUser] = useState<User | null>(null);
  const { profile, updateProfile, loading: profileLoading } = useFirestoreSync(user);

  const { clearAllData: clearRecruiterData } = useRecruiterData(user);
  const { clearAllData: clearInterviewData, saveInterview, updateInterview } = useInterviewData(user);
  const [currentInterviewId, setCurrentInterviewId] = useState<string | null>(null);

  // Removed session clearing logic to preserve data accuracy
  useEffect(() => {
    if (user) {
      // Data is now persisted across sessions
    }
  }, [user]);

  // Track time spent
  useEffect(() => {
    if (!user || !profile) return;

    const interval = setInterval(() => {
      const currentMinutes = profile.timeSpentMinutes || 0;
      updateProfile({ timeSpentMinutes: currentMinutes + 1 });
    }, 60000); // Every minute

    return () => clearInterval(interval);
  }, [user, profile?.timeSpentMinutes]);
  const [isAuthPageActive, setIsAuthPageActive] = useState(false);
  const [authMode, setAuthMode] = useState<'login' | 'signup'>('login');
  const [authRole, setAuthRole] = useState<'jobseeker' | 'recruiter'>('jobseeker');

  const [activePortal, setActivePortal] = useState<'seeker' | 'recruiter' | 'admin' | 'profile'>('seeker');
  const [legalPage, setLegalPage] = useState<null | 'terms' | 'privacy' | 'refund'>(null);
  const [seekerTool, setSeekerTool] = useState<'analyzer' | 'interview'>('analyzer');
  
  const [currentQuote, setCurrentQuote] = useState(0);
  const quotes = [
    "Your value doesn't decrease based on someone's inability to see your worth.",
    "The only way to do great work is to love what you do. — Steve Jobs",
    "Opportunities don't happen, you create them. — Chris Grosser",
    "Believe you can and you're halfway there. — Theodore Roosevelt",
    "Don't wait for the right opportunity: create it. — George Bernard Shaw",
    "Success is not final, failure is not fatal: it is the courage to continue that counts. — Winston Churchill",
    "Your dream job is out there. Let's make sure your resume shows why you're the one."
  ];

  useEffect(() => {
    // Removed force logout on refresh to maintain user session
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      if (currentUser) {
        setIsAuthPageActive(false);
      }
    });
    return () => unsubscribe();
  }, []);

  const handlePortalChange = (portal: 'seeker' | 'recruiter' | 'admin' | 'profile') => {
    if (portal === 'admin' && profile?.role !== 'admin') {
      return;
    }
    setActivePortal(portal);
    setLegalPage(null);
  };

  const handleToolChange = (tool: 'analyzer' | 'interview') => {
    setSeekerTool(tool);
  };

  const [jobDescription, setJobDescription] = useState<string>('');
  const [resumeFile, setResumeFile] = useState<File | null>(null);
  const [analysisResult, setAnalysisResult] = useState<AnalysisResult | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'input' | 'results'>('input');

  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (isLoading) {
      interval = setInterval(() => {
        setCurrentQuote((prev) => (prev + 1) % quotes.length);
      }, 3500);
    }
    return () => clearInterval(interval);
  }, [isLoading]);
  
  const [showContactModal, setShowContactModal] = useState(false);
  const [missingContactInfo, setMissingContactInfo] = useState<{email: boolean, phone: boolean}>({ email: false, phone: false });
  const [contactForm, setContactForm] = useState({ email: '', phone: '' });

  const handleFixContactInfo = () => {
    if (!analysisResult) return;
    
    let updatedResume = analysisResult.custom_resume_text;
    const contactLine = `\nEmail: ${contactForm.email} | Phone: ${contactForm.phone}\n`;
    
    // Inject contact info at the top of the resume text
    updatedResume = contactLine + updatedResume;
    
    setAnalysisResult({
      ...analysisResult,
      custom_resume_text: updatedResume,
      contact_info_missing: { email: false, phone: false }
    });
    setShowContactModal(false);
  };
  
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

  const [selectedResumeId, setSelectedResumeId] = useState<string | null>(null);
  const [viewingResume, setViewingResume] = useState<ResumeEntry | null>(null);

  useEffect(() => {
    if (profile?.resumes && profile.resumes.length > 0) {
      // Default to the latest uploaded resume if none selected
      if (!selectedResumeId) {
        const latest = [...profile.resumes].sort((a, b) => 
          new Date(b.uploadedAt).getTime() - new Date(a.uploadedAt).getTime()
        )[0];
        setSelectedResumeId(latest.id);
      }
    }
  }, [profile?.resumes]);

  const handleAnalyze = useCallback(async () => {
    if (!jobDescription || (!resumeFile && !selectedResumeId)) {
      setError('Please provide both a job description and a resume.');
      return;
    }
    setError(null);
    setIsLoading(true);
    setAnalysisResult(null);
    setActiveTab('results');

    try {
      let resumePayload: { text?: string; base64Data?: string; mimeType?: string; } = {};
      let currentResumeName = '';
      
      if (resumeFile) {
        // New file upload
        let extractedText = '';
        if (resumeFile.type.startsWith('image/') || resumeFile.type === 'application/pdf') {
          const { base64Data, mimeType } = await fileToBase64(resumeFile);
          extractedText = await extractTextFromFile({ base64Data, mimeType });
        } else {
          extractedText = await resumeFile.text();
        }
        
        resumePayload = { text: extractedText };
        currentResumeName = resumeFile.name;
        
        // Add to resumes list in profile
        if (user) {
          const newResume: ResumeEntry = {
            id: Math.random().toString(36).substr(2, 9),
            name: resumeFile.name,
            text: extractedText,
            uploadedAt: new Date().toISOString()
          };
          
          const currentResumes = profile?.resumes || [];
          await updateProfile({ 
            resumes: [newResume, ...currentResumes],
            lastResumeText: extractedText, // Keep for backward compatibility if needed
            lastResumeName: resumeFile.name
          });
          setSelectedResumeId(newResume.id);
          setResumeFile(null); // Clear the file input after successful upload/analysis
        }
      } else if (selectedResumeId && profile?.resumes) {
        const selected = profile.resumes.find(r => r.id === selectedResumeId);
        if (selected) {
          resumePayload = { text: selected.text };
          currentResumeName = selected.name;
        }
      }

      const result = await analyzeResume(jobDescription, resumePayload);
      setAnalysisResult(result);
      
      if (result.contact_info_missing.email || result.contact_info_missing.phone) {
        setMissingContactInfo(result.contact_info_missing);
        setShowContactModal(true);
      }

      if (user) {
        const id = await saveInterview({
          type: 'analysis',
          jobDescription,
          resumeName: resumeFile?.name || profile?.lastResumeName || 'Cached Resume',
          result
        });
        setCurrentInterviewId(id);
      }
    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? `An error occurred: ${err.message}` : 'An unknown error occurred.');
      setActiveTab('input');
    } finally {
      setIsLoading(false);
    }
  }, [jobDescription, resumeFile, selectedResumeId, profile, user, updateProfile, saveInterview]);

  const handleReset = () => {
    // Keep jobDescription and resumeFile as requested by user
    setAnalysisResult(null);
    setError(null);
    setIsLoading(false);
    setActiveTab('input');
  };

  const handleUpdateResume = async (newText: string) => {
    setAnalysisResult(prevResult => {
      if (!prevResult) return null;
      return { ...prevResult, custom_resume_text: newText };
    });

    // Also update saved session if exists
    if (user && currentInterviewId) {
      await updateInterview(currentInterviewId, {
        'result.custom_resume_text': newText
      });
    }
  };
  
  const isButtonDisabled = !jobDescription || (!resumeFile && !selectedResumeId) || isLoading;

  const handleShowTerms = () => {
    setLegalPage('terms');
  };

  const handleLogoClick = () => {
    setActivePortal('seeker');
    setSeekerTool('analyzer');
    setLegalPage(null);
    setActiveTab('input');
    // Note: We preserve the current input (JD/Resume) state to avoid accidental data loss,
    // but reset the view to the main landing input screen.
  };

  return (
    <div className="min-h-screen bg-system-bg font-sans selection:bg-system-blue/20 selection:text-system-blue flex flex-col">
      {isAuthPageActive ? (
        <AuthPage 
          onBack={() => setIsAuthPageActive(false)} 
          initialMode={authMode}
          role={authRole}
          onSuccess={() => {
            setIsAuthPageActive(false);
            if (authRole === 'recruiter') setActivePortal('recruiter');
            if (authRole === 'jobseeker' && seekerTool === 'analyzer') setSeekerTool('interview');
          }}
        />
      ) : (
        <>
          <Header 
            activePortal={activePortal !== 'profile' ? activePortal : undefined} 
            onPortalChange={handlePortalChange} 
            onShowTerms={handleShowTerms}
            onLogoClick={handleLogoClick}
            user={user}
            profile={profile}
            onLoginClick={() => { setAuthRole('jobseeker'); setAuthMode('login'); setIsAuthPageActive(true); }}
            onProfileClick={() => setActivePortal('profile')}
          />

          <main className="container mx-auto px-4 sm:px-6 py-6 sm:py-10 max-w-7xl flex-1 flex flex-col">
        {legalPage ? (
          <LegalPages type={legalPage} onBack={() => setLegalPage(null)} />
        ) : (
          <>
            <div className="flex-1">
                {activePortal === 'profile' ? (
                    <ProfilePage 
                        profile={profile} 
                        user={user}
                        onUpdate={updateProfile}
                        onBack={() => setActivePortal('seeker')}
                    />
                ) : activePortal === 'admin' ? (
                    <AdminDashboard onBack={() => setActivePortal('seeker')} />
                ) : activePortal === 'recruiter' ? (
                    <RecruiterDashboard user={user} />
                ) : (
                  <div className="max-w-4xl mx-auto transition-all duration-500 ease-in-out">
                    <div className="space-y-6 sm:space-y-8">
                      {/* Apple-style Hero */}
                      <div className="text-center mb-8 sm:mb-12">
                        <h1 className="text-3xl sm:text-5xl font-bold text-gray-900 tracking-tight leading-tight">
                          Match Your Resume.<br />
                          <span className="text-gray-400">Land the Job.</span>
                        </h1>
                        <p className="mt-3 sm:mt-4 text-lg sm:text-xl text-gray-500 font-medium max-w-2xl mx-auto leading-relaxed px-2">
                          Instant AI scoring and optimization tailored to your target role.
                        </p>
                      </div>

                      {activeTab === 'input' && (
                        <div className="grid grid-cols-1 gap-6 animate-scale-in">
                          
                          {/* Seeker Tool Tabs */}
                          <div className="flex justify-center w-full">
                            <div className="bg-gray-200/50 p-1 rounded-xl flex sm:inline-flex backdrop-blur-md w-full sm:w-auto">
                                 <button 
                                    onClick={() => handleToolChange('analyzer')}
                                    className={`flex-1 sm:flex-none px-4 sm:px-6 py-2 rounded-lg text-sm font-semibold transition-all duration-300 ease-[cubic-bezier(0.25,0.1,0.25,1)] ${
                                        seekerTool === 'analyzer' 
                                        ? 'bg-white text-gray-900 shadow-sm scale-100' 
                                        : 'text-gray-500 hover:text-gray-700 scale-95'
                                    }`}
                                 >
                                    Resume Analyzer
                                 </button>
                                 <button 
                                    onClick={() => handleToolChange('interview')}
                                    className={`flex-1 sm:flex-none px-4 sm:px-6 py-2 rounded-lg text-sm font-semibold transition-all duration-300 ease-[cubic-bezier(0.25,0.1,0.25,1)] ${
                                        seekerTool === 'interview' 
                                        ? 'bg-white text-gray-900 shadow-sm scale-100' 
                                        : 'text-gray-500 hover:text-gray-700 scale-95'
                                    }`}
                                 >
                                    AI Interview Prep
                                 </button>
                            </div>
                          </div>

                          {seekerTool === 'analyzer' ? (
                            <>
                              <div className="bg-white rounded-3xl p-1 shadow-apple-card border border-white/60">
                                <div className="p-4 sm:p-8 space-y-6 sm:space-y-8">
                                  <JobDescriptionInput value={jobDescription} onChange={setJobDescription} />
                                  <div className="h-px bg-gray-100 w-full"></div>
                                  {profile?.resumes?.map((resume) => (
                                    <div 
                                      key={resume.id}
                                      onClick={() => setSelectedResumeId(resume.id)}
                                      className={`mb-3 p-4 rounded-2xl border flex items-center justify-between animate-in fade-in slide-in-from-top-2 cursor-pointer transition-all ${
                                        selectedResumeId === resume.id 
                                          ? 'bg-blue-50/80 border-system-blue/30 shadow-sm' 
                                          : 'bg-gray-50/50 border-gray-100 hover:border-gray-200'
                                      }`}
                                    >
                                      <div className="flex items-center gap-4">
                                        <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all ${
                                          selectedResumeId === resume.id ? 'border-system-blue' : 'border-gray-300'
                                        }`}>
                                          {selectedResumeId === resume.id && <div className="w-2.5 h-2.5 bg-system-blue rounded-full" />}
                                        </div>
                                        <div className="w-10 h-10 bg-white rounded-lg shadow-sm flex items-center justify-center text-system-blue">
                                          <FileText className="w-5 h-5" />
                                        </div>
                                        <div className="flex-1 min-w-0">
                                          <p className="text-sm font-bold text-gray-900 truncate">{resume.name}</p>
                                          <p className="text-[10px] text-gray-500 font-medium uppercase tracking-wider">
                                            {new Date(resume.uploadedAt).toLocaleDateString()}
                                          </p>
                                        </div>
                                      </div>
                                      <div className="flex items-center gap-1">
                                        <button 
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            setViewingResume(resume);
                                          }}
                                          className="p-1.5 text-gray-400 hover:text-system-blue transition-colors"
                                          title="View Resume"
                                        >
                                          <Eye className="w-4 h-4" />
                                        </button>
                                        <button 
                                          onClick={async (e) => {
                                            e.stopPropagation();
                                            if (user) {
                                              await updateProfile({ 
                                                resumes: profile?.resumes?.filter(r => r.id !== resume.id) || []
                                              });
                                              if (selectedResumeId === resume.id) setSelectedResumeId(null);
                                            }
                                          }}
                                          className="p-1.5 text-gray-400 hover:text-red-500 transition-colors"
                                          title="Delete Resume"
                                        >
                                          <TrashIcon className="w-4 h-4" />
                                        </button>
                                      </div>
                                    </div>
                                  ))}

{(!profile?.resumes || profile.resumes.length === 0 || !selectedResumeId) && (
  <ResumeUploader file={resumeFile} onFileChange={setResumeFile} />
)}

<div className="text-center py-4">
  <button 
    onClick={() => {
      setResumeFile(null);
      setSelectedResumeId(null);
    }}
    className="text-xs text-system-blue font-bold hover:underline underline-offset-4"
  >
    Upload a new resume
  </button>
</div>
</div>
</div>

<div className="flex justify-center pt-2 sm:pt-4">
<button
onClick={handleAnalyze}
disabled={isButtonDisabled}
className="group relative flex items-center justify-center gap-2 w-full sm:w-auto px-8 py-4 bg-system-blue text-white text-lg font-semibold rounded-full shadow-apple-button hover:bg-system-blue-hover hover:scale-[1.02] active:scale-[0.98] transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100 disabled:shadow-none min-w-[240px]"
>
<SparklesIcon className="w-5 h-5 transition-transform group-hover:rotate-12" />
<span>{isLoading ? 'Analyzing...' : 'Analyze Resume'}</span>
</button>
</div>
</>
) : (
<InterviewQuestionPredictor 
    initialJobDescription={jobDescription}
    resumeFile={resumeFile}
    user={user}
/>
)}
</div>
)}

{activeTab === 'results' && (
  <ResultsDisplay 
    result={analysisResult} 
    isLoading={isLoading} 
    error={error} 
    onResumeReset={handleReset} 
    originalResumeName={resumeFile?.name || profile?.resumes?.find(r => r.id === selectedResumeId)?.name}
    onUpdateResume={handleUpdateResume}
    resumeFile={resumeFile}
    jobDescription={jobDescription}
    user={user}
    onAskAI={() => {
        setSeekerTool('interview');
        setActiveTab('input');
    }}
/>
)}
</div>
</div>
)}
</div>

{/* Resume Viewer Modal */}
{viewingResume && (
<div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-black/60 backdrop-blur-md animate-in fade-in duration-300">
<div className="bg-white rounded-[2rem] shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-300">
<div className="p-6 border-b border-gray-100 flex items-center justify-between bg-gray-50/50">
  <div className="flex items-center gap-3">
    <div className="p-2 bg-white rounded-xl shadow-sm">
      <FileText className="w-5 h-5 text-system-blue" />
    </div>
    <div>
      <h3 className="text-lg font-bold text-gray-900">{viewingResume.name}</h3>
      <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest">Uploaded on {new Date(viewingResume.uploadedAt).toLocaleDateString()}</p>
    </div>
  </div>
  <button 
    onClick={() => setViewingResume(null)}
    className="p-2 hover:bg-gray-100 rounded-full transition-colors"
  >
    <RefreshCw className="w-5 h-5 text-gray-400 rotate-45" />
  </button>
</div>
<div className="flex-1 overflow-y-auto p-8 bg-white">
  <pre className="whitespace-pre-wrap font-sans text-sm text-gray-700 leading-relaxed">
    {viewingResume.text}
  </pre>
</div>
<div className="p-6 border-t border-gray-100 flex justify-end bg-gray-50/50">
  <button 
    onClick={() => setViewingResume(null)}
    className="px-8 py-2.5 bg-system-blue text-white font-bold rounded-xl hover:bg-system-blue-hover transition-all"
  >
    Close Preview
  </button>
</div>
</div>
</div>
)}

{/* Unified Footer */}
            <div className="mt-12 border-t border-gray-200/60 pt-8 pb-4 text-center">
                <p className="text-[10px] text-gray-400 font-medium tracking-wide uppercase mb-3">
                    Secure Processing • Encrypted in Transit • Private
                </p>
                <div className="flex flex-wrap justify-center gap-x-6 gap-y-2">
                  <button 
                      onClick={() => setLegalPage('terms')}
                      className="text-xs text-gray-500 hover:text-system-blue transition-colors hover:underline underline-offset-2"
                  >
                      Terms & Conditions
                  </button>
                  <button 
                      onClick={() => setLegalPage('privacy')}
                      className="text-xs text-gray-500 hover:text-system-blue transition-colors hover:underline underline-offset-2"
                  >
                      Privacy Policy
                  </button>
                  <button 
                      onClick={() => setLegalPage('refund')}
                      className="text-xs text-gray-500 hover:text-system-blue transition-colors hover:underline underline-offset-2"
                  >
                      Refund Policy
                  </button>
                </div>
            </div>

            {/* Contact Info Modal */}
            {showContactModal && (
              <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-in fade-in duration-300">
                <div className="bg-white rounded-[2rem] shadow-2xl w-full max-w-md p-8 animate-in zoom-in-95 duration-300">
                  <div className="flex items-center gap-3 mb-6">
                    <div className="p-2 bg-amber-50 rounded-xl">
                      <SparklesIcon className="w-5 h-5 text-amber-500" />
                    </div>
                    <h3 className="text-xl font-bold text-gray-900">Missing Contact Info</h3>
                  </div>
                  
                  <p className="text-sm text-gray-500 mb-6 leading-relaxed">
                    We noticed your resume is missing some contact details. Adding them helps recruiters reach you faster.
                  </p>
                  
                  <div className="space-y-4 mb-8">
                    {missingContactInfo.email && (
                      <div>
                        <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1.5 pl-1">Email Address</label>
                        <input 
                          type="email" 
                          value={contactForm.email}
                          onChange={(e) => setContactForm(prev => ({ ...prev, email: e.target.value }))}
                          placeholder="e.g. name@example.com"
                          className="w-full px-4 py-3 bg-gray-50 border border-gray-100 rounded-xl text-sm outline-none focus:ring-2 focus:ring-system-blue/20 transition-all"
                        />
                      </div>
                    )}
                    {missingContactInfo.phone && (
                      <div>
                        <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1.5 pl-1">Phone Number</label>
                        <input 
                          type="tel" 
                          value={contactForm.phone}
                          onChange={(e) => setContactForm(prev => ({ ...prev, phone: e.target.value }))}
                          placeholder="e.g. +1 234 567 890"
                          className="w-full px-4 py-3 bg-gray-50 border border-gray-100 rounded-xl text-sm outline-none focus:ring-2 focus:ring-system-blue/20 transition-all"
                        />
                      </div>
                    )}
                  </div>
                  
                  <div className="flex gap-3">
                    <button 
                      onClick={() => setShowContactModal(false)}
                      className="flex-1 px-6 py-3 bg-gray-100 text-gray-600 font-bold rounded-xl hover:bg-gray-200 transition-all"
                    >
                      Skip
                    </button>
                    <button 
                      onClick={handleFixContactInfo}
                      className="flex-1 px-6 py-3 bg-system-blue text-white font-bold rounded-xl hover:bg-system-blue-hover transition-all shadow-lg shadow-system-blue/20"
                    >
                      Update Resume
                    </button>
                  </div>
                </div>
              </div>
            )}
          </>
        )}
      </main>
    </>
  )}
</div>
  );
};

export default App;
