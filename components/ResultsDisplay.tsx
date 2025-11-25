import React, { useState, useEffect } from 'react';
import type { AnalysisResult } from '../types';
import { ScoreCard } from './ScoreCard';
import { BreakdownAccordion } from './BreakdownAccordion';
import { SuggestionsList } from './SuggestionsList';
import { ResumeView } from './ResumeView';
import { RecruiterScan } from './RecruiterScan';

interface ResultsDisplayProps {
  result: AnalysisResult | null;
  isLoading: boolean;
  error: string | null;
  onResumeReset: () => void;
  originalResumeName: string | undefined;
  onUpdateResume: (newText: string) => void;
  resumeFile?: File | null;
  jobDescription?: string;
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
    <div className="flex flex-col items-center justify-center py-32 animate-scale-in">
      <div className="relative w-16 h-16 mb-6">
        <svg className="animate-spin-slow w-full h-full text-gray-200" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"></circle>
            <path className="opacity-75 text-system-blue" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
        </svg>
      </div>
      <h2 className="text-xl font-semibold text-gray-900 tracking-tight mb-2">Analyzing Resume</h2>
      <p className="text-gray-500 font-medium text-sm">{statusText}...</p>
      <div className="w-64 h-1 bg-gray-200 rounded-full mt-6 overflow-hidden">
        <div 
            className="h-full bg-system-blue rounded-full transition-all duration-700 ease-out" 
            style={{ width: `${progress}%` }} 
        />
      </div>
    </div>
  );
};

const ErrorState: React.FC<{ error: string, onResumeReset: () => void }> = ({ error, onResumeReset }) => (
  <div className="max-w-md mx-auto py-20 text-center animate-scale-in">
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
  result, isLoading, error, onResumeReset, originalResumeName, onUpdateResume, resumeFile, jobDescription
}) => {
  const [view, setView] = useState<'analysis' | 'scan'>('analysis');

  if (isLoading) return <LoadingState />;
  if (error) return <ErrorState error={error} onResumeReset={onResumeReset} />;
  if (!result) return null;
  
  return (
    <div className="space-y-8 animate-[fadeIn_0.6s_ease-out]">
      {/* View Switcher - iOS Segmented Control */}
      <div className="flex flex-col sm:flex-row justify-between items-center gap-4">
        <div className="bg-gray-200/50 p-1 rounded-xl inline-flex backdrop-blur-md">
             <button 
                onClick={() => setView('analysis')}
                className={`px-6 py-2 rounded-lg text-sm font-semibold transition-all duration-300 ease-[cubic-bezier(0.25,0.1,0.25,1)] ${
                    view === 'analysis' 
                    ? 'bg-white text-gray-900 shadow-sm scale-100' 
                    : 'text-gray-500 hover:text-gray-700 scale-95'
                }`}
             >
                Deep Analysis
             </button>
             <button 
                onClick={() => setView('scan')}
                className={`px-6 py-2 rounded-lg text-sm font-semibold transition-all duration-300 ease-[cubic-bezier(0.25,0.1,0.25,1)] ${
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
          className="text-sm font-medium text-system-blue hover:text-blue-700 transition-colors"
        >
          Start New Analysis
        </button>
      </div>

      {view === 'analysis' ? (
          <>
            <ScoreCard score={result.match_score} verdict={result.verdict} explanations={result.explanations} />
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                <div className="space-y-8">
                    <SuggestionsList items={result.missing_items_prioritized} />
                    <BreakdownAccordion breakdown={result.breakdown} />
                </div>
                <div className="h-full">
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
    </div>
  );
};