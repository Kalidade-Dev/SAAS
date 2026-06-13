-- ============================================================
-- SQL para criar todas as tabelas no Supabase SQL Editor
-- Baseado no schema.prisma do SaaS Maps
-- Versão 2.0 - Melhorias: userId no Lead, soft delete, índices, triggers
-- ============================================================

-- ============================================================
-- ATENÇÃO: Execute este script no Supabase SQL Editor
-- Passos:
-- 1. Crie o projeto no Supabase
-- 2. Vá para SQL Editor
-- 3. Cole e execute este script
-- 4. Execute também o arquivo rls-policies.sql
-- 5. Habilite Auth > Providers > Email e Google
-- ============================================================

-- ==================== ENUMS ====================

-- CreateEnum: UserRole (IF NOT EXISTS para evitar erro se já existir)
DO $$ BEGIN
    CREATE TYPE "UserRole" AS ENUM ('USER', 'ADMIN', 'PARTNER');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- CreateEnum: Plan
DO $$ BEGIN
    CREATE TYPE "Plan" AS ENUM ('BASIC', 'PRO', 'ENTERPRISE');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- CreateEnum: LeadStatus
DO $$ BEGIN
    CREATE TYPE "LeadStatus" AS ENUM ('new', 'contacted', 'negotiating', 'client', 'discarded');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ==================== TABELAS ====================

