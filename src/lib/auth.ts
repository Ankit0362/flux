import "server-only";

import { NextAuthOptions } from "next-auth";
import GoogleProvider from "next-auth/providers/google";
import { prisma } from "@/lib/db";

export const authOptions: NextAuthOptions = {
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID || "",
      clientSecret: process.env.GOOGLE_CLIENT_SECRET || "",
    }),
  ],
  session: {
    strategy: "jwt",
  },
  callbacks: {
    async signIn({ user }) {
      if (!user.email) return false;

      // Upsert the user into our database on login
      await prisma.user.upsert({
        where: { email: user.email },
        create: {
          email: user.email,
          name: user.name || user.email.split("@")[0],
        },
        update: {
          name: user.name || user.email.split("@")[0],
        },
      });

      return true;
    },
    async jwt({ token, user }) {
      // Add db user ID to the token
      if (user?.email) {
        const dbUser = await prisma.user.findUnique({
          where: { email: user.email },
          select: { id: true },
        });
        if (dbUser) {
          token.userId = dbUser.id;
        }
      }
      return token;
    },
    async session({ session, token }) {
      if (token?.userId && session.user) {
        session.user.id = token.userId;
      }
      return session;
    },
  },
  pages: {
    // We can define a custom sign-in page later, using default for now
    // signIn: '/login',
  },
};
