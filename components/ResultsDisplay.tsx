
import React, { useState, useEffect } from 'react';
import type { AnalysisResult } from '../types';
import { ScoreCard } from './ScoreCard';
import { BreakdownAccordion } from './BreakdownAccordion';
import { SuggestionsList } from './SuggestionsList';
import { ResumeView } from './ResumeView';
import { RecruiterScan } from './RecruiterScan';
import { RefreshCw, Sparkles, AlertCircle, CheckCircle2, TrendingUp, Target, BrainCircuit, MessageSquareQuote, Briefcase, Compass, ArrowRight, Map, Activity, Trophy, Zap, Download, Check } from 'lucide-react';
import { User } from 'firebase/auth';
import { Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, ResponsiveContainer, Tooltip } from 'recharts';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';

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
  user: User | null;
}

const LoadingState: React.FC = () => {
  const [progress, setProgress] = useState(0);
  const [statusText, setStatusText] = useState("Initializing");
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

    const quoteTimer = setInterval(() => {
      setCurrentQuote((prev) => (prev + 1) % quotes.length);
    }, 4000);

    return () => {
      timers.forEach(clearTimeout);
      clearInterval(quoteTimer);
    };
  }, []);

  return (
    <div className="flex flex-col items-center justify-center py-20 sm:py-32 animate-scale-in max-w-2xl mx-auto px-4">
      <div className="relative w-12 h-12 sm:w-16 sm:h-16 mb-8">
        <svg className="animate-spin-slow w-full h-full text-gray-200" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"></circle>
            <path className="opacity-75 text-system-blue" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
        </svg>
      </div>
      
      <div className="text-center space-y-4 mb-10 min-h-[80px] flex flex-col justify-center">
        <p className="text-system-blue font-bold text-[10px] uppercase tracking-widest animate-pulse">
          {statusText}...
        </p>
        <h2 className="text-lg sm:text-xl font-medium text-gray-800 italic leading-relaxed animate-in fade-in slide-in-from-bottom-2 duration-700" key={currentQuote}>
          "{quotes[currentQuote]}"
        </h2>
      </div>

      <div className="w-48 sm:w-64 h-1.5 bg-gray-100 rounded-full overflow-hidden shadow-inner">
        <div 
            className="h-full bg-system-blue rounded-full transition-all duration-700 ease-out shadow-[0_0_8px_rgba(0,122,255,0.4)]" 
            style={{ width: `${progress}%` }} 
        />
      </div>
      <p className="mt-4 text-[10px] font-bold text-gray-400 uppercase tracking-tighter">
        Analyzing Resume
      </p>
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
  result, isLoading, error, onResumeReset, originalResumeName, onUpdateResume, resumeFile, jobDescription, onAskAI, user
}) => {
  const [view, setView] = useState<'analysis' | 'scan'>('analysis');
  const [selectedPath, setSelectedPath] = useState<AnalysisResult['career_path_suggestions'][0] | null>(null);
  const [isExporting, setIsExporting] = useState(false);

  const handleDownloadPDF = async () => {
    if (!result) return;
    setIsExporting(true);

    try {
      const doc = new jsPDF();
      const pageWidth = doc.internal.pageSize.getWidth();
      const margin = 20;
      let currentY = 20;

      // Header
      doc.setFontSize(22);
      doc.setTextColor(0, 122, 255); // system-blue
      doc.text('RESUME AI INTELLIGENCE', margin, currentY);
      currentY += 10;

      doc.setFontSize(14);
      doc.setTextColor(100, 100, 100);
      doc.text('Deep Analysis Report', margin, currentY);
      doc.setFontSize(10);
      doc.text(`Generated on: ${new Date().toLocaleDateString()}`, pageWidth - margin - 40, currentY);
      currentY += 15;

      // Candidate & JD Info
      doc.setDrawColor(230, 230, 230);
      doc.line(margin, currentY, pageWidth - margin, currentY);
      currentY += 10;

      doc.setFontSize(12);
      doc.setTextColor(0, 0, 0);
      doc.setFont('helvetica', 'bold');
      doc.text('Candidate:', margin, currentY);
      doc.setFont('helvetica', 'normal');
      doc.text(originalResumeName || 'Anonymous Candidate', margin + 25, currentY);
      currentY += 7;

      doc.setFont('helvetica', 'bold');
      doc.text('Target Role:', margin, currentY);
      doc.setFont('helvetica', 'normal');
      const jdTitle = jobDescription?.split('\n')[0].substring(0, 50) || 'Not specified';
      doc.text(jdTitle + (jdTitle.length >= 50 ? '...' : ''), margin + 25, currentY);
      currentY += 15;

      // Overall Score
      doc.setFillColor(245, 247, 250);
      doc.roundedRect(margin, currentY, pageWidth - (margin * 2), 30, 3, 3, 'F');
      
      doc.setFontSize(10);
      doc.setTextColor(100, 100, 100);
      doc.text('MATCH SCORE', margin + 10, currentY + 12);
      
      doc.setFontSize(24);
      const scoreColor = result.match_score >= 80 ? [52, 199, 89] : result.match_score >= 60 ? [255, 149, 0] : [255, 59, 48];
      doc.setTextColor(scoreColor[0], scoreColor[1], scoreColor[2]);
      doc.text(`${result.match_score}%`, margin + 10, currentY + 22);

      doc.setFontSize(12);
      doc.setFont('helvetica', 'bold');
      doc.text(result.verdict.toUpperCase(), margin + 60, currentY + 18);
      currentY += 40;

      // Explanations
      doc.setFontSize(12);
      doc.setTextColor(0, 0, 0);
      doc.text('Key Insights', margin, currentY);
      currentY += 7;
      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(60, 60, 60);
      
      result.explanations.slice(0, 3).forEach(exp => {
        const lines = doc.splitTextToSize(`• ${exp}`, pageWidth - (margin * 2));
        doc.text(lines, margin, currentY);
        currentY += (lines.length * 5) + 2;
      });
      currentY += 5;

      // Score Breakdown Table
      doc.setFontSize(12);
      doc.setTextColor(0, 0, 0);
      doc.setFont('helvetica', 'bold');
      doc.text('Detailed Score Breakdown', margin, currentY);
      currentY += 5;

      const breakdownData = [
        ['Category', 'Score', 'Key Details'],
        ['Core Skills', `${result.breakdown.core_skills.score}/30`, result.breakdown.core_skills.details[0]],
        ['Experience', `${result.breakdown.experience_relevance.score}/15`, result.breakdown.experience_relevance.details[0]],
        ['Achievements', `${result.breakdown.achievements.score}/10`, result.breakdown.achievements.details[0]],
        ['ATS Readiness', `${result.breakdown.ats_readiness.score}/10`, result.breakdown.ats_readiness.details[0]],
        ['Growth Potential', `${result.breakdown.growth_potential.score}/10`, result.breakdown.growth_potential.details[0]]
      ];

      autoTable(doc, {
        startY: currentY,
        head: [breakdownData[0]],
        body: breakdownData.slice(1),
        theme: 'striped',
        headStyles: { fillColor: [0, 122, 255] },
        margin: { left: margin, right: margin }
      });

      currentY = (doc as any).lastAutoTable.finalY + 15;

      // Missing Items
      if (result.missing_items_prioritized.length > 0) {
        doc.setFontSize(12);
        doc.setTextColor(0, 0, 0);
        doc.text('Prioritized Gaps & Recommendations', margin, currentY);
        currentY += 5;

        const missingData = result.missing_items_prioritized.slice(0, 5).map(item => [
          item.type.toUpperCase(),
          item.importance.toUpperCase(),
          item.suggestion
        ]);

        autoTable(doc, {
          startY: currentY,
          head: [['Type', 'Importance', 'Recommendation']],
          body: missingData,
          theme: 'grid',
          headStyles: { fillColor: [100, 100, 100] },
          columnStyles: {
            1: { cellWidth: 30 },
            2: { cellWidth: 'auto' }
          },
          margin: { left: margin, right: margin }
        });

        currentY = (doc as any).lastAutoTable.finalY + 15;
      }

      // Career Path Suggestions
      if (result.career_path_suggestions.length > 0) {
        if (currentY > 220) {
          doc.addPage();
          currentY = 20;
        }

        doc.setFontSize(12);
        doc.setTextColor(0, 0, 0);
        doc.text('AI Career Path Suggestions', margin, currentY);
        currentY += 5;

        const pathData = result.career_path_suggestions.slice(0, 2).map(path => [
          path.role,
          path.salary_impact,
          path.reason
        ]);

        autoTable(doc, {
          startY: currentY,
          head: [['Suggested Role', 'Salary Impact', 'Reasoning']],
          body: pathData,
          theme: 'striped',
          headStyles: { fillColor: [88, 86, 214] }, // system-purple
          margin: { left: margin, right: margin }
        });
      }

      // Footer
      const pageCount = (doc as any).internal.getNumberOfPages();
      for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i);
        doc.setFontSize(8);
        doc.setTextColor(150, 150, 150);
        doc.text(
          'Confidential Analysis Report - Powered by Resume AI Intelligence',
          pageWidth / 2,
          doc.internal.pageSize.getHeight() - 10,
          { align: 'center' }
        );
      }

      doc.save(`Analysis_Report_${originalResumeName?.replace(/\.[^/.]+$/, "") || 'Resume'}.pdf`);
    } catch (err) {
      console.error('PDF Export Error:', err);
    } finally {
      setIsExporting(false);
    }
  };

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
          <div className="space-y-8">
            {/* Header Section */}
            <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 border-b border-gray-100 pb-6">
                <div className="flex-1">
                    <div className="flex items-center gap-4">
                      <h2 className="text-2xl sm:text-3xl font-bold text-gray-900 tracking-tight">Analysis Report</h2>
                      <button
                        onClick={handleDownloadPDF}
                        disabled={isExporting}
                        className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 rounded-xl text-xs font-bold text-gray-700 hover:bg-gray-50 hover:border-gray-300 transition-all shadow-sm active:scale-95 disabled:opacity-50"
                      >
                        {isExporting ? (
                          <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <Download className="w-3.5 h-3.5 text-system-blue" />
                        )}
                        {isExporting ? 'Generating...' : 'Download Analysis Report'}
                      </button>
                    </div>
                    <p className="text-sm text-gray-500 font-medium mt-1">Detailed evaluation of your resume against the job requirements.</p>
                </div>
                <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-gray-400 bg-gray-50 px-3 py-1.5 rounded-full border border-gray-100">
                    <Sparkles className="w-3 h-3 text-system-blue" />
                    AI Powered Evaluation
                </div>
            </div>

            {/* Layout Restructuring */}
            <div className="space-y-8">
              {/* 1. Eligibility Container - Full Width */}
              <div className="w-full animate-in fade-in slide-in-from-bottom-4 duration-500">
                <ScoreCard 
                  score={result.match_score ?? 0} 
                  verdict={result.verdict || 'Not Eligible'} 
                  explanations={result.explanations || []} 
                />
              </div>

              {/* Keyword Highlights */}
              {result.highlight_keywords && result.highlight_keywords.length > 0 && (
                <div className="w-full bg-white p-6 rounded-2xl shadow-apple-card border border-gray-100 animate-in fade-in slide-in-from-bottom-4 duration-500 delay-75">
                  <h3 className="text-sm font-bold text-gray-900 uppercase tracking-widest mb-4 flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-system-blue" />
                    Keyword Highlights
                  </h3>
                  <div className="flex flex-wrap gap-2">
                    {result.highlight_keywords.map((keyword, i) => (
                      <span key={i} className="px-3 py-1.5 bg-blue-50 text-system-blue text-xs font-bold rounded-full border border-blue-100 shadow-sm">
                        {keyword}
                      </span>
                    ))}
                  </div>
                  <p className="text-[10px] text-gray-400 font-medium mt-3 italic">These are high-impact keywords from the JD that were found in your resume.</p>
                </div>
              )}

              {/* 2. Second Fold - Side by Side */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                  <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 delay-100">
                    <SuggestionsList items={result.missing_items_prioritized || []} />
                  </div>
                  <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 delay-200">
                    <BreakdownAccordion breakdown={result.breakdown} />
                  </div>
              </div>

              <div className="w-full min-h-[600px] animate-in fade-in slide-in-from-bottom-4 duration-700 delay-300">
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

              {/* Enhanced Career Path Suggestions */}
              {result.career_path_suggestions && result.career_path_suggestions.length > 0 && (
                <div className="w-full bg-white p-8 rounded-[2rem] shadow-apple-card border border-gray-100 animate-in fade-in slide-in-from-bottom-4 duration-500 delay-400">
                  <div className="flex items-center justify-between mb-8">
                    <div>
                      <h3 className="text-xl font-bold text-gray-900 flex items-center gap-2">
                        <Compass className="w-6 h-6 text-system-blue" />
                        AI Career Path Suggestions
                      </h3>
                      <p className="text-sm text-gray-500 mt-1">Strategic pivots based on your current skill set and market trends.</p>
                    </div>
                    <div className="hidden sm:flex items-center gap-2 text-[10px] font-bold text-system-blue bg-blue-50 px-3 py-1.5 rounded-full border border-blue-100">
                      <Sparkles className="w-3 h-3" />
                      PERSONALIZED FOR YOU
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {result.career_path_suggestions.map((path, i) => (
                      <div 
                        key={i} 
                        onClick={() => setSelectedPath(path)}
                        className="group relative bg-gray-50 hover:bg-white hover:shadow-xl hover:shadow-gray-200/50 border border-gray-100 p-6 rounded-3xl transition-all duration-300 cursor-pointer"
                      >
                        <div className="flex items-start justify-between mb-4">
                          <div className="p-3 bg-white rounded-2xl shadow-sm border border-gray-100 group-hover:bg-system-blue group-hover:text-white transition-colors">
                            <Briefcase className="w-5 h-5" />
                          </div>
                          <div className="flex items-center gap-1 text-[10px] font-bold text-gray-400 group-hover:text-system-blue transition-colors">
                            VIEW PATH <ArrowRight className="w-3 h-3" />
                          </div>
                        </div>

                        <h4 className="text-lg font-bold text-gray-900 mb-2 group-hover:text-system-blue transition-colors">{path.role}</h4>
                        
                        <div className="mb-4">
                          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">Why this fits</p>
                          <p className="text-sm text-gray-600 leading-relaxed">{path.reason}</p>
                        </div>

                        <div className="space-y-3">
                          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Recommended Upskilling</p>
                          <div className="flex flex-wrap gap-2">
                            {path.skills_to_add.map((skill, j) => (
                              <span key={j} className="px-3 py-1 bg-white text-gray-700 text-xs font-semibold rounded-full border border-gray-100 shadow-sm group-hover:border-blue-100 group-hover:text-system-blue transition-colors">
                                {skill}
                              </span>
                            ))}
                          </div>
                        </div>
                        
                        {/* Decorative element */}
                        <div className="absolute bottom-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
                          <Map className="w-12 h-12 text-gray-900" />
                        </div>
                      </div>
                    ))}
                  </div>
                  
                  <div className="mt-8 p-4 bg-blue-50/30 rounded-2xl border border-blue-100/50 flex items-center gap-3">
                    <div className="w-8 h-8 bg-white rounded-full flex items-center justify-center shadow-sm">
                      <Sparkles className="w-4 h-4 text-system-blue" />
                    </div>
                    <p className="text-xs text-blue-800 font-medium">
                      These suggestions are generated by analyzing your transferable skills and the current demand in the {result.market_fit?.[0]?.industry || 'tech'} industry.
                    </p>
                  </div>
                </div>
              )}

              {/* Career Bridge Modal */}
              {selectedPath && (
                <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-black/60 backdrop-blur-md animate-in fade-in duration-300">
                  <div className="bg-white rounded-[2.5rem] shadow-2xl w-full max-w-5xl max-h-[90vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-300">
                    {/* Modal Header */}
                    <div className="p-8 border-b border-gray-100 flex items-center justify-between bg-gray-50/50">
                      <div className="flex items-center gap-4">
                        <div className="p-4 bg-white rounded-2xl shadow-sm text-system-blue">
                          <Map className="w-8 h-8" />
                        </div>
                        <div>
                          <h3 className="text-2xl font-black text-gray-900 tracking-tight">Career Bridge: {selectedPath.role}</h3>
                          <p className="text-sm text-gray-500 font-medium">Your personalized 90-day roadmap to transition</p>
                        </div>
                      </div>
                      <button 
                        onClick={() => setSelectedPath(null)}
                        className="p-3 hover:bg-gray-100 rounded-full transition-colors"
                      >
                        <RefreshCw className="w-6 h-6 text-gray-400 rotate-45" />
                      </button>
                    </div>

                    {/* Modal Content */}
                    <div className="flex-1 overflow-y-auto p-8 bg-white">
                      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                        {/* Left Column: Market Intelligence */}
                        <div className="space-y-6">
                          <div className="p-6 bg-blue-50/50 rounded-3xl border border-blue-100">
                            <h5 className="text-xs font-black text-system-blue uppercase tracking-widest mb-4 flex items-center gap-2">
                              <Activity className="w-4 h-4" />
                              Market Intelligence
                            </h5>
                            <div className="space-y-4">
                              <div className="flex items-center justify-between">
                                <span className="text-sm text-gray-600 font-medium">Salary Impact</span>
                                <span className="text-sm font-bold text-gray-900">{selectedPath.salary_impact}</span>
                              </div>
                              <div className="flex items-center justify-between">
                                <span className="text-sm text-gray-600 font-medium">Ease of Pivot</span>
                                <div className="flex items-center gap-2">
                                  <div className="w-20 h-1.5 bg-gray-200 rounded-full overflow-hidden">
                                    <div 
                                      className="h-full bg-system-blue" 
                                      style={{ width: `${selectedPath.ease_of_pivot}%` }}
                                    />
                                  </div>
                                  <span className="text-sm font-bold text-gray-900">{selectedPath.ease_of_pivot}%</span>
                                </div>
                              </div>
                            </div>
                          </div>

                          <div className="p-6 bg-purple-50/50 rounded-3xl border border-purple-100">
                            <h5 className="text-xs font-black text-purple-600 uppercase tracking-widest mb-4 flex items-center gap-2">
                              <Trophy className="w-4 h-4" />
                              Skill Bridge
                            </h5>
                            <div className="space-y-3">
                              {selectedPath.skills_to_add.map((skill, i) => (
                                <div key={i} className="flex items-center gap-3 p-3 bg-white rounded-xl shadow-sm border border-purple-100/50">
                                  <div className="w-2 h-2 bg-purple-400 rounded-full" />
                                  <span className="text-sm font-bold text-gray-700">{skill}</span>
                                </div>
                              ))}
                            </div>
                          </div>

                          <button 
                            onClick={() => {
                              setSelectedPath(null);
                              onAskAI();
                            }}
                            className="w-full p-4 bg-gray-900 text-white rounded-2xl font-bold flex items-center justify-center gap-2 hover:bg-black transition-all shadow-lg"
                          >
                            <Zap className="w-5 h-5 text-yellow-400" />
                            Practice Interview for this Role
                          </button>
                        </div>

                        {/* Right Column: Roadmap (2/3 width) */}
                        <div className="lg:col-span-2 space-y-8">
                          <div className="relative">
                            <div className="absolute left-[27px] top-8 bottom-8 w-0.5 bg-gray-100" />
                            <div className="space-y-12">
                              {selectedPath.roadmap?.map((phase, i) => (
                                <div key={i} className="relative pl-16">
                                  <div className="absolute left-0 top-0 w-14 h-14 bg-white rounded-2xl shadow-apple-card border border-gray-100 flex items-center justify-center z-10">
                                    <span className="text-xl font-black text-system-blue">{i + 1}</span>
                                  </div>
                                  <div className="flex items-center gap-3 mb-2">
                                    <h4 className="text-xl font-black text-gray-900">{phase.phase}</h4>
                                    <span className="px-3 py-1 bg-gray-100 text-gray-500 text-[10px] font-black rounded-full uppercase tracking-widest">
                                      {phase.duration}
                                    </span>
                                  </div>
                                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                    {phase.tasks.map((task, ti) => (
                                      <div key={ti} className="flex items-start gap-3 p-4 bg-gray-50/50 rounded-2xl border border-gray-100/50 hover:bg-white hover:shadow-sm transition-all group">
                                        <div className="mt-1 p-1 bg-white rounded-md shadow-sm group-hover:bg-system-blue group-hover:text-white transition-colors">
                                          <Check className="w-3 h-3" />
                                        </div>
                                        <span className="text-sm text-gray-600 font-medium leading-relaxed">{task}</span>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Modal Footer */}
                    <div className="p-8 border-t border-gray-100 flex items-center justify-between bg-gray-50/50">
                      <p className="text-xs text-gray-400 font-medium max-w-md">
                        This roadmap is AI-generated based on your current resume and market trends. 
                        Focus on building projects to validate your new skills.
                      </p>
                      <div className="flex items-center gap-4">
                        <button 
                          onClick={() => setSelectedPath(null)}
                          className="px-8 py-3 text-gray-600 font-bold hover:text-gray-900 transition-colors"
                        >
                          Close
                        </button>
                        <button 
                          onClick={() => window.print()}
                          className="px-8 py-3 bg-system-blue text-white font-bold rounded-2xl hover:bg-system-blue-hover transition-all shadow-apple-button flex items-center gap-2"
                        >
                          <Download className="w-5 h-5" />
                          Save Roadmap
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
      ) : (
          <RecruiterScan jobDescription={jobDescription || ''} resumeFile={resumeFile || null} user={user} />
      )}
    </div>
  );
};
