
import React from 'react';
import { User as FirebaseUser } from 'firebase/auth';
import { UserProfile } from '../src/hooks/useFirebase';
import { User as UserIcon, LogIn } from 'lucide-react';

interface HeaderProps {
  activePortal?: 'seeker' | 'recruiter' | 'admin' | 'profile';
  onPortalChange?: (portal: 'seeker' | 'recruiter' | 'admin' | 'profile') => void;
  onShowTerms?: () => void;
  onLogoClick?: () => void;
  user?: FirebaseUser | null;
  profile?: UserProfile | null;
  onLoginClick?: () => void;
  onProfileClick?: () => void;
}

export const Header: React.FC<HeaderProps> = ({ 
  activePortal, 
  onPortalChange, 
  onShowTerms, 
  onLogoClick,
  user,
  profile,
  onLoginClick,
  onProfileClick
}) => {

  return (
    <header className="sticky top-0 z-50 w-full backdrop-blur-xl bg-white/70 border-b border-gray-200/50 supports-[backdrop-filter]:bg-white/60">
      <div className="container mx-auto px-4 sm:px-6 h-16">
        <div className="flex justify-between items-center h-full">
          {/* Logo Area */}
          <div 
            className="flex items-center gap-3 flex-shrink-0 cursor-pointer group"
            onClick={onLogoClick}
          >
            <div className="w-10 h-10 bg-gray-900 rounded-2xl shadow-xl flex items-center justify-center text-white transition-all duration-300 group-hover:scale-110 group-hover:rotate-3 group-hover:bg-system-blue">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                <polyline points="14 2 14 8 20 8"></polyline>
                <path d="M8 13h8"></path>
                <path d="M8 17h8"></path>
                <path d="M10 9H8"></path>
              </svg>
            </div>
            <div className="flex flex-col">
              <span className="text-lg font-black tracking-tighter text-gray-900 leading-none group-hover:text-system-blue transition-colors">
                RESUME<span className="text-system-blue group-hover:text-gray-900 transition-colors">AI</span>
              </span>
              <span className="text-[9px] font-bold uppercase tracking-[0.2em] text-gray-400 leading-none mt-1">Intelligence</span>
            </div>
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
                  {profile?.role === 'admin' && (
                    <button
                      onClick={() => onPortalChange('admin')}
                      className={`px-3 sm:px-4 py-1.5 text-xs sm:text-[13px] font-medium rounded-[6px] transition-all duration-200 ease-out whitespace-nowrap ${
                        activePortal === 'admin' 
                          ? 'bg-black text-white shadow-[0_1px_2px_rgba(0,0,0,0.12)]' 
                          : 'text-gray-500 hover:text-gray-700'
                      }`}
                    >
                      Admin
                    </button>
                  )}
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

            <div className="w-px h-6 bg-gray-200 mx-1 hidden sm:block"></div>

            {user ? (
              <button 
                onClick={onProfileClick}
                className="flex items-center gap-2 p-1 pr-3 bg-gray-100 hover:bg-gray-200 rounded-full transition-all group"
              >
                <div className="w-8 h-8 bg-indigo-600 rounded-full flex items-center justify-center text-white text-xs font-bold shadow-sm group-hover:scale-105 transition-transform">
                  {profile?.fullName?.charAt(0).toUpperCase() || <UserIcon className="w-4 h-4" />}
                </div>
                <span className="text-xs font-bold text-gray-700 hidden sm:inline">{profile?.fullName?.split(' ')[0] || 'Profile'}</span>
              </button>
            ) : (
              <button 
                onClick={onLoginClick}
                className="flex items-center gap-2 px-4 py-2 bg-gray-900 text-white text-xs font-bold rounded-full hover:bg-system-blue transition-all shadow-lg active:scale-95"
              >
                <LogIn className="w-3.5 h-3.5" />
                <span>Login</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </header>
  );
};
