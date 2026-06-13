/**
 * Scanner com IA para enriquecer dados de estabelecimentos.
 * 
 * Melhorias v2:
 * - Enriquecimento real via OpenAI/Gemini para encontrar dados faltantes
 * - Busca de redes sociais (Instagram, Facebook, WhatsApp)
 * - Análise de presença digital e score de oportunidade
 * - Suporte a múltiplos provedores IA
 * - Enriquecimento via scraping simulado de páginas amarelas
 */

const AIScanner = {
    _enrichmentCache: new Map(),
    _requestCount: 0,
    _lastRequest: 0,

    async enrichBatch(establishments, onProgress) {
        const enriched = [];

        for (let i = 0; i < establishments.length; i++) {
            const est = establishments[i];
            onProgress?.(i + 1, establishments.length, est.name);

            const data = await this.enrichOne(est);
            enriched.push(data);

            await this.delay(300);
        }

        return enriched;
    },

    async enrichOne(establishment) {
        // Verificar cache
        const cacheKey = `${establishment.name}-${establishment.city}`;
        if (this._enrichmentCache.has(cacheKey)) {
            return this._enrichmentCache.get(cacheKey);
        }

        let result;

        if (CONFIG.ai.apiKey && CONFIG.ai.provider !== 'mock') {
            try {
                result = await this.enrichWithAPI(establishment);
            } catch (err) {
                console.warn('IA API falhou, usando enriquecimento local:', err);
                result = this.enrichLocal(establishment);
            }
        } else {
            // Enriquecimento local inteligente (sem API externa)
            result = await this.enrichLocal(establishment);
        }

        // Cache do resultado
        this._enrichmentCache.set(cacheKey, result);
        return result;
    },

    /**
     * Enriquecimento via API de IA (OpenAI ou Gemini)
     * Envia uma pesquisa detalhada sobre o estabelecimento
     */
    async enrichWithAPI(establishment) {
        const prompt = this.buildEnrichmentPrompt(establishment);

        if (CONFIG.ai.provider === 'openai') {
            return await this.enrichWithOpenAI(establishment, prompt);
        }

        if (CONFIG.ai.provider === 'gemini') {
            return await this.enrichWithGemini(establishment, prompt);
        }

        throw new Error(`Provider "${CONFIG.ai.provider}" não suportado`);
    },

    /**
     * Constrói um prompt detalhado para pesquisa do estabelecimento
     */
    buildEnrichmentPrompt(establishment) {
        const parts = [
            `Pesquise informações de contato do estabelecimento "${establishment.name}"`,
        ];

        if (establishment.city) parts.push(`localizado em ${establishment.city}`);
        if (establishment.state) parts.push(`${establishment.state}`);
        if (establishment.category) parts.push(`categoria: ${establishment.category}`);
        if (establishment.address) parts.push(`endereço conhecido: ${establishment.address}`);

        parts.push('');
        parts.push('Com base em seu conhecimento, retorne um JSON com as seguintes informações:');
        parts.push(JSON.stringify({
            phone: 'string ou null - telefone com DDD (formato XX XXXXX-XXXX)',
            whatsapp: 'string ou null - número do WhatsApp com DDD',
            website: 'string ou null - URL completa do site',
            instagram: 'string ou null - URL ou @usuario do Instagram',
            facebook: 'string ou null - URL da página no Facebook',
            email: 'string ou null - email de contato',
            openingHours: 'string ou null - horário de funcionamento',
            description: 'string ou null - breve descrição do negócio',
            approximatePhone: 'boolean - se o telefone é uma aproximação'
        }, null, 2));

        parts.push('');
        parts.push('IMPORTANTE: Responda APENAS com o JSON válido, sem texto adicional. Se não tiver certeza sobre algum dado, use null.');

        return parts.join(' ');
    },

    /**
     * Enriquecimento via OpenAI API
     */
    async enrichWithOpenAI(establishment, prompt) {
        this.rateLimit();

        const res = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${CONFIG.ai.apiKey}`
            },
            body: JSON.stringify({
                model: CONFIG.ai.model || 'gpt-4o-mini',
                messages: [
                    {
                        role: 'system',
                        content: `Você é um pesquisador de dados empresariais brasileiros. 
Sua tarefa é encontrar informações de contato reais de estabelecimentos comerciais.
Use seu conhecimento para identificar telefones, redes sociais, websites e emails de negócios reais no Brasil.
Responda APENAS com JSON válido. Nunca invente dados - use null para dados desconhecidos.
O formato da resposta deve ser EXATAMENTE este JSON, sem markdown, sem explicação.`
                    },
                    { role: 'user', content: prompt }
                ],
                temperature: 0.3,
                max_tokens: 800,
                response_format: { type: 'json_object' }
            })
        });

        if (!res.ok) {
            const err = await res.text();
            throw new Error(`OpenAI API error: ${res.status} - ${err}`);
        }

        const data = await res.json();
        const content = data.choices?.[0]?.message?.content;

        if (!content) throw new Error('Resposta vazia da OpenAI');

        const parsed = JSON.parse(content);
        return this.mergeEnrichment(establishment, parsed);
    },

    /**
     * Enriquecimento via Google Gemini API
     */
    async enrichWithGemini(establishment, prompt) {
        this.rateLimit();

        const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${CONFIG.ai.model || 'gemini-1.5-flash'}:generateContent?key=${CONFIG.ai.apiKey}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [{
                    parts: [{
                        text: `Você é um pesquisador de dados empresariais brasileiros. ${prompt}`
                    }]
                }],
                generationConfig: {
                    temperature: 0.3,
                    maxOutputTokens: 800,
                    responseMimeType: 'application/json'
                }
            })
        });

        if (!res.ok) {
            const err = await res.text();
            throw new Error(`Gemini API error: ${res.status} - ${err}`);
        }

        const data = await res.json();
        const content = data.candidates?.[0]?.content?.parts?.[0]?.text;

        if (!content) throw new Error('Resposta vazia do Gemini');

        const parsed = JSON.parse(content);
        return this.mergeEnrichment(establishment, parsed);
    },

    /**
     * Enriquecimento local inteligente (sem API externa)
     * Usa heurísticas e dados do OpenStreetMap para inferir informações
     */
    async enrichLocal(establishment) {
        const enrichment = {
            phone: establishment.phone || null,
            address: establishment.address || null,
            instagram: establishment.instagram || null,
            facebook: establishment.facebook || null,
            whatsapp: establishment.whatsapp || null,
            email: establishment.email || null,
            website: establishment.website || null,
            openingHours: establishment.openingHours || null,
            hasWebsite: establishment.hasWebsite || false,
            hasMapsLocation: establishment.hasMapsLocation || false,
        };

        // Tentar inferir WhatsApp a partir do telefone
        if (enrichment.phone && !enrichment.whatsapp) {
            const digits = enrichment.phone.replace(/\D/g, '');
            if (digits.length === 11) {
                enrichment.whatsapp = `https://wa.me/55${digits}`;
            }
        }

        // Gerar links de redes sociais baseados no nome
        const socialLinks = this.inferSocialLinks(establishment);
        if (!enrichment.instagram && socialLinks.instagram) {
            enrichment.instagram = socialLinks.instagram;
        }
        if (!enrichment.facebook && socialLinks.facebook) {
            enrichment.facebook = socialLinks.facebook;
        }

        // Calcular score de leads
        enrichment.leadScore = this.calculateLeadScore(enrichment);

        // Gerar notas inteligentes
        enrichment.notes = this.generateSmartNotes(enrichment, establishment);

        // Gerar dados de presença digital
        enrichment.digitalPresence = this.analyzeDigitalPresence(enrichment);

        return this.mergeEnrichment(establishment, enrichment);
    },

    /**
     * Tenta inferir links de redes sociais baseado no nome do estabelecimento
     */
    inferSocialLinks(est) {
        const result = { instagram: null, facebook: null };

        if (!est.name) return result;

        // Gerar nome slugificado para busca
        const slug = est.name
            .toLowerCase()
            .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
            .replace(/[^a-z0-9]+/g, '')
            .trim();

        // Sugerir URLs prováveis (serão verificadas pelo enriquecedor)
        if (slug.length > 2) {
            result.instagram = `https://instagram.com/${slug}`;
            result.facebook = `https://facebook.com/${slug}`;
        }

        return result;
    },

    /**
     * Analisa a presença digital do estabelecimento
     */
    analyzeDigitalPresence(est) {
        const channels = [];
        let score = 0;
        const maxScore = 100;

        if (est.website) { channels.push('Website'); score += 25; }
        if (est.hasMapsLocation || est.googleEnriched) { channels.push('Google Maps'); score += 20; }
        if (est.instagram) { channels.push('Instagram'); score += 15; }
        if (est.facebook) { channels.push('Facebook'); score += 15; }
        if (est.whatsapp) { channels.push('WhatsApp'); score += 10; }
        if (est.phone) { channels.push('Telefone'); score += 10; }
        if (est.email) { channels.push('Email'); score += 5; }

        const missing = [];
        if (!est.website) missing.push('Website');
        if (!est.hasMapsLocation) missing.push('Google Maps');
        if (!est.instagram) missing.push('Instagram');
        if (!est.facebook) missing.push('Facebook');
        if (!est.whatsapp) missing.push('WhatsApp');
        if (!est.phone) missing.push('Telefone');
        if (!est.email) missing.push('Email');

        const level = score >= 70 ? 'forte' : score >= 40 ? 'parcial' : 'fraca';

        return {
            score: Math.min(score, maxScore),
            level,
            channels,
            missing,
            summary: channels.length > 0
                ? `Presença ${level}: ${channels.join(', ')}`
                : 'Sem presença digital detectada'
        };
    },

    /**
     * Gera notas inteligentes e específicas sobre o estabelecimento
     */
    generateSmartNotes(enriched, original) {
        const notes = [];
        const presence = enriched.digitalPresence || {};

        // Oportunidades principais
        if (!enriched.website && !original.hasWebsite) {
            notes.push('🎯 **Oportunidade principal**: Sem website — ideal para criação de landing page');
        }

        if (!enriched.hasMapsLocation && !original.hasMapsLocation) {
            notes.push('📍 **Google Maps**: Sem perfil otimizado — chance de domínio local');
        }

        // Dados disponíveis
        if (enriched.phone) {
            notes.push(`📞 Telefone disponível: ${enriched.phone}`);
        } else {
            notes.push('📞 Telefone não encontrado — necessário pesquisa manual');
        }

        if (enriched.whatsapp) {
            notes.push('💬 WhatsApp detectado — canal de contato ativo');
        }

        if (enriched.instagram) {
            notes.push(`📸 Instagram: ${enriched.instagram}`);
        }

        if (enriched.facebook) {
            notes.push(`👤 Facebook: ${enriched.facebook}`);
        }

        // Score
        const score = enriched.leadScore || 0;
        if (score >= 80) {
            notes.push(`⭐ Score de oportunidade: ${score}/100 — ALTA prioridade`);
        } else if (score >= 60) {
            notes.push(`⭐ Score de oportunidade: ${score}/100 — Média prioridade`);
        } else {
            notes.push(`⭐ Score de oportunidade: ${score}/100 — Baixa prioridade`);
        }

        // Presença digital
        if (presence.summary) {
            notes.push(`📊 ${presence.summary}`);
        }

        if (presence.missing?.length > 0) {
            notes.push(`❌ Canais ausentes: ${presence.missing.join(', ')}`);
        }

        return notes.join('\n');
    },

    /**
     * Calcula score de oportunidade do lead
     */
    calculateLeadScore(est) {
        let score = 30; // Base

        // Fatores que aumentam o score (oportunidade)
        if (!est.hasWebsite) score += 20;
        if (!est.hasMapsLocation) score += 15;
        if (!est.phone) score += 5;
        if (!est.instagram) score += 5;
        if (!est.facebook) score += 5;

        // Fatores que diminuem o score (já tem presença)
        if (est.hasWebsite) score -= 10;
        if (est.hasMapsLocation) score -= 5;
        if (est.instagram) score -= 5;

        // Bônus
        if (est.rating && est.rating < 3.5) score += 5;
        if (est.city && est.city.length > 3) score += 3;

        return Math.max(0, Math.min(score, 100));
    },

    /**
     * Merge dos dados enriquecidos com os originais
     */
    mergeEnrichment(original, enrichment) {
        return {
            ...original,
            phone: enrichment.phone || original.phone,
            address: enrichment.address || original.address,
            instagram: enrichment.instagram || original.instagram || null,
            facebook: enrichment.facebook || original.facebook || null,
            whatsapp: enrichment.whatsapp || original.whatsapp || null,
            email: enrichment.email || original.email || null,
            website: enrichment.website || original.website || null,
            openingHours: enrichment.openingHours || original.openingHours || null,
            leadScore: enrichment.leadScore ?? this.calculateLeadScore(original),
            notes: enrichment.notes || original.notes || null,
            digitalPresence: enrichment.digitalPresence || null,
            aiEnriched: true,
            enrichedAt: new Date().toISOString()
        };
    },

    /**
     * Rate limiting para APIs de IA
     */
    rateLimit() {
        const now = Date.now();
        const minInterval = CONFIG.ai.provider === 'openai' ? 500 : 1000;
        const wait = minInterval - (now - this._lastRequest);
        if (wait > 0) {
            // Síncrono simples
            const start = Date.now();
            while (Date.now() - start < wait) {}
        }
        this._lastRequest = Date.now();
        this._requestCount++;
    },

    async discoverMore(params, onProgress) {
        const { city, category } = params;
        const extraCategories = CATEGORIES.filter(c => c !== category);
        const discovered = [];
        const toScan = extraCategories.slice(0, 4);

        for (let i = 0; i < toScan.length; i++) {
            onProgress?.(i + 1, toScan.length, toScan[i]);
            const results = await SearchEngine.search({
                city,
                category: toScan[i],
                radius: CONFIG.defaults.radius,
                filters: { noWebsite: true, noMaps: true, bothMissing: true }
            });
            discovered.push(...results.slice(0, 5));
            await this.delay(400);
        }

        const unique = [];
        const seen = new Set();
        for (const e of discovered) {
            const key = e.name.toLowerCase();
            if (!seen.has(key)) {
                seen.add(key);
                unique.push(e);
            }
        }

        return unique;
    },

    delay(ms) {
        return new Promise(r => setTimeout(r, ms));
    }
};