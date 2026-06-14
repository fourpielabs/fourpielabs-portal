-- Public avatars bucket for user profile photos (UI excellence pass, approved).
-- Display is via a plain public URL (avatars are low-sensitivity); the WRITE goes
-- through the service-role `uploadAvatarAction` server action, so NO storage.objects
-- RLS policy is added here and the existing client-files policies are untouched.
-- Additive + idempotent; not destructive.
insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', true)
on conflict (id) do nothing;
