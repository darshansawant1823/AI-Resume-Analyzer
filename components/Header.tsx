import React from 'react';

interface HeaderProps {
  activePortal?: 'seeker' | 'recruiter';
  onPortalChange?: (portal: 'seeker' | 'recruiter') => void;
  onShowTerms?: () => void;
}

export const Header: React.FC<HeaderProps> = ({ activePortal, onPortalChange, onShowTerms }) => {

  return (
    <header className="sticky top-0 z-50 w-full backdrop-blur-xl bg-white/70 border-b border-gray-200/50 supports-[backdrop-filter]:bg-white/60">
      <div className="container mx-auto px-6 h-16">
        <div className="flex justify-between items-center h-full">
          {/* Logo Area */}
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-gradient-to-br from-system-blue to-[#00C7BE] rounded-xl shadow-sm flex items-center justify-center text-white">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                <polyline points="14 2 14 8 20 8"></polyline>
                <line x1="16" y1="13" x2="8" y2="13"></line>
                <line x1="16" y1="17" x2="8" y2="17"></line>
                <polyline points="10 9 9 9 8 9"></polyline>
              </svg>
            </div>
            <span className="text-lg font-semibold tracking-tight text-gray-900 hidden sm:block">
              Resume<span className="text-system-blue">AI</span>
            </span>
          </div>
          
          <div className="flex items-center gap-6">
            {/* iOS Segmented Control */}
            {activePortal && onPortalChange && (
                <div className="flex bg-gray-200/50 p-1 rounded-lg backdrop-blur-sm">
                  <button
                    onClick={() => onPortalChange('seeker')}
                    className={`px-4 py-1.5 text-[13px] font-medium rounded-[6px] transition-all duration-200 ease-out ${
                      activePortal === 'seeker' 
                        ? 'bg-white text-gray-900 shadow-[0_1px_2px_rgba(0,0,0,0.12)]' 
                        : 'text-gray-500 hover:text-gray-700'
                    }`}
                  >
                    Job Seekers
                  </button>
                  <button
                    onClick={() => onPortalChange('recruiter')}
                    className={`px-4 py-1.5 text-[13px] font-medium rounded-[6px] transition-all duration-200 ease-out ${
                      activePortal === 'recruiter' 
                        ? 'bg-white text-gray-900 shadow-[0_1px_2px_rgba(0,0,0,0.12)]' 
                        : 'text-gray-500 hover:text-gray-700'
                    }`}
                  >
                    Recruiters
                  </button>
                </div>
             )}

            <button 
              onClick={onShowTerms}
              className="group flex items-center gap-2 text-[13px] font-medium text-gray-500 hover:text-system-blue transition-colors"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              <span className="hidden sm:inline">Terms & Conditions</span>
            </button>
          </div>
        </div>
      </div>
    </header>
  );
};