-- 20260623100000_search_indexes.sql
-- 4b — trigram indexes for the global search's ILIKE substring matching. Additive +
-- non-destructive: NO table/RLS/policy change. Search runs as the CALLER through the
-- user-scoped client, so RLS on each base table does all the access filtering — these
-- indexes only make the ILIKE scans fast; they do not affect visibility in any way.

create extension if not exists pg_trgm;

create index if not exists idx_clients_name_trgm        on public.clients      using gin (name gin_trgm_ops);
create index if not exists idx_projects_title_trgm      on public.projects     using gin (title gin_trgm_ops);
create index if not exists idx_projects_desc_trgm       on public.projects     using gin (description gin_trgm_ops);
create index if not exists idx_tasks_title_trgm         on public.tasks        using gin (title gin_trgm_ops);
create index if not exists idx_tasks_desc_trgm          on public.tasks        using gin (description gin_trgm_ops);
create index if not exists idx_deliverables_title_trgm  on public.deliverables using gin (title gin_trgm_ops);
create index if not exists idx_deliverables_desc_trgm   on public.deliverables using gin (description gin_trgm_ops);
create index if not exists idx_messages_body_trgm       on public.messages     using gin (body gin_trgm_ops);
create index if not exists idx_files_name_trgm          on public.files        using gin (name gin_trgm_ops);
