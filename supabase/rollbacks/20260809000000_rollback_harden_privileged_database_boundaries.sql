-- This migration closes confirmed privilege-escalation and financial-write
-- vulnerabilities. Reopening those paths is not an acceptable rollback.
-- Re-run the migration to restore the secure grants after an application rollback.
\ir ../migrations/20260809000000_harden_privileged_database_boundaries.sql
