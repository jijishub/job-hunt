import { readFile } from 'node:fs/promises';
import path from 'node:path';

export interface PrivateRpaProfile {
  basic_information: { name: string; mobile: string; email: string; preferred_work_location: string };
  self_introduction: string;
  [key: string]: unknown;
}
export async function readPrivateRpaProfile(): Promise<PrivateRpaProfile | null> {
  try {
    const raw = process.env.RPA_PROFILE_JSON || await readFile(path.join(process.cwd(), 'references/rpa/bytedance-profile.json'), 'utf8');
    const value = JSON.parse(raw);
    if (!value || typeof value !== 'object' || Array.isArray(value) || typeof value.self_introduction !== 'string'
      || !['name', 'mobile', 'email', 'preferred_work_location'].every(key => typeof value.basic_information?.[key] === 'string')) return null;
    return value;
  } catch {
    return null;
  }
}
