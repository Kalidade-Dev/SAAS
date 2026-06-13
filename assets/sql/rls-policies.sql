-- ============================================================
-- Políticas RLS faltantes para INSERT/UPDATE/DELETE
-- Execute este SQL no Supabase SQL Editor
-- ============================================================

-- Establishment: permitir INSERT/UPDATE/DELETE para usuários autenticados
CREATE POLICY "Authenticated users can insert establishments" ON "Establishment"
    FOR INSERT WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can update establishments" ON "Establishment"
    FOR UPDATE USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can delete establishments" ON "Establishment"
    FOR DELETE USING (auth.role() = 'authenticated');

-- DigitalPresence: permitir INSERT/UPDATE/DELETE para usuários autenticados
CREATE POLICY "Authenticated users can view digital presence" ON "DigitalPresence"
    FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can insert digital presence" ON "DigitalPresence"
    FOR INSERT WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can update digital presence" ON "DigitalPresence"
    FOR UPDATE USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can delete digital presence" ON "DigitalPresence"
    FOR DELETE USING (auth.role() = 'authenticated');

-- Lead: permitir INSERT/UPDATE/DELETE para usuários autenticados
CREATE POLICY "Authenticated users can insert leads" ON "Lead"
    FOR INSERT WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can update leads" ON "Lead"
    FOR UPDATE USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can delete leads" ON "Lead"
    FOR DELETE USING (auth.role() = 'authenticated');

-- Subscription: permitir INSERT para usuários autenticados (auto-criação)
CREATE POLICY "Authenticated users can insert subscriptions" ON "Subscription"
    FOR INSERT WITH CHECK (auth.role() = 'authenticated');