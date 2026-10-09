import { Client } from '@notionhq/client';
import { JobApplication, ApplicationStatus, Priority, WorkModel } from '@/types/job';
import {
  getApplications,
  createApplication,
  updateApplication,
  getApplicationByNotionId,
  getCompanies,
  updateCompany,
  getOrCreateCompany,
  getUsers,
} from './db';
import { getStatusCategory } from './statuses';

async function isAppEligibleForNotionSync(app: JobApplication): Promise<boolean> {
  if (app.status === 'LEAD') return false;
  const users = await getUsers();
  const eligibleIds = new Set(
    users.filter((u) => u.role === 'admin' || u.notion_enabled).map((u) => u.id)
  );
  if (!app.owner) return true;
  return eligibleIds.has(app.owner) || app.owner === 'admin' || app.owner === 'user_ji';
}

const DEFAULT_NOTION_API_KEY = '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';
const DEFAULT_NOTION_DATABASE_ID = '30d77105180580919dfdef58eaed5a54';

function getNotionClient() {
  const apiKey = process.env.NOTION_API_KEY || DEFAULT_NOTION_API_KEY;
  if (!apiKey) return null;
  return new Client({ auth: apiKey });
}

export function getNotionConfig() {
  const apiKey = process.env.NOTION_API_KEY || DEFAULT_NOTION_API_KEY;
  const databaseId = process.env.NOTION_DATABASE_ID || DEFAULT_NOTION_DATABASE_ID;
  return {
    apiKey: apiKey ? '••••••••' + apiKey.slice(-4) : undefined,
    databaseId,
    isConfigured: Boolean(apiKey && databaseId),
  };
}

export async function testNotionConnection() {
  const notion = getNotionClient();
  const databaseId = process.env.NOTION_DATABASE_ID || DEFAULT_NOTION_DATABASE_ID;

  if (!notion || !databaseId) {
    return {
      success: false,
      configured: false,
      message: 'Notion API Key or Database ID is missing.',
    };
  }

  try {
    const db = await notion.databases.retrieve({ database_id: databaseId });
    const title = (db as any).title?.[0]?.plain_text || 'OJT Applications';
    return {
      success: true,
      configured: true,
      databaseTitle: title,
    };
  } catch (error: any) {
    // Check if any database is accessible via search
    try {
      const search = await (notion as any).search({ page_size: 10 });
      if (search.results && search.results.length > 0) {
        const found =
          search.results.find((r: any) => r.object === 'data_source' || r.object === 'database') ||
          search.results[0];
        const title = (found as any).title?.[0]?.plain_text || 'OJT Applications';
        return {
          success: true,
          configured: true,
          databaseTitle: title,
          databaseId: found.id,
        };
      }
    } catch {
      // ignore
    }

    return {
      success: false,
      configured: true,
      message:
        'Please share your Notion database with "Job Tracker": Open Notion -> click "···" at top right -> "Connect to" -> select "Job Tracker".',
    };
  }
}

async function queryNotionRows(notion: any, databaseId: string): Promise<any[]> {
  // 1. Support @notionhq/client v5 (dataSources.query)
  if (notion.dataSources && typeof notion.dataSources.query === 'function') {
    let targetDataSourceId = databaseId;
    try {
      const db = await notion.databases.retrieve({ database_id: databaseId });
      if (db.data_sources && db.data_sources.length > 0) {
        targetDataSourceId = db.data_sources[0].id;
      }
    } catch (e: any) {
      console.warn('databases.retrieve failed, will try search/query:', e?.message);
    }

    try {
      const response = await notion.dataSources.query({
        data_source_id: targetDataSourceId,
        page_size: 100,
      });
      if (response?.results) return response.results;
    } catch (queryErr: any) {
      console.warn('dataSources.query failed with targetDataSourceId:', queryErr?.message);
    }
  }

  // 2. Search fallback for data_source
  try {
    const search = await notion.search({
      filter: { property: 'object', value: 'data_source' },
      page_size: 10,
    });
    if (search.results && search.results.length > 0 && notion.dataSources?.query) {
      const dsId = search.results[0].id;
      const response = await notion.dataSources.query({
        data_source_id: dsId,
        page_size: 100,
      });
      if (response?.results) return response.results;
    }
  } catch (searchErr: any) {
    console.warn('data_source search fallback failed:', searchErr?.message);
  }

  // 3. Fallback to older databases.query if present
  if (notion.databases && typeof (notion.databases as any).query === 'function') {
    try {
      const response = await (notion.databases as any).query({
        database_id: databaseId,
        page_size: 100,
      });
      if (response?.results) return response.results;
    } catch (dbQueryErr: any) {
      console.warn('databases.query fallback failed:', dbQueryErr?.message);
    }
  }

  // 4. Fallback to general page search
  try {
    const search = await notion.search({ page_size: 100 });
    if (search?.results) {
      return search.results.filter((r: any) => r.object === 'page');
    }
  } catch (finalErr: any) {
    console.error('All Notion query methods failed:', finalErr?.message);
  }

  throw new Error('Could not query Notion database rows. Please check integration permissions.');
}

