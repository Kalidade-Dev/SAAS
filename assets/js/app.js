/**
 * SaaS MAPS — Dashboard Principal v2
 * 
 * Melhorias:
 * - Tratamento de erros centralizado via ErrorHandler
 * - Lazy loading com skeleton screens
 * - Paginação nos leads salvos
 * - Ordenação por coluna na tabela
 * - Export CSV completo (resultados + leads salvos)
 * - Suporte a notificações Realtime
 */

const App = {
    results: [],
    filteredResults: [],
    savedLeads: [],
    displayedSavedLeads: [], // Leads salvos paginados
    isScanning: false,
    pageSize: 10,
    savedPageSize: 10,
    currentPage: 1,
    savedCurrentPage: 1,

    currentUser: null,
    currentPlan: null,

    citiesCache: {},
    currentCities: [],
    citiesStorageKey: 'weblead_cities_cache_v1',
    citySuggestTimer: null,
    selectedCityIndex: -1,

    // Ordenação da tabela
    sortColumn: null,
    sortDirection: 'asc',

    async init() {
        try {
            // Inicializar Supabase primeiro
            await SupabaseClient.init();
            // Verificar autenticação
            await this.checkAuth();
            // Carregar plano do usuário
            this.currentPlan = await SupabaseClient.getUserPlan();
            this.bindEvents();
            await this.loadSaved();
            this.updateUI();
            // Inicia na tab de busca por padrão
            this.switchTab('search');
            // Re-renderiza a tabela se houver resultados carregados
            if (this.results.length) {
                this.renderTable();
            }
            ErrorHandler.info('Dashboard inicializado com sucesso!', { context: 'App.init' });
        } catch (err) {
            ErrorHandler.handleError(err, { context: 'App.init' });
        }
    },

    async loadCities(stateCode) {
        const cityInput = document.getElementById('cityInput');
        const loading = document.getElementById('cityLoading');

        if (!stateCode) {
            cityInput.disabled = true;
            cityInput.value = '';
            cityInput.placeholder = 'Selecione o estado primeiro...';
            this.currentCities = [];
            this.hideCitySuggestions();
            return;
        }

        const cached = this.getCachedCities(stateCode);
        if (cached) {
            this.applyCities(stateCode, cached);
            return;
        }

        loading.style.display = 'block';
        cityInput.disabled = true;
        cityInput.placeholder = 'Carregando cidades...';

        try {
            const cities = await this.fetchCitiesFromIBGE(stateCode);
            this.setCachedCities(stateCode, cities);
            this.applyCities(stateCode, cities);
        } catch (err) {
            console.warn('Erro ao buscar cidades:', err);
            cityInput.disabled = false;
            cityInput.placeholder = 'Erro ao carregar — digite a cidade';
            this.currentCities = [];
        } finally {
            loading.style.display = 'none';
        }
    },

    getStoredCitiesMap() {
        try {
            return JSON.parse(localStorage.getItem(this.citiesStorageKey) || '{}');
        } catch {
            return {};
        }
    },

    getCachedCities(stateCode) {
        if (this.citiesCache[stateCode]) {
            return this.citiesCache[stateCode];
        }

        const stored = this.getStoredCitiesMap()[stateCode];
        if (stored?.cities?.length) {
            this.citiesCache[stateCode] = stored.cities;
            return stored.cities;
        }

        return null;
    },

    setCachedCities(stateCode, cities) {
        this.citiesCache[stateCode] = cities;
        const map = this.getStoredCitiesMap();
        map[stateCode] = { cities, cachedAt: Date.now() };
        try {
            localStorage.setItem(this.citiesStorageKey, JSON.stringify(map));
        } catch (err) {
            console.warn('Cache de cidades indisponível:', err);
        }
    },

    async fetchCitiesFromIBGE(stateCode) {
        const res = await fetch(
            `https://servicodados.ibge.gov.br/api/v1/localidades/estados/${stateCode}/municipios?orderBy=nome`
        );
        if (!res.ok) throw new Error('Falha ao carregar cidades');
        const data = await res.json();
        return data.map(c => ({ id: c.id, nome: c.nome }));
    },

    applyCities(stateCode, cities) {
        this.currentCities = cities;
        const cityInput = document.getElementById('cityInput');
        cityInput.disabled = false;
        cityInput.value = '';
        cityInput.placeholder = 'Digite para buscar a cidade...';
        this.hideCitySuggestions();
        cityInput.focus();
    },

    bindCityAutocomplete() {
        const cityInput = document.getElementById('cityInput');
        const suggestions = document.getElementById('citySuggestions');

        cityInput.addEventListener('input', () => {
            clearTimeout(this.citySuggestTimer);
            this.citySuggestTimer = setTimeout(() => {
                this.renderCitySuggestions(cityInput.value);
            }, 60);
        });

        cityInput.addEventListener('focus', () => {
            if (cityInput.value.trim()) {
                this.renderCitySuggestions(cityInput.value);
            }
        });

        cityInput.addEventListener('keydown', e => {
            const items = suggestions.querySelectorAll('.city-suggestion-item');
            if (!items.length) return;

            if (e.key === 'ArrowDown') {
                e.preventDefault();
                this.selectedCityIndex = Math.min(this.selectedCityIndex + 1, items.length - 1);
                this.highlightCitySuggestion(items);
            } else if (e.key === 'ArrowUp') {
                e.preventDefault();
                this.selectedCityIndex = Math.max(this.selectedCityIndex - 1, 0);
                this.highlightCitySuggestion(items);
            } else if (e.key === 'Enter' && this.selectedCityIndex >= 0) {
                e.preventDefault();
                items[this.selectedCityIndex].click();
            } else if (e.key === 'Escape') {
                this.hideCitySuggestions();
            }
        });

        suggestions.addEventListener('mousedown', e => {
            const item = e.target.closest('.city-suggestion-item');
            if (!item) return;
            e.preventDefault();
            this.selectCity(item.dataset.city);
        });

        document.addEventListener('click', e => {
            if (!e.target.closest('.search-field-city')) {
                this.hideCitySuggestions();
            }
        });
    },

    normalizeText(str) {
        return (str || '')
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .toLowerCase()
            .trim();
    },

    filterCities(query) {
        const q = this.normalizeText(query);
        if (!q || !this.currentCities.length) return [];

        const starts = [];
        const includes = [];

        for (const city of this.currentCities) {
            const name = this.normalizeText(city.nome);
            if (name.startsWith(q)) starts.push(city);
            else if (name.includes(q)) includes.push(city);
            if (starts.length >= 8) break;
        }

        return [...starts, ...includes].slice(0, 8);
    },

    renderCitySuggestions(query) {
        const suggestions = document.getElementById('citySuggestions');
        const matches = this.filterCities(query);

        if (!matches.length) {
            this.hideCitySuggestions();
            return;
        }

        this.selectedCityIndex = -1;
        suggestions.innerHTML = matches.map(city => `
            <button type="button" class="city-suggestion-item" data-city="${this.escape(city.nome)}">
                <i class="fa-solid fa-location-dot"></i>
                <span>${this.escape(city.nome)}</span>
            </button>
        `).join('');
        suggestions.hidden = false;
    },

    highlightCitySuggestion(items) {
        items.forEach((item, index) => {
            item.classList.toggle('active', index === this.selectedCityIndex);
        });
        items[this.selectedCityIndex]?.scrollIntoView({ block: 'nearest' });
    },

    selectCity(name) {
        const cityInput = document.getElementById('cityInput');
        cityInput.value = name;
        this.hideCitySuggestions();
    },

    hideCitySuggestions() {
        const suggestions = document.getElementById('citySuggestions');
        suggestions.hidden = true;
        suggestions.innerHTML = '';
        this.selectedCityIndex = -1;
    },

    getSelectedStateName() {
        const select = document.getElementById('stateInput');
        const option = select.options[select.selectedIndex];
        return option ? option.textContent.trim() : '';
    },

    async checkAuth() {
        // Se Supabase está configurado, verificar sessão
        if (SupabaseClient.ready && SupabaseClient.client) {
            const { data: { session } } = await SupabaseClient.client.auth.getSession();
            if (!session) {
                window.location.href = '../Login/login.html';
                return;
            }
            this.currentUser = session.user;
            this.updateUserDisplay();
            return;
        }

        // Fallback: verificar sessionStorage
        const user = sessionStorage.getItem('saas_user');
        const email = sessionStorage.getItem('saas_email');
        if (!user && !email) {
            window.location.href = '../Login/login.html';
            return;
        }
        this.currentUser = { user_metadata: { name: user }, email: email };
        this.updateUserDisplay();
    },

    updateUserDisplay() {
        const name = this.currentUser?.user_metadata?.name
            || this.currentUser?.email?.split('@')[0]
            || 'Usuário';
        const email = this.currentUser?.email || '';

        // Atualizar header se existir elemento de usuário
        const header = document.querySelector('.dash-header');
        if (header) {
            const existing = header.querySelector('.user-info');
            if (!existing) {
                const userDiv = document.createElement('div');
                userDiv.className = 'user-info';
                userDiv.style.cssText = 'display:flex;align-items:center;gap:12px;justify-content:center;margin-top:12px;';
                userDiv.innerHTML = `
                    <span style="color:var(--text-muted);font-size:0.85rem;">
                        <i class="fa-solid fa-user"></i> ${this.escape(name)}
                        ${email ? `<span style="margin-left:6px;opacity:0.6;">(${this.escape(email)})</span>` : ''}
                    </span>
                    <button onclick="App.logout()" style="background:none;border:1px solid #333;color:var(--text-muted);padding:4px 12px;border-radius:8px;font-size:0.78rem;cursor:pointer;font-family:'Poppins',sans-serif;transition:0.2s;" onmouseover="this.style.borderColor='var(--danger)';this.style.color='var(--danger)'" onmouseout="this.style.borderColor='#333';this.style.color='var(--text-muted)'">
                        <i class="fa-solid fa-right-from-bracket"></i> Sair
                    </button>
                `;
                header.appendChild(userDiv);
            }
        }
    },

    async logout() {
        this.openConfirmModal({
            action: 'logout',
            title: 'Sair da conta?',
            message: 'Tem certeza que deseja encerrar sua sessão? Você precisará fazer login novamente para acessar o painel.',
            icon: 'fa-right-from-bracket',
            confirmLabel: 'Sair',
            variant: 'danger'
        });
    },

    async executeLogout() {
        try {
            if (SupabaseClient.ready && SupabaseClient.client) {
                await SupabaseClient.client.auth.signOut();
            }
        } catch (e) {
            console.warn('Erro ao fazer logout:', e);
        }
        sessionStorage.clear();
        window.location.href = '../Login/login.html';
    },

    get totalPages() {
        return Math.ceil(this.filteredResults.length / this.pageSize) || 1;
    },

    get paginatedResults() {
        const start = (this.currentPage - 1) * this.pageSize;
        return this.filteredResults.slice(start, start + this.pageSize);
    },

    prevPage() {
        if (this.currentPage > 1) {
            this.currentPage--;
            this.renderTable();
        }
    },

    nextPage() {
        if (this.currentPage < this.totalPages) {
            this.currentPage++;
            this.renderTable();
        }
    },

    updatePagination() {
        const prevBtn = document.getElementById('prevPage');
        const nextBtn = document.getElementById('nextPage');
        const pageInfo = document.getElementById('pageInfo');
        pageInfo.textContent = `Página ${this.currentPage} de ${this.totalPages}`;
        prevBtn.disabled = this.currentPage <= 1;
        nextBtn.disabled = this.currentPage >= this.totalPages;
    },

    bindEvents() {
        document.getElementById('searchForm').addEventListener('submit', e => {
            e.preventDefault();
            this.runSearch();
        });

        document.getElementById('exportBtn').addEventListener('click', () => this.exportCSV());
        document.getElementById('clearBtn').addEventListener('click', () => this.showClearConfirm());
        document.getElementById('tableSearch').addEventListener('input', e => this.filterTable(e.target.value));
        document.getElementById('modalClose').addEventListener('click', () => this.closeModal());
        document.getElementById('detailModalClose').addEventListener('click', () => this.closeModal());

        // Quando o estado mudar, buscar cidades do IBGE
        document.getElementById('stateInput').addEventListener('change', e => {
            this.loadCities(e.target.value);
        });

        this.bindCityAutocomplete();

        // Tabs
        document.querySelectorAll('.dash-tab').forEach(tab => {
            tab.addEventListener('click', () => {
                document.querySelectorAll('.dash-tab').forEach(t => t.classList.remove('active'));
                tab.classList.add('active');
                this.switchTab(tab.dataset.tab);
            });
        });

        // Fechar modal ao clicar fora
        document.getElementById('detailModal').addEventListener('click', e => {
            if (e.target === e.currentTarget) this.closeModal();
        });

        document.getElementById('confirmCancelBtn').addEventListener('click', () => this.closeConfirmModal());
        document.getElementById('confirmActionBtn').addEventListener('click', () => this.handleConfirmAction());
        document.getElementById('confirmModal').addEventListener('click', e => {
            if (e.target === e.currentTarget) this.closeConfirmModal();
        });

        document.addEventListener('click', e => {
            if (!e.target.closest('.status-dropdown')) {
                this.closeAllStatusDropdowns();
            }
        });
    },

    switchTab(tab) {
        const searchCard = document.getElementById('searchCard');
        const resultsSection = document.getElementById('resultsSection');
        const actionsRow = document.getElementById('actionsRow');
        const savedSection = document.getElementById('savedSection');

        // Esconde tudo primeiro
        searchCard.style.display = 'none';
        resultsSection.style.display = 'none';
        actionsRow.style.display = 'none';
        savedSection.style.display = 'none';

        if (tab === 'search') {
            searchCard.style.display = 'block';
            resultsSection.style.display = this.results.length ? 'block' : 'none';
            actionsRow.style.display = this.results.length ? 'flex' : 'none';
            // Re-renderiza a tabela ao voltar para a aba de busca
            if (this.filteredResults.length) {
                this.renderTable();
            }
        } else if (tab === 'saved') {
            savedSection.style.display = 'block';
            this.renderSavedLeads();
        }
    },

    async runSearch() {
        ErrorHandler.try(async () => {
            const state = document.getElementById('stateInput').value;
            const city = document.getElementById('cityInput').value.trim();
            const category = document.getElementById('categoryInput').value.trim();

            if (!state) {
                ErrorHandler.toast('Selecione o estado', 'warning');
                return;
            }

            if (!city) {
                ErrorHandler.toast('Informe a cidade para buscar', 'warning');
                return;
            }

            const btn = document.getElementById('searchBtn');
            btn.disabled = true;
            btn.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin"></i> Buscando...';

            const searchMsg = document.getElementById('searchMessage');
            if (searchMsg) {
                searchMsg.style.display = 'flex';
                searchMsg.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Procurando estabelecimentos na região...';
            }

            try {
                const stateName = this.getSelectedStateName();
                const searchCity = `${city}, ${stateName}, Brasil`;
                const results = await SearchEngine.search({
                    city: searchCity,
                    category: category || '',
                    radius: 10000,
                    filters: {
                        noWebsite: false,
                        noMaps: false,
                        noPhone: false,
                        bothMissing: false
                    }
                });

                this.results = results;
                this.filteredResults = results;
                this.currentPage = 1;
                this.renderTable();
                this.updateUI();
                this.renderDashboardStats();

                // Salva histórico da busca
                SupabaseClient.saveSearch({
                    location: { city, state: stateName },
                    radius: 10000,
                    category: category,
                    resultsCount: results.length
                });

                if (results.length) {
                    ErrorHandler.toast(`${results.length} estabelecimentos encontrados em ${city}. Clique em salvar para adicionar ao CRM.`, 'success');
                } else {
                    ErrorHandler.toast('Nenhum estabelecimento encontrado', 'info');
                }
            } catch (err) {
                ErrorHandler.handleError(err, { context: 'App.runSearch' });
            } finally {
                btn.disabled = false;
                btn.innerHTML = '<i class="fa-solid fa-magnifying-glass"></i> Buscar';
                if (searchMsg) searchMsg.style.display = 'none';
            }
        }, 'App.runSearch');
    },

    async loadSaved() {
        try {
            this.savedLeads = await SupabaseClient.getEstablishments();
        } catch (err) {
            console.warn('Erro ao carregar dados:', err);
        }
    },

    getLeadPool() {
        const map = new Map();

        [...this.savedLeads, ...this.results].forEach(lead => {
            if (!lead || !lead.id || map.has(lead.id)) return;
            map.set(lead.id, lead);
        });

        return map.size ? Array.from(map.values()) : this.savedLeads;
    },

    renderDashboardStats() {
        const leads = this.getLeadPool();
        const total = leads.length;
        const withSite = leads.filter(lead => lead.hasWebsite).length;
        const withoutSite = total - withSite;
        const withMaps = leads.filter(lead => lead.hasMapsLocation).length;
        const withPhone = leads.filter(lead => lead.phone).length;
        const categories = Array.from(new Set(leads.map(lead => lead.category || 'Sem categoria'))).length;

        document.getElementById('statTotal').textContent = total;
        document.getElementById('statWithSite').textContent = withSite;
        document.getElementById('statWithoutSite').textContent = withoutSite;
        document.getElementById('statCategories').textContent = categories;

        const updatedAt = document.getElementById('panelUpdatedAt');
        if (updatedAt) {
            const now = new Date();
            updatedAt.innerHTML = `<i class="fa-solid fa-clock"></i> Atualizado às ${now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`;
        }

        this.renderPanelFunnel();

        const donutPanel = document.getElementById('donutPanel');
        const categoryPanel = document.getElementById('categoryPanel');

        if (!total) {
            donutPanel.innerHTML = `
                <div class="analytics-empty">
                    <div>
                        <i class="fa-solid fa-chart-pie"></i>
                        <div>Os indicadores aparecem após buscar ou carregar leads.</div>
                    </div>
                </div>
            `;
            categoryPanel.innerHTML = `
                <div class="analytics-empty">
                    <div>
                        <i class="fa-solid fa-chart-column"></i>
                        <div>As categorias serão agrupadas aqui.</div>
                    </div>
                </div>
            `;
            return;
        }

        const sitePct = Math.round((withSite / total) * 100);
        const noSitePct = 100 - sitePct;
        const mapsPct = Math.round((withMaps / total) * 100);
        const phonePct = Math.round((withPhone / total) * 100);

        donutPanel.innerHTML = `
            <div class="donut" style="--site-pct:${sitePct}%">
                <div class="donut-center">
                    <div>
                        <strong>${total}</strong>
                        <span>leads</span>
                    </div>
                </div>
            </div>
            <div class="donut-metrics">
                <div class="donut-metric">
                    <span class="donut-metric-label"><i class="fa-solid fa-globe"></i> Com site</span>
                    <strong>${sitePct}%</strong>
                </div>
                <div class="donut-metric">
                    <span class="donut-metric-label"><i class="fa-solid fa-map-pin"></i> No Maps</span>
                    <strong>${mapsPct}%</strong>
                </div>
                <div class="donut-metric">
                    <span class="donut-metric-label"><i class="fa-solid fa-phone"></i> Com telefone</span>
                    <strong>${phonePct}%</strong>
                </div>
            </div>
            <div class="donut-legend">
                <div class="legend-item"><span class="legend-dot" style="--legend-color:var(--success)"></span> Com site (${withSite}) <span class="legend-pct">${sitePct}%</span></div>
                <div class="legend-item"><span class="legend-dot" style="--legend-color:var(--accent)"></span> Sem site (${withoutSite}) <span class="legend-pct">${noSitePct}%</span></div>
            </div>
            <div class="donut-summary">
                <div class="donut-opportunity">
                    <i class="fa-solid fa-bullhorn"></i>
                    <strong>${withoutSite}</strong> oportunidades sem site
                </div>
            </div>
        `;

        // Category Chart - Barras horizontais
        const categoryCounts = leads.reduce((acc, lead) => {
            const category = lead.category || 'Sem categoria';
            acc[category] = (acc[category] || 0) + 1;
            return acc;
        }, {});

        const maxCount = Math.max(...Object.values(categoryCounts));
        const palette = ['#6366f1', '#ec4899', '#f97316', '#22c55e', '#8b5cf6', '#06b6d4', '#f59e0b', '#ef4444'];

        categoryPanel.innerHTML = Object.entries(categoryCounts)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 8)
            .map(([category, count], index) => `
                <div class="category-row">
                    <div class="category-label"><span>${this.escape(category)}</span></div>
                    <div class="category-bar">
                        <div class="category-fill" style="--bar-pct:${Math.max(8, Math.round((count / maxCount) * 100))}%; --bar-color:${palette[index % palette.length]}"></div>
                    </div>
                    <div class="category-value">${count}</div>
                </div>
            `).join('');
    },

    renderPanelFunnel() {
        const funnel = document.getElementById('panelFunnel');
        if (!funnel) return;

        const statuses = this.leadStatuses;
        const counts = statuses.map(status => ({
            status,
            count: this.savedLeads.filter(l => (l.leadStatus || 'Novo') === status).length
        }));
        const totalSaved = this.savedLeads.length;

        if (!totalSaved) {
            funnel.innerHTML = `
                <div class="panel-funnel-empty">
                    <i class="fa-solid fa-filter"></i>
                    <span>Salve leads para acompanhar o funil comercial aqui.</span>
                </div>
            `;
            return;
        }

        const icons = {
            'Novo': 'fa-star',
            'Contatado': 'fa-message',
            'Em negociação': 'fa-handshake',
            'Cliente': 'fa-circle-check',
            'Descartado': 'fa-circle-xmark'
        };
        const classes = {
            'Novo': 'funnel-info',
            'Contatado': 'funnel-warning',
            'Em negociação': 'funnel-orange',
            'Cliente': 'funnel-success',
            'Descartado': 'funnel-danger'
        };

        funnel.innerHTML = `
            <div class="panel-funnel-header">
                <h3><i class="fa-solid fa-filter"></i> Funil comercial</h3>
                <span>${totalSaved} leads salvos</span>
            </div>
            <div class="panel-funnel-grid">
                ${counts.map(({ status, count }) => `
                    <div class="panel-funnel-card ${classes[status]}">
                        <div class="panel-funnel-icon"><i class="fa-solid ${icons[status]}"></i></div>
                        <div class="panel-funnel-value">${count}</div>
                        <div class="panel-funnel-label">${status}</div>
                    </div>
                `).join('')}
            </div>
        `;
    },

    // ====== SAVED LEADS ======

    savedFilter: 'all',
    savedQuery: '',
    pendingDeleteId: null,
    confirmAction: null,
    leadStatuses: ['Novo', 'Contatado', 'Em negociação', 'Cliente', 'Descartado'],
    selectedLeadIds: new Set(),

    toggleSelectLead(id, checked) {
        if (checked) {
            this.selectedLeadIds.add(id);
        } else {
            this.selectedLeadIds.delete(id);
        }
        const card = document.querySelector(`.saved-lead-card[data-id="${id}"]`);
        if (card) {
            card.classList.toggle('selected', checked);
        }
        this.updateDeleteSelectedBtn();
    },

    updateDeleteSelectedBtn() {
        const btn = document.getElementById('deleteSelectedBtn');
        if (btn) {
            btn.style.display = this.selectedLeadIds.size > 0 ? 'inline-flex' : 'none';
            btn.innerHTML = `<i class="fa-solid fa-trash"></i> Excluir selecionados (${this.selectedLeadIds.size})`;
        }
    },

    async deleteSelectedLeads() {
        const ids = Array.from(this.selectedLeadIds);
        if (!ids.length) return;

        const count = ids.length;
        const message = `Tem certeza que deseja excluir <strong>${count} lead${count > 1 ? 's' : ''}</strong> selecionado${count > 1 ? 's' : ''}? Esta ação não pode ser desfeita.`;

        this.openConfirmModal({
            action: 'deleteSelected',
            title: 'Excluir leads selecionados?',
            message: message,
            icon: 'fa-trash-can',
            confirmLabel: `Excluir ${count}`,
            variant: 'danger'
        });
    },

    async renderSavedLeads() {
        this.savedLeads = await SupabaseClient.getEstablishments();
        this.renderSavedUI();
    },

    renderSavedUI() {
        const container = document.getElementById('savedLeadsList');
        const empty = document.getElementById('savedEmpty');
        const filterEmpty = document.getElementById('savedFilterEmpty');
        const count = document.getElementById('savedCount');

        const total = this.savedLeads.length;
        count.textContent = `(${total})`;

        if (!total) {
            container.innerHTML = '';
            empty.style.display = 'block';
            filterEmpty.style.display = 'none';
            document.getElementById('savedCounters').innerHTML = '';
            return;
        }

        empty.style.display = 'none';
        filterEmpty.style.display = 'none';

        this.renderSavedCounters();

        // Aplica busca, filtro e ordenação
        const filtered = this.getFilteredSavedLeads();

        if (!filtered.length) {
            container.innerHTML = '';
            filterEmpty.style.display = 'block';
            return;
        }
        filterEmpty.style.display = 'none';

        const sortVal = document.getElementById('savedSort').value;
        const sorted = this.sortLeads(filtered, sortVal);

        container.innerHTML = sorted.map(lead => this.renderSavedCard(lead)).join('');
    },

    getFilteredSavedLeads() {
        let leads = [...this.savedLeads];

        // Filtro por status
        if (this.savedFilter !== 'all') {
            leads = leads.filter(l => l.leadStatus === this.savedFilter);
        }

        // Busca textual
        if (this.savedQuery) {
            const q = this.savedQuery.toLowerCase().trim();
            leads = leads.filter(l =>
                (l.name || '').toLowerCase().includes(q) ||
                (l.category || '').toLowerCase().includes(q) ||
                (l.city || '').toLowerCase().includes(q) ||
                (l.address || '').toLowerCase().includes(q) ||
                (l.phone || '').includes(q)
            );
        }

        return leads;
    },

    sortLeads(leads, sortVal) {
        const sorted = [...leads];
        // Suporta tanto created_at (Supabase) quanto createdAt (OSM/localStorage)
        const getDate = e => new Date(e.created_at || e.createdAt || 0);
        switch (sortVal) {
            case 'recent':
                sorted.sort((a, b) => getDate(b) - getDate(a));
                break;
            case 'oldest':
                sorted.sort((a, b) => getDate(a) - getDate(b));
                break;
            case 'noSite':
                sorted.sort((a, b) => (a.hasWebsite ? 1 : 0) - (b.hasWebsite ? 1 : 0));
                break;
            case 'noMaps':
                sorted.sort((a, b) => (a.hasMapsLocation ? 1 : 0) - (b.hasMapsLocation ? 1 : 0));
                break;
        }
        return sorted;
    },

    filterSavedLeads() {
        this.savedQuery = document.getElementById('savedSearchInput').value;
        this.renderSavedUI();
    },

    setSavedFilter(filter) {
        this.savedFilter = filter;
        document.querySelectorAll('.saved-filter-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.filter === filter);
        });
        this.renderSavedUI();
    },

    sortSavedLeads() {
        this.renderSavedUI();
    },

    renderSavedCounters() {
        const counters = document.getElementById('savedCounters');
        const statuses = ['Novo', 'Contatado', 'Em negociação', 'Cliente', 'Descartado'];
        const counts = statuses.map(status => ({
            status,
            count: this.savedLeads.filter(l => l.leadStatus === status).length
        }));

        counters.innerHTML = counts.map(({ status, count }) => {
            const icon = status === 'Novo' ? 'fa-star' :
                status === 'Contatado' ? 'fa-message' :
                status === 'Em negociação' ? 'fa-handshake' :
                status === 'Cliente' ? 'fa-circle-check' : 'fa-circle-xmark';
            const cls = status === 'Novo' ? 'counter-info' :
                status === 'Contatado' ? 'counter-warning' :
                status === 'Em negociação' ? 'counter-orange' :
                status === 'Cliente' ? 'counter-success' : 'counter-danger';
            return `
            <div class="saved-counter ${cls}">
                <div class="counter-icon"><i class="fa-solid ${icon}"></i></div>
                <div class="counter-info-wrap">
                    <span class="counter-value">${count}</span>
                    <span class="counter-label">${status}</span>
                </div>
            </div>`;
        }).join('');
    },

    renderSavedCard(lead) {
        const id = this.escape(lead.id);
        const name = this.escape(lead.name);
        const category = this.escape(lead.category || 'Sem categoria');
        const address = lead.address ? this.escape(lead.address) : (lead.city ? this.escape(lead.city) : '');
        const phone = lead.phone ? this.escape(lead.phone) : '';
        const hasWebsite = lead.hasWebsite;
        const hasMaps = lead.hasMapsLocation;
        const status = lead.leadStatus || 'Novo';
        const statusClass = status.replace(/\s+/g, '');

        const statusOptions = this.leadStatuses.map(s => `
            <button type="button"
                class="status-dropdown-item ${s === status ? 'active' : ''}"
                data-status="${this.escape(s)}"
                onclick="App.selectLeadStatus('${id}', this.dataset.status, event)">
                <span class="status-check">${s === status ? '<i class="fa-solid fa-check"></i>' : ''}</span>
                <span>${this.escape(s)}</span>
            </button>
        `).join('');

        const isSelected = this.selectedLeadIds.has(id);

        return `
            <div class="saved-lead-card ${isSelected ? 'selected' : ''}" data-id="${id}">
                <div class="saved-lead-main">
                    <label class="saved-lead-checkbox" onclick="event.stopPropagation()">
                        <input type="checkbox" ${isSelected ? 'checked' : ''} onchange="App.toggleSelectLead('${id}', this.checked)">
                        <span class="saved-lead-checkbox-mark"></span>
                    </label>
                    <div class="saved-lead-icon">
                        <i class="fa-solid fa-store"></i>
                    </div>
                    <div class="saved-lead-info">
                        <div class="saved-lead-name">${name}</div>
                        <div class="saved-lead-category">${category}</div>
                        ${address ? `<div class="saved-lead-address">${address}</div>` : ''}
                        ${phone
                            ? `<div class="saved-lead-phone"><i class="fa-solid fa-phone"></i> <a href="tel:${phone}">${phone}</a></div>`
                            : `<div class="saved-lead-phone muted"><i class="fa-solid fa-phone-slash"></i> Sem telefone</div>`}
                        <div class="saved-lead-tags">
                            ${this.renderSignalTag('phone', !!lead.phone, 'Com telefone', 'Sem telefone')}
                            ${this.renderSignalTag('site', hasWebsite, 'Tem site', 'Sem site')}
                            ${this.renderSignalTag('maps', hasMaps, 'No Maps', 'Sem Maps')}
                            <span class="signal-tag signal-tag--status signal-tag--status-${statusClass}" data-status-tag="${id}">${this.escape(status)}</span>
                        </div>
                    </div>
                </div>

                <div class="saved-lead-controls">
                    <div class="status-dropdown" data-id="${id}">
                        <button type="button" class="status-dropdown-trigger" onclick="App.toggleStatusDropdown('${id}', event)">
                            <span class="status-dropdown-label">${this.escape(status)}</span>
                            <i class="fa-solid fa-chevron-down"></i>
                        </button>
                        <div class="status-dropdown-menu">${statusOptions}</div>
                    </div>
                    <button type="button" class="btn-icon btn-icon-view" onclick="App.showDetail('${id}')" title="Ver detalhes">
                        <i class="fa-solid fa-eye"></i>
                    </button>
                    <button type="button" class="btn-delete-lead" onclick="App.showDeleteConfirm('${id}')" title="Excluir">
                        <i class="fa-solid fa-trash"></i>
                    </button>
                </div>
            </div>
        `;
    },

    toggleStatusDropdown(id, event) {
        event.stopPropagation();
        const dropdown = document.querySelector(`.status-dropdown[data-id="${id}"]`);
        if (!dropdown) return;

        const isOpen = dropdown.classList.contains('open');
        this.closeAllStatusDropdowns();
        if (!isOpen) dropdown.classList.add('open');
    },

    closeAllStatusDropdowns() {
        document.querySelectorAll('.status-dropdown.open').forEach(el => el.classList.remove('open'));
    },

    async selectLeadStatus(id, status, event) {
        event.stopPropagation();
        this.closeAllStatusDropdowns();
        await this.updateLeadStatus(id, status);
    },

    async updateLeadStatus(id, status) {
        const lead = this.savedLeads.find(e => e.id === id);
        const previousStatus = lead?.leadStatus || 'Novo';

        const updateIn = arr => {
            const idx = arr.findIndex(e => e.id === id);
            if (idx !== -1) arr[idx].leadStatus = status;
        };

        updateIn(this.savedLeads);
        updateIn(this.results);
        this.renderSavedUI();
        this.updateUI();

        try {
            await SupabaseClient.updateEstablishment(id, { leadStatus: status });
            this.toast(`Status alterado para "${status}"`, 'success');
        } catch (err) {
            const rollback = arr => {
                const idx = arr.findIndex(e => e.id === id);
                if (idx !== -1) arr[idx].leadStatus = previousStatus;
            };
            rollback(this.savedLeads);
            rollback(this.results);
            this.renderSavedUI();
            this.updateUI();
            this.toast('Erro ao atualizar status', 'warning');
        }
    },

    showDeleteConfirm(id) {
        const lead = this.savedLeads.find(e => e.id === id);
        if (!lead) return;

        this.pendingDeleteId = id;
        this.openConfirmModal({
            action: 'delete',
            title: 'Excluir lead?',
            message: `Tem certeza que deseja excluir <strong>${this.escape(lead.name)}</strong>? Esta ação não pode ser desfeita.`,
            icon: 'fa-trash-can',
            confirmLabel: 'Excluir',
            variant: 'danger'
        });
    },

    showClearConfirm() {
        if (!this.results.length) return;

        this.openConfirmModal({
            action: 'clear',
            title: 'Limpar resultados?',
            message: 'Tem certeza que deseja limpar todos os resultados da busca? Esta ação não pode ser desfeita.',
            icon: 'fa-broom',
            confirmLabel: 'Limpar',
            variant: 'warning'
        });
    },

    openConfirmModal({ action, title, message, icon, confirmLabel, variant = 'danger' }) {
        this.confirmAction = action;

        const box = document.getElementById('confirmModalBox');
        const glow = document.getElementById('confirmModalGlow');
        const iconEl = document.getElementById('confirmModalIcon');
        const actionBtn = document.getElementById('confirmActionBtn');

        box.className = `confirm-modal confirm-modal--${variant}`;
        glow.className = `confirm-modal-glow confirm-modal-glow--${variant}`;
        iconEl.className = `confirm-modal-icon confirm-modal-icon--${variant}`;
        iconEl.innerHTML = `<i class="fa-solid ${icon}"></i>`;
        actionBtn.className = variant === 'warning'
            ? 'btn-confirm-delete btn-confirm-warning'
            : 'btn-confirm-delete';

        document.getElementById('confirmModalTitle').textContent = title;
        document.getElementById('confirmModalMessage').innerHTML = message;
        document.getElementById('confirmActionIcon').className = `fa-solid ${icon}`;
        document.getElementById('confirmActionLabel').textContent = confirmLabel;
        document.getElementById('confirmModal').classList.add('visible');
    },

    closeConfirmModal() {
        this.confirmAction = null;
        this.pendingDeleteId = null;
        document.getElementById('confirmModal').classList.remove('visible');
    },

    async handleConfirmAction() {
        const action = this.confirmAction;
        const deleteId = this.pendingDeleteId;
        this.closeConfirmModal();

        if (action === 'delete' && deleteId) {
            await this.executeDeleteLead(deleteId);
        } else if (action === 'deleteSelected') {
            await this.executeDeleteSelectedLeads();
        } else if (action === 'clear') {
            this.clearResults();
        } else if (action === 'logout') {
            await this.executeLogout();
        }
    },

    closeDeleteModal() {
        this.closeConfirmModal();
    },

    async executeDeleteLead(id) {
        try {
            await SupabaseClient.removeEstablishment(id);

            this.savedLeads = this.savedLeads.filter(e => e.id !== id);
            this.results = this.results.filter(e => e.id !== id);
            this.filteredResults = this.filteredResults.filter(e => e.id !== id);

            this.renderSavedUI();
            this.renderTable();
            this.updateUI();
            this.toast('Lead excluído', 'info');
        } catch (err) {
            this.toast('Erro ao excluir lead', 'warning');
        }
    },

    async executeDeleteSelectedLeads() {
        const ids = Array.from(this.selectedLeadIds);
        if (!ids.length) return;

        let deletedCount = 0;
        const errors = [];

        for (const id of ids) {
            try {
                await SupabaseClient.removeEstablishment(id);
                deletedCount++;
            } catch (err) {
                errors.push(id);
            }
        }

        // Remove dos arrays locais
        this.savedLeads = this.savedLeads.filter(e => !ids.includes(e.id));
        this.results = this.results.filter(e => !ids.includes(e.id));
        this.filteredResults = this.filteredResults.filter(e => !ids.includes(e.id));

        // Limpa a seleção
        this.selectedLeadIds.clear();

        // Atualiza a UI
        this.renderSavedUI();
        this.renderTable();
        this.updateUI();
        this.updateDeleteSelectedBtn();

        if (errors.length) {
            this.toast(`${deletedCount} leads excluídos. ${errors.length} falharam.`, 'warning');
        } else {
            this.toast(`${deletedCount} lead${deletedCount > 1 ? 's' : ''} excluído${deletedCount > 1 ? 's' : ''} com sucesso!`, 'success');
        }
    },

    async confirmDeleteLead() {
        const id = this.pendingDeleteId;
        if (!id) return;
        await this.executeDeleteLead(id);
    },

    async saveLead(id) {
        const lead = this.results.find(e => e.id === id);
        if (!lead) return;

        // Verificar se já está salvo
        if (this.savedLeads.some(l => l.id === id)) {
            this.toast('Este lead já está salvo', 'info');
            return;
        }

        try {
            const saved = await SupabaseClient.saveEstablishments([lead]);
            if (saved.added > 0) {
                this.savedLeads = await SupabaseClient.getEstablishments();
                this.renderTable();
                this.updateUI();
                this.toast(`"${lead.name}" salvo com sucesso!`, 'success');
            } else {
                this.toast('Lead já existente no banco', 'info');
            }
        } catch (err) {
            this.toast('Erro ao salvar lead', 'warning');
        }
    },

    async deleteLead(id) {
        this.showDeleteConfirm(id);
    },

    // ====== SEARCH RESULTS TABLE ======

    renderTable() {
        const tbody = document.getElementById('resultsBody');
        const empty = document.getElementById('emptyState');
        const count = document.getElementById('resultCount');

        count.textContent = this.filteredResults.length;

        if (!this.filteredResults.length) {
            tbody.innerHTML = '';
            empty.style.display = 'block';
            this.updatePagination();
            return;
        }

        empty.style.display = 'none';

        const savedIds = new Set(this.savedLeads.map(l => l.id));

        tbody.innerHTML = this.paginatedResults.map(est => {
            const isSaved = savedIds.has(est.id);
            return `
            <tr>
                <td>
                    <div class="est-name">${this.escape(est.name)}</div>
                    <div class="est-category">${this.escape(est.category)}</div>
                </td>
                <td>${this.escape(est.city)}</td>
                <td>
                    ${est.phone
                        ? `<a href="tel:${est.phone}" class="phone-link">${this.escape(est.phone)}</a>`
                        : this.renderSignalTag('phone', false, 'Com telefone', 'Sem telefone')}
                </td>
                <td>
                    ${this.renderSignalTag('site', est.hasWebsite, 'Tem site', 'Sem site')}
                </td>
                <td>
                    ${this.renderSignalTag('maps', est.hasMapsLocation, 'No Maps', 'Sem Maps')}
                </td>
                <td>
                    <button class="btn-icon btn-icon-view" onclick="App.showDetail('${est.id}')" title="Ver detalhes">
                        <i class="fa-solid fa-eye"></i>
                    </button>
                </td>
                <td>
                    ${isSaved
                        ? '<span class="badge badge-success"><i class="fa-solid fa-check"></i> Salvo</span>'
                        : `<button class="btn-save-lead" onclick="App.saveLead('${est.id}')" title="Salvar lead">
                            <i class="fa-solid fa-bookmark"></i> Salvar
                        </button>`}
                </td>
            </tr>`;
        }).join('');

        this.updatePagination();
    },

    showDetail(id) {
        let est = this.results.find(e => e.id === id) || this.savedLeads.find(e => e.id === id);
        if (!est) return;

        const content = document.getElementById('detailModalContent');
        const statusClass = (est.leadStatus || 'Novo').replace(/\s+/g, '');

        const infoItems = [
            { icon: 'fa-location-dot', label: 'Endereço', value: est.address || est.city || '—' },
            { icon: 'fa-city', label: 'Cidade', value: est.city || '—' },
            { icon: 'fa-map', label: 'Estado', value: est.state || '—' },
            { icon: 'fa-phone', label: 'Telefone', value: est.phone || 'Não informado', link: est.phone ? `tel:${est.phone}` : null },
            { icon: 'fa-brands fa-whatsapp', label: 'WhatsApp', value: est.whatsapp || 'Não informado' },
            { icon: 'fa-globe', label: 'Site', value: est.website || 'Não possui', link: est.website || null },
            { icon: 'fa-brands fa-instagram', label: 'Instagram', value: est.instagram || 'Não informado' },
            { icon: 'fa-star', label: 'Avaliação', value: est.rating ? `${est.rating} (${est.totalReviews} reviews)` : '—' },
            { icon: 'fa-database', label: 'Fonte', value: est.source === 'google_places' ? 'Google Places' : 'OpenStreetMap' }
        ];

        content.innerHTML = `
            <div class="detail-modal-header">
                <div class="detail-modal-icon">
                    <i class="fa-solid fa-store"></i>
                </div>
                <div class="detail-modal-titles">
                    <h3>${this.escape(est.name)}</h3>
                    <p>${this.escape(est.category || 'Sem categoria')}</p>
                </div>
            </div>
            <div class="detail-modal-tags">
                ${this.renderSignalTag('phone', !!est.phone, 'Com telefone', 'Sem telefone')}
                ${this.renderSignalTag('site', est.hasWebsite, 'Tem site', 'Sem site')}
                ${this.renderSignalTag('maps', est.hasMapsLocation, 'No Maps', 'Sem Maps')}
                <span class="signal-tag signal-tag--status signal-tag--status-${statusClass}">${this.escape(est.leadStatus || 'Novo')}</span>
            </div>
            <div class="detail-modal-grid">
                ${infoItems.map(item => `
                    <div class="detail-info-card">
                        <div class="detail-info-label">
                            <i class="${item.icon.startsWith('fa-brands') ? item.icon : 'fa-solid ' + item.icon}"></i>
                            ${item.label}
                        </div>
                        <div class="detail-info-value">
                            ${item.link
                                ? (item.link.startsWith('tel:')
                                    ? `<a href="tel:${this.escape(est.phone)}">${this.escape(String(item.value))}</a>`
                                    : `<a href="${item.link}" target="_blank" rel="noopener noreferrer">${this.escape(String(item.value))}</a>`)
                                : this.escape(String(item.value))}
                        </div>
                    </div>
                `).join('')}
            </div>
            <div class="detail-modal-insight">
                <i class="fa-solid fa-lightbulb"></i>
                <span>${est.hasWebsite
                    ? 'Negócio com presença digital estabelecida.'
                    : est.hasMapsLocation
                        ? 'Oportunidade — sem site, mas presente no Maps.'
                        : 'Alto potencial — sem presença digital.'}</span>
            </div>
        `;

        document.getElementById('detailModal').classList.add('visible');
    },

    closeModal() {
        document.getElementById('detailModal').classList.remove('visible');
    },

    filterTable(query) {
        const q = query.toLowerCase().trim();
        if (!q) {
            this.filteredResults = this.results;
        } else {
            this.filteredResults = this.results.filter(e =>
                e.name.toLowerCase().includes(q) ||
                e.category.toLowerCase().includes(q) ||
                e.city.toLowerCase().includes(q) ||
                (e.phone && e.phone.includes(q))
            );
        }
        this.currentPage = 1;
        this.renderTable();
        document.getElementById('resultCount').textContent = this.filteredResults.length;
    },

    updateUI() {
        const hasResults = this.results.length > 0;
        const resultsSection = document.getElementById('resultsSection');
        const actionsRow = document.getElementById('actionsRow');

        // Só atualiza visibilidade se estiver na tab de busca
        const activeTab = document.querySelector('.dash-tab.active');
        const currentTab = activeTab?.dataset?.tab || 'search';

        if (currentTab === 'search') {
            if (hasResults) {
                resultsSection.style.display = 'block';
                actionsRow.style.display = 'flex';
            } else {
                resultsSection.style.display = 'none';
                actionsRow.style.display = 'none';
            }
        }

        // Update saved count badge
        const savedTab = document.querySelector('.dash-tab[data-tab="saved"]');
        if (savedTab) {
            const count = this.savedLeads.length;
            savedTab.innerHTML = count
                ? `<i class="fa-solid fa-bookmark"></i> Salvos <span class="tab-count">${count}</span>`
                : '<i class="fa-solid fa-bookmark"></i> Salvos';
        }

        this.renderDashboardStats();
    },

    exportCSV() {
        const data = this.filteredResults.length ? this.filteredResults : this.results;
        if (!data.length) {
            this.toast('Nenhum dado para exportar', 'warning');
            return;
        }

        const headers = ['Nome', 'Categoria', 'Estado', 'Cidade', 'Endereço', 'Telefone', 'WhatsApp', 'Site', 'Instagram', 'Google Maps', 'Status'];
        const rows = data.map(e => [
            e.name, e.category, e.state || '', e.city, e.address || '',
            e.phone || '', e.whatsapp || '', e.website || '',
            e.instagram || '', e.hasMapsLocation ? 'Sim' : 'Não',
            e.leadStatus || 'Novo'
        ]);

        const csv = [headers, ...rows].map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');
        const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `saasmaps-${new Date().toISOString().slice(0, 10)}.csv`;
        a.click();
        URL.revokeObjectURL(url);

        this.toast('CSV exportado com sucesso!', 'success');
    },

    clearResults() {
        this.results = [];
        this.filteredResults = [];
        this.currentPage = 1;
        this.renderTable();
        this.updateUI();
        this.toast('Resultados limpos', 'info');
        this.loadSaved();
    },

    renderSignalTag(type, isPositive, positiveLabel, negativeLabel) {
        const icons = {
            phone: { ok: 'fa-phone', bad: 'fa-phone-slash' },
            site: { ok: 'fa-globe', bad: 'fa-globe' },
            maps: { ok: 'fa-map-pin', bad: 'fa-map-location-dot' }
        };
        const icon = icons[type] || icons.site;
        const label = isPositive ? positiveLabel : negativeLabel;
        const modifier = isPositive ? 'ok' : 'bad';

        return `<span class="signal-tag signal-tag--${modifier}">
            <span class="signal-tag-icon"><i class="fa-solid ${isPositive ? icon.ok : icon.bad}"></i></span>
            <span class="signal-tag-text">${this.escape(label)}</span>
        </span>`;
    },

    showProgress(visible, text) {
        const el = document.getElementById('scanProgress');
        el.classList.toggle('visible', visible);
        if (text) document.getElementById('progressLabel').textContent = text;
        if (!visible) this.updateProgress(0, '');
    },

    updateProgress(pct, text) {
        document.getElementById('progressFill').style.width = pct + '%';
        if (text) document.getElementById('progressText').textContent = text;
    },

    toast(message, type = 'info') {
        const container = document.getElementById('toastContainer');
        const toast = document.createElement('div');
        toast.className = `toast toast-${type}`;
        const icons = { success: 'check-circle', warning: 'triangle-exclamation', info: 'circle-info' };
        toast.innerHTML = `<i class="fa-solid fa-${icons[type]}"></i> ${message}`;
        container.appendChild(toast);
        setTimeout(() => toast.remove(), 4000);
    },

    escape(str) {
        const div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    },

    // ====== REALTIME ======
    refreshIfNeeded(payload) {
        // Se a alteração for relevante para o usuário atual, recarrega leads
        const affectedUserId = payload.new?.userId || payload.old?.userId;
        if (affectedUserId && affectedUserId === this.currentUser?.id) {
            this.loadSaved();
            this.updateUI();
        }
    },

    // ====== EXPORTAR LEADS SALVOS ======
    exportSavedLeadsCSV() {
        const data = this.savedLeads;
        if (!data.length) {
            ErrorHandler.toast('Nenhum lead salvo para exportar', 'warning');
            return;
        }

        const headers = ['Nome', 'Categoria', 'Cidade', 'Endereço', 'Telefone', 'WhatsApp', 'Site', 'Instagram', 'Status', 'Data'];
        const rows = data.map(e => [
            e.name, e.category || '', e.city || '', e.address || '',
            e.phone || '', e.whatsapp || '', e.website || '',
            e.instagram || '', e.leadStatus || 'Novo',
            e.createdAt ? new Date(e.createdAt).toLocaleDateString('pt-BR') : ''
        ]);

        const csv = [headers, ...rows].map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');
        const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `saasmaps-leads-${new Date().toISOString().slice(0, 10)}.csv`;
        a.click();
        URL.revokeObjectURL(url);

        ErrorHandler.toast(`${data.length} leads exportados com sucesso!`, 'success');
    }
};

document.addEventListener('DOMContentLoaded', () => App.init());
