
import React, { useState, useRef, useEffect } from 'react';
import { SparklesIcon } from './icons/SparklesIcon';
import type { ChatMessage, ChatSource, ChatRequest, CompanyMetadata, RoleMetadata } from '../types';
import { interviewChat } from '../services/geminiService';

interface InterviewChatBotProps {
  companyInput: string;
  roleInput: string;
  selectedCompany: CompanyMetadata | null;
  selectedRole: RoleMetadata | null;
  jdText: string;
  resumeText: string;
  resumeFileName: string;
  researchSources: { name: string; description: string; provenance: string }[];
  onViewJD: () => void;
  onViewResume: () => void;
  onViewSources: () => void;
  onClearJD: () => void;
  onClearResume: () => void;
}

const STARTER_QUESTIONS = [
    "What does this company value?",
    "How does my resume match this role?",
    "What are typical interview rounds?",
    "Identify red flags in my profile",
    "Summarize the JD for me",
    "What skills am I missing?"
];

export const InterviewChatBot: React.FC<InterviewChatBotProps> = ({
  companyInput,
  roleInput,
  selectedCompany,
  selectedRole,
  jdText,
  resumeText,
  resumeFileName,
  researchSources,
  onViewJD,
  onViewResume,
  onViewSources,
  onClearJD,
  onClearResume
}) => {
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

  const handleSend = async (text: string = input) => {
    if (!text.trim()) return;
    
    // Check for missing context for specific questions
    if (text.toLowerCase().includes("resume") && !resumeText) {
        const errorMsg: ChatMessage = {
            id: Date.now().toString(),
            role: 'ai',
            content: "To answer that, I need your resume. Please upload it above to get a tailored answer.",
            timestamp: Date.now()
        };
        setMessages(prev => [...prev, { id: (Date.now()-1).toString(), role: 'user', content: text, timestamp: Date.now()-1 }, errorMsg]);
        setInput('');
        return;
    }

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
          company: selectedCompany,
          companyString: companyInput,
          role: selectedRole,
          roleString: roleInput,
          jdText,
          resumeText,
          researchSources
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

  const renderContextStatus = () => (
    <div className="bg-gray-50 border-b border-gray-100 px-4 py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
      <div className="flex items-center gap-4 overflow-x-auto hide-scrollbar">
        <div className="flex items-center gap-1.5 whitespace-nowrap">
           <span className="font-bold text-gray-500">Company:</span>
           <span className={`px-2 py-0.5 rounded ${companyInput ? 'bg-blue-50 text-blue-700 font-medium' : 'bg-gray-200 text-gray-500'}`}>
             {companyInput || 'None'}
           </span>
        </div>
        <div className="flex items-center gap-1.5 whitespace-nowrap">
           <span className="font-bold text-gray-500">Role:</span>
           <span className={`px-2 py-0.5 rounded ${roleInput ? 'bg-purple-50 text-purple-700 font-medium' : 'bg-gray-200 text-gray-500'}`}>
             {roleInput || 'None'}
           </span>
        </div>
        <div className="h-4 w-px bg-gray-300 hidden sm:block"></div>
        <div className="flex items-center gap-1.5 whitespace-nowrap">
           <span className={`w-2 h-2 rounded-full ${jdText ? 'bg-green-500' : 'bg-gray-300'}`}></span>
           <span className="text-gray-600">{jdText ? 'JD Loaded' : 'No JD'}</span>
           {jdText && (
             <div className="flex items-center gap-1 ml-1">
               <button onClick={onViewJD} className="text-system-blue hover:underline">View</button>
               <span className="text-gray-300">|</span>
               <button onClick={onClearJD} className="text-red-500 hover:underline">Clear</button>
             </div>
           )}
        </div>
        <div className="flex items-center gap-1.5 whitespace-nowrap">
           <span className={`w-2 h-2 rounded-full ${resumeText ? 'bg-green-500' : 'bg-gray-300'}`}></span>
           <span className="text-gray-600">{resumeText ? 'Resume Loaded' : 'No Resume'}</span>
           {resumeText && (
             <div className="flex items-center gap-1 ml-1">
               <button onClick={onViewResume} className="text-system-blue hover:underline">View</button>
               <span className="text-gray-300">|</span>
               <button onClick={onClearResume} className="text-red-500 hover:underline">Clear</button>
             </div>
           )}
        </div>
      </div>
      <button onClick={handleClearChat} className="text-gray-400 hover:text-red-500 transition-colors whitespace-nowrap">
          Clear Chat
      </button>
    </div>
  );

  const renderSourcePill = (source: ChatSource) => {
      let color = 'bg-gray-100 text-gray-600';
      if (source.type === 'jd') color = 'bg-green-50 text-green-700 border-green-100';
      if (source.type === 'resume') color = 'bg-purple-50 text-purple-700 border-purple-100';
      if (source.type === 'web') color = 'bg-blue-50 text-blue-700 border-blue-100';

      return (
          <span className={`text-[10px] px-2 py-0.5 rounded border ${color} inline-flex items-center gap-1`}>
              {source.title}
          </span>
      );
  };

  return (
    <div className="bg-white rounded-3xl shadow-apple-card border border-white/60 overflow-hidden flex flex-col h-[600px] mt-8">
      {/* Header */}
      <div className="px-6 py-4 border-b border-gray-100 bg-gradient-to-r from-gray-50 to-white flex justify-between items-center">
        <div>
            <div className="flex items-center gap-2">
                <SparklesIcon className="w-5 h-5 text-system-blue" />
                <h2 className="text-lg font-bold text-gray-900">Ask Me Anything</h2>
                <span className="bg-gradient-to-r from-blue-600 to-purple-600 text-white text-[10px] font-bold px-2 py-0.5 rounded-full">BETA</span>
            </div>
            <p className="text-xs text-gray-500 mt-1">
                Chat with AI about this company, role, and your profile. <span className="hidden sm:inline">Answers are grounded in verified sources.</span>
            </p>
        </div>
      </div>

      {/* Context Strip */}
      {renderContextStatus()}

      {/* Legal Note */}
      {companyInput && (
          <div className="bg-yellow-50/50 px-4 py-2 text-[10px] text-yellow-800 border-b border-yellow-100/50 text-center">
              Responses are generated from public sources and your data. Not official company content. 
              <button onClick={onViewSources} className="underline ml-2 font-semibold">View sources</button>
          </div>
      )}

      {/* Chat Area */}
      <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6 bg-[#F9F9FB]">
        {messages.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center opacity-60">
                <div className="w-16 h-16 bg-white rounded-2xl shadow-sm flex items-center justify-center mb-4">
                    <span className="text-3xl">💬</span>
                </div>
                <h3 className="font-bold text-gray-900">No questions yet</h3>
                <p className="text-sm text-gray-500 max-w-xs mt-2">Ask about company culture, interview rounds, or how your resume matches the JD.</p>
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
                        
                        {/* Sources for AI messages */}
                        {msg.role === 'ai' && msg.sources && msg.sources.length > 0 && (
                            <div className="mt-3 pt-3 border-t border-gray-100 flex flex-wrap gap-2">
                                <span className="text-[10px] text-gray-400 font-bold uppercase self-center mr-1">Sources:</span>
                                {msg.sources.map((src, idx) => (
                                    <React.Fragment key={idx}>{renderSourcePill(src)}</React.Fragment>
                                ))}
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
        {/* Autosuggestions */}
        <div className="flex gap-2 overflow-x-auto hide-scrollbar mb-3 pb-1">
            {STARTER_QUESTIONS.map(q => (
                <button 
                    key={q} 
                    onClick={() => handleSend(q)}
                    disabled={isLoading || (!companyInput && !roleInput)}
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
                disabled={(!companyInput && !roleInput) || isLoading}
                placeholder={(!companyInput && !roleInput) ? "Select Company and Role first..." : "Ask a question..."}
                className="w-full bg-gray-50 border-0 rounded-xl pl-4 pr-12 py-3.5 text-sm font-medium focus:ring-2 focus:ring-system-blue/20 outline-none transition-all focus:bg-white disabled:opacity-60 disabled:cursor-not-allowed"
            />
            <button 
                onClick={() => handleSend()}
                disabled={!input.trim() || isLoading}
                className="absolute right-2 top-1/2 -translate-y-1/2 p-2 bg-system-blue text-white rounded-lg hover:bg-blue-600 disabled:opacity-50 disabled:bg-gray-300 transition-colors shadow-sm"
            >
                <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="22" y1="2" x2="11" y2="13"></line><polygon points="22 2 15 22 11 13 2 9 22 2"></polygon></svg>
            </button>
        </div>
        <p className="text-[10px] text-gray-400 mt-2 text-center">
            Answers are grounded only in your JD, resume (if available), and verified public sources. No guesses.
        </p>
      </div>
    </div>
  );
};
