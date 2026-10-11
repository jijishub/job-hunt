import { getAdminEmail } from './admin-email';
import { NextAuthOptions } from 'next-auth';
import GoogleProvider from 'next-auth/providers/google';
import { getOrCreateUser, getUserByEmail } from '@/lib/db';

function sanitizeUrl(raw?: string): string | undefined {
  if (!raw) return undefined;
  let val = raw.trim();
  if (val.includes('=')) {
    val = val.substring(val.indexOf('=') + 1).trim();
  }
  val = val.replace(/^["']|["']$/g, '').trim();
  if (!val.startsWith('http://') && !val.startsWith('https://')) {
    val = `https://${val}`;
  }
  return val.replace(/\/+$/, '');
}

if (process.env.NEXTAUTH_URL) {
  process.env.NEXTAUTH_URL = sanitizeUrl(process.env.NEXTAUTH_URL);
}

export function getAuthOptions(req?: any): NextAuthOptions {
  if (req) {
    const host = req?.headers?.get ? req.headers.get('host') : req?.headers?.host;
    const proto = (req?.headers?.get ? req.headers.get('x-forwarded-proto') : req?.headers?.['x-forwarded-proto']) || 'https';
    if (host && !host.includes('localhost')) {
      process.env.NEXTAUTH_URL = `${proto}://${host}`;
    }
  }

  if (process.env.NEXTAUTH_URL) {
    process.env.NEXTAUTH_URL = sanitizeUrl(process.env.NEXTAUTH_URL);
  } else {
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
    'YOUR_GOOGLE_CLIENT_SECRET';

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
        const configuredAdminEmail = getAdminEmail();

        // Check if user is the Master Admin (Strictly Jizelle Casia only)
        const isMasterAdmin =
          email === configuredAdminEmail ||
          email === 'jizelle.casia@gmail.com';

        // Strict Invite-Only RBAC check:
        // Must either be the Master Admin OR an account pre-created/invited by the Admin
        const existingUser = await getUserByEmail(email);
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
          role: isMasterAdmin ? 'admin' : 'member',
        });

        return true;
      },
      async jwt({ token, user }) {
        const email = (user?.email || token.email || '').toLowerCase().trim();
        if (email) {
          const dbUser = await getUserByEmail(email);
          const configuredAdminEmail = getAdminEmail();
          const isMasterAdmin =
            email === configuredAdminEmail ||
            email === 'jizelle.casia@gmail.com';

          if (dbUser) {
            token.id = dbUser.id;
            token.role = isMasterAdmin ? 'admin' : 'member';
            token.name = isMasterAdmin ? (dbUser.name || 'Jizelle Casia') : dbUser.name;
            token.industry = dbUser.industry || (isMasterAdmin ? 'IT / AI & Forward-Deployed Software' : 'General');
            token.notion_enabled = isMasterAdmin ? true : false;
          } else if (isMasterAdmin) {
            token.id = 'user_ji';
            token.role = 'admin';
            token.name = 'Jizelle Casia';
            token.industry = 'IT / AI & Forward-Deployed Software';
            token.notion_enabled = true;
          } else {
            token.id = `user_${Date.now()}`;
            token.role = 'member';
            token.name = user?.name || email.split('@')[0];
            token.industry = 'General';
            token.notion_enabled = false;
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
    secret: process.env.NEXTAUTH_SECRET || 'YOUR_NEXTAUTH_SECRET',
  };
}

