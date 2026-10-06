import { Client } from '@notionhq/client';
import { JobApplication, ApplicationStatus, Priority, WorkModel } from '@/types/job';
import {
  getApplications,
  createApplication,
  updateApplication,
  getApplicationByNotionId,
  getOrCreateCompany,
} from './db';

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
    return {
      success: true,
      configured: true,
      databaseTitle: (db as any).title?.[0]?.plain_text || 'OJT Applications Database',
    };
  } catch (error: any) {
    // Check if any database is accessible via search
    try {
      const search = await (notion as any).search({ page_size: 10 });
      if (search.results && search.results.length > 0) {
        const found = search.results.find((r: any) => r.object === 'data_source' || r.object === 'database') || search.results[0];
        const title = (found as any).title?.[0]?.plain_text || 'OJT Applications';
        return {
          success: true,
          configured: true,
          databaseTitle: title,
          databaseId: found.id,
        };
      }
    } catch (sErr) {
      // ignore
    }
    return {
      success: false,
      configured: true,
      message: 'Please share your Notion database with "Job Tracker": Open Notion -> click "···" at top right -> "Connect to" -> select "Job Tracker".',
    };
  }
}

function buildNotionProperties(app: JobApplication) {
  const properties: Record<string, any> = {
    Name: {
      title: [
        {
          text: {
            content: `${app.role_title} @ ${app.company_name}`,
          },
        },
      ],
    },
    Role: {
      rich_text: [
        {
          text: {
            content: app.role_title,
          },
        },
      ],
    },
    Company: {
      select: {
        name: app.company_name,
      },
    },
    Status: {
      select: {
        name: app.status,
      },
    },
    Priority: {
      select: {
        name: app.priority,
      },
    },
    'Work Model': {
      select: {
        name: app.work_model,
      },
    },
  };

  if (app.location) {
    properties['Location'] = {
      rich_text: [{ text: { content: app.location } }],
    };
  }

  if (app.job_url) {
    properties['Job URL'] = {
      url: app.job_url,
    };
  }

  if (app.salary_min || app.salary_max) {
    const salaryText = [
      app.salary_min ? `${app.salary_currency} ${app.salary_min.toLocaleString()}` : '',
      app.salary_max ? `- ${app.salary_currency} ${app.salary_max.toLocaleString()}` : '',
    ]
      .filter(Boolean)
      .join(' ');
    properties['Salary'] = {
      rich_text: [{ text: { content: salaryText } }],
    };
  }

  if (app.date_applied) {
    properties['Date Applied'] = {
      date: {
        start: app.date_applied.split('T')[0],
      },
    };
  }

  return properties;
}

export async function pushApplicationToNotion(app: JobApplication): Promise<string | null> {
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
    return { success: false, count: 0, error: 'Notion credentials not set' };
  }

  try {
    const response = await (notion.databases as any).query({
      database_id: databaseId,
      page_size: 100,
    });

    let syncedCount = 0;

    for (const page of response.results) {
      const pageId = page.id;
      const props = page.properties;

      const titleProp = Object.values(props).find((p: any) => p.type === 'title') as any;
      const rawTitle =
        titleProp?.title?.[0]?.plain_text ||
        props.Name?.title?.[0]?.plain_text ||
        props.Title?.title?.[0]?.plain_text ||
        'Untitled Role';
      
      const roleTitle =
        props.Role?.rich_text?.[0]?.plain_text ||
        props.Position?.rich_text?.[0]?.plain_text ||
        rawTitle.split('@')[0]?.trim() ||
        rawTitle;

      const companyProp = props.Company || props['Company Name'] || props.Employer;
      const companyName =
        companyProp?.select?.name ||
        companyProp?.rich_text?.[0]?.plain_text ||
        rawTitle.split('@')[1]?.trim() ||
        'Company';

      const statusProp = props.Status || props.Stage || props['Application Status'];
      const statusRaw = (statusProp?.select?.name || statusProp?.status?.name || 'LEAD').toUpperCase();
      let status: ApplicationStatus = 'LEAD';
      if (statusRaw.includes('APPL')) status = 'APPLIED';
      else if (statusRaw.includes('SCREEN') || statusRaw.includes('PHONE')) status = 'SCREENING';
      else if (statusRaw.includes('INTERVIEW')) status = 'INTERVIEWING';
      else if (statusRaw.includes('OFFER')) status = 'OFFER';
      else if (statusRaw.includes('ACCEPT')) status = 'ACCEPTED';
      else if (statusRaw.includes('REJECT')) status = 'REJECTED';
      else if (statusRaw.includes('WITHDRAW')) status = 'WITHDRAWN';

      const priorityProp = props.Priority || props.Rating;
      const priorityRaw = (priorityProp?.select?.name || 'MEDIUM').toUpperCase();
      let priority: Priority = 'MEDIUM';
      if (priorityRaw.includes('DREAM') || priorityRaw.includes('⭐')) priority = 'DREAM';
      else if (priorityRaw.includes('HIGH')) priority = 'HIGH';
      else if (priorityRaw.includes('LOW')) priority = 'LOW';

      const workModelProp = props['Work Model'] || props.Workplace || props.Setup;
      const workModelRaw = (workModelProp?.select?.name || 'REMOTE').toUpperCase();
      let work_model: WorkModel = 'REMOTE';
      if (workModelRaw.includes('HYBRID')) work_model = 'HYBRID';
      else if (workModelRaw.includes('ON-SITE') || workModelRaw.includes('ONSITE')) work_model = 'ON_SITE';

      const location = props.Location?.rich_text?.[0]?.plain_text || undefined;
      const job_url = props['Job URL']?.url || undefined;
      const date_applied = props['Date Applied']?.date?.start || undefined;

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
          date_applied,
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
          job_type: 'FULL_TIME',
          work_model,
          location,
          salary_currency: 'USD',
          job_url,
          date_applied,
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

