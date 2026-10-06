import { Company, JobApplication } from '@/types/job';
import fs from 'fs';
import path from 'path';
import { neon } from '@neondatabase/serverless';

const isServer = typeof window === 'undefined';

const DATA_DIR = path.join(process.cwd(), '.data');
const DB_FILE = path.join(DATA_DIR, 'db.json');

interface LocalDatabase {
  companies: Company[];
  applications: JobApplication[];
}

const INITIAL_COMPANIES: Company[] = [
  {
    id: 'c1',
    name: 'Notion',
    logo_url: 'https://www.google.com/s2/favicons?domain=notion.so&sz=128',
    website: 'https://notion.so',
    industry: 'Productivity Software',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: 'c2',
    name: 'Figma',
    logo_url: 'https://www.google.com/s2/favicons?domain=figma.com&sz=128',
    website: 'https://figma.com',
    industry: 'Design Tools',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: 'c3',
    name: 'Vercel',
    logo_url: 'https://www.google.com/s2/favicons?domain=vercel.com&sz=128',
    website: 'https://vercel.com',
    industry: 'Cloud & Developer Platform',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: 'c4',
    name: 'Linear',
    logo_url: 'https://www.google.com/s2/favicons?domain=linear.app&sz=128',
    website: 'https://linear.app',
    industry: 'Issue Tracking',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: 'c5',
    name: 'Stripe',
    logo_url: 'https://www.google.com/s2/favicons?domain=stripe.com&sz=128',
    website: 'https://stripe.com',
    industry: 'Fintech',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
];

const INITIAL_APPLICATIONS: JobApplication[] = [
  {
    id: 'app-1',
    company_id: 'c1',
    company_name: 'Notion',
    company_logo: 'https://www.google.com/s2/favicons?domain=notion.so&sz=128',
    role_title: 'Product Engineer, Frontend',
    status: 'INTERVIEWING',
    priority: 'DREAM',
    job_type: 'FULL_TIME',
    work_model: 'REMOTE',
    location: 'Remote (Worldwide)',
    salary_min: 150000,
    salary_max: 180000,
    salary_currency: 'USD',
    job_url: 'https://notion.so/careers',
    contact_name: 'Sarah Chen (Senior Recruiter)',
    contact_email: 'sarah@notion.so',
    date_applied: new Date(Date.now() - 5 * 86400000).toISOString(),
    notes: 'Completed recruiter screening call! Next round is technical architecture discussion with the frontend team lead next Tuesday.',
    sync_status: 'SYNCED',
    created_at: new Date(Date.now() - 6 * 86400000).toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: 'app-2',
    company_id: 'c2',
    company_name: 'Figma',
    company_logo: 'https://www.google.com/s2/favicons?domain=figma.com&sz=128',
    role_title: 'UI Design Systems Engineer',
    status: 'SCREENING',
    priority: 'HIGH',
    job_type: 'FULL_TIME',
    work_model: 'HYBRID',
    location: 'San Francisco, CA / Remote',
    salary_min: 160000,
    salary_max: 195000,
    salary_currency: 'USD',
    job_url: 'https://figma.com/careers',
    contact_name: 'Alex Rivera',
    date_applied: new Date(Date.now() - 2 * 86400000).toISOString(),
    notes: 'Submitted tailored portfolio and interactive component showcase. Recruiter reached out to schedule initial 30min intro.',
    sync_status: 'SYNCED',
    created_at: new Date(Date.now() - 3 * 86400000).toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: 'app-3',
    company_id: 'c3',
    company_name: 'Vercel',
    company_logo: 'https://www.google.com/s2/favicons?domain=vercel.com&sz=128',
    role_title: 'Developer Experience Specialist',
    status: 'OFFER',
    priority: 'HIGH',
    job_type: 'FULL_TIME',
    work_model: 'REMOTE',
    location: 'Remote',
    salary_min: 170000,
    salary_max: 200000,
    salary_currency: 'USD',
    job_url: 'https://vercel.com/careers',
    contact_name: 'Elena Rostova',
    date_applied: new Date(Date.now() - 14 * 86400000).toISOString(),
    notes: 'Received official offer letter! Reviewing equity package and benefits package before Friday deadline.',
    sync_status: 'SYNCED',
    created_at: new Date(Date.now() - 15 * 86400000).toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: 'app-4',
    company_id: 'c4',
    company_name: 'Linear',
    company_logo: 'https://www.google.com/s2/favicons?domain=linear.app&sz=128',
    role_title: 'Fullstack Web Engineer',
    status: 'LEAD',
    priority: 'DREAM',
    job_type: 'FULL_TIME',
    work_model: 'REMOTE',
    location: 'Remote (Anywhere)',
    salary_currency: 'USD',
    job_url: 'https://linear.app/careers',
    notes: 'Need to polish custom portfolio demo showcasing keyboard shortcuts and smooth micro-interactions before applying.',
    sync_status: 'PENDING',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: 'app-5',
    company_id: 'c5',
    company_name: 'Stripe',
    company_logo: 'https://www.google.com/s2/favicons?domain=stripe.com&sz=128',
    role_title: 'Frontend Engineer - Dashboard',
    status: 'APPLIED',
    priority: 'MEDIUM',
    job_type: 'FULL_TIME',
    work_model: 'REMOTE',
    location: 'Remote',
    salary_min: 140000,
    salary_max: 175000,
    salary_currency: 'USD',
    job_url: 'https://stripe.com/jobs',
    date_applied: new Date(Date.now() - 1 * 86400000).toISOString(),
    notes: 'Applied via employee referral from college alumni network.',
    sync_status: 'SYNCED',
    created_at: new Date(Date.now() - 1 * 86400000).toISOString(),
    updated_at: new Date().toISOString(),
  },
];

function getPostgresClient() {
  const connectionString = process.env.POSTGRES_URL || process.env.DATABASE_URL;
  if (!connectionString) return null;
  return neon(connectionString);
}

function readLocalDb(): LocalDatabase {
  if (!isServer) return { companies: [], applications: [] };
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    if (!fs.existsSync(DB_FILE)) {
      const initial: LocalDatabase = {
        companies: INITIAL_COMPANIES,
        applications: INITIAL_APPLICATIONS,
      };
      fs.writeFileSync(DB_FILE, JSON.stringify(initial, null, 2), 'utf-8');
      return initial;
    }
    const content = fs.readFileSync(DB_FILE, 'utf-8');
    return JSON.parse(content) as LocalDatabase;
  } catch (error) {
    console.error('Error reading local db file:', error);
    return { companies: INITIAL_COMPANIES, applications: INITIAL_APPLICATIONS };
  }
}

