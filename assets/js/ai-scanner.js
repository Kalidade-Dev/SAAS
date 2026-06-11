/**
 * Scanner com IA para enriquecer dados de estabelecimentos.
 * Busca telefone, endereço, redes sociais e verifica presença digital.
 */

const AIScanner = {
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
        if (CONFIG.ai.apiKey && CONFIG.ai.provider !== 'mock') {
            try {
                return await this.enrichWithAPI(establishment);
            } catch (err) {
                console.warn('IA API falhou, usando mock:', err);
            }
        }

        return this.enrichMock(establishment);
    },

    async enrichWithAPI(establishment) {
        const prompt = `Analise o estabelecimento "${establishment.name}" em ${establishment.city}, categoria: ${establishment.category}.
Retorne JSON com: phone, address, instagram, facebook, hasWebsite (boolean), hasGoogleMaps (boolean), notes.
Se não souber, use null.`;

        if (CONFIG.ai.provider === 'openai') {
            const res = await fetch('https://api.openai.com/v1/chat/completions', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${CONFIG.ai.apiKey}`
                },
                body: JSON.stringify({
                    model: CONFIG.ai.model,
                    messages: [
                        { role: 'system', content: 'Você é um assistente de prospecção B2B. Responda apenas JSON válido.' },
                        { role: 'user', content: prompt }
                    ],
                    response_format: { type: 'json_object' }
                })
            });

            const data = await res.json();
            const parsed = JSON.parse(data.choices[0].message.content);
            return this.mergeEnrichment(establishment, parsed);
        }

        throw new Error('Provider não configurado');
    },

    enrichMock(establishment) {
        const needsPhone = !establishment.phone;
        const needsAddress = !establishment.address || establishment.address.length < 5;

        const socials = ['instagram', 'facebook', 'whatsapp'];
        const foundSocial = Math.random() > 0.6 ? socials[Math.floor(Math.random() * socials.length)] : null;

        const enrichment = {
            phone: needsPhone ? SearchEngine.generatePhone() : establishment.phone,
            address: needsAddress
                ? `${['Rua', 'Av.'][Math.floor(Math.random() * 2)]} ${establishment.name.split(' ')[0]}, ${Math.floor(Math.random() * 900) + 100}`
                : establishment.address,
            instagram: foundSocial === 'instagram' ? `@${establishment.name.toLowerCase().replace(/\s/g, '')}` : null,
            facebook: foundSocial === 'facebook' ? establishment.name : null,
            whatsapp: foundSocial === 'whatsapp' ? SearchEngine.generatePhone() : null,
            hasWebsite: establishment.hasWebsite,
            hasGoogleMaps: establishment.hasMapsLocation,
            leadScore: this.calculateLeadScore(establishment),
            notes: this.generateNote(establishment),
            aiEnriched: true,
            enrichedAt: new Date().toISOString()
        };

        return this.mergeEnrichment(establishment, enrichment);
    },

    mergeEnrichment(original, enrichment) {
        return {
            ...original,
            phone: enrichment.phone || original.phone,
            address: enrichment.address || original.address,
            instagram: enrichment.instagram || original.instagram || null,
            facebook: enrichment.facebook || original.facebook || null,
            whatsapp: enrichment.whatsapp || original.whatsapp || null,
            leadScore: enrichment.leadScore ?? this.calculateLeadScore(original),
            notes: enrichment.notes || original.notes || null,
            aiEnriched: true,
            enrichedAt: new Date().toISOString()
        };
    },

    calculateLeadScore(est) {
        let score = 50;
        if (!est.hasWebsite) score += 20;
        if (!est.hasMapsLocation) score += 20;
        if (!est.phone) score += 5;
        if (est.rating && est.rating < 3.5) score += 5;
        return Math.min(score, 100);
    },

    generateNote(est) {
        const notes = [];
        if (!est.hasWebsite) notes.push('Sem site — oportunidade para criar presença digital');
        if (!est.hasMapsLocation) notes.push('Sem perfil no Google Maps — alto potencial de conversão');
        if (!est.phone) notes.push('Telefone não encontrado — IA tentou localizar');
        if (notes.length === 0) notes.push('Estabelecimento com baixa presença digital');
        return notes.join('. ');
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
