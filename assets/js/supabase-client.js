/**
 * Cliente Supabase — usa tabelas relacionais quando configurado.
 * Fallback: localStorage com estrutura flat.
 *
 * Tabelas Supabase:
 *   Establishment → dados básicos do estabelecimento
 *   DigitalPresence → presença digital (site, redes sociais, score)
 *   Lead → leads salvos pelo usuário (status, contato)
 */

/* ==================== STORAGE (localStorage fallback) ==================== */

const Storage = {
    KEY: 'weblead_establishments',

    getAll() {
        try {
            return JSON.parse(localStorage.getItem(this.KEY) || '[]');
        } catch {
            return [];
        }
    },

    save(establishments) {
        localStorage.setItem(this.KEY, JSON.stringify(establishments));
    },

    addMany(items) {
        const existing = this.getAll();
        const ids = new Set(existing.map(e => e.id));
        const newItems = items
            .filter(e => !ids.has(e.id))
            .map(e => ({
                ...e,
                leadStatus: e.leadStatus || 'Novo',
                leadScore: e.leadScore ?? null,
                aiEnriched: e.aiEnriched || false,
                createdAt: e.createdAt || new Date().toISOString()
            }));
        const merged = [...existing, ...newItems];
        this.save(merged);
        return { added: newItems.length, total: merged.length };
    },

    update(id, data) {
        const all = this.getAll();
        const idx = all.findIndex(e => e.id === id);
        if (idx === -1) return false;
        all[idx] = { ...all[idx], ...data, updatedAt: new Date().toISOString() };
        this.save(all);
        return true;
    },

    remove(id) {
        const filtered = this.getAll().filter(e => e.id !== id);
        this.save(filtered);
    },

    clear() {
        localStorage.removeItem(this.KEY);
    }
};

/* ==================== NORMALIZADORES ==================== */

/**
 * Converte dados flat do SearchEngine → formato relacional Supabase
 */
function flatToRelational(flat) {
    const establishment = {
        id: flat.id,
        googlePlaceId: flat.googlePlaceId || flat.id,
        name: flat.name,
        address: flat.address || '',
        location: { lat: flat.latitude, lng: flat.longitude, city: flat.city },
        phone: flat.phone || null,
        categories: flat.category ? [flat.category] : [],
        website: flat.website || null,
        socialProfiles: {
            instagram: flat.instagram || null,
            facebook: flat.facebook || null,
            whatsapp: flat.whatsapp || null,
            email: flat.email || null
        },
        aiScore: flat.leadScore ?? null,
        lastUpdated: new Date().toISOString(),
        verified: false
    };

    const digitalPresence = {
        id: `dp-${flat.id}`,
        establishmentId: flat.id,
        hasWebsite: flat.hasWebsite || false,
        websiteUrl: flat.website || null,
        hasSocial: !!(flat.instagram || flat.facebook || flat.whatsapp),
        socialHandles: {
            instagram: flat.instagram || null,
            facebook: flat.facebook || null,
            whatsapp: flat.whatsapp || null
        },
        socialActive: false,
        score: flat.hasWebsite ? 10 : (flat.hasMapsLocation ? 5 : 0)
    };

    const lead = {
        id: `lead-${flat.id}`,
        establishmentId: flat.id,
        score: flat.leadScore ?? 50,
        contactInfo: {
            phone: flat.phone || null,
            whatsapp: flat.whatsapp || null,
            email: flat.email || null,
            instagram: flat.instagram || null
        },
        status: flat.leadStatus || 'new',
        createdAt: flat.createdAt || new Date().toISOString()
    };

    return { establishment, digitalPresence, lead };
}

/**
 * Converte registros relacionais Supabase → formato flat para o dashboard
 */
function relationalToFlat(est, dp, lead) {
    const social = est.socialProfiles || dp?.socialHandles || {};
    const contact = lead?.contactInfo || {};

    return {
        // Establishment fields
        id: est.id,
        name: est.name,
        address: est.address,
        city: est.location?.city || est.address?.split(',')?.slice(-2)?.[0]?.trim() || '',
        phone: est.phone || contact.phone || null,
        category: (est.categories && est.categories[0]) || 'Estabelecimento',
        website: est.website || dp?.websiteUrl || null,
        latitude: est.location?.lat || null,
        longitude: est.location?.lng || null,
        source: est.googlePlaceId?.startsWith('osm') ? 'openstreetmap' : 'google_places',
        mapsUrl: est.location?.lat
            ? `https://www.openstreetmap.org/?mlat=${est.location.lat}&mlon=${est.location.lng}`
            : null,

        // DigitalPresence fields
        hasWebsite: dp?.hasWebsite || false,
        hasMapsLocation: !!(est.location?.lat),
        instagram: social.instagram || contact.instagram || null,
        facebook: social.facebook || null,
        whatsapp: social.whatsapp || contact.whatsapp || null,
        email: social.email || contact.email || null,

        // Lead fields
        leadScore: lead?.score ?? est.aiScore ?? null,
        leadStatus: lead?.status || 'Novo',
        aiEnriched: !!lead?.score,
        notes: null,

        // Metadata
        createdAt: lead?.createdAt || est.lastUpdated || new Date().toISOString(),
        rating: null,
        totalReviews: 0
    };
}

/**
 * Converte um lead salvo no localStorage para o formato flat
 */
function localStorageToFlat(item) {
    return {
        ...item,
        leadStatus: item.leadStatus || 'Novo',
        createdAt: item.createdAt || item.updatedAt || new Date().toISOString()
    };
}

/* ==================== SUPABASE CLIENT ==================== */

