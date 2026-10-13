import { createHash } from 'node:crypto';
import type { UserAccount } from '@/types/job';
import type { DefaultView } from './preferences';
import { getAccountAnalytics } from './analytics-service';
import { analyticsReportData } from './analytics-report';
import { isInternship } from './analytics';
import { getCandidateProfile } from '@/lib/db';
import { savedRoleFit } from './role-fit';
import { effectiveRoleFamily, effectiveSeniority } from './application-analytics-fields';
import { insightDimensionRows, pipelineMetricCatalog } from './pipeline-insights';
export function insightScope(value: unknown): DefaultView | null { return value === undefined || value === null || value === '' ? 'ALL' : ['ALL', 'INTERNSHIP', 'OTHER'].includes(value as string) ? value as DefaultView : null; }
export function privateContextText(text: string, name = '', email = '') {
    let safe = text.split(/^\s*references?\s*:?\s*$/im)[0];
    for (const personal of [name, email].filter(Boolean))
        safe = safe.replaceAll(personal, '[Candidate]');
    return safe.split('\n').filter(line => !/^\s*(?:address|contact|mobile|phone|email)\b/i.test(line)).join('\n')
        .replace(/[\w.+-]+@[\w.-]+\.[a-z]{2,}/gi, '[email removed]').replace(/https?:\/\/\S+/gi, '[link removed]')
        .replace(/(?:\+?\d[\d ()-]{7,}\d)/g, '[contact number removed]');
}
export async function pipelineInsightContext(user: UserAccount, scope: DefaultView) {
    const [{ applications, preferences, stats }, resume] = await Promise.all([getAccountAnalytics(user, scope), getCandidateProfile(user.id)]);
    const snapshotVersion = createHash('sha256').update(JSON.stringify({ schema: 'pipeline-insights-v1', scope, stats, preferences, resume, applications: [...applications].sort((a, b) => a.id.localeCompare(b.id)).map(app => [app.id, app.updated_at, app.role_fit, app.role_fit_analysis]) })).digest('hex');
    const { types } = analyticsReportData(applications,stats,preferences?.analytics_status_stages,preferences?.analytics_rejection_statuses);
    const catalog = pipelineMetricCatalog(stats, types), limitations: string[] = [];
    if (!resume?.trim())
        limitations.push('No master resume is saved; suggestions use applications, saved assessments and preferences.');
    if (stats.timing.callbacks.count === 0)
        limitations.push('No usable employer response dates are recorded; waiting time is not callback time.');
    if (stats.unassessed)
        limitations.push(`${stats.unassessed} tracked ${stats.unassessed === 1 ? 'application has' : 'applications have'} no saved role-fit assessment.`);
    if (scope === 'ALL' && applications.some(isInternship) && applications.some(app=>!isInternship(app)))
        limitations.push('Combined job types and hiring periods should be examined separately before changing your targeting.');
    const selected = [...applications].sort((a, b) => (Date.parse(b.updated_at) || 0) - (Date.parse(a.updated_at) || 0)).slice(0, 200);
    if (selected.length < applications.length)
        limitations.push('Detailed context covers the most recently updated applications; computed statistics cover all saved records in this scope.');
    if (['roles', 'platforms', 'cohorts'].some(name => stats.dimensions[name as 'roles'].length > 12))
        limitations.push('Detailed comparisons show the largest application groups; overall counts include every group.');
    const safe = (text: string) => privateContextText(text, user.name, user.email);
    let assessmentBudget = 16000;
    const history = selected.map((app, index) => {
        const analysis = app.role_fit_analysis;
        const explanation = analysis && assessmentBudget > 0 ? privateContextText(analysis.explanation || '', user.name, user.email).slice(0, Math.min(600, assessmentBudget)) : undefined;
        assessmentBudget -= explanation?.length || 0;
        return { reference: `application.${index}`, role: safe(app.role_title || 'Unknown').slice(0, 200), jobType: app.job_type, roleFamily: safe(effectiveRoleFamily(app)).slice(0, 100), seniority: effectiveSeniority(app), platform: safe(app.job_platform || app.source || 'Unknown').slice(0, 100), status: app.status, stage: app.analytics_stage, archived: app.not_proceeding, submittedAt: app.date_applied, firstResponseAt: app.first_response_at, stageHistory: app.stage_history?.slice(-12).map(event => ({ status: event.status, at: event.at })), effectiveRoleFit: savedRoleFit(app) || 'UNASSESSED', fitSource: app.role_fit_source, savedAssessment: analysis ? { fit: analysis.fit, explanation, preferenceAlignment: analysis.preference_alignment, strengths: explanation ? analysis.strengths?.slice(0, 3).map(item => safe(item).slice(0, 200)) : undefined, gaps: explanation ? analysis.gaps?.slice(0, 3).map(item => safe(item).slice(0, 200)) : undefined } : undefined };
    });
    const safePreferences = preferences ? { target_roles: preferences.target_roles, target_companies: preferences.target_companies, preferred_locations: preferences.preferred_locations, work_models: preferences.work_models, job_types: preferences.job_types, salary_min: preferences.salary_min, salary_currency: preferences.salary_currency, dealbreakers: privateContextText(preferences.dealbreakers || '', user.name, user.email).slice(0, 1500) } : null;
    const dimensions = Object.fromEntries((['roles', 'seniority', 'platforms', 'cohorts', 'qualifications'] as const).map(name => [name, insightDimensionRows(stats.dimensions[name]).map(({ row, index }) => ({ ...row, label: safe(row.label), catalogIndex: index }))]));
    const salarySummary = (groups: typeof stats.salaryOffers.groups) => groups.map(group => ({ currency: group.currency, period: group.period, count: group.count, median: group.median, min: group.min, max: group.max }));
    const compactStats = { ...stats, types, dimensions: { ...dimensions, missingResponseDates: stats.dimensions.missingResponseDates }, salaryOffers: { count: stats.salaryOffers.count, groups: salarySummary(stats.salaryOffers.groups), expectedCount: stats.salaryOffers.expectedCount, expectations: stats.salaryOffers.expectations.map(group => ({ ...salarySummary([group])[0], matched: group.matched, met: group.met, medianGap: group.medianGap })) } };
    const safeCatalog = Object.fromEntries(Object.entries(catalog).map(([id, evidence]) => [id, { ...evidence, label: safe(evidence.label) }]));
    return { stats, applications, scope, snapshotVersion, catalog, limitations, payload: { ...compactStats, scope, catalog: safeCatalog, preferences: safePreferences, candidate: { source: resume?.trim() ? 'master_resume' : 'missing', resume: resume ? safe(resume).slice(0, 20000) : null }, applicationContext: { included: history.length, total: applications.length, records: history }, limitations } };
}
