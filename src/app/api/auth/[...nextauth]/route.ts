import NextAuth, { NextAuthOptions } from 'next-auth';
import GoogleProvider from 'next-auth/providers/google';
import CredentialsProvider from 'next-auth/providers/credentials';
import { getOrCreateUser, getUserByEmail, getUserById } from '@/lib/db';

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
      // 1. Google Single Sign-On Provider (Dynamic from process.env / .env.local)
      ...(googleClientId && googleClientSecret
        ? [
            GoogleProvider({
              clientId: googleClientId,
              clientSecret: googleClientSecret,
            }),
          ]
        : []),

      // 2. Direct Account Access & Switcher Provider
      CredentialsProvider({
        id: 'credentials',
        name: 'Account Access',
        credentials: {
          userId: { label: 'User ID', type: 'text' },
          email: { label: 'Email', type: 'email' },
          name: { label: 'Name', type: 'text' },
        },
        async authorize(credentials) {
          if (!credentials?.email && !credentials?.userId) return null;

          let dbUser = null;
          if (credentials.userId) {
            dbUser = await getUserById(credentials.userId);
          }
          if (!dbUser && credentials.email) {
            dbUser = await getUserByEmail(credentials.email);
          }

          if (!dbUser && credentials.email) {
            dbUser = await getOrCreateUser({
              name: credentials.name || credentials.email.split('@')[0],
              email: credentials.email,
            });
          }

          if (!dbUser) return null;

          return {
            id: dbUser.id,
            name: dbUser.name,
            email: dbUser.email,
            image: dbUser.avatar || `https://api.dicebear.com/7.x/adventurer/svg?seed=${dbUser.name}`,
          };
        },
      }),
    ],
    callbacks: {
      async signIn({ user, account, profile }) {
        if (user?.email) {
          const name = user.name || profile?.name || user.email.split('@')[0];
          const avatar = user.image || (profile as any)?.picture;
          await getOrCreateUser({
            name,
            email: user.email,
            avatar,
          });
        }
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
