
import React, { useState, useEffect, useMemo } from 'react';
import { motion } from 'framer-motion';
import { jsPDF } from 'jspdf';
import { 
  User, 
  Briefcase, 
  Clock, 
  Mail, 
  Phone, 
  Lock, 
  Save, 
  LogOut,
  CheckCircle2,
  History,
  Search,
  ArrowRight,
  Trash2,
  FileText,
  MessageSquare,
  X,
  Download,
  Filter,
  ChevronLeft,
  ChevronRight,
  Sparkles,
  ClipboardList,
  CheckSquare,
  Square,
  Copy
} from 'lucide-react';
import { auth } from '../src/firebase';
import { updatePassword, sendEmailVerification, signOut, User as FirebaseUser } from 'firebase/auth';
import { UserProfile } from '../src/hooks/useFirebase';
import { useInterviewData } from '../src/hooks/useInterviewData';
import { useRecruiterData } from '../src/hooks/useRecruiterData';
import { Candidate, AnalysisResult } from '../types';
import { CompareProfiles } from './CompareProfiles';

interface ProfilePageProps {
  profile: UserProfile | null;
  user: FirebaseUser | null;
  onUpdate: (data: Partial<UserProfile>) => Promise<void>;
  onBack: () => void;
}

export const ProfilePage: React.FC<ProfilePageProps> = ({ 
  profile, 
  user,
  onUpdate,
  onBack
}) => {
  const [fullName, setFullName] = useState(profile?.fullName || '');
  const [jobRole, setJobRole] = useState(profile?.jobRole || '');
  const [experience, setExperience] = useState(profile?.experience || '');
  const [phone, setPhone] = useState(profile?.phoneNumber || '');
  const [newPassword, setNewPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // History State
  const [historyTab, setHistoryTab] = useState<'seeker' | 'recruiter'>('seeker');
  const [searchTerm, setSearchTerm] = useState('');
  const [expRange, setExpRange] = useState({ min: 0, max: 20 });
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  // Recruiter JD Scan State
  const [profileJD, setProfileJD] = useState('');
  const [topPicks, setTopPicks] = useState<Candidate[]>([]);
  const [selectedForCompare, setSelectedForCompare] = useState<Set<string>>(new Set());
  const [isComparing, setIsComparing] = useState(false);
  
  const { history: interviewHistory, loading: loadingInterviews } = useInterviewData(user);
  const { history, candidates, loading: loadingScans, deleteCandidate } = useRecruiterData(user);

  const scanHistory = useMemo(() => {
    // Combine active candidates and past history, remove duplicates if any
    const combined = [...candidates, ...history];
    return combined.sort((a, b) => {
      const dateA = new Date(a.createdAt || 0).getTime();
      const dateB = new Date(b.createdAt || 0).getTime();
      return dateB - dateA;
    });
  }, [candidates, history]);

  useEffect(() => {
    if (profile) {
      setFullName(profile.fullName);
      setJobRole(profile.jobRole);
      setExperience(profile.experience);
      setPhone(profile.phoneNumber || '');
    }
  }, [profile]);

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSuccess(null);
    try {
      await onUpdate({
        fullName,
        jobRole,
        experience,
        phoneNumber: phone
      });
      setSuccess('Profile updated successfully');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleChangePassword = async () => {
    if (!newPassword) return;
    setLoading(true);
    setError(null);
    setSuccess(null);
    try {
      if (auth.currentUser) {
        await updatePassword(auth.currentUser, newPassword);
        setSuccess('Password updated successfully');
        setNewPassword('');
      }
    } catch (err: any) {
      if (err.code === 'auth/requires-recent-login') {
        setError('Please re-login to change your password.');
      } else {
        setError(err.message);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyEmail = async () => {
    setLoading(true);
    setError(null);
    setSuccess(null);
    try {
      if (auth.currentUser) {
        await sendEmailVerification(auth.currentUser);
        setSuccess('Verification email sent.');
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    await signOut(auth);
    onBack();
  };

  // Filtered Recruiter History
  const filteredScans = useMemo(() => {
    let filtered = scanHistory;
    
    // Search filter
    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(c => {
        const name = c.name?.toLowerCase() || '';
        const email = c.analysis?.email?.toLowerCase() || '';
        const phone = c.analysis?.phone?.toLowerCase() || '';
        const jobType = c.analysis?.jobType?.toLowerCase() || '';
        const category = c.analysis?.category?.toLowerCase() || '';
        const skills = c.analysis?.strengths?.join(' ').toLowerCase() || '';
        
        return name.includes(term) || 
               email.includes(term) || 
               phone.includes(term) || 
               jobType.includes(term) || 
               category.includes(term) ||
               skills.includes(term);
      });
    }

    // Experience filter
    filtered = filtered.filter(c => {
      const exp = c.analysis?.years_experience || 0;
      return exp >= expRange.min && exp <= expRange.max;
    });

    return filtered;
  }, [scanHistory, searchTerm, expRange]);

  // Pagination logic
  const paginatedInterviews = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return interviewHistory.slice(start, start + itemsPerPage);
  }, [interviewHistory, currentPage]);

  const paginatedScans = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return filteredScans.slice(start, start + itemsPerPage);
  }, [filteredScans, currentPage]);

  const totalPages = useMemo(() => {
    const total = historyTab === 'seeker' ? interviewHistory.length : filteredScans.length;
    return Math.ceil(total / itemsPerPage);
  }, [historyTab, interviewHistory.length, filteredScans.length]);

  const handleDownloadResume = (analysis: AnalysisResult, name: string) => {
    if (!analysis.custom_resume_text) return;
    
    const doc = new jsPDF();
    const splitText = doc.splitTextToSize(analysis.custom_resume_text, 180);
    doc.text(splitText, 15, 20);
    doc.save(`${name}_optimized.pdf`);
  };

  const handleJDScan = () => {
    if (!profileJD.trim()) return;
    
    const term = profileJD.toLowerCase();
    // Simple matching logic for "top 3 picks" from history
    const scored = filteredScans.map(c => {
      let score = c.analysis?.match_score || 0;
      const text = (c.extractedText || '').toLowerCase();
      if (text.includes(term)) score += 20;
      return { candidate: c, score };
    }).sort((a, b) => b.score - a.score);

    setTopPicks(scored.slice(0, 3).map(s => s.candidate));
  };

  const toggleCompareSelection = (id: string) => {
    const newSet = new Set(selectedForCompare);
    if (newSet.has(id)) newSet.delete(id);
    else newSet.add(id);
    setSelectedForCompare(newSet);
  };

  if (isComparing) {
    const candidatesToCompare = scanHistory.filter(c => selectedForCompare.has(c.id));
    return (
      <div className="min-h-screen bg-gray-50 p-8">
        <CompareProfiles 
          candidates={candidatesToCompare} 
          jdText={profileJD} 
          onBack={() => setIsComparing(false)} 
        />
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-10 animate-scale-in">
      <div className="flex flex-col lg:flex-row gap-10">
        
        {/* Left Column: Profile Info */}
        <div className="lg:w-1/3 space-y-8">
          <div className="bg-white rounded-[2.5rem] shadow-apple-card border border-white/60 p-8 sm:p-10">
            <div className="flex items-center gap-6 mb-10">
              <div className="w-20 h-20 bg-indigo-600 rounded-3xl flex items-center justify-center text-white text-3xl font-bold shadow-xl shadow-indigo-200">
                {fullName.charAt(0).toUpperCase()}
              </div>
              <div>
                <h2 className="text-2xl font-bold text-gray-900 tracking-tight">{fullName}</h2>
                <p className="text-gray-500 text-sm font-medium">{profile?.email}</p>
                <div className="flex items-center gap-2 mt-2">
                  <span className="px-3 py-1 bg-indigo-50 text-indigo-600 text-[10px] font-bold uppercase tracking-widest rounded-full border border-indigo-100">
                    {profile?.role}
                  </span>
                  {auth.currentUser?.emailVerified ? (
                    <span className="flex items-center gap-1 text-[10px] font-bold text-green-600 uppercase tracking-widest">
                      <CheckCircle2 className="w-3 h-3" /> Verified
                    </span>
                  ) : (
                    <button onClick={handleVerifyEmail} className="text-[10px] font-bold text-amber-600 uppercase tracking-widest hover:underline">
                      Verify Email
                    </button>
                  )}
                </div>
              </div>
            </div>

            {(error || success) && (
              <div className={`p-4 rounded-2xl mb-8 text-sm font-bold flex items-center gap-3 ${error ? 'bg-red-50 text-red-600 border border-red-100' : 'bg-green-50 text-green-600 border border-green-100'}`}>
                {error ? <X className="w-4 h-4" /> : <CheckCircle2 className="w-4 h-4" />}
                {error || success}
              </div>
            )}

            <form onSubmit={handleUpdateProfile} className="space-y-6">
              <div className="space-y-4">
                <h3 className="text-xs font-bold uppercase tracking-[0.2em] text-gray-400 flex items-center gap-2">
                  <User className="w-3 h-3" /> Personal Details
                </h3>
                <div className="space-y-4">
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider ml-1">Full Name</label>
                    <div className="relative">
                      <User className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                      <input type="text" value={fullName} onChange={(e) => setFullName(e.target.value)} className="w-full pl-12 pr-4 py-3 bg-gray-50 border border-gray-100 rounded-2xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all text-sm font-medium" />
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider ml-1">Job Role</label>
                    <div className="relative">
                      <Briefcase className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                      <input type="text" value={jobRole} onChange={(e) => setJobRole(e.target.value)} className="w-full pl-12 pr-4 py-3 bg-gray-50 border border-gray-100 rounded-2xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all text-sm font-medium" />
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider ml-1">Experience</label>
                    <div className="relative">
                      <Clock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                      <input type="text" value={experience} onChange={(e) => setExperience(e.target.value)} className="w-full pl-12 pr-4 py-3 bg-gray-50 border border-gray-100 rounded-2xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all text-sm font-medium" />
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider ml-1">Phone Number</label>
                    <div className="relative">
                      <Phone className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                      <input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} className="w-full pl-12 pr-4 py-3 bg-gray-50 border border-gray-100 rounded-2xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all text-sm font-medium" />
                    </div>
                  </div>
                </div>
                <button type="submit" disabled={loading} className="w-full py-4 bg-gray-900 text-white font-bold rounded-2xl hover:bg-black transition-all flex items-center justify-center gap-2 disabled:opacity-50 shadow-lg shadow-gray-200">
                  <Save className="w-4 h-4" /> Save Changes
                </button>
              </div>

              <div className="pt-8 border-t border-gray-100 space-y-4">
                <h3 className="text-xs font-bold uppercase tracking-[0.2em] text-gray-400 flex items-center gap-2">
                  <Lock className="w-3 h-3" /> Security
                </h3>
                <div className="relative">
                  <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input type="password" placeholder="New Password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} className="w-full pl-12 pr-4 py-3 bg-gray-50 border border-gray-100 rounded-2xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all text-sm font-medium" />
                </div>
                <button onClick={handleChangePassword} disabled={loading || !newPassword} className="w-full py-3 bg-white border border-gray-200 text-gray-900 font-bold rounded-2xl hover:bg-gray-50 transition-all disabled:opacity-50">
                  Update Password
                </button>
              </div>

              <div className="pt-8 border-t border-gray-100">
                <button onClick={handleLogout} className="w-full py-4 bg-red-50 text-red-600 font-bold rounded-2xl hover:bg-red-100 transition-all flex items-center justify-center gap-2">
                  <LogOut className="w-4 h-4" /> Sign Out
                </button>
              </div>
            </form>
          </div>
        </div>

        {/* Right Column: User History */}
        <div className="lg:w-2/3 space-y-8">
          <div className="bg-white rounded-[2.5rem] shadow-apple-card border border-white/60 overflow-hidden flex flex-col h-full min-h-[600px]">
            <div className="p-8 border-b border-gray-100 flex flex-col sm:flex-row sm:items-center justify-between gap-6">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-gray-900 rounded-xl flex items-center justify-center text-white">
                  <History className="w-5 h-5" />
                </div>
                <h2 className="text-2xl font-bold text-gray-900 tracking-tight">User History</h2>
              </div>
              
              {/* History Tabs */}
              <div className="bg-gray-100 p-1 rounded-xl flex">
                <button 
                  onClick={() => { setHistoryTab('seeker'); setCurrentPage(1); }}
                  className={`px-6 py-2 rounded-lg text-xs font-bold transition-all ${historyTab === 'seeker' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                >
                  Job Seeker
                </button>
                <button 
                  onClick={() => { setHistoryTab('recruiter'); setCurrentPage(1); }}
                  className={`px-6 py-2 rounded-lg text-xs font-bold transition-all ${historyTab === 'recruiter' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                >
                  Recruiter
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto">
              <div className="p-8 border-b border-gray-100">
                {/* Search and Filters */}
                <div className="flex flex-col gap-4">
                  <div className="flex flex-col sm:flex-row gap-3">
                    <div className="relative flex-1">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                      <input
                        type="text"
                        placeholder={historyTab === 'seeker' ? "Search interviews..." : "Search candidates, roles, categories..."}
                        value={searchTerm}
                        onChange={(e) => { setSearchTerm(e.target.value); setCurrentPage(1); }}
                        className="w-full pl-10 pr-4 py-3 bg-gray-50 border border-gray-100 rounded-2xl text-sm outline-none focus:ring-2 focus:ring-indigo-500/20 transition-all"
                      />
                    </div>
                    {historyTab === 'recruiter' && (
                      <div className="flex items-center gap-2">
                        <div className="flex items-center gap-3 px-4 py-3 bg-gray-50 rounded-2xl border border-gray-100">
                          <Filter className="w-4 h-4 text-gray-400" />
                          <span className="text-xs font-bold text-gray-500">Exp:</span>
                          <input 
                            type="number" 
                            placeholder="Min"
                            value={expRange.min}
                            onChange={(e) => setExpRange(prev => ({ ...prev, min: parseInt(e.target.value) || 0 }))}
                            className="w-8 bg-transparent border-none text-xs font-bold focus:ring-0 p-0"
                          />
                          <span className="text-gray-300">-</span>
                          <input 
                            type="number" 
                            placeholder="Max"
                            value={expRange.max}
                            onChange={(e) => setExpRange(prev => ({ ...prev, max: parseInt(e.target.value) || 20 }))}
                            className="w-8 bg-transparent border-none text-xs font-bold focus:ring-0 p-0"
                          />
                        </div>
                      </div>
                    )}
                  </div>

                  {/* JD Scan Section for Recruiters */}
                  {historyTab === 'recruiter' && (
                    <div className="p-6 bg-indigo-50/30 rounded-[2rem] border border-indigo-100/50">
                      <div className="flex items-center gap-2 mb-4">
                        <Sparkles className="w-5 h-5 text-indigo-600" />
                        <h3 className="text-sm font-bold text-indigo-900">Smart JD Matcher</h3>
                      </div>
                      <div className="flex flex-col gap-4">
                        <textarea
                          placeholder="Paste a Job Description here to find the top 3 matches from your history..."
                          value={profileJD}
                          onChange={(e) => setProfileJD(e.target.value)}
                          className="w-full p-4 bg-white border border-indigo-100 rounded-2xl text-sm focus:ring-2 focus:ring-indigo-500/20 min-h-[100px] resize-none shadow-sm"
                        />
                        <div className="flex items-center justify-between">
                          <button
                            onClick={handleJDScan}
                            disabled={!profileJD.trim()}
                            className="px-6 py-2.5 bg-indigo-600 text-white rounded-xl text-sm font-bold hover:bg-indigo-700 transition-all disabled:opacity-50 flex items-center gap-2 shadow-lg shadow-indigo-200 active:scale-95"
                          >
                            Scan History
                          </button>
                          {selectedForCompare.size > 0 && (
                            <button
                              onClick={() => setIsComparing(true)}
                              className="px-6 py-2.5 bg-white border border-indigo-200 text-indigo-600 rounded-xl text-sm font-bold hover:bg-indigo-50 transition-all flex items-center gap-2 active:scale-95"
                            >
                              <Copy className="w-4 h-4" />
                              Compare Selected ({selectedForCompare.size})
                            </button>
                          )}
                        </div>
                      </div>

                      {topPicks.length > 0 && (
                        <div className="mt-6 grid grid-cols-1 sm:grid-cols-3 gap-4">
                          {topPicks.map((candidate) => (
                            <div 
                              key={`top-${candidate.id}`}
                              className="p-4 bg-white rounded-2xl border-2 border-indigo-200 shadow-sm relative group animate-scale-in"
                            >
                              <div className="absolute -top-2.5 -right-2 bg-indigo-600 text-white text-[10px] font-bold px-3 py-1 rounded-full shadow-lg z-10">
                                Top Pick
                              </div>
                              <div className="flex items-center gap-3 mb-3">
                                <div className="w-10 h-10 bg-indigo-50 rounded-xl flex items-center justify-center text-indigo-600 font-bold text-sm">
                                  {candidate.name?.[0]}
                                </div>
                                <div className="min-w-0">
                                  <p className="text-xs font-bold text-gray-900 truncate">{candidate.name}</p>
                                  <p className="text-[10px] text-gray-500 truncate">{candidate.analysis?.jobType}</p>
                                </div>
                              </div>
                              <div className="flex items-center justify-between">
                                <span className="text-[10px] font-bold text-indigo-600 bg-indigo-50 px-2 py-1 rounded-lg">
                                  {candidate.analysis?.match_score}% Match
                                </span>
                                <button
                                  onClick={() => toggleCompareSelection(candidate.id)}
                                  className={`p-2 rounded-xl transition-all ${
                                    selectedForCompare.has(candidate.id) 
                                      ? 'bg-indigo-600 text-white shadow-md' 
                                      : 'bg-gray-50 text-gray-400 hover:bg-gray-100'
                                  }`}
                                >
                                  {selectedForCompare.has(candidate.id) ? <CheckSquare className="w-4 h-4" /> : <Square className="w-4 h-4" />}
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {historyTab === 'seeker' ? (
                <div className="p-8 space-y-6">
                  {loadingInterviews ? (
                    <div className="flex justify-center py-20">
                      <div className="w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
                    </div>
                  ) : paginatedInterviews.length === 0 ? (
                    <div className="text-center py-20 bg-gray-50 rounded-[2rem] border border-dashed border-gray-200">
                      <MessageSquare className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                      <p className="text-gray-500 font-medium">No history found yet.</p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 gap-4">
                      {paginatedInterviews.map((item) => (
                        <div key={item.id} className="p-6 bg-gray-50 rounded-3xl border border-gray-100 hover:border-indigo-200 transition-all group">
                          <div className="flex justify-between items-start">
                            <div className="flex items-start gap-4">
                              <div className="w-12 h-12 bg-white rounded-2xl flex items-center justify-center shadow-sm text-xl">
                                {item.type === 'analysis' ? '📄' : '💬'}
                              </div>
                              <div>
                                <h4 className="font-bold text-gray-900">{item.type === 'analysis' ? 'Resume Analysis' : 'Interview Prep'}</h4>
                                <p className="text-sm text-gray-500 mt-1">
                                  {item.type === 'analysis' ? item.resumeName : `${item.company} • ${item.role}`}
                                </p>
                                <div className="flex items-center gap-3 mt-3">
                                  <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">
                                    {new Date(item.createdAt).toLocaleDateString()}
                                  </span>
                                  {item.result?.match_score && (
                                    <span className="text-[10px] font-bold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-full">
                                      Score: {item.result.match_score}%
                                    </span>
                                  )}
                                </div>
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              {item.result && (
                                <button
                                  onClick={() => handleDownloadResume(item.result, profile?.fullName || 'User')}
                                  className="p-2 bg-white rounded-xl shadow-sm opacity-0 group-hover:opacity-100 transition-all hover:text-indigo-600 hover:shadow-md"
                                  title="Download Optimized Resume"
                                >
                                  <Download className="w-4 h-4" />
                                </button>
                              )}
                              <button className="p-2 bg-white rounded-xl shadow-sm opacity-0 group-hover:opacity-100 transition-all hover:text-indigo-600 hover:shadow-md">
                                <ArrowRight className="w-4 h-4" />
                              </button>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ) : (
                <div className="p-8 space-y-6">
                  {loadingScans ? (
                    <div className="flex justify-center py-20">
                      <div className="w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
                    </div>
                  ) : paginatedScans.length === 0 ? (
                    <div className="text-center py-20 bg-gray-50 rounded-[2rem] border border-dashed border-gray-200">
                      <FileText className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                      <p className="text-gray-500 font-medium">No scans found matching your search.</p>
                    </div>
                  ) : (
                    <div className="overflow-x-auto -mx-8">
                      <table className="w-full text-left border-collapse">
                        <thead>
                          <tr className="bg-gray-50/50 border-b border-gray-100">
                            <th className="p-5 pl-8 text-[10px] font-bold text-gray-400 uppercase tracking-widest">Candidate</th>
                            <th className="p-5 text-[10px] font-bold text-gray-400 uppercase tracking-widest">Category</th>
                            <th className="p-5 text-[10px] font-bold text-gray-400 uppercase tracking-widest">Score</th>
                            <th className="p-5 text-[10px] font-bold text-gray-400 uppercase tracking-widest">Exp</th>
                            <th className="p-5 text-[10px] font-bold text-gray-400 uppercase tracking-widest text-right pr-8">Action</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-50">
                          {paginatedScans.map((c) => (
                            <tr key={c.id} className="hover:bg-gray-50/50 transition-colors group">
                              <td className="p-5 pl-8">
                                <div className="flex items-center gap-3">
                                  <div className="w-10 h-10 bg-white rounded-xl shadow-sm flex items-center justify-center text-lg">
                                    📄
                                  </div>
                                  <div>
                                    <div className="font-bold text-gray-900">{c.name}</div>
                                    <div className="text-[10px] text-gray-400 font-medium uppercase tracking-wider">
                                      {new Date(c.createdAt || '').toLocaleDateString()}
                                    </div>
                                  </div>
                                </div>
                              </td>
                              <td className="p-5">
                                {c.analysis?.category ? (
                                  <span className="px-2 py-1 bg-indigo-50 text-indigo-600 text-[10px] font-bold rounded-lg uppercase tracking-wider">
                                    {c.analysis.category}
                                  </span>
                                ) : (
                                  <span className="text-xs text-gray-400">Uncategorized</span>
                                )}
                              </td>
                              <td className="p-5">
                                <div className="flex items-center gap-2">
                                  <div className="w-12 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                                    <div className="h-full bg-indigo-600" style={{ width: `${c.analysis?.match_score || 0}%` }}></div>
                                  </div>
                                  <span className="text-sm font-bold text-gray-900">{c.analysis?.match_score || 0}%</span>
                                </div>
                              </td>
                              <td className="p-5">
                                <span className="text-sm font-bold text-gray-900">{c.analysis?.years_experience || 0}y</span>
                              </td>
                              <td className="p-5 text-right pr-8">
                                <div className="flex items-center justify-end gap-2">
                                  <button
                                    onClick={() => toggleCompareSelection(c.id)}
                                    className={`p-2 rounded-xl transition-all ${
                                      selectedForCompare.has(c.id) 
                                        ? 'bg-indigo-600 text-white shadow-md' 
                                        : 'text-gray-400 hover:text-indigo-600 hover:bg-indigo-50'
                                    }`}
                                  >
                                    {selectedForCompare.has(c.id) ? <CheckSquare className="w-4 h-4" /> : <Square className="w-4 h-4" />}
                                  </button>
                                  <button 
                                    onClick={() => deleteCandidate(c.id)}
                                    className="p-2 text-gray-400 hover:text-red-500 transition-colors"
                                  >
                                    <Trash2 className="w-4 h-4" />
                                  </button>
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Pagination Controls */}
            {totalPages > 1 && (
              <div className="p-8 bg-gray-50 border-t border-gray-100 flex items-center justify-between">
                <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">
                  Page {currentPage} of {totalPages}
                </p>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                    disabled={currentPage === 1}
                    className="p-2 bg-white border border-gray-200 rounded-xl text-gray-600 hover:bg-gray-50 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <ChevronLeft className="w-5 h-5" />
                  </button>
                  <button
                    onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                    disabled={currentPage === totalPages}
                    className="p-2 bg-white border border-gray-200 rounded-xl text-gray-600 hover:bg-gray-50 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <ChevronRight className="w-5 h-5" />
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
