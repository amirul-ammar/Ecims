import type { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import prisma from "@/lib/prisma";

/**
 * NextAuth.js configuration.
 * Uses Credentials provider to authenticate against the users table.
 * Supports both plain-text (legacy) and bcrypt-hashed passwords.
 */
export const authOptions: NextAuthOptions = {
  debug: process.env.NODE_ENV === "development",
  providers: [
    CredentialsProvider({
      name: "Credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          return null;
        }

        const user = await prisma.user.findUnique({
          where: { email: credentials.email },
          include: { role: true },
        });

        if (!user || !user.is_active) {
          return null;
        }

        // Support both bcrypt-hashed and plain-text (legacy) passwords
        let isValid = false;
        if (user.password.startsWith("$2")) {
          // bcrypt hash
          isValid = await bcrypt.compare(credentials.password, user.password);
        } else {
          // Plain-text (legacy) — exact match
          isValid = credentials.password === user.password;
        }

        if (!isValid) {
          return null;
        }

        return {
          id: String(user.id),
          name: user.name,
          email: user.email,
          role_id: user.role_id,
          role_name: user.role.name,
        } as any;
      },
    }),
  ],
  session: {
    strategy: "jwt",
    maxAge: 8 * 60 * 60, // 8 hours
  },
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = Number(user.id);
        token.role_id = user.role_id as number;
        token.role_name = user.role_name as string;
      }
      return token;
    },
    async session({ session, token }) {
      session.user = {
        id: token.id as number,
        name: token.name as string,
        email: token.email as string,
        role_id: token.role_id as number,
        role_name: token.role_name as string,
      };
      return session;
    },
  },
  pages: {
    signIn: "/login",
  },
  secret: process.env.NEXTAUTH_SECRET,
};
