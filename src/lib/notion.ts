import { Client } from '@notionhq/client';
import { JobApplication, ApplicationStatus, Priority, WorkModel } from '@/types/job';
import {
  getApplications,
  createApplication,
  updateApplication,
  getApplicationByNotionId,
  getOrCreateCompany,
  getUsers,
} from './db';

async function isAppEligibleForNotionSync(app: JobApplication): Promise<boolean> {
  const users = await getUsers();
  const eligibleIds = new Set(
    users.filter((u) => u.role === 'admin' || u.notion_enabled).map((u) => u.id)
  );
  if (!app.owner) return true;
  return eligibleIds.has(app.owner) || app.owner === 'admin' || app.owner === 'user_ji';
}

function getNotionClient() {
  const apiKey = process.env.NOTION_API_KEY;
  if (!apiKey) return null;
  return new Client({ auth: apiKey });
}

export function getNotionConfig() {
  return {
    apiKey: process.env.NOTION_API_KEY ? '••••••••' + process.env.NOTION_API_KEY.slice(-4) : undefined,
    databaseId: process.env.NOTION_DATABASE_ID,
    isConfigured: Boolean(process.env.NOTION_API_KEY && process.env.NOTION_DATABASE_ID),
  };
}

export async function testNotionConnection() {
  const notion = getNotionClient();
  const databaseId = process.env.NOTION_DATABASE_ID;

  if (!notion || !databaseId) {
    return {
      success: false,
      configured: false,
      message: 'Notion API Key or Database ID is missing in environment variables.',
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
    } catch {
      // use databaseId directly
    }

    const response = await notion.dataSources.query({
      data_source_id: targetDataSourceId,
      page_size: 100,
    });
    return response.results || [];
  }

  // 2. Fallback to older databases.query if present
  if (notion.databases && typeof (notion.databases as any).query === 'function') {
    const response = await (notion.databases as any).query({
      database_id: databaseId,
      page_size: 100,
    });
    return response.results || [];
  }

  throw new Error('No query method supported on Notion client');
}

