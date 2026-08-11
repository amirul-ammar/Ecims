"use client";

import { SessionProvider } from "next-auth/react";

/**
 * NextAuth session provider wrapper.
 */
export default function AuthProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  return <SessionProvider>{children}</SessionProvider>;
}
