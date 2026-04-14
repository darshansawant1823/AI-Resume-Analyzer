import React from 'react';

type LegalPageType = 'terms' | 'privacy' | 'refund';

interface LegalPagesProps {
  type: LegalPageType;
  onBack?: () => void;
}

export const LegalPages: React.FC<LegalPagesProps> = ({ type, onBack }) => {
  const content = {
    terms: {
      title: 'Terms & Conditions',
      lastUpdated: '27 March 2026',
      sections: [
        {
          title: '1. Acceptance of Terms',
          body: 'By accessing or using ResumeAI ("the Service"), you agree to be bound by these Terms and Conditions. If you do not agree, you must immediately cease all use of the Service. We reserve the right to modify these terms at any time without prior notice. Your continued use constitutes acceptance of any changes.'
        },
        {
          title: '2. AI-Generated Content Disclaimer',
          body: 'The Service utilizes advanced Artificial Intelligence (AI) to provide resume analysis, job matching, and interview preparation. You acknowledge and agree that AI outputs are probabilistic, may contain inaccuracies, and are provided "as-is" without any warranty of any kind. We do not guarantee the accuracy, completeness, or usefulness of any AI-generated insights.'
        },
        {
          title: '3. Limitation of Liability',
          body: 'TO THE MAXIMUM EXTENT PERMITTED BY LAW, RESUMEAI AND ITS OPERATORS SHALL NOT BE LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR PUNITIVE DAMAGES, INCLUDING BUT NOT LIMITED TO LOSS OF PROFITS, DATA, USE, GOODWILL, OR OTHER INTANGIBLE LOSSES, RESULTING FROM (I) YOUR ACCESS TO OR USE OF OR INABILITY TO ACCESS OR USE THE SERVICE; (II) ANY CONDUCT OR CONTENT OF ANY THIRD PARTY ON THE SERVICE; (III) ANY CONTENT OBTAINED FROM THE SERVICE; AND (IV) UNAUTHORIZED ACCESS, USE OR ALTERATION OF YOUR TRANSMISSIONS OR CONTENT, WHETHER BASED ON WARRANTY, CONTRACT, TORT (INCLUDING NEGLIGENCE) OR ANY OTHER LEGAL THEORY.'
        },
        {
          title: '4. No Professional Advice',
          body: 'The insights provided by the Service do not constitute professional career coaching, legal, or recruitment advice. All hiring decisions and career moves are made solely at your own risk. We take no responsibility for the outcome of any job application or recruitment process.'
        },
        {
          title: '5. Data Breach & Security',
          body: 'While we implement industry-standard security measures, no method of transmission over the internet is 100% secure. You acknowledge that you provide your data at your own risk. In the event of a data breach, our liability is limited to the maximum extent permitted by law, and we shall not be held responsible for any unauthorized access to your personal information by third parties.'
        },
        {
          title: '6. Indemnification',
          body: 'You agree to defend, indemnify and hold harmless ResumeAI and its licensee and licensors, and their employees, contractors, agents, officers and directors, from and against any and all claims, damages, obligations, losses, liabilities, costs or debt, and expenses (including but not limited to attorney\'s fees), resulting from or arising out of a) your use and access of the Service, or b) a breach of these Terms.'
        }
      ]
    },
    privacy: {
      title: 'Privacy Policy',
      lastUpdated: '27 March 2026',
      sections: [
        {
          title: '1. Information Collection',
          body: 'We collect information you provide directly to us, such as when you upload a resume or job description. This may include personal identifiers, professional information, and contact details. We also collect metadata about your usage of the Service.'
        },
        {
          title: '2. Use of Information',
          body: 'Your information is used to provide, maintain, and improve our AI services. We use your data to generate analysis reports, match scores, and interview questions. We do not sell your personal data to third parties.'
        },
        {
          title: '3. AI Processing & Third Parties',
          body: 'Your data is processed using third-party AI models (such as Google Gemini). By using the service, you consent to your data being transmitted to these third-party providers for processing. While we strive to protect your privacy, we are not responsible for the privacy practices of these third-party AI providers.'
        },
        {
          title: '4. Data Retention',
          body: 'We retain your data only for as long as necessary to provide the services requested. You may request deletion of your data at any time, subject to our legal obligations to retain certain information.'
        },
        {
          title: '5. Security Disclaimer',
          body: 'We take reasonable measures to protect your information from loss, theft, misuse, and unauthorized access. However, the internet is not a secure environment, and we cannot guarantee absolute security. We take no responsibility for data breaches caused by factors outside our direct control.'
        }
      ]
    },
    refund: {
      title: 'Refund Policy',
      lastUpdated: '27 March 2026',
      sections: [
        {
          title: '1. No Refund Policy',
          body: 'All sales are final. Due to the nature of our service, which involves immediate costs associated with AI computation and processing for every request, we do not offer refunds, credits, or exchanges under any circumstances.'
        },
        {
          title: '2. AI Generation Costs',
          body: 'Every time you use our AI analysis or interview preparation tools, it incurs a direct cost to us from our AI infrastructure providers. Because these costs are non-recoverable once the AI has generated the insights, we cannot provide refunds once a service has been initiated.'
        },
        {
          title: '3. "As-Is" Service',
          body: 'Our AI insights are generated based on probabilistic models and are provided "as-is". Dissatisfaction with the specific content, accuracy, or tone of the AI-generated output is not grounds for a refund. We encourage users to review our free samples (if available) before committing to a paid service.'
        },
        {
          title: '4. Technical Issues',
          body: 'In the event of a confirmed technical failure where the service was not delivered at all, we may, at our sole discretion, offer a credit for future use. This does not constitute a right to a refund.'
        }
      ]
    }
  };

  const currentPage = content[type];

  return (
    <div className="max-w-4xl mx-auto animate-scale-in">
      <div className="bg-white rounded-3xl shadow-apple-card border border-white/60 p-8 sm:p-12 mb-12">
        <div className="flex justify-between items-start mb-6">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 mb-2 tracking-tight">{currentPage.title}</h1>
            <div className="flex items-center gap-2 text-sm text-gray-500 font-medium">
              <span>ResumeAI</span>
              <span>•</span>
              <span>Last Updated: {currentPage.lastUpdated}</span>
            </div>
          </div>
          {onBack && (
            <button 
              onClick={onBack}
              className="px-4 py-2 text-sm font-semibold text-gray-600 hover:text-gray-900 transition-colors"
            >
              Back
            </button>
          )}
        </div>

        <div className="prose prose-slate max-w-none font-serif leading-relaxed text-gray-800">
          {currentPage.sections.map((section, index) => (
            <div key={index} className="mb-8">
              <h3 className="font-sans font-bold text-gray-900 uppercase text-xs tracking-wider mb-2">
                {section.title}
              </h3>
              <p className="text-gray-700">
                {section.body}
              </p>
            </div>
          ))}

          <div className="bg-gray-50 rounded-xl p-6 border border-gray-100 mt-12">
            <h3 className="font-sans font-bold text-gray-900 uppercase text-xs tracking-wider mb-2">Legal Disclaimer</h3>
            <p className="text-gray-600 text-sm italic">
              This document is for informational purposes only and does not constitute legal advice. By using the service, you acknowledge that you have read and understood these terms in their entirety.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
