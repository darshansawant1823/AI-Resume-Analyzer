
import React from 'react';
import type { MissingItem } from '../types';

const getStyles = (importance: 'high' | 'medium' | 'low') => {
  switch (importance) {
    case 'high': return { bg: 'bg-red-50', text: 'text-red-600', border: 'border-red-100', icon: '🔴' };
    case 'medium': return { bg: 'bg-orange-50', text: 'text-orange-600', border: 'border-orange-100', icon: '🟠' };
    case 'low': return { bg: 'bg-blue-50', text: 'text-blue-600', border: 'border-blue-100', icon: '🔵' };
  }
};

export const SuggestionsList: React.FC<{ items: MissingItem[] }> = ({ items }) => {
  return (
    <div className="bg-white rounded-3xl shadow-apple-card border border-white/60 p-6 sm:p-8">
      <div className="flex items-center justify-between mb-6">
          <div>
            <h3 className="text-lg font-bold text-gray-900 tracking-tight">Prioritized Improvements</h3>
            <p className="text-xs text-gray-500 font-medium mt-0.5">Key areas to focus on for a better match.</p>
          </div>
          <span className="bg-gray-100 text-gray-600 text-[11px] font-bold px-3 py-1 rounded-full">{items.length}</span>
      </div>
      
      <div className="space-y-3">
        {(items || []).map((item, index) => {
          const style = getStyles(item.importance);
          return (
            <div key={index} className="group flex items-start p-4 rounded-2xl bg-gray-50/50 border border-gray-100/50 hover:bg-white hover:shadow-apple-hover transition-all duration-300">
               <div className={`w-9 h-9 sm:w-10 sm:h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${style.bg} text-lg shadow-sm group-hover:scale-110 transition-transform`}>
                   {style.icon}
               </div>
               <div className="ml-4 flex-1 min-w-0">
                   <div className="flex justify-between items-start gap-3">
                       <p className="text-sm sm:text-[15px] font-semibold text-gray-900 leading-snug">{item.suggestion}</p>
                       <span className={`text-[10px] font-bold uppercase tracking-wider ${style.text} flex-shrink-0 mt-1 bg-white px-2 py-0.5 rounded-md border border-current/10`}>{item.importance}</span>
                   </div>
                   <div className="flex items-center gap-2 mt-1.5">
                        <span className="text-[10px] text-gray-400 font-bold uppercase tracking-widest">{item.type}</span>
                        <div className="w-1 h-1 rounded-full bg-gray-300"></div>
                        <span className="text-[10px] text-gray-400 font-medium uppercase tracking-widest">Recommendation</span>
                   </div>
               </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
