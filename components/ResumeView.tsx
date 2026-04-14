
import React, { useState, useEffect } from 'react';
import { ClipboardIcon } from './icons/ClipboardIcon';
import { DownloadIcon } from './icons/DownloadIcon';
import { EditIcon } from './icons/EditIcon';
import { MaximizeIcon } from './icons/MaximizeIcon';

interface ResumeViewProps {
  customResume: string;
  diffSummary: string[];
  coverLine: string | null;
  coverLetter?: string;
  rewrittenAchievements: string[];
  originalResumeName: string | undefined;
  onUpdateResume: (newText: string) => void;
}

export const ResumeView: React.FC<ResumeViewProps> = ({ customResume, diffSummary, coverLine, coverLetter, rewrittenAchievements, originalResumeName, onUpdateResume }) => {
  const [activeTab, setActiveTab] = useState('resume');
  const [copied, setCopied] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editedResume, setEditedResume] = useState(customResume);
  const [isMaximized, setIsMaximized] = useState(false);
  const [showHighlights, setShowHighlights] = useState(true);

  useEffect(() => {
    setEditedResume(customResume);
  }, [customResume]);

  const handleCopy = (text: string) => {
    const cleanText = text.replace(/<suggestion>|<\/suggestion>/g, '');
    navigator.clipboard.writeText(cleanText).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const handleSave = () => {
    onUpdateResume(editedResume);
    setIsEditing(false);
  };
  
  const generatePdfContent = (filename: string, content: string) => {
      const printWindow = window.open('', '_blank');
      if (!printWindow) return;
      // Strip suggestion tags for PDF
      const cleanContent = content.replace(/<suggestion>|<\/suggestion>/g, '');
      printWindow.document.write(`<html><body style="font-family: sans-serif; white-space: pre-wrap;">${cleanContent}</body></html>`);
      printWindow.document.close();
      setTimeout(() => printWindow.print(), 500);
  };
  const handleDownloadResumePdf = () => generatePdfContent('Optimized-Resume.pdf', editedResume);
  const handleDownloadCoverLetterPdf = () => generatePdfContent('Cover-Letter.pdf', coverLetter || '');
  const handleEmailCoverLetter = () => { if(coverLetter) window.location.href = `mailto:?body=${encodeURIComponent(coverLetter)}`; };

  // Sync maximized changes back to local state
  const handleMaximizedChange = (val: string) => {
      setEditedResume(val);
  };

  const renderResumeContent = (text: string, highlight: boolean) => {
    if (!highlight) {
      return text.replace(/<suggestion>|<\/suggestion>/g, '');
    }

    const parts = text.split(/(<suggestion>|<\/suggestion>)/);
    let isSuggestion = false;

    return parts.map((part, i) => {
      if (part === '<suggestion>') {
        isSuggestion = true;
        return null;
      }
      if (part === '</suggestion>') {
        isSuggestion = false;
        return null;
      }
      if (!part) return null;
      
      return isSuggestion ? (
        <span key={i} className="bg-yellow-200/60 text-yellow-900 px-0.5 rounded-sm border-b border-yellow-400/50">
          {part}
        </span>
      ) : part;
    });
  };

  const isLowMatch = customResume.trim() === "";

  return (
    <div className="bg-white rounded-3xl shadow-apple-card border border-white/60 h-[600px] lg:h-full flex flex-col overflow-hidden">
      {/* iOS Segmented Control */}
      <div className="border-b border-gray-100 bg-white/50 backdrop-blur-md p-3 flex justify-center sticky top-0 z-10">
        <div className="bg-gray-100/80 p-1 rounded-xl inline-flex w-full sm:w-auto">
            <button
                onClick={() => setActiveTab('resume')}
                className={`flex-1 sm:flex-none px-4 sm:px-8 py-2 text-[11px] sm:text-xs font-bold rounded-lg transition-all whitespace-nowrap ${activeTab === 'resume' ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500 hover:text-gray-700'}`}
            >
                Optimized Resume
            </button>
            <button
                onClick={() => setActiveTab('changes')}
                className={`flex-1 sm:flex-none px-4 sm:px-8 py-2 text-[11px] sm:text-xs font-bold rounded-lg transition-all whitespace-nowrap ${activeTab === 'changes' ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500 hover:text-gray-700'}`}
            >
                Cover Letter
            </button>
        </div>
      </div>

      <div className="flex-1 overflow-hidden relative bg-[#F9F9FB]">
        {activeTab === 'resume' && (
          <div className="h-full flex flex-col p-4 sm:p-6 overflow-y-auto scrollbar-hide">
             {!isLowMatch && (
               <div className="flex flex-col sm:flex-row justify-between items-center gap-4 mb-4 sticky top-0 z-20">
                  <div className="flex items-center gap-3 bg-white/80 backdrop-blur-sm px-4 py-2 rounded-full shadow-sm border border-gray-100">
                    <span className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Highlight Suggestions</span>
                    <button 
                      onClick={() => setShowHighlights(!showHighlights)}
                      className={`relative inline-flex h-5 w-10 items-center rounded-full transition-colors focus:outline-none ${showHighlights ? 'bg-system-blue' : 'bg-gray-200'}`}
                    >
                      <span className={`inline-block h-3 w-3 transform rounded-full bg-white transition-transform ${showHighlights ? 'translate-x-6' : 'translate-x-1'}`} />
                    </button>
                  </div>

                  <div className="flex gap-1.5 bg-white/80 backdrop-blur-sm p-1 rounded-full shadow-sm border border-gray-100">
                      {isEditing ? (
                          <>
                              <button 
                                  onClick={() => setIsMaximized(true)} 
                                  className="p-1.5 text-gray-400 hover:text-system-blue transition-colors mr-2"
                                  title="Maximize"
                              >
                                  <MaximizeIcon className="w-3.5 h-3.5"/>
                              </button>
                              <button onClick={handleSave} className="bg-system-blue text-white px-4 py-1.5 rounded-full text-[10px] font-bold shadow-apple-button hover:bg-system-blue-hover transition-all active:scale-95">Done</button>
                              <button onClick={() => setIsEditing(false)} className="bg-gray-100 text-gray-500 px-4 py-1.5 rounded-full text-[10px] font-bold hover:bg-gray-200 transition-all active:scale-95">Cancel</button>
                          </>
                      ) : (
                          <div className="flex gap-2">
                              <button 
                                onClick={() => setIsEditing(true)} 
                                className="flex items-center gap-2 px-4 py-1.5 bg-system-blue text-white rounded-full text-[10px] font-bold shadow-apple-button hover:bg-system-blue-hover transition-all active:scale-95"
                              >
                                <EditIcon className="w-3 h-3"/>
                                <span>Edit</span>
                              </button>
                              <button 
                                onClick={() => handleCopy(editedResume)} 
                                className="flex items-center gap-2 px-4 py-1.5 bg-system-blue text-white rounded-full text-[10px] font-bold shadow-apple-button hover:bg-system-blue-hover transition-all active:scale-95"
                              >
                                <ClipboardIcon className="w-3 h-3"/>
                                <span>{copied ? 'Copied!' : 'Copy'}</span>
                              </button>
                              <button 
                                onClick={handleDownloadResumePdf} 
                                className="flex items-center gap-2 px-4 py-1.5 bg-system-blue text-white rounded-full text-[10px] font-bold shadow-apple-button hover:bg-system-blue-hover transition-all active:scale-95"
                              >
                                <DownloadIcon className="w-3 h-3"/>
                                <span>Download PDF</span>
                              </button>
                          </div>
                      )}
                  </div>
               </div>
             )}
             
             <div className="bg-white min-h-[500px] p-6 sm:p-10 rounded-sm mx-auto w-full max-w-2xl relative flex flex-col mb-8">
                {isLowMatch ? (
                    <div className="flex-1 flex flex-col items-center justify-center text-center p-6 space-y-4 animate-scale-in">
                        <div className="w-14 h-14 bg-orange-50 rounded-full flex items-center justify-center text-system-orange text-2xl">⚠️</div>
                        <h4 className="text-lg font-bold text-gray-900">Optimization Skipped</h4>
                        <p className="text-xs text-gray-500 max-w-sm leading-relaxed font-medium">
                            Your resume match score is too low for a meaningful rewrite. 
                            To ensure 100% accuracy, our AI refuses to fabricate experience or skills that aren't in your source document.
                        </p>
                        <div className="text-[10px] font-bold text-gray-400 uppercase tracking-widest pt-4 border-t border-gray-100 w-full">
                            Zero Hallucination Policy Active
                        </div>
                    </div>
                ) : isEditing ? (
                    <textarea 
                        value={editedResume} 
                        onChange={(e) => setEditedResume(e.target.value)}
                        className="w-full h-full min-h-[600px] text-[13px] font-serif leading-relaxed text-gray-800 outline-none resize-none bg-transparent"
                        spellCheck={false}
                    />
                ) : (
                    <pre className="whitespace-pre-wrap font-serif text-[13px] text-gray-800 leading-relaxed font-normal">
                        {renderResumeContent(editedResume, showHighlights)}
                    </pre>
                )}
             </div>
          </div>
        )}
        
        {activeTab === 'changes' && (
          <div className="h-full overflow-y-auto p-4 sm:p-8 space-y-6 sm:space-y-8">
            {isLowMatch ? (
                <div className="bg-white p-10 rounded-2xl shadow-sm border border-gray-100 text-center animate-scale-in">
                    <p className="text-gray-400 font-medium italic">Cover letter generation skipped due to low match profile.</p>
                </div>
            ) : (
                <>
                    {coverLetter && (
                        <div className="bg-white p-6 sm:p-8 rounded-2xl shadow-sm border border-gray-100">
                             <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4">
                                <h4 className="text-xl font-bold text-gray-900 font-serif">Cover Letter</h4>
                                <div className="flex gap-2">
                                     <button onClick={handleEmailCoverLetter} className="px-4 py-2 rounded-full bg-system-blue text-white text-[11px] font-bold shadow-apple-button hover:bg-system-blue-hover transition-all active:scale-95">Email</button>
                                     <button onClick={handleDownloadCoverLetterPdf} className="px-4 py-2 rounded-full bg-system-blue text-white text-[11px] font-bold shadow-apple-button hover:bg-system-blue-hover transition-all active:scale-95">Download PDF</button>
                                </div>
                             </div>
                             <div className="prose prose-sm max-w-none text-gray-700 font-serif leading-7">
                                {coverLetter}
                             </div>
                        </div>
                    )}
                    
                    <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
                        <h4 className="font-bold text-gray-900 mb-4">Summary of Optimization</h4>
                         {coverLine && (
                            <div className="mb-6 p-4 bg-indigo-50/50 rounded-xl border-l-4 border-indigo-400">
                                <p className="text-indigo-900 italic font-medium text-sm">"{coverLine}"</p>
                            </div>
                        )}
                        <ul className="space-y-3">
                            {diffSummary.map((item, i) => (
                                <li key={i} className="flex gap-3 text-sm text-gray-600">
                                    <span className="text-system-green font-bold">✓</span>
                                    {item}
                                </li>
                            ))}
                        </ul>
                    </div>
                </>
            )}
          </div>
        )}
      </div>

      {/* Full Screen Modal for Resume Editor */}
      {isMaximized && (
        <div className="fixed inset-0 z-[100] bg-white animate-scale-in flex flex-col">
          <div className="flex items-center justify-between px-4 sm:px-6 py-4 border-b border-gray-100 bg-gray-50/50 backdrop-blur-md">
            <div>
              <h2 className="text-lg font-bold text-gray-900">Edit Resume</h2>
              <p className="text-xs text-gray-500">Focus Mode</p>
            </div>
            <div className="flex items-center gap-4">
               <span className="text-xs font-medium text-gray-400 hidden sm:inline">{editedResume.length} chars</span>
               <button
                onClick={() => setIsMaximized(false)}
                className="px-6 py-2 bg-gray-900 text-white text-sm font-semibold rounded-full hover:bg-gray-800 transition-colors shadow-lg"
              >
                Close
              </button>
            </div>
          </div>
          <div className="flex-1 overflow-y-auto bg-gray-50 p-4 sm:p-10">
             <div className="max-w-4xl mx-auto bg-white shadow-sm min-h-full p-6 sm:p-12">
                <textarea
                  autoFocus
                  value={editedResume}
                  onChange={(e) => handleMaximizedChange(e.target.value)}
                  className="w-full h-full min-h-[80vh] resize-none outline-none text-base sm:text-lg leading-relaxed text-gray-800 font-serif"
                />
             </div>
          </div>
        </div>
      )}
    </div>
  );
};
