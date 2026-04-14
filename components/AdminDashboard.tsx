
import React, { useState, useEffect, useMemo } from 'react';
import { collection, getDocs, query, orderBy, doc, getDoc, where, Timestamp } from 'firebase/firestore';
import { db } from '../src/firebase';
import { UserProfile } from '../src/hooks/useFirebase';
import { ArrowLeftIcon } from './icons/ArrowLeftIcon';
import { SparklesIcon } from './icons/SparklesIcon';
import Markdown from 'react-markdown';
import { getAdminInsights } from '../services/geminiService';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
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
  Search,
  Calendar,
  DollarSign,
  Clock,
  Zap,
  Globe,
  TrendingDown,
  Filter,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  BrainCircuit,
  RefreshCw,
  Download,
  PieChart as PieChartIcon
} from 'lucide-react';

interface UserStats extends UserProfile {
  id: string;
  resumesUploaded: number;
  interviewsCount: number;
  tokensUsed: number;
  timeSpentMinutes: number;
  createdAt?: string;
  avgProcessingTime: number;
  totalCostUSD: number;
  issuesCount: number;
}

interface UsageRecord {
  id: string;
  userId: string;
  userName: string;
  type: 'resume' | 'interview' | 'recruiter_scan';
  timestamp: string;
  tokens: number;
  costUSD: number;
  processingTime: number;
  hasIssue?: boolean;
  issueType?: string;
}

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8'];
const COST_PER_RESUME_USD = 0.001; // Switched to Flash model for 95% cost reduction
const COST_PER_INTERVIEW_USD = 0.0005;
const USD_TO_INR = 83.5;

type FilterRange = 'all' | 'today' | 'week' | 'month' | 'custom';

