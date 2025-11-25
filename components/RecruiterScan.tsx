import React, { useState } from 'react';
import type { RecruiterScanResult } from '../types';
import { performRecruiterScan } from '../services/geminiService';

interface RecruiterScanProps {
  jobDescription: string;
  resumeFile: File | null;
}

export const RecruiterScan: React.FC<RecruiterScanProps> = ({ jobDescription, resumeFile }) => {
  const [scanResult, setScanResult] = useState<RecruiterScanResult | null>(null);
  const [isScanning, setIsScanning] = useState(false);

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
    if (!resumeFile || !jobDescription) return;
    setIsScanning(true);
    try {
      let resumePayload: { text?: string; base64Data?: string; mimeType?: string; } = {};
      if (resumeFile.type.startsWith('image/') || resumeFile.type === 'application/pdf') {
        const { base64Data, mimeType } = await fileToBase64(resumeFile);
        resumePayload = { base64Data, mimeType };
      } else {
        const text = await resumeFile.text();
        resumePayload = { text };
      }
      const result = await performRecruiterScan(jobDescription, resumePayload);
      setScanResult(result);
    } catch (err) {
      console.error(err);
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
      <div className="relative overflow-hidden bg-white rounded-3xl shadow-apple-card border border-white/60 p-10 text-center group">
        <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-system-blue to-purple-500"></div>
        <div className="w-20 h-20 bg-gray-50 rounded-full flex items-center justify-center mx-auto mb-6 text-4xl shadow-sm">
            👀
        </div>
        <h2 className="text-3xl font-bold text-gray-900 mb-4 tracking-tight">The 6-Second Test</h2>
        <p className="text-lg text-gray-500 max-w-xl mx-auto mb-8 leading-relaxed">
          Recruiters spend an average of 6 seconds on a resume. Our AI simulates this rapid scan to tell you exactly what pops out—and what gets missed.
        </p>
        <button
          onClick={handleStartScan}
          className="px-10 py-4 bg-gray-900 text-white font-bold rounded-full shadow-lg hover:scale-105 active:scale-95 transition-all duration-300"
        >
          Run Simulation
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-scale-in">
        
      {/* Impression Header */}
      <div className="bg-gray-900 text-white p-8 rounded-3xl shadow-2xl relative overflow-hidden">
        <div className="relative z-10">
            <h3 className="text-xs uppercase tracking-[0.2em] font-bold text-gray-400 mb-4">Recruiter's First Impression</h3>
            <p className="text-2xl sm:text-3xl font-semibold leading-relaxed font-serif italic">
                "{scanResult.recruiterImpression}"
            </p>
        </div>
        <div className="absolute top-0 right-0 -mt-10 -mr-10 w-40 h-40 bg-system-blue blur-[80px] opacity-50"></div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Noticed First */}
        <div className="bg-white rounded-3xl p-6 shadow-apple-card border border-white/60 flex flex-col h-full">
            <div className="flex items-center gap-3 mb-6">
                <div className="w-8 h-8 rounded-full bg-green-100 flex items-center justify-center text-system-green font-bold text-sm">1</div>
                <h4 className="font-bold text-gray-900 text-lg">Noticed First</h4>
            </div>
            <ul className="space-y-3 flex-1">
                {scanResult.firstNoticed.map((item, i) => (
                    <li key={i} className="flex items-start gap-3 text-[15px] font-medium text-gray-700 bg-gray-50 p-3 rounded-xl">
                        <span className="text-system-green mt-0.5">✓</span>
                        {item}
                    </li>
                ))}
            </ul>
        </div>

        {/* Missed */}
        <div className="bg-white rounded-3xl p-6 shadow-apple-card border border-white/60 flex flex-col h-full opacity-75 hover:opacity-100 transition-opacity">
             <div className="flex items-center gap-3 mb-6">
                <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center text-gray-500 font-bold text-sm">2</div>
                <h4 className="font-bold text-gray-900 text-lg">Overlooked</h4>
            </div>
            <ul className="space-y-3 flex-1">
                {scanResult.missedItems.map((item, i) => (
                    <li key={i} className="flex items-start gap-3 text-[15px] text-gray-500 italic p-3">
                         <span className="text-gray-300">∅</span>
                        {item}
                    </li>
                ))}
            </ul>
        </div>

        {/* Red Flags */}
        <div className="bg-white rounded-3xl p-6 shadow-apple-card border border-white/60 flex flex-col h-full relative overflow-hidden">
             <div className="absolute top-0 left-0 w-full h-1 bg-system-red"></div>
             <div className="flex items-center gap-3 mb-6">
                <div className="w-8 h-8 rounded-full bg-red-100 flex items-center justify-center text-system-red font-bold text-sm">!</div>
                <h4 className="font-bold text-gray-900 text-lg">Red Flags</h4>
            </div>
             {scanResult.redFlags.length > 0 ? (
                <ul className="space-y-3 flex-1">
                    {scanResult.redFlags.map((item, i) => (
                        <li key={i} className="flex items-start gap-3 text-[15px] font-medium text-red-600 bg-red-50/50 p-3 rounded-xl border border-red-50">
                            <span>⚠️</span>
                            {item}
                        </li>
                    ))}
                </ul>
            ) : (
                <div className="flex-1 flex flex-col items-center justify-center text-center text-gray-400">
                    <span className="text-4xl mb-2">✨</span>
                    <p className="text-sm font-medium">Clean scan!</p>
                </div>
            )}
        </div>
      </div>
      
      <div className="text-center pt-4">
          <button onClick={() => setScanResult(null)} className="text-sm font-medium text-gray-400 hover:text-gray-900 transition-colors">
              Reset Simulation
          </button>
      </div>
    </div>
  );
};