# 🗄️ SaaS Maps - Instruções para Recriar o Banco no Supabase

## 📋 PASSO A PASSO

### 1. Faça login no Supabase
- Acesse: https://supabase.com
- Entre no seu projeto
- Vá em **SQL Editor** (ícone de terminal no menu lateral)

### 2. Delete tudo que existe (execute primeiro)
- No SQL Editor, clique em **New Query**
- Copie e cole o conteúdo do arquivo:
  ```
  assets/sql/DROP-ALL-TABLES.sql
  ```
- Clique em **Run** (▶️)
- ✅ Isso vai remover TODAS as tabelas, funções, triggers e ENUMs antigos

### 3. Crie o schema novo (execute depois)
- No SQL Editor, clique em **New Query** novamente
- Copie e cole o conteúdo do arquivo:
  ```
  assets/sql/Schema-de-Usuários-Assinaturas-e-Leads.sql
  ```
- Clique em **Run** (▶️)
- ✅ Isso vai criar as 7 tabelas novas com:
  - ✅ `User` com soft delete e preferências
  - ✅ `Subscription` com CASCADE e updatedAt automático
  - ✅ `Search` com índices compostos
  - ✅ `Establishment` com soft delete
  - ✅ `DigitalPresence` com scores
  - ✅ `Lead` com **userId** (cada lead pertence a um usuário!)
  - ✅ `AuditLog` para auditoria
  - ✅ RLS completo em todas as tabelas
  - ✅ Triggers automáticos

### 4. Habilite a Autenticação
- No menu lateral, vá em **Authentication** → **Providers**
- **Email**: Deixe habilitado (padrão)
- **Google**: Clique para habilitar e configure o Client ID
  - Client ID está em: `assets/js/config.js` → `googleAuth.clientId`
- Salve as configurações

### 5. Configure o Realtime (opcional)
- No menu lateral, vá em **Database** → **Replication**
- Na aba **Source**, adicione a tabela `Lead`
- Isso permite notificações em tempo real no dashboard

## ⚠️ IMPORTANTE
- **Ordem correta**: Primeiro o DROP, depois o CREATE
- Se der erro no DROP, execute cada comando separadamente
- Se der erro no CREATE, verifique se o DROP foi executado com sucesso primeiro
- O schema novo tem os mesmos nomes de tabelas, mas com colunas adicionais

## 🔗 LINKS ÚTEIS
- Supabase Dashboard: https://supabase.com/dashboard
- Documentação RLS: https://supabase.com/docs/guides/auth/row-level-security
- Documentação Realtime: https://supabase.com/docs/guides/realtime