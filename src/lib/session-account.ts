import { getServerSession } from 'next-auth';
import { getAuthOptions } from './auth-options';
import { getUserByEmail } from './db';

export async function getSessionAccount() {
  const session = await getServerSession(getAuthOptions());
  if (!session?.user?.email) return null;
  return getUserByEmail(session.user.email);
}