-- CreateTable: User
CREATE TABLE "User" (
    "id" TEXT NOT NULL DEFAULT gen_random_uuid(),
    "email" TEXT NOT NULL,
    "passwordHash" TEXT,
    "name" TEXT,
    "avatar" TEXT,
    "role" "UserRole" NOT NULL DEFAULT 'USER',
    "preferences" JSONB DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateIndex: User email unique
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex: User role (for admin queries)
CREATE INDEX "User_role_idx" ON "User"("role");

-- CreateTable: Subscription
CREATE TABLE "Subscription" (
    "id" TEXT NOT NULL DEFAULT gen_random_uuid(),
    "userId" TEXT NOT NULL,
    "plan" "Plan" NOT NULL DEFAULT 'BASIC',
    "status" TEXT NOT NULL DEFAULT 'active',
    "expiresAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "cancelledAt" TIMESTAMP(3),

    CONSTRAINT "Subscription_pkey" PRIMARY KEY ("id")
);

-- CreateIndex: Subscription userId
CREATE INDEX "Subscription_userId_idx" ON "Subscription"("userId");

-- CreateIndex: Subscription status
CREATE INDEX "Subscription_status_idx" ON "Subscription"("status");

-- AddForeignKey: Subscription -> User (CASCADE para remover junto)
ALTER TABLE "Subscription" ADD CONSTRAINT "Subscription_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- CreateTable: Search
CREATE TABLE "Search" (
    "id" TEXT NOT NULL DEFAULT gen_random_uuid(),
    "userId" TEXT NOT NULL,
    "location" JSONB NOT NULL,
    "radius" INTEGER NOT NULL DEFAULT 5000,
    "category" TEXT,
    "results" JSONB,
    "resultsCount" INTEGER DEFAULT 0,
    "scoreThreshold" INTEGER NOT NULL DEFAULT 30,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Search_pkey" PRIMARY KEY ("id")
);

-- CreateIndex: Search userId
CREATE INDEX "Search_userId_idx" ON "Search"("userId");

-- CreateIndex: Search createdAt
CREATE INDEX "Search_createdAt_idx" ON "Search"("createdAt");

-- CreateIndex: Search userId + createdAt (compound)
CREATE INDEX "Search_userId_createdAt_idx" ON "Search"("userId", "createdAt" DESC);

-- AddForeignKey: Search -> User (CASCADE para remover junto)
ALTER TABLE "Search" ADD CONSTRAINT "Search_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- CreateTable: Establishment
CREATE TABLE "Establishment" (
    "id" TEXT NOT NULL DEFAULT gen_random_uuid(),
    "googlePlaceId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "location" JSONB NOT NULL,
    "phone" TEXT,
    "categories" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "website" TEXT,
    "socialProfiles" JSONB,
    "aiScore" INTEGER,
    "aiAnalysis" TEXT,
    "lastUpdated" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "verified" BOOLEAN NOT NULL DEFAULT false,
    "metadata" JSONB DEFAULT '{}', -- Dados extras flexíveis
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "Establishment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex: Establishment googlePlaceId unique
CREATE UNIQUE INDEX "Establishment_googlePlaceId_key" ON "Establishment"("googlePlaceId");

-- CreateIndex: Establishment aiScore (for sorting/filtering)
CREATE INDEX "Establishment_aiScore_idx" ON "Establishment"("aiScore");

-- CreateIndex: Establishment verified
CREATE INDEX "Establishment_verified_idx" ON "Establishment"("verified");

-- CreateIndex: Establishment name (for search)
CREATE INDEX "Establishment_name_idx" ON "Establishment"("name");

-- CreateTable: DigitalPresence
CREATE TABLE "DigitalPresence" (
    "id" TEXT NOT NULL DEFAULT gen_random_uuid(),
    "establishmentId" TEXT NOT NULL,
    "hasWebsite" BOOLEAN NOT NULL DEFAULT false,
    "websiteUrl" TEXT,
    "websiteActive" BOOLEAN DEFAULT false,
    "hasSocial" BOOLEAN NOT NULL DEFAULT false,
    "socialHandles" JSONB,
    "socialActive" BOOLEAN NOT NULL DEFAULT false,
    "hasWhatsapp" BOOLEAN DEFAULT false,
    "hasEmail" BOOLEAN DEFAULT false,
    "score" INTEGER NOT NULL DEFAULT 0,
    "checkedAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DigitalPresence_pkey" PRIMARY KEY ("id")
);

-- CreateIndex: DigitalPresence establishmentId unique
CREATE UNIQUE INDEX "DigitalPresence_establishmentId_key" ON "DigitalPresence"("establishmentId");

-- CreateIndex: DigitalPresence score
CREATE INDEX "DigitalPresence_score_idx" ON "DigitalPresence"("score");

-- AddForeignKey: DigitalPresence -> Establishment (CASCADE)
ALTER TABLE "DigitalPresence" ADD CONSTRAINT "DigitalPresence_establishmentId_fkey"
    FOREIGN KEY ("establishmentId") REFERENCES "Establishment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- CreateTable: Lead (AGORA COM userId - cada lead pertence a um usuário)
CREATE TABLE "Lead" (
    "id" TEXT NOT NULL DEFAULT gen_random_uuid(),
    "userId" TEXT NOT NULL, -- NOVO: Dono do lead
    "establishmentId" TEXT NOT NULL,
    "searchId" TEXT, -- NOVO: Referência à busca que originou o lead
    "score" INTEGER NOT NULL DEFAULT 50,
    "contactInfo" JSONB,
    "status" "LeadStatus" NOT NULL DEFAULT 'new',
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "Lead_pkey" PRIMARY KEY ("id")
);

-- CreateIndex: Lead userId (essential for queries)
CREATE INDEX "Lead_userId_idx" ON "Lead"("userId");

-- CreateIndex: Lead establishmentId
CREATE INDEX "Lead_establishmentId_idx" ON "Lead"("establishmentId");

-- CreateIndex: Lead status (for filtering)
CREATE INDEX "Lead_status_idx" ON "Lead"("status");

-- CreateIndex: Lead score (for sorting)
CREATE INDEX "Lead_score_idx" ON "Lead"("score");

-- CreateIndex: Lead userId + status (compound - for dashboard queries)
CREATE INDEX "Lead_userId_status_idx" ON "Lead"("userId", "status");

-- CreateIndex: Lead userId + createdAt (compound - for sorting)
CREATE INDEX "Lead_userId_createdAt_idx" ON "Lead"("userId", "createdAt" DESC);

-- CreateIndex: Unique lead per user per establishment
CREATE UNIQUE INDEX "Lead_userId_establishmentId_key" ON "Lead"("userId", "establishmentId");

-- AddForeignKey: Lead -> User (CASCADE)
ALTER TABLE "Lead" ADD CONSTRAINT "Lead_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey: Lead -> Establishment (CASCADE)
ALTER TABLE "Lead" ADD CONSTRAINT "Lead_establishmentId_fkey"
    FOREIGN KEY ("establishmentId") REFERENCES "Establishment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey: Lead -> Search (SET NULL se a busca for deletada)
ALTER TABLE "Lead" ADD CONSTRAINT "Lead_searchId_fkey"
    FOREIGN KEY ("searchId") REFERENCES "Search"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- CreateTable: AuditLog (NOVO - para auditoria)
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL DEFAULT gen_random_uuid(),
    "userId" TEXT,
    "action" TEXT NOT NULL,
    "entity" TEXT NOT NULL,
    "entityId" TEXT,
    "details" JSONB,
    "ip" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex: AuditLog userId
CREATE INDEX "AuditLog_userId_idx" ON "AuditLog"("userId");

-- CreateIndex: AuditLog createdAt
CREATE INDEX "AuditLog_createdAt_idx" ON "AuditLog"("createdAt");

-- CreateIndex: AuditLog entity + action
CREATE INDEX "AuditLog_entity_action_idx" ON "AuditLog"("entity", "action");

-- AddForeignKey: AuditLog -> User
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- ==================== TRIGGERS (PROCEDURAL) ====================

-- Função para atualizar updatedAt automaticamente
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW."updatedAt" = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers para User
CREATE TRIGGER set_User_updatedAt
    BEFORE UPDATE ON "User"
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Triggers para Subscription
CREATE TRIGGER set_Subscription_updatedAt
    BEFORE UPDATE ON "Subscription"
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Triggers para Lead
CREATE TRIGGER set_Lead_updatedAt
    BEFORE UPDATE ON "Lead"
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Função para criar Subscription padrão ao criar User
CREATE OR REPLACE FUNCTION create_default_subscription()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO "Subscription" ("userId", "plan", "status")
    VALUES (NEW.id, 'BASIC', 'active');
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger: criar Subscription automaticamente quando User é criado
CREATE TRIGGER after_User_insert
    AFTER INSERT ON "User"
    FOR EACH ROW
    EXECUTE FUNCTION create_default_subscription();

-- Função para registrar audit log
CREATE OR REPLACE FUNCTION log_audit_action()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO "AuditLog" ("userId", "action", "entity", "entityId", "details")
    VALUES (
        COALESCE(NEW."userId", OLD."userId", auth.uid()::text),
        TG_OP,
        TG_TABLE_NAME,
        COALESCE(NEW.id::text, OLD.id::text),
        jsonb_build_object(
            'old', CASE WHEN TG_OP = 'UPDATE' THEN row_to_json(OLD)::jsonb ELSE NULL END,
            'new', CASE WHEN TG_OP IN ('INSERT', 'UPDATE') THEN row_to_json(NEW)::jsonb ELSE NULL END
        )
    );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- Row Level Security (RLS)
-- ============================================================

-- Habilitar RLS em todas as tabelas
ALTER TABLE "User" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Subscription" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Search" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Establishment" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "DigitalPresence" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Lead" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "AuditLog" ENABLE ROW LEVEL SECURITY;

-- ==================== POLÍTICAS RLS ====================

-- Política: Usuários só podem ver seus próprios dados
CREATE POLICY "Users can view own user data" ON "User"
    FOR SELECT USING (auth.uid()::text = id);

CREATE POLICY "Users can update own user data" ON "User"
    FOR UPDATE USING (auth.uid()::text = id)
    WITH CHECK (auth.uid()::text = id);

-- Subscription: usuários veem apenas suas próprias assinaturas
CREATE POLICY "Users can view own subscriptions" ON "Subscription"
    FOR SELECT USING (auth.uid()::text = "userId");

CREATE POLICY "Users can insert own subscriptions" ON "Subscription"
    FOR INSERT WITH CHECK (auth.uid()::text = "userId");

CREATE POLICY "Users can update own subscriptions" ON "Subscription"
    FOR UPDATE USING (auth.uid()::text = "userId");

-- Search: usuários veem apenas suas próprias buscas
CREATE POLICY "Users can view own searches" ON "Search"
    FOR SELECT USING (auth.uid()::text = "userId");

CREATE POLICY "Users can insert own searches" ON "Search"
    FOR INSERT WITH CHECK (auth.uid()::text = "userId");

CREATE POLICY "Users can delete own searches" ON "Search"
    FOR DELETE USING (auth.uid()::text = "userId");

-- Establishment: leitura para qualquer usuário autenticado
CREATE POLICY "Authenticated users can view establishments" ON "Establishment"
    FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can insert establishments" ON "Establishment"
    FOR INSERT WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can update establishments" ON "Establishment"
    FOR UPDATE USING (auth.role() = 'authenticated');

-- DigitalPresence: leitura para qualquer usuário autenticado
CREATE POLICY "Authenticated users can view digital presence" ON "DigitalPresence"
    FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can insert digital presence" ON "DigitalPresence"
    FOR INSERT WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can update digital presence" ON "DigitalPresence"
    FOR UPDATE USING (auth.role() = 'authenticated');

-- Lead: AGORA com userId - cada usuário vê apenas seus próprios leads
CREATE POLICY "Users can view own leads" ON "Lead"
    FOR SELECT USING (auth.uid()::text = "userId");

CREATE POLICY "Users can insert own leads" ON "Lead"
    FOR INSERT WITH CHECK (auth.uid()::text = "userId");

CREATE POLICY "Users can update own leads" ON "Lead"
    FOR UPDATE USING (auth.uid()::text = "userId");

CREATE POLICY "Users can delete own leads" ON "Lead"
    FOR DELETE USING (auth.uid()::text = "userId");

-- AuditLog: apenas admins podem ver
CREATE POLICY "Admins can view audit logs" ON "AuditLog"
    FOR SELECT USING (
        auth.uid()::text IN (
            SELECT "User"."id" FROM "User" WHERE "User"."role" = 'ADMIN'
        )
    );