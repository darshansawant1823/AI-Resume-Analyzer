
import React from 'react';

interface ScoreCardProps {
  score: number;
  verdict: 'Eligible' | 'Borderline' | 'Not Eligible';
  confidenceScore?: number;
  explanations: string[];
  size?: 'sm' | 'lg';
}

const getTheme = (score: number) => {
  if (score >= 80) return { text: 'text-system-green', stroke: '#34C759', bg: 'bg-green-50' };
  if (score >= 40) return { text: 'text-system-orange', stroke: '#FF9500', bg: 'bg-orange-50' };
  return { text: 'text-system-red', stroke: '#FF3B30', bg: 'bg-red-50' };
};

export const ScoreCard: React.FC<ScoreCardProps> = ({ score, verdict, confidenceScore, explanations, size = 'lg' }) => {
    const theme = getTheme(score);
    const radius = size === 'sm' ? 44 : 54;
    const circumference = 2 * Math.PI * radius;
    const strokeDashoffset = circumference - (score / 100) * circumference;
    const isSmall = size === 'sm';

    const getVerdictLabel = (v: string) => {
        if (v === 'Eligible') return 'High Match Profile';
        if (v === 'Borderline') return 'Borderline Match';
        return 'Low Match Profile';
    };

    const getConfidenceLabel = (s: number) => {
        if (s >= 85) return 'High';
        if (s >= 60) return 'Medium';
        return 'Low';
    };

    return (
        <div className={`bg-white rounded-3xl ${isSmall ? 'p-6' : 'p-8'} shadow-apple-card border border-white/50 relative overflow-hidden group hover:shadow-apple-hover transition-all duration-300`}>
            <div className={`flex ${isSmall ? 'flex-row items-center justify-between text-left' : 'flex-col items-center text-center'} gap-6 relative z-10`}>
                
                <div className={`flex flex-col ${isSmall ? 'items-start' : 'items-center'} gap-4`}>
                    {/* 1. AI Recommendation Tag */}
                    <div className="flex flex-col gap-1">
                        <div className="flex items-center gap-2">
                             <div className={`w-2 h-2 rounded-full ${theme.text.replace('text-', 'bg-')} animate-pulse`}></div>
                             <span className={`text-[10px] font-bold uppercase tracking-[0.2em] ${theme.text}`}>AI Recommendation: {getVerdictLabel(verdict)}</span>
                        </div>
                        {confidenceScore !== undefined && (
                            <div className="flex items-center gap-1.5 ml-4">
                                <span className="text-[9px] font-bold text-gray-400 uppercase tracking-widest">Confidence:</span>
                                <span className={`text-[9px] font-black uppercase tracking-widest ${confidenceScore >= 85 ? 'text-system-green' : confidenceScore >= 60 ? 'text-system-orange' : 'text-system-red'}`}>
                                    {getConfidenceLabel(confidenceScore)} ({confidenceScore}%)
                                </span>
                            </div>
                        )}
                    </div>

                    {/* 2. Content */}
                    <div className={`space-y-2 ${isSmall ? 'max-w-xs' : 'max-w-md'}`}>
                        <h3 className={`${isSmall ? 'text-lg' : 'text-2xl sm:text-3xl'} font-bold text-gray-900 leading-tight tracking-tight`}>
                            {explanations[0] || "Match Analysis Complete"}
                        </h3>
                        
                        {!isSmall && (
                            <p className="text-sm text-gray-500 leading-relaxed font-medium">
                                {explanations.slice(1).join(' ') || "Review the detailed breakdown below to understand your score."}
                            </p>
                        )}
                    </div>
                </div>

                {/* 3. Activity Ring */}
                <div className={`relative ${isSmall ? 'w-24 h-24' : 'w-32 h-32'} flex-shrink-0`}>
                    <svg className="w-full h-full rotate-[-90deg]" viewBox="0 0 120 120">
                        <circle
                            cx="60" cy="60" r={radius}
                            stroke="#F2F2F7"
                            strokeWidth={isSmall ? "8" : "10"}
                            fill="none"
                        />
                        <circle
                            cx="60" cy="60" r={radius}
                            stroke={theme.stroke}
                            strokeWidth={isSmall ? "8" : "10"}
                            fill="none"
                            strokeDasharray={circumference}
                            strokeDashoffset={strokeDashoffset}
                            strokeLinecap="round"
                            className="transition-all duration-1000 ease-out"
                        />
                    </svg>
                    <div className="absolute inset-0 flex flex-col items-center justify-center">
                        <span className={`${isSmall ? 'text-2xl' : 'text-4xl'} font-bold tracking-tighter ${theme.text}`}>
                            {score}
                        </span>
                        <span className="text-[8px] font-bold text-gray-400 uppercase tracking-widest mt-0.5">Match</span>
                    </div>
                </div>
            </div>
            
            {/* Market Competitiveness Intelligence */}
            {!isSmall && score >= 80 && (
                <div className="mt-6 flex justify-center animate-in fade-in slide-in-from-top-2 duration-700 delay-500">
                    <div className="inline-flex items-center gap-2 px-4 py-2 bg-system-blue/5 border border-system-blue/10 rounded-full">
                        <div className="flex -space-x-1">
                            {[1, 2, 3].map((i) => (
                                <div key={i} className="w-5 h-5 rounded-full border-2 border-white bg-gray-200 overflow-hidden">
                                    <img 
                                        src={`https://picsum.photos/seed/user${i}/32/32`} 
                                        alt="User" 
                                        className="w-full h-full object-cover"
                                        referrerPolicy="no-referrer"
                                    />
                                </div>
                            ))}
                        </div>
                        <span className="text-[11px] font-bold text-system-blue uppercase tracking-wider">
                            Top {score >= 90 ? '1%' : '2%'} in the market
                        </span>
                    </div>
                </div>
            )}
            
            {/* Subtle Gradient Background */}
            <div className={`absolute top-0 right-0 w-64 h-64 opacity-5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2 ${theme.text.replace('text', 'bg')}`}></div>
        </div>
    );
};
