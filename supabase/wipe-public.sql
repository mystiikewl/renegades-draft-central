-- =====================================================================
-- ONE-TIME: Wipe the 2025 public schema ahead of the 2026 rebuild.
-- auth schema (users/credentials) is untouched.
-- 2025 data is archived in archive/*.json (see scripts/archive-2025.mjs).
--
-- Run in the Supabase SQL editor, THEN apply the 2026 migrations.
-- =====================================================================

drop schema public cascade;
create schema public;

-- Standard Supabase defaults for a recreated public schema
grant usage on schema public to postgres, anon, authenticated, service_role;
grant all on all tables in schema public to postgres, anon, authenticated, service_role;
grant all on all routines in schema public to postgres, anon, authenticated, service_role;
grant all on all sequences in schema public to postgres, anon, authenticated, service_role;

create extension if not exists pg_graphql with schema extensions;
create extension if not exists pg_stat_statements with schema extensions;
create extension if not exists pgsodium with schema extensions;
