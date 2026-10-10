import NextAuth from 'next-auth';
import { getAuthOptions } from '@/lib/auth-options';
async function authHandler(req: any, res: any) { return NextAuth(req, res, getAuthOptions(req)); }
export { authHandler as GET, authHandler as POST };
