export type RoleFit = 'STRONG' | 'POSSIBLE' | 'WEAK';
export type SeniorityLevel = 'INTERNSHIP_TRAINEE' | 'GRADUATE_ENTRY_LEVEL' | 'JUNIOR' | 'ASSOCIATE' | 'MID_LEVEL' | 'SENIOR' | 'LEAD_PRINCIPAL' | 'UNSPECIFIED';
export interface RoleFitAnalysis {
  preference_alignment?: 'ALIGNED' | 'MIXED' | 'MISALIGNED' | 'UNKNOWN'; preference_notes?: string;
  fit: RoleFit; explanation: string; strengths: string[]; gaps: string[]; analyzed_at: string;
  origin?: 'extension' | 'server';
  extension_context?: {
    assessment_id: string; model: string; prompt_version: string; posting_hash: string;
    resume_id: string; resume_label: string | null; resume_hash: string; preferences_hash: string | null;
  };
}

export type ApplicationStatus =
  | 'LEAD'
  | 'APPLIED'
  | 'SCREENING'
  | 'INTERVIEWING'
  | 'OFFER'
  | 'ACCEPTED'
  | 'REJECTED'
  | 'WITHDRAWN';

export type Priority = 'LOW' | 'MEDIUM' | 'HIGH' | 'DREAM';

export type JobType = 'FULL_TIME' | 'PART_TIME' | 'CONTRACT' | 'INTERNSHIP';

export type WorkModel = 'REMOTE' | 'HYBRID' | 'ON_SITE';
export type OfferPayPeriod = 'MONTHLY' | 'ANNUAL' | 'HOURLY';

export type SyncStatus = 'SYNCED' | 'PENDING' | 'ERROR';

export interface Company {
  id: string;
  name: string;
  logo_url?: string;
  website?: string;
  industry?: string;
  created_by?: string;
  created_at: string;
  updated_at: string;
}

export interface JobApplication {
  /** Server-managed revision; legacy records start at zero. */
  record_version?: number;
  /** Lightweight list record; hydrate through the detail endpoint before editing. */
  summary_only?: boolean;
  id: string;
  company_id: string | null;
  company_name: string;
  company_logo?: string;
  stage_history?: { status: ApplicationStatus; notion_status?: string; at: string }[];
  analytics_stage?: import('@/lib/analytics-stages').AnalyticsStage | null;
  not_proceeding?: boolean;
  role_title: string;
  seniority_level?: SeniorityLevel | null;
  seniority_level_source?: 'derived' | 'manual' | null;
  /** Historical metadata retained for compatibility; unused by current analytics. */
  role_family?: string | null;
  role_family_source?: 'derived' | 'manual' | null;
  job_platform?: string | null;
  first_response_at?: string | null;
  job_description?: string;
  role_fit?: RoleFit | null;
  role_fit_source?: 'manual' | 'ai' | null;
  role_fit_analysis?: RoleFitAnalysis | null;
  status: ApplicationStatus;
  notion_status?: string;
  service?: string;
  information?: string;
  priority: Priority;
  job_type: JobType | null;
  work_model: WorkModel | null;
  location?: string;
  salary_min?: number;
  salary_max?: number;
  salary_currency: string | null;
  offer_amount?: number | null;
  offer_currency?: string | null;
  offer_pay_period?: OfferPayPeriod | null;
  expected_salary_amount?: number | null;
  expected_salary_currency?: string | null;
  expected_salary_pay_period?: OfferPayPeriod | null;
  job_url?: string;
  source?: 'LINKEDIN' | 'JOBSTREET' | 'INDEED' | 'GOOGLE' | 'DIRECT' | 'OTHER';
  owner?: string;
  contact_name?: string;
  contact_email?: string;
  date_applied?: string;
  follow_up_date?: string;
  notes?: string;
  notion_page_id?: string;
  last_synced_at?: string;
  sync_status: SyncStatus;
  created_at: string;
  updated_at: string;
}

export interface NotionConfig {
  apiKey?: string;
  databaseId?: string;
  autoSync?: boolean;
}

export type UserRole = 'admin' | 'member';

export interface UserAccount {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  industry?: string;
  avatar?: string;
  notion_enabled: boolean;
  created_at: string;
  updated_at: string;
}