const knownCities = [
  'makati', 'taguig', 'bgc', 'muntinlupa', 'quezon city', 'qc', 'manila', 'mnl',
  'parqal', 'pq', 'lp', 'alabang', 'bicutan', 'shaw', 'mandaluyong', 'pasig',
  'pasay', 'ortigas', 'metro manila', 'meto manila', 'naia'
];

export function parseServiceAndLocation(raw?: string): { service?: string; location?: string } {
  if (!raw || !raw.trim()) return {};
  const trimmed = raw.trim();

  // Multi-line: usually "Service / Industry\n\nLocation"
  if (trimmed.includes('\n')) {
    const lines = trimmed.split(/\n+/).map((l) => l.trim()).filter(Boolean);
    if (lines.length >= 2) {
      return { service: lines[0], location: lines.slice(1).join(', ') };
    }
    return { location: lines[0] };
  }

  // Dash separated: "Muntinlupa - IT", "Tech Solutions - Parqal, PQ"
  if (trimmed.includes(' - ')) {
    const parts = trimmed.split(' - ').map((p) => p.trim());
    if (parts.length >= 2) {
      const p0Lower = parts[0].toLowerCase();
      const p1Lower = parts[parts.length - 1].toLowerCase();
      const p0IsCity = knownCities.some((c) => p0Lower.includes(c));
      const p1IsCity = knownCities.some((c) => p1Lower.includes(c));

      if (p0IsCity && !p1IsCity) {
        return { location: parts[0], service: parts.slice(1).join(' - ') };
      } else if (p1IsCity && !p0IsCity) {
        return { service: parts.slice(0, -1).join(' - '), location: parts[parts.length - 1] };
      } else {
        return { location: parts[0], service: parts.slice(1).join(' - ') };
      }
    }
  }

  const tLower = trimmed.toLowerCase();
  if (knownCities.some((c) => tLower.includes(c))) {
    return { location: trimmed };
  }
  return { service: trimmed, location: trimmed };
}

function buildNotionProperties(app: JobApplication) {
  let statusSelectName = app.notion_status;
  if (!statusSelectName) {
    statusSelectName =
      app.status === 'ACCEPTED'
        ? 'Accepted'
        : app.status === 'OFFER'
        ? 'Accepted - Not Proceeding'
        : app.status === 'INTERVIEWING'
        ? 'Initial Interview'
        : app.status === 'REJECTED'
        ? 'Not Accepted'
        : app.status === 'SCREENING'
        ? 'Screening'
        : app.status === 'WITHDRAWN'
        ? 'Do not Proceed'
        : app.status === 'LEAD'
        ? 'Inquiry'
        : 'Applied - No MOA';
  }

  const properties: Record<string, any> = {
    'Company Name': {
      title: [
        {
          text: {
            content: app.company_name,
          },
        },
      ],
    },
    'Intern Position': {
      select: {
        name: app.role_title.replace(/,/g, ' -'),
      },
    },
    'Application Status': {
      select: {
        name: statusSelectName.replace(/,/g, ' -'),
      },
    },
  };

  if (app.service || app.location) {
    const content =
      app.service && app.location
        ? `${app.service}\n\n${app.location}`
        : app.location || app.service || '';
    properties['Service & Location'] = {
      rich_text: [{ text: { content } }],
    };
  }

  if (app.job_url) {
    properties['URL'] = {
      url: app.job_url,
    };
  }

  if (app.contact_email) {
    properties['Company Email '] = {
      email: app.contact_email,
    };
  }

  if (app.date_applied) {
    properties['Application/ Inquiry Date'] = {
      date: {
        start: app.date_applied.split('T')[0],
      },
    };
  }

  if (app.information) {
    properties['Information'] = {
      rich_text: [{ text: { content: app.information } }],
    };
  }

  if (app.notes) {
    properties['Post Notes'] = {
      rich_text: [{ text: { content: app.notes } }],
    };
  }

  return properties;
}

