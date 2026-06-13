-- ============================================================
-- DROP ALL TABLES - SaaS Maps
-- Remove tudo de uma vez na ordem correta
-- ============================================================

-- Remove funções primeiro (não dependem de tabelas)
DROP FUNCTION IF EXISTS update_updated_at_column() CASCADE;
DROP FUNCTION IF EXISTS create_default_subscription() CASCADE;
DROP FUNCTION IF EXISTS log_audit_action() CASCADE;

-- Remove tabelas na ordem (filhas primeiro, depois pais)
DROP TABLE IF EXISTS "AuditLog" CASCADE;
DROP TABLE IF EXISTS "Lead" CASCADE;
DROP TABLE IF EXISTS "DigitalPresence" CASCADE;
DROP TABLE IF EXISTS "Search" CASCADE;
DROP TABLE IF EXISTS "Establishment" CASCADE;
DROP TABLE IF EXISTS "Subscription" CASCADE;
DROP TABLE IF EXISTS "User" CASCADE;

-- Remove ENUMs
DROP TYPE IF EXISTS "LeadStatus" CASCADE;
DROP TYPE IF EXISTS "Plan" CASCADE;
DROP TYPE IF EXISTS "UserRole" CASCADE;