const SupabaseClient = {
    client: null,
    ready: false,

    async init() {
        const { url, anonKey } = CONFIG.supabase;
        if (!url || !anonKey) {
            this.ready = false;
            return false;
        }

        if (typeof supabase !== 'undefined') {
            this.client = supabase.createClient(url, anonKey);
            this.ready = true;
            return true;
        }

        return false;
    },

    /**
     * Salva estabelecimentos (formato flat) → adapta para o schema relacional
     */
    async saveEstablishments(establishments) {
        if (!this.ready) {
            return Storage.addMany(establishments);
        }

        let added = 0;
        const total = establishments.length;

        for (const flat of establishments) {
            try {
                const { establishment, digitalPresence, lead } = flatToRelational(flat);

                // Upsert Establishment
                const { error: estErr } = await this.client
                    .from('Establishment')
                    .upsert(establishment, { onConflict: 'id' });
                if (estErr) {
                    console.warn('Erro ao salvar Establishment:', estErr.message);
                    continue;
                }

                // Upsert DigitalPresence (usando establishmentId como único)
                const { error: dpErr } = await this.client
                    .from('DigitalPresence')
                    .upsert(digitalPresence, { onConflict: 'establishmentId' });
                if (dpErr) console.warn('Erro ao salvar DigitalPresence:', dpErr.message);

                // Upsert Lead (usando id como único)
                const { error: leadErr } = await this.client
                    .from('Lead')
                    .upsert(lead, { onConflict: 'id' });
                if (leadErr) console.warn('Erro ao salvar Lead:', leadErr.message);
                else added++;
            } catch (err) {
                console.warn('Erro ao processar estabelecimento:', err.message);
            }
        }

        return { added, total };
    },

    /**
     * Busca todos os estabelecimentos com joins de DigitalPresence e Lead
     */
    async getEstablishments() {
        if (!this.ready) {
            return Storage.getAll().map(localStorageToFlat);
        }

        // Busca establishments com digitalPresences
        const { data: establishments, error: estErr } = await this.client
            .from('Establishment')
            .select('*')
            .order('lastUpdated', { ascending: false });

        if (estErr) throw estErr;
        if (!establishments?.length) return [];

        // Busca digital presences
        const { data: presences } = await this.client
            .from('DigitalPresence')
            .select('*');

        // Busca leads
        const { data: leads } = await this.client
            .from('Lead')
            .select('*')
            .order('createdAt', { ascending: false });

        // Index por establishmentId para lookup rápido
        const dpMap = new Map();
        (presences || []).forEach(dp => dpMap.set(dp.establishmentId, dp));

        const leadMap = new Map();
        (leads || []).forEach(l => {
            // Pega o lead mais recente por establishment
            if (!leadMap.has(l.establishmentId)) {
                leadMap.set(l.establishmentId, l);
            }
        });

        // Mapear status do Lead para o formato do dashboard
        const statusMap = {
            'new': 'Novo',
            'contacted': 'Contatado',
            'negotiating': 'Em negociação',
            'client': 'Cliente',
            'discarded': 'Descartado'
        };

        return establishments.map(est => {
            const dp = dpMap.get(est.id);
            const lead = leadMap.get(est.id);

            const flat = relationalToFlat(est, dp, lead);

            // Mapear status do banco para o formato do dashboard
            if (lead?.status && statusMap[lead.status]) {
                flat.leadStatus = statusMap[lead.status];
            }

            return flat;
        });
    },

    /**
     * Atualiza dados de um estabelecimento (formato flat)
     */
    async updateEstablishment(id, updates) {
        if (!this.ready) {
            Storage.update(id, updates);
            return true;
        }

        // Mapear status do dashboard para o formato do banco
        const statusReverseMap = {
            'Novo': 'new',
            'Contatado': 'contacted',
            'Em negociação': 'negotiating',
            'Cliente': 'client',
            'Descartado': 'discarded'
        };

        // Atualizar Lead se mudou o status
        if (updates.leadStatus) {
            const dbStatus = statusReverseMap[updates.leadStatus] || updates.leadStatus;
            const { error } = await this.client
                .from('Lead')
                .update({ status: dbStatus })
                .eq('establishmentId', id);

            if (error) throw error;
        }

        // Atualizar Establishment se tem dados novos
        const estUpdates = {};
        if (updates.phone) estUpdates.phone = updates.phone;
        if (updates.website) estUpdates.website = updates.website;
        if (updates.name) estUpdates.name = updates.name;
        estUpdates.lastUpdated = new Date().toISOString();

        if (Object.keys(estUpdates).length > 1) {
            const { error } = await this.client
                .from('Establishment')
                .update(estUpdates)
                .eq('id', id);
            if (error) throw error;
        }

        // Atualizar DigitalPresence se tem dados novos
        const dpUpdates = {};
        if (updates.hasWebsite !== undefined) dpUpdates.hasWebsite = updates.hasWebsite;
        if (updates.website) dpUpdates.websiteUrl = updates.website;

        if (Object.keys(dpUpdates).length > 0) {
            const { error } = await this.client
                .from('DigitalPresence')
                .update(dpUpdates)
                .eq('establishmentId', id);
            if (error) throw error;
        }

        return true;
    },

    /**
     * Remove um estabelecimento e seus dados relacionados
     */
    async removeEstablishment(id) {
        if (!this.ready) {
            Storage.remove(id);
            return true;
        }

        // Remove Lead
        await this.client.from('Lead').delete().eq('establishmentId', id);
        // Remove DigitalPresence
        await this.client.from('DigitalPresence').delete().eq('establishmentId', id);
        // Remove Establishment
        const { error } = await this.client
            .from('Establishment')
            .delete()
            .eq('id', id);

        if (error) throw error;
        return true;
    }
};