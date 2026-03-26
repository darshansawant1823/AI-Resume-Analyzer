
import React, { useState } from 'react';
import { MaximizeIcon } from './icons/MaximizeIcon';
import { TrashIcon } from './icons/TrashIcon';

interface JobDescriptionInputProps {
  value: string;
  onChange: (value: string) => void;
}

export const JobDescriptionInput: React.FC<JobDescriptionInputProps> = ({ value, onChange }) => {
  const [isMaximized, setIsMaximized] = useState(false);

  return (
    <div className="space-y-3">
      <label htmlFor="job-description" className="block text-lg font-semibold text-gray-900 tracking-tight">
        Job Description
      </label>
      <div className="relative group">
        <textarea
          id="job-description"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="Paste the job requirements here..."
          className="w-full h-40 sm:h-48 p-4 bg-gray-50/50 hover:bg-gray-50 border-0 rounded-2xl text-gray-900 placeholder-gray-400 focus:bg-white focus:ring-2 focus:ring-system-blue/20 transition-all duration-200 resize-none text-sm sm:text-[15px] leading-relaxed shadow-inner pr-12"
        />
        
        {/* Actions */}
        <div className="absolute top-2 right-2 flex items-center gap-1">
          {value && (
             <button
              onClick={() => onChange('')}
              className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all"
              title="Clear"
            >
              <TrashIcon className="w-5 h-5" />
            </button>
          )}
          <button
            onClick={() => setIsMaximized(true)}
            className="p-2 text-gray-400 hover:text-system-blue hover:bg-white rounded-lg transition-all opacity-100 sm:opacity-0 group-hover:opacity-100"
            title="Maximize"
          >
            <MaximizeIcon className="w-5 h-5" />
          </button>
        </div>

        <div className="absolute bottom-3 right-4 text-xs text-gray-400 font-medium pointer-events-none">
          {value.length > 0 ? `${value.length} chars` : 'Required'}
        </div>
      </div>
      <p className="text-[13px] text-gray-500 font-medium pl-1">
        Tip: Include responsibilities and qualifications.
      </p>

      {/* Full Screen Modal */}
      {isMaximized && (
        <div className="fixed inset-0 z-[100] bg-white animate-scale-in flex flex-col">
          <div className="flex items-center justify-between px-4 sm:px-8 py-5 border-b border-gray-100 bg-white/80 backdrop-blur-xl sticky top-0">
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 bg-gray-900 rounded-xl flex items-center justify-center text-white shadow-lg">
                <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
              </div>
              <div>
                <h2 className="text-xl font-bold text-gray-900 tracking-tight">Job Description</h2>
                <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Distraction-free Editor</p>
              </div>
            </div>
            <div className="flex items-center gap-6">
               <div className="hidden sm:flex flex-col items-end">
                  <span className="text-xs font-bold text-gray-900">{value.length}</span>
                  <span className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Characters</span>
               </div>
               <button
                onClick={() => setIsMaximized(false)}
                className="px-8 py-3 bg-gray-900 text-white text-sm font-bold rounded-full hover:bg-black transition-all shadow-xl hover:scale-105 active:scale-95"
              >
                Done
              </button>
            </div>
          </div>
          <div className="flex-1 overflow-y-auto bg-[#F9F9FB]">
            <div className="max-w-4xl mx-auto w-full p-6 sm:p-20">
              <div className="bg-white p-8 sm:p-16 rounded-[2.5rem] shadow-apple-card border border-white/60 min-h-[600px]">
                <textarea
                  autoFocus
                  value={value}
                  onChange={(e) => onChange(e.target.value)}
                  placeholder="Paste the job requirements here..."
                  className="w-full h-full min-h-[500px] resize-none outline-none text-lg sm:text-2xl leading-relaxed text-gray-800 font-serif italic placeholder-gray-200 bg-transparent"
                />
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
