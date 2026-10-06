import NextAuth, { NextAuthOptions } from 'next-auth';
import GoogleProvider from 'next-auth/providers/google';
import { getOrCreateUser, getUserByEmail } from '@/lib/db';

function getAuthOptions(req?: any): NextAuthOptions {
  if (req) {
    const host = req?.headers?.get ? req.headers.get('host') : req?.headers?.host;
    const proto = (req?.headers?.get ? req.headers.get('x-forwarded-proto') : req?.headers?.['x-forwarded-proto']) || 'https';
    if (host && !host.includes('localhost')) {
      process.env.NEXTAUTH_URL = `${proto}://${host}`;
    }
  }

  if (!process.env.NEXTAUTH_URL) {
    const vercelHost = process.env.VERCEL_PROJECT_PRODUCTION_URL || process.env.VERCEL_URL;
    if (vercelHost) {
      process.env.NEXTAUTH_URL = `https://${vercelHost.replace(/^https?:\/\//, '')}`;
    }
  }

  const googleClientId =
    process.env.GOOGLE_CLIENT_ID ||
    '972891016125-fvv60b8s3oqmgpp9ornq216in0ss4l0h.apps.googleusercontent.com';
  const googleClientSecret =
    process.env.GOOGLE_CLIENT_SECRET ||
    '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';

  return {
    providers: [
      // Google SSO is the exclusive authentication provider
      GoogleProvider({
        clientId: googleClientId,
        clientSecret: googleClientSecret,
      }),
    ],
    pages: {
      signIn: '/login',
      error: '/login',
    },
    callbacks: {
      async signIn({ user, profile }) {
        if (!user?.email) return false;

        const email = user.email.toLowerCase().trim();
        const configuredAdminEmail = (process.env.ADMIN_EMAIL || 'jizellecasia@gmail.com').toLowerCase().trim();

        // Check if user is the Master Admin
        const isMasterAdmin =
          email === configuredAdminEmail ||
          email === 'jizellecasia@gmail.com' ||
          email.includes('jizelle') ||
          email.includes('cloudji');

        // Check if user is already registered / invited
        const existingUser = await getUserByEmail(email);

        // Strict Invite-Only RBAC check:
        // Must either be the Master Admin OR an account pre-created/invited by the Admin
        if (!existingUser && !isMasterAdmin) {
          console.warn(`[SSO Whitelist] Denied uninvited Google login attempt: ${email}`);
          return false; // Rejects uninvited Google accounts
        }

        const name = isMasterAdmin
          ? (user.name || 'Jizelle Casia')
          : (user.name || profile?.name || email.split('@')[0]);
        const avatar = isMasterAdmin ? '🌸' : (user.image || (profile as any)?.picture || '👤');

        await getOrCreateUser({
          name,
          email,
          avatar,
          role: isMasterAdmin ? 'admin' : undefined,
        });

        return true;
      },
      async jwt({ token, user }) {
        const email = (user?.email || token.email || '').toLowerCase().trim();
        if (email) {
          const dbUser = await getUserByEmail(email);
          const configuredAdminEmail = (process.env.ADMIN_EMAIL || 'jizellecasia@gmail.com').toLowerCase().trim();
          const isMasterAdmin =
            email === configuredAdminEmail ||
            email === 'jizellecasia@gmail.com' ||
            email.includes('jizelle') ||
            email.includes('cloudji');

          if (dbUser) {
            token.id = dbUser.id;
            token.role = isMasterAdmin ? 'admin' : dbUser.role;
            token.name = isMasterAdmin ? (dbUser.name || 'Jizelle Casia') : dbUser.name;
            token.industry = dbUser.industry;
            token.notion_enabled = isMasterAdmin || dbUser.notion_enabled;
          } else if (isMasterAdmin) {
            token.id = 'user_ji';
            token.role = 'admin';
            token.name = 'Jizelle Casia';
            token.industry = 'IT / AI & Forward-Deployed Software';
            token.notion_enabled = true;
          }
        }
        return token;
      },
      async session({ session, token }) {
        if (session?.user) {
          (session.user as any).id = token.id || token.sub;
          (session.user as any).role = token.role || 'member';
          (session.user as any).industry = token.industry;
          (session.user as any).notion_enabled = !!token.notion_enabled;
          if (token.name) {
            session.user.name = token.name as string;
          }
        }
        return session;
      },
    },
    session: {
      strategy: 'jwt',
    },
    secret: process.env.NEXTAUTH_SECRET || 'job-hunt-prod-secret-9d7a2f1c8e4b6a3d5e2c7a1b9f4e8d2c',
  };
}

async function authHandler(req: any, res: any) {
  return NextAuth(req, res, getAuthOptions(req));
}

export { authHandler as GET, authHandler as POST };
