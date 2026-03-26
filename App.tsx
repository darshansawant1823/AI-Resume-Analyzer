
import React, { useState, useCallback, useEffect } from 'react';
import { onAuthStateChanged, User } from 'firebase/auth';
import { auth } from './src/firebase';
import { useFirestoreSync } from './src/hooks/useFirebase';
import { useInterviewData } from './src/hooks/useInterviewData';
import { AuthPage } from './src/components/AuthPage';
import { ProfilePage } from './components/ProfilePage';
import type { AnalysisResult } from './types';
import { analyzeResume } from './services/geminiService';
import { Header } from './components/Header';
import { JobDescriptionInput } from './components/JobDescriptionInput';
import { ResumeUploader } from './components/ResumeUploader';
import { ResultsDisplay } from './components/ResultsDisplay';
import { SparklesIcon } from './components/icons/SparklesIcon';
import { RecruiterDashboard } from './components/RecruiterDashboard';
import { AdminDashboard } from './components/AdminDashboard';
import { TermsAndConditions } from './components/TermsAndConditions';
import { InterviewQuestionPredictor } from './components/InterviewQuestionPredictor';

import { useRecruiterData } from './src/hooks/useRecruiterData';
import { RefreshCw } from 'lucide-react';

const App: React.FC = () => {
  const [user, setUser] = useState<User | null>(null);
  const { profile, updateProfile, loading: profileLoading } = useFirestoreSync(user);

  const { clearAllData: clearRecruiterData } = useRecruiterData(user);
  const { clearAllData: clearInterviewData, saveInterview } = useInterviewData(user);

  useEffect(() => {
    if (user) {
      const sessionKey = `app_session_cleared_${user.uid}`;
      if (!sessionStorage.getItem(sessionKey)) {
        clearRecruiterData();
        clearInterviewData();
        sessionStorage.setItem(sessionKey, 'true');
      }
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
  const [showTerms, setShowTerms] = useState(false);
  const [seekerTool, setSeekerTool] = useState<'analyzer' | 'interview'>('analyzer');

  useEffect(() => {
    // Force logout on app refresh/initial load as requested
    const forceLogout = async () => {
      try {
        await auth.signOut();
      } catch (err) {
        console.error("Error during force logout on refresh:", err);
      }
    };
    forceLogout();

    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      if (currentUser) {
        setIsAuthPageActive(false);
      }
    });
    return () => unsubscribe();
  }, []);

  const handlePortalChange = (portal: 'seeker' | 'recruiter' | 'admin' | 'profile') => {
    if (portal === 'recruiter' && !user) {
      setAuthRole('recruiter');
      setAuthMode('login');
      setIsAuthPageActive(true);
      return;
    }
    if (portal === 'admin' && profile?.role !== 'admin') {
      return;
    }
    setActivePortal(portal);
    setShowTerms(false);
  };

  const handleToolChange = (tool: 'analyzer' | 'interview') => {
    if (tool === 'interview' && !user) {
      setAuthRole('jobseeker');
      setAuthMode('login');
      setIsAuthPageActive(true);
      return;
    }
    setSeekerTool(tool);
  };

  const [jobDescription, setJobDescription] = useState<string>('');
  const [resumeFile, setResumeFile] = useState<File | null>(null);
  const [analysisResult, setAnalysisResult] = useState<AnalysisResult | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'input' | 'results'>('input');
  
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

  const handleAnalyze = useCallback(async () => {
    if (!jobDescription || !resumeFile) {
      setError('Please provide both a job description and a resume file.');
      return;
    }
    setError(null);
    setIsLoading(true);
    setAnalysisResult(null);
    setActiveTab('results');

    try {
      let resumePayload: { text?: string; base64Data?: string; mimeType?: string; } = {};
      if (resumeFile.type.startsWith('image/') || resumeFile.type === 'application/pdf') {
        const { base64Data, mimeType } = await fileToBase64(resumeFile);
        resumePayload = { base64Data, mimeType };
      } else {
        const text = await resumeFile.text();
        resumePayload = { text };
      }

      const result = await analyzeResume(jobDescription, resumePayload);
      setAnalysisResult(result);
      if (user) {
        await saveInterview({
          type: 'analysis',
          jobDescription,
          resumeName: resumeFile.name,
          result
        });
      }
    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? `An error occurred: ${err.message}` : 'An unknown error occurred.');
      setActiveTab('input');
    } finally {
      setIsLoading(false);
    }
  }, [jobDescription, resumeFile]);

  const handleReset = () => {
    setJobDescription('');
    setResumeFile(null);
    setAnalysisResult(null);
    setError(null);
    setIsLoading(false);
    setActiveTab('input');
    const fileInput = document.getElementById('resume-upload') as HTMLInputElement;
    if(fileInput) fileInput.value = '';
  };

  const handleUpdateResume = (newText: string) => {
    setAnalysisResult(prevResult => {
      if (!prevResult) return null;
      return { ...prevResult, custom_resume_text: newText };
    });
  };
  
  const isButtonDisabled = !jobDescription || !resumeFile || isLoading;

  const handleShowTerms = () => {
    setShowTerms(true);
  };

  const handleLogoClick = () => {
    setActivePortal('seeker');
    setSeekerTool('analyzer');
    setShowTerms(false);
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
        {showTerms ? (
          <TermsAndConditions />
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
                                  <ResumeUploader file={resumeFile} onFileChange={setResumeFile} />
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
                            originalResumeName={resumeFile?.name}
                            onUpdateResume={handleUpdateResume}
                            resumeFile={resumeFile}
                            jobDescription={jobDescription}
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

            {/* Unified Footer */}
            <div className="mt-12 border-t border-gray-200/60 pt-8 pb-4 text-center">
                <p className="text-[10px] text-gray-400 font-medium tracking-wide uppercase mb-3">
                    Secure Processing • Encrypted in Transit • Private
                </p>
                <button 
                    onClick={handleShowTerms}
                    className="text-xs text-gray-500 hover:text-system-blue transition-colors hover:underline underline-offset-2"
                >
                    Terms & Conditions
                </button>
            </div>
          </>
        )}
      </main>
    </>
  )}
</div>
  );
};

export default App;
