import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export type Role = "admin" | "team" | "client";

export type Profile = {
  id: string;
  role: Role;
  full_name: string | null;
  email: string | null;
  avatar_url: string | null;
  client_id: string | null;
  is_active: boolean;
};

/** Current authenticated auth.users record, or null. */
export async function getCurrentUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
}

/** Current user's public.profiles row (role, client_id, …), or null. */
export async function getCurrentProfile(): Promise<Profile | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data } = await supabase
    .from("profiles")
    .select("id, role, full_name, email, avatar_url, client_id, is_active")
    .eq("id", user.id)
    .single();

  return (data as Profile) ?? null;
}

/** The role's home route. Clients and staff share /dashboard for now (P1). */
export function landingPathForRole(_role: Role): string {
  return "/dashboard";
}

/**
 * Require an authenticated user with an active profile. Redirects to /login
 * when unauthenticated, and signs out + redirects when the profile is missing
 * or deactivated. Returns the profile for use by the caller.
 *
 * RLS is the real enforcement; this is the server-side convenience guard used
 * by portal layouts and server actions.
 */
export async function requireProfile(): Promise<Profile> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data } = await supabase
    .from("profiles")
    .select("id, role, full_name, email, avatar_url, client_id, is_active")
    .eq("id", user.id)
    .single();

  const profile = data as Profile | null;
  if (!profile || !profile.is_active) {
    await supabase.auth.signOut();
    redirect("/login");
  }
  return profile;
}

/** Require one of `roles`; redirects to the caller's own landing if not allowed. */
export async function requireRole(roles: Role[]): Promise<Profile> {
  const profile = await requireProfile();
  if (!roles.includes(profile.role)) {
    redirect(landingPathForRole(profile.role));
  }
  return profile;
}

/**
 * Require access to a specific client's workspace: admins always, team members
 * only when assigned via client_assignments. Clients (and unassigned team) are
 * redirected to /clients. RLS is still the real enforcement; this guards the UI.
 */
export async function requireClientAccess(clientId: string): Promise<Profile> {
  const profile = await requireProfile();
  if (profile.role === "admin") return profile;
  if (profile.role === "team") {
    const supabase = await createClient();
    const { data } = await supabase
      .from("client_assignments")
      .select("client_id")
      .eq("client_id", clientId)
      .eq("user_id", profile.id)
      .maybeSingle();
    if (data) return profile;
  }
  redirect("/clients");
}