function writeLocalDb(data: LocalDatabase): void {
  if (!isServer) return;
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2), 'utf-8');
  } catch (error) {
    console.error('Error writing local db file:', error);
  }
}

let schemaInitialized = false;
async function initPostgresSchema(sql: any) {
  if (schemaInitialized) return;
  try {
    await sql`
      CREATE TABLE IF NOT EXISTS companies (
        id TEXT PRIMARY KEY,
        name TEXT UNIQUE NOT NULL,
        logo_url TEXT,
        website TEXT,
        industry TEXT,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      );
    `;
    await sql`
      CREATE TABLE IF NOT EXISTS applications (
        id TEXT PRIMARY KEY,
        company_id TEXT REFERENCES companies(id) ON DELETE CASCADE,
        company_name TEXT NOT NULL,
        company_logo TEXT,
        role_title TEXT NOT NULL,
        status TEXT NOT NULL,
        priority TEXT NOT NULL,
        job_type TEXT NOT NULL,
        work_model TEXT NOT NULL,
        location TEXT,
        salary_min NUMERIC,
        salary_max NUMERIC,
        salary_currency TEXT DEFAULT 'USD',
        job_url TEXT,
        contact_name TEXT,
        contact_email TEXT,
        date_applied TIMESTAMPTZ,
        follow_up_date TIMESTAMPTZ,
        notes TEXT,
        notion_page_id TEXT,
        last_synced_at TIMESTAMPTZ,
        sync_status TEXT DEFAULT 'PENDING',
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      );
    `;
    schemaInitialized = true;
  } catch (err) {
    console.error('Postgres schema init error:', err);
  }
}

export async function getCompanies(): Promise<Company[]> {
  const sql = getPostgresClient();
  if (sql) {
    await initPostgresSchema(sql);
    const rows = await sql`SELECT * FROM companies ORDER BY name ASC;`;
    return rows as Company[];
  }
  const db = readLocalDb();
  return db.companies.sort((a, b) => a.name.localeCompare(b.name));
}

