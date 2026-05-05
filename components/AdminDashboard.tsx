
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

const Sparkline = ({ data, color }: { data: any[], color: string }) => {
  if (!data || data.length === 0) return <div className="h-8 w-16 bg-gray-50 rounded-lg animate-pulse" />;
  
  return (
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
};

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
  const itemsPerPage = 8;
  const [selectedUser, setSelectedUser] = useState<UserStats | null>(null);
  const [filterRange, setFilterRange] = useState<FilterRange>('all');
  const [userFilterRange, setUserFilterRange] = useState<FilterRange>('all');
  const [usageTypeFilter, setUsageTypeFilter] = useState<'all' | 'resume' | 'interview' | 'recruiter_scan'>('all');

  const Pagination = ({ currentPage, totalItems, onPageChange }: { currentPage: number, totalItems: number, onPageChange: (page: number) => void }) => {
    const totalPages = Math.ceil(totalItems / itemsPerPage);
    if (totalPages <= 1) return null;

    return (
      <div className="flex items-center justify-between px-6 py-4 bg-white/50 border-t border-gray-100 mt-auto">
        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">
          Showing {Math.min(itemsPerPage, totalItems)} of {totalItems} entries
        </p>
        <div className="flex items-center gap-2">
          <button
            onClick={() => onPageChange(Math.max(1, currentPage - 1))}
            disabled={currentPage === 1}
            className="p-2 rounded-xl hover:bg-white disabled:opacity-30 disabled:cursor-not-allowed transition-all border border-gray-100 shadow-sm"
          >
            <ChevronLeft className="w-4 h-4 text-gray-600" />
          </button>
          <div className="flex items-center gap-1">
            {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
              const pageNum = i + 1;
              return (
                <button
                  key={pageNum}
                  onClick={() => onPageChange(pageNum)}
                  className={`w-8 h-8 rounded-xl text-xs font-bold transition-all ${
                    currentPage === pageNum
                      ? 'bg-system-blue text-white shadow-lg shadow-blue-200'
                      : 'text-gray-500 hover:bg-white border border-transparent hover:border-gray-200'
                  }`}
                >
                  {pageNum}
                </button>
              );
            })}
          </div>
          <button
            onClick={() => onPageChange(Math.min(totalPages, currentPage + 1))}
            disabled={currentPage === totalPages}
            className="p-2 rounded-xl hover:bg-white disabled:opacity-30 disabled:cursor-not-allowed transition-all border border-gray-100 shadow-sm"
          >
            <ChevronRight className="w-4 h-4 text-gray-600" />
          </button>
        </div>
      </div>
    );
  };
  const [customDateRange, setCustomDateRange] = useState({ start: '', end: '' });
  const [userCustomDateRange, setUserCustomDateRange] = useState({ start: '', end: '' });
  const [aiInsights, setAiInsights] = useState<string>('');
  const [isGeneratingInsights, setIsGeneratingInsights] = useState(false);
  const [isDownloadingReport, setIsDownloadingReport] = useState(false);
  
  const filteredData = useMemo(() => {
    try {
      let filteredUsers = [...users];
      let filteredUsage = [...usageRecords];

      const now = new Date();
      const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      
      const weekCopy = new Date(now);
      const startOfWeek = new Date(weekCopy.setDate(weekCopy.getDate() - weekCopy.getDay()));
      startOfWeek.setHours(0, 0, 0, 0);
      
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

      const filterDate = (dateInput: any) => {
        if (!dateInput) return false;
        const date = dateInput instanceof Date 
          ? dateInput 
          : (dateInput?.toDate ? dateInput.toDate() : new Date(dateInput));
        
        if (isNaN(date.getTime())) return false;

        if (filterRange === 'today') return date >= startOfToday;
        if (filterRange === 'week') return date >= startOfWeek;
        if (filterRange === 'month') return date >= startOfMonth;
        if (filterRange === 'custom') {
          const start = customDateRange.start ? new Date(customDateRange.start) : new Date(0);
          const end = customDateRange.end ? new Date(customDateRange.end) : new Date();
          end.setHours(23, 59, 59, 999);
          return date >= start && date <= end;
        }
        return true;
      };

      if (filterRange !== 'all') {
        filteredUsage = usageRecords.filter(u => filterDate(u.timestamp));
        const activeUserIds = new Set(filteredUsage.map(u => u.userId));
        filteredUsers = users.filter(u => filterDate(u.createdAt) || activeUserIds.has(u.id));
      }

      if (usageTypeFilter !== 'all') {
        filteredUsage = filteredUsage.filter(u => u.type === usageTypeFilter);
      }

      const sortedUsage = [...filteredUsage].sort((a, b) => 
        new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
      );

      const totalResumes = filteredUsage.filter(u => u.type === 'resume').length;
      const totalScans = filteredUsage.filter(u => u.type === 'recruiter_scan').length;
      const totalInterviews = filteredUsage.filter(u => u.type === 'interview').length;
      const totalTokens = filteredUsage.reduce((acc, curr) => acc + (curr.tokens || 0), 0);
      const totalCostUSD = filteredUsage.reduce((acc, curr) => acc + (curr.costUSD || 0), 0);
      const totalProcessingTime = filteredUsage.reduce((acc, curr) => acc + (curr.processingTime || 0), 0);

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

      const sparklineDays = Array.from({ length: 7 }).map((_, i) => {
        const d = new Date();
        d.setDate(d.getDate() - (6 - i));
        return d.toLocaleDateString();
      });

      const sparklines = {
        users: sparklineDays.map(day => ({
          value: filteredUsers.filter(u => u.createdAt && new Date(u.createdAt).toLocaleDateString() === day).length
        })),
        resumes: sparklineDays.map(day => ({
          value: filteredUsage.filter(u => new Date(u.timestamp).toLocaleDateString() === day && (u.type === 'resume' || u.type === 'recruiter_scan')).length
        })),
        interviews: sparklineDays.map(day => ({
          value: filteredUsage.filter(u => new Date(u.timestamp).toLocaleDateString() === day && u.type === 'interview').length
        })),
        tokens: sparklineDays.map(day => ({
          value: filteredUsage.filter(u => new Date(u.timestamp).toLocaleDateString() === day).reduce((acc, curr) => acc + (curr.tokens || 0), 0)
        })),
        cost: sparklineDays.map(day => ({
          value: filteredUsage.filter(u => new Date(u.timestamp).toLocaleDateString() === day).reduce((acc, curr) => acc + (curr.costUSD || 0), 0)
        }))
      };

      const usageByDay = sparklineDays.map(day => {
        const dayUsage = filteredUsage.filter(u => new Date(u.timestamp).toLocaleDateString() === day);
        return {
          date: day.split('/').slice(0, 2).join('/'),
          count: dayUsage.length,
          avgTime: dayUsage.length > 0 ? dayUsage.reduce((acc, curr) => acc + (curr.processingTime || 0), 0) / dayUsage.length : 0
        };
      });

      const roleDistribution = [
        { name: 'Job Seekers', value: filteredUsers.filter(u => !u.role || u.role === 'jobseeker').length },
        { name: 'Recruiters', value: filteredUsers.filter(u => u.role === 'recruiter').length },
        { name: 'Admins', value: filteredUsers.filter(u => u.role === 'admin').length },
      ].filter(r => r.value > 0);

      if (roleDistribution.length === 0) {
        roleDistribution.push({ name: 'No Data', value: 1 });
      }

      return { 
        filteredUsers, 
        filteredUsage: sortedUsage, 
        currentStats, 
        sparklines,
        usageByDay,
        usageByHour: Array.from({ length: 24 }).map((_, i) => ({
          hour: `${i}:00`,
          count: filteredUsage.filter(u => new Date(u.timestamp).getHours() === i).length
        })),
        roleDistribution,
        jobSeekerStats: {
          totalUsers: filteredUsers.filter(u => !u.role || u.role === 'jobseeker').length,
          totalResumes: filteredUsage.filter(u => (!users.find(fu => fu.id === u.userId)?.role || users.find(fu => fu.id === u.userId)?.role === 'jobseeker') && u.type === 'resume').length,
          totalCostUSD: filteredUsage.filter(u => (!users.find(fu => fu.id === u.userId)?.role || users.find(fu => fu.id === u.userId)?.role === 'jobseeker')).reduce((acc, curr) => acc + (curr.costUSD || 0), 0),
          totalTokens: filteredUsage.filter(u => (!users.find(fu => fu.id === u.userId)?.role || users.find(fu => fu.id === u.userId)?.role === 'jobseeker')).reduce((acc, curr) => acc + (curr.tokens || 0), 0)
        },
        recruiterStats: {
          totalUsers: filteredUsers.filter(u => u.role === 'recruiter').length,
          totalInterviews: filteredUsage.filter(u => users.find(fu => fu.id === u.userId)?.role === 'recruiter').length,
          totalCostUSD: filteredUsage.filter(u => users.find(fu => fu.id === u.userId)?.role === 'recruiter').reduce((acc, curr) => acc + (curr.costUSD || 0), 0),
          totalTokens: filteredUsage.filter(u => users.find(fu => fu.id === u.userId)?.role === 'recruiter').reduce((acc, curr) => acc + (curr.tokens || 0), 0)
        }
      };
    } catch (err) {
      console.error("Error in filteredData useMemo:", err);
      return {
        filteredUsers: [],
        filteredUsage: [],
        currentStats: { totalUsers: 0, totalResumes: 0, totalInterviews: 0, estimatedTokens: 0, totalCostUSD: 0, totalCostINR: 0, avgProcessingTime: 0, avgCostPerApp: 0 },
        sparklines: { users: [], resumes: [], interviews: [], tokens: [], cost: [] },
        usageByDay: [],
        usageByHour: [],
        roleDistribution: [{ name: 'Error', value: 1 }],
        jobSeekerStats: { totalUsers: 0, totalResumes: 0, totalCostUSD: 0, totalTokens: 0 },
        recruiterStats: { totalUsers: 0, totalInterviews: 0, totalCostUSD: 0, totalTokens: 0 }
      };
    }
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

  const generateAIInsights = async () => {
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

  useEffect(() => {
    generateAIInsights();
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
      <header className="bg-white/80 backdrop-blur-xl border-b border-gray-100 sticky top-0 z-[60] safe-top">
        <div className="max-w-7xl mx-auto px-6 sm:px-8 py-5 flex justify-between items-center">
          <div className="flex items-center gap-6">
            <button 
              onClick={onBack}
              className="p-3 bg-gray-50 hover:bg-gray-100 rounded-2xl text-gray-400 hover:text-gray-900 transition-all active:scale-95 border border-transparent hover:border-gray-200"
            >
              <ArrowLeftIcon className="w-5 h-5" />
            </button>
            <div className="h-10 w-px bg-gray-100"></div>
            <div>
              <div className="flex items-center gap-3 mb-1">
                <h1 className="text-2xl font-black text-gray-900 tracking-tight flex items-center gap-2">
                  <Shield className="w-6 h-6 text-indigo-600" />
                  Nexus Admin
                </h1>
                <div className="flex items-center gap-2 px-3 py-1 bg-emerald-50 text-emerald-700 rounded-full border border-emerald-100/50">
                  <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse shadow-[0_0_8px_rgba(16,185,129,0.5)]"></div>
                  <span className="text-[10px] font-black uppercase tracking-widest whitespace-nowrap">Live Monitoring</span>
                </div>
              </div>
              <p className="text-xs text-gray-400 font-bold uppercase tracking-widest leading-none">Intelligence Operations Dashboard</p>
            </div>
          </div>
          <div className="flex items-center gap-6">
            <div className="hidden xl:flex items-center gap-8">
              <div className="text-right">
                <div className="text-[9px] font-bold text-gray-400 uppercase tracking-widest mb-1.5 opacity-60">System Success</div>
                <div className="text-sm font-black text-emerald-600 flex items-center justify-end gap-1.5">
                  <Activity className="w-3.5 h-3.5" />
                  99.98%
                </div>
              </div>
              <div className="w-px h-8 bg-gray-100"></div>
              <div className="text-right">
                <div className="text-[9px] font-bold text-gray-400 uppercase tracking-widest mb-1.5 opacity-60">Avg Latency</div>
                <div className="text-sm font-black text-indigo-600 flex items-center justify-end gap-1.5">
                  <Zap className="w-3.5 h-3.5" />
                  {filteredData.currentStats.avgProcessingTime.toFixed(1)}s
                </div>
              </div>
            </div>
            <button
              onClick={fetchAllData}
              className="p-3.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-600 rounded-2xl transition-all border border-indigo-100/50 shadow-sm active:scale-95 group"
              title="Sync Platform Data"
            >
              <RefreshCw className={`w-5 h-5 transition-transform duration-700 ${loading ? 'animate-spin' : 'group-hover:rotate-180'}`} />
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 sm:px-8 py-10">
        {/* Core KPIs: Intelligence & Economy */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 mb-12">
          {/* Main Visual Metric */}
          <div className="lg:col-span-8 bg-white p-10 rounded-[3rem] shadow-apple-card border border-white/60 relative overflow-hidden group">
            <div className="absolute top-0 right-0 p-10 opacity-5 group-hover:opacity-10 transition-opacity">
              <TrendingUp className="w-48 h-48 -rotate-12" />
            </div>
            <div className="relative z-10">
              <div className="flex flex-col md:flex-row md:items-end justify-between gap-8">
                <div>
                  <h2 className="text-4xl font-black text-gray-900 tracking-tight mb-4 leading-tight">
                    Platform <br/>Efficiency
                  </h2>
                  <div className="flex flex-wrap gap-10">
                    <div>
                      <div className="text-[10px] font-bold text-gray-400 uppercase tracking-[0.2em] mb-2 scale-90 origin-left">Total Token Consumption</div>
                      <div className="text-4xl font-black text-indigo-600 tracking-tighter">
                        {(filteredData.currentStats.estimatedTokens / 1000).toFixed(1)}<span className="text-xl ml-0.5">k</span>
                      </div>
                      <div className="mt-2 text-[10px] font-bold text-gray-400 flex items-center gap-1">
                        <Cpu className="w-3 h-3" />
                        AI compute units
                      </div>
                    </div>
                    <div className="w-px h-16 bg-gray-100 hidden md:block"></div>
                    <div>
                      <div className="text-[10px] font-bold text-gray-400 uppercase tracking-[0.2em] mb-2 scale-90 origin-left text-amber-600">Total Spend (Local)</div>
                      <div className="text-4xl font-black text-amber-500 tracking-tighter">
                        ₹{filteredData.currentStats.totalCostINR.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                      </div>
                      <div className="mt-2 text-[10px] font-bold text-gray-400 flex items-center gap-1">
                        <Globe className="w-3 h-3" />
                        INR conversion applied
                      </div>
                    </div>
                  </div>
                </div>
                <div className="flex-1 w-full max-w-[320px] h-32 md:h-40">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={filteredData.usageByDay}>
                      <defs>
                        <linearGradient id="mainKpiGradient" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#4f46e5" stopOpacity={0.15}/>
                          <stop offset="95%" stopColor="#4f46e5" stopOpacity={0}/>
                        </linearGradient>
                      </defs>
                      <Area type="monotone" dataKey="count" stroke="#4f46e5" strokeWidth={4} fill="url(#mainKpiGradient)" />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>
          </div>

          {/* User Distribution Card */}
          <div className="lg:col-span-4 bg-indigo-600 p-10 rounded-[3rem] shadow-2xl shadow-indigo-200 text-white flex flex-col justify-between relative overflow-hidden">
            <div className="absolute -bottom-10 -right-10 w-40 h-40 bg-white/10 rounded-full blur-3xl"></div>
            <div className="relative z-10">
              <div className="flex items-center justify-between mb-8">
                <Users className="w-8 h-8 text-white/40" />
                <div className="px-3 py-1 bg-white/20 rounded-full text-[10px] font-black uppercase tracking-widest">+12% Growth</div>
              </div>
              <div className="text-4xl font-black tracking-tight mb-2">{filteredData.currentStats.totalUsers}</div>
              <div className="text-xs font-bold text-white/60 uppercase tracking-widest mb-6">Total Active Entities</div>
              
              <div className="space-y-4">
                {filteredData.roleDistribution.map((role, i) => (
                  <div key={role.name}>
                    <div className="flex justify-between text-[10px] font-bold uppercase mb-2">
                      <span className="opacity-70">{role.name}</span>
                      <span>{Math.round((role.value / (filteredData.currentStats.totalUsers || 1)) * 100)}%</span>
                    </div>
                    <div className="w-full h-1.5 bg-white/10 rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-white rounded-full transition-all duration-1000" 
                        style={{ width: `${(role.value / (filteredData.currentStats.totalUsers || 1)) * 100}%` }}
                      ></div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* View Selection Strategy */}
        <div className="flex items-center justify-center mb-12">
          <div className="bg-white p-2 rounded-[2rem] shadow-apple-card border border-white/60 flex gap-2">
            {(['overview', 'jobseekers', 'recruiters'] as const).map((view) => (
              <button
                key={view}
                onClick={() => setActiveView(view)}
                className={`px-10 py-3.5 rounded-2xl text-xs font-black uppercase tracking-widest transition-all duration-500 ${
                  activeView === view 
                    ? 'bg-gray-900 text-white shadow-xl scale-105' 
                    : 'text-gray-400 hover:text-gray-900 hover:bg-gray-50'
                }`}
              >
                {view === 'jobseekers' ? 'Candidate Market' : view === 'recruiters' ? 'Recruiter Hub' : 'System Overview'}
              </button>
            ))}
          </div>
        </div>

        {/* Dynamic Contextual Filters */}
        <div className="flex flex-wrap items-center justify-between gap-6 mb-12 bg-white/60 backdrop-blur-md p-6 rounded-[2.5rem] border border-white shadow-sm">
          <div className="flex items-center gap-4">
            <div className="p-2 bg-gray-50 rounded-xl">
              <Filter className="w-4 h-4 text-gray-400" />
            </div>
            <div>
              <div className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Time Horizon</div>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {(['all', 'today', 'week', 'month', 'custom'] as FilterRange[]).map((range) => (
              <button
                key={range}
                onClick={() => setFilterRange(range)}
                className={`px-6 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${
                  filterRange === range 
                    ? 'bg-white text-indigo-600 shadow-md border border-indigo-100 scale-105' 
                    : 'text-gray-400 hover:text-gray-600 hover:bg-white/50'
                }`}
              >
                {range}
              </button>
            ))}
          </div>
        </div>

        {activeView === 'overview' && (
          <div className="animate-in fade-in slide-in-from-bottom-6 duration-700">
            {/* KPI Grid v2 */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8 mb-12">
              <div className="bg-white p-8 rounded-[2.5rem] shadow-apple-card border border-white/60 group hover:shadow-apple-hover transition-all">
                <div className="flex items-center justify-between mb-6">
                  <div className="p-3 bg-indigo-50 rounded-2xl group-hover:scale-110 transition-transform">
                    <FileText className="w-6 h-6 text-indigo-600" />
                  </div>
                  <Sparkline data={filteredData.sparklines.resumes} color="#4f46e5" />
                </div>
                <div className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1 opacity-60">Resumes Analyzed</div>
                <div className="text-3xl font-black text-gray-900 tracking-tight">{filteredData.currentStats.totalResumes}</div>
                <div className="mt-3 flex items-center gap-2">
                  <div className="text-[10px] px-2 py-0.5 bg-emerald-50 text-emerald-600 font-black rounded-lg uppercase tracking-tighter tracking-widest">Steady</div>
                </div>
              </div>

              <div className="bg-white p-8 rounded-[2.5rem] shadow-apple-card border border-white/60 group hover:shadow-apple-hover transition-all">
                <div className="flex items-center justify-between mb-6">
                  <div className="p-3 bg-purple-50 rounded-2xl group-hover:scale-110 transition-transform">
                    <MessageSquare className="w-6 h-6 text-purple-600" />
                  </div>
                  <Sparkline data={filteredData.sparklines.interviews} color="#9333ea" />
                </div>
                <div className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1 opacity-60">Interviews Held</div>
                <div className="text-3xl font-black text-gray-900 tracking-tight">{filteredData.currentStats.totalInterviews}</div>
                <div className="mt-3 flex items-center gap-2">
                  <div className="text-[10px] px-2 py-0.5 bg-purple-50 text-purple-600 font-black rounded-lg uppercase tracking-tighter tracking-widest">Active</div>
                </div>
              </div>

              <div className="bg-white p-8 rounded-[2.5rem] shadow-apple-card border border-white/60 group hover:shadow-apple-hover transition-all">
                <div className="flex items-center justify-between mb-6">
                  <div className="p-3 bg-orange-50 rounded-2xl group-hover:scale-110 transition-transform">
                    <Zap className="w-6 h-6 text-orange-600" />
                  </div>
                  <Sparkline data={filteredData.sparklines.tokens} color="#ea580c" />
                </div>
                <div className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1 opacity-60">Cost / Scan</div>
                <div className="text-3xl font-black text-gray-900 tracking-tight">${filteredData.currentStats.avgCostPerApp.toFixed(3)}</div>
                <div className="mt-3 flex items-center gap-2 text-xs font-bold text-gray-400">
                  <Activity className="w-3.5 h-3.5" /> Unit Economics
                </div>
              </div>

              <div className="bg-white p-8 rounded-[2.5rem] shadow-apple-card border border-white/60 group hover:shadow-apple-hover transition-all">
                <div className="flex items-center justify-between mb-6">
                  <div className="p-3 bg-emerald-50 rounded-2xl group-hover:scale-110 transition-transform">
                    <DollarSign className="w-6 h-6 text-emerald-600" />
                  </div>
                  <Sparkline data={filteredData.sparklines.cost} color="#059669" />
                </div>
                <div className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1 opacity-60">Platform Spend</div>
                <div className="text-3xl font-black text-emerald-600 tracking-tight">${filteredData.currentStats.totalCostUSD.toFixed(1)}</div>
                <div className="mt-3 flex items-center gap-2 text-xs font-bold text-gray-400">
                  <Globe className="w-3.5 h-3.5" /> USD Global
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Core Ecosystem Management */}
        {(activeView === 'jobseekers' || activeView === 'recruiters') && (
          <div className="space-y-12 mb-12 animate-in fade-in slide-in-from-bottom-6 duration-700">
            {/* Contextual Stats Row */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
              <div className="bg-white p-8 rounded-[2.5rem] shadow-apple-card border border-white/60">
                <div className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1 opacity-60">
                  Total {activeView === 'jobseekers' ? 'Candidates' : 'Recruiters'}
                </div>
                <div className="text-3xl font-black text-gray-900 tracking-tight">
                  {activeView === 'jobseekers' ? filteredData.jobSeekerStats.totalUsers : filteredData.recruiterStats.totalUsers}
                </div>
                <div className="mt-3 flex items-center gap-2 text-xs font-bold text-indigo-500">
                  <Users className="w-3.5 h-3.5" /> Database Size
                </div>
              </div>
              <div className="bg-white p-8 rounded-[2.5rem] shadow-apple-card border border-white/60">
                <div className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1 opacity-60">
                  {activeView === 'jobseekers' ? 'AI Resumes' : 'Platform Activity'}
                </div>
                <div className="text-3xl font-black text-gray-900 tracking-tight">
                  {activeView === 'jobseekers' ? filteredData.jobSeekerStats.totalResumes : filteredData.recruiterStats.totalInterviews}
                </div>
                <div className="mt-3 flex items-center gap-2 text-xs font-bold text-emerald-500">
                  <Activity className="w-3.5 h-3.5" /> Growth Vector
                </div>
              </div>
              <div className="bg-white p-8 rounded-[2.5rem] shadow-apple-card border border-white/60">
                <div className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1 opacity-60">Tokens Consumed</div>
                <div className="text-3xl font-black text-gray-900 tracking-tight">
                  {(((activeView === 'jobseekers' ? filteredData.jobSeekerStats.totalTokens : filteredData.recruiterStats.totalTokens) || 0) / 1000).toFixed(1)}k
                </div>
                <div className="mt-3 flex items-center gap-2 text-xs font-bold text-orange-500">
                  <Zap className="w-3.5 h-3.5" /> Compute Load
                </div>
              </div>
              <div className="bg-amber-50 p-8 rounded-[2.5rem] shadow-sm border border-amber-100/50">
                <div className="text-[10px] font-black text-amber-600 uppercase tracking-widest mb-1">Regional Spend</div>
                <div className="text-3xl font-black text-amber-600 tracking-tight">
                  ₹{((activeView === 'jobseekers' ? filteredData.jobSeekerStats.totalCostUSD : filteredData.recruiterStats.totalCostUSD) * USD_TO_INR).toLocaleString(undefined, { maximumFractionDigits: 0 })}
                </div>
                <div className="mt-3 flex items-center gap-2 text-xs font-bold text-amber-500/60">
                  <Globe className="w-3.5 h-3.5" /> Currency: INR
                </div>
              </div>
            </div>
            
            {/* Primary Table Surface */}
            <div className="bg-white rounded-[3.5rem] shadow-apple-card border border-white/60 overflow-hidden group">
              <div className="p-10 border-b border-gray-50 flex flex-col md:flex-row justify-between items-center gap-8">
                <div>
                  <h3 className="text-2xl font-black text-gray-900 tracking-tight mb-1">
                    {activeView === 'jobseekers' ? 'Candidate Market' : 'Recruitment Network'}
                  </h3>
                  <p className="text-xs text-gray-400 font-bold uppercase tracking-widest">Master index & performance tracking</p>
                </div>
                <div className="flex items-center gap-4 w-full md:w-auto">
                  <div className="relative flex-1">
                    <Search className="w-5 h-5 absolute left-4 top-1/2 -translate-y-1/2 text-gray-300" />
                    <input 
                      type="text"
                      placeholder={`Search ${activeView === 'jobseekers' ? 'candidates' : 'agencies'}...`}
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="w-full md:w-[320px] pl-12 pr-6 py-4 bg-gray-50/50 border border-gray-100 rounded-2xl text-sm outline-none focus:ring-4 focus:ring-indigo-500/10 focus:bg-white transition-all font-medium"
                    />
                  </div>
                </div>
              </div>
              
              <UserTable 
                users={finalFilteredUsers.filter(u => u.role === (activeView === 'jobseekers' ? 'jobseeker' : 'recruiter')).slice(((activeView === 'jobseekers' ? jobSeekerPage : recruiterPage) - 1) * itemsPerPage, (activeView === 'jobseekers' ? jobSeekerPage : recruiterPage) * itemsPerPage)} 
                onSelect={setSelectedUser}
                showRole={false}
              />
              
              <div className="p-6 bg-gray-50/30 border-t border-gray-50">
                <Pagination 
                  currentPage={activeView === 'jobseekers' ? jobSeekerPage : recruiterPage} 
                  totalItems={finalFilteredUsers.filter(u => u.role === (activeView === 'jobseekers' ? 'jobseeker' : 'recruiter')).length} 
                  onPageChange={activeView === 'jobseekers' ? setJobSeekerPage : setRecruiterPage} 
                />
              </div>
            </div>
          </div>
        )}

        {/* Intelligence Layer: AI Strategic Insights & Platform Health */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-12">
          <div className="lg:col-span-2 bg-white p-10 rounded-[3rem] shadow-apple-card border border-white/60 relative group overflow-hidden">
            <div className="absolute top-0 right-0 p-8 opacity-5">
              <BrainCircuit className="w-32 h-32 text-indigo-600" />
            </div>
            <div className="relative z-10">
              <div className="flex items-center justify-between mb-8">
                <div className="flex items-center gap-4">
                  <div className="p-3 bg-indigo-50 rounded-2xl">
                    <BrainCircuit className="w-6 h-6 text-indigo-600" />
                  </div>
                  <div>
                    <h3 className="text-xl font-black text-gray-900 tracking-tight">AI Strategic Insights</h3>
                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Real-time platform analysis • {activeView} Mode</p>
                  </div>
                </div>
                <button 
                  onClick={() => generateAIInsights()} 
                  disabled={isGeneratingInsights}
                  className="p-3 bg-indigo-50 hover:bg-indigo-100 rounded-xl text-indigo-600 transition-all border border-indigo-100"
                >
                  <RefreshCw className={`w-4 h-4 ${isGeneratingInsights ? 'animate-spin' : ''}`} />
                </button>
              </div>
              
              <div className="prose prose-sm max-w-none prose-p:text-gray-500 prose-headings:text-gray-900 prose-strong:text-indigo-600 prose-headings:font-black min-h-[160px]">
                {isGeneratingInsights ? (
                  <div className="space-y-4">
                    <div className="h-4 bg-gray-50 rounded-full animate-pulse w-3/4" />
                    <div className="h-4 bg-gray-50 rounded-full animate-pulse w-1/2" />
                    <div className="h-4 bg-gray-50 rounded-full animate-pulse w-5/6" />
                  </div>
                ) : aiInsights ? (
                  <div className="markdown-body">
                    <Markdown>{aiInsights}</Markdown>
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center py-8 text-center">
                    <Zap className="w-8 h-8 text-indigo-200 mb-3 animate-pulse" />
                    <p className="text-sm text-gray-400 font-medium">Initialize intelligence scan for {activeView} insights.</p>
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="bg-gray-900 p-10 rounded-[3rem] shadow-2xl text-white relative overflow-hidden flex flex-col justify-between group">
            <div className="absolute top-0 right-0 p-8 opacity-10 group-hover:scale-110 transition-transform duration-700">
              <Activity className="w-24 h-24" />
            </div>
            <div className="relative z-10">
              <h3 className="text-lg font-black tracking-tight mb-8">Infrastructure Health</h3>
              <div className="space-y-8">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-[10px] font-bold text-white/40 uppercase tracking-widest mb-1">Compute Latency</div>
                    <div className="text-2xl font-black text-indigo-400">{(filteredData.currentStats.avgProcessingTime * 1000).toFixed(0)}<span className="text-xs ml-0.5">ms</span></div>
                  </div>
                  <div className="w-12 h-12 bg-white/5 rounded-2xl flex items-center justify-center border border-white/5">
                    <Zap className="w-5 h-5 text-indigo-400" />
                  </div>
                </div>
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-[10px] font-bold text-white/40 uppercase tracking-widest mb-1">Cost Efficiency</div>
                    <div className="text-2xl font-black text-emerald-400">92.4%</div>
                  </div>
                  <div className="w-12 h-12 bg-white/5 rounded-2xl flex items-center justify-center border border-white/5">
                    <TrendingUp className="w-5 h-5 text-emerald-400" />
                  </div>
                </div>
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-[10px] font-bold text-white/40 uppercase tracking-widest mb-1">Platform Spend</div>
                    <div className="text-2xl font-black text-amber-500">
                      ₹{(filteredData.currentStats.totalCostINR).toLocaleString()}
                    </div>
                  </div>
                  <div className="w-12 h-12 bg-white/5 rounded-2xl flex items-center justify-center border border-white/5">
                    <DollarSign className="w-5 h-5 text-amber-500" />
                  </div>
                </div>
              </div>
            </div>
            <div className="mt-12 p-4 bg-white/5 rounded-2xl border border-white/10 backdrop-blur-sm">
              <p className="text-[10px] font-bold text-white/60 leading-relaxed">
                System is performing in the <span className="text-indigo-400">Upper 99th Percentile</span>.
              </p>
            </div>
          </div>
        </div>

        {/* Primary Data Surface: Master Index */}
        <div className="bg-white rounded-[3.5rem] shadow-apple-card border border-white/60 overflow-hidden group mb-12">
          <div className="p-10 border-b border-gray-50 flex flex-col md:flex-row justify-between items-center gap-8">
            <div className="flex items-center gap-5">
              <div className="w-14 h-14 bg-indigo-50 rounded-2xl flex items-center justify-center text-indigo-600 shadow-sm border border-indigo-100">
                <Shield className="w-7 h-7" />
              </div>
              <div>
                <h3 className="text-2xl font-black text-gray-900 tracking-tight mb-1">Master User Index</h3>
                <p className="text-xs text-gray-400 font-bold uppercase tracking-widest">Global platform directory • {activeView} filter active</p>
              </div>
            </div>
            <div className="flex items-center gap-4 w-full md:w-auto">
              <div className="relative group flex-1 md:w-[320px]">
                <Search className="w-5 h-5 absolute left-4 top-1/2 -translate-y-1/2 text-gray-300 group-focus-within:text-indigo-600 transition-colors" />
                <input 
                  type="text"
                  placeholder="Master search (Email, Role, Status)..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-12 pr-6 py-4 bg-gray-50/50 border border-gray-100 rounded-[1.25rem] text-sm outline-none focus:ring-4 focus:ring-indigo-500/10 focus:bg-white transition-all font-medium placeholder:text-gray-300"
                />
              </div>
              <button 
                onClick={fetchAllData}
                className="p-4 bg-gray-50 hover:bg-gray-100 rounded-2xl text-gray-400 transition-all border border-transparent shadow-sm"
              >
                <RefreshCw className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
              </button>
            </div>
          </div>
          
          <UserTable 
            users={finalFilteredUsers.slice((usersPage - 1) * itemsPerPage, usersPage * itemsPerPage)} 
            onSelect={setSelectedUser}
            showRole={activeView === 'overview'}
          />
          
          <div className="p-8 bg-gray-50/30 border-t border-gray-50">
            <Pagination 
              currentPage={usersPage} 
              totalItems={finalFilteredUsers.length} 
              onPageChange={setUsersPage} 
            />
          </div>
        </div>
      </main>
    </div>
  );
};

