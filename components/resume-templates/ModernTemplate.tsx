
import React from 'react';
import { StructuredResume } from '../../types';

interface TemplateProps {
  data: StructuredResume;
  photo?: string;
}

export const ModernTemplate: React.FC<TemplateProps> = ({ data, photo }) => {
  return (
    <div className="bg-[#FAF9F5] min-h-[297mm] shadow-sm font-sans text-gray-800 flex printable-content">
      {/* Sidebar */}
      <aside className="w-[80mm] bg-[#F2F0E9] p-8 border-r border-[#E6E2D8] flex flex-col items-center shrink-0">
        {photo && (
          <div className="w-32 h-32 rounded-full overflow-hidden mb-6 border-4 border-white shadow-md">
            <img src={photo} alt={data.basics.name} className="w-full h-full object-cover" />
          </div>
        )}
        
        <div className="w-full text-center mb-8">
            <h1 className="text-2xl font-black text-[#2D3142] leading-tight mb-1 uppercase">{data.basics.name.split(' ')[0]}<br/>{data.basics.name.split(' ').slice(1).join(' ')}</h1>
            <p className="text-xs font-bold text-[#4F5D75] tracking-widest uppercase">{data.basics.label}</p>
        </div>

        <div className="w-full space-y-6">
            <section>
                <h2 className="text-[10px] font-black text-[#BFC0C0] uppercase tracking-[0.2em] mb-3">Contact</h2>
                <div className="space-y-2 text-xs text-[#4F5D75] font-medium">
                    <p className="break-all">{data.basics.email}</p>
                    <p>{data.basics.phone}</p>
                    <p>{data.basics.location.city}, {data.basics.location.countryCode}</p>
                    {data.basics.url && (
                        <p className="text-[#EF8354] font-bold break-all">
                            <a href={data.basics.url} target="_blank" rel="noopener noreferrer">{data.basics.url.replace(/^https?:\/\//, '')}</a>
                        </p>
                    )}
                </div>
            </section>

            <section>
                <h2 className="text-[10px] font-black text-[#BFC0C0] uppercase tracking-[0.2em] mb-3">Highlights</h2>
                <div className="space-y-4">
                    {data.awards && data.awards.length > 0 && (
                        <div>
                            <p className="text-[9px] font-black text-[#EF8354] uppercase tracking-wider mb-1">Awards</p>
                            <ul className="space-y-1">
                                {data.awards.map((aw, i) => (
                                    <li key={i} className="text-[10px] text-[#4F5D75] font-bold leading-tight">{aw.title}</li>
                                ))}
                            </ul>
                        </div>
                    )}
                    {data.publications && data.publications.length > 0 && (
                        <div>
                            <p className="text-[9px] font-black text-[#EF8354] uppercase tracking-wider mb-1">Publications</p>
                            <ul className="space-y-1">
                                {data.publications.map((pb, i) => (
                                    <li key={i} className="text-[10px] text-[#4F5D75] font-bold leading-tight">{pb.name}</li>
                                ))}
                            </ul>
                        </div>
                    )}
                </div>
            </section>

            <section>
                <h2 className="text-[10px] font-black text-[#BFC0C0] uppercase tracking-[0.2em] mb-3">Relevant Skills</h2>
                <ul className="space-y-1.5">
                    {data.skills.slice(0, 8).map((skill, i) => (
                        <li key={i} className="text-xs text-[#4F5D75] font-bold flex items-center gap-2">
                           <span className="w-1.5 h-1.5 bg-[#EF8354] rounded-full" />
                           {skill.name}
                        </li>
                    ))}
                </ul>
            </section>

            {data.languages && data.languages.length > 0 && (
              <section>
                  <h2 className="text-[10px] font-black text-[#BFC0C0] uppercase tracking-[0.2em] mb-3">Languages</h2>
                  <div className="space-y-2">
                      {data.languages.map((l, i) => (
                          <div key={i} className="flex justify-between items-center">
                              <span className="text-xs text-[#4F5D75] font-bold">{l.language}</span>
                              <span className="text-[10px] text-[#BFC0C0] italic">{l.fluency}</span>
                          </div>
                      ))}
                  </div>
              </section>
            )}
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 p-10 bg-white">
        <section className="mb-10">
            <div className="flex items-center gap-4 mb-4">
                <div className="h-0.5 flex-1 bg-[#EF8354]" />
                <h2 className="text-[11px] font-black text-[#BFC0C0] uppercase tracking-[0.3em] shrink-0">Professional Summary</h2>
            </div>
            <p className="text-sm leading-relaxed text-[#4F5D75] italic">"{data.basics.summary}"</p>
        </section>

        <section className="mb-10">
            <div className="flex items-center gap-4 mb-6">
                <div className="h-0.5 flex-1 bg-[#EF8354]" />
                <h2 className="text-[11px] font-black text-[#BFC0C0] uppercase tracking-[0.3em] shrink-0">Work Experience</h2>
            </div>
            <div className="space-y-8 relative pl-4 border-l border-[#EF8354]">
                {data.work.map((job, i) => (
                    <div key={i} className="relative page-break-inside-avoid">
                        <div className="absolute -left-[21px] top-1 w-3 h-3 bg-white border-2 border-[#EF8354] rounded-full" />
                        <div className="mb-3">
                            <h3 className="text-base font-black text-[#2D3142] mb-0.5">{job.position}</h3>
                            <p className="text-sm font-bold text-[#EF8354]">{job.company}</p>
                            <p className="text-[10px] font-black text-[#BFC0C0] uppercase tracking-wider">{job.startDate} — {job.endDate}</p>
                        </div>
                        <ul className="space-y-2">
                            {job.highlights.map((point, j) => (
                                <li key={j} className="text-sm text-[#4F5D75] leading-relaxed flex items-start gap-2">
                                    <span className="mt-1.5 w-1 h-1 bg-[#BFC0C0] rounded-full shrink-0" />
                                    {point}
                                </li>
                            ))}
                        </ul>
                    </div>
                ))}
            </div>
        </section>

        <section className="mb-10">
            <div className="flex items-center gap-4 mb-6">
                <div className="h-0.5 flex-1 bg-[#EF8354]" />
                <h2 className="text-[11px] font-black text-[#BFC0C0] uppercase tracking-[0.3em] shrink-0">Education</h2>
            </div>
            <div className="space-y-6">
                {data.education.map((edu, i) => (
                    <div key={i} className="page-break-inside-avoid">
                        <h3 className="text-sm font-black text-[#2D3142]">{edu.institution}</h3>
                        <p className="text-xs font-bold text-[#4F5D75]">{edu.studyType} in {edu.area}</p>
                        <p className="text-[10px] font-black text-[#BFC0C0] uppercase">{edu.startDate} — {edu.endDate}</p>
                    </div>
                ))}
            </div>
        </section>

        {data.projects && data.projects.length > 0 && (
            <section className="mb-10">
                <div className="flex items-center gap-4 mb-6">
                    <div className="h-0.5 flex-1 bg-[#EF8354]" />
                    <h2 className="text-[11px] font-black text-[#BFC0C0] uppercase tracking-[0.3em] shrink-0">Projects</h2>
                </div>
                <div className="space-y-6">
                    {data.projects.map((proj, i) => (
                        <div key={i} className="page-break-inside-avoid">
                            <h3 className="text-[13px] font-black text-[#2D3142] uppercase">{proj.name}</h3>
                            <p className="text-[10px] text-[#EF8354] font-black uppercase mb-2">{proj.startDate} — {proj.endDate}</p>
                            <ul className="space-y-1">
                                {proj.highlights.map((h, j) => (
                                    <li key={j} className="text-xs text-[#4F5D75] flex gap-2">
                                        <span className="mt-1.5 w-1 h-1 bg-[#EF8354] rounded-full shrink-0" />
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
                <div className="flex items-center gap-4 mb-6">
                    <div className="h-0.5 flex-1 bg-[#EF8354]" />
                    <h2 className="text-[11px] font-black text-[#BFC0C0] uppercase tracking-[0.3em] shrink-0">Volunteer Experience</h2>
                </div>
                <div className="space-y-6">
                    {data.volunteer.map((vol, i) => (
                        <div key={i} className="page-break-inside-avoid">
                            <h3 className="text-xs font-black text-[#2D3142]">{vol.position} @ {vol.organization}</h3>
                            <p className="text-[10px] text-[#4F5D75] font-medium">{vol.startDate} — {vol.endDate}</p>
                        </div>
                    ))}
                </div>
            </section>
        )}
      </main>
    </div>
  );
};
