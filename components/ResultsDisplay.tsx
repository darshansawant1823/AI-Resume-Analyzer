
import React, { useState, useEffect } from 'react';
import type { AnalysisResult } from '../types';
import { ScoreCard } from './ScoreCard';
import { BreakdownAccordion } from './BreakdownAccordion';
import { SuggestionsList } from './SuggestionsList';
import { ResumeView } from './ResumeView';
import { RecruiterScan } from './RecruiterScan';
import { RefreshCw, Sparkles } from 'lucide-react';

interface ResultsDisplayProps {
  result: AnalysisResult | null;
  isLoading: boolean;
  error: string | null;
  onResumeReset: () => void;
  originalResumeName: string | undefined;
  onUpdateResume: (newText: string) => void;
  resumeFile?: File | null;
  jobDescription?: string;
  onAskAI?: () => void;
}

const LoadingState: React.FC = () => {
  const [progress, setProgress] = useState(0);
  const [statusText, setStatusText] = useState("Initializing");

  const pipeline = [
    { percent: 10, text: "Reading document", duration: 800 },
    { percent: 30, text: "Analyzing skills", duration: 1500 },
    { percent: 50, text: "Checking job requirements", duration: 1500 },
    { percent: 70, text: "Optimizing content", duration: 2000 },
    { percent: 90, text: "Finalizing report", duration: 1000 },
  ];

  useEffect(() => {
    let cumulativeDelay = 0;
    const timers = pipeline.map((stage) => {
      const timer = setTimeout(() => {
        setProgress(stage.percent);
        setStatusText(stage.text);
      }, cumulativeDelay);
      cumulativeDelay += stage.duration;
      return timer;
    });
    return () => timers.forEach(clearTimeout);
  }, []);

  return (
    <div className="flex flex-col items-center justify-center py-20 sm:py-32 animate-scale-in">
      <div className="relative w-12 h-12 sm:w-16 sm:h-16 mb-6">
        <svg className="animate-spin-slow w-full h-full text-gray-200" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"></circle>
            <path className="opacity-75 text-system-blue" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
        </svg>
      </div>
      <h2 className="text-lg sm:text-xl font-semibold text-gray-900 tracking-tight mb-2">Analyzing Resume</h2>
      <p className="text-gray-500 font-medium text-xs sm:text-sm">{statusText}...</p>
      <div className="w-48 sm:w-64 h-1 bg-gray-200 rounded-full mt-6 overflow-hidden">
        <div 
            className="h-full bg-system-blue rounded-full transition-all duration-700 ease-out" 
            style={{ width: `${progress}%` }} 
        />
      </div>
    </div>
  );
};

const ErrorState: React.FC<{ error: string, onResumeReset: () => void }> = ({ error, onResumeReset }) => (
  <div className="max-w-md mx-auto py-20 text-center animate-scale-in px-4">
    <div className="w-16 h-16 bg-red-50 rounded-full flex items-center justify-center mx-auto mb-6 text-system-red">
        <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="15" y1="9" x2="9" y2="15"></line><line x1="9" y1="9" x2="15" y2="15"></line></svg>
    </div>
    <h2 className="text-xl font-bold text-gray-900 mb-2">Analysis Failed</h2>
    <p className="text-gray-500 mb-8 leading-relaxed">{error}</p>
    <button
        onClick={onResumeReset}
        className="px-6 py-2.5 bg-gray-900 text-white font-medium rounded-full hover:bg-black transition-colors shadow-lg"
    >
        Try Again
    </button>
  </div>
);

