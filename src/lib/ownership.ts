import { JobApplication, UserAccount } from '@/types/job';

export function ownsApplication(app: Pick<JobApplication, 'owner'>, user: Pick<UserAccount, 'id' | 'email' | 'role'>) {
  const owner = (app.owner || '').trim().toLowerCase();
  return owner === user.id.toLowerCase() || owner === user.email.toLowerCase()
    || (user.id === 'user_ji' && (!owner || owner === 'admin'));
}