export async function getOrCreateCompany(
  name: string,
  logo_url?: string,
  website?: string
): Promise<Company> {
  const trimmedName = name.trim();
  const sql = getPostgresClient();
  if (sql) {
    await initPostgresSchema(sql);
    const existing = await sql`SELECT * FROM companies WHERE LOWER(name) = LOWER(${trimmedName}) LIMIT 1;`;
    if (existing.length > 0) {
      if (logo_url && !existing[0].logo_url) {
        await sql`UPDATE companies SET logo_url = ${logo_url}, updated_at = NOW() WHERE id = ${existing[0].id};`;
        existing[0].logo_url = logo_url;
      }
      return existing[0] as Company;
    }
    const newId = `c_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const now = new Date().toISOString();
    const resolvedLogo =
      logo_url ||
      (website
        ? `https://www.google.com/s2/favicons?domain=${website.replace(/^https?:\/\//, '')}&sz=128`
        : undefined);
    const inserted = await sql`
      INSERT INTO companies (id, name, logo_url, website, created_at, updated_at)
      VALUES (${newId}, ${trimmedName}, ${resolvedLogo || null}, ${website || null}, ${now}, ${now})
      RETURNING *;
    `;
    return inserted[0] as Company;
  }

  const db = readLocalDb();
  const existing = db.companies.find(
    (c) => c.name.toLowerCase() === trimmedName.toLowerCase()
  );
  if (existing) {
    if (logo_url && !existing.logo_url) {
      existing.logo_url = logo_url;
      existing.updated_at = new Date().toISOString();
      writeLocalDb(db);
    }
    return existing;
  }

  const resolvedLogo =
    logo_url ||
    (website
      ? `https://www.google.com/s2/favicons?domain=${website.replace(/^https?:\/\//, '')}&sz=128`
      : undefined);

  const newCompany: Company = {
    id: `c_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    name: trimmedName,
    logo_url: resolvedLogo,
    website,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
  db.companies.push(newCompany);
  writeLocalDb(db);
  return newCompany;
}

export async function updateCompany(id: string, updates: Partial<Company>): Promise<Company | null> {
  const sql = getPostgresClient();
  if (sql) {
    await initPostgresSchema(sql);
    const existing = await sql`SELECT * FROM companies WHERE id = ${id} LIMIT 1;`;
    if (existing.length === 0) return null;
    const name = updates.name ?? existing[0].name;
    const logo_url = updates.logo_url ?? existing[0].logo_url;
    const website = updates.website ?? existing[0].website;
    const industry = updates.industry ?? existing[0].industry;
    const updated = await sql`
      UPDATE companies
      SET name = ${name}, logo_url = ${logo_url}, website = ${website}, industry = ${industry}, updated_at = NOW()
      WHERE id = ${id}
      RETURNING *;
    `;
    return updated[0] as Company;
  }

  const db = readLocalDb();
  const index = db.companies.findIndex((c) => c.id === id);
  if (index === -1) return null;
  const updatedCompany = {
    ...db.companies[index],
    ...updates,
    updated_at: new Date().toISOString(),
  };
  db.companies[index] = updatedCompany;

  if (updates.name || updates.logo_url) {
    db.applications = db.applications.map((app) => {
      if (app.company_id === id) {
        return {
          ...app,
          company_name: updates.name ?? app.company_name,
          company_logo: updates.logo_url ?? app.company_logo,
        };
      }
      return app;
    });
  }

  writeLocalDb(db);
  return updatedCompany;
}

export async function deleteCompany(id: string): Promise<boolean> {
  const sql = getPostgresClient();
  if (sql) {
    await initPostgresSchema(sql);
    await sql`DELETE FROM companies WHERE id = ${id};`;
    return true;
  }
  const db = readLocalDb();
  db.companies = db.companies.filter((c) => c.id !== id);
  db.applications = db.applications.filter((a) => a.company_id !== id);
  writeLocalDb(db);
  return true;
}

export async function getApplications(): Promise<JobApplication[]> {
  const sql = getPostgresClient();
  if (sql) {
    await initPostgresSchema(sql);
    const rows = await sql`SELECT * FROM applications ORDER BY updated_at DESC;`;
    return rows as JobApplication[];
  }
  const db = readLocalDb();
  return db.applications.sort(
    (a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
  );
}

export async function getApplicationById(id: string): Promise<JobApplication | null> {
  const sql = getPostgresClient();
  if (sql) {
    await initPostgresSchema(sql);
    const rows = await sql`SELECT * FROM applications WHERE id = ${id} LIMIT 1;`;
    return (rows[0] as JobApplication) || null;
  }
  const db = readLocalDb();
  return db.applications.find((a) => a.id === id) || null;
}

export async function getApplicationByNotionId(notionPageId: string): Promise<JobApplication | null> {
  const sql = getPostgresClient();
  if (sql) {
    await initPostgresSchema(sql);
    const rows = await sql`SELECT * FROM applications WHERE notion_page_id = ${notionPageId} LIMIT 1;`;
    return (rows[0] as JobApplication) || null;
  }
  const db = readLocalDb();
  return db.applications.find((a) => a.notion_page_id === notionPageId) || null;
}

export async function createApplication(
  data: Omit<JobApplication, 'id' | 'created_at' | 'updated_at'> & { id?: string }
): Promise<JobApplication> {
  const id = data.id || `app_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  const now = new Date().toISOString();

  const newApp: JobApplication = {
    ...data,
    id,
    created_at: now,
    updated_at: now,
  };

  const sql = getPostgresClient();
  if (sql) {
    await initPostgresSchema(sql);
    const inserted = await sql`
      INSERT INTO applications (
        id, company_id, company_name, company_logo, role_title, status, priority,
        job_type, work_model, location, salary_min, salary_max, salary_currency,
        job_url, contact_name, contact_email, date_applied, follow_up_date, notes,
        notion_page_id, last_synced_at, sync_status, created_at, updated_at
      ) VALUES (
        ${newApp.id}, ${newApp.company_id}, ${newApp.company_name}, ${newApp.company_logo || null},
        ${newApp.role_title}, ${newApp.status}, ${newApp.priority}, ${newApp.job_type},
        ${newApp.work_model}, ${newApp.location || null}, ${newApp.salary_min || null},
        ${newApp.salary_max || null}, ${newApp.salary_currency}, ${newApp.job_url || null},
        ${newApp.contact_name || null}, ${newApp.contact_email || null},
        ${newApp.date_applied || null}, ${newApp.follow_up_date || null},
        ${newApp.notes || null}, ${newApp.notion_page_id || null},
        ${newApp.last_synced_at || null}, ${newApp.sync_status}, ${now}, ${now}
      )
      RETURNING *;
    `;
    return inserted[0] as JobApplication;
  }

  const db = readLocalDb();
  db.applications.unshift(newApp);
  writeLocalDb(db);
  return newApp;
}

