'use client';

import { useEffect, useRef, useState } from 'react';
import type { DefaultView } from '@/lib/preferences';
import type { PipelineInsight } from '@/lib/pipeline-insights';
import { readAIResponse } from '@/lib/ai-response';
import { OPTIONAL_AI_BROWSER_TIMEOUT_MS } from '@/lib/ai-request-limits';

type SavedInsight = { report: PipelineInsight | null; currentVersion: string; outdated: boolean; checkedDataVersion: string };
const button = 'rounded-xl border border-[#F1DDE9] bg-[#FFF0F6] px-3 py-2 text-xs font-semibold text-[#9D3C5E] disabled:opacity-50';
const savedLoadError = 'Saved insights could not be loaded. Your charts and PDF remain available.';

export default function PipelineInsights({ scope, dataVersion, total }: { scope: DefaultView; dataVersion: string; total: number }) {
  const [saved, setSaved] = useState<Partial<Record<DefaultView, SavedInsight>>>({});
  const [errors, setErrors] = useState<Partial<Record<DefaultView, string>>>({});
  const [pending, setPending] = useState<DefaultView | null>(null);
  const [expanded, setExpanded] = useState(false);
  const inFlight = useRef(false);
  const analysisController = useRef<AbortController | null>(null);
  const generation = useRef<Partial<Record<DefaultView, number>>>({});
  const entry = saved[scope];
  const report = entry?.report;
  const outdated = Boolean(report && (entry?.outdated || entry?.checkedDataVersion !== dataVersion));

  useEffect(() => () => analysisController.current?.abort(), []);

  useEffect(() => {
    const controller = new AbortController();
    const requestGeneration = generation.current[scope] || 0;
    fetch(`/api/analytics/insights?scope=${scope}`, { signal: controller.signal, cache: 'no-store' })
      .then(async response => {
        const data = await response.json();
        if (!response.ok || !data.success) throw new Error(data.error || 'Saved insights could not be loaded.');
        if (controller.signal.aborted || (generation.current[scope] || 0) !== requestGeneration) return;
        setSaved(previous => ({ ...previous, [scope]: { ...data.data, checkedDataVersion: dataVersion } }));
        setErrors(previous => previous[scope] === savedLoadError ? { ...previous, [scope]: '' } : previous);
      }).catch(error => {
        if (error.name !== 'AbortError') setErrors(previous => ({ ...previous, [scope]: savedLoadError }));
      });
    return () => controller.abort();
  }, [scope, dataVersion]);

  async function analyze() {
    if (inFlight.current) return;
    inFlight.current = true;
    const controller = new AbortController();
    analysisController.current = controller;
    const requestedScope = scope, requestedVersion = dataVersion;
    generation.current[requestedScope] = (generation.current[requestedScope] || 0) + 1;
    setPending(requestedScope);
    setErrors(previous => ({ ...previous, [requestedScope]: '' }));
    try {
      const response = await fetch('/api/analytics/analyze', { method: 'POST', signal: AbortSignal.any([controller.signal, AbortSignal.timeout(OPTIONAL_AI_BROWSER_TIMEOUT_MS)]), headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ scope: requestedScope }) });
      const data = await readAIResponse<{ success: boolean; error?: string; data: Omit<SavedInsight, 'checkedDataVersion'> }>(response, 'AI insights are unavailable. Your charts and PDF remain available.');
      if (controller.signal.aborted) return;
      generation.current[requestedScope] = (generation.current[requestedScope] || 0) + 1;
      setSaved(previous => ({ ...previous, [requestedScope]: { ...data.data, checkedDataVersion: requestedVersion } }));
      setExpanded(true);
    } catch (error) {
      if (controller.signal.aborted) return;
      const message = error instanceof Error && ['TimeoutError', 'AbortError'].includes(error.name)
        ? 'AI did not respond in time. Your saved insights, charts and PDF remain available.'
        : error instanceof Error ? error.message : 'AI insights are unavailable. Your charts and PDF remain available.';
      setErrors(previous => ({ ...previous, [requestedScope]: message }));
    } finally { inFlight.current = false; if (!controller.signal.aborted) setPending(null); }
  }

  return <section aria-labelledby="pipeline-insights-title" className="rounded-2xl border border-[#F1DDE9] bg-white p-5 shadow-xs">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div className="min-w-0"><h3 id="pipeline-insights-title" className="text-sm font-bold text-[#4A3E44]">Pipeline insights</h3><p className="mt-1 text-xs text-[#736A6D]">Optional AI guidance using your saved applications, assessments, master resume and preferences.</p></div>
      <button className={button} disabled={pending !== null || !total} onClick={analyze}>{pending === scope ? 'Analyzing…' : report ? 'Analyze again with AI' : 'Analyze my pipeline with AI'}</button>
    </div>
    {!total && <p className="mt-3 text-xs text-[#736A6D]">Add an application in this scope to receive insights.</p>}
    {pending && pending !== scope && <p role="status" className="mt-3 text-xs text-[#736A6D]">Analysis is running for another scope. You can keep reviewing charts and exporting.</p>}
    {report && <div className="mt-4 text-xs text-[#736A6D]">
      <p className="mb-2">AI interpretation · {scope === 'ALL' ? 'All applications' : scope === 'INTERNSHIP' ? 'Internships' : 'Regular Employment'} · Generated {new Date(report.generatedAt).toLocaleString()}</p>
      {outdated && <p role="status" className="mb-3 rounded-lg bg-[#FFF0F6] p-2 text-[#9D3C5E]">Outdated: saved data or settings have changed. Analyze again when you want refreshed guidance.</p>}
      <p>{report.summary}</p>
      <button aria-expanded={expanded} className={`${button} mt-3`} onClick={() => setExpanded(value => !value)}>{expanded ? 'Hide insights' : 'Show insights'}</button>
      {expanded && <div className="mt-4 space-y-4">{[
        ['What stands out?', report.observations], ['What does this mean?', report.implications], ['What can I do next?', report.recommendations],
      ].map(([heading, cards]) => <div key={heading as string}><h4 className="font-semibold text-[#4A3E44]">{heading as string}</h4><div className="mt-2 grid gap-2 md:grid-cols-3">{(cards as PipelineInsight['observations']).map((insight, index) => <div key={index} className="min-w-0 rounded-xl bg-[#FAF7F9] p-3"><p>{insight.text}</p><ul className="mt-2 space-y-1 text-[11px]">{insight.evidence.map(evidence => <li key={evidence.id}>{evidence.label}: {evidence.display}</li>)}</ul></div>)}</div>{!cards.length && <p className="mt-2">Insufficient recorded evidence for further guidance.</p>}</div>)}
        {report.limitations.length > 0 && <div><h4 className="font-semibold text-[#4A3E44]">Keep in mind</h4><ul className="mt-2 list-disc space-y-1 pl-4">{report.limitations.map(item => <li key={item}>{item}</li>)}</ul></div>}
      </div>}
    </div>}
    {errors[scope] && <p role="status" className="mt-3 rounded-xl bg-[#FFF0F6] p-3 text-xs text-[#9D3C5E]">{errors[scope]}</p>}
  </section>;
}
