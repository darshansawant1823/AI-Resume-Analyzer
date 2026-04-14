import React, { useState } from 'react';
import type { RecruiterScanResult } from '../types';
import { performRecruiterScan } from '../services/geminiService';
import { useInterviewData } from '../src/hooks/useInterviewData';
import { User } from 'firebase/auth';

interface RecruiterScanProps {
  jobDescription: string;
  resumeFile: File | null;
  extractedText?: string;
  user: User | null;
}

export const RecruiterScan: React.FC<RecruiterScanProps> = ({ jobDescription, resumeFile, extractedText, user }) => {
  const [scanResult, setScanResult] = useState<RecruiterScanResult | null>(null);
  const [isScanning, setIsScanning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { saveInterview } = useInterviewData(user);

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

  const handleStartScan = async () => {
    if ((!resumeFile && !extractedText) || !jobDescription) return;
    setIsScanning(true);
    setError(null);
    try {
      let resumePayload: { text?: string; base64Data?: string; mimeType?: string; } = {};
      
      if (resumeFile) {
        if (resumeFile.type.startsWith('image/') || resumeFile.type === 'application/pdf') {
          const { base64Data, mimeType } = await fileToBase64(resumeFile);
          resumePayload = { base64Data, mimeType };
        } else {
          const text = await resumeFile.text();
          resumePayload = { text };
        }
      } else if (extractedText) {
        resumePayload = { text: extractedText };
      }

      const result = await performRecruiterScan(jobDescription, resumePayload);
      setScanResult(result);

      if (user) {
        await saveInterview({
          type: 'recruiter_scan',
          jobDescription,
          resumeName: resumeFile?.name || 'Extracted Text',
          result
        });
      }
    } catch (err) {
      console.error("Recruiter Scan Error:", err);
      setError("Failed to simulate scan. Please ensure the Job Description is provided.");
    } finally {
      setIsScanning(false);
    }
  };

  if (isScanning) {
    return (
      <div className="flex flex-col items-center justify-center py-20 bg-white rounded-3xl shadow-apple-card border border-white/60">
        <div className="relative w-20 h-20 mb-6">
             <div className="absolute inset-0 border-4 border-gray-100 rounded-full"></div>
             <div className="absolute inset-0 border-4 border-t-system-blue border-r-transparent border-b-transparent border-l-transparent rounded-full animate-spin"></div>
        </div>
        <h3 className="text-xl font-bold text-gray-900">Simulating Recruiter Scan</h3>
        <p className="text-gray-500 mt-2">6-second eye-tracking simulation...</p>
      </div>
    );
  }

  if (!scanResult) {
    return (
      <div className="relative overflow-hidden bg-white rounded-3xl shadow-apple-card border border-white/60 p-6 sm:p-10 text-center group">
        <div className="absolute top-0 left-0 w-full h-1.5 bg-gradient-to-r from-system-blue to-purple-500"></div>
        <div className="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center mx-auto mb-6 text-3xl shadow-sm">
            👀
        </div>
        <h2 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-3 tracking-tight">The 6-Second Test</h2>
        <p className="text-sm sm:text-base text-gray-500 max-w-lg mx-auto mb-8 leading-relaxed font-medium">
          Recruiters spend an average of 6 seconds on a resume. Our AI simulates this rapid scan to tell you exactly what pops out—and what gets missed.
        </p>
        <div className="flex flex-col items-center gap-4">
            <button
              onClick={handleStartScan}
              disabled={!jobDescription || (!resumeFile && !extractedText)}
              className="px-8 py-3 bg-gray-900 text-white text-sm font-bold rounded-full shadow-lg hover:bg-gray-800 active:scale-95 transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-gray-900"
            >
              Run Simulation
            </button>
            {!jobDescription && (
                <p className="text-[10px] font-bold text-red-500 uppercase tracking-widest animate-pulse">
                    ⚠️ Please provide a Job Description first
                </p>
            )}
            {error && <p className="text-xs text-red-500 font-medium">{error}</p>}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-scale-in pb-12">
        
      {/* Impression Header */}
      <div className="bg-gray-900 text-white p-6 sm:p-8 rounded-3xl shadow-2xl relative overflow-hidden">
        <div className="relative z-10">
            <h3 className="text-[10px] uppercase tracking-[0.2em] font-bold text-gray-400 mb-3">Recruiter's First Impression</h3>
            <p className="text-xl sm:text-2xl font-semibold leading-relaxed font-serif italic">
                "{scanResult.recruiterImpression}"
            </p>
        </div>
        <div className="absolute top-0 right-0 -mt-10 -mr-10 w-40 h-40 bg-system-blue blur-[80px] opacity-30"></div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Noticed First */}
        <div className="bg-white rounded-3xl p-5 sm:p-6 shadow-apple-card border border-white/60 flex flex-col h-full">
            <div className="flex items-center gap-3 mb-5">
                <div className="w-7 h-7 rounded-full bg-green-100 flex items-center justify-center text-system-green font-bold text-xs">1</div>
                <h4 className="font-bold text-gray-900 text-base">Noticed First</h4>
            </div>
            <ul className="space-y-2.5 flex-1">
                {(scanResult.firstNoticed || []).map((item, i) => (
                    <li key={i} className="flex items-start gap-3 text-[13px] font-semibold text-gray-700 bg-gray-50/50 p-3 rounded-xl border border-gray-100/50">
                        <span className="text-system-green mt-0.5 flex-shrink-0">✓</span>
                        {item}
                    </li>
                ))}
            </ul>
        </div>

        {/* Missed */}
        <div className="bg-white rounded-3xl p-5 sm:p-6 shadow-apple-card border border-white/60 flex flex-col h-full opacity-80 hover:opacity-100 transition-opacity">
             <div className="flex items-center gap-3 mb-5">
                <div className="w-7 h-7 rounded-full bg-gray-100 flex items-center justify-center text-gray-500 font-bold text-xs">2</div>
                <h4 className="font-bold text-gray-900 text-base">Overlooked</h4>
            </div>
            <ul className="space-y-2.5 flex-1">
                {(scanResult.missedItems || []).map((item, i) => (
                    <li key={i} className="flex items-start gap-3 text-[13px] text-gray-500 italic p-3 leading-snug">
                         <span className="text-gray-300 flex-shrink-0">∅</span>
                        {item}
                    </li>
                ))}
            </ul>
        </div>

        {/* Red Flags */}
        <div className="bg-white rounded-3xl p-5 sm:p-6 shadow-apple-card border border-white/60 flex flex-col h-full relative overflow-hidden">
             <div className="absolute top-0 left-0 w-full h-1 bg-system-red/50"></div>
             <div className="flex items-center gap-3 mb-5">
                <div className="w-7 h-7 rounded-full bg-red-100 flex items-center justify-center text-system-red font-bold text-xs">!</div>
                <h4 className="font-bold text-gray-900 text-base">Red Flags</h4>
            </div>
             {(scanResult.redFlags || []).length > 0 ? (
                <ul className="space-y-2.5 flex-1">
                    {(scanResult.redFlags || []).map((item, i) => (
                        <li key={i} className="flex items-start gap-3 text-[13px] font-semibold text-red-600 bg-red-50/50 p-3 rounded-xl border border-red-100/50">
                            <span className="flex-shrink-0">⚠️</span>
                            {item}
                        </li>
                    ))}
                </ul>
            ) : (
                <div className="flex-1 flex flex-col items-center justify-center text-center text-gray-400 py-8">
                    <span className="text-3xl mb-2">✨</span>
                    <p className="text-xs font-bold uppercase tracking-widest">Clean scan!</p>
                </div>
            )}
        </div>
      </div>
      
      <div className="text-center pt-4">
          <button onClick={() => setScanResult(null)} className="text-[11px] font-bold uppercase tracking-widest text-gray-400 hover:text-gray-900 transition-colors">
              Reset Simulation
          </button>
      </div>
    </div>
  );
};
