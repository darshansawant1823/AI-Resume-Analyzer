import React, { useRef } from 'react';
import { UploadIcon } from './icons/UploadIcon';

interface ResumeUploaderProps {
  file: File | null;
  onFileChange: (file: File | null) => void;
}

export const ResumeUploader: React.FC<ResumeUploaderProps> = ({ file, onFileChange }) => {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (files && files.length > 0) onFileChange(files[0]);
  };

  const handleDragOver = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
  };

  const handleDrop = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    const files = event.dataTransfer.files;
    if (files && files.length > 0) {
      onFileChange(files[0]);
      if (fileInputRef.current) fileInputRef.current.files = files;
    }
  };
  
  const handleRemoveFile = () => {
    onFileChange(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  }

  return (
    <div className="space-y-3">
      <label className="block text-lg font-semibold text-gray-900 tracking-tight">
        Your Resume
      </label>
      <div
        onDragOver={handleDragOver}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
        className={`relative mt-1 flex flex-col justify-center items-center px-6 py-10 border-2 border-dashed rounded-2xl transition-all duration-300 cursor-pointer group ${
          file 
            ? 'border-system-blue/30 bg-blue-50/30' 
            : 'border-gray-200 bg-gray-50/30 hover:bg-gray-50 hover:border-gray-300'
        }`}
      >
        <div className="space-y-3 text-center transition-transform duration-300 group-hover:-translate-y-1">
          {file ? (
             <div className="w-16 h-16 mx-auto bg-white rounded-xl shadow-sm border border-gray-100 flex items-center justify-center text-system-blue">
                <svg xmlns="http://www.w3.org/2000/svg" className="w-8 h-8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg>
             </div>
          ) : (
             <div className="w-16 h-16 mx-auto bg-white rounded-full shadow-sm flex items-center justify-center text-system-blue group-hover:scale-110 transition-transform">
                <UploadIcon className="h-7 w-7" />
             </div>
          )}
          
          <div className="text-sm text-gray-600">
            {file ? (
                <div className="flex flex-col items-center gap-1">
                    <span className="font-semibold text-gray-900 text-base">{file.name}</span>
                    <span className="text-xs text-gray-400 uppercase font-medium">Ready to Analyze</span>
                </div>
            ) : (
                <>
                    <p className="font-medium text-gray-900">Click to upload or drag and drop</p>
                    <p className="text-gray-400 mt-1">PDF, Images, or Text files</p>
                </>
            )}
          </div>
        </div>

        {file && (
            <button 
                onClick={(e) => { e.stopPropagation(); handleRemoveFile(); }} 
                className="absolute top-3 right-3 p-2 bg-white rounded-full shadow-sm text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors"
            >
                <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
            </button>
        )}

        <input
          id="resume-upload"
          ref={fileInputRef}
          name="resume-upload"
          type="file"
          className="sr-only"
          onChange={handleFileChange}
          accept=".pdf,.png,.jpg,.jpeg,.txt,.md"
        />
      </div>
    </div>
  );
};