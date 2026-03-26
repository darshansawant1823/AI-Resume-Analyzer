
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
          <h3 className="text-lg font-bold text-gray-900 tracking-tight">Prioritized Improvements</h3>
          <span className="bg-gray-100 text-gray-600 text-xs font-bold px-2 py-1 rounded-md">{items.length}</span>
      </div>
      
      <div className="space-y-3">
        {(items || []).map((item, index) => {
          const style = getStyles(item.importance);
          return (
            <div key={index} className="group flex items-start p-4 rounded-2xl bg-white border border-gray-100 shadow-sm hover:shadow-apple-hover transition-shadow duration-200">
               <div className={`w-8 h-8 sm:w-10 sm:h-10 rounded-full flex items-center justify-center flex-shrink-0 ${style.bg} text-sm sm:text-lg`}>
                   {style.icon}
               </div>
               <div className="ml-3 sm:ml-4 flex-1 min-w-0">
                   <div className="flex justify-between items-start">
                       <p className="text-sm sm:text-[15px] font-medium text-gray-900 leading-snug">{item.suggestion}</p>
                       <span className={`text-[10px] font-bold uppercase tracking-wider ml-2 ${style.text} flex-shrink-0`}>{item.importance}</span>
                   </div>
                   <p className="text-[10px] sm:text-xs text-gray-400 mt-1 font-medium uppercase tracking-wide">{item.type}</p>
               </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
