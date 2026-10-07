import { Company, JobApplication, UserAccount, UserRole } from '@/types/job';
import fs from 'fs';
import path from 'path';
import { neon } from '@neondatabase/serverless';

const isServer = typeof window === 'undefined';

const DATA_DIR = process.env.VERCEL ? path.join('/tmp', '.data') : path.join(process.cwd(), '.data');
const DB_FILE = path.join(DATA_DIR, 'db.json');

interface LocalDatabase {
  companies: Company[];
  applications: JobApplication[];
  users: UserAccount[];
  statuses?: any[];
}

export const INITIAL_USERS: UserAccount[] = [
  {
    id: 'user_ji',
    name: 'Jizelle Casia',
    email: (process.env.ADMIN_EMAIL || 'jizellecasia@gmail.com').toLowerCase().trim(),
    role: 'admin',
    industry: 'IT / AI & Forward-Deployed Software',
    avatar: '🌸',
    notion_enabled: true,
    created_at: '2026-10-06T09:34:43.840Z',
    updated_at: '2026-10-06T11:47:20.892Z',
  },
];

const INITIAL_COMPANIES: Company[] = [];

const INITIAL_APPLICATIONS: JobApplication[] = [];

function getPostgresClient() {
  const connectionString = process.env.POSTGRES_URL || process.env.DATABASE_URL;
  if (!connectionString) return null;
  return neon(connectionString);
}

