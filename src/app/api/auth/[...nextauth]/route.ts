import NextAuth from 'next-auth';
import GoogleProvider from 'next-auth/providers/google';
import CredentialsProvider from 'next-auth/providers/credentials';

const handler = NextAuth({
  providers: [
    // 1. Google Single Sign-On Provider
    ...(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET
      ? [
          GoogleProvider({
            clientId: process.env.GOOGLE_CLIENT_ID,
            clientSecret: process.env.GOOGLE_CLIENT_SECRET,
          }),
        ]
      : []),

    // 2. 1-Click Peer Demo Mode for instant access before configuring Google Cloud credentials
    CredentialsProvider({
      id: 'peer-login',
      name: 'Peer Access',
      credentials: {
        name: { label: 'Name', type: 'text', placeholder: 'e.g. Denise or Ji' },
        email: { label: 'Email', type: 'email', placeholder: 'denise@gmail.com' },
      },
      async authorize(credentials) {
        if (!credentials?.name) return null;
        return {
          id: `user_${Date.now()}`,
          name: credentials.name,
          email: credentials.email || `${credentials.name.toLowerCase()}@peer.com`,
          image: `https://api.dicebear.com/7.x/adventurer/svg?seed=${credentials.name}`,
        };
      },
    }),
  ],
  callbacks: {
    async session({ session, token }) {
      if (session?.user) {
        (session.user as any).id = token.sub;
      }
      return session;
    },
  },
  secret: process.env.NEXTAUTH_SECRET || 'job-hunt-secret-key-peer-auth-2026',
});

export { handler as GET, handler as POST };

