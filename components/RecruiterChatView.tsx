
import React, { useState, useRef, useEffect } from 'react';
import type { Candidate, ChatMessage, ChatSource, ChatRequest } from '../types';
import { interviewChat } from '../services/geminiService';
import { ArrowLeftIcon } from './icons/ArrowLeftIcon';
import { SparklesIcon } from './icons/SparklesIcon';

interface RecruiterChatViewProps {
  candidates: Candidate[];
  jdText: string;
  onBack: () => void;
}

const STARTER_QUESTIONS = [
    "Who is the best match for this role and why?",
    "Summarize the key differences between these candidates",
    "What specific technical gaps should I probe in interviews?",
    "Which candidate has the most growth potential?",
    "Identify any conflicting patterns in their work history",
    "How does their combined experience cover the JD requirements?"
];

export const RecruiterChatView: React.FC<RecruiterChatViewProps> = ({ candidates, jdText, onBack }) => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Aggregate resume text context
  const resumeContextText = candidates
    .map(c => `[CANDIDATE: ${c.name}]\n${c.extractedText || 'Resume text not available'}`)
    .join('\n\n---\n\n');

  const handleSend = async (text: string = input) => {
    if (!text.trim()) return;

    const userMsg: ChatMessage = {
      id: Date.now().toString(),
      role: 'user',
      content: text,
      timestamp: Date.now()
    };

    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setIsLoading(true);

    try {
      const request: ChatRequest = {
        history: messages,
        userQuestion: text,
        context: {
          jdText,
          resumeText: resumeContextText,
          companyString: "Recruiter Portal Analysis",
          roleString: "Selected Candidates Comparison",
          researchSources: []
        }
      };

      const response = await interviewChat(request);

      const aiMsg: ChatMessage = {
        id: (Date.now() + 1).toString(),
        role: 'ai',
        content: response.answerText,
        sources: response.usedSources,
        timestamp: Date.now()
      };

      setMessages(prev => [...prev, aiMsg]);
    } catch (error) {
      console.error("Chat Error", error);
      const errorMsg: ChatMessage = {
        id: (Date.now() + 1).toString(),
        role: 'ai',
        content: "I'm sorry, I encountered an error while analyzing your request. Please try again.",
        timestamp: Date.now()
      };
      setMessages(prev => [...prev, errorMsg]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleClearChat = () => {
      setMessages([]);
  };

  const renderSourcePill = (source: ChatSource) => {
      let color = 'bg-gray-100 text-gray-600';
      if (source.type === 'jd') color = 'bg-green-50 text-green-700 border-green-100';
      if (source.type === 'resume') color = 'bg-purple-50 text-purple-700 border-purple-100';

      return (
          <span key={source.id || Math.random()} className={`text-[10px] px-2 py-0.5 rounded border ${color} inline-flex items-center gap-1`}>
              {source.title}
          </span>
      );
  };

  return (
    <div className="bg-gray-50 min-h-screen animate-scale-in flex flex-col pb-20 sm:pb-0">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 sticky top-0 z-40 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4 flex justify-between items-center">
          <div className="flex items-center gap-4">
            <button 
                onClick={onBack}
                className="p-2 hover:bg-gray-100 rounded-full text-gray-500 transition-colors"
            >
                <ArrowLeftIcon className="w-5 h-5" />
            </button>
            <div>
                <div className="flex items-center gap-2">
                    <SparklesIcon className="w-5 h-5 text-system-blue" />
                    <h1 className="text-lg font-bold text-gray-900">Ask Me Anything</h1>
                    <span className="bg-system-blue text-white text-[10px] font-bold px-2 py-0.5 rounded-full">BETA</span>
                </div>
                <p className="text-xs text-gray-500">Grounded in {candidates.length} selected candidates and the current JD</p>
            </div>
          </div>
          <button onClick={handleClearChat} className="text-xs font-semibold text-gray-400 hover:text-red-500 transition-colors">
              Clear Chat
          </button>
        </div>
      </div>

      <div className="flex-1 flex flex-col max-w-5xl mx-auto w-full px-4 sm:px-6 py-8">
        {/* Chat History Container */}
        <div className="flex-1 bg-white rounded-3xl shadow-apple-card border border-white/60 overflow-hidden flex flex-col h-[600px]">
            {/* Status indicators */}
            <div className="bg-gray-50/50 border-b border-gray-100 px-6 py-3 flex gap-4 text-xs font-medium text-gray-500 overflow-x-auto hide-scrollbar">
                <div className="flex items-center gap-1.5 whitespace-nowrap">
                    <span className="w-2 h-2 rounded-full bg-system-blue"></span>
                    <span>JD Context: Active</span>
                </div>
                <div className="flex items-center gap-1.5 whitespace-nowrap">
                    <span className="w-2 h-2 rounded-full bg-system-green"></span>
                    <span>Resumes: {candidates.length} Loaded</span>
                </div>
                <div className="flex items-center gap-1.5 whitespace-nowrap">
                    <span className="w-2 h-2 rounded-full bg-system-gray"></span>
                    <span>Sources: Grounded</span>
                </div>
            </div>

            <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6 bg-[#F9F9FB]">
                {messages.length === 0 ? (
                    <div className="h-full flex flex-col items-center justify-center text-center opacity-60">
                        <div className="w-16 h-16 bg-white rounded-2xl shadow-sm flex items-center justify-center mb-4 border border-gray-100">
                            <span className="text-3xl">💬</span>
                        </div>
                        <h3 className="font-bold text-gray-900">No questions yet</h3>
                        <p className="text-sm text-gray-500 max-w-xs mt-2">
                            Ask about candidate fits, specific skills, or compare people across the job requirements.
                        </p>
                    </div>
                ) : (
                    messages.map((msg) => (
                        <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                            <div 
                                className={`max-w-[85%] sm:max-w-[75%] rounded-2xl p-4 shadow-sm ${
                                    msg.role === 'user' 
                                    ? 'bg-system-blue text-white rounded-br-none' 
                                    : 'bg-white text-gray-800 border border-gray-100 rounded-bl-none'
                                }`}
                            >
                                <div className="prose prose-sm max-w-none leading-relaxed whitespace-pre-wrap text-inherit">
                                    {msg.content}
                                </div>
                                {msg.role === 'ai' && msg.sources && msg.sources.length > 0 && (
                                    <div className="mt-3 pt-3 border-t border-gray-100 flex flex-wrap gap-2">
                                        <span className="text-[10px] text-gray-400 font-bold uppercase self-center mr-1">Sources:</span>
                                        {msg.sources.map(renderSourcePill)}
                                    </div>
                                )}
                            </div>
                        </div>
                    ))
                )}
                {isLoading && (
                    <div className="flex justify-start">
                        <div className="bg-white border border-gray-100 rounded-2xl rounded-bl-none p-4 shadow-sm flex items-center gap-2">
                            <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"></div>
                            <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{animationDelay: '0.1s'}}></div>
                            <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{animationDelay: '0.2s'}}></div>
                        </div>
                    </div>
                )}
                <div ref={messagesEndRef} />
            </div>

            {/* Input Area */}
            <div className="p-4 bg-white border-t border-gray-100">
                {/* Starter suggestions */}
                <div className="flex gap-2 overflow-x-auto hide-scrollbar mb-4 pb-1">
                    {STARTER_QUESTIONS.map(q => (
                        <button 
                            key={q} 
                            onClick={() => handleSend(q)}
                            disabled={isLoading}
                            className="text-xs bg-gray-50 hover:bg-gray-100 border border-gray-200 text-gray-600 px-3 py-1.5 rounded-full whitespace-nowrap transition-colors disabled:opacity-50"
                        >
                            {q}
                        </button>
                    ))}
                </div>

                <div className="relative">
                    <input
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && handleSend()}
                        disabled={isLoading}
                        placeholder="Ask about these candidates..."
                        className="w-full bg-gray-50 border-0 rounded-xl pl-4 pr-12 py-4 text-sm font-medium focus:ring-2 focus:ring-system-blue/20 outline-none transition-all focus:bg-white"
                    />
                    <button 
                        onClick={() => handleSend()}
                        disabled={!input.trim() || isLoading}
                        className="absolute right-2 top-1/2 -translate-y-1/2 p-2.5 bg-system-blue text-white rounded-lg hover:bg-blue-600 disabled:opacity-50 disabled:bg-gray-300 transition-colors shadow-sm"
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="22" y1="2" x2="11" y2="13"></line><polygon points="22 2 15 22 11 13 2 9 22 2"></polygon></svg>
                    </button>
                </div>
                <p className="text-[10px] text-gray-400 mt-3 text-center">
                    AI responses are grounded in your selected candidates and current JD. No guesswork involved.
                </p>
            </div>
        </div>
      </div>
    </div>
  );
};
