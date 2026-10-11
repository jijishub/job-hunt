export type RoleFit = 'STRONG' | 'POSSIBLE' | 'WEAK';
export interface RoleFitAnalysis { preference_alignment?: 'ALIGNED' | 'MIXED' | 'MISALIGNED' | 'UNKNOWN'; preference_notes?: string; fit: RoleFit; explanation: string; strengths: string[]; gaps: string[]; analyzed_at: string; }

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
  id: string;
  company_id: string;
  company_name: string;
  company_logo?: string;
  stage_history?: { status: ApplicationStatus; notion_status?: string; at: string }[];
  analytics_stage?: import('@/lib/analytics-stages').AnalyticsStage | null;
  not_proceeding?: boolean;
  role_title: string;
  job_description?: string;
  role_fit?: RoleFit | null;
  role_fit_source?: 'manual' | 'ai' | null;
  role_fit_analysis?: RoleFitAnalysis | null;
  status: ApplicationStatus;
  notion_status?: string;
  service?: string;
  information?: string;
  priority: Priority;
  job_type: JobType;
  work_model: WorkModel;
  location?: string;
  salary_min?: number;
  salary_max?: number;
  salary_currency: string;
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


