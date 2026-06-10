-- =============================================================================
-- 20260610010001_enums.sql
-- All enum types for the 4Pie Labs client portal (spec §4 "Enums").
-- =============================================================================

create type public.user_role as enum ('admin', 'team', 'client');

create type public.client_status as enum ('onboarding', 'active', 'paused', 'churned');

create type public.client_industry as enum (
  'painting_contractor', 'tour_operator', 'other_local_service'
);

create type public.program_tier as enum (
  'foundation', 'pipeline', 'operating_system', 'pulse'
);

create type public.checklist_kind as enum ('onboarding', 'offboarding');

create type public.checklist_assignee as enum ('client', 'team');

create type public.milestone_status as enum ('upcoming', 'in_progress', 'done');

create type public.deliverable_status as enum (
  'pending', 'in_progress', 'needs_review', 'delivered'
);

create type public.deliverable_type as enum (
  'blog_post', 'landing_page', 'ad_creative', 'design', 'video',
  'gbp_update', 'content_calendar', 'report', 'strategy_doc', 'other'
);

create type public.content_status as enum (
  'idea', 'drafting', 'in_review', 'approved', 'scheduled', 'published'
);

create type public.content_platform as enum (
  'blog', 'gbp', 'instagram', 'tiktok', 'youtube', 'facebook',
  'linkedin', 'google_ads', 'meta_ads', 'email', 'other'
);

create type public.metric_unit as enum ('number', 'currency', 'percent', 'text');

create type public.file_category as enum (
  'agreement', 'onboarding_form', 'welcome_doc', 'invoice',
  'brand_asset', 'template', 'strategy_doc', 'report', 'other'
);

create type public.competitor_priority as enum ('low', 'medium', 'high');
