-- Profiles contain user identity data and cannot be dropped during rollback.
-- Reapply the dependency bootstrap so the historical schema remains replayable.
\ir ../migrations/20260524000000_profile_function_dependency.sql
