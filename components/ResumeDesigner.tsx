
import React, { useState, useRef } from 'react';
import { createPortal } from 'react-dom';
import { StructuredResume, ResumeTemplateId } from '../types';
import { Camera, Download, Layout, X, Image as ImageIcon, Check, ChevronLeft, ChevronRight, FileText } from 'lucide-react';
import { ExecutiveTemplate } from './resume-templates/ExecutiveTemplate';
import { ModernTemplate } from './resume-templates/ModernTemplate';
import { CreativeTemplate } from './resume-templates/CreativeTemplate';
import { MinimalTemplate } from './resume-templates/MinimalTemplate';

interface ResumeDesignerProps {
  data: StructuredResume;
  onBack: () => void;
  originalResumeName?: string;
}

export const ResumeDesigner: React.FC<ResumeDesignerProps> = ({ data, onBack, originalResumeName }) => {
  const [selectedTemplate, setSelectedTemplate] = useState<ResumeTemplateId>('executive');
  const [photo, setPhoto] = useState<string | undefined>();
  const [isExporting, setIsExporting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const templates: { id: ResumeTemplateId; name: string; hasPhoto: boolean }[] = [
    { id: 'executive', name: 'The Executive', hasPhoto: false },
    { id: 'modern', name: 'The Modern', hasPhoto: true },
    { id: 'creative', name: 'The Creative', hasPhoto: true },
    { id: 'minimal', name: 'The Minimal', hasPhoto: false },
  ];

  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        setPhoto(event.target?.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handlePrint = () => {
    setIsExporting(true);
    // Simple way to print only the resume div
    const content = document.getElementById('resume-preview-container');
    if (!content) return;

    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    const styles = Array.from(document.querySelectorAll('style, link[rel="stylesheet"]'))
      .map(s => s.outerHTML)
      .join('');

    printWindow.document.write(`
      <html>
        <head>
          <title>Resume - ${data.basics.name}</title>
          ${styles}
          <style>
            @page {
              size: A4;
              margin: 10mm;
            }
            body {
              margin: 0;
              padding: 0;
              -webkit-print-color-adjust: exact !important;
              print-color-adjust: exact !important;
            }
            .printable-content {
              width: 210mm;
              padding-top: 10mm;
              padding-bottom: 20mm;
            }
            @media print {
              .page-break-inside-avoid {
                page-break-inside: avoid;
              }
              body {
                background: white;
              }
              .printable-content {
                 box-shadow: none !important;
              }
            }
          </style>
        </head>
        <body>
          <div class="printable-content">
            ${content.innerHTML}
          </div>
        </body>
      </html>
    `);

    printWindow.document.close();
    
    // Wait for assets to load
    setTimeout(() => {
      printWindow.print();
      setIsExporting(false);
    }, 1000);
  };

  const renderTemplate = () => {
    switch (selectedTemplate) {
      case 'executive': return <ExecutiveTemplate data={data} />;
      case 'modern': return <ModernTemplate data={data} photo={photo} />;
      case 'creative': return <CreativeTemplate data={data} photo={photo} />;
      case 'minimal': return <MinimalTemplate data={data} />;
      default: return <ExecutiveTemplate data={data} />;
    }
  };

  return createPortal(
    <div className="fixed inset-0 z-[999] bg-gray-50 flex flex-col md:flex-row overflow-hidden animate-in fade-in duration-300">
      {/* Control Panel */}
      <aside className="w-full md:w-[380px] bg-white border-r border-gray-200 flex flex-col shadow-xl z-20">
        <div className="p-6 border-b border-gray-100 flex items-center justify-between bg-white sticky top-0">
          <button 
            onClick={onBack}
            className="p-2 hover:bg-gray-100 rounded-full transition-colors"
          >
            <ChevronLeft className="w-6 h-6 text-gray-500" />
          </button>
          <h2 className="text-xl font-black text-gray-900 tracking-tight">Resume Designer</h2>
          <div className="w-10"></div>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-8 scrollbar-hide">
          {/* Template Selection */}
          <section>
            <h3 className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] mb-4">Choose Template</h3>
            <div className="grid grid-cols-2 gap-3">
              {templates.map((t) => (
                <button
                  key={t.id}
                  onClick={() => setSelectedTemplate(t.id)}
                  className={`relative p-3 rounded-2xl border-2 transition-all text-left ${
                    selectedTemplate === t.id 
                    ? 'border-blue-600 bg-blue-50/50' 
                    : 'border-gray-100 hover:border-gray-200'
                  }`}
                >
                  <div className={`w-full aspect-[3/4] rounded-lg mb-2 shadow-sm border border-gray-100 flex items-center justify-center overflow-hidden transition-transform ${selectedTemplate === t.id ? 'scale-[1.02]' : ''}`}>
                     <div className="p-1 bg-white w-full h-full">
                        {/* Miniature Preview Icon/Placeholder */}
                        <div className="w-full h-full bg-slate-50 flex flex-col p-1 gap-1">
                            <div className="h-2 w-1/2 bg-slate-200" />
                            <div className="h-1 w-full bg-slate-100" />
                            <div className="h-1 w-full bg-slate-100" />
                            <div className="mt-2 h-10 w-full bg-slate-100" />
                        </div>
                     </div>
                  </div>
                  <span className={`text-xs font-bold ${selectedTemplate === t.id ? 'text-blue-600' : 'text-gray-600'}`}>{t.name}</span>
                  {selectedTemplate === t.id && (
                    <div className="absolute top-2 right-2 bg-blue-600 text-white rounded-full p-1">
                      <Check className="w-3 h-3" />
                    </div>
                  )}
                </button>
              ))}
            </div>
          </section>

          {/* Configuration */}
          <section className="space-y-6">
            <h3 className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em]">Customize</h3>
            
            {templates.find(t => t.id === selectedTemplate)?.hasPhoto && (
              <div className="p-6 bg-slate-50 rounded-3xl border border-dashed border-gray-300">
                <div className="flex flex-col items-center text-center">
                  {photo ? (
                    <div className="relative mb-4 group">
                      <div className="w-24 h-24 rounded-2xl overflow-hidden shadow-lg">
                        <img src={photo} alt="Profile" className="w-full h-full object-cover" />
                      </div>
                      <button 
                        onClick={() => setPhoto(undefined)}
                        className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1 shadow-md opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  ) : (
                    <div className="w-16 h-16 bg-white rounded-2xl flex items-center justify-center mb-4 shadow-sm">
                      <ImageIcon className="w-8 h-8 text-gray-300" />
                    </div>
                  )}
                  <h4 className="text-sm font-bold text-gray-900 mb-1">{photo ? 'Photo Added' : 'Add Profile Photo'}</h4>
                  <p className="text-[10px] text-gray-500 mb-4 px-4 uppercase font-bold tracking-widest">Recommended: Square crop, high quality</p>
                  <button 
                    onClick={() => fileInputRef.current?.click()}
                    className="flex items-center gap-2 px-6 py-2 bg-white border border-gray-200 rounded-xl text-xs font-bold text-gray-700 hover:bg-gray-100 transition-all shadow-sm"
                  >
                    <Camera className="w-4 h-4 text-blue-600" />
                    {photo ? 'Change Photo' : 'Upload Image'}
                  </button>
                  <input 
                    type="file" 
                    ref={fileInputRef} 
                    onChange={handlePhotoUpload} 
                    accept="image/*" 
                    className="hidden" 
                  />
                </div>
              </div>
            )}

            <div className="p-4 bg-blue-50/50 rounded-2xl border border-blue-100">
                <div className="flex items-start gap-3">
                    <FileText className="w-4 h-4 text-blue-600 mt-0.5" />
                    <div>
                        <p className="text-xs font-bold text-blue-800 mb-1">A4 Smart Paging</p>
                        <p className="text-[10px] text-blue-600/70 font-medium leading-relaxed uppercase">Resume will automatically adjust to 1, 2, or 3 pages based on content length while maintaining A4 margins.</p>
                    </div>
                </div>
            </div>
          </section>
        </div>

        <div className="p-6 border-t border-gray-100 bg-white">
          <button 
            onClick={handlePrint}
            disabled={isExporting}
            className="w-full py-4 bg-blue-600 text-white font-black rounded-2xl shadow-xl hover:bg-blue-700 active:scale-[0.98] transition-all flex items-center justify-center gap-2"
          >
            {isExporting ? <span className="animate-spin text-xl">◌</span> : <Download className="w-5 h-5" />}
            {isExporting ? 'Generating PDF...' : 'Download Resume'}
          </button>
        </div>
      </aside>

      {/* Preview Area */}
      <main className="flex-1 overflow-y-auto bg-gray-200/50 p-4 md:p-12 scrollbar-hide flex flex-col items-center">
        <div className="bg-white/50 px-4 py-2 rounded-full border border-white mb-6 backdrop-blur-sm self-center">
           <p className="text-[10px] font-black text-gray-400 uppercase tracking-[0.3em]">Live A4 Preview</p>
        </div>
        
        <div 
          id="resume-preview-container"
          className="shadow-2xl mb-20 origin-top transition-transform duration-500 scale-[0.85] md:scale-100"
        >
          {renderTemplate()}
        </div>
      </main>
    </div>,
    document.body
  );
};
