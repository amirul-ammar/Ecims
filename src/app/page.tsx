import { redirect } from "next/navigation";

/**
 * Root page — redirects to /dashboard.
 * Auth middleware will redirect to /login if unauthenticated.
 */
export default function Home() {
  redirect("/dashboard");
}
