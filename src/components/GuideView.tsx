'use client';
import Image from 'next/image';
import { FileText, FileJson, Plus, ListChecks, Sparkles, BarChart3, BookOpen } from 'lucide-react';

export default function GuideView({ onOpenPreferences, onNavigate }: { onOpenPreferences: () => void; onNavigate: (view: 'table' | 'board' | 'leads' | 'analytics' | 'resume') => void }) {
  const steps = [
    { title: 'Save your master resume', text: 'Open My preferences. Upload a PDF or paste your resume and save it. This is the resume your AI tools use.', icon: FileText, action: 'My preferences', run: onOpenPreferences },
    { title: 'Track a real opportunity', text: 'Use the Gemini JSON steps above to fill a posting in New App. Keep it at Not started while you decide, or choose Applied after submitting. For a simple lead, use Quick Add beside Saved leads and Discover.', icon: Plus, action: 'My applications', run: () => onNavigate('table') },
    { title: 'Update your progress', text: 'Start at Not started, then record applications, interviews and offers. Analytics follows your highest recorded phase. Save with Not Proceeding checked to archive locally; find it in Archive and uncheck to restore. Your Notion backup status stays unchanged.', icon: ListChecks, action: 'Board View', run: () => onNavigate('board') },
    { title: 'Assess one role at a time', text: 'Open an application and choose Reanalyze role fit, or select a fit manually. Saving an application never starts an assessment.', icon: Sparkles, action: 'My applications', run: () => onNavigate('table') },
    { title: 'Review your analytics', text: 'Switch between internships and regular employment. Click chart bars to review records. Unassessed roles stay visible; small samples are not predictions.', icon: BarChart3, action: 'Analytics', run: () => onNavigate('analytics') },
    { title: 'Prepare a tailored application', text: 'AI Resume & ATS compares your master resume with a selected job description. Review its suggestions before using them. It does not submit applications for you.', icon: BookOpen, action: 'AI Resume & ATS', run: () => onNavigate('resume') },
  ];
  return <div className="space-y-4">
    <div><h2 className="text-lg font-bold text-[#4A3E44]">Your quick-start guide</h2><p className="mt-1 text-sm text-[#736A6D]">Your applications, resume and preferences belong to your account.</p></div>
    <section aria-labelledby="gemini-easy-add-title" className="rounded-2xl border border-[#F1DDE9] bg-[#FFF0F6] p-5">
      <h3 id="gemini-easy-add-title" className="flex items-center gap-2 text-sm font-bold text-[#9D3C5E]"><FileJson aria-hidden="true" className="h-5 w-5 shrink-0" />Easy-add a job with Ask Gemini</h3>
      <p className="mt-2 text-sm leading-relaxed text-[#736A6D]">Use Gemini in Chrome, Google’s built-in browser assistant, to turn an open job posting into JSON, then import it as a draft.</p>
      <ol className="mt-3 list-decimal space-y-2 pl-5 text-sm leading-relaxed text-[#4A3E44]">
        <li>Click <strong>Copy Prompt</strong> beside <strong>New App</strong> in the header.</li>
        <li>Open the job posting in a Chrome tab, then click <strong>Ask Gemini</strong> at the top of the browser. Follow the setup instructions if this is your first time.
          <figure className="mt-2">
            <Image src="/ask-gemini.png" alt="Ask Gemini button at the top of Google Chrome" width={246} height={48} className="h-auto max-w-full rounded-lg" />
            <figcaption className="mt-1 text-xs text-[#736A6D]">Look for this button in Chrome.</figcaption>
          </figure>
        </li>
        <li>Make sure the job-posting tab is shared with Gemini. Paste the copied prompt into the Gemini panel, include the posting URL, and ask for the JSON response. If Gemini cannot read the posting, paste the full job-posting text too.</li>
        <li>Copy the returned JSON and return to Job Hunt. Open <strong>New App</strong>. Under <strong>Job description (Information)</strong>, click <strong>Import job JSON</strong>, paste the JSON, then click <strong>Fill draft from JSON</strong>.</li>
        <li>Review the company, role, description, location, platform, salary and dates. Choose the correct status, add your personal comments, and click <strong>Create Application</strong>.</li>
      </ol>
      <p className="mt-3 text-xs leading-relaxed text-[#736A6D]">If Ask Gemini is unavailable, open <a href="https://gemini.google.com/" target="_blank" rel="noopener noreferrer" className="font-semibold text-[#9D3C5E] underline">Gemini</a> and paste the prompt, full posting text and URL there instead. See <a href="https://support.google.com/chrome/answer/16283624" target="_blank" rel="noopener noreferrer" className="font-semibold text-[#9D3C5E] underline">Google’s Gemini in Chrome guide</a> for setup and tab sharing.</p>
      <p className="mt-3 text-xs leading-relaxed text-[#736A6D]">The import fills a draft for you to review before saving. Check extracted details against the posting, especially salary amounts and currency. To save it as a lead, keep the status at Not started. Role-fit analysis is a separate action below the job description.</p>
    </section>
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">{steps.map((step, index) => <section key={step.title} className="rounded-2xl border border-[#F1DDE9] bg-white p-5"><div className="mb-3 flex items-center gap-2"><step.icon aria-hidden="true" className="h-5 w-5 text-[#FF7AB3]" /><span className="text-xs font-semibold text-[#9D3C5E]">Step {index + 1}</span></div><h3 className="text-sm font-bold">{step.title}</h3><p className="mt-2 text-sm leading-relaxed text-[#736A6D]">{step.text}</p><button type="button" onClick={step.run} className="mt-4 rounded-xl border border-[#F1DDE9] bg-[#FFF0F6] px-3 py-2 text-xs font-semibold text-[#9D3C5E]">{step.action}</button></section>)}</div>
    <p className="text-xs text-[#736A6D]">Members use their own Cloud DB records. Notion sync and account management belong to the administrator.</p>
  </div>;
}
