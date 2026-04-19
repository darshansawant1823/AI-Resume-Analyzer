
import React from 'react';
import { StructuredResume } from '../../types';

interface TemplateProps {
  data: StructuredResume;
  photo?: string;
}

export const CreativeTemplate: React.FC<TemplateProps> = ({ data, photo }) => {
  return (
    <div className="bg-[#E9E9E9] min-h-[297mm] p-6 printable-content">
      <div className="bg-white min-h-[calc(297mm-3rem)] border-[12px] border-blue-600 p-10 flex flex-col">
        <header className="flex gap-8 items-center mb-12 border-b-2 border-slate-100 pb-8">
            {photo && (
                <div className="w-40 h-40 shrink-0 bg-slate-100 border-2 border-blue-600 grayscale">
                    <img src={photo} alt={data.basics.name} className="w-full h-full object-cover" />
                </div>
            )}
            <div className="flex-1">
                <h1 className="text-5xl font-black text-blue-600 tracking-tighter uppercase leading-none mb-3">{data.basics.name}</h1>
                <h2 className="text-xl font-bold text-slate-800 tracking-tight mb-4 uppercase">{data.basics.label}</h2>
                <div className="flex flex-wrap gap-x-6 gap-y-2 text-xs font-bold text-slate-400">
                    <div className="flex items-center gap-2 underline underline-offset-4 decoration-blue-600/30">
                        {data.basics.email}
                    </div>
                    <div className="flex items-center gap-2 underline underline-offset-4 decoration-blue-600/30">
                        {data.basics.phone}
                    </div>
                    {data.basics.url && (
                        <div className="flex items-center gap-2 underline underline-offset-4 decoration-blue-600/30">
                            <a href={data.basics.url} target="_blank" rel="noopener noreferrer">{data.basics.url.replace(/^https?:\/\//, '')}</a>
                        </div>
                    )}
                </div>
            </div>
        </header>

        <div className="flex-1 grid grid-cols-12 gap-10">
            <div className="col-span-4 space-y-10">
                <section>
                    <h3 className="text-sm font-black text-blue-600 uppercase tracking-widest border-b-2 border-blue-600 pb-1 mb-4">About Me</h3>
                    <p className="text-sm leading-relaxed text-slate-600 font-medium">{data.basics.summary}</p>
                </section>

                <section>
                    <h3 className="text-sm font-black text-blue-600 uppercase tracking-widest border-b-2 border-blue-600 pb-1 mb-4">Skills</h3>
                    <div className="space-y-4">
                        {data.skills.map((skill, i) => (
                            <div key={i}>
                                <div className="flex justify-between items-center mb-1">
                                    <span className="text-xs font-black text-slate-800 uppercase">{skill.name}</span>
                                </div>
                                <div className="h-1.5 bg-slate-100 w-full overflow-hidden">
                                    <div className="h-full bg-blue-600" style={{ width: `${Math.floor(Math.random() * 40) + 60}%` }} />
                                </div>
                            </div>
                        ))}
                    </div>
                </section>

                {data.languages && data.languages.length > 0 && (
                    <section>
                        <h3 className="text-sm font-black text-blue-600 uppercase tracking-widest border-b-2 border-blue-600 pb-1 mb-4">Languages</h3>
                        <div className="space-y-3">
                            {data.languages.map((l, i) => (
                                <div key={i} className="flex justify-between items-baseline">
                                    <span className="text-xs font-bold text-slate-800">{l.language}</span>
                                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-tighter">{l.fluency}</span>
                                </div>
                            ))}
                        </div>
                    </section>
                )}
            </div>

            <div className="col-span-8 space-y-10 border-l border-slate-100 pl-10">
                <section>
                    <h3 className="text-sm font-black text-blue-600 uppercase tracking-widest border-b-2 border-blue-600 pb-1 mb-6">Experience</h3>
                    <div className="space-y-8">
                        {data.work.map((job, i) => (
                            <div key={i} className="page-break-inside-avoid">
                                <div className="flex justify-between items-center mb-1">
                                    <h4 className="text-base font-black text-slate-900 uppercase tracking-tight">{job.position}</h4>
                                    <span className="text-[10px] font-black text-slate-300 uppercase">{job.startDate} — {job.endDate}</span>
                                </div>
                                <p className="text-xs font-bold text-blue-600 uppercase tracking-widest mb-3">{job.company}</p>
                                <p className="text-sm leading-relaxed text-slate-600 mb-2">{job.summary}</p>
                                <ul className="space-y-1.5">
                                    {job.highlights.map((point, j) => (
                                        <li key={j} className="text-xs text-slate-500 flex gap-2">
                                            <span className="text-blue-600">•</span>
                                            {point}
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        ))}
                    </div>
                </section>

                <section>
                    <h3 className="text-sm font-black text-blue-600 uppercase tracking-widest border-b-2 border-blue-600 pb-1 mb-6">Education</h3>
                    <div className="space-y-6">
                        {data.education.map((edu, i) => (
                            <div key={i} className="page-break-inside-avoid">
                                <div className="flex justify-between items-baseline mb-1">
                                    <h4 className="text-sm font-black text-slate-800 uppercase tracking-tight">{edu.institution}</h4>
                                    <span className="text-[10px] font-black text-slate-300 uppercase">{edu.startDate} — {edu.endDate}</span>
                                </div>
                                <p className="text-xs font-bold text-blue-600 uppercase tracking-widest">{edu.studyType} in {edu.area}</p>
                            </div>
                        ))}
                    </div>
                </section>

                {data.projects && data.projects.length > 0 && (
                    <section>
                        <h3 className="text-sm font-black text-blue-600 uppercase tracking-widest border-b-2 border-blue-600 pb-1 mb-6">Key Projects</h3>
                        <div className="space-y-8">
                            {data.projects.map((proj, i) => (
                                <div key={i} className="page-break-inside-avoid">
                                    <h4 className="text-sm font-black text-slate-900 uppercase mb-2">{proj.name}</h4>
                                    <p className="text-xs leading-relaxed text-slate-600 mb-2">{proj.summary}</p>
                                    <ul className="space-y-1">
                                        {proj.highlights.map((h, j) => (
                                            <li key={j} className="text-xs text-slate-500 flex gap-2">
                                                <span className="text-blue-600">›</span>
                                                {h}
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                            ))}
                        </div>
                    </section>
                )}

                {data.volunteer && data.volunteer.length > 0 && (
                    <section>
                        <h3 className="text-sm font-black text-blue-600 uppercase tracking-widest border-b-2 border-blue-600 pb-1 mb-6">Service</h3>
                        <div className="space-y-6">
                            {data.volunteer.map((vol, i) => (
                                <div key={i} className="page-break-inside-avoid">
                                    <h4 className="text-xs font-black text-slate-800 uppercase">{vol.position} @ {vol.organization}</h4>
                                    <p className="text-[10px] font-bold text-blue-600 uppercase">{vol.startDate} — {vol.endDate}</p>
                                </div>
                            ))}
                        </div>
                    </section>
                )}
            </div>
        </div>

        <footer className="mt-auto pt-8 border-t border-slate-100 flex justify-between text-[10px] font-black text-slate-300 uppercase tracking-[0.2em]">
            <span>Powered by Resume AI</span>
            <span>{data.basics.name} • {new Date().getFullYear()}</span>
        </footer>
      </div>
    </div>
  );
};
