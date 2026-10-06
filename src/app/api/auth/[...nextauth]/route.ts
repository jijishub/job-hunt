import NextAuth, { NextAuthOptions } from 'next-auth';
import GoogleProvider from 'next-auth/providers/google';
import { getOrCreateUser, getUserByEmail } from '@/lib/db';

function getAuthOptions(): NextAuthOptions {
  if (!process.env.NEXTAUTH_URL) {
    const vercelHost = process.env.VERCEL_PROJECT_PRODUCTION_URL || process.env.VERCEL_URL;
    if (vercelHost) {
      process.env.NEXTAUTH_URL = `https://${vercelHost.replace(/^https?:\/\//, '')}`;
    }
  }

  const googleClientId = process.env.GOOGLE_CLIENT_ID;
  const googleClientSecret = process.env.GOOGLE_CLIENT_SECRET;

  return {
    providers: [
      // Google SSO is the exclusive authentication provider
      ...(googleClientId && googleClientSecret
        ? [
            GoogleProvider({
              clientId: googleClientId,
              clientSecret: googleClientSecret,
            }),
          ]
        : []),
    ],
    pages: {
      signIn: '/login',
      error: '/login',
    },
    callbacks: {
      async signIn({ user, profile }) {
        if (!user?.email) return false;

        const email = user.email.toLowerCase().trim();
        const adminEmail = (process.env.ADMIN_EMAIL || '').toLowerCase().trim();
        const isMasterAdmin = adminEmail && email === adminEmail;

        // Strict Invite-Only RBAC check:
        // Must either be the Master Admin OR an account pre-created/invited by the Admin
        const existingUser = await getUserByEmail(email);

        if (!existingUser && !isMasterAdmin) {
          console.warn(`[SSO Whitelist] Denied uninvited Google login attempt: ${email}`);
          return false; // Rejects uninvited Google accounts
        }

        const name = user.name || profile?.name || email.split('@')[0];
        const avatar = user.image || (profile as any)?.picture;

        await getOrCreateUser({
          name,
          email,
          avatar,
        });

        return true;
      },
      async jwt({ token, user }) {
        const email = user?.email || token.email;
        if (email) {
          const dbUser = await getUserByEmail(email as string);
          if (dbUser) {
            token.id = dbUser.id;
            token.role = dbUser.role;
            token.name = dbUser.name;
            token.industry = dbUser.industry;
            token.notion_enabled = dbUser.notion_enabled;
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
    secret: process.env.NEXTAUTH_SECRET || 'job-hunt-secret-key-peer-auth-2026',
  };
}

async function authHandler(req: any, res: any) {
  return NextAuth(req, res, getAuthOptions());
}

export { authHandler as GET, authHandler as POST };