function readLocalDb(): LocalDatabase {
  if (!isServer) return { companies: [], applications: [], users: INITIAL_USERS };
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    if (!fs.existsSync(DB_FILE)) {
      const initial: LocalDatabase = {
        companies: [],
        applications: [],
        users: [...INITIAL_USERS],
      };
      fs.writeFileSync(DB_FILE, JSON.stringify(initial, null, 2), 'utf-8');
      return initial;
    }
    const content = fs.readFileSync(DB_FILE, 'utf-8');
    const parsed = JSON.parse(content) as LocalDatabase;
    if (!parsed.users || parsed.users.length === 0) {
      parsed.users = [...INITIAL_USERS];
      writeLocalDb(parsed);
    } else {
      // Purge legacy demo seed account from existing file
      const beforeLen = parsed.users.length;
      parsed.users = parsed.users.filter(
        (u) => u.id !== 'user_denise' && u.email?.toLowerCase() !== 'denise@hospitality.com'
      );
      if (parsed.users.length !== beforeLen) {
        writeLocalDb(parsed);
      }
    }
    return parsed;
  } catch (error) {
    console.error('Error reading local db file:', error);
    return { companies: [], applications: [], users: [] };
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
      CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        email TEXT UNIQUE NOT NULL,
        role TEXT NOT NULL DEFAULT 'member',
        industry TEXT,
        avatar TEXT,
        notion_enabled BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      );
    `;
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
        notion_status TEXT,
        service TEXT,
        information TEXT,
        priority TEXT NOT NULL,
        job_type TEXT NOT NULL,
        work_model TEXT NOT NULL,
        location TEXT,
        salary_min NUMERIC,
        salary_max NUMERIC,
        salary_currency TEXT DEFAULT 'USD',
        job_url TEXT,
        source TEXT DEFAULT 'DIRECT',
        owner TEXT DEFAULT 'admin',
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
    await sql`ALTER TABLE applications ADD COLUMN IF NOT EXISTS notion_status TEXT;`;
    await sql`ALTER TABLE applications ADD COLUMN IF NOT EXISTS service TEXT;`;
    await sql`ALTER TABLE applications ADD COLUMN IF NOT EXISTS information TEXT;`;
    await sql`ALTER TABLE companies ADD COLUMN IF NOT EXISTS created_by TEXT;`;

    await sql`
      CREATE TABLE IF NOT EXISTS custom_statuses (
        id TEXT PRIMARY KEY,
        name TEXT UNIQUE NOT NULL,
        color TEXT NOT NULL DEFAULT 'default',
        category TEXT NOT NULL DEFAULT 'APPLIED',
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
    `;

    // Always seed the Master Admin user (Jizelle)
    const adminEmail = (process.env.ADMIN_EMAIL || 'jizellecasia@gmail.com').toLowerCase().trim();
    await sql`
      INSERT INTO users (id, name, email, role, industry, avatar, notion_enabled, created_at, updated_at)
      VALUES (
        'user_ji',
        'Jizelle Casia',
        ${adminEmail},
        'admin',
        'IT / AI & Forward-Deployed Software',
        '🌸',
        TRUE,
        NOW(),
        NOW()
      )
      ON CONFLICT (email) DO UPDATE SET
        role = 'admin',
        notion_enabled = TRUE;
    `;

    // Ensure all non-master accounts in DB are strictly 'member' and notion_enabled = FALSE
    await sql`
      UPDATE users
      SET role = 'member', notion_enabled = FALSE
      WHERE LOWER(email) NOT IN (${adminEmail}, 'jizellecasia@gmail.com', 'jizelle.casia@gmail.com');
    `;

    // Purge legacy demo seed account (Denise) from DB so real user edits persist permanently
    await sql`
      DELETE FROM users
      WHERE id = 'user_denise' OR LOWER(email) = 'denise@hospitality.com';
    `;

    schemaInitialized = true;
  } catch (err) {
    console.error('Postgres schema init error:', err);
  }
}

export async function getCompanies(forUser?: string, isAdmin: boolean = false): Promise<Company[]> {
  const sql = getPostgresClient();
  if (sql) {
    await initPostgresSchema(sql);
    if (!isAdmin && forUser) {
      const normUser = forUser.toLowerCase().trim();
      const rows = await sql`
        SELECT * FROM companies 
        WHERE LOWER(created_by) = ${normUser}
        ORDER BY name ASC;
      `;
      return rows as Company[];
    }
    const rows = await sql`SELECT * FROM companies ORDER BY name ASC;`;
    return rows as Company[];
  }
  const db = readLocalDb();
  if (!isAdmin && forUser) {
    const normUser = forUser.toLowerCase().trim();
    return db.companies
      .filter((c: any) => c.created_by && c.created_by.toLowerCase().trim() === normUser)
      .sort((a, b) => a.name.localeCompare(b.name));
  }
  return db.companies.sort((a, b) => a.name.localeCompare(b.name));
}

export async function getOrCreateCompany(
  name: string,
  logo_url?: string,
  website?: string,
  created_by?: string
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
      INSERT INTO companies (id, name, logo_url, website, created_by, created_at, updated_at)
      VALUES (${newId}, ${trimmedName}, ${resolvedLogo || null}, ${website || null}, ${created_by || null}, ${now}, ${now})
      ON CONFLICT (name) DO UPDATE SET updated_at = NOW()
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
    created_by: created_by || undefined,
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
        id, company_id, company_name, company_logo, role_title, status, notion_status, service, information, priority,
        job_type, work_model, location, salary_min, salary_max, salary_currency,
        job_url, source, owner, contact_name, contact_email, date_applied, follow_up_date, notes,
        notion_page_id, last_synced_at, sync_status, created_at, updated_at
      ) VALUES (
        ${newApp.id}, ${newApp.company_id || null}, ${newApp.company_name}, ${newApp.company_logo || null},
        ${newApp.role_title}, ${newApp.status}, ${newApp.notion_status || null}, ${newApp.service || null}, ${newApp.information || null},
        ${newApp.priority}, ${newApp.job_type},
        ${newApp.work_model}, ${newApp.location || null}, ${newApp.salary_min || null},
        ${newApp.salary_max || null}, ${newApp.salary_currency}, ${newApp.job_url || null},
        ${newApp.source || 'DIRECT'}, ${newApp.owner || 'admin'},
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
        notion_status = ${merged.notion_status || null},
        service = ${merged.service || null},
        information = ${merged.information || null},
        priority = ${merged.priority},
        job_type = ${merged.job_type},
        work_model = ${merged.work_model},
        location = ${merged.location || null},
        salary_min = ${merged.salary_min || null},
        salary_max = ${merged.salary_max || null},
        salary_currency = ${merged.salary_currency || 'USD'},
        job_url = ${merged.job_url || null},
        source = ${merged.source || 'DIRECT'},
        owner = ${merged.owner || current.owner || 'admin'},
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

export async function clearAllApplications(): Promise<boolean> {
  const sql = getPostgresClient();
  if (sql) {
    await initPostgresSchema(sql);
    await sql`DELETE FROM applications;`;
    return true;
  }
  const db = readLocalDb();
  db.applications = [];
  writeLocalDb(db);
  return true;
}

// ==========================================
// USER ACCOUNTS & RBAC MANAGEMENT
// ==========================================

export async function getUsers(): Promise<UserAccount[]> {
  const sql = getPostgresClient();
  if (sql) {
    await initPostgresSchema(sql);
    const rows = await sql`SELECT * FROM users ORDER BY created_at ASC;`;

    // Auto-clean any legacy "(Ji)" names in existing DB rows
    for (const r of rows) {
      if (r.name && r.name.includes('(Ji)')) {
        const cleanName = r.name.replace(/\s*\(Ji\)/gi, '').trim() || 'Jizelle Casia';
        await sql`UPDATE users SET name = ${cleanName} WHERE id = ${r.id};`;
        r.name = cleanName;
      }
    }

    if (rows.length > 0) return rows as UserAccount[];

    // If database has 0 users, auto-seed from INITIAL_USERS
    const adminEmail = (process.env.ADMIN_EMAIL || 'jizellecasia@gmail.com').toLowerCase().trim();
    const defaultAdmin: UserAccount = {
      id: 'user_ji',
      name: 'Jizelle Casia',
      email: adminEmail,
      role: 'admin',
      industry: 'IT / AI & Forward-Deployed Software',
      avatar: '🌸',
      notion_enabled: true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    await sql`
      INSERT INTO users (id, name, email, role, industry, avatar, notion_enabled, created_at, updated_at)
      VALUES (${defaultAdmin.id}, ${defaultAdmin.name}, ${defaultAdmin.email}, ${defaultAdmin.role}, ${defaultAdmin.industry}, ${defaultAdmin.avatar}, ${defaultAdmin.notion_enabled}, NOW(), NOW())
      ON CONFLICT (email) DO UPDATE SET role = 'admin', notion_enabled = TRUE;
    `;
    return [defaultAdmin];
  }
  const db = readLocalDb();
  if (!db.users || db.users.length === 0) {
    db.users = [...INITIAL_USERS];
    writeLocalDb(db);
  }
  db.users.forEach((u) => {
    if (u.name && u.name.includes('(Ji)')) {
      u.name = u.name.replace(/\s*\(Ji\)/gi, '').trim() || 'Jizelle Casia';
    }
  });
  writeLocalDb(db);
  return db.users;
}

export async function getUserById(id: string): Promise<UserAccount | null> {
  const users = await getUsers();
  return users.find((u) => u.id === id) || null;
}

export async function getUserByEmail(email: string): Promise<UserAccount | null> {
  const users = await getUsers();
  const lower = email.trim().toLowerCase();
  return users.find((u) => u.email.toLowerCase() === lower) || null;
}

export async function getOrCreateUser(data: {
  name: string;
  email: string;
  avatar?: string;
  role?: UserRole;
  industry?: string;
}): Promise<UserAccount> {
  const lowerEmail = data.email.toLowerCase().trim();
  const adminConfig = (process.env.ADMIN_EMAIL || 'jizellecasia@gmail.com').toLowerCase().trim();
  const isMasterAdmin =
    lowerEmail === adminConfig ||
    lowerEmail === 'jizellecasia@gmail.com' ||
    lowerEmail === 'jizelle.casia@gmail.com';

  const existing = await getUserByEmail(data.email);
  if (existing) {
    // If a non-master user was mistakenly created as admin, forcefully demote to 'member' and disable Notion
    if (!isMasterAdmin && (existing.role === 'admin' || existing.notion_enabled)) {
      await updateUser(existing.id, { role: 'member', notion_enabled: false });
      existing.role = 'member';
      existing.notion_enabled = false;
    }
    if (data.name && data.name !== existing.name) {
      await updateUser(existing.id, { name: data.name, avatar: data.avatar || existing.avatar });
      return { ...existing, name: data.name, avatar: data.avatar || existing.avatar };
    }
    return existing;
  }

  const isAdmin = isMasterAdmin;

  const newUser: UserAccount = {
    id: `user_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
    name: data.name || (isAdmin ? 'Jizelle Casia' : 'Job Hunt Member'),
    email: lowerEmail,
    role: isAdmin ? 'admin' : 'member',
    industry: data.industry || (isAdmin ? 'IT / AI & Forward-Deployed Software' : 'General'),
    avatar: data.avatar || (isAdmin ? '🌸' : '👤'),
    notion_enabled: isAdmin,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  const sql = getPostgresClient();
  if (sql) {
    await initPostgresSchema(sql);
    await sql`
      INSERT INTO users (id, name, email, role, industry, avatar, notion_enabled, created_at, updated_at)
      VALUES (
        ${newUser.id}, ${newUser.name}, ${newUser.email}, ${newUser.role},
        ${newUser.industry || null}, ${newUser.avatar || null}, ${newUser.notion_enabled}, NOW(), NOW()
      )
      ON CONFLICT (email) DO UPDATE SET name = EXCLUDED.name, avatar = EXCLUDED.avatar
      RETURNING *;
    `;
    return newUser;
  }

  const db = readLocalDb();
  db.users.push(newUser);
  writeLocalDb(db);
  return newUser;
}

