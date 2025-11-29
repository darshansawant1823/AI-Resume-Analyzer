
import React from 'react';

interface HeaderProps {
  activePortal?: 'seeker' | 'recruiter';
  onPortalChange?: (portal: 'seeker' | 'recruiter') => void;
  onShowTerms?: () => void;
  onLogoClick?: () => void;
}

export const Header: React.FC<HeaderProps> = ({ activePortal, onPortalChange, onShowTerms, onLogoClick }) => {

  return (
    <header className="sticky top-0 z-50 w-full backdrop-blur-xl bg-white/70 border-b border-gray-200/50 supports-[backdrop-filter]:bg-white/60">
      <div className="container mx-auto px-4 sm:px-6 h-16">
        <div className="flex justify-between items-center h-full">
          {/* Logo Area */}
          <div 
            className="flex items-center gap-2 sm:gap-3 flex-shrink-0 cursor-pointer group"
            onClick={onLogoClick}
          >
            <div className="w-8 h-8 sm:w-9 sm:h-9 bg-gradient-to-br from-system-blue to-[#00C7BE] rounded-xl shadow-sm flex items-center justify-center text-white transition-transform duration-200 group-hover:scale-105">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                <polyline points="14 2 14 8 20 8"></polyline>
                <line x1="16" y1="13" x2="8" y2="13"></line>
                <line x1="16" y1="17" x2="8" y2="17"></line>
                <polyline points="10 9 9 9 8 9"></polyline>
              </svg>
            </div>
            <span className="text-lg font-semibold tracking-tight text-gray-900 hidden xs:block group-hover:text-system-blue transition-colors">
              Resume<span className="text-system-blue group-hover:text-gray-900 transition-colors">AI</span>
            </span>
          </div>
          
          <div className="flex items-center gap-2 sm:gap-6 flex-shrink-0">
            {/* iOS Segmented Control */}
            {activePortal && onPortalChange && (
                <div className="flex bg-gray-200/50 p-1 rounded-lg backdrop-blur-sm">
                  <button
                    onClick={() => onPortalChange('seeker')}
                    className={`px-3 sm:px-4 py-1.5 text-xs sm:text-[13px] font-medium rounded-[6px] transition-all duration-200 ease-out whitespace-nowrap ${
                      activePortal === 'seeker' 
                        ? 'bg-white text-gray-900 shadow-[0_1px_2px_rgba(0,0,0,0.12)]' 
                        : 'text-gray-500 hover:text-gray-700'
                    }`}
                  >
                    Job Seekers
                  </button>
                  <button
                    onClick={() => onPortalChange('recruiter')}
                    className={`px-3 sm:px-4 py-1.5 text-xs sm:text-[13px] font-medium rounded-[6px] transition-all duration-200 ease-out whitespace-nowrap ${
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
              className="group flex items-center gap-2 text-[13px] font-medium text-gray-500 hover:text-system-blue transition-colors p-2 sm:p-0"
              title="Terms & Conditions"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 sm:h-4 sm:w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              <span className="hidden lg:inline">Terms</span>
            </button>
          </div>
        </div>
      </div>
    </header>
  );
};
