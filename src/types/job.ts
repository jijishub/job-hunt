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

export type SyncStatus = 'SYNCED' | 'PENDING' | 'ERROR';

export interface Company {
  id: string;
  name: string;
  logo_url?: string;
  website?: string;
  industry?: string;
  created_at: string;
  updated_at: string;
}

export interface JobApplication {
  id: string;
  company_id: string;
  company_name: string;
  company_logo?: string;
  role_title: string;
  status: ApplicationStatus;
  priority: Priority;
  job_type: JobType;
  work_model: WorkModel;
  location?: string;
  salary_min?: number;
  salary_max?: number;
  salary_currency: string;
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


