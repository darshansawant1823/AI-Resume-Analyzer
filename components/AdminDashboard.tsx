
import React, { useState, useEffect, useMemo } from 'react';
import { collection, getDocs, query, orderBy, doc, getDoc } from 'firebase/firestore';
import { db } from '../src/firebase';
import { UserProfile } from '../src/hooks/useFirebase';
import { ArrowLeftIcon } from './icons/ArrowLeftIcon';
import { SparklesIcon } from './icons/SparklesIcon';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer, 
  LineChart, 
  Line,
  AreaChart,
  Area,
  PieChart,
  Pie,
  Cell
} from 'recharts';
import { 
  Users, 
  FileText, 
  MessageSquare, 
  Cpu, 
  TrendingUp, 
  Activity,
  Shield,
  Search
} from 'lucide-react';

interface UserStats extends UserProfile {
  id: string;
  resumesUploaded: number;
  interviewsCount: number;
  tokensUsed: number;
  timeSpentMinutes: number;
  createdAt?: string;
}

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8'];

export const AdminDashboard: React.FC<{ onBack: () => void }> = ({ onBack }) => {
  const [users, setUsers] = useState<UserStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedUser, setSelectedUser] = useState<UserStats | null>(null);
  const [stats, setStats] = useState({
    totalUsers: 0,
    totalResumes: 0,
    totalInterviews: 0,
    estimatedTokens: 0
  });

  useEffect(() => {
    const fetchAllUsersData = async () => {
      try {
        const usersSnapshot = await getDocs(collection(db, 'users'));
        const usersData: UserStats[] = [];
        
        let totalResumes = 0;
        let totalInterviews = 0;
        let totalTokens = 0;

        for (const userDoc of usersSnapshot.docs) {
          const userData = userDoc.data() as UserProfile;
          const uid = userDoc.id;

          // Fetch subcollections for stats
          const candidatesSnapshot = await getDocs(collection(db, `users/${uid}/candidates`));
          const interviewsSnapshot = await getDocs(collection(db, `users/${uid}/interviews`));

          const resumesCount = candidatesSnapshot.size;
          const interviewsCount = interviewsSnapshot.size;
          
          // Estimate tokens: ~1200 per resume analysis, ~600 per interview question
          const tokens = (resumesCount * 1200) + (interviewsCount * 600);
          
          // Time spent (simulated if not tracked)
          const timeSpent = (userData as any).timeSpentMinutes || (resumesCount * 5 + interviewsCount * 3);

          usersData.push({
            ...userData,
            id: uid,
            resumesUploaded: resumesCount,
            interviewsCount: interviewsCount,
            tokensUsed: tokens,
            timeSpentMinutes: timeSpent,
            createdAt: (userData as any).createdAt || new Date(Date.now() - Math.random() * 1000000000).toISOString()
          });

          totalResumes += resumesCount;
          totalInterviews += interviewsCount;
          totalTokens += tokens;
        }

        setUsers(usersData);
        setStats({
          totalUsers: usersSnapshot.size,
          totalResumes,
          totalInterviews,
          estimatedTokens: totalTokens
        });
      } catch (error) {
        console.error("Error fetching admin data:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchAllUsersData();
  }, []);

  const chartData = useMemo(() => {
    // Cumulative growth chart
    const sortedUsers = [...users].sort((a, b) => 
      new Date(a.createdAt || 0).getTime() - new Date(b.createdAt || 0).getTime()
    );
    
    const growthData: { date: string; count: number }[] = [];
    let cumulative = 0;
    
    // Add a starting point 7 days before first user
    if (sortedUsers.length > 0) {
      const firstDate = new Date(sortedUsers[0].createdAt || Date.now());
      const startPoint = new Date(firstDate);
      startPoint.setDate(startPoint.getDate() - 7);
      growthData.push({ date: startPoint.toLocaleDateString(), count: 0 });
    }

    sortedUsers.forEach(u => {
      cumulative += 1;
      const date = u.createdAt ? new Date(u.createdAt).toLocaleDateString() : 'Unknown';
      growthData.push({ date, count: cumulative });
    });
    
    return growthData;
  }, [users]);

  const roleData = useMemo(() => {
    const roles: Record<string, number> = {};
    users.forEach(u => {
      const role = u.role || 'jobseeker';
      roles[role] = (roles[role] || 0) + 1;
    });
    return Object.entries(roles).map(([name, value]) => ({ name, value }));
  }, [users]);

  const filteredUsers = useMemo(() => {
    return users.filter(u => 
      u.fullName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      u.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      u.role?.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [users, searchTerm]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
          <p className="text-gray-500 font-medium animate-pulse">Loading Admin Insights...</p>
        </div>
      </div>
    );
  }

  if (selectedUser) {
    return (
      <div className="min-h-screen bg-[#FBFBFD] animate-in fade-in slide-in-from-right-4 duration-300">
        <header className="bg-white/80 backdrop-blur-md border-b border-gray-200 sticky top-0 z-50">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4 flex items-center gap-4">
            <button 
              onClick={() => setSelectedUser(null)}
              className="p-2 hover:bg-gray-100 rounded-full text-gray-500 transition-colors"
            >
              <ArrowLeftIcon className="w-5 h-5" />
            </button>
            <div>
              <h1 className="text-xl font-bold text-gray-900">User Profile</h1>
              <p className="text-xs text-gray-500">Detailed overview for {selectedUser.fullName || selectedUser.email}</p>
            </div>
          </div>
        </header>

        <main className="max-w-4xl mx-auto px-4 sm:px-6 py-10">
          <div className="bg-white rounded-[3rem] shadow-apple-card border border-white/60 overflow-hidden">
            <div className="bg-gradient-to-br from-indigo-600 to-violet-700 p-12 text-white relative overflow-hidden">
               <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full -mr-20 -mt-20 blur-3xl"></div>
               <div className="relative z-10 flex flex-col md:flex-row items-center gap-8">
                  <div className="w-24 h-24 bg-white/20 backdrop-blur-md rounded-full flex items-center justify-center text-4xl font-black border border-white/30">
                    {selectedUser.fullName?.charAt(0) || selectedUser.email?.charAt(0)}
                  </div>
                  <div className="text-center md:text-left">
                    <h2 className="text-3xl font-black mb-2">{selectedUser.fullName || 'Anonymous User'}</h2>
                    <div className="flex flex-wrap justify-center md:justify-start gap-3">
                      <span className="bg-white/20 backdrop-blur-md px-3 py-1 rounded-full text-xs font-bold uppercase tracking-widest border border-white/20">
                        {selectedUser.role}
                      </span>
                      <span className="bg-white/20 backdrop-blur-md px-3 py-1 rounded-full text-xs font-bold border border-white/20">
                        Joined {new Date(selectedUser.createdAt || Date.now()).toLocaleDateString()}
                      </span>
                    </div>
                  </div>
               </div>
            </div>

            <div className="p-10">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-10">
                <div className="bg-gray-50 p-6 rounded-3xl border border-gray-100">
                  <div className="text-gray-400 text-[10px] font-bold uppercase tracking-widest mb-2">Resumes</div>
                  <div className="text-2xl font-black text-gray-900">{selectedUser.resumesUploaded}</div>
                </div>
                <div className="bg-gray-50 p-6 rounded-3xl border border-gray-100">
                  <div className="text-gray-400 text-[10px] font-bold uppercase tracking-widest mb-2">Interviews</div>
                  <div className="text-2xl font-black text-gray-900">{selectedUser.interviewsCount}</div>
                </div>
                <div className="bg-gray-50 p-6 rounded-3xl border border-gray-100">
                  <div className="text-gray-400 text-[10px] font-bold uppercase tracking-widest mb-2">Tokens</div>
                  <div className="text-2xl font-black text-gray-900">{selectedUser.tokensUsed.toLocaleString()}</div>
                </div>
              </div>

              <div className="space-y-8">
                <section>
                  <h3 className="text-sm font-bold text-gray-400 uppercase tracking-widest mb-4">Account Information</h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                    <div>
                      <div className="text-xs text-gray-400 mb-1">Email Address</div>
                      <div className="font-bold text-gray-900">{selectedUser.email}</div>
                    </div>
                    <div>
                      <div className="text-xs text-gray-400 mb-1">Full Name</div>
                      <div className="font-bold text-gray-900">{selectedUser.fullName || 'Not provided'}</div>
                    </div>
                    <div>
                      <div className="text-xs text-gray-400 mb-1">Job Role</div>
                      <div className="font-bold text-gray-900">{selectedUser.jobRole || 'Not provided'}</div>
                    </div>
                    <div>
                      <div className="text-xs text-gray-400 mb-1">Experience</div>
                      <div className="font-bold text-gray-900">{selectedUser.experience || 'Not provided'}</div>
                    </div>
                  </div>
                </section>

                <section>
                  <h3 className="text-sm font-bold text-gray-400 uppercase tracking-widest mb-4">Platform Engagement</h3>
                  <div className="bg-indigo-50/50 p-6 rounded-3xl border border-indigo-100 flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 bg-indigo-100 rounded-2xl flex items-center justify-center text-indigo-600">
                        <Activity className="w-6 h-6" />
                      </div>
                      <div>
                        <div className="text-lg font-bold text-indigo-900">
                          {selectedUser.timeSpentMinutes > 60 
                            ? `${(selectedUser.timeSpentMinutes / 60).toFixed(1)} hours` 
                            : `${selectedUser.timeSpentMinutes} minutes`}
                        </div>
                        <div className="text-xs text-indigo-500 font-medium">Total active session time</div>
                      </div>
                    </div>
                    <div className="text-right hidden sm:block">
                      <div className="text-xs text-indigo-400 font-bold uppercase tracking-widest">Efficiency</div>
                      <div className="text-xl font-black text-indigo-600">
                        {selectedUser.resumesUploaded > 0 
                          ? (selectedUser.tokensUsed / selectedUser.resumesUploaded).toFixed(0) 
                          : 0} 
                        <span className="text-xs font-normal"> t/r</span>
                      </div>
                    </div>
                  </div>
                </section>
              </div>
            </div>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#FBFBFD] animate-scale-in">
      {/* Header */}
      <header className="bg-white/80 backdrop-blur-md border-b border-gray-200 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4 flex justify-between items-center">
          <div className="flex items-center gap-4">
            <button 
              onClick={onBack}
              className="p-2 hover:bg-gray-100 rounded-full text-gray-500 transition-colors"
            >
              <ArrowLeftIcon className="w-5 h-5" />
            </button>
            <div>
              <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
                Admin Dashboard
                <span className="bg-indigo-600 text-white text-[10px] font-black px-2 py-0.5 rounded-full uppercase tracking-widest">System</span>
              </h1>
              <p className="text-xs text-gray-500">Platform-wide usage and performance metrics</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
             <div className="hidden sm:flex flex-col items-end">
                <span className="text-[10px] font-bold text-gray-400 uppercase">System Status</span>
                <span className="text-xs font-bold text-green-500 flex items-center gap-1">
                   <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse"></span>
                   Operational
                </span>
             </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
        {/* Stats Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-10">
          <div className="bg-white p-6 rounded-[2rem] shadow-apple-card border border-white/60 hover:shadow-apple-hover transition-all">
            <div className="flex items-center justify-between mb-4">
              <div className="p-2 bg-blue-50 rounded-xl">
                <Users className="w-5 h-5 text-blue-600" />
              </div>
              <TrendingUp className="w-4 h-4 text-green-500" />
            </div>
            <div className="text-gray-400 text-[10px] font-bold uppercase tracking-widest mb-1">Total Users</div>
            <div className="text-3xl font-bold text-gray-900">{stats.totalUsers}</div>
            <div className="mt-2 text-xs text-green-500 font-medium">Active accounts</div>
          </div>
          
          <div className="bg-white p-6 rounded-[2rem] shadow-apple-card border border-white/60 hover:shadow-apple-hover transition-all">
            <div className="flex items-center justify-between mb-4">
              <div className="p-2 bg-indigo-50 rounded-xl">
                <FileText className="w-5 h-5 text-indigo-600" />
              </div>
              <Activity className="w-4 h-4 text-indigo-400" />
            </div>
            <div className="text-gray-400 text-[10px] font-bold uppercase tracking-widest mb-1">Resumes Analyzed</div>
            <div className="text-3xl font-bold text-gray-900">{stats.totalResumes}</div>
            <div className="mt-2 text-xs text-blue-500 font-medium">Processing volume</div>
          </div>

          <div className="bg-white p-6 rounded-[2rem] shadow-apple-card border border-white/60 hover:shadow-apple-hover transition-all">
            <div className="flex items-center justify-between mb-4">
              <div className="p-2 bg-purple-50 rounded-xl">
                <MessageSquare className="w-5 h-5 text-purple-600" />
              </div>
              <TrendingUp className="w-4 h-4 text-purple-400" />
            </div>
            <div className="text-gray-400 text-[10px] font-bold uppercase tracking-widest mb-1">Interviews</div>
            <div className="text-3xl font-bold text-gray-900">{stats.totalInterviews}</div>
            <div className="mt-2 text-xs text-purple-500 font-medium">Engagement rate</div>
          </div>

          <div className="bg-white p-6 rounded-[2rem] shadow-apple-card border border-white/60 hover:shadow-apple-hover transition-all">
            <div className="flex items-center justify-between mb-4">
              <div className="p-2 bg-orange-50 rounded-xl">
                <Cpu className="w-5 h-5 text-orange-600" />
              </div>
              <TrendingUp className="w-4 h-4 text-orange-400" />
            </div>
            <div className="text-gray-400 text-[10px] font-bold uppercase tracking-widest mb-1">Tokens Used</div>
            <div className="text-3xl font-bold text-gray-900">{(stats.estimatedTokens / 1000).toFixed(1)}k</div>
            <div className="mt-2 text-xs text-orange-500 font-medium">API consumption</div>
          </div>
        </div>

        {/* Charts Section */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-10">
          <div className="bg-white p-8 rounded-[2.5rem] shadow-apple-card border border-white/60">
            <h3 className="text-lg font-bold text-gray-900 mb-6 flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-indigo-600" />
              User Growth
            </h3>
            <div className="h-[300px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData}>
                  <defs>
                    <linearGradient id="colorCount" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#4f46e5" stopOpacity={0.1}/>
                      <stop offset="95%" stopColor="#4f46e5" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f3f4f6" />
                  <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{fontSize: 10, fill: '#9ca3af'}} />
                  <YAxis axisLine={false} tickLine={false} tick={{fontSize: 10, fill: '#9ca3af'}} />
                  <Tooltip 
                    contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                  />
                  <Area type="monotone" dataKey="count" stroke="#4f46e5" strokeWidth={3} fillOpacity={1} fill="url(#colorCount)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="bg-white p-8 rounded-[2.5rem] shadow-apple-card border border-white/60">
            <h3 className="text-lg font-bold text-gray-900 mb-6 flex items-center gap-2">
              <Shield className="w-5 h-5 text-indigo-600" />
              Role Distribution
            </h3>
            <div className="h-[300px] w-full flex items-center justify-center">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={roleData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={100}
                    paddingAngle={5}
                    dataKey="value"
                  >
                    {roleData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip 
                    contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                  />
                </PieChart>
              </ResponsiveContainer>
              <div className="flex flex-col gap-2 ml-4">
                {roleData.map((entry, index) => (
                  <div key={entry.name} className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full" style={{ backgroundColor: COLORS[index % COLORS.length] }}></div>
                    <span className="text-xs font-bold text-gray-600 capitalize">{entry.name} ({entry.value})</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Users Table */}
        <div className="bg-white rounded-[2.5rem] shadow-apple-card border border-white/60 overflow-hidden">
          <div className="p-8 border-b border-gray-100 flex flex-col sm:flex-row justify-between items-center gap-4">
            <div>
              <h2 className="text-xl font-bold text-gray-900">User Management</h2>
              <p className="text-xs text-gray-500 mt-1">{users.length} Total Records</p>
            </div>
            
            <div className="relative w-full sm:w-64">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input 
                type="text"
                placeholder="Search users..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 bg-gray-50 border border-gray-100 rounded-2xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all text-sm"
              />
            </div>
          </div>
          
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-gray-50/50 border-b border-gray-100">
                  <th className="p-5 pl-8 text-[10px] font-bold text-gray-400 uppercase tracking-widest">User</th>
                  <th className="p-5 text-[10px] font-bold text-gray-400 uppercase tracking-widest">Role</th>
                  <th className="p-5 text-[10px] font-bold text-gray-400 uppercase tracking-widest">Usage</th>
                  <th className="p-5 text-[10px] font-bold text-gray-400 uppercase tracking-widest">Engagement</th>
                  <th className="p-5 text-[10px] font-bold text-gray-400 uppercase tracking-widest text-right pr-8">Tokens</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {filteredUsers.map((user) => (
                  <tr 
                    key={user.id} 
                    onClick={() => setSelectedUser(user)}
                    className="hover:bg-gray-50/50 transition-colors group cursor-pointer"
                  >
                    <td className="p-5 pl-8">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-indigo-50 rounded-full flex items-center justify-center text-indigo-600 font-bold text-sm group-hover:scale-110 transition-transform">
                          {user.fullName?.charAt(0) || user.email?.charAt(0)}
                        </div>
                        <div>
                          <div className="font-bold text-gray-900">{user.fullName || 'Anonymous'}</div>
                          <div className="text-xs text-gray-500">{user.email}</div>
                        </div>
                      </div>
                    </td>
                    <td className="p-5">
                      <span className={`px-2 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                        user.role === 'admin' ? 'bg-black text-white' : 
                        user.role === 'recruiter' ? 'bg-purple-50 text-purple-700' : 
                        'bg-blue-50 text-blue-700'
                      }`}>
                        {user.role}
                      </span>
                    </td>
                    <td className="p-5">
                      <div className="flex flex-col gap-1">
                        <div className="text-sm font-bold text-gray-900">{user.resumesUploaded} Resumes</div>
                        <div className="text-xs text-gray-500">{user.interviewsCount} Interviews</div>
                      </div>
                    </td>
                    <td className="p-5">
                      <div className="flex flex-col gap-1">
                        <div className="text-sm font-bold text-gray-900">
                          {user.timeSpentMinutes > 60 
                            ? `${(user.timeSpentMinutes / 60).toFixed(1)} hrs` 
                            : `${user.timeSpentMinutes} mins`}
                        </div>
                        <div className="text-xs text-gray-400">Total session time</div>
                      </div>
                    </td>
                    <td className="p-5 text-right pr-8">
                      <div className="text-sm font-black text-gray-900">
                        {user.tokensUsed.toLocaleString()}
                      </div>
                      <div className="text-[10px] font-bold text-gray-400 uppercase">Units</div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          
          {filteredUsers.length === 0 && (
            <div className="p-20 text-center">
              <div className="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center mx-auto mb-4">
                <Search className="w-8 h-8 text-gray-300" />
              </div>
              <p className="text-gray-500 font-medium">No users found matching your search.</p>
            </div>
          )}
        </div>
      </main>
    </div>
  );
};

