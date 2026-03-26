
import React, { useState, useEffect, useMemo } from 'react';
import { motion } from 'framer-motion';
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
  X
} from 'lucide-react';
import { auth } from '../src/firebase';
import { updatePassword, sendEmailVerification, signOut, User as FirebaseUser } from 'firebase/auth';
import { UserProfile } from '../src/hooks/useFirebase';
import { useInterviewData } from '../src/hooks/useInterviewData';
import { useRecruiterData } from '../src/hooks/useRecruiterData';
import { Candidate } from '../types';

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
  
  const { history: interviewHistory, loading: loadingInterviews } = useInterviewData(user);
  const { candidates: scanHistory, loading: loadingScans, deleteCandidate } = useRecruiterData(user);

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
    if (!searchTerm.trim()) return scanHistory;
    const term = searchTerm.toLowerCase();
    return scanHistory.filter(c => {
      const name = c.name?.toLowerCase() || '';
      const email = c.analysis?.email?.toLowerCase() || '';
      const phone = c.analysis?.phone?.toLowerCase() || '';
      const jobType = c.analysis?.jobType?.toLowerCase() || '';
      const exp = c.analysis?.years_experience?.toString() || '';
      const skills = c.analysis?.strengths?.join(' ').toLowerCase() || '';
      
      return name.includes(term) || 
             email.includes(term) || 
             phone.includes(term) || 
             jobType.includes(term) || 
             exp.includes(term) || 
             skills.includes(term);
    });
  }, [scanHistory, searchTerm]);

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
                  onClick={() => setHistoryTab('seeker')}
                  className={`px-4 py-2 rounded-lg text-xs font-bold transition-all ${historyTab === 'seeker' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                >
                  Job Seeker
                </button>
                <button 
                  onClick={() => setHistoryTab('recruiter')}
                  className={`px-4 py-2 rounded-lg text-xs font-bold transition-all ${historyTab === 'recruiter' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                >
                  Recruiter
                </button>
              </div>
            </div>

            <div className="flex-1 p-8">
              {historyTab === 'seeker' ? (
                <div className="space-y-6">
                  <h3 className="text-xs font-bold uppercase tracking-[0.2em] text-gray-400">Recent Analyses & Interviews</h3>
                  {loadingInterviews ? (
                    <div className="flex justify-center py-20">
                      <div className="w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
                    </div>
                  ) : interviewHistory.length === 0 ? (
                    <div className="text-center py-20 bg-gray-50 rounded-[2rem] border border-dashed border-gray-200">
                      <MessageSquare className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                      <p className="text-gray-500 font-medium">No history found yet.</p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 gap-4">
                      {interviewHistory.map((item) => (
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
                            <button className="p-2 bg-white rounded-xl shadow-sm opacity-0 group-hover:opacity-100 transition-all hover:text-indigo-600">
                              <ArrowRight className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ) : (
                <div className="space-y-6 h-full flex flex-col">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <h3 className="text-xs font-bold uppercase tracking-[0.2em] text-gray-400">Candidate Scans</h3>
                    <div className="relative w-full sm:w-64">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                      <input 
                        type="text" 
                        placeholder="Search scans..." 
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full pl-10 pr-4 py-2 bg-gray-50 border border-gray-100 rounded-xl text-sm outline-none focus:ring-2 focus:ring-indigo-500/20"
                      />
                    </div>
                  </div>

                  {loadingScans ? (
                    <div className="flex justify-center py-20">
                      <div className="w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
                    </div>
                  ) : filteredScans.length === 0 ? (
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
                            <th className="p-5 text-[10px] font-bold text-gray-400 uppercase tracking-widest">Score</th>
                            <th className="p-5 text-[10px] font-bold text-gray-400 uppercase tracking-widest">Potential</th>
                            <th className="p-5 text-[10px] font-bold text-gray-400 uppercase tracking-widest">Exp</th>
                            <th className="p-5 text-[10px] font-bold text-gray-400 uppercase tracking-widest text-right pr-8">Action</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-50">
                          {filteredScans.map((c) => (
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
                                <div className="flex items-center gap-2">
                                  <div className="w-12 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                                    <div className="h-full bg-indigo-600" style={{ width: `${c.analysis?.match_score || 0}%` }}></div>
                                  </div>
                                  <span className="text-sm font-bold text-gray-900">{c.analysis?.match_score || 0}%</span>
                                </div>
                              </td>
                              <td className="p-5">
                                <span className="text-sm font-bold text-gray-900">{c.analysis?.potential_score || 0}%</span>
                              </td>
                              <td className="p-5">
                                <span className="text-sm font-bold text-gray-900">{c.analysis?.years_experience || 0}y</span>
                              </td>
                              <td className="p-5 text-right pr-8">
                                <button 
                                  onClick={() => deleteCandidate(c.id)}
                                  className="p-2 text-gray-400 hover:text-red-500 transition-colors"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
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
          </div>
        </div>
      </div>
    </div>
  );
};
