/**
 * Cliente Supabase — ativo quando CONFIG.supabase estiver preenchido.
 * Por enquanto usa localStorage como fallback.
 */

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
        const newItems = items.filter(e => !ids.has(e.id));
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

    async saveEstablishments(establishments) {
        if (!this.ready) {
            return Storage.addMany(establishments);
        }

        const { data, error } = await this.client
            .from('establishments')
            .upsert(establishments, { onConflict: 'id' });

        if (error) throw error;
        return { added: data?.length || establishments.length, total: data?.length };
    },

    async getEstablishments() {
        if (!this.ready) {
            return Storage.getAll();
        }

        const { data, error } = await this.client
            .from('establishments')
            .select('*')
            .order('created_at', { ascending: false });

        if (error) throw error;
        return data || [];
    },

    async updateEstablishment(id, updates) {
        if (!this.ready) {
            Storage.update(id, updates);
            return true;
        }

        const { error } = await this.client
            .from('establishments')
            .update({ ...updates, updated_at: new Date().toISOString() })
            .eq('id', id);

        if (error) throw error;
        return true;
    },

    async removeEstablishment(id) {
        if (!this.ready) {
            Storage.remove(id);
            return true;
        }

        const { error } = await this.client
            .from('establishments')
            .delete()
            .eq('id', id);

        if (error) throw error;
        return true;
    }
};