export async function pushApplicationToNotion(app: JobApplication): Promise<string | null> {
  const isEligible = await isAppEligibleForNotionSync(app);
  if (!isEligible) {
    return null;
  }

  const notion = getNotionClient();
  const databaseId = process.env.NOTION_DATABASE_ID || DEFAULT_NOTION_DATABASE_ID;

  if (!notion || !databaseId) return null;

  try {
    const properties = buildNotionProperties(app);

    if (app.notion_page_id) {
      await notion.pages.update({
        page_id: app.notion_page_id,
        properties,
      });
      await updateApplication(app.id, {
        sync_status: 'SYNCED',
        last_synced_at: new Date().toISOString(),
      });
      return app.notion_page_id;
    } else {
      const response = await notion.pages.create({
        parent: { database_id: databaseId },
        icon: {
          type: 'emoji',
          emoji: '💼',
        },
        properties,
      });

      const pageId = response.id;
      await updateApplication(app.id, {
        notion_page_id: pageId,
        sync_status: 'SYNCED',
        last_synced_at: new Date().toISOString(),
      });
      return pageId;
    }
  } catch (error) {
    console.error('Error syncing application to Notion:', error);
    await updateApplication(app.id, {
      sync_status: 'ERROR',
    });
    return null;
  }
}

export async function pullApplicationsFromNotion() {
  const notion = getNotionClient();
  const databaseId = process.env.NOTION_DATABASE_ID || DEFAULT_NOTION_DATABASE_ID;

  if (!notion || !databaseId) {
    return { success: false, count: 0, error: 'Notion credentials not set in environment variables' };
  }

  try {
    const pages = await queryNotionRows(notion, databaseId);
    let syncedCount = 0;
    const users = await getUsers();
    const defaultOwnerId =
      users.find((u) => u.role === 'admin' || u.notion_enabled)?.id || users[0]?.id || 'admin';

    // 1. Preload existing companies and applications in memory to avoid hundreds of roundtrips
    const existingCompanies = await getCompanies();
    const companyMap = new Map<string, any>();
    existingCompanies.forEach((c) => {
      if (c && c.name) companyMap.set(c.name.trim().toLowerCase(), c);
    });

    const existingApps = await getApplications();
    const appMap = new Map<string, any>();
    existingApps.forEach((a) => {
      if (a.notion_page_id) {
        appMap.set(a.notion_page_id, a);
        appMap.set(a.notion_page_id.replace(/-/g, ''), a);
      }
    });

    for (const page of pages) {
      try {
        const pageId = page.id;
        const props = page.properties || {};

        // 1. Company Name
        const titleProp = Object.values(props).find((p: any) => p.type === 'title') as any;
        const companyName = (
          props['Company Name']?.title?.[0]?.plain_text ||
          titleProp?.title?.[0]?.plain_text ||
          props.Company?.select?.name ||
          props.Company?.rich_text?.[0]?.plain_text ||
          props.Name?.title?.[0]?.plain_text ||
          'Untitled Company'
        ).trim();

        // 2. Role Title
        const roleTitle =
          props['Intern Position']?.select?.name ||
          props['Intern Position']?.rich_text?.[0]?.plain_text ||
          props.Role?.rich_text?.[0]?.plain_text ||
          props.Position?.rich_text?.[0]?.plain_text ||
          props.Title?.title?.[0]?.plain_text ||
          'IT Intern';

        // 3. Exact Notion Status & Standard Status
        const notion_status =
          props['Application Status']?.select?.name ||
          props['Application Status']?.status?.name ||
          props.Status?.select?.name ||
          props.Status?.status?.name ||
          undefined;

        const status: ApplicationStatus = notion_status ? getStatusCategory(notion_status) : 'APPLIED';
        let priority: Priority = 'MEDIUM';

        if (status === 'ACCEPTED' || status === 'INTERVIEWING') {
          priority = 'HIGH';
        } else if (status === 'REJECTED' || status === 'WITHDRAWN') {
          priority = 'LOW';
        }

        // Explicit Priority from Notion
        const priorityProp = props.Priority || props.Rating;
        const priorityRaw = (priorityProp?.select?.name || '').toUpperCase();
        if (priorityRaw.includes('DREAM') || priorityRaw.includes('⭐')) priority = 'DREAM';
        else if (priorityRaw.includes('HIGH')) priority = 'HIGH';
        else if (priorityRaw.includes('LOW')) priority = 'LOW';
        else if (priorityRaw.includes('MED')) priority = 'MEDIUM';

        // 5. Work Model
        const workModelProp = props['Work Model'] || props.Workplace || props.Setup;
        const workModelRaw = (workModelProp?.select?.name || 'HYBRID').toUpperCase();
        let work_model: WorkModel = 'HYBRID';
        if (workModelRaw.includes('REMOTE')) work_model = 'REMOTE';
        else if (workModelRaw.includes('ON-SITE') || workModelRaw.includes('ONSITE')) work_model = 'ON_SITE';

        // 6. Service & Location Categorization
        const rawServiceLocation =
          props['Service & Location']?.rich_text?.[0]?.plain_text ||
          props.Location?.rich_text?.[0]?.plain_text ||
          undefined;
        const { service, location } = parseServiceAndLocation(rawServiceLocation);

        // 7. Contact Email
        const contact_email =
          props['Company Email ']?.email ||
          props['Company Email']?.email ||
          props.Email?.email ||
          undefined;

        // 8. URL
        const job_url =
          props.URL?.url ||
          props['Job URL']?.url ||
          props.Url?.url ||
          undefined;

        // 9. Date Applied (Safely formatted to ISO string)
        const rawDate =
          props['Application/ Inquiry Date']?.date?.start ||
          props['Date Applied']?.date?.start;
        let date_applied: string = new Date().toISOString();
        if (rawDate) {
          try {
            date_applied = new Date(rawDate).toISOString();
          } catch {
            date_applied = new Date().toISOString();
          }
        }

        // 10. Information & Post Notes
        const information = props['Information']?.rich_text?.[0]?.plain_text || undefined;
        const notes =
          props['Post Notes']?.rich_text?.[0]?.plain_text ||
          props.Notes?.rich_text?.[0]?.plain_text ||
          undefined;

        // Efficient cached company retrieval / creation
        let company = companyMap.get(companyName.toLowerCase());
        if (!company) {
          company = await getOrCreateCompany(companyName);
          companyMap.set(companyName.toLowerCase(), company);
        }
        if (service && !company.industry) {
          await updateCompany(company.id, { industry: service });
          company.industry = service;
        }

        const existingApp = appMap.get(pageId) || appMap.get(pageId.replace(/-/g, ''));

        if (existingApp) {
          // Pending or failed local edits must survive the pull so they can be retried.
          if (existingApp.sync_status !== 'SYNCED') continue;
          await updateApplication(existingApp.id, {
            company_id: company.id,
            company_name: company.name,
            company_logo: company.logo_url,
            role_title: existingApp.role_title.replace(/,/g, ' -') === roleTitle
              ? existingApp.role_title : roleTitle,
            status,
            notion_status,
            service,
            information,
            priority,
            work_model,
            location,
            job_url,
            contact_email,
            date_applied,
            notes,
            sync_status: 'SYNCED',
            last_synced_at: new Date().toISOString(),
          });
        } else {
          const created = await createApplication({
            company_id: company.id,
            company_name: company.name,
            company_logo: company.logo_url,
            role_title: roleTitle,
            status,
            notion_status,
            service,
            information,
            priority,
            job_type: 'INTERNSHIP',
            work_model,
            location,
            salary_currency: 'PHP',
            job_url,
            contact_email,
            date_applied,
            notes,
            owner: defaultOwnerId,
            notion_page_id: pageId,
            sync_status: 'SYNCED',
            last_synced_at: new Date().toISOString(),
          });
          appMap.set(pageId, created);
        }
        syncedCount++;
      } catch (rowErr) {
        console.error('Failed to process Notion row:', rowErr);
      }
    }

    return { success: true, count: syncedCount };
  } catch (error: any) {
    console.error('Error pulling from Notion:', error);
    return { success: false, count: 0, error: error?.message || 'Sync failed' };
  }
}

