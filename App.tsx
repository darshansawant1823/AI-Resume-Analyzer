
import React, { useState, useCallback } from 'react';
import type { AnalysisResult } from './types';
import { analyzeResume } from './services/geminiService';
import { Header } from './components/Header';
import { JobDescriptionInput } from './components/JobDescriptionInput';
import { ResumeUploader } from './components/ResumeUploader';
import { ResultsDisplay } from './components/ResultsDisplay';
import { SparklesIcon } from './components/icons/SparklesIcon';
import { RecruiterDashboard } from './components/RecruiterDashboard';
import { TermsAndConditions } from './components/TermsAndConditions';
import { InterviewQuestionPredictor } from './components/InterviewQuestionPredictor';

const App: React.FC = () => {
  const [activePortal, setActivePortal] = useState<'seeker' | 'recruiter'>('seeker');
  const [showTerms, setShowTerms] = useState(false);
  const [seekerTool, setSeekerTool] = useState<'analyzer' | 'interview'>('analyzer');

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

  const handlePortalChange = (portal: 'seeker' | 'recruiter') => {
    setActivePortal(portal);
    setShowTerms(false);
  };

  const handleShowTerms = () => {
    setShowTerms(true);
  };

  return (
    <div className="min-h-screen bg-system-bg font-sans selection:bg-system-blue/20 selection:text-system-blue">
      <Header 
        activePortal={activePortal} 
        onPortalChange={handlePortalChange} 
        onShowTerms={handleShowTerms}
      />

      <main className="container mx-auto px-4 sm:px-6 py-10 max-w-7xl">
        {showTerms ? (
          <TermsAndConditions />
        ) : (
          <>
            {activePortal === 'recruiter' ? (
                <RecruiterDashboard />
            ) : (
              <div className="max-w-4xl mx-auto transition-all duration-500 ease-in-out">
                <div className="space-y-8">
                  {/* Apple-style Hero */}
                  <div className="text-center mb-12">
                    <h1 className="text-4xl sm:text-5xl font-bold text-gray-900 tracking-tight leading-tight">
                      Match Your Resume.<br />
                      <span className="text-gray-400">Land the Job.</span>
                    </h1>
                    <p className="mt-4 text-xl text-gray-500 font-medium max-w-2xl mx-auto leading-relaxed">
                      Instant AI scoring and optimization tailored to your target role.
                    </p>
                  </div>

                  {activeTab === 'input' && (
                    <div className="grid grid-cols-1 gap-6 animate-scale-in">
                      
                      {/* Seeker Tool Tabs */}
                      <div className="flex justify-center">
                        <div className="bg-gray-200/50 p-1 rounded-xl inline-flex backdrop-blur-md">
                             <button 
                                onClick={() => setSeekerTool('analyzer')}
                                className={`px-6 py-2 rounded-lg text-sm font-semibold transition-all duration-300 ease-[cubic-bezier(0.25,0.1,0.25,1)] ${
                                    seekerTool === 'analyzer' 
                                    ? 'bg-white text-gray-900 shadow-sm scale-100' 
                                    : 'text-gray-500 hover:text-gray-700 scale-95'
                                }`}
                             >
                                Resume Analyzer
                             </button>
                             <button 
                                onClick={() => setSeekerTool('interview')}
                                className={`px-6 py-2 rounded-lg text-sm font-semibold transition-all duration-300 ease-[cubic-bezier(0.25,0.1,0.25,1)] ${
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
                            <div className="p-6 sm:p-8 space-y-8">
                              <JobDescriptionInput value={jobDescription} onChange={setJobDescription} />
                              <div className="h-px bg-gray-100 w-full"></div>
                              <ResumeUploader file={resumeFile} onFileChange={setResumeFile} />
                            </div>
                          </div>
                          
                          <div className="flex justify-center pt-4">
                            <button
                              onClick={handleAnalyze}
                              disabled={isButtonDisabled}
                              className="group relative flex items-center justify-center gap-2 px-8 py-4 bg-system-blue text-white text-lg font-semibold rounded-full shadow-apple-button hover:bg-system-blue-hover hover:scale-[1.02] active:scale-[0.98] transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100 disabled:shadow-none min-w-[240px]"
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
                    />
                  )}

                  <p className="text-center text-[11px] text-gray-400 mt-12 font-medium tracking-wide uppercase">
                    Secure Processing • Encrypted in Transit • Private
                  </p>
                </div>
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
};

export default App;
