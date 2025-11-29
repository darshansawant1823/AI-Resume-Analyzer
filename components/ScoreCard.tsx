
import React from 'react';

interface ScoreCardProps {
  score: number;
  verdict: 'Eligible' | 'Borderline' | 'Not Eligible';
  explanations: string[];
}

const getTheme = (score: number) => {
  if (score >= 80) return { text: 'text-system-green', stroke: '#34C759', bg: 'bg-green-50' };
  if (score >= 60) return { text: 'text-system-orange', stroke: '#FF9500', bg: 'bg-orange-50' };
  return { text: 'text-system-red', stroke: '#FF3B30', bg: 'bg-red-50' };
};

export const ScoreCard: React.FC<ScoreCardProps> = ({ score, verdict, explanations }) => {
    const theme = getTheme(score);
    const radius = 52;
    const circumference = 2 * Math.PI * radius;
    const strokeDashoffset = circumference - (score / 100) * circumference;

    return (
        <div className="bg-white rounded-3xl p-6 sm:p-8 shadow-apple-card border border-white/50 relative overflow-hidden group hover:shadow-apple-hover transition-shadow duration-300">
            <div className="flex flex-col sm:flex-row items-center gap-6 sm:gap-10 relative z-10">
                
                {/* Activity Ring */}
                <div className="relative w-32 h-32 sm:w-40 sm:h-40 flex-shrink-0">
                     {/* Background Circle */}
                    <svg className="w-full h-full rotate-[-90deg]" viewBox="0 0 120 120">
                        <circle
                            cx="60" cy="60" r={radius}
                            stroke="#F2F2F7"
                            strokeWidth="10"
                            fill="none"
                        />
                        {/* Progress Circle with Gradient Cap */}
                        <circle
                            cx="60" cy="60" r={radius}
                            stroke={theme.stroke}
                            strokeWidth="10"
                            fill="none"
                            strokeDasharray={circumference}
                            strokeDashoffset={strokeDashoffset}
                            strokeLinecap="round"
                            className="transition-all duration-1000 ease-out"
                        />
                    </svg>
                    <div className="absolute inset-0 flex flex-col items-center justify-center">
                        <span className={`text-4xl sm:text-5xl font-bold tracking-tighter ${theme.text}`}>
                            {score}
                        </span>
                    </div>
                </div>

                <div className="flex-1 text-center sm:text-left space-y-3">
                    <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-gray-100/80">
                         <div className={`w-2 h-2 rounded-full ${theme.text.replace('text-', 'bg-')}`}></div>
                         <span className="text-xs font-bold uppercase tracking-wide text-gray-500">{verdict}</span>
                    </div>
                    
                    <h3 className="text-xl sm:text-2xl font-bold text-gray-900 leading-tight">
                        {explanations[0] || "Match Analysis Complete"}
                    </h3>
                    
                    <p className="text-sm sm:text-base text-gray-500 leading-relaxed font-medium">
                        {explanations.slice(1).join(' ') || "Review the detailed breakdown below to understand your score."}
                    </p>
                </div>
            </div>
            
            {/* Subtle Gradient Background */}
            <div className={`absolute top-0 right-0 w-64 h-64 opacity-5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2 ${theme.text.replace('text', 'bg')}`}></div>
        </div>
    );
};
