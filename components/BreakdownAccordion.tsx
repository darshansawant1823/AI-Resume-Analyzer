
import React, { useState } from 'react';
import type { Breakdown, ScoreDetail } from '../types';

interface BreakdownItemProps {
  title: string;
  scoreDetail: ScoreDetail;
  weight: number;
}

const BreakdownItem: React.FC<BreakdownItemProps> = ({ title, scoreDetail, weight }) => {
  const [isOpen, setIsOpen] = useState(false);
  const maxScore = weight > 0 ? weight : 1;
  const normalizedScore = Math.max(0, Math.min(100, Math.round((scoreDetail.score / maxScore) * 100)));
  
  let colorClass = 'bg-system-red';
  if(normalizedScore >= 60) colorClass = 'bg-system-orange';
  if(normalizedScore >= 80) colorClass = 'bg-system-green';

  return (
    <div className="border-b border-gray-100 last:border-0">
      <div
        className="flex items-center justify-between w-full py-4 pr-4 pl-0 cursor-pointer group select-none"
        onClick={() => setIsOpen(!isOpen)}
      >
        <div className="flex-1">
          <div className="flex justify-between items-center mb-2">
             <span className="text-sm sm:text-[15px] font-semibold text-gray-900">{title}</span>
             <span className="text-xs sm:text-sm font-medium text-gray-500">{normalizedScore}%</span>
          </div>
          <div className="w-full bg-gray-100 rounded-full h-1.5 overflow-hidden">
            <div className={`h-full rounded-full transition-all duration-500 ${colorClass}`} style={{ width: `${normalizedScore}%` }}></div>
          </div>
        </div>
        <div className={`ml-4 text-gray-400 transition-transform duration-300 ${isOpen ? 'rotate-180' : ''}`}>
             <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
               <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
             </svg>
        </div>
      </div>
      
      <div 
        className={`overflow-hidden transition-all duration-300 ease-in-out ${isOpen ? 'max-h-96 opacity-100 mb-4' : 'max-h-0 opacity-0'}`}
      >
        <ul className="space-y-2 pt-1 pl-1">
           {(scoreDetail.details || []).length > 0 ? (scoreDetail.details || []).map((detail, index) => (
             <li key={index} className="text-xs sm:text-sm text-gray-600 flex items-start gap-2 leading-relaxed">
               <span className="block w-1.5 h-1.5 mt-1.5 rounded-full bg-gray-300 flex-shrink-0"></span>
               {detail}
             </li>
           )) : <li className="text-xs sm:text-sm text-gray-400 italic">No details available.</li>}
        </ul>
      </div>
    </div>
  );
};

export const BreakdownAccordion: React.FC<{ breakdown: Breakdown }> = ({ breakdown }) => {
  const breakdownConfig = [
    { title: 'Core Skills', data: breakdown?.core_skills || { score: 0, details: [] }, weight: 30 },
    { title: 'Title Alignment', data: breakdown?.title_alignment || { score: 0, details: [] }, weight: 20 },
    { title: 'Experience Relevance', data: breakdown?.experience_relevance || { score: 0, details: [] }, weight: 15 },
    { title: 'ATS Readiness', data: breakdown?.ats_readiness || { score: 0, details: [] }, weight: 10 },
    { title: 'Achievements', data: breakdown?.achievements || { score: 0, details: [] }, weight: 10 },
    { title: 'Education', data: breakdown?.education_certifications || { score: 0, details: [] }, weight: 5 },
    { title: 'Soft Skills', data: breakdown?.soft_skills || { score: 0, details: [] }, weight: 5 },
    { title: 'Growth Potential', data: breakdown?.growth_potential || { score: 0, details: [] }, weight: 10 },
  ];

  return (
    <div className="bg-white rounded-3xl shadow-apple-card border border-white/60 p-6 sm:p-8">
      <div className="mb-6">
        <h3 className="text-lg font-bold text-gray-900 tracking-tight">Score Breakdown</h3>
        <p className="text-xs text-gray-500 font-medium mt-0.5">Weighted analysis of your profile components.</p>
      </div>
      
      <div className="divide-y divide-gray-100/50">
        {breakdownConfig.map(item => <BreakdownItem key={item.title} title={item.title} scoreDetail={item.data} weight={item.weight} />)}
        
        {/* Red Flags Section */}
        <div className="pt-6 mt-2">
            <div className={`rounded-2xl p-4 ${(breakdown?.red_flags?.score || 0) < 0 ? 'bg-red-50/50 border border-red-100' : 'bg-gray-50/50 border border-gray-100'}`}>
                <div className="flex items-center gap-2 mb-2">
                    <span className="text-sm">{(breakdown?.red_flags?.score || 0) < 0 ? '🚩' : '✅'}</span>
                    <h4 className={`text-[11px] font-bold uppercase tracking-widest ${(breakdown?.red_flags?.score || 0) < 0 ? 'text-red-700' : 'text-gray-500'}`}>
                        {(breakdown?.red_flags?.score || 0) < 0 ? 'Red Flags Detected' : 'No Red Flags'}
                    </h4>
                </div>
                {(breakdown?.red_flags?.score || 0) < 0 ? (
                    <ul className="space-y-2">
                        {(breakdown?.red_flags?.details || []).map((d, i) => (
                            <li key={i} className="text-xs text-red-700 flex gap-2 leading-relaxed">
                                <span className="w-1 h-1 mt-1.5 rounded-full bg-red-400 flex-shrink-0"></span> {d}
                            </li>
                        ))}
                    </ul>
                ) : (
                    <p className="text-xs text-gray-500 font-medium leading-relaxed">Your resume passed the negative screening check. No critical issues found.</p>
                )}
            </div>
        </div>
      </div>
    </div>
  );
};