function buildNotionProperties(app: JobApplication) {
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
        name: app.role_title,
      },
    },
    'Application Status': {
      select: {
        name:
          app.status === 'OFFER' || app.status === 'ACCEPTED'
            ? 'Accepted'
            : app.status === 'INTERVIEWING'
            ? 'Initial Interview'
            : app.status === 'REJECTED'
            ? 'Not Accepted'
            : app.status === 'SCREENING'
            ? 'Screening'
            : 'Inquiry',
      },
    },
  };

  if (app.location) {
    properties['Service & Location'] = {
      rich_text: [{ text: { content: app.location } }],
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
  const databaseId = process.env.NOTION_DATABASE_ID;

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
  const databaseId = process.env.NOTION_DATABASE_ID;

  if (!notion || !databaseId) {
    return { success: false, count: 0, error: 'Notion credentials not set in environment variables' };
  }

  try {
    const pages = await queryNotionRows(notion, databaseId);
    let syncedCount = 0;
    const users = await getUsers();
    const defaultOwnerId =
      users.find((u) => u.role === 'admin' || u.notion_enabled)?.id || users[0]?.id || 'admin';

    for (const page of pages) {
      const pageId = page.id;
      const props = page.properties || {};

      // 1. Company Name
      const titleProp = Object.values(props).find((p: any) => p.type === 'title') as any;
      const companyName =
        props['Company Name']?.title?.[0]?.plain_text ||
        titleProp?.title?.[0]?.plain_text ||
        props.Company?.select?.name ||
        props.Company?.rich_text?.[0]?.plain_text ||
        props.Name?.title?.[0]?.plain_text ||
        'Untitled Company';

      // 2. Role Title
      const roleTitle =
        props['Intern Position']?.select?.name ||
        props['Intern Position']?.rich_text?.[0]?.plain_text ||
        props.Role?.rich_text?.[0]?.plain_text ||
        props.Position?.rich_text?.[0]?.plain_text ||
        props.Title?.title?.[0]?.plain_text ||
        'IT Intern';

      // 3. Status
      const statusProp = props['Application Status'] || props.Status || props.Stage;
      const statusRaw = (statusProp?.select?.name || statusProp?.status?.name || 'APPLIED').toUpperCase();
      let status: ApplicationStatus = 'APPLIED';
      if (statusRaw.includes('ACCEPT') || statusRaw.includes('OFFER')) status = 'OFFER';
      else if (statusRaw.includes('INTERVIEW')) status = 'INTERVIEWING';
      else if (statusRaw.includes('SCREEN') || statusRaw.includes('EXAM')) status = 'SCREENING';
      else if (statusRaw.includes('REJECT') || statusRaw.includes('NOT ACCEPT')) status = 'REJECTED';
      else if (statusRaw.includes('NOT START') || statusRaw.includes('WISHLIST') || statusRaw.includes('LEAD'))
        status = 'LEAD';
      else if (statusRaw.includes('WITHDRAW')) status = 'WITHDRAWN';
      else if (statusRaw.includes('GHOST')) status = 'GHOSTED';

      // 4. Priority
      const priorityProp = props.Priority || props.Rating;
      const priorityRaw = (priorityProp?.select?.name || 'MEDIUM').toUpperCase();
      let priority: Priority = 'MEDIUM';
      if (status === 'OFFER' || priorityRaw.includes('DREAM') || priorityRaw.includes('⭐')) priority = 'DREAM';
      else if (priorityRaw.includes('HIGH')) priority = 'HIGH';
      else if (priorityRaw.includes('LOW')) priority = 'LOW';

      // 5. Work Model
      const workModelProp = props['Work Model'] || props.Workplace || props.Setup;
      const workModelRaw = (workModelProp?.select?.name || 'HYBRID').toUpperCase();
      let work_model: WorkModel = 'HYBRID';
      if (workModelRaw.includes('REMOTE')) work_model = 'REMOTE';
      else if (workModelRaw.includes('ON-SITE') || workModelRaw.includes('ONSITE')) work_model = 'ON_SITE';

      // 6. Location
      const location =
        props['Service & Location']?.rich_text?.[0]?.plain_text ||
        props.Location?.rich_text?.[0]?.plain_text ||
        undefined;

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

      // 9. Date Applied
      const date_applied =
        props['Application/ Inquiry Date']?.date?.start ||
        props['Date Applied']?.date?.start ||
        new Date().toISOString();

      // 10. Notes
      const notesParts = [
        props['Post Notes']?.rich_text?.[0]?.plain_text,
        props['Information']?.rich_text?.[0]?.plain_text,
        props.Notes?.rich_text?.[0]?.plain_text,
      ].filter(Boolean);
      const notes = notesParts.length > 0 ? notesParts.join('\n\n') : undefined;

      const company = await getOrCreateCompany(companyName);

      const existingApp = await getApplicationByNotionId(pageId);

      if (existingApp) {
        await updateApplication(existingApp.id, {
          company_id: company.id,
          company_name: company.name,
          company_logo: company.logo_url,
          role_title: roleTitle,
          status,
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
        await createApplication({
          company_id: company.id,
          company_name: company.name,
          company_logo: company.logo_url,
          role_title: roleTitle,
          status,
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
      }
      syncedCount++;
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

  const allApps = await getApplications();
  let pushedCount = 0;

  for (const app of allApps) {
    const isEligible = await isAppEligibleForNotionSync(app);
    if (!isEligible) {
      continue;
    }
    if (app.sync_status === 'PENDING' || !app.notion_page_id) {
      await pushApplicationToNotion(app);
      pushedCount++;
    }
  }

  return {
    success: true,
    pulled: pullResult.count,
    pushed: pushedCount,
    timestamp: new Date().toISOString(),
  };
}
