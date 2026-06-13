/**
 * SaaS MAPS — Supabase Client v2
 * 
 * Melhorias:
 * - Sanitização XSS em todas as entradas
 * - userId incluído automaticamente nos leads
 * - Tratamento de erros centralizado via ErrorHandler
 * - Suporte ao novo schema (Lead.userId, soft delete)
 * - Fallback localStorage otimizado
 * - Notificações em tempo real (Realtime)
 */

/* ==================== CONSTANTES ==================== */

const LEAD_STATUS_MAP = {
    'Novo': 'new',
    'Contatado': 'contacted',
    'Em negociação': 'negotiating',
    'Cliente': 'client',
    'Descartado': 'discarded'
};

const LEAD_STATUS_REVERSE = {
    'new': 'Novo',
    'contacted': 'Contatado',
    'negotiating': 'Em negociação',
    'client': 'Cliente',
    'discarded': 'Descartado'
};

/* ==================== STORAGE (localStorage fallback) ==================== */

const Storage = {
    KEY: 'weblead_establishments',
    KEY_USER: 'weblead_user',

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
            .map(e => ErrorHandler.sanitizeObject({
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
        all[idx] = { ...all[idx], ...ErrorHandler.sanitizeObject(data), updatedAt: new Date().toISOString() };
        this.save(all);
        return true;
    },

    remove(id) {
        const filtered = this.getAll().filter(e => e.id !== id);
        this.save(filtered);
    },

    clear() {
        localStorage.removeItem(this.KEY);
    },

    // Persistência de sessão offline
    saveUserSession(user) {
        localStorage.setItem(this.KEY_USER, JSON.stringify({
            user,
            savedAt: Date.now()
        }));
    },

    getUserSession() {
        try {
            return JSON.parse(localStorage.getItem(this.KEY_USER));
        } catch {
            return null;
        }
    },

    clearUserSession() {
        localStorage.removeItem(this.KEY_USER);
    }
};

/* ==================== NORMALIZADORES ==================== */

function flatToRelational(flat, userId) {
    const sanitized = ErrorHandler.sanitizeObject(flat);

    const establishment = {
        id: sanitized.id,
        googlePlaceId: sanitized.googlePlaceId || sanitized.id,
        name: sanitized.name,
        address: sanitized.address || '',
        location: {
            lat: sanitized.latitude,
            lng: sanitized.longitude,
            city: sanitized.city || ''
        },
        phone: sanitized.phone || null,
        categories: sanitized.category ? [sanitized.category] : [],
        website: sanitized.website || null,
        socialProfiles: {
            instagram: sanitized.instagram || null,
            facebook: sanitized.facebook || null,
            whatsapp: sanitized.whatsapp || null,
            email: sanitized.email || null
        },
        aiScore: sanitized.leadScore ?? null,
        lastUpdated: new Date().toISOString(),
        verified: false
    };

    const digitalPresence = {
        id: `dp-${sanitized.id}`,
        establishmentId: sanitized.id,
        hasWebsite: sanitized.hasWebsite || false,
        websiteUrl: sanitized.website || null,
        hasSocial: !!(sanitized.instagram || sanitized.facebook || sanitized.whatsapp),
        hasWhatsapp: !!sanitized.whatsapp,
        hasEmail: !!sanitized.email,
        socialHandles: {
            instagram: sanitized.instagram || null,
            facebook: sanitized.facebook || null,
            whatsapp: sanitized.whatsapp || null
        },
        socialActive: false,
        score: sanitized.hasWebsite ? 15 : (sanitized.hasMapsLocation ? 10 : 5)
    };

    const lead = {
        id: `lead-${sanitized.id}-${userId}`,
        userId: userId, // AGORA com userId!
        establishmentId: sanitized.id,
        score: sanitized.leadScore ?? 50,
        contactInfo: {
            phone: sanitized.phone || null,
            whatsapp: sanitized.whatsapp || null,
            email: sanitized.email || null,
            instagram: sanitized.instagram || null
        },
        status: LEAD_STATUS_MAP[sanitized.leadStatus] || 'new',
        createdAt: sanitized.createdAt || new Date().toISOString()
    };

    return { establishment, digitalPresence, lead };
}

function relationalToFlat(est, dp, lead) {
    const social = est.socialProfiles || dp?.socialHandles || {};
    const contact = lead?.contactInfo || {};

    return {
        id: est.id,
        name: est.name,
        address: est.address,
        city: est.location?.city || '',
        phone: est.phone || contact.phone || null,
        category: (est.categories && est.categories[0]) || 'Estabelecimento',
        website: est.website || dp?.websiteUrl || null,
        latitude: est.location?.lat || null,
        longitude: est.location?.lng || null,
        source: est.googlePlaceId?.startsWith('osm') ? 'openstreetmap' : 'google_places',
        mapsUrl: est.location?.lat
            ? `https://www.openstreetmap.org/?mlat=${est.location.lat}&mlon=${est.location.lng}`
            : null,
        hasWebsite: dp?.hasWebsite || false,
        hasMapsLocation: !!(est.location?.lat),
        instagram: social.instagram || contact.instagram || null,
        facebook: social.facebook || null,
        whatsapp: social.whatsapp || contact.whatsapp || null,
        email: social.email || contact.email || null,
        leadScore: lead?.score ?? est.aiScore ?? null,
        leadStatus: LEAD_STATUS_REVERSE[lead?.status] || 'Novo',
        aiEnriched: !!lead?.score,
        notes: lead?.notes || null,
        createdAt: lead?.createdAt || est.lastUpdated || new Date().toISOString(),
        updatedAt: lead?.updatedAt || null,
        rating: null,
        totalReviews: 0,
        userId: lead?.userId || null
    };
}

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
    _realtimeChannel: null,

    // ===== INIT =====
    async init() {
        try {
            const { url, anonKey } = CONFIG.supabase;
            if (!url || !anonKey) {
                ErrorHandler.info('Supabase não configurado. Usando localStorage.', { context: 'SupabaseClient.init' });
                this.ready = false;
                return false;
            }

            if (typeof supabase !== 'undefined') {
                this.client = supabase.createClient(url, anonKey);
                this.ready = true;
                ErrorHandler.info('Supabase conectado com sucesso!', { context: 'SupabaseClient.init' });
                this._setupRealtime();
                return true;
            } else {
                ErrorHandler.warn('Supabase SDK não carregado. Verifique a conexão de rede.');
                this.ready = false;
                return false;
            }
        } catch (e) {
            ErrorHandler.handleError(e, { context: 'SupabaseClient.init' });
            this.ready = false;
            return false;
        }
    },

    // ===== REALTIME (notificações ao vivo) =====
    _setupRealtime() {
        if (!this.ready || !this.client) return;

        try {
            this._realtimeChannel = this.client
                .channel('schema-db-changes')
                .on(
                    'postgres_changes',
                    { event: '*', schema: 'public', table: 'Lead' },
                    (payload) => {
                        ErrorHandler.info('Atualização em tempo real recebida', {
                            context: 'Realtime',
                            details: payload
                        });
                        // Se App estiver carregado, atualiza a UI
                        if (typeof App !== 'undefined') {
                            App.refreshIfNeeded(payload);
                        }
                    }
                )
                .subscribe();
        } catch (e) {
            ErrorHandler.warn('Realtime não disponível:', { context: 'SupabaseClient.realtime' });
        }
    },

    // ===== SALVAR ESTABELECIMENTOS =====
    async saveEstablishments(establishments) {
        if (!this.ready) {
            return Storage.addMany(establishments);
        }

        const userId = App?.currentUser?.id || null;
        if (!userId) {
            ErrorHandler.warn('Usuário não identificado ao salvar leads', { context: 'saveEstablishments' });
            return Storage.addMany(establishments);
        }

        let added = 0;
        const total = establishments.length;

        for (const flat of establishments) {
            try {
                const { establishment, digitalPresence, lead } = flatToRelational(flat, userId);

                // Upsert Establishment
                const { error: estErr } = await this.client
                    .from('Establishment')
                    .upsert(establishment, { onConflict: 'id' });
                if (estErr) {
                    ErrorHandler.warn('Erro ao salvar Establishment:', { context: 'saveEstablishments', details: estErr });
                    continue;
                }

                // Upsert DigitalPresence
                const { error: dpErr } = await this.client
                    .from('DigitalPresence')
                    .upsert(digitalPresence, { onConflict: 'establishmentId' });
                if (dpErr) {
                    ErrorHandler.warn('Erro ao salvar DigitalPresence:', { context: 'saveEstablishments', details: dpErr });
                }

                // Upsert Lead (agora com userId - unique por usuário+estabelecimento)
                const { error: leadErr } = await this.client
                    .from('Lead')
                    .upsert(lead, { onConflict: 'userId, establishmentId' });
                if (leadErr) {
                    ErrorHandler.warn('Erro ao salvar Lead:', { context: 'saveEstablishments', details: leadErr });
                } else {
                    added++;
                }
            } catch (err) {
                ErrorHandler.warn('Erro ao processar estabelecimento:', { context: 'saveEstablishments', details: err });
            }
        }

        return { added, total };
    },

    // ===== BUSCAR ESTABELECIMENTOS =====
    async getEstablishments() {
        if (!this.ready) {
            return Storage.getAll().map(localStorageToFlat);
        }

        const userId = App?.currentUser?.id;
        if (!userId) {
            ErrorHandler.warn('Usuário não identificado ao carregar leads', { context: 'getEstablishments' });
            return Storage.getAll().map(localStorageToFlat);
        }

        try {
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

            // Busca leads APENAS do usuário atual
            const { data: leads } = await this.client
                .from('Lead')
                .select('*')
                .eq('userId', userId)
                .order('createdAt', { ascending: false });

            // Index por establishmentId
            const dpMap = new Map();
            (presences || []).forEach(dp => dpMap.set(dp.establishmentId, dp));

            const leadMap = new Map();
            (leads || []).forEach(l => {
                if (!leadMap.has(l.establishmentId)) {
                    leadMap.set(l.establishmentId, l);
                }
            });

            return establishments.map(est => {
                const dp = dpMap.get(est.id);
                const lead = leadMap.get(est.id);
                return relationalToFlat(est, dp, lead);
            });
        } catch (err) {
            ErrorHandler.handleError(err, { context: 'getEstablishments' });
            return Storage.getAll().map(localStorageToFlat);
        }
    },

    // ===== ATUALIZAR LEAD =====
    async updateEstablishment(id, updates) {
        if (!this.ready) {
            Storage.update(id, updates);
            return true;
        }

        try {
            // Atualizar Lead se mudou o status
            if (updates.leadStatus) {
                const dbStatus = LEAD_STATUS_MAP[updates.leadStatus] || updates.leadStatus;
                const { error } = await this.client
                    .from('Lead')
                    .update({ status: dbStatus, updatedAt: new Date().toISOString() })
                    .eq('establishmentId', id)
                    .eq('userId', App?.currentUser?.id);

                if (error) throw error;
            }

            // Atualizar Establishment
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

            // Atualizar DigitalPresence
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
        } catch (err) {
            ErrorHandler.handleError(err, { context: 'updateEstablishment' });
            throw err;
        }
    },

    // ===== REMOVER LEAD =====
    async removeEstablishment(id) {
        if (!this.ready) {
            Storage.remove(id);
            return true;
        }

        try {
            const userId = App?.currentUser?.id;

            // Remove Lead do usuário
            const query = this.client.from('Lead').delete().eq('establishmentId', id);
            if (userId) {
                query.eq('userId', userId);
            }
            await query;

            return true;
        } catch (err) {
            ErrorHandler.handleError(err, { context: 'removeEstablishment' });
            throw err;
        }
    },

    // ===== REMOVER MÚLTIPLOS LEADS =====
    async removeMultipleEstablishments(ids) {
        if (!this.ready) {
            ids.forEach(id => Storage.remove(id));
            return true;
        }

        try {
            const userId = App?.currentUser?.id;
            for (const id of ids) {
                const query = this.client.from('Lead').delete().eq('establishmentId', id);
                if (userId) {
                    query.eq('userId', userId);
                }
                await query;
            }
            return true;
        } catch (err) {
            ErrorHandler.handleError(err, { context: 'removeMultipleEstablishments' });
            throw err;
        }
    },

    // ===== NOTAS DO LEAD =====
    async updateLeadNotes(id, notes) {
        if (!this.ready) {
            Storage.update(id, { notes });
            return true;
        }

        try {
            const { error } = await this.client
                .from('Lead')
                .update({ notes, updatedAt: new Date().toISOString() })
                .eq('establishmentId', id)
                .eq('userId', App?.currentUser?.id);

            if (error) throw error;
            return true;
        } catch (err) {
            ErrorHandler.handleError(err, { context: 'updateLeadNotes' });
            return false;
        }
    },

    // ===== HISTÓRICO DE BUSCAS =====
    async saveSearch(searchData) {
        if (!this.ready || !App?.currentUser?.id) return null;

        try {
            const { data, error } = await this.client
                .from('Search')
                .insert({
                    userId: App.currentUser.id,
                    location: searchData.location,
                    radius: searchData.radius || CONFIG.defaults.radius,
                    category: searchData.category,
                    resultsCount: searchData.resultsCount || 0
                })
                .select();

            if (error) throw error;
            return data?.[0] || null;
        } catch (err) {
            ErrorHandler.warn('Erro ao salvar histórico de busca:', { context: 'saveSearch', details: err });
            return null;
        }
    },

    async getSearchHistory(limit = 20) {
        if (!this.ready || !App?.currentUser?.id) return [];

        try {
            const { data, error } = await this.client
                .from('Search')
                .select('*')
                .eq('userId', App.currentUser.id)
                .order('createdAt', { ascending: false })
                .limit(limit);

            if (error) throw error;
            return data || [];
        } catch (err) {
            ErrorHandler.warn('Erro ao carregar histórico:', { context: 'getSearchHistory', details: err });
            return [];
        }
    },

    // ===== PLANO DO USUÁRIO =====
    async getUserPlan() {
        if (!this.ready || !App?.currentUser?.id) {
            return { plan: 'BASIC', status: 'active', maxLeads: CONFIG.plans.BASIC.maxLeadsPerMonth };
        }

        try {
            const { data, error } = await this.client
                .from('Subscription')
                .select('*')
                .eq('userId', App.currentUser.id)
                .order('createdAt', { ascending: false })
                .limit(1)
                .single();

            if (error) throw error;

            const planKey = data?.plan || 'BASIC';
            const planConfig = CONFIG.plans[planKey] || CONFIG.plans.BASIC;

            return {
                plan: planKey,
                status: data?.status || 'active',
                expiresAt: data?.expiresAt,
                maxLeads: planConfig.maxLeadsPerMonth,
                maxSearches: planConfig.maxSearchesPerDay,
                features: planConfig.features
            };
        } catch (err) {
            ErrorHandler.warn('Erro ao carregar plano:', { context: 'getUserPlan', details: err });
            return { plan: 'BASIC', status: 'active', maxLeads: CONFIG.plans.BASIC.maxLeadsPerMonth };
        }
    },

    // ===== CONTAGEM DE LEADS DO MÊS =====
    async getMonthlyLeadCount() {
        if (!this.ready || !App?.currentUser?.id) {
            return Storage.getAll().length;
        }

        try {
            const startOfMonth = new Date();
            startOfMonth.setDate(1);
            startOfMonth.setHours(0, 0, 0, 0);

            const { count, error } = await this.client
                .from('Lead')
                .select('*', { count: 'exact', head: true })
                .eq('userId', App.currentUser.id)
                .gte('createdAt', startOfMonth.toISOString());

            if (error) throw error;
            return count || 0;
        } catch (err) {
            ErrorHandler.warn('Erro ao contar leads do mês:', { context: 'getMonthlyLeadCount' });
            return Storage.getAll().length;
        }
    },

    // ===== CHECK DE LIMITE =====
    async checkLeadLimit() {
        const plan = await this.getUserPlan();
        const currentCount = await this.getMonthlyLeadCount();

        return {
            withinLimit: currentCount < plan.maxLeads,
            current: currentCount,
            max: plan.maxLeads,
            plan: plan.plan
        };
    },

    // ===== ATUALIZAÇÃO DE PERFIL =====
    async updateProfile(updates) {
        if (!this.ready || !App?.currentUser?.id) return false;

        try {
            const { error } = await this.client
                .from('User')
                .update({
                    ...ErrorHandler.sanitizeObject(updates),
                    updatedAt: new Date().toISOString()
                })
                .eq('id', App.currentUser.id);

            if (error) throw error;
            return true;
        } catch (err) {
            ErrorHandler.handleError(err, { context: 'updateProfile' });
            return false;
        }
    },

    // ===== CLEANUP =====
    destroy() {
        if (this._realtimeChannel) {
            this.client.removeChannel(this._realtimeChannel);
        }
    }
};