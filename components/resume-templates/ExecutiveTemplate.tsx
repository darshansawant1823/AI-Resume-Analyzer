
import React from 'react';
import { StructuredResume } from '../../types';

interface TemplateProps {
  data: StructuredResume;
  photo?: string;
}

export const ExecutiveTemplate: React.FC<TemplateProps> = ({ data }) => {
  return (
    <div className="bg-white p-[15mm] md:p-[20mm] min-h-[297mm] shadow-sm font-sans text-gray-800 printable-content flex flex-col">
      <header className="text-center border-b-2 border-slate-200 pb-6 mb-8">
        <h1 className="text-3xl font-bold text-slate-900 uppercase tracking-tight mb-2">{data.basics.name}</h1>
        <p className="text-lg text-slate-600 font-medium mb-3">{data.basics.label}</p>
        <div className="flex flex-wrap justify-center gap-x-4 gap-y-2 text-sm text-slate-500 font-medium">
          <span>{data.basics.email}</span>
          <span>•</span>
          <span>{data.basics.phone}</span>
          {data.basics.location && (
            <>
              <span>•</span>
              <span>{data.basics.location.city}, {data.basics.location.countryCode}</span>
            </>
          )}
          {data.basics.url && (
            <>
              <span>•</span>
              <a href={data.basics.url} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">{data.basics.url.replace(/^https?:\/\//, '')}</a>
            </>
          )}
        </div>
      </header>

      <section className="mb-8">
        <h2 className="text-sm font-bold text-slate-900 uppercase tracking-widest mb-3 bg-slate-50 px-3 py-1.5 border-l-4 border-slate-800">Professional Summary</h2>
        <p className="text-sm leading-relaxed text-slate-700">{data.basics.summary}</p>
      </section>

      <section className="mb-8">
        <h2 className="text-sm font-bold text-slate-900 uppercase tracking-widest mb-4 bg-slate-50 px-3 py-1.5 border-l-4 border-slate-800">Work Experience</h2>
        <div className="space-y-6">
          {data.work.map((job, i) => (
            <div key={i} className="page-break-inside-avoid">
              <div className="flex justify-between items-baseline mb-1">
                <h3 className="font-bold text-slate-900 text-base">{job.position}</h3>
                <span className="text-xs font-bold text-slate-500 uppercase">{job.startDate} – {job.endDate}</span>
              </div>
              <p className="text-sm font-bold text-slate-600 mb-2">{job.company}</p>
              <ul className="list-disc list-outside ml-4 space-y-1.5">
                {job.highlights.map((point, j) => (
                  <li key={j} className="text-sm text-slate-700 leading-snug">{point}</li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </section>

      <section className="mb-8">
        <h2 className="text-sm font-bold text-slate-900 uppercase tracking-widest mb-4 bg-slate-50 px-3 py-1.5 border-l-4 border-slate-800">Education</h2>
        <div className="space-y-4">
          {data.education.map((edu, i) => (
            <div key={i} className="flex justify-between items-baseline">
              <div>
                <h3 className="font-bold text-slate-900 text-sm">{edu.institution}</h3>
                <p className="text-xs text-slate-600 font-medium">{edu.studyType} in {edu.area}</p>
              </div>
              <span className="text-xs font-bold text-slate-500 uppercase">{edu.startDate} – {edu.endDate}</span>
            </div>
          ))}
        </div>
      </section>

      <section>
        <h2 className="text-sm font-bold text-slate-900 uppercase tracking-widest mb-4 bg-slate-50 px-3 py-1.5 border-l-4 border-slate-800">Key Skills</h2>
        <div className="grid grid-cols-3 gap-y-3 gap-x-6">
          {data.skills.map((skill, i) => (
            <div key={i}>
              <p className="text-xs font-bold text-slate-900 mb-1">{skill.name}</p>
              <div className="flex flex-wrap gap-1">
                {skill.keywords.map((kw, j) => (
                  <span key={j} className="text-[10px] text-slate-600">{kw}{j < skill.keywords.length - 1 ? ',' : ''}</span>
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>

      {data.projects && data.projects.length > 0 && (
        <section className="mt-8">
          <h2 className="text-sm font-bold text-slate-900 uppercase tracking-widest mb-4 bg-slate-50 px-3 py-1.5 border-l-4 border-slate-800">Notable Projects</h2>
          <div className="space-y-4">
            {data.projects.map((proj, i) => (
              <div key={i} className="page-break-inside-avoid">
                <div className="flex justify-between items-baseline mb-1">
                  <h3 className="font-bold text-slate-900 text-sm">{proj.name}</h3>
                  <span className="text-[10px] font-bold text-slate-400 uppercase">{proj.startDate} – {proj.endDate}</span>
                </div>
                {proj.summary && <p className="text-xs text-slate-600 mb-2 italic">{proj.summary}</p>}
                <ul className="list-disc list-outside ml-4 space-y-1">
                  {proj.highlights.map((h, j) => (
                    <li key={j} className="text-xs text-slate-700">{h}</li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </section>
      )}

      {data.volunteer && data.volunteer.length > 0 && (
        <section className="mt-8">
          <h2 className="text-sm font-bold text-slate-900 uppercase tracking-widest mb-4 bg-slate-50 px-3 py-1.5 border-l-4 border-slate-800">Volunteer Experience</h2>
          <div className="space-y-4">
            {data.volunteer.map((vol, i) => (
              <div key={i} className="page-break-inside-avoid">
                <div className="flex justify-between items-baseline mb-1">
                  <h3 className="font-bold text-slate-900 text-sm">{vol.position} – {vol.organization}</h3>
                  <span className="text-[10px] font-bold text-slate-400 uppercase">{vol.startDate} – {vol.endDate}</span>
                </div>
                <ul className="list-disc list-outside ml-4 space-y-1">
                  {vol.highlights.map((h, j) => (
                    <li key={j} className="text-xs text-slate-700">{h}</li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </section>
      )}

      {(data.awards && data.awards.length > 0) || (data.publications && data.publications.length > 0) ? (
        <div className="grid grid-cols-2 gap-8 mt-8">
          {data.awards && data.awards.length > 0 && (
            <section>
              <h2 className="text-sm font-bold text-slate-900 uppercase tracking-widest mb-4 bg-slate-50 px-3 py-1.5 border-l-4 border-slate-800">Awards & Honors</h2>
              <ul className="space-y-3">
                {data.awards.map((aw, i) => (
                  <li key={i} className="text-xs text-slate-700">
                    <span className="font-bold block text-slate-900">{aw.title}</span>
                    <span className="text-slate-500 italic">{aw.awarder} | {aw.date}</span>
                  </li>
                ))}
              </ul>
            </section>
          )}
          {data.publications && data.publications.length > 0 && (
            <section>
              <h2 className="text-sm font-bold text-slate-900 uppercase tracking-widest mb-4 bg-slate-50 px-3 py-1.5 border-l-4 border-slate-800">Publications</h2>
              <ul className="space-y-3">
                {data.publications.map((pb, i) => (
                  <li key={i} className="text-xs text-slate-700">
                    <span className="font-bold block text-slate-900">{pb.name}</span>
                    <span className="text-slate-500 italic">{pb.publisher} | {pb.releaseDate}</span>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>
      ) : null}
    </div>
  );
};