export async function performTwoWaySync() {
  const notionConfig = getNotionConfig();
  if (!notionConfig.isConfigured) {
    return {
      success: false,
      message: 'Notion credentials are not configured yet. Add NOTION_API_KEY and NOTION_DATABASE_ID.',
      pulled: 0,
      pushed: 0,
    };
  }

  const pullResult = await pullApplicationsFromNotion();
  if (!pullResult.success) {
    return {
      success: false,
      message: `Failed to pull from Notion: ${pullResult.error || 'Unknown error'}`,
      pulled: 0,
      pushed: 0,
      timestamp: new Date().toISOString(),
    };
  }

  const allApps = await getApplications(false);
  let pushedCount = 0;
  const failed: { id: string; company: string; role: string }[] = [];

  for (const app of allApps) {
    const isEligible = await isAppEligibleForNotionSync(app);
    if (!isEligible) {
      continue;
    }
    if (app.sync_status !== 'SYNCED' || !app.notion_page_id) {
      const pageId = await pushApplicationToNotion(app);
      if (pageId) pushedCount++;
      else failed.push({ id: app.id, company: app.company_name, role: app.role_title });
    }
  }

  return {
    success: failed.length === 0,
    pulled: pullResult.count,
    pushed: pushedCount,
    failed,
    message: failed.length ? `${failed.length} application(s) failed to sync to Notion. Please retry.` : undefined,
    timestamp: new Date().toISOString(),
  };
}
