
import React, { useState } from 'react';
import { MaximizeIcon } from './icons/MaximizeIcon';

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
        
        {/* Maximize Button */}
        <button
          onClick={() => setIsMaximized(true)}
          className="absolute top-2 right-2 p-2 text-gray-400 hover:text-system-blue hover:bg-white rounded-lg transition-all opacity-100 sm:opacity-0 group-hover:opacity-100"
          title="Maximize"
        >
          <MaximizeIcon className="w-5 h-5" />
        </button>

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
          <div className="flex items-center justify-between px-4 sm:px-6 py-4 border-b border-gray-100 bg-gray-50/50 backdrop-blur-md">
            <div>
              <h2 className="text-lg font-bold text-gray-900">Job Description</h2>
              <p className="text-xs text-gray-500">Distraction-free editing mode</p>
            </div>
            <div className="flex items-center gap-4">
               <span className="text-xs font-medium text-gray-400 hidden sm:inline">{value.length} chars</span>
               <button
                onClick={() => setIsMaximized(false)}
                className="px-4 py-2 bg-gray-900 text-white text-sm font-semibold rounded-full hover:bg-gray-800 transition-colors shadow-lg"
              >
                Done
              </button>
            </div>
          </div>
          <div className="flex-1 p-4 sm:p-10 max-w-5xl mx-auto w-full">
            <textarea
              autoFocus
              value={value}
              onChange={(e) => onChange(e.target.value)}
              placeholder="Paste the job requirements here..."
              className="w-full h-full resize-none outline-none text-base sm:text-lg leading-relaxed text-gray-800 font-serif placeholder-gray-300"
            />
          </div>
        </div>
      )}
    </div>
  );
};
