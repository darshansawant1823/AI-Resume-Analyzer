
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

  useEffect(() => {
    setEditedResume(customResume);
  }, [customResume]);

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text).then(() => {
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
      printWindow.document.write(`<html><body style="font-family: sans-serif; white-space: pre-wrap;">${content}</body></html>`);
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

  const isLowMatch = customResume.trim() === "";

  return (
    <div className="bg-white rounded-3xl shadow-apple-card border border-white/60 h-[600px] lg:h-full flex flex-col overflow-hidden">
      {/* iOS Toolbar */}
      <div className="border-b border-gray-100 bg-white/50 backdrop-blur-md p-2 flex justify-center sticky top-0 z-10">
        <div className="bg-gray-100/80 p-1 rounded-lg inline-flex w-full sm:w-auto">
            <button
                onClick={() => setActiveTab('resume')}
                className={`flex-1 sm:flex-none px-3 sm:px-6 py-1.5 text-xs font-semibold rounded-[6px] transition-all whitespace-nowrap ${activeTab === 'resume' ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500 hover:text-gray-700'}`}
            >
                Optimized Resume
            </button>
            <button
                onClick={() => setActiveTab('changes')}
                className={`flex-1 sm:flex-none px-3 sm:px-6 py-1.5 text-xs font-semibold rounded-[6px] transition-all whitespace-nowrap ${activeTab === 'changes' ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500 hover:text-gray-700'}`}
            >
                Cover Letter
            </button>
        </div>
      </div>

      <div className="flex-1 overflow-hidden relative bg-[#F9F9FB]">
        {activeTab === 'resume' && (
          <div className="h-full flex flex-col p-4 sm:p-8 overflow-y-auto">
             {!isLowMatch && (
               <div className="flex justify-end gap-3 mb-4 sticky top-0 z-20 pointer-events-none">
                  <div className="pointer-events-auto flex gap-2">
                      {isEditing ? (
                          <>
                              <button 
                                  onClick={() => setIsMaximized(true)} 
                                  className="p-2 bg-white rounded-full shadow-sm text-gray-500 hover:text-system-blue hover:bg-blue-50 border border-gray-100"
                                  title="Maximize"
                              >
                                  <MaximizeIcon className="w-4 h-4"/>
                              </button>
                              <button onClick={handleSave} className="bg-system-blue text-white px-3 py-1.5 rounded-full text-xs font-semibold shadow-sm hover:bg-blue-600">Done</button>
                              <button onClick={() => setIsEditing(false)} className="bg-gray-200 text-gray-600 px-3 py-1.5 rounded-full text-xs font-semibold hover:bg-gray-300">Cancel</button>
                          </>
                      ) : (
                          <>
                              <button onClick={() => setIsEditing(true)} className="p-2 bg-white rounded-full shadow-sm text-system-blue hover:bg-blue-50 border border-gray-100"><EditIcon className="w-4 h-4"/></button>
                              <button onClick={() => handleCopy(editedResume)} className="p-2 bg-white rounded-full shadow-sm text-system-blue hover:bg-blue-50 border border-gray-100"><ClipboardIcon className="w-4 h-4"/></button>
                              <button onClick={handleDownloadResumePdf} className="p-2 bg-white rounded-full shadow-sm text-system-blue hover:bg-blue-50 border border-gray-100"><DownloadIcon className="w-4 h-4"/></button>
                          </>
                      )}
                  </div>
               </div>
             )}
             
             <div className="bg-white shadow-sm border border-gray-200 min-h-[500px] p-6 sm:p-8 rounded-sm mx-auto w-full max-w-2xl relative flex flex-col">
                {isLowMatch ? (
                    <div className="flex-1 flex flex-col items-center justify-center text-center p-6 space-y-4 animate-scale-in">
                        <div className="w-16 h-16 bg-orange-50 rounded-full flex items-center justify-center text-system-orange text-3xl">⚠️</div>
                        <h4 className="text-xl font-bold text-gray-900">Optimization Skipped</h4>
                        <p className="text-sm text-gray-500 max-w-sm leading-relaxed">
                            Your resume match score is too low for a meaningful rewrite. 
                            To ensure 100% accuracy, our AI refuses to fabricate experience or skills that aren't in your source document.
                        </p>
                        <div className="text-xs font-semibold text-gray-400 uppercase tracking-wider pt-4 border-t border-gray-100 w-full">
                            Zero Hallucination Policy Active
                        </div>
                    </div>
                ) : isEditing ? (
                    <textarea 
                        value={editedResume} 
                        onChange={(e) => setEditedResume(e.target.value)}
                        className="w-full h-full min-h-[600px] text-sm font-serif leading-relaxed text-gray-800 outline-none resize-none"
                    />
                ) : (
                    <pre className="whitespace-pre-wrap font-serif text-sm text-gray-800 leading-relaxed font-normal">
                        {editedResume}
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
                                     <button onClick={handleEmailCoverLetter} className="px-4 py-1.5 rounded-full bg-system-blue/10 text-system-blue text-xs font-bold hover:bg-system-blue/20">Email</button>
                                     <button onClick={handleDownloadCoverLetterPdf} className="px-4 py-1.5 rounded-full bg-system-blue/10 text-system-blue text-xs font-bold hover:bg-system-blue/20">Download PDF</button>
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