export async function createUser(data: Partial<UserAccount>): Promise<UserAccount> {
  const email = (data.email || `user_${Date.now()}@jobhunt.internal`).toLowerCase();
  const existing = await getUserByEmail(email);
  if (existing) {
    throw new Error('A user with this email already exists.');
  }

  const role = data.role || 'member';
  const newUser: UserAccount = {
    id: data.id || `user_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
    name: data.name || 'New Member',
    email,
    role,
    industry: data.industry || 'General',
    avatar: data.avatar || (role === 'admin' ? '🌸' : '👤'),
    notion_enabled: role === 'admin',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  const sql = getPostgresClient();
  if (sql) {
    await initPostgresSchema(sql);
    await sql`
      INSERT INTO users (id, name, email, role, industry, avatar, notion_enabled, created_at, updated_at)
      VALUES (
        ${newUser.id}, ${newUser.name}, ${newUser.email}, ${newUser.role},
        ${newUser.industry || null}, ${newUser.avatar || null}, ${newUser.notion_enabled}, NOW(), NOW()
      );
    `;
    return newUser;
  }

  const db = readLocalDb();
  db.users.push(newUser);
  writeLocalDb(db);
  return newUser;
}

export async function updateUser(id: string, updates: Partial<UserAccount>): Promise<UserAccount | null> {
  const sql = getPostgresClient();
  if (sql) {
    await initPostgresSchema(sql);
    const existing = await sql`SELECT * FROM users WHERE id = ${id} LIMIT 1;`;
    if (existing.length === 0) return null;
    const current = existing[0];
    const name = updates.name ?? current.name;
    const email = updates.email ? updates.email.toLowerCase() : current.email;
    const role = updates.role ?? current.role;
    const industry = updates.industry ?? current.industry;
    const avatar = updates.avatar ?? current.avatar;
    const notion_enabled = updates.notion_enabled ?? (role === 'admin');

    const updated = await sql`
      UPDATE users SET
        name = ${name},
        email = ${email},
        role = ${role},
        industry = ${industry || null},
        avatar = ${avatar || null},
        notion_enabled = ${notion_enabled},
        updated_at = NOW()
      WHERE id = ${id}
      RETURNING *;
    `;
    return updated[0] as UserAccount;
  }

  const db = readLocalDb();
  const index = db.users.findIndex((u) => u.id === id);
  if (index === -1) return null;
  const role = updates.role ?? db.users[index].role;
  const updatedUser: UserAccount = {
    ...db.users[index],
    ...updates,
    role,
    notion_enabled: updates.notion_enabled ?? (role === 'admin'),
    updated_at: new Date().toISOString(),
  };
  db.users[index] = updatedUser;
  writeLocalDb(db);
  return updatedUser;
}

export async function deleteUser(id: string): Promise<boolean> {
  const sql = getPostgresClient();
  if (sql) {
    await initPostgresSchema(sql);
    await sql`DELETE FROM users WHERE id = ${id};`;
    return true;
  }
  const db = readLocalDb();
  db.users = db.users.filter((u) => u.id !== id);
  writeLocalDb(db);
  return true;
}

// ==========================================
// CUSTOM STATUSES
// ==========================================

export async function getCustomStatuses(): Promise<any[]> {
  const sql = getPostgresClient();
  if (sql) {
    await initPostgresSchema(sql);
    const rows = await sql`SELECT * FROM custom_statuses ORDER BY created_at ASC;`;
    return rows;
  }
  const db = readLocalDb();
  return db.statuses || [];
}

export async function createCustomStatus(data: {
  name: string;
  color?: string;
  category?: string;
}): Promise<any> {
  const trimmed = data.name.trim();
  const id = `status_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
  const color = data.color || 'default';
  const category = data.category || 'APPLIED';

  const sql = getPostgresClient();
  if (sql) {
    await initPostgresSchema(sql);
    const inserted = await sql`
      INSERT INTO custom_statuses (id, name, color, category, created_at)
      VALUES (${id}, ${trimmed}, ${color}, ${category}, NOW())
      ON CONFLICT (name) DO UPDATE SET color = EXCLUDED.color, category = EXCLUDED.category
      RETURNING *;
    `;
    return inserted[0];
  }

  const db = readLocalDb();
  if (!db.statuses) db.statuses = [];
  const existingIndex = db.statuses.findIndex(
    (s: any) => s.name.toLowerCase() === trimmed.toLowerCase()
  );
  const statusObj = { id, name: trimmed, color, category, created_at: new Date().toISOString() };
  if (existingIndex >= 0) {
    db.statuses[existingIndex] = { ...db.statuses[existingIndex], ...statusObj };
  } else {
    db.statuses.push(statusObj);
  }
  writeLocalDb(db);
  return statusObj;
}

export async function deleteCustomStatus(id: string): Promise<boolean> {
  const sql = getPostgresClient();
  if (sql) {
    await initPostgresSchema(sql);
    await sql`DELETE FROM custom_statuses WHERE id = ${id};`;
    return true;
  }
  const db = readLocalDb();
  if (!db.statuses) return true;
  db.statuses = db.statuses.filter((s: any) => s.id !== id);
  writeLocalDb(db);
  return true;
}