export async function updateApplication(
  id: string,
  updates: Partial<JobApplication>
): Promise<JobApplication | null> {
  const sql = getPostgresClient();
  if (sql) {
    await initPostgresSchema(sql);
    const existing = await sql`SELECT * FROM applications WHERE id = ${id} LIMIT 1;`;
    if (existing.length === 0) return null;
    const current = existing[0];
    const merged = { ...current, ...updates, updated_at: new Date().toISOString() };

    const updated = await sql`
      UPDATE applications SET
        company_id = ${merged.company_id},
        company_name = ${merged.company_name},
        company_logo = ${merged.company_logo || null},
        role_title = ${merged.role_title},
        status = ${merged.status},
        priority = ${merged.priority},
        job_type = ${merged.job_type},
        work_model = ${merged.work_model},
        location = ${merged.location || null},
        salary_min = ${merged.salary_min || null},
        salary_max = ${merged.salary_max || null},
        salary_currency = ${merged.salary_currency || 'USD'},
        job_url = ${merged.job_url || null},
        contact_name = ${merged.contact_name || null},
        contact_email = ${merged.contact_email || null},
        date_applied = ${merged.date_applied || null},
        follow_up_date = ${merged.follow_up_date || null},
        notes = ${merged.notes || null},
        notion_page_id = ${merged.notion_page_id || null},
        last_synced_at = ${merged.last_synced_at || null},
        sync_status = ${merged.sync_status || 'PENDING'},
        updated_at = NOW()
      WHERE id = ${id}
      RETURNING *;
    `;
    return updated[0] as JobApplication;
  }

  const db = readLocalDb();
  const index = db.applications.findIndex((a) => a.id === id);
  if (index === -1) return null;
  const updatedApp: JobApplication = {
    ...db.applications[index],
    ...updates,
    updated_at: new Date().toISOString(),
  };
  db.applications[index] = updatedApp;
  writeLocalDb(db);
  return updatedApp;
}

export async function deleteApplication(id: string): Promise<boolean> {
  const sql = getPostgresClient();
  if (sql) {
    await initPostgresSchema(sql);
    await sql`DELETE FROM applications WHERE id = ${id};`;
    return true;
  }
  const db = readLocalDb();
  db.applications = db.applications.filter((a) => a.id !== id);
  writeLocalDb(db);
  return true;
}

