import React from 'react';

export const TermsAndConditions: React.FC = () => {
  return (
    <div className="max-w-4xl mx-auto animate-scale-in">
      <div className="bg-white rounded-3xl shadow-apple-card border border-white/60 p-8 sm:p-12 mb-12">
        <h1 className="text-3xl font-bold text-gray-900 mb-2 tracking-tight">Terms & Conditions</h1>
        <div className="flex items-center gap-2 text-sm text-gray-500 font-medium mb-10">
          <span>ResumeAI</span>
          <span>•</span>
          <span>Last Updated: 24 November 2025</span>
        </div>

        <div className="prose prose-slate max-w-none font-serif leading-relaxed text-gray-800">
          <h3 className="font-sans font-bold text-gray-900 uppercase text-xs tracking-wider mb-2">Introduction</h3>
          <p className="mb-8">
            By using ResumeAI (“we”, “our”, “the Service”), you agree to these Terms & Conditions. This Service provides AI-assisted resume analysis, job matching, candidate screening, and communication tools for both job seekers and recruiters.
          </p>

          <h3 className="font-sans font-bold text-gray-900 uppercase text-xs tracking-wider mb-2">Data You Provide</h3>
          <p className="mb-8">
            Users may upload resumes, job descriptions, contact details, candidate datasets, and related documents. This information is processed solely for generating resume match scores, analysis reports, candidate comparisons, email templates, and AI-optimized resumes or cover letters.
          </p>

          <h3 className="font-sans font-bold text-gray-900 uppercase text-xs tracking-wider mb-2">Data Privacy & Storage</h3>
          <ul className="list-disc pl-5 mb-4 space-y-1">
            <li>We DO NOT store your resumes, job descriptions, or personal data.</li>
            <li>We DO NOT save candidate information or recruiter-uploaded files.</li>
            <li>We DO NOT build any user profiles or datasets from uploaded content.</li>
            <li>We DO NOT sell or share your data with anyone.</li>
            <li>All files are processed in memory only and automatically deleted after the session ends.</li>
            <li>Your data is NOT used to train or improve AI models.</li>
          </ul>
          <p className="mb-8">
            All communication is secured using encrypted HTTPS/TLS channels.
          </p>

          <h3 className="font-sans font-bold text-gray-900 uppercase text-xs tracking-wider mb-2">User Responsibilities</h3>
          <p className="mb-8">
            You confirm that you have the legal right to upload any resumes or job descriptions entered into the platform. You will not upload harmful, illegal, confidential, or unauthorized data. You agree to use the output responsibly and ethically.
          </p>

          <h3 className="font-sans font-bold text-gray-900 uppercase text-xs tracking-wider mb-2">AI Disclaimer</h3>
          <p className="mb-4">
            This application uses AI to generate resume improvements, match scores, candidate recommendations, email templates, interview prompts, and related content.
          </p>
          <ul className="list-disc pl-5 mb-8 space-y-1">
            <li>AI outputs are approximations and may be incomplete or imperfect.</li>
            <li>Do not rely solely on AI for hiring decisions.</li>
            <li>Review and validate all generated resumes, summaries, and communication before using them.</li>
            <li>Job seekers must verify all content before submitting to employers.</li>
            <li>Recruiters must ensure human oversight in screenings and shortlists.</li>
          </ul>

          <h3 className="font-sans font-bold text-gray-900 uppercase text-xs tracking-wider mb-2">No Liability</h3>
          <p className="mb-8">
            ResumeAI is not responsible for job application outcomes, hiring decisions, incorrect AI outputs, or any losses resulting from use of the platform.
            The system is provided "as-is" and all decisions using the output are solely your responsibility.
          </p>

          <h3 className="font-sans font-bold text-gray-900 uppercase text-xs tracking-wider mb-2">Recruiter Use Policy</h3>
          <ul className="list-disc pl-5 mb-8 space-y-1">
            <li>Recruiters confirm they have permission to process candidate resumes.</li>
            <li>Recruiters must follow all employment, privacy, and data protection laws.</li>
            <li>Recruiters must use candidate data ethically and comply with hiring standards.</li>
          </ul>

          <h3 className="font-sans font-bold text-gray-900 uppercase text-xs tracking-wider mb-2">External Services</h3>
          <p className="mb-8">
            ResumeAI may integrate with third-party systems such as Gmail for composing messages.
            We are not liable for outages or changes to these external services.
          </p>

          <h3 className="font-sans font-bold text-gray-900 uppercase text-xs tracking-wider mb-2">Termination</h3>
          <p className="mb-8">
            We may modify or suspend access for misuse. Updating Terms does not require user confirmation; continued use signifies acceptance.
          </p>

          <h3 className="font-sans font-bold text-gray-900 uppercase text-xs tracking-wider mb-2">Intellectual Property</h3>
          <p className="mb-8">
            All UI, branding, and software belong to ResumeAI.
            Users retain ownership of their uploaded resumes and exported outputs.
          </p>

          <div className="bg-gray-50 rounded-xl p-6 border border-gray-100">
            <h3 className="font-sans font-bold text-gray-900 uppercase text-xs tracking-wider mb-2">Contact</h3>
            <p className="text-gray-600">
              support@resumeai.app (placeholder)
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};