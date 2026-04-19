
import React from 'react';
import { StructuredResume } from '../../types';

interface TemplateProps {
  data: StructuredResume;
  photo?: string;
}

export const MinimalTemplate: React.FC<TemplateProps> = ({ data }) => {
  return (
    <div className="bg-white min-h-[297mm] p-[30mm] font-serif printable-content">
      <header className="mb-16 flex justify-between items-start border-b border-gray-100 pb-10">
        <div>
          <h1 className="text-4xl text-gray-900 mb-2 font-light tracking-tight">{data.basics.name}</h1>
          <p className="text-sm text-gray-500 uppercase tracking-[0.2em] font-sans font-bold">{data.basics.label}</p>
        </div>
        <div className="text-right space-y-1 text-xs text-gray-400 font-sans font-medium uppercase tracking-widest">
          <p>{data.basics.phone}</p>
          <p>{data.basics.email}</p>
          <p>{data.basics.location.city}, {data.basics.location.countryCode}</p>
          {data.basics.url && <p className="text-blue-500 hover:underline"><a href={data.basics.url} target="_blank" rel="noopener noreferrer">{data.basics.url.replace(/^https?:\/\//, '')}</a></p>}
        </div>
      </header>

      <section className="mb-16">
        <h2 className="text-[11px] font-sans font-black text-gray-300 uppercase tracking-[0.4em] mb-6">Profile</h2>
        <p className="text-sm leading-relaxed text-gray-700 italic max-w-2xl">{data.basics.summary}</p>
      </section>

      <section className="mb-16">
        <h2 className="text-[11px] font-sans font-black text-gray-300 uppercase tracking-[0.4em] mb-10">Work Experience</h2>
        <div className="space-y-12">
          {data.work.map((job, i) => (
            <div key={i} className="relative pl-8 border-l border-gray-100 page-break-inside-avoid">
              <div className="absolute -left-[5px] top-1.5 w-[9px] h-[9px] bg-white border border-gray-100 rounded-full" />
              <div className="flex justify-between items-baseline mb-4">
                <h3 className="text-base text-gray-900 font-medium">{job.company}<span className="mx-3 text-gray-100 font-sans font-light">|</span><span className="text-gray-500">{job.position}</span></h3>
                <span className="text-[10px] font-sans font-bold text-gray-400 uppercase tracking-widest">{job.startDate} — {job.endDate}</span>
              </div>
              <ul className="space-y-2">
                {job.highlights.map((point, j) => (
                  <li key={j} className="text-[13px] text-gray-600 leading-relaxed font-sans">{point}</li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </section>

      <div className="grid grid-cols-2 gap-20">
        <section>
          <h2 className="text-[11px] font-sans font-black text-gray-300 uppercase tracking-[0.4em] mb-8">Education</h2>
          <div className="space-y-8">
            {data.education.map((edu, i) => (
              <div key={i} className="page-break-inside-avoid">
                <h3 className="text-sm text-gray-900 font-bold mb-1">{edu.institution}</h3>
                <p className="text-xs text-gray-500 font-sans uppercase tracking-wider mb-1">{edu.studyType}</p>
                <p className="text-[10px] text-gray-400 font-sans">{edu.startDate} — {edu.endDate}</p>
              </div>
            ))}
          </div>
        </section>

        <section>
          <h2 className="text-[11px] font-sans font-black text-gray-300 uppercase tracking-[0.4em] mb-8">Expertise</h2>
          <div className="grid grid-cols-1 gap-2">
            {data.skills.map((skill, i) => (
              <div key={i} className="text-xs text-gray-600 font-sans flex items-center gap-3">
                <span className="w-1 h-1 bg-gray-200 rounded-full" />
                {skill.name}
              </div>
            ))}
          </div>
        </section>
      </div>

      <div className="mt-16 grid grid-cols-1 gap-12">
        {data.projects && data.projects.length > 0 && (
            <section>
                <h2 className="text-[11px] font-sans font-black text-gray-300 uppercase tracking-[0.4em] mb-8">Projects</h2>
                <div className="space-y-8">
                    {data.projects.map((proj, i) => (
                        <div key={i} className="page-break-inside-avoid">
                            <h3 className="text-sm text-gray-900 font-bold mb-2 underline decoration-gray-100 underline-offset-4">{proj.name}</h3>
                            <ul className="grid grid-cols-1 gap-2">
                                {proj.highlights.map((h, j) => (
                                    <li key={j} className="text-[13px] text-gray-500 font-sans flex items-start gap-4">
                                        <span className="text-gray-200 mt-1">/</span>
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
                <h2 className="text-[11px] font-sans font-black text-gray-300 uppercase tracking-[0.4em] mb-8">Community</h2>
                <div className="grid grid-cols-2 gap-8">
                    {data.volunteer.map((vol, i) => (
                        <div key={i} className="page-break-inside-avoid">
                            <h3 className="text-xs text-gray-900 font-bold uppercase">{vol.organization}</h3>
                            <p className="text-xs text-gray-400 mt-1 italic">{vol.position}</p>
                        </div>
                    ))}
                </div>
            </section>
        )}
      </div>
    </div>
  );
};