export const ResultsDisplay: React.FC<ResultsDisplayProps> = ({ 
  result, isLoading, error, onResumeReset, originalResumeName, onUpdateResume, resumeFile, jobDescription, onAskAI
}) => {
  const [view, setView] = useState<'analysis' | 'scan'>('analysis');

  if (isLoading) return <LoadingState />;
  if (error) return <ErrorState error={error} onResumeReset={onResumeReset} />;
  if (!result) return null;
  
  return (
    <div className="space-y-6 sm:space-y-8 animate-[fadeIn_0.6s_ease-out]">
      {/* View Switcher - iOS Segmented Control */}
      <div className="flex flex-col sm:flex-row justify-between items-center gap-4">
        <div className="bg-gray-200/50 p-1 rounded-xl flex w-full sm:w-auto backdrop-blur-md">
             <button 
                onClick={() => setView('analysis')}
                className={`flex-1 sm:flex-none px-4 sm:px-6 py-2 rounded-lg text-sm font-semibold transition-all duration-300 ease-[cubic-bezier(0.25,0.1,0.25,1)] ${
                    view === 'analysis' 
                    ? 'bg-white text-gray-900 shadow-sm scale-100' 
                    : 'text-gray-500 hover:text-gray-700 scale-95'
                }`}
             >
                Deep Analysis
             </button>
             <button 
                onClick={() => setView('scan')}
                className={`flex-1 sm:flex-none px-4 sm:px-6 py-2 rounded-lg text-sm font-semibold transition-all duration-300 ease-[cubic-bezier(0.25,0.1,0.25,1)] ${
                    view === 'scan' 
                    ? 'bg-white text-gray-900 shadow-sm scale-100' 
                    : 'text-gray-500 hover:text-gray-700 scale-95'
                }`}
             >
                Recruiter Scan
             </button>
        </div>
        <button
          onClick={onResumeReset}
          className="text-sm font-medium text-system-blue hover:text-blue-700 transition-colors py-2"
        >
          Start New Analysis
        </button>
      </div>

      {view === 'analysis' ? (
          <>
            <ScoreCard score={result.match_score} verdict={result.verdict} explanations={result.explanations} />
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 sm:gap-8">
                <div className="space-y-6 sm:space-y-8">
                    <SuggestionsList items={result.missing_items_prioritized} />
                    <BreakdownAccordion breakdown={result.breakdown} />
                </div>
                <div className="h-auto lg:h-full">
                    <ResumeView 
                        customResume={result.custom_resume_text} 
                        diffSummary={result.diff_summary} 
                        coverLine={result.cover_line}
                        coverLetter={result.cover_letter}
                        rewrittenAchievements={result.top_3_rewritten_achievements}
                        originalResumeName={originalResumeName}
                        onUpdateResume={onUpdateResume}
                    />
                </div>
            </div>
          </>
      ) : (
          <RecruiterScan jobDescription={jobDescription || ''} resumeFile={resumeFile || null} />
      )}

      {/* Floating Action Bar for Job Seeker */}
      <div className="fixed bottom-8 left-1/2 -translate-x-1/2 z-[60] animate-[slideUp_0.4s_cubic-bezier(0.16,1,0.3,1)]">
          <div className="bg-gray-900/95 backdrop-blur-xl border border-white/10 rounded-full px-4 py-2.5 sm:px-6 sm:py-3 shadow-2xl flex items-center gap-4 text-white">
              <div className="relative group">
                  <button 
                      onClick={() => {
                          if (window.confirm("All the JD and candidate from the list will be removed. Are you sure?")) {
                              onResumeReset();
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
              
              <div className="w-px h-6 bg-white/10 mx-1"></div>

              <button 
                  onClick={onResumeReset}
                  className="px-4 py-2 bg-white text-gray-900 rounded-full text-xs font-bold hover:bg-gray-100 transition-all active:scale-95"
              >
                  New Analysis
              </button>

              {onAskAI && (
                  <>
                    <div className="w-px h-6 bg-white/10 mx-1"></div>
                    <button 
                        onClick={onAskAI}
                        className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-full text-xs font-bold hover:bg-indigo-700 transition-all active:scale-95"
                    >
                        <Sparkles className="w-4 h-4" />
                        Ask AI
                    </button>
                  </>
              )}
          </div>
      </div>
    </div>
  );
};
