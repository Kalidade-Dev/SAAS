/**
 * SaaS MAPS - Configuração Centralizada
 * 
 * SUPABASE: Credenciais do projeto Supabase (obrigatório)
 * As chaves anônimas (anon key) são seguras para uso no frontend
 * quando combinadas com RLS (Row Level Security).
 * 
 * Para maior segurança em produção, use um backend proxy.
 * 
 * ===== COMO CONFIGURAR =====
 * 1. Crie um arquivo .env na raiz do projeto
 * 2. Preencha as credenciais (veja .env.example)
 * 3. As variáveis serão carregadas automaticamente
 * 
 * ===== SERVIÇOS EXTERNOS =====
 * - Supabase: Autenticação, banco de dados, storage
 * - Google OAuth: Login com conta Google
 * - Google Maps (opcional): Melhora resultados de busca
 * - OpenAI (opcional): Enriquecimento de dados com IA
 * - OpenStreetMap: Busca gratuita (sem API key)
 */

const CONFIG = {
    // ===== SUPABASE (OBRIGATÓRIO) =====
    // Crie em: https://supabase.com > New Project
    // As chaves anônimas são seguras para frontend com RLS habilitado
    supabase: {
        url: (() => {
            try {
                // Tenta carregar de variáveis de ambiente primeiro
                if (typeof __ENV__ !== 'undefined' && __ENV__.SUPABASE_URL) {
                    return __ENV__.SUPABASE_URL;
                }
            } catch (e) {}
            // Fallback: config direta (substitua pelos seus valores)
            return 'https://ufhnivjbtuxdenvjgdpu.supabase.co';
        })(),
        anonKey: (() => {
            try {
                if (typeof __ENV__ !== 'undefined' && __ENV__.SUPABASE_ANON_KEY) {
                    return __ENV__.SUPABASE_ANON_KEY;
                }
            } catch (e) {}
            return 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVmaG5pdmpidHV4ZGVudmpnZHB1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODEyMDA5NjEsImV4cCI6MjA5Njc3Njk2MX0.ftjWM-6nhUlQuGcFmD0UWMMLm8bXGFSL2XChsdxdtT0';
        })()
    },

    // ===== GOOGLE OAUTH =====
    // Crie em: Google Cloud Console > APIs & Services > Credentials
    googleAuth: {
        clientId: (() => {
            try {
                if (typeof __ENV__ !== 'undefined' && __ENV__.GOOGLE_CLIENT_ID) {
                    return __ENV__.GOOGLE_CLIENT_ID;
                }
            } catch (e) {}
            return '647277378288-5nl44kg2c2ar7uuh1mcqkram46tnrlda.apps.googleusercontent.com';
        })()
    },

    // ===== GOOGLE MAPS / PLACES API (OPCIONAL) =====
    // Crie em: Google Cloud Console > APIs & Services > Credentials > API Key
    // Habilite: Places API, Maps JavaScript API
    // Para usar Google Places, insira sua API Key abaixo
    googleMaps: {
        apiKey: (() => {
            try {
                if (typeof __ENV__ !== 'undefined' && __ENV__.GOOGLE_MAPS_API_KEY) {
                    return __ENV__.GOOGLE_MAPS_API_KEY;
                }
            } catch (e) {}
            // Insira sua API Key do Google Maps aqui:
            return '';
        })(),
        // Usar TextSearch (mais completo) ou NearbySearch (mais preciso)
        useTextSearch: true,
        // Idioma dos resultados
        language: 'pt-BR'
    },

    // ===== IA PARA ENRIQUECIMENTO (OPCIONAL) =====
    // Suporta: OpenAI (gpt-4o-mini), Google Gemini (gemini-1.5-flash), ou mock
    // Configure a API Key para ativar o enriquecimento real
    ai: {
        provider: (() => {
            try {
                if (typeof __ENV__ !== 'undefined' && __ENV__.AI_PROVIDER) return __ENV__.AI_PROVIDER;
                if (typeof __ENV__ !== 'undefined' && __ENV__.OPENAI_API_KEY) return 'openai';
                if (typeof __ENV__ !== 'undefined' && __ENV__.GEMINI_API_KEY) return 'gemini';
            } catch (e) {}
            return 'mock'; // 'openai' | 'gemini' | 'mock'
        })(),
        apiKey: (() => {
            try {
                if (typeof __ENV__ !== 'undefined' && __ENV__.OPENAI_API_KEY) {
                    return __ENV__.OPENAI_API_KEY;
                }
                if (typeof __ENV__ !== 'undefined' && __ENV__.GEMINI_API_KEY) {
                    return __ENV__.GEMINI_API_KEY;
                }
            } catch (e) {}
            return '';
        })(),
        model: (() => {
            try {
                if (typeof __ENV__ !== 'undefined' && __ENV__.OPENAI_MODEL) {
                    return __ENV__.OPENAI_MODEL;
                }
                if (typeof __ENV__ !== 'undefined' && __ENV__.GEMINI_MODEL) {
                    return __ENV__.GEMINI_MODEL;
                }
            } catch (e) {}
            return 'gpt-4o-mini'; // OpenAI: gpt-4o-mini | Gemini: gemini-1.5-flash
        })(),
        // Máximo de estabelecimentos a enriquecer por busca
        maxEnrichmentsPerSearch: 20,
        // Intervalo mínimo entre requisições (ms)
        rateLimitInterval: 500
    },

    // ===== OPEN STREET MAP (GRATUITO) =====
    openStreetMap: {
        enabled: true,
        defaultCountry: 'Brasil'
    },

    // ===== CONFIGURAÇÕES PADRÃO =====
    defaults: {
        radius: 5000,       // Raio padrão em metros
        maxResults: 80      // Máximo de resultados por busca
    },

    // ===== PLANOS E LIMITES =====
    plans: {
        BASIC: {
            name: 'Basic',
            maxLeadsPerMonth: 100,
            maxSearchesPerDay: 5,
            features: ['Busca básica', 'Export CSV', '5 leads/dia']
        },
        PRO: {
            name: 'Pro',
            maxLeadsPerMonth: 1000,
            maxSearchesPerDay: 50,
            features: ['Busca avançada', 'Export CSV/PDF', 'IA Scoring', 'API access', '50 leads/dia']
        },
        ENTERPRISE: {
            name: 'Enterprise',
            maxLeadsPerMonth: 10000,
            maxSearchesPerDay: 500,
            features: ['Tudo do Pro', 'API ilimitada', 'Suporte prioritário', 'Consultoria', '500 leads/dia']
        }
    },

    // ===== SEGURANÇA =====
    security: {
        // Sanitização de saída (proteção XSS)
        sanitizeOutput: true,
        // Rate limiting (requests/minuto)
        rateLimitPerMinute: 30,
        // Tempo máximo de sessão (minutos)
        sessionTimeout: 120,
        // Forçar HTTPS em produção
        forceHTTPS: true
    },

    // ===== I18N / IDIOMAS =====
    locale: 'pt-BR',
    availableLocales: ['pt-BR', 'en-US', 'es-ES'],
    fallbackLocale: 'pt-BR'
};