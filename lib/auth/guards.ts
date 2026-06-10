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

/**
 * P1 step 4 will add the enforcing guards used by layouts/server actions:
 *   - requireUser()  -> redirect('/login') when unauthenticated
 *   - requireRole(roles) -> 403/redirect when role not allowed
 *   - landingPathForRole(role) -> role-aware home route
 * RLS remains the real enforcement; these are server-side convenience checks.
 */
