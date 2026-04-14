
import React, { useState, useMemo, useEffect, useRef } from 'react';
import type { Candidate } from '../types';
import { generateComparisonSummary } from '../services/geminiService';
import { ArrowLeftIcon } from './icons/ArrowLeftIcon';
import { PinIcon } from './icons/PinIcon';
import { DownloadIcon } from './icons/DownloadIcon';
import { SparklesIcon } from './icons/SparklesIcon';
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';

interface CompareProfilesProps {
  candidates: Candidate[];
  jdText: string;
  onBack: () => void;
}

export const CompareProfiles: React.FC<CompareProfilesProps> = ({ candidates, jdText, onBack }) => {
  const [baselineId, setBaselineId] = useState<string | null>(null);
  const [showDifferencesOnly, setShowDifferencesOnly] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [aiSummary, setAiSummary] = useState<string | null>(null);
  const [isSummarizing, setIsSummarizing] = useState(false);
  const [summaryProgress, setSummaryProgress] = useState(0);
  const [currentQuoteIndex, setCurrentQuoteIndex] = useState(0);
  const reportRef = useRef<HTMLDivElement>(null);

  const RECRUITER_QUOTES = [
    "Great things take time. We're finding your perfect match...",
    "Analyzing talent patterns to ensure the best fit...",
    "Hold tight! Our AI is deep-diving into candidate profiles...",
    "Quality over speed. We're meticulously comparing every detail...",
    "Almost there! Synthesizing insights for your next big hire...",
    "Comparing skills, potential, and experience in real-time...",
    "Finding the needle in the haystack just for you...",
    "Your next star candidate is being identified right now..."
  ];

  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (isSummarizing) {
      interval = setInterval(() => {
        setCurrentQuoteIndex(prev => (prev + 1) % RECRUITER_QUOTES.length);
        setSummaryProgress(prev => {
            if (prev >= 95) return prev;
            return prev + Math.random() * 15;
        });
      }, 3000);
    } else {
      setSummaryProgress(0);
    }
    return () => clearInterval(interval);
  }, [isSummarizing]);

  const candidateIds = candidates.map(c => c.id).join(',');
  const analysisStatus = candidates.map(c => !!c.analysis).join(',');

  const fetchSummary = async () => {
    if (candidates.length < 2) {
      setAiSummary(null);
      return;
    }
    
    if (candidates.some(c => !c.analysis)) {
      setAiSummary("Waiting for candidate analysis to complete...");
      return;
    }
    
    setIsSummarizing(true);
    setSummaryProgress(5);
    try {
      const summary = await generateComparisonSummary(candidates, jdText);
      setAiSummary(summary);
      setSummaryProgress(100);
    } catch (error) {
      console.error("Summary error details:", error);
      setAiSummary("Failed to generate AI summary. This might be due to a temporary connection issue or high traffic. Please try again.");
    } finally {
      setTimeout(() => setIsSummarizing(false), 500);
    }
  };

  useEffect(() => {
    fetchSummary();
  }, [candidateIds, jdText, analysisStatus]);

  // Determine layout based on candidate count
  const gridCols = candidates.length === 2 ? 'lg:grid-cols-2' : 'lg:grid-cols-3';

  // --- Helpers ---

  // Safely get value from nested path
  const getValue = (c: Candidate, path: string[]) => {
      let val: any = c.analysis;
      for (const p of path) {
          if (val) val = val[p];
      }
      
      // If it's a breakdown score, we need to normalize it
      if (path[0] === 'breakdown' && path.length === 2) {
          const weights: Record<string, number> = {
              core_skills: 30,
              title_alignment: 20,
              experience_relevance: 15,
              soft_skills: 5,
              ats_readiness: 10,
              achievements: 10,
              education_certifications: 5,
              growth_potential: 10
          };
          const weight = weights[path[1]] || 100;
          const rawScore = (val && typeof val === 'object' && 'score' in val) ? val.score : (typeof val === 'number' ? val : 0);
          return Math.max(0, Math.min(100, Math.round((rawScore / weight) * 100)));
      }

      if (val && typeof val === 'object' && 'score' in val) {
          return val.score;
      }
      return typeof val === 'number' ? val : 0;
  };

  // Check if a metric is similar across ALL candidates (max diff <= 5)
  const isRowSimilar = (fieldPath: string[]) => {
      const values = candidates.map(c => getValue(c, fieldPath));
      const max = Math.max(...values);
      const min = Math.min(...values);
      return (max - min) <= 5;
  };

  // Get Delta string (+5, -2) relative to baseline
  const getScoreDelta = (val: number, fieldPath: string[]) => {
      if (!baselineId) return null;
      const base = candidates.find(c => c.id === baselineId);
      if (!base) return null;
      
      const baseVal = getValue(base, fieldPath);
      const delta = val - baseVal;
      
      if (delta === 0) return '0';
      return delta > 0 ? `+${delta}` : `${delta}`;
  };

  // Filter text lists to show only unique items per candidate
  const getUniqueListItems = (candidateId: string, list: string[]) => {
      if (!showDifferencesOnly) return list;

      // Gather all items from OTHER candidates
      const otherItems = candidates
          .filter(c => c.id !== candidateId)
          .flatMap(c => {
              const a = c.analysis;
              return [
                  ...(a?.strengths || []),
                  ...(a?.gaps || []),
                  ...(a?.red_flags || [])
              ];
          })
          .map(s => s.toLowerCase());

      // Return items that do NOT loosely match items from others
      return list.filter(item => {
          const lower = item.toLowerCase();
          // Simple semantic check: is this string contained in or containing other strings?
          // This helps match "React" with "React.js"
          const isPresentInOthers = otherItems.some(other => 
              other.includes(lower) || lower.includes(other)
          );
          return !isPresentInOthers;
      });
  };

  // --- Verdict Logic ---
  const verdicts = useMemo(() => {
      if (candidates.length < 2) return {};
      
      // 1. Best Match
      const bestMatch = [...candidates].sort((a,b) => (b.analysis?.match_score||0) - (a.analysis?.match_score||0))[0];
      
      // 2. Best Potential
      const bestPotential = [...candidates].sort((a,b) => (b.analysis?.potential_score||0) - (a.analysis?.potential_score||0))[0];
      
      // 3. Safest (Fewest Red Flags)
      const safest = [...candidates].sort((a,b) => (a.analysis?.red_flags.length||0) - (b.analysis?.red_flags.length||0))[0];
      
      // 4. Most Balanced (Lowest Standard Deviation across sub-scores)
      const getDeviation = (c: Candidate) => {
          if (!c.analysis?.breakdown) return 100;
          const scores = Object.values(c.analysis.breakdown || {}).map(v => {
          if (typeof v === 'number') return v;
          if (v && typeof v === 'object' && 'score' in v) return v.score;
          return 0;
      });
          if (scores.length === 0) return 100;
          const mean = scores.reduce((a, b) => a + b, 0) / scores.length;
          const variance = scores.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / scores.length;
          return Math.sqrt(variance);
      };
      const mostBalanced = [...candidates].sort((a,b) => getDeviation(a) - getDeviation(b))[0];

      return { bestMatch, bestPotential, safest, mostBalanced };
  }, [candidates]);

  // --- Micro-Insights ---
  const getMicroInsight = (c: Candidate) => {
      const a = c.analysis;
      if (!a) return "Analysis pending...";
      if (a.match_score > 90) return "✨ Exceptional role fit";
      if (a.potential_score > 90) return "🚀 High growth potential";
      if ((a.years_experience || 0) > 10) return "🧠 Deep domain expertise";
      
      const coreSkillsScore = typeof a.breakdown?.core_skills === 'number' 
        ? a.breakdown.core_skills 
        : (a.breakdown?.core_skills as any)?.score || 0;
      if (coreSkillsScore && coreSkillsScore > 90) return "🛠️ Technical powerhouse";
      
      const softSkillsScore = typeof a.breakdown?.soft_skills === 'number' 
        ? a.breakdown.soft_skills 
        : (a.breakdown?.soft_skills as any)?.score || 0;
      if (softSkillsScore && softSkillsScore > 90) return "🤝 Great culture add";
      
      return "⚖️ Balanced profile";
  };

  // --- Export Handler ---
  const handleDownloadPDF = async () => {
      if (!reportRef.current) return;
      
      setIsExporting(true);
      try {
          // Store original scroll position
          const scrollPos = window.scrollY;
          window.scrollTo(0, 0);

          const element = reportRef.current;
          
          // Use html2canvas to capture the element
          const canvas = await html2canvas(element, {
              scale: 2,
              useCORS: true,
              logging: false,
              backgroundColor: '#ffffff',
              windowWidth: 1400,
              height: element.scrollHeight, // Ensure full height is captured
              onclone: (clonedDoc) => {
                  const clonedElement = clonedDoc.getElementById('comparison-report');
                  if (clonedElement) {
                      clonedElement.style.padding = '40px';
                      clonedElement.style.width = '1400px';
                      clonedElement.style.height = 'auto'; // Let it expand
                      clonedElement.style.overflow = 'visible';
                      
                      const noPrintElements = clonedElement.querySelectorAll('.no-print');
                      noPrintElements.forEach(el => (el as HTMLElement).style.display = 'none');

                      const clampedElements = clonedElement.querySelectorAll('.line-clamp-1, .line-clamp-2, .line-clamp-3, .line-clamp-4, .truncate');
                      clampedElements.forEach(el => {
                          (el as HTMLElement).style.webkitLineClamp = 'unset';
                          (el as HTMLElement).style.display = 'block';
                          (el as HTMLElement).style.overflow = 'visible';
                          (el as HTMLElement).style.maxHeight = 'none';
                          (el as HTMLElement).style.textOverflow = 'clip';
                          (el as HTMLElement).style.whiteSpace = 'normal';
                      });

                      const containers = clonedElement.querySelectorAll('.overflow-hidden');
                      containers.forEach(el => {
                          (el as HTMLElement).style.overflow = 'visible';
                      });
                  }
              }
          });

          const imgData = canvas.toDataURL('image/png');
          const pdf = new jsPDF({
              orientation: 'landscape',
              unit: 'px',
              format: [canvas.width, canvas.height]
          });

          pdf.addImage(imgData, 'PNG', 0, 0, canvas.width, canvas.height);
          const date = new Date().toISOString().split('T')[0];
          pdf.save(`Candidate_Comparison_${date}.pdf`);
          
          // Restore scroll position
          window.scrollTo(0, scrollPos);
          
      } catch (error) {
          console.error("PDF generation error:", error);
          window.print();
      } finally {
          setIsExporting(false);
      }
  };

  return (
    <div className="bg-gray-50 min-h-screen animate-scale-in pb-20 print:bg-white print:pb-0 print:min-h-0">
      {/* PDF Print Styles */}
      <style>{`
        @media print {
          @page { size: landscape; margin: 0.5cm; }
          body { -webkit-print-color-adjust: exact; print-color-adjust: exact; background: white; }
          .no-print { display: none !important; }
          .print-only { display: block !important; }
          .print-card { border: 1px solid #eee !important; box-shadow: none !important; break-inside: avoid; overflow: visible !important; height: auto !important; }
          .print-grid { display: grid !important; grid-template-columns: repeat(${candidates.length}, 1fr) !important; gap: 1rem !important; overflow: visible !important; }
          .print-text-full { -webkit-line-clamp: unset !important; display: block !important; overflow: visible !important; max-height: none !important; }
          /* Force graphs to print */
          * { print-color-adjust: exact; -webkit-print-color-adjust: exact; }
        }
      `}</style>

      {/* Header */}
      <div className="bg-white border-b border-gray-200 sticky top-0 z-40 shadow-sm no-print">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4 flex justify-between items-center">
          <div className="flex items-center gap-4">
            <button 
                onClick={onBack}
                className="p-2 hover:bg-gray-100 rounded-full text-gray-500 transition-colors"
            >
                <ArrowLeftIcon className="w-5 h-5" />
            </button>
            <div>
                <h1 className="text-lg font-bold text-gray-900">Compare Profiles</h1>
                <p className="text-xs text-gray-500">{candidates.length} Candidates Selected</p>
            </div>
          </div>
          
          <div className="flex items-center gap-4">
             <div className="hidden sm:flex items-center gap-2 bg-gray-100 p-1 rounded-lg border border-gray-200">
                 <button 
                    onClick={() => setShowDifferencesOnly(false)}
                    className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all ${!showDifferencesOnly ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                 >
                    Full View
                 </button>
                 <button 
                    onClick={() => setShowDifferencesOnly(true)}
                    className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all ${showDifferencesOnly ? 'bg-white text-system-blue shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                 >
                    Differences Only
                 </button>
             </div>
             <button 
                onClick={handleDownloadPDF}
                disabled={isExporting}
                className="flex items-center gap-2 text-sm font-medium text-gray-600 hover:text-gray-900 bg-white border border-gray-200 px-3 py-2 rounded-lg shadow-sm hover:shadow transition-all"
                title="Download Comparison PDF"
             >
                 {isExporting ? (
                     <span className="text-xs font-bold">Preparing...</span>
                 ) : (
                     <>
                        <DownloadIcon className="w-4 h-4" />
                        <span className="hidden sm:inline font-semibold">Download PDF</span>
                     </>
                 )}
             </button>
          </div>
        </div>
        
        {/* Quick Verdict Strip */}
        <div className="bg-gray-50 border-t border-gray-100 px-4 py-3 text-xs sm:text-sm flex flex-wrap justify-center gap-4 sm:gap-8 text-gray-600">
            {verdicts.bestMatch && (
                <div className="flex items-center gap-2 bg-white px-3 py-1 rounded-full border border-gray-200 shadow-sm">
                    <span className="text-base">🏆</span> 
                    <span>Best Match: <span className="font-bold text-gray-900">{verdicts.bestMatch.name}</span></span>
                </div>
            )}
            {verdicts.bestPotential && (
                <div className="flex items-center gap-2 bg-white px-3 py-1 rounded-full border border-gray-200 shadow-sm">
                    <span className="text-base">🚀</span>
                    <span>Best Potential: <span className="font-bold text-gray-900">{verdicts.bestPotential.name}</span></span>
                </div>
            )}
            {verdicts.mostBalanced && (
                <div className="flex items-center gap-2 bg-white px-3 py-1 rounded-full border border-gray-200 shadow-sm">
                    <span className="text-base">⚖️</span>
                    <span>Most Balanced: <span className="font-bold text-gray-900">{verdicts.mostBalanced.name}</span></span>
                </div>
            )}
        </div>
      </div>

      {/* PDF-Only Header */}
      <div className="hidden print-only p-8 border-b border-gray-200 mb-4">
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Candidate Comparison Report</h1>
          <div className="flex gap-6 text-sm text-gray-600">
              <span>Generated by ResumeAI</span>
              <span>•</span>
              <span>{new Date().toLocaleDateString()}</span>
          </div>
      </div>

      <div id="comparison-report" ref={reportRef} className="bg-gray-50 print:bg-white">
        {/* AI Smart Summary - Visible in both web and print */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8 space-y-8">
          <div className="bg-white rounded-[2.5rem] shadow-apple-card border border-white/60 p-8 sm:p-10 relative overflow-hidden group print:border-gray-200 print:shadow-none">
              <div className="absolute top-0 right-0 -mt-10 -mr-10 w-40 h-40 bg-system-blue blur-[80px] opacity-10 group-hover:opacity-20 transition-opacity no-print"></div>
              <div className="relative z-10">
                  <div className="flex items-center gap-3 mb-6">
                      <div className="w-10 h-10 bg-blue-50 rounded-2xl flex items-center justify-center print:bg-gray-50">
                          <SparklesIcon className="w-5 h-5 text-system-blue" />
                      </div>
                      <div>
                          <h2 className="text-lg font-bold text-gray-900">AI Smart Comparison</h2>
                          <p className="text-xs text-gray-500 font-medium">Synthesized analysis of {candidates.length} candidates</p>
                      </div>
                  </div>

                  {isSummarizing ? (
                      <div className="space-y-6 no-print">
                          <div className="flex justify-between items-end mb-2">
                              <p className="text-sm font-bold text-system-blue animate-pulse">
                                  {RECRUITER_QUOTES[currentQuoteIndex]}
                              </p>
                              <span className="text-xs font-black text-gray-400">{Math.round(summaryProgress)}%</span>
                          </div>
                          <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                              <div 
                                className="h-full bg-system-blue transition-all duration-500 ease-out" 
                                style={{ width: `${summaryProgress}%` }}
                              ></div>
                          </div>
                          <div className="flex gap-3">
                              <div className="h-4 bg-gray-100 rounded-full w-3/4 animate-pulse"></div>
                              <div className="h-4 bg-gray-100 rounded-full w-1/4 animate-pulse"></div>
                          </div>
                      </div>
                  ) : aiSummary ? (
                      <div className="space-y-4">
                        <p className="text-gray-700 leading-relaxed font-medium italic text-lg border-l-4 border-system-blue pl-6 py-1 print:text-base">
                            "{aiSummary}"
                        </p>
                        {aiSummary.includes("Failed") && (
                            <button 
                                onClick={fetchSummary}
                                className="ml-6 text-xs font-bold text-system-blue hover:underline flex items-center gap-1 no-print"
                            >
                                <SparklesIcon className="w-3 h-3" />
                                Try generating again
                            </button>
                        )}
                      </div>
                  ) : (
                      <p className="text-gray-400 italic">Unable to generate summary at this time.</p>
                  )}
              </div>
          </div>
        </div>

        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8 pt-0 print:p-0 print:max-w-none">
          <div className={`grid grid-cols-1 ${gridCols} gap-6 print-grid print:gap-8`}>
            {candidates.map((c, idx) => {
                const analysis = c.analysis;
                const isBaseline = baselineId === c.id;
                const showDelta = baselineId && !isBaseline;
                
                return (
                    <div key={c.id} className={`bg-white rounded-3xl shadow-sm border ${isBaseline ? 'border-system-blue ring-2 ring-blue-100' : 'border-gray-200'} overflow-hidden print:overflow-visible flex flex-col print-card transition-all duration-300`}>
                        {/* Card Header */}
                        <div className="p-6 border-b border-gray-100 relative bg-gradient-to-b from-white to-gray-50/30 print:p-8">
                            <div className="flex justify-between items-start mb-3">
                                <div>
                                    <div className="flex items-center gap-2 mb-1 no-print">
                                        <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">#{idx + 1}</span>
                                        {(idx < 3 && c.status === 'analyzed') && <span className="px-2 py-0.5 rounded bg-yellow-100 text-yellow-700 text-[10px] font-bold">TOP PICK</span>}
                                    </div>
                                    <h3 className="text-lg font-bold text-gray-900 line-clamp-1 print-text-full" title={c.name}>{c.name}</h3>
                                    <p className="text-xs text-gray-500 mt-0.5 font-medium">{analysis?.seniority_level || 'N/A'} • {analysis?.years_experience || 0}y Exp</p>
                                    
                                    {/* Contact Details */}
                                    {(analysis?.email || analysis?.phone || analysis?.address) && (
                                        <div className="mt-2 space-y-0.5">
                                            {analysis.email && analysis.email !== 'NA' && (
                                                <p className="text-[10px] text-gray-400 font-medium truncate print-text-full print:text-xs" title={analysis.email}>{analysis.email}</p>
                                            )}
                                            {analysis.phone && analysis.phone !== 'NA' && (
                                                <p className="text-[10px] text-gray-400 font-medium print:text-xs">{analysis.phone}</p>
                                            )}
                                            {analysis.address && analysis.address !== 'NA' && (
                                                <p className="text-[10px] text-gray-400 font-medium truncate print-text-full print:text-xs" title={analysis.address}>{analysis.address}</p>
                                            )}
                                        </div>
                                    )}

                                    <p className="text-xs text-system-blue font-medium mt-2 italic">{getMicroInsight(c)}</p>
                                </div>
                                <button 
                                    onClick={() => setBaselineId(isBaseline ? null : c.id)}
                                    className={`p-2 rounded-full transition-colors no-print ${isBaseline ? 'text-system-blue bg-blue-50' : 'text-gray-300 hover:text-gray-500 hover:bg-gray-100'}`}
                                    title={isBaseline ? "Remove baseline" : "Pin as baseline to compare others against this"}
                                >
                                    <PinIcon className="w-4 h-4" />
                                </button>
                            </div>
                            
                            <div className="flex items-baseline gap-3 mt-4">
                                <div className={`text-4xl font-bold tracking-tighter ${analysis?.match_score && analysis.match_score >= 80 ? 'text-system-green' : 'text-gray-900'}`}>
                                    {analysis?.match_score || 0}%
                                </div>
                                {showDelta && (
                                    <span className={`text-sm font-bold px-2 py-0.5 rounded-md ${(() => {
                                        const d = parseInt(getScoreDelta(analysis?.match_score || 0, ['match_score']) || '0');
                                        return d > 0 ? 'text-green-700 bg-green-100' : d < 0 ? 'text-red-700 bg-red-100' : 'text-gray-500 bg-gray-100';
                                    })()}`}>
                                        {getScoreDelta(analysis?.match_score || 0, ['match_score'])}
                                    </span>
                                )}
                                <span className="text-xs font-bold text-gray-400 uppercase self-center">Match Score</span>
                            </div>
                        </div>

                        {/* Comparison Rows */}
                        <div className="flex-1 divide-y divide-gray-50">
                            
                            {/* Potential & Training - Conditional Hide */}
                            {(!showDifferencesOnly || !isRowSimilar(['potential_score'])) && (
                                <div className="p-4 grid grid-cols-2 gap-4 animate-[fadeIn_0.3s_ease-out]">
                                    <div>
                                        <span className="block text-[10px] font-bold text-gray-400 uppercase mb-1">Potential</span>
                                        <div className="flex items-baseline gap-2">
                                            <span className="text-lg font-bold text-gray-800">{analysis?.potential_score || '-'}</span>
                                            {showDelta && <span className={`text-xs font-bold ${parseInt(getScoreDelta(analysis?.potential_score||0, ['potential_score'])||'0') >= 0 ? 'text-green-600' : 'text-red-500'}`}>{getScoreDelta(analysis?.potential_score||0, ['potential_score'])}</span>}
                                        </div>
                                    </div>
                                    <div className="print:mt-2">
                                        <span className="block text-[10px] font-bold text-gray-400 uppercase mb-1">Training</span>
                                        <span className="text-sm font-medium text-gray-700 line-clamp-2 print-text-full print:text-xs" title={analysis?.training_estimate}>{analysis?.training_estimate || 'N/A'}</span>
                                    </div>
                                </div>
                            )}

                            {/* Score Breakdown */}
                            {analysis?.breakdown && (
                                <div className="p-4 space-y-3">
                                    <h4 className="text-xs font-bold text-gray-900 uppercase tracking-wider mb-2">Skills Breakdown</h4>
                                    
                                    {[
                                        { label: 'Core Skills', key: 'core_skills', weight: 30 },
                                        { label: 'Title Alignment', key: 'title_alignment', weight: 20 },
                                        { label: 'Experience', key: 'experience_relevance', weight: 15 },
                                        { label: 'Soft Skills', key: 'soft_skills', weight: 5 },
                                        { label: 'ATS Readiness', key: 'ats_readiness', weight: 10 },
                                    ].map(metric => {
                                        const breakdownVal = (analysis.breakdown as any)[metric.key];
                                        const rawVal = typeof breakdownVal === 'number' ? breakdownVal : breakdownVal?.score || 0;
                                        const val = Math.max(0, Math.min(100, Math.round((rawVal / metric.weight) * 100)));
                                        const delta = showDelta ? getScoreDelta(val, ['breakdown', metric.key]) : null; // Note: delta might need adjustment if it's comparing normalized vs raw
                                        
                                        // Hide if toggled ON and similar
                                        if (showDifferencesOnly && isRowSimilar(['breakdown', metric.key])) return null;

                                        return (
                                            <div key={metric.key} className="flex items-center justify-between text-sm animate-[fadeIn_0.3s_ease-out]">
                                                <span className="text-gray-500 font-medium text-xs">{metric.label}</span>
                                                <div className="flex items-center gap-2">
                                                    <div className="w-12 h-1.5 bg-gray-100 rounded-full overflow-hidden print:hidden">
                                                        <div className="h-full bg-system-blue rounded-full" style={{ width: `${val}%`}} />
                                                    </div>
                                                    <span className="font-bold text-gray-700 w-6 text-right">{val}</span>
                                                    {delta && <span className={`text-[10px] font-bold w-6 text-right ${parseInt(delta) > 0 ? 'text-green-600' : parseInt(delta) < 0 ? 'text-red-500' : 'text-gray-300'}`}>{delta}</span>}
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}

                            {/* Strengths */}
                            <div className="p-4">
                                <h4 className="text-xs font-bold text-gray-900 uppercase tracking-wider mb-3 flex justify-between">
                                    Key Strengths
                                    {showDifferencesOnly && <span className="text-[10px] text-system-blue normal-case bg-blue-50 px-2 rounded">Unique only</span>}
                                </h4>
                                <ul className="space-y-2">
                                    {getUniqueListItems(c.id, analysis?.strengths || []).slice(0, 4).map((s, i) => (
                                        <li key={i} className="text-xs text-gray-600 flex gap-2 items-start leading-relaxed animate-[fadeIn_0.3s_ease-out]">
                                            <span className="text-system-green font-bold mt-0.5 flex-shrink-0">✓</span>
                                            {s}
                                        </li>
                                    ))}
                                    {showDifferencesOnly && getUniqueListItems(c.id, analysis?.strengths || []).length === 0 && (
                                        <li className="text-xs text-gray-400 italic pl-4">No unique strengths vs others.</li>
                                    )}
                                </ul>
                            </div>

                            {/* Gaps */}
                            <div className="p-4 bg-red-50/30 h-full">
                                <h4 className="text-xs font-bold text-red-900 uppercase tracking-wider mb-3 flex justify-between">
                                    Gaps / Risks
                                    {showDifferencesOnly && <span className="text-[10px] text-red-600 normal-case bg-red-50 px-2 rounded border border-red-100">Unique only</span>}
                                </h4>
                                <ul className="space-y-2">
                                    {getUniqueListItems(c.id, analysis?.gaps || analysis?.red_flags || []).slice(0, 3).map((g, i) => (
                                        <li key={i} className="text-xs text-gray-600 flex gap-2 items-start leading-relaxed animate-[fadeIn_0.3s_ease-out]">
                                            <span className="text-red-400 font-bold mt-0.5 flex-shrink-0">!</span>
                                            {g}
                                        </li>
                                    ))}
                                    {showDifferencesOnly && getUniqueListItems(c.id, analysis?.gaps || analysis?.red_flags || []).length === 0 && (
                                        <li className="text-xs text-gray-400 italic pl-4">No unique risks vs others.</li>
                                    )}
                                </ul>
                            </div>

                        </div>
                    </div>
                );
            })}
            </div>
        </div>
      </div>
    </div>
  );
};