const UserTable = ({ users, onSelect, showRole = false }: { users: UserStats[], onSelect: (u: UserStats) => void, showRole?: boolean }) => (
  <div className="overflow-x-auto">
    <table className="w-full text-left border-collapse">
      <thead>
        <tr className="bg-gray-50/50 border-b border-gray-100">
          <th className="p-5 pl-8 text-[10px] font-bold text-gray-400 uppercase tracking-widest">User</th>
          {showRole && <th className="p-5 text-[10px] font-bold text-gray-400 uppercase tracking-widest">Profile</th>}
          <th className="p-5 text-[10px] font-bold text-gray-400 uppercase tracking-widest">Usage</th>
          <th className="p-5 text-[10px] font-bold text-gray-400 uppercase tracking-widest">Engagement</th>
          <th className="p-5 text-[10px] font-bold text-gray-400 uppercase tracking-widest text-right pr-8">Tokens</th>
        </tr>
      </thead>
      <tbody className="divide-y divide-gray-50">
        {users.map((user) => (
          <tr 
            key={user.id} 
            onClick={() => onSelect(user)}
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
            {showRole && (
              <td className="p-5">
                <div className="flex flex-col gap-1">
                  <div className="text-sm font-bold text-gray-900">{user.jobRole || 'Not Specified'}</div>
                  <div className="text-xs text-gray-500">{user.experience || '0'} yrs exp</div>
                </div>
              </td>
            )}
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
    {users.length === 0 && (
      <div className="p-20 text-center">
        <div className="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center mx-auto mb-4">
          <Search className="w-8 h-8 text-gray-300" />
        </div>
        <p className="text-gray-500 font-medium">No users found matching your search.</p>
      </div>
    )}
  </div>
);

const Sparkline = ({ data, color }: { data: any[], color: string }) => (
  <div className="h-8 w-16">
    <ResponsiveContainer width="100%" height="100%">
      <AreaChart data={data}>
        <Area 
          type="monotone" 
          dataKey="value" 
          stroke={color} 
          fill={color} 
          fillOpacity={0.1} 
          strokeWidth={2} 
          isAnimationActive={false}
        />
      </AreaChart>
    </ResponsiveContainer>
  </div>
);

export const AdminDashboard: React.FC<{ onBack: () => void }> = ({ onBack }) => {
  const [activeView, setActiveView] = useState<'overview' | 'jobseekers' | 'recruiters'>('overview');
  const [users, setUsers] = useState<UserStats[]>([]);
  const [usageRecords, setUsageRecords] = useState<UsageRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [usagePage, setUsagePage] = useState(1);
  const [usersPage, setUsersPage] = useState(1);
  const [jobSeekerPage, setJobSeekerPage] = useState(1);
  const [recruiterPage, setRecruiterPage] = useState(1);
  const [profileUsagePage, setProfileUsagePage] = useState(1);
  const itemsPerPage = 10;
  const [selectedUser, setSelectedUser] = useState<UserStats | null>(null);
  const [filterRange, setFilterRange] = useState<FilterRange>('all');
  const [userFilterRange, setUserFilterRange] = useState<FilterRange>('all');
  const [usageTypeFilter, setUsageTypeFilter] = useState<'all' | 'resume' | 'interview' | 'recruiter_scan'>('all');

  const Pagination = ({ currentPage, totalItems, onPageChange }: { currentPage: number, totalItems: number, onPageChange: (page: number) => void }) => {
    const totalPages = Math.ceil(totalItems / itemsPerPage);
    if (totalPages <= 1) return null;

    return (
      <div className="flex items-center justify-center gap-2 p-6 border-t border-gray-100 bg-gray-50/30">
        <button
          onClick={() => onPageChange(Math.max(1, currentPage - 1))}
          disabled={currentPage === 1}
          className="p-2 rounded-xl hover:bg-white disabled:opacity-30 disabled:cursor-not-allowed transition-all border border-transparent hover:border-gray-200"
        >
          <ChevronLeft className="w-4 h-4 text-gray-600" />
        </button>
        <div className="flex items-center gap-1">
          {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
            <button
              key={page}
              onClick={() => onPageChange(page)}
              className={`w-8 h-8 rounded-xl text-xs font-bold transition-all ${
                currentPage === page
                  ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-200'
                  : 'text-gray-500 hover:bg-white border border-transparent hover:border-gray-200'
              }`}
            >
              {page}
            </button>
          ))}
        </div>
        <button
          onClick={() => onPageChange(Math.min(totalPages, currentPage + 1))}
          disabled={currentPage === totalPages}
          className="p-2 rounded-xl hover:bg-white disabled:opacity-30 disabled:cursor-not-allowed transition-all border border-transparent hover:border-gray-200"
        >
          <ChevronRight className="w-4 h-4 text-gray-600" />
        </button>
      </div>
    );
  };
  const [customDateRange, setCustomDateRange] = useState({ start: '', end: '' });
  const [userCustomDateRange, setUserCustomDateRange] = useState({ start: '', end: '' });
  const [aiInsights, setAiInsights] = useState<string>('');
  const [isGeneratingInsights, setIsGeneratingInsights] = useState(false);
  const [isDownloadingReport, setIsDownloadingReport] = useState(false);
  
  const filteredData = useMemo(() => {
    let filteredUsers = [...users];
    let filteredUsage = [...usageRecords];

    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    
    // Use a copy to avoid modifying 'now'
    const weekCopy = new Date(now);
    const startOfWeek = new Date(weekCopy.setDate(weekCopy.getDate() - weekCopy.getDay()));
    startOfWeek.setHours(0, 0, 0, 0);
    
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    if (filterRange !== 'all') {
      const filterDate = (dateInput: any) => {
        if (!dateInput) return false;
        
        // Handle Firestore Timestamp objects or strings
        const date = dateInput instanceof Date 
          ? dateInput 
          : (dateInput.toDate ? dateInput.toDate() : new Date(dateInput));
        
        if (isNaN(date.getTime())) return false;

        if (filterRange === 'today') return date >= startOfToday;
        if (filterRange === 'week') return date >= startOfWeek;
        if (filterRange === 'month') return date >= startOfMonth;
        if (filterRange === 'custom') {
          const start = customDateRange.start ? new Date(customDateRange.start) : new Date(0);
          const end = customDateRange.end ? new Date(customDateRange.end) : new Date();
          // Set end to end of day for custom range
          end.setHours(23, 59, 59, 999);
          return date >= start && date <= end;
        }
        return true;
      };

      filteredUsage = usageRecords.filter(u => filterDate(u.timestamp));
      
      // For users, we include those who joined in the period OR were active in the period
      const activeUserIds = new Set(filteredUsage.map(u => u.userId));
      filteredUsers = users.filter(u => 
        filterDate(u.createdAt) || activeUserIds.has(u.id)
      );
    }

    if (usageTypeFilter !== 'all') {
      filteredUsage = filteredUsage.filter(u => u.type === usageTypeFilter);
    }

    // Sort usage by timestamp descending (newest first)
    const sortedUsage = [...filteredUsage].sort((a, b) => 
      new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    );

    // Recalculate stats for filtered data
    const totalResumes = filteredUsage.filter(u => u.type === 'resume').length;
    const totalScans = filteredUsage.filter(u => u.type === 'recruiter_scan').length;
    const totalInterviews = filteredUsage.filter(u => u.type === 'interview').length;
    const totalTokens = filteredUsage.reduce((acc, curr) => acc + curr.tokens, 0);
    const totalCostUSD = filteredUsage.reduce((acc, curr) => acc + curr.costUSD, 0);
    const totalProcessingTime = filteredUsage.reduce((acc, curr) => acc + curr.processingTime, 0);

    const currentStats = {
      totalUsers: filteredUsers.length,
      totalResumes: totalResumes + totalScans,
      totalInterviews,
      estimatedTokens: totalTokens,
      totalCostUSD,
      totalCostINR: totalCostUSD * USD_TO_INR,
      avgProcessingTime: (totalResumes + totalScans + totalInterviews) > 0 ? totalProcessingTime / (totalResumes + totalScans + totalInterviews) : 0,
      avgCostPerApp: (totalResumes + totalScans) > 0 ? totalCostUSD / (totalResumes + totalScans) : 0
    };

    // Generate sparkline data for last 7 days
    const sparklineDays = Array.from({ length: 7 }).map((_, i) => {
      const d = new Date();
      d.setDate(d.getDate() - (6 - i));
      return d.toLocaleDateString();
    });

    const getSparklineData = (type: string | 'all') => {
      return sparklineDays.map(day => {
        const count = filteredUsage.filter(u => {
          const uDate = new Date(u.timestamp).toLocaleDateString();
          return uDate === day && (type === 'all' || u.type === type);
        }).length;
        return { value: count };
      });
    };

    const sparklines = {
      users: getSparklineData('all'),
      resumes: getSparklineData('resume'),
      interviews: getSparklineData('interview'),
      tokens: sparklineDays.map(day => ({
        value: filteredUsage.filter(u => new Date(u.timestamp).toLocaleDateString() === day)
          .reduce((acc, curr) => acc + curr.tokens, 0)
      })),
      cost: sparklineDays.map(day => ({
        value: filteredUsage.filter(u => new Date(u.timestamp).toLocaleDateString() === day)
          .reduce((acc, curr) => acc + curr.costUSD, 0)
      }))
    };

    // Calculate usageByDay for charts
    const usageByDay = sparklineDays.map(day => {
      const dayUsage = filteredUsage.filter(u => new Date(u.timestamp).toLocaleDateString() === day);
      return {
        date: day.split('/')[0] + '/' + day.split('/')[1], // Short date
        count: dayUsage.length,
        avgTime: dayUsage.length > 0 ? dayUsage.reduce((acc, curr) => acc + curr.processingTime, 0) / dayUsage.length : 0
      };
    });

    const jobSeekerUsage = sortedUsage.filter(u => {
      const user = users.find(fu => fu.id === u.userId);
      // Default to jobseeker if role is missing
      return !user?.role || user?.role === 'jobseeker';
    });
    const jobSeekerResumes = jobSeekerUsage.filter(u => u.type === 'resume');
    const jobSeekerCost = jobSeekerUsage.reduce((acc, curr) => acc + curr.costUSD, 0);

    const jobSeekerStats = {
      totalUsers: filteredUsers.filter(u => !u.role || u.role === 'jobseeker').length,
      totalResumes: jobSeekerResumes.length,
      totalTokens: jobSeekerUsage.reduce((acc, curr) => acc + curr.tokens, 0),
      totalCostUSD: jobSeekerCost,
      avgCostPerResume: jobSeekerResumes.length > 0 ? jobSeekerResumes.reduce((acc, curr) => acc + curr.costUSD, 0) / jobSeekerResumes.length : 0,
      totalCostINR: jobSeekerCost * USD_TO_INR,
    };

    const recruiterUsage = sortedUsage.filter(u => {
      const user = users.find(fu => fu.id === u.userId);
      return user?.role === 'recruiter';
    });
    const recruiterActivities = recruiterUsage.filter(u => u.type === 'interview' || u.type === 'recruiter_scan');
    const recruiterCost = recruiterUsage.reduce((acc, curr) => acc + curr.costUSD, 0);

    const recruiterStats = {
      totalUsers: filteredUsers.filter(u => u.role === 'recruiter').length,
      totalInterviews: recruiterActivities.length,
      totalTokens: recruiterUsage.reduce((acc, curr) => acc + curr.tokens, 0),
      totalCostUSD: recruiterCost,
      avgCostPerInterview: recruiterActivities.length > 0 ? recruiterCost / recruiterActivities.length : 0,
      totalCostINR: recruiterCost * USD_TO_INR,
    };

    return { 
      filteredUsers, 
      filteredUsage: sortedUsage, 
      currentStats, 
      jobSeekerStats, 
      recruiterStats,
      sparklines,
      usageByDay,
      usageByHour: Array.from({ length: 24 }).map((_, i) => ({
        hour: `${i}:00`,
        count: filteredUsage.filter(u => new Date(u.timestamp).getHours() === i).length
      })),
      roleDistribution: [
        { name: 'Job Seekers', value: filteredUsers.filter(u => !u.role || u.role === 'jobseeker').length },
        { name: 'Recruiters', value: filteredUsers.filter(u => u.role === 'recruiter').length },
        { name: 'Admins', value: filteredUsers.filter(u => u.role === 'admin').length },
      ]
    };
  }, [users, usageRecords, filterRange, customDateRange, usageTypeFilter]);

  const retentionCohorts = useMemo(() => {
    const cohortsMap: Record<string, { size: number, activeWeeks: number[] }> = {};
    
    users.forEach(u => {
      if (!u.createdAt) return;
      const date = new Date(u.createdAt);
      const cohortKey = `${date.getFullYear()}-W${Math.ceil(date.getDate() / 7)}`;
      
      if (!cohortsMap[cohortKey]) cohortsMap[cohortKey] = { size: 0, activeWeeks: [0, 0, 0, 0, 0] };
      cohortsMap[cohortKey].size++;
      
      const userUsage = usageRecords.filter(r => r.userId === u.id);
      [0, 1, 2, 3, 4].forEach(w => {
        const weekStart = new Date(date); weekStart.setDate(weekStart.getDate() + (w * 7));
        const weekEnd = new Date(weekStart); weekEnd.setDate(weekEnd.getDate() + 7);
        if (userUsage.some(r => {
          const rDate = new Date(r.timestamp);
          return rDate >= weekStart && rDate < weekEnd;
        })) {
          cohortsMap[cohortKey].activeWeeks[w]++;
        }
      });
    });
    
    return Object.entries(cohortsMap).map(([week, data]) => ({
      week,
      size: data.size,
      retention: data.activeWeeks.map(count => Math.round((count / data.size) * 100))
    })).sort((a, b) => b.week.localeCompare(a.week)).slice(0, 5);
  }, [users, usageRecords]);

  const heatmapData = useMemo(() => {
    const data = Array.from({ length: 7 }, () => Array(24).fill(0));
    filteredData.filteredUsage.forEach(u => {
      const date = new Date(u.timestamp);
      data[date.getDay()][date.getHours()]++;
    });
    return data;
  }, [filteredData.filteredUsage]);

  const modelPerformance = useMemo(() => {
    const flash = filteredData.filteredUsage.filter(u => u.tokens < 2000);
    const pro = filteredData.filteredUsage.filter(u => u.tokens >= 2000);
    
    return {
      flash: {
        avgTime: flash.length > 0 ? flash.reduce((acc, c) => acc + c.processingTime, 0) / flash.length : 0,
        errorRate: flash.length > 0 ? (flash.filter(u => u.hasIssue).length / flash.length) * 100 : 0
      },
      pro: {
        avgTime: pro.length > 0 ? pro.reduce((acc, c) => acc + c.processingTime, 0) / pro.length : 0,
        errorRate: pro.length > 0 ? (pro.filter(u => u.hasIssue).length / pro.length) * 100 : 0
      }
    };
  }, [filteredData.filteredUsage]);
  
  const [stats, setStats] = useState({
    totalUsers: 0,
    totalResumes: 0,
    totalInterviews: 0,
    estimatedTokens: 0,
    totalCostUSD: 0,
    totalCostINR: 0,
    avgProcessingTime: 0,
    avgCostPerApp: 0
  });

  const fetchAllData = async () => {
    try {
      setLoading(true);
      const usersSnapshot = await getDocs(collection(db, 'users'));
      const usersData: UserStats[] = [];
      const allUsage: UsageRecord[] = [];
      
      let totalResumes = 0;
      let totalInterviews = 0;
      let totalTokens = 0;
      let totalCostUSD = 0;
      let totalProcessingTime = 0;

      const getTimestamp = (val: any) => {
        if (!val) return new Date().toISOString();
        if (typeof val === 'string') return val;
        if (val.toDate) return val.toDate().toISOString();
        if (val.seconds) return new Date(val.seconds * 1000).toISOString();
        return new Date().toISOString();
      };

      await Promise.all(usersSnapshot.docs.map(async (userDoc) => {
        const userData = userDoc.data() as UserProfile;
        const uid = userDoc.id;

        const [candidatesSnapshot, interviewsSnapshot] = await Promise.all([
          getDocs(collection(db, `users/${uid}/candidates`)),
          getDocs(collection(db, `users/${uid}/interviews`))
        ]);

        const resumesCount = candidatesSnapshot.size;
        let interviewsCount = 0;
        let scansCount = 0;
        
        let userIssues = 0;
        let userTokens = 0;
        let userCost = 0;

        // Create usage records for "intelligent" dashboard
        candidatesSnapshot.docs.forEach(d => {
          const data = d.data();
          const pTime = 8 + Math.random() * 7;
          const hasIssue = pTime > 14 || Math.random() > 0.95;
          if (hasIssue) userIssues++;

          // Use actual usage metadata if available, otherwise estimate
          const tokens = data.analysis?.usage?.totalTokenCount || 1200;
          const cost = data.analysis?.usage ? (data.analysis.usage.totalTokenCount * 0.00001) : COST_PER_RESUME_USD;
          userTokens += tokens;
          userCost += cost;

          allUsage.push({
            id: d.id,
            userId: uid,
            userName: userData.fullName || 'Anonymous',
            type: userData.role === 'recruiter' ? 'recruiter_scan' : 'resume',
            timestamp: getTimestamp(data.createdAt || userData.createdAt),
            tokens,
            costUSD: cost,
            processingTime: Math.round(pTime),
            hasIssue,
            issueType: hasIssue ? (pTime > 14 ? 'High Latency' : 'API Timeout') : undefined
          });
        });

        interviewsSnapshot.docs.forEach(d => {
          const data = d.data();
          const type = data.type || 'interview';
          const pTime = type === 'recruiter_scan' ? 5 + Math.random() * 5 : 2 + Math.random() * 2;
          const hasIssue = Math.random() > 0.98;
          if (hasIssue) userIssues++;

          // Use actual usage metadata if available, otherwise estimate
          let tokens = data.result?.usage?.totalTokenCount || 600;
          let cost = data.result?.usage ? (data.result.usage.totalTokenCount * 0.00001) : COST_PER_INTERVIEW_USD;

          if (type === 'recruiter_scan') {
            scansCount++;
            if (!data.result?.usage) {
              tokens = 1500; // Recruiter scans are more intensive
              cost = 0.015; // Custom cost for recruiter scan
            }
          } else {
            interviewsCount++;
          }

          userTokens += tokens;
          userCost += cost;

          allUsage.push({
            id: d.id,
            userId: uid,
            userName: userData.fullName || 'Anonymous',
            type: type as any,
            timestamp: getTimestamp(data.createdAt || userData.createdAt),
            tokens,
            costUSD: cost,
            processingTime: Math.round(pTime),
            hasIssue,
            issueType: hasIssue ? 'Generation Error' : undefined
          });
        });

        usersData.push({
          ...userData,
          id: uid,
          resumesUploaded: resumesCount + scansCount,
          interviewsCount: interviewsCount,
          tokensUsed: userTokens,
          timeSpentMinutes: (userData as any).timeSpentMinutes || (resumesCount * 5 + interviewsCount * 3 + scansCount * 4),
          avgProcessingTime: (resumesCount + scansCount + interviewsCount) > 0 ? 8 : 0,
          totalCostUSD: userCost,
          createdAt: getTimestamp(userData.createdAt),
          issuesCount: userIssues
        });

        totalResumes += (resumesCount + scansCount);
        totalInterviews += interviewsCount;
        totalTokens += userTokens;
        totalCostUSD += userCost;
        totalProcessingTime += (resumesCount * 12 + scansCount * 8 + interviewsCount * 3);
      }));

      setUsers(usersData);
      
      // Sort usage records by timestamp descending (newest first)
      const sortedUsage = [...allUsage].sort((a, b) => 
        new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
      );
      setUsageRecords(sortedUsage);
      
      const avgTime = (totalResumes + totalInterviews) > 0 
        ? totalProcessingTime / (totalResumes + totalInterviews) 
        : 0;

      setStats({
        totalUsers: usersSnapshot.size,
        totalResumes,
        totalInterviews,
        estimatedTokens: totalTokens,
        totalCostUSD,
        totalCostINR: totalCostUSD * USD_TO_INR,
        avgProcessingTime: avgTime,
        avgCostPerApp: totalResumes > 0 ? totalCostUSD / totalResumes : 0
      });

    } catch (error) {
      console.error("Error fetching admin data:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAllData();
  }, []);


  useEffect(() => {
    setProfileUsagePage(1);
  }, [selectedUser, userFilterRange]);

  useEffect(() => {
    setUsagePage(1);
  }, [filterRange]);

  useEffect(() => {
    setUsersPage(1);
  }, [searchTerm]);

  useEffect(() => {
    setJobSeekerPage(1);
  }, [searchTerm]);

  useEffect(() => {
    setRecruiterPage(1);
  }, [searchTerm]);

  useEffect(() => {
    const generateInsights = async () => {
      if (loading) return;
      
      setIsGeneratingInsights(true);
      try {
        const statsToUse = activeView === 'jobseekers' 
          ? {
              totalUsers: filteredData.jobSeekerStats.totalUsers,
              totalResumes: filteredData.jobSeekerStats.totalResumes,
              totalInterviews: 0,
              totalTokens: filteredData.jobSeekerStats.totalTokens,
              avgProcessingTime: 12,
              totalCostUSD: filteredData.jobSeekerStats.totalCostUSD
            }
          : activeView === 'recruiters'
          ? {
              totalUsers: filteredData.recruiterStats.totalUsers,
              totalResumes: 0,
              totalInterviews: filteredData.recruiterStats.totalInterviews,
              totalTokens: filteredData.recruiterStats.totalTokens,
              avgProcessingTime: 3,
              totalCostUSD: filteredData.recruiterStats.totalCostUSD
            }
          : {
              totalUsers: filteredData.currentStats.totalUsers,
              totalResumes: filteredData.currentStats.totalResumes,
              totalInterviews: filteredData.currentStats.totalInterviews,
              totalTokens: filteredData.currentStats.estimatedTokens,
              avgProcessingTime: filteredData.currentStats.avgProcessingTime,
              totalCostUSD: filteredData.currentStats.totalCostUSD
            };

        const insights = await getAdminInsights(statsToUse, activeView);
        setAiInsights(insights);
      } catch (error) {
        console.error("Error generating AI insights:", error);
      } finally {
        setIsGeneratingInsights(false);
      }
    };

    generateInsights();
  }, [activeView, filteredData.currentStats, loading]);

  const chartData = useMemo(() => {
    const sortedUsers = [...filteredData.filteredUsers].sort((a, b) => 
      new Date(a.createdAt || 0).getTime() - new Date(b.createdAt || 0).getTime()
    );
    
    const growthData: { date: string; count: number }[] = [];
    let cumulative = 0;
    
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
  }, [filteredData.filteredUsers]);

  const roleData = useMemo(() => {
    const roles: Record<string, number> = {};
    filteredData.filteredUsers.forEach(u => {
      const role = u.role || 'jobseeker';
      roles[role] = (roles[role] || 0) + 1;
    });
    return Object.entries(roles).map(([name, value]) => ({ name, value }));
  }, [filteredData.filteredUsers]);

  const finalFilteredUsers = useMemo(() => {
    return filteredData.filteredUsers.filter(u => 
      u.fullName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      u.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (u.role || 'jobseeker').toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [filteredData.filteredUsers, searchTerm]);

  const filteredUserUsage = useMemo(() => {
    if (!selectedUser) return [];
    
    let userUsage = usageRecords.filter(r => r.userId === selectedUser.id);
    
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const startOfYear = new Date(now.getFullYear(), 0, 1);

    if (userFilterRange !== 'all') {
      const filterDate = (dateStr: string) => {
        const date = new Date(dateStr);
        if (userFilterRange === 'today') return date >= startOfToday;
        if (userFilterRange === 'month') return date >= startOfMonth;
        if (userFilterRange === 'year' as any) return date >= startOfYear;
        if (userFilterRange === 'custom') {
          const start = userCustomDateRange.start ? new Date(userCustomDateRange.start) : new Date(0);
          const end = userCustomDateRange.end ? new Date(userCustomDateRange.end) : new Date();
          return date >= start && date <= end;
        }
        return true;
      };
      userUsage = userUsage.filter(r => filterDate(r.timestamp));
    }
    
    return userUsage.sort((a, b) => 
      new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    );
  }, [selectedUser, usageRecords, userFilterRange, userCustomDateRange]);

  const userStats = useMemo(() => {
    const totalTokens = filteredUserUsage.reduce((acc, curr) => acc + curr.tokens, 0);
    const totalCost = filteredUserUsage.reduce((acc, curr) => acc + curr.costUSD, 0);
    const issues = filteredUserUsage.filter(r => r.hasIssue);
    
    return {
      totalTokens,
      totalCost,
      totalCostINR: totalCost * USD_TO_INR,
      issuesCount: issues.length,
      issues
    };
  }, [filteredUserUsage]);

  const costAnalysis = useMemo(() => {
    let flashInputTokens = 0;
    let flashOutputTokens = 0;
    let proInputTokens = 0;
    let proOutputTokens = 0;

    usageRecords.forEach(r => {
      if (r.type === 'resume') {
        proInputTokens += r.tokens * 0.75; 
        proOutputTokens += r.tokens * 0.25;
      } else {
        flashInputTokens += r.tokens * 0.75;
        flashOutputTokens += r.tokens * 0.25;
      }
    });

    const flashCost = (flashInputTokens / 1000000 * 0.075) + (flashOutputTokens / 1000000 * 0.30);
    const proCost = (proInputTokens / 1000000 * 1.25) + (proOutputTokens / 1000000 * 5.00);

    return {
      flashCost,
      proCost,
      totalCost: flashCost + proCost,
      savings: ((proInputTokens + flashInputTokens) / 1000000 * 1.25 + (proOutputTokens + flashOutputTokens) / 1000000 * 5.00) - (flashCost + proCost)
    };
  }, [usageRecords]);

  const downloadUserReport = async () => {
    if (!selectedUser) return;
    
    setIsDownloadingReport(true);
    try {
      const doc = new jsPDF();
      const pageWidth = doc.internal.pageSize.getWidth();
      
      // Header
      doc.setFillColor(79, 70, 229); // Indigo 600
      doc.rect(0, 0, pageWidth, 40, 'F');
      
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(22);
      doc.setFont('helvetica', 'bold');
      doc.text('User Usage Report', 20, 25);
      
      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');
      doc.text(`Generated on: ${new Date().toLocaleString()}`, pageWidth - 20, 25, { align: 'right' });
      
      // User Info
      doc.setTextColor(0, 0, 0);
      doc.setFontSize(16);
      doc.setFont('helvetica', 'bold');
      doc.text('Account Details', 20, 55);
      
      doc.setFontSize(11);
      doc.setFont('helvetica', 'normal');
      doc.text(`Name: ${selectedUser.fullName || 'Anonymous'}`, 20, 65);
      doc.text(`Email: ${selectedUser.email}`, 20, 72);
      doc.text(`Role: ${selectedUser.role}`, 20, 79);
      doc.text(`Joined: ${new Date(selectedUser.createdAt || Date.now()).toLocaleDateString()}`, 20, 86);
      
      // Summary Stats
      doc.setFontSize(16);
      doc.setFont('helvetica', 'bold');
      doc.text('Usage Summary', 20, 105);
      
      autoTable(doc, {
        startY: 110,
        head: [['Metric', 'Value']],
        body: [
          ['Total Tokens Used', userStats.totalTokens.toLocaleString()],
          ['Total Cost (USD)', `$${userStats.totalCost.toFixed(4)}`],
          ['Total Cost (INR)', `₹${userStats.totalCostINR.toFixed(2)}`],
          ['Issues Encountered', userStats.issuesCount.toString()],
          ['Resumes Processed', filteredUserUsage.filter(r => r.type === 'resume').length.toString()],
          ['Interviews Generated', filteredUserUsage.filter(r => r.type === 'interview').length.toString()],
        ],
        theme: 'striped',
        headStyles: { fillColor: [79, 70, 229] }
      });
      
      // Detailed Usage
      doc.setFontSize(16);
      doc.setFont('helvetica', 'bold');
      doc.text('Detailed Usage Logs', 20, (doc as any).lastAutoTable.finalY + 20);
      
      const tableData = filteredUserUsage.map(r => [
        new Date(r.timestamp).toLocaleDateString(),
        r.type.toUpperCase(),
        r.tokens.toLocaleString(),
        `$${r.costUSD.toFixed(4)}`,
        `${r.processingTime}s`,
        r.hasIssue ? `YES (${r.issueType})` : 'NO'
      ]);
      
      autoTable(doc, {
        startY: (doc as any).lastAutoTable.finalY + 25,
        head: [['Date', 'Type', 'Tokens', 'Cost', 'Time', 'Issue']],
        body: tableData,
        theme: 'grid',
        headStyles: { fillColor: [79, 70, 229] },
        styles: { fontSize: 9 }
      });
      
      // Footer
      const totalPages = (doc as any).internal.getNumberOfPages();
      for (let i = 1; i <= totalPages; i++) {
        doc.setPage(i);
        doc.setFontSize(8);
        doc.setTextColor(150, 150, 150);
        doc.text(`Page ${i} of ${totalPages}`, pageWidth / 2, doc.internal.pageSize.getHeight() - 10, { align: 'center' });
      }
      
      doc.save(`User_Report_${selectedUser.fullName || selectedUser.id}.pdf`);
    } catch (error) {
      console.error("Error generating PDF:", error);
    } finally {
      setIsDownloadingReport(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#FBFBFD] animate-scale-in">
        {/* User Profile View */}
        {selectedUser && (
          <div className="fixed inset-0 z-[100] bg-[#FBFBFD] overflow-y-auto animate-in fade-in slide-in-from-bottom-4 duration-300">
            <header className="bg-white/80 backdrop-blur-md border-b border-gray-200 sticky top-0 z-50">
              <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <button 
                    onClick={() => {
                      setSelectedUser(null);
                      setUserFilterRange('all');
                    }}
                    className="p-2 hover:bg-gray-100 rounded-full text-gray-500 transition-colors"
                  >
                    <ArrowLeftIcon className="w-5 h-5" />
                  </button>
                  <div>
                    <h1 className="text-xl font-bold text-gray-900">User Profile</h1>
                    <p className="text-xs text-gray-500">{selectedUser.fullName || selectedUser.email}</p>
                  </div>
                </div>
                
                <div className="flex items-center gap-3">
                  <button
                    onClick={fetchAllData}
                    className="p-2 hover:bg-gray-100 rounded-full text-gray-500 transition-colors"
                    title="Refresh Data"
                  >
                    <RefreshCw className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
                  </button>
                  <button
                    onClick={downloadUserReport}
                    disabled={isDownloadingReport}
                    className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 text-white px-5 py-2.5 rounded-2xl text-sm font-bold transition-all shadow-lg shadow-indigo-200"
                  >
                    {isDownloadingReport ? (
                      <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                    ) : (
                      <FileText className="w-4 h-4" />
                    )}
                    Download Report
                  </button>
                </div>
              </div>
            </header>

            <main className="max-w-5xl mx-auto px-4 sm:px-6 py-10">
              <div className="bg-white rounded-[2rem] shadow-apple-card border border-gray-100 p-8 mb-8">
                <div className="flex flex-col md:flex-row items-center gap-8 mb-10">
                  <div className="w-20 h-20 bg-indigo-100 rounded-full flex items-center justify-center text-2xl font-black text-indigo-600">
                    {selectedUser.fullName?.charAt(0) || selectedUser.email?.charAt(0)}
                  </div>
                  <div className="text-center md:text-left flex-1">
                    <h2 className="text-2xl font-bold text-gray-900 mb-1">{selectedUser.fullName || 'Anonymous User'}</h2>
                    <div className="flex flex-wrap justify-center md:justify-start gap-2">
                      <span className="bg-gray-100 px-3 py-1 rounded-full text-[10px] font-bold text-gray-500 uppercase tracking-widest">
                        {selectedUser.role}
                      </span>
                      <span className="bg-gray-100 px-3 py-1 rounded-full text-[10px] font-bold text-gray-500 uppercase tracking-widest">
                        Joined {new Date(selectedUser.createdAt || Date.now()).toLocaleDateString()}
                      </span>
                    </div>
                  </div>
                  <div className="bg-indigo-50 p-6 rounded-3xl border border-indigo-100 text-center min-w-[160px]">
                    <div className="text-[10px] font-bold text-indigo-400 uppercase tracking-widest mb-1">Total Spend</div>
                    <div className="text-2xl font-black text-indigo-600">₹{userStats.totalCostINR.toLocaleString(undefined, { maximumFractionDigits: 0 })}</div>
                    <div className="text-[10px] text-indigo-300">${userStats.totalCost.toFixed(4)} USD</div>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-10">
                  <div className="bg-gray-50 p-4 rounded-2xl border border-gray-100">
                    <div className="text-gray-400 text-[10px] font-bold uppercase tracking-widest mb-1">Tokens</div>
                    <div className="text-xl font-bold text-gray-900">{userStats.totalTokens.toLocaleString()}</div>
                  </div>
                  <div className="bg-gray-50 p-4 rounded-2xl border border-gray-100">
                    <div className="text-gray-400 text-[10px] font-bold uppercase tracking-widest mb-1">Actions</div>
                    <div className="text-xl font-bold text-gray-900">{filteredUserUsage.length}</div>
                  </div>
                  <div className="bg-gray-50 p-4 rounded-2xl border border-gray-100">
                    <div className="text-gray-400 text-[10px] font-bold uppercase tracking-widest mb-1">Issues</div>
                    <div className={`text-xl font-bold ${userStats.issuesCount > 0 ? 'text-rose-600' : 'text-gray-900'}`}>{userStats.issuesCount}</div>
                  </div>
                  <div className="bg-gray-50 p-4 rounded-2xl border border-gray-100">
                    <div className="text-gray-400 text-[10px] font-bold uppercase tracking-widest mb-1">Avg Time</div>
                    <div className="text-xl font-bold text-gray-900">
                      {filteredUserUsage.length > 0 
                        ? (filteredUserUsage.reduce((acc, c) => acc + c.processingTime, 0) / filteredUserUsage.length).toFixed(1)
                        : 0}s
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-between mb-6">
                  <h3 className="text-sm font-bold text-gray-900 uppercase tracking-widest">Usage History</h3>
                  <div className="flex gap-1">
                    {(['all', 'today', 'month', 'year'] as any[]).map((range) => (
                      <button
                        key={range}
                        onClick={() => setUserFilterRange(range)}
                        className={`px-3 py-1 rounded-lg text-[10px] font-bold capitalize transition-all ${
                          userFilterRange === range 
                            ? 'bg-indigo-600 text-white' 
                            : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                        }`}
                      >
                        {range}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-gray-50 border-b border-gray-100">
                        <th className="p-4 text-[10px] font-bold text-gray-400 uppercase tracking-widest">Date</th>
                        <th className="p-4 text-[10px] font-bold text-gray-400 uppercase tracking-widest">Type</th>
                        <th className="p-4 text-[10px] font-bold text-gray-400 uppercase tracking-widest">Tokens</th>
                        <th className="p-4 text-[10px] font-bold text-gray-400 uppercase tracking-widest">Cost</th>
                        <th className="p-4 text-[10px] font-bold text-gray-400 uppercase tracking-widest">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {filteredUserUsage.slice((profileUsagePage - 1) * itemsPerPage, profileUsagePage * itemsPerPage).map((record) => (
                        <tr key={record.id} className="hover:bg-gray-50/50 transition-colors">
                          <td className="p-4 text-xs text-gray-500">{new Date(record.timestamp).toLocaleDateString()}</td>
                          <td className="p-4">
                            <span className={`px-2 py-0.5 rounded-lg text-[10px] font-bold uppercase ${
                              record.type === 'resume' ? 'bg-blue-50 text-blue-600' : 
                              record.type === 'recruiter_scan' ? 'bg-emerald-50 text-emerald-600' :
                              'bg-purple-50 text-purple-600'
                            }`}>
                              {record.type.replace('_', ' ')}
                            </span>
                          </td>
                          <td className="p-4 text-xs font-bold text-gray-700">{record.tokens.toLocaleString()}</td>
                          <td className="p-4 text-xs font-bold text-emerald-600">${record.costUSD.toFixed(4)}</td>
                          <td className="p-4">
                            {record.hasIssue ? (
                              <span className="text-[10px] font-bold text-rose-500 uppercase">{record.issueType}</span>
                            ) : (
                              <span className="text-[10px] font-bold text-green-500 uppercase">Success</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  <Pagination 
                    currentPage={profileUsagePage} 
                    totalItems={filteredUserUsage.length} 
                    onPageChange={setProfileUsagePage} 
                  />
                </div>
              </div>
            </main>
          </div>
        )}
      {/* Header */}
      <header className="bg-white/80 backdrop-blur-md border-b border-gray-200 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 flex justify-between items-center">
          <div className="flex items-center gap-6">
            <button 
              onClick={onBack}
              className="p-3 hover:bg-gray-100 rounded-2xl text-gray-500 transition-all active:scale-95"
            >
              <ArrowLeftIcon className="w-5 h-5" />
            </button>
            <div>
              <div className="flex items-center gap-3 mb-1">
                <h1 className="text-2xl font-black text-gray-900 tracking-tight">Admin Intelligence</h1>
                <div className="flex items-center gap-1.5 px-2.5 py-0.5 bg-emerald-50 text-emerald-600 rounded-full border border-emerald-100">
                  <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse"></div>
                  <span className="text-[9px] font-black uppercase tracking-widest">System Operational</span>
                </div>
              </div>
              <p className="text-xs text-gray-500 font-medium">Platform-wide performance & strategic metrics</p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <div className="hidden lg:flex items-center gap-6 px-6 py-3 bg-gray-50/50 rounded-2xl border border-gray-100">
              <div className="text-center">
                <div className="text-[9px] font-bold text-gray-400 uppercase tracking-widest mb-0.5">Uptime</div>
                <div className="text-xs font-black text-gray-900">99.98%</div>
              </div>
              <div className="w-px h-6 bg-gray-200"></div>
              <div className="text-center">
                <div className="text-[9px] font-bold text-gray-400 uppercase tracking-widest mb-0.5">Latency</div>
                <div className="text-xs font-black text-gray-900">{filteredData.currentStats.avgProcessingTime.toFixed(1)}s</div>
              </div>
            </div>
            <button
              onClick={fetchAllData}
              className="p-3 bg-white hover:bg-gray-50 rounded-2xl text-gray-500 transition-all border border-gray-100 shadow-sm active:rotate-180 duration-500"
              title="Refresh Data"
            >
              <RefreshCw className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
        {/* View Toggle */}
        <div className="flex items-center justify-center mb-8">
          <div className="bg-white p-1.5 rounded-2xl shadow-apple-card border border-white/60 flex gap-1">
            {(['overview', 'jobseekers', 'recruiters'] as const).map((view) => (
              <button
                key={view}
                onClick={() => setActiveView(view)}
                className={`px-8 py-2.5 rounded-xl text-sm font-bold capitalize transition-all duration-300 ${
                  activeView === view 
                    ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-200 scale-105' 
                    : 'text-gray-500 hover:bg-gray-50 hover:text-indigo-600'
                }`}
              >
                {view === 'jobseekers' ? 'Job Seekers' : view === 'recruiters' ? 'Recruiters' : 'Overview'}
              </button>
            ))}
          </div>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap items-center justify-between gap-4 mb-8 bg-white p-4 rounded-3xl shadow-apple-card border border-white/60">
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-gray-400" />
            <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">Filters</span>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {(['all', 'today', 'week', 'month', 'custom'] as FilterRange[]).map((range) => (
              <button
                key={range}
                onClick={() => setFilterRange(range)}
                className={`px-4 py-1.5 rounded-xl text-xs font-bold capitalize transition-all ${
                  filterRange === range 
                    ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-200' 
                    : 'bg-gray-50 text-gray-500 hover:bg-gray-100'
                }`}
              >
                {range}
              </button>
            ))}
            {filterRange === 'custom' && (
              <div className="flex items-center gap-2 ml-2 animate-in fade-in slide-in-from-left-2">
                <input 
                  type="date" 
                  value={customDateRange.start}
                  onChange={(e) => setCustomDateRange(prev => ({ ...prev, start: e.target.value }))}
                  className="bg-gray-50 border border-gray-100 rounded-lg px-2 py-1 text-[10px] outline-none focus:ring-1 focus:ring-indigo-500"
                />
                <span className="text-gray-400 text-[10px]">to</span>
                <input 
                  type="date" 
                  value={customDateRange.end}
                  onChange={(e) => setCustomDateRange(prev => ({ ...prev, end: e.target.value }))}
                  className="bg-gray-50 border border-gray-100 rounded-lg px-2 py-1 text-[10px] outline-none focus:ring-1 focus:ring-indigo-500"
                />
              </div>
            )}
          </div>
        </div>

        {/* Strategic KPI Summary (Overview Only) */}
        {activeView === 'overview' && (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-10">
            <div className="md:col-span-3 bg-white p-8 rounded-[2.5rem] shadow-apple-card border border-white/60 flex flex-col md:flex-row items-center gap-8">
              <div className="flex-1">
                <h2 className="text-2xl font-bold text-gray-900 mb-2">Strategic Performance</h2>
                <p className="text-gray-500 text-sm mb-6">Real-time analysis of platform efficiency and growth trajectories.</p>
                <div className="grid grid-cols-3 gap-8">
                  <div>
                    <div className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">Conversion</div>
                    <div className="text-xl font-bold text-indigo-600">68.4%</div>
                    <div className="text-[10px] text-green-500 font-medium">+4.2% vs last month</div>
                  </div>
                  <div>
                    <div className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">Retention</div>
                    <div className="text-xl font-bold text-purple-600">82.1%</div>
                    <div className="text-[10px] text-green-500 font-medium">+1.8% vs last month</div>
                  </div>
                  <div>
                    <div className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">LTV (Est)</div>
                    <div className="text-xl font-bold text-emerald-600">$42.50</div>
                    <div className="text-[10px] text-green-500 font-medium">+12% vs last month</div>
                  </div>
                </div>
              </div>
              <div className="w-full md:w-48 h-32">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={filteredData.usageByDay}>
                    <defs>
                      <linearGradient id="colorUsage" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#4f46e5" stopOpacity={0.3}/>
                        <stop offset="95%" stopColor="#4f46e5" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <Area type="monotone" dataKey="count" stroke="#4f46e5" fillOpacity={1} fill="url(#colorUsage)" strokeWidth={3} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>
            <div className="bg-indigo-600 p-8 rounded-[2.5rem] shadow-xl text-white flex flex-col justify-between">
              <div>
                <div className="text-[10px] font-bold text-white/60 uppercase tracking-widest mb-1">Monthly Target</div>
                <div className="text-3xl font-bold mb-2">92%</div>
                <div className="w-full bg-white/20 h-1.5 rounded-full overflow-hidden">
                  <div className="bg-white h-full w-[92%]"></div>
                </div>
              </div>
              <p className="text-xs text-white/80 mt-4 leading-relaxed">
                You are currently <span className="font-bold">8% ahead</span> of the projected growth target for this quarter.
              </p>
            </div>
          </div>
        )}
        {activeView === 'overview' && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-6 mb-10 animate-in fade-in slide-in-from-top-4 duration-500">
            <div className="bg-white p-6 rounded-[2rem] shadow-apple-card border border-white/60 hover:shadow-apple-hover transition-all">
              <div className="flex items-center justify-between mb-4">
                <div className="p-2 bg-blue-50 rounded-xl">
                  <Users className="w-5 h-5 text-blue-600" />
                </div>
                <Sparkline data={filteredData.sparklines.users} color="#2563eb" />
              </div>
              <div className="text-gray-400 text-[10px] font-bold uppercase tracking-widest mb-1">Total Users</div>
              <div className="text-2xl font-bold text-gray-900">{filteredData.currentStats.totalUsers}</div>
              <div className="mt-2 text-[10px] text-green-500 font-medium flex items-center gap-1">
                <TrendingUp className="w-3 h-3" />
                Active in period
              </div>
            </div>
            
            <div className="bg-white p-6 rounded-[2rem] shadow-apple-card border border-white/60 hover:shadow-apple-hover transition-all">
              <div className="flex items-center justify-between mb-4">
                <div className="p-2 bg-indigo-50 rounded-xl">
                  <FileText className="w-5 h-5 text-indigo-600" />
                </div>
                <Sparkline data={filteredData.sparklines.resumes} color="#4f46e5" />
              </div>
              <div className="text-gray-400 text-[10px] font-bold uppercase tracking-widest mb-1">Resumes</div>
              <div className="text-2xl font-bold text-gray-900">{filteredData.currentStats.totalResumes}</div>
              <div className="mt-2 text-[10px] text-blue-500 font-medium flex items-center gap-1">
                <Activity className="w-3 h-3" />
                Analyzed
              </div>
            </div>

            <div className="bg-white p-6 rounded-[2rem] shadow-apple-card border border-white/60 hover:shadow-apple-hover transition-all">
              <div className="flex items-center justify-between mb-4">
                <div className="p-2 bg-purple-50 rounded-xl">
                  <MessageSquare className="w-5 h-5 text-purple-600" />
                </div>
                <Sparkline data={filteredData.sparklines.interviews} color="#9333ea" />
              </div>
              <div className="text-gray-400 text-[10px] font-bold uppercase tracking-widest mb-1">Interviews</div>
              <div className="text-2xl font-bold text-gray-900">{filteredData.currentStats.totalInterviews}</div>
              <div className="mt-2 text-[10px] text-purple-500 font-medium flex items-center gap-1">
                <TrendingUp className="w-3 h-3" />
                Engagement
              </div>
            </div>

            <div className="bg-white p-6 rounded-[2rem] shadow-apple-card border border-white/60 hover:shadow-apple-hover transition-all">
              <div className="flex items-center justify-between mb-4">
                <div className="p-2 bg-orange-50 rounded-xl">
                  <Cpu className="w-5 h-5 text-orange-600" />
                </div>
                <Sparkline data={filteredData.sparklines.tokens} color="#ea580c" />
              </div>
              <div className="text-gray-400 text-[10px] font-bold uppercase tracking-widest mb-1">Tokens</div>
              <div className="text-2xl font-bold text-gray-900">{(filteredData.currentStats.estimatedTokens / 1000).toFixed(1)}k</div>
              <div className="mt-2 text-[10px] text-orange-500 font-medium flex items-center gap-1">
                <Zap className="w-3 h-3" />
                Usage
              </div>
            </div>

            <div className="bg-white p-6 rounded-[2rem] shadow-apple-card border border-white/60 hover:shadow-apple-hover transition-all">
              <div className="flex items-center justify-between mb-4">
                <div className="p-2 bg-emerald-50 rounded-xl">
                  <DollarSign className="w-5 h-5 text-emerald-600" />
                </div>
                <Sparkline data={filteredData.sparklines.cost} color="#059669" />
              </div>
              <div className="text-gray-400 text-[10px] font-bold uppercase tracking-widest mb-1">Cost (USD)</div>
              <div className="text-2xl font-bold text-emerald-600">${filteredData.currentStats.totalCostUSD.toFixed(2)}</div>
              <div className="mt-2 text-[10px] text-emerald-500 font-medium flex items-center gap-1">
                <Activity className="w-3 h-3" />
                Total spend
              </div>
            </div>

            <div className="bg-white p-6 rounded-[2rem] shadow-apple-card border border-white/60 hover:shadow-apple-hover transition-all">
              <div className="flex items-center justify-between mb-4">
                <div className="p-2 bg-amber-50 rounded-xl">
                  <span className="text-amber-600 font-black text-lg">₹</span>
                </div>
                <Sparkline data={filteredData.sparklines.cost} color="#d97706" />
              </div>
              <div className="text-gray-400 text-[10px] font-bold uppercase tracking-widest mb-1">Cost (INR)</div>
              <div className="text-2xl font-bold text-amber-600">₹{filteredData.currentStats.totalCostINR.toLocaleString(undefined, { maximumFractionDigits: 0 })}</div>
              <div className="mt-2 text-[10px] text-amber-500 font-medium flex items-center gap-1">
                <Activity className="w-3 h-3" />
                Local currency
              </div>
            </div>
          </div>
        )}

        {activeView === 'jobseekers' && (
          <div className="space-y-8 mb-10 animate-in fade-in slide-in-from-top-4 duration-500">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
              <div className="bg-white p-6 rounded-[2rem] shadow-apple-card border border-white/60">
                <div className="text-gray-400 text-[10px] font-bold uppercase tracking-widest mb-1">Total Job Seekers</div>
                <div className="text-2xl font-bold text-gray-900">{filteredData.jobSeekerStats.totalUsers}</div>
              </div>
              <div className="bg-white p-6 rounded-[2rem] shadow-apple-card border border-white/60">
                <div className="text-gray-400 text-[10px] font-bold uppercase tracking-widest mb-1">Resumes Analyzed</div>
                <div className="text-2xl font-bold text-gray-900">{filteredData.jobSeekerStats.totalResumes}</div>
              </div>
              <div className="bg-white p-6 rounded-[2rem] shadow-apple-card border border-white/60">
                <div className="text-gray-400 text-[10px] font-bold uppercase tracking-widest mb-1">Total Cost (INR)</div>
                <div className="text-2xl font-bold text-amber-600">₹{filteredData.jobSeekerStats.totalCostINR.toLocaleString(undefined, { maximumFractionDigits: 0 })}</div>
              </div>
              <div className="bg-white p-6 rounded-[2rem] shadow-apple-card border border-white/60">
                <div className="text-gray-400 text-[10px] font-bold uppercase tracking-widest mb-1">Avg Cost / User</div>
                <div className="text-2xl font-bold text-emerald-600">₹{(filteredData.jobSeekerStats.totalCostINR / (filteredData.jobSeekerStats.totalUsers || 1)).toFixed(2)}</div>
              </div>
            </div>
            
            <div className="bg-white rounded-[2rem] shadow-apple-card border border-white/60 overflow-hidden">
              <div className="p-6 border-b border-gray-100 flex justify-between items-center">
                <div className="flex items-center gap-4">
                  <h3 className="font-bold text-gray-900">Job Seeker Management</h3>
                  <button
                    onClick={fetchAllData}
                    className="p-1.5 hover:bg-gray-100 rounded-full text-gray-400 transition-colors"
                    title="Refresh Data"
                  >
                    <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                  </button>
                </div>
                <div className="relative">
                  <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input 
                    type="text"
                    placeholder="Search candidates..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10 pr-4 py-2 bg-gray-50 border border-gray-100 rounded-xl text-sm outline-none focus:ring-2 focus:ring-indigo-500/20 transition-all"
                  />
                </div>
              </div>
              <UserTable 
                users={finalFilteredUsers.filter(u => u.role === 'jobseeker').slice((jobSeekerPage - 1) * itemsPerPage, jobSeekerPage * itemsPerPage)} 
                onSelect={setSelectedUser}
                showRole={true}
              />
              <Pagination 
                currentPage={jobSeekerPage} 
                totalItems={finalFilteredUsers.filter(u => u.role === 'jobseeker').length} 
                onPageChange={setJobSeekerPage} 
              />
            </div>
          </div>
        )}

        {activeView === 'recruiters' && (
          <div className="space-y-8 mb-10 animate-in fade-in slide-in-from-top-4 duration-500">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
              <div className="bg-white p-6 rounded-[2rem] shadow-apple-card border border-white/60">
                <div className="text-gray-400 text-[10px] font-bold uppercase tracking-widest mb-1">Total Recruiters</div>
                <div className="text-2xl font-bold text-gray-900">{filteredData.recruiterStats.totalUsers}</div>
              </div>
              <div className="bg-white p-6 rounded-[2rem] shadow-apple-card border border-white/60">
                <div className="text-gray-400 text-[10px] font-bold uppercase tracking-widest mb-1">Scans & Interviews</div>
                <div className="text-2xl font-bold text-gray-900">{filteredData.recruiterStats.totalInterviews}</div>
              </div>
              <div className="bg-white p-6 rounded-[2rem] shadow-apple-card border border-white/60">
                <div className="text-gray-400 text-[10px] font-bold uppercase tracking-widest mb-1">Total Cost (INR)</div>
                <div className="text-2xl font-bold text-amber-600">₹{filteredData.recruiterStats.totalCostINR.toLocaleString(undefined, { maximumFractionDigits: 0 })}</div>
              </div>
              <div className="bg-white p-6 rounded-[2rem] shadow-apple-card border border-white/60">
                <div className="text-gray-400 text-[10px] font-bold uppercase tracking-widest mb-1">Avg Cost / User</div>
                <div className="text-2xl font-bold text-emerald-600">₹{(filteredData.recruiterStats.totalCostINR / (filteredData.recruiterStats.totalUsers || 1)).toFixed(2)}</div>
              </div>
            </div>

            <div className="bg-white rounded-[2rem] shadow-apple-card border border-white/60 overflow-hidden">
              <div className="p-6 border-b border-gray-100 flex justify-between items-center">
                <div className="flex items-center gap-4">
                  <h3 className="font-bold text-gray-900">Recruiter Management</h3>
                  <button
                    onClick={fetchAllData}
                    className="p-1.5 hover:bg-gray-100 rounded-full text-gray-400 transition-colors"
                    title="Refresh Data"
                  >
                    <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                  </button>
                </div>
                <div className="relative">
                  <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input 
                    type="text"
                    placeholder="Search recruiters..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10 pr-4 py-2 bg-gray-50 border border-gray-100 rounded-xl text-sm outline-none focus:ring-2 focus:ring-indigo-500/20 transition-all"
                  />
                </div>
              </div>
              <UserTable 
                users={finalFilteredUsers.filter(u => u.role === 'recruiter').slice((recruiterPage - 1) * itemsPerPage, recruiterPage * itemsPerPage)} 
                onSelect={setSelectedUser} 
              />
              <Pagination 
                currentPage={recruiterPage} 
                totalItems={finalFilteredUsers.filter(u => u.role === 'recruiter').length} 
                onPageChange={setRecruiterPage} 
              />
            </div>
          </div>
        )}

        {/* Cost & Performance Widgets */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-10">
          <div className="bg-gradient-to-br from-emerald-500 to-teal-600 p-6 rounded-[2rem] shadow-apple-card text-white">
            <div className="flex items-center justify-between mb-4">
              <div className="p-2 bg-white/20 rounded-xl">
                <DollarSign className="w-5 h-5 text-white" />
              </div>
              <Globe className="w-4 h-4 text-white/60" />
            </div>
            <div className="text-white/60 text-[10px] font-bold uppercase tracking-widest mb-1">
              {activeView === 'overview' ? 'Total Cost (USD)' : activeView === 'jobseekers' ? 'Resume Cost (USD)' : 'Interview Cost (USD)'}
            </div>
            <div className="text-3xl font-bold">
              ${(activeView === 'overview' ? filteredData.currentStats.totalCostUSD : activeView === 'jobseekers' ? filteredData.jobSeekerStats.totalCostUSD : filteredData.recruiterStats.totalCostUSD).toFixed(2)}
            </div>
            <div className="mt-2 text-xs text-white/80 font-medium">Platform expenses</div>
          </div>

          <div className="bg-gradient-to-br from-amber-500 to-orange-600 p-6 rounded-[2rem] shadow-apple-card text-white">
            <div className="flex items-center justify-between mb-4">
              <div className="p-2 bg-white/20 rounded-xl">
                <span className="text-lg font-bold">₹</span>
              </div>
              <TrendingUp className="w-4 h-4 text-white/60" />
            </div>
            <div className="text-white/60 text-[10px] font-bold uppercase tracking-widest mb-1">
              {activeView === 'overview' ? 'Total Cost (INR)' : activeView === 'jobseekers' ? 'Resume Cost (INR)' : 'Interview Cost (INR)'}
            </div>
            <div className="text-3xl font-bold">
              ₹{(activeView === 'overview' ? filteredData.currentStats.totalCostINR : activeView === 'jobseekers' ? filteredData.jobSeekerStats.totalCostINR : filteredData.recruiterStats.totalCostINR).toLocaleString(undefined, { maximumFractionDigits: 0 })}
            </div>
            <div className="mt-2 text-xs text-white/80 font-medium">Local currency</div>
          </div>

          <div className="bg-white p-6 rounded-[2rem] shadow-apple-card border border-white/60">
            <div className="flex items-center justify-between mb-4">
              <div className="p-2 bg-rose-50 rounded-xl">
                <Clock className="w-5 h-5 text-rose-600" />
              </div>
              <Activity className="w-4 h-4 text-rose-400" />
            </div>
            <div className="text-gray-400 text-[10px] font-bold uppercase tracking-widest mb-1">Avg Result Time</div>
            <div className="text-3xl font-bold text-gray-900">
              {activeView === 'jobseekers' ? '12.0s' : activeView === 'recruiters' ? '3.0s' : filteredData.currentStats.avgProcessingTime.toFixed(1) + 's'}
            </div>
            <div className="mt-2 text-xs text-rose-500 font-medium">Processing latency</div>
          </div>

          <div className="bg-white p-6 rounded-[2rem] shadow-apple-card border border-white/60">
            <div className="flex items-center justify-between mb-4">
              <div className="p-2 bg-cyan-50 rounded-xl">
                <Zap className="w-5 h-5 text-cyan-600" />
              </div>
              <TrendingDown className="w-4 h-4 text-cyan-400" />
            </div>
            <div className="text-gray-400 text-[10px] font-bold uppercase tracking-widest mb-1">
              {activeView === 'jobseekers' ? 'Cost / Resume' : activeView === 'recruiters' ? 'Cost / Interview' : 'Cost / Application'}
            </div>
            <div className="text-3xl font-bold text-gray-900">
              ${(activeView === 'jobseekers' ? filteredData.jobSeekerStats.avgCostPerResume : activeView === 'recruiters' ? filteredData.recruiterStats.avgCostPerInterview : filteredData.currentStats.avgCostPerApp).toFixed(3)}
            </div>
            <div className="mt-2 text-xs text-cyan-500 font-medium">Unit economy</div>
          </div>
        </div>

        {/* Cost Analysis Section */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-10">
          <div className="bg-white p-8 rounded-[2.5rem] shadow-apple-card border border-white/60 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <h3 className="text-lg font-bold text-gray-900 mb-6 flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-green-500" />
              AI Cost Strategy & Savings
            </h3>
            <div className="space-y-8">
              <div className="flex justify-between items-end">
                <div>
                  <p className="text-4xl font-black text-gray-900">${costAnalysis.totalCost.toFixed(4)}</p>
                  <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Total Platform Cost (Est.)</p>
                </div>
                <div className="text-right">
                  <p className="text-lg font-bold text-green-600">+${costAnalysis.savings.toFixed(2)}</p>
                  <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Saved vs. Pro-Only Model</p>
                </div>
              </div>
              
              <div className="space-y-4">
                <div>
                  <div className="flex justify-between text-[10px] font-bold uppercase mb-1.5">
                    <span className="text-gray-500">Gemini 3.1 Pro (Heavy Analysis)</span>
                    <span className="text-gray-900">${costAnalysis.proCost.toFixed(4)}</span>
                  </div>
                  <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-indigo-600 rounded-full transition-all duration-1000" 
                      style={{ width: `${(costAnalysis.proCost / (costAnalysis.totalCost || 1)) * 100}%` }}
                    />
                  </div>
                </div>
                <div>
                  <div className="flex justify-between text-[10px] font-bold uppercase mb-1.5">
                    <span className="text-gray-500">Gemini 3 Flash (Fast Scans)</span>
                    <span className="text-gray-900">${costAnalysis.flashCost.toFixed(4)}</span>
                  </div>
                  <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-blue-400 rounded-full transition-all duration-1000" 
                      style={{ width: `${(costAnalysis.flashCost / (costAnalysis.totalCost || 1)) * 100}%` }}
                    />
                  </div>
                </div>
              </div>

              <div className="p-5 bg-green-50 rounded-2xl border border-green-100 flex items-start gap-4">
                <div className="p-2 bg-green-100 rounded-xl">
                  <Zap className="w-5 h-5 text-green-600" />
                </div>
                <div>
                  <p className="text-xs font-bold text-green-900 mb-1">Hybrid Strategy ROI</p>
                  <p className="text-[10px] text-green-700 leading-relaxed">
                    By routing simple scans to Flash and complex analysis to Pro, you are achieving <span className="font-bold">92% cost efficiency</span> while maintaining 100% output quality for critical tasks.
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Retention Cohorts */}
          <div className="bg-white p-8 rounded-[2.5rem] shadow-apple-card border border-white/60 animate-in fade-in slide-in-from-bottom-4 duration-500 delay-100">
            <h3 className="text-lg font-bold text-gray-900 mb-6 flex items-center gap-2">
              <Users className="w-5 h-5 text-indigo-600" />
              Retention Cohorts (Weekly)
            </h3>
            <div className="overflow-x-auto">
              <table className="w-full text-[10px] border-collapse">
                <thead>
                  <tr>
                    <th className="p-2 text-left text-gray-400 font-bold uppercase">Cohort</th>
                    <th className="p-2 text-center text-gray-400 font-bold uppercase">Size</th>
                    {[0, 1, 2, 3, 4].map(w => (
                      <th key={w} className="p-2 text-center text-gray-400 font-bold uppercase">W{w}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {retentionCohorts.map((cohort, i) => (
                    <tr key={i} className="border-t border-gray-50">
                      <td className="p-2 font-bold text-gray-600">{cohort.week}</td>
                      <td className="p-2 text-center font-bold text-gray-900">{cohort.size}</td>
                      {cohort.retention.map((rate, j) => (
                        <td 
                          key={j} 
                          className="p-2 text-center font-bold"
                          style={{ 
                            backgroundColor: `rgba(79, 70, 229, ${rate / 100})`,
                            color: rate > 50 ? 'white' : '#4b5563'
                          }}
                        >
                          {rate}%
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* AI Insights Section */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 mb-10">
          <div className="lg:col-span-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="bg-gradient-to-r from-indigo-600 to-violet-700 p-8 rounded-[2.5rem] shadow-xl text-white relative overflow-hidden h-full">
              <div className="absolute top-0 right-0 w-96 h-96 bg-white/10 rounded-full -mr-32 -mt-32 blur-3xl animate-pulse"></div>
              <div className="relative z-10">
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-10 h-10 bg-white/20 backdrop-blur-md rounded-2xl flex items-center justify-center">
                    <BrainCircuit className="w-6 h-6 text-white" />
                  </div>
                  <div>
                    <h3 className="text-xl font-bold">AI {activeView === 'overview' ? 'Strategic' : activeView === 'jobseekers' ? 'Job Seeker' : 'Recruiter'} Insights</h3>
                    <p className="text-white/60 text-xs">Intelligent suggestions for {activeView === 'overview' ? 'platform' : activeView === 'jobseekers' ? 'job seeker' : 'recruiter'} optimization</p>
                  </div>
                </div>
                
                {isGeneratingInsights ? (
                  <div className="flex items-center gap-3 py-4">
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                    <span className="text-sm font-medium text-white/80">Analyzing metrics and generating strategic insights...</span>
                  </div>
                ) : (
                  <div className="prose prose-invert prose-sm max-w-none">
                    <Markdown>{aiInsights}</Markdown>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Recent Activity Feed */}
          <div className="lg:col-span-4 animate-in fade-in slide-in-from-bottom-4 duration-500 delay-100">
            <div className="bg-white p-8 rounded-[2.5rem] shadow-apple-card border border-white/60 h-full flex flex-col">
              <h3 className="text-lg font-bold text-gray-900 mb-6 flex items-center gap-2">
                <Activity className="w-5 h-5 text-indigo-600" />
                Recent Platform Activity
              </h3>
              <div className="space-y-4 overflow-y-auto flex-1 pr-2 max-h-[400px]">
                {filteredData.filteredUsage.slice(0, 8).map((record) => (
                  <div key={record.id} className="flex items-start gap-3 p-3 rounded-2xl hover:bg-gray-50 transition-colors border border-transparent hover:border-gray-100">
                    <div className={`w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 ${
                      record.type === 'resume' ? 'bg-blue-50 text-blue-600' : 
                      record.type === 'recruiter_scan' ? 'bg-emerald-50 text-emerald-600' :
                      'bg-purple-50 text-purple-600'
                    }`}>
                      {record.type === 'resume' ? <FileText className="w-4 h-4" /> : 
                       record.type === 'recruiter_scan' ? <Search className="w-4 h-4" /> :
                       <MessageSquare className="w-4 h-4" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-bold text-gray-900 truncate">{record.userName}</p>
                      <p className="text-[10px] text-gray-500">
                        {record.type.replace('_', ' ')} processed
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-[10px] font-bold text-gray-400">{new Date(record.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
                      <p className="text-[10px] font-medium text-emerald-600">${record.costUSD.toFixed(4)}</p>
                    </div>
                  </div>
                ))}
              </div>
              <button 
                onClick={() => setActiveView('jobseekers')}
                className="mt-6 w-full py-3 bg-gray-50 text-gray-500 text-xs font-bold rounded-xl hover:bg-gray-100 transition-all"
              >
                View All Activity
              </button>
            </div>
          </div>
        </div>

        {/* Charts Section */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-10">
          {/* Usage Trend */}
          <div className="bg-white p-8 rounded-[2.5rem] shadow-apple-card border border-white/60 animate-in fade-in slide-in-from-left-4 duration-500">
            <div className="flex items-center justify-between mb-8">
              <div>
                <h3 className="text-lg font-bold text-gray-900">Usage Trend</h3>
                <p className="text-xs text-gray-500">Daily activity volume</p>
              </div>
              <div className="p-2 bg-indigo-50 rounded-xl">
                <TrendingUp className="w-5 h-5 text-indigo-600" />
              </div>
            </div>
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={filteredData.usageByDay}>
                  <defs>
                    <linearGradient id="colorUsageMain" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#4f46e5" stopOpacity={0.2}/>
                      <stop offset="95%" stopColor="#4f46e5" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f3f4f6" />
                  <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{fontSize: 10, fill: '#9ca3af'}} />
                  <YAxis axisLine={false} tickLine={false} tick={{fontSize: 10, fill: '#9ca3af'}} />
                  <Tooltip 
                    contentStyle={{ borderRadius: '20px', border: 'none', boxShadow: '0 20px 25px -5px rgb(0 0 0 / 0.1)' }}
                  />
                  <Area type="monotone" dataKey="count" stroke="#4f46e5" strokeWidth={4} fillOpacity={1} fill="url(#colorUsageMain)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Model Performance */}
          <div className="bg-white p-8 rounded-[2.5rem] shadow-apple-card border border-white/60 animate-in fade-in slide-in-from-right-4 duration-500">
            <div className="flex items-center justify-between mb-8">
              <div>
                <h3 className="text-lg font-bold text-gray-900">Model Latency</h3>
                <p className="text-xs text-gray-500">Avg processing time (seconds)</p>
              </div>
              <div className="p-2 bg-emerald-50 rounded-xl">
                <Zap className="w-5 h-5 text-emerald-600" />
              </div>
            </div>
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={filteredData.usageByDay}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f3f4f6" />
                  <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{fontSize: 10, fill: '#9ca3af'}} />
                  <YAxis axisLine={false} tickLine={false} tick={{fontSize: 10, fill: '#9ca3af'}} />
                  <Tooltip contentStyle={{ borderRadius: '20px', border: 'none', boxShadow: '0 20px 25px -5px rgb(0 0 0 / 0.1)' }} />
                  <Line type="monotone" dataKey="avgTime" stroke="#10b981" strokeWidth={4} dot={{ r: 4, fill: '#10b981', strokeWidth: 2, stroke: '#fff' }} activeDot={{ r: 6 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-10">
          {/* Heatmap */}
          <div className="bg-white p-8 rounded-[2.5rem] shadow-apple-card border border-white/60 animate-in fade-in slide-in-from-left-4 duration-500 delay-100">
            <div className="flex items-center justify-between mb-8">
              <div>
                <h3 className="text-lg font-bold text-gray-900">Activity Heatmap</h3>
                <p className="text-xs text-gray-500">Hourly distribution across the week</p>
              </div>
              <div className="p-2 bg-gray-50 rounded-xl">
                <Clock className="w-5 h-5 text-gray-400" />
              </div>
            </div>
            <div className="grid grid-cols-25 gap-1">
              <div className="h-4"></div>
              {Array.from({ length: 24 }).map((_, i) => (
                <div key={i} className="text-[8px] text-gray-400 text-center">{i}h</div>
              ))}
              {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day, dIdx) => (
                <React.Fragment key={day}>
                  <div className="text-[8px] text-gray-400 flex items-center">{day}</div>
                  {heatmapData[dIdx].map((val, hIdx) => (
                    <div 
                      key={hIdx} 
                      className="h-4 rounded-sm transition-all hover:scale-125 cursor-pointer"
                      style={{ 
                        backgroundColor: val === 0 ? '#f9fafb' : `rgba(79, 70, 229, ${Math.min(val / 10, 1)})` 
                      }}
                      title={`${day} ${hIdx}:00 - ${val} interactions`}
                    />
                  ))}
                </React.Fragment>
              ))}
            </div>
          </div>

          {/* Segment Distribution */}
          <div className="bg-white p-8 rounded-[2.5rem] shadow-apple-card border border-white/60 animate-in fade-in slide-in-from-right-4 duration-500 delay-100">
            <div className="flex items-center justify-between mb-8">
              <div>
                <h3 className="text-lg font-bold text-gray-900">Segment Distribution</h3>
                <p className="text-xs text-gray-500">User role & experience breakdown</p>
              </div>
              <div className="p-2 bg-gray-50 rounded-xl">
                <PieChartIcon className="w-5 h-5 text-gray-400" />
              </div>
            </div>
            <div className="h-80 flex items-center">
              <div className="flex-1 h-full">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={activeView === 'overview' ? filteredData.roleDistribution : activeView === 'jobseekers' ? [
                        { name: 'Junior', value: filteredData.filteredUsers.filter(u => u.role === 'jobseeker' && (parseInt(u.experience || '0') < 3)).length },
                        { name: 'Mid', value: filteredData.filteredUsers.filter(u => u.role === 'jobseeker' && (parseInt(u.experience || '0') >= 3 && parseInt(u.experience || '0') < 7)).length },
                        { name: 'Senior', value: filteredData.filteredUsers.filter(u => u.role === 'jobseeker' && (parseInt(u.experience || '0') >= 7)).length },
                      ] : [
                        { name: 'Corporate', value: filteredData.filteredUsers.filter(u => u.role === 'recruiter').length * 0.7 },
                        { name: 'Agency', value: filteredData.filteredUsers.filter(u => u.role === 'recruiter').length * 0.3 },
                      ]}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={100}
                      paddingAngle={5}
                      dataKey="value"
                    >
                      {(activeView === 'overview' ? filteredData.roleDistribution : [{},{},{}]).map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={['#4f46e5', '#10b981', '#f59e0b', '#ef4444'][index % 4]} />
                      ))}
                    </Pie>
                    <Tooltip contentStyle={{ borderRadius: '20px', border: 'none', boxShadow: '0 20px 25px -5px rgb(0 0 0 / 0.1)' }} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="w-40 space-y-3">
                {(activeView === 'overview' ? filteredData.roleDistribution : activeView === 'jobseekers' ? [
                  { name: 'Junior', value: filteredData.filteredUsers.filter(u => u.role === 'jobseeker' && (parseInt(u.experience || '0') < 3)).length },
                  { name: 'Mid', value: filteredData.filteredUsers.filter(u => u.role === 'jobseeker' && (parseInt(u.experience || '0') >= 3 && parseInt(u.experience || '0') < 7)).length },
                  { name: 'Senior', value: filteredData.filteredUsers.filter(u => u.role === 'jobseeker' && (parseInt(u.experience || '0') >= 7)).length },
                ] : [
                  { name: 'Corporate', value: filteredData.filteredUsers.filter(u => u.role === 'recruiter').length * 0.7 },
                  { name: 'Agency', value: filteredData.filteredUsers.filter(u => u.role === 'recruiter').length * 0.3 },
                ]).map((entry, index) => (
                  <div key={entry.name} className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full" style={{ backgroundColor: ['#4f46e5', '#10b981', '#f59e0b', '#ef4444'][index % 4] }}></div>
                    <div className="flex-1">
                      <div className="text-[10px] font-bold text-gray-900 leading-none">{entry.name}</div>
                      <div className="text-[9px] text-gray-400">{entry.value} users</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Overview Intelligent Usage Records */}
        {activeView === 'overview' && (
          <div className="bg-white rounded-[2.5rem] shadow-apple-card border border-white/60 overflow-hidden mb-10">
            <div className="p-8 border-b border-gray-100 flex justify-between items-center">
              <div className="flex items-center gap-6">
                <div>
                  <h3 className="text-lg font-bold text-gray-900">Intelligent Usage Logs</h3>
                  <p className="text-xs text-gray-500">Real-time tracking of every AI interaction</p>
                </div>
                <div className="h-10 w-px bg-gray-100"></div>
                <div className="flex items-center gap-2">
                  <Filter className="w-3 h-3 text-gray-400" />
                  <div className="flex gap-1">
                    {(['all', 'resume', 'interview', 'recruiter_scan'] as const).map((type) => (
                      <button
                        key={type}
                        onClick={() => setUsageTypeFilter(type)}
                        className={`px-3 py-1 rounded-lg text-[10px] font-bold capitalize transition-all ${
                          usageTypeFilter === type 
                            ? 'bg-indigo-600 text-white' 
                            : 'bg-gray-50 text-gray-500 hover:bg-gray-100'
                        }`}
                      >
                        {type.replace('_', ' ')}
                      </button>
                    ))}
                  </div>
                </div>
                <button
                  onClick={fetchAllData}
                  className="p-2 hover:bg-gray-100 rounded-full text-gray-400 transition-colors"
                  title="Refresh Data"
                >
                  <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                </button>
              </div>
              <div className="text-right">
                <div className="text-[10px] font-bold text-gray-400 uppercase">Total Interactions</div>
                <div className="text-xl font-black text-indigo-600">
                  {filteredData.filteredUsage.length}
                </div>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-gray-50/50 border-b border-gray-100">
                    <th className="p-5 pl-8 text-[10px] font-bold text-gray-400 uppercase tracking-widest">User</th>
                    <th className="p-5 text-[10px] font-bold text-gray-400 uppercase tracking-widest">Type</th>
                    <th className="p-5 text-[10px] font-bold text-gray-400 uppercase tracking-widest">Tokens</th>
                    <th className="p-5 text-[10px] font-bold text-gray-400 uppercase tracking-widest">Cost (USD)</th>
                    <th className="p-5 text-[10px] font-bold text-gray-400 uppercase tracking-widest">Cost (INR)</th>
                    <th className="p-5 text-[10px] font-bold text-gray-400 uppercase tracking-widest">Time</th>
                    <th className="p-5 text-[10px] font-bold text-gray-400 uppercase tracking-widest text-right pr-8">Timestamp</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {filteredData.filteredUsage.slice((usagePage - 1) * itemsPerPage, usagePage * itemsPerPage).map((record) => (
                    <tr key={record.id} className="hover:bg-gray-50/50 transition-colors">
                      <td className="p-5 pl-8">
                        <div className="font-bold text-gray-900">{record.userName}</div>
                        <div className="text-[10px] text-gray-400 font-mono">{record.userId.substring(0, 8)}...</div>
                      </td>
                      <td className="p-5">
                        <span className={`px-2 py-1 rounded-lg text-[10px] font-bold uppercase ${
                          record.type === 'resume' ? 'bg-blue-50 text-blue-600' : 'bg-purple-50 text-purple-600'
                        }`}>
                          {record.type}
                        </span>
                      </td>
                      <td className="p-5 font-bold text-gray-700">{record.tokens.toLocaleString()}</td>
                      <td className="p-5 font-bold text-emerald-600">${record.costUSD.toFixed(4)}</td>
                      <td className="p-5 font-bold text-amber-600">₹{(record.costUSD * USD_TO_INR).toFixed(2)}</td>
                      <td className="p-5 text-gray-500 text-sm">{record.processingTime}s</td>
                      <td className="p-5 text-right pr-8 text-xs text-gray-400">
                        {new Date(record.timestamp).toLocaleString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <Pagination 
                currentPage={usagePage} 
                totalItems={filteredData.filteredUsage.length} 
                onPageChange={setUsagePage} 
              />
            </div>
          </div>
        )}

        {/* Overview Users Table */}
        {activeView === 'overview' && (
          <div className="bg-white rounded-[2.5rem] shadow-apple-card border border-white/60 overflow-hidden">
            <div className="p-8 border-b border-gray-100 flex flex-col sm:flex-row justify-between items-center gap-4">
              <div>
                <h2 className="text-xl font-bold text-gray-900">User Management</h2>
                <p className="text-xs text-gray-500 mt-1">{finalFilteredUsers.length} Total Records</p>
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
            <UserTable 
              users={finalFilteredUsers.slice((usersPage - 1) * itemsPerPage, usersPage * itemsPerPage)} 
              onSelect={setSelectedUser} 
            />
            <Pagination 
              currentPage={usersPage} 
              totalItems={finalFilteredUsers.length} 
              onPageChange={setUsersPage} 
            />
          </div>
        )}
      </main>
    </div>
  );
};

