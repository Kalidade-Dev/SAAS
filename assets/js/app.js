/**
 * WebLead — Dashboard Principal (Clean Version)
 */

const App = {
    results: [],
    filteredResults: [],
    savedLeads: [],
    isScanning: false,
    pageSize: 10,
    currentPage: 1,

    currentUser: null,

    citiesCache: {},
    currentCities: [],

    async init() {
        // Inicializar Supabase primeiro
        await SupabaseClient.init();
        // Verificar autenticação
        await this.checkAuth();
        this.bindEvents();
        await this.loadSaved();
        this.updateUI();
        // Inicia na tab de busca por padrão
        this.switchTab('search');
        // Re-renderiza a tabela se houver resultados carregados
        if (this.results.length) {
            this.renderTable();
        }
    },

    async loadCities(stateCode) {
        const cityInput = document.getElementById('cityInput');
        const loading = document.getElementById('cityLoading');
        const datalist = document.getElementById('cityList');

        if (!stateCode) {
            cityInput.disabled = true;
            cityInput.value = '';
            cityInput.placeholder = 'Selecione o estado primeiro...';
            datalist.innerHTML = '';
            this.currentCities = [];
            return;
        }

        // Verificar cache
        if (this.citiesCache[stateCode]) {
            this.currentCities = this.citiesCache[stateCode];
            this.populateCityDatalist(this.currentCities);
            cityInput.disabled = false;
            cityInput.placeholder = 'Digite o nome da cidade...';
            return;
        }

        // Mostrar loading
        loading.style.display = 'block';
        cityInput.disabled = true;
        cityInput.placeholder = 'Carregando cidades...';

        try {
            const res = await fetch(`https://servicodados.ibge.gov.br/api/v1/localidades/estados/${stateCode}/municipios`);
            const data = await res.json();

            // Ordenar por nome
            const cities = data
                .map(c => ({ id: c.id, nome: c.nome }))
                .sort((a, b) => a.nome.localeCompare(b.nome));

            this.citiesCache[stateCode] = cities;
            this.currentCities = cities;

            this.populateCityDatalist(cities);

            cityInput.disabled = false;
            cityInput.placeholder = 'Digite o nome da cidade...';
        } catch (err) {
            console.warn('Erro ao buscar cidades:', err);
            cityInput.disabled = false;
            cityInput.placeholder = 'Erro ao carregar cidades...';
            this.currentCities = [];
        } finally {
            loading.style.display = 'none';
        }
    },

    populateCityDatalist(cities) {
        const datalist = document.getElementById('cityList');
        datalist.innerHTML = cities.map(c =>
            `<option value="${c.nome}">`
        ).join('');
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
        if (!confirm('Deseja sair da sua conta?')) return;
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
        document.getElementById('clearBtn').addEventListener('click', () => this.clearResults());
        document.getElementById('tableSearch').addEventListener('input', e => this.filterTable(e.target.value));
        document.getElementById('modalClose').addEventListener('click', () => this.closeModal());

        // Quando o estado mudar, buscar cidades do IBGE
        document.getElementById('stateInput').addEventListener('change', e => {
            this.loadCities(e.target.value);
        });

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
    },

    switchTab(tab) {
        const searchCard = document.getElementById('searchCard');
        const resultsSection = document.getElementById('resultsSection');
        const actionsRow = document.getElementById('actionsRow');
        const savedSection = document.getElementById('savedSection');
        const panelContent = document.getElementById('panelContent');

        // Esconde tudo primeiro
        searchCard.style.display = 'none';
        resultsSection.style.display = 'none';
        actionsRow.style.display = 'none';
        savedSection.style.display = 'none';
        panelContent.style.display = 'none';

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
        } else if (tab === 'panel') {
            panelContent.style.display = 'block';
            this.renderDashboardStats();
        }
    },

    async runSearch() {
        const state = document.getElementById('stateInput').value;
        const city = document.getElementById('cityInput').value.trim();
        const category = document.getElementById('categoryInput').value.trim();

        if (!state) {
            this.toast('Selecione o estado', 'warning');
            return;
        }

        if (!city) {
            this.toast('Informe a cidade para buscar', 'warning');
            return;
        }

        const btn = document.getElementById('searchBtn');
        btn.disabled = true;
        btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Buscando...';

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

            if (results.length) {
                this.toast(`${results.length} estabelecimentos encontrados em ${city}. Clique em salvar para adicionar ao CRM.`, 'success');
            } else {
                this.toast('Nenhum estabelecimento encontrado', 'info');
            }
        } catch (err) {
            this.toast(err.message || 'Erro na busca', 'warning');
        } finally {
            btn.disabled = false;
            btn.innerHTML = '<i class="fa-solid fa-magnifying-glass"></i> Buscar Estabelecimentos';
        }
    },

    async loadSaved() {
        try {
            this.savedLeads = await SupabaseClient.getEstablishments();
            if (this.savedLeads.length && !this.results.length) {
                this.results = this.savedLeads;
                this.filteredResults = this.savedLeads;
                this.renderTable();
                this.renderDashboardStats();
            }
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
        const categories = Array.from(new Set(leads.map(lead => lead.category || 'Sem categoria'))).length;

        document.getElementById('statTotal').textContent = total;
        document.getElementById('statWithSite').textContent = withSite;
        document.getElementById('statWithoutSite').textContent = withoutSite;
        document.getElementById('statCategories').textContent = categories;

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

        // Donut Chart - Presença Digital
        const sitePct = Math.round((withSite / total) * 100);
        const noSitePct = 100 - sitePct;

        donutPanel.innerHTML = `
            <div class="donut" style="--site-pct:${sitePct}%">
                <div class="donut-center">
                    <div>
                        <strong>${total}</strong>
                        <span>leads</span>
                    </div>
                </div>
            </div>
            <div class="donut-legend">
                <div class="legend-item"><span class="legend-dot" style="--legend-color:var(--success)"></span> Com site (${withSite}) <span class="legend-pct">${sitePct}%</span></div>
                <div class="legend-item"><span class="legend-dot" style="--legend-color:var(--accent)"></span> Sem site (${withoutSite}) <span class="legend-pct">${noSitePct}%</span></div>
            </div>
            <div class="donut-summary">
                <div class="donut-opportunity">
                    <i class="fa-solid fa-bullhorn"></i>
                    <strong>${withoutSite}</strong> oportunidades disponíveis
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

    // ====== SAVED LEADS ======

    savedFilter: 'all',
    savedQuery: '',

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
            document.getElementById('statusPills').innerHTML = '';
            return;
        }

        empty.style.display = 'none';
        filterEmpty.style.display = 'none';

        // Renderiza contadores
        this.renderSavedCounters();

        // Renderiza pills de status
        this.renderStatusPills();

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

        counters.innerHTML = counts.map(({ status, count }) => `
            <div class="saved-counter ${status === 'Novo' ? 'counter-info' : status === 'Contatado' ? 'counter-warning' : status === 'Em negociação' ? 'counter-orange' : status === 'Cliente' ? 'counter-success' : 'counter-danger'}">
                <span class="counter-label">${status}</span>
                <span class="counter-value">${count}</span>
            </div>
        `).join('');
    },

    renderStatusPills() {
        const pills = document.getElementById('statusPills');
        const counts = {};
        this.savedLeads.forEach(l => {
            const s = l.leadStatus || 'Novo';
            counts[s] = (counts[s] || 0) + 1;
        });

        const total = this.savedLeads.length;

        pills.innerHTML = Object.entries(counts)
            .sort((a, b) => b[1] - a[1])
            .map(([status, count]) => `
                <span class="status-pill ${status.toLowerCase().replace(/\s+/g, '-')}">
                    ${status === 'Novo' ? '<i class="fa-regular fa-star"></i>' :
                      status === 'Contatado' ? '<i class="fa-regular fa-message"></i>' :
                      status === 'Em negociação' ? '<i class="fa-regular fa-handshake"></i>' :
                      status === 'Cliente' ? '<i class="fa-regular fa-circle-check"></i>' :
                      '<i class="fa-regular fa-circle-xmark"></i>'}
                    ${status} (${count})
                </span>
            `).join('');

        if (total > 5) {
            pills.innerHTML += `<span class="status-pill total-pill"><i class="fa-regular fa-layer-group"></i> Total: ${total}</span>`;
        }
    },

    renderSavedCard(lead) {
        const id = this.escape(lead.id);
        const name = this.escape(lead.name);
        const category = this.escape(lead.category || 'Sem categoria');
        const city = lead.city ? this.escape(lead.city) : '';
        const phone = lead.phone ? this.escape(lead.phone) : '';
        const hasWebsite = lead.hasWebsite;
        const hasMaps = lead.hasMapsLocation;
        const instagram = lead.instagram || '';
        const whatsapp = lead.whatsapp || '';
        const status = lead.leadStatus || 'Novo';

        return `
            <div class="saved-lead-card" data-id="${id}">
                <div class="saved-lead-left">
                    <div class="saved-lead-icon">
                        <i class="fa-solid fa-store"></i>
                    </div>
                    <div class="saved-lead-info">
                        <div class="saved-lead-header-row">
                            <span class="saved-lead-name">${name}</span>
                            <span class="saved-lead-status-tag ${status.replace(/\s+/g, '')}">${status}</span>
                        </div>
                        <div class="saved-lead-meta">
                            <span class="saved-lead-meta-item">
                                <i class="fa-solid fa-tag"></i> ${category}
                            </span>
                            ${city ? `<span class="saved-lead-meta-item"><i class="fa-solid fa-city"></i> ${city}</span>` : ''}
                            ${phone ? `<span class="saved-lead-meta-item"><i class="fa-solid fa-phone"></i> <a href="tel:${phone}">${phone}</a></span>` : `<span class="saved-lead-meta-item"><i class="fa-solid fa-phone-slash"></i> Sem telefone</span>`}
                        </div>
                        <div class="saved-lead-signals">
                            <span class="saved-lead-signal ${hasWebsite ? 'present' : 'missing'}">
                                <i class="fa-solid fa-globe"></i> ${hasWebsite ? 'Site' : 'Sem site'}
                            </span>
                            <span class="saved-lead-signal ${hasMaps ? 'present' : 'missing'}">
                                <i class="fa-solid fa-map-pin"></i> ${hasMaps ? 'Maps' : 'Sem Maps'}
                            </span>
                        </div>
                    </div>
                </div>

                <div class="saved-lead-actions">
                    ${phone ? `<a href="tel:${phone}" class="quick-action-btn" title="Ligar"><i class="fa-solid fa-phone"></i></a>` : ''}
                    ${whatsapp ? `<a href="https://wa.me/${whatsapp.replace(/\D/g, '')}" target="_blank" class="quick-action-btn" title="WhatsApp"><i class="fa-brands fa-whatsapp"></i></a>` : ''}
                    ${hasMaps ? `<a href="https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(name + ', ' + (lead.address || city || ''))}" target="_blank" class="quick-action-btn" title="Maps"><i class="fa-solid fa-location-dot"></i></a>` : ''}
                    <button class="quick-action-btn" onclick="App.showDetail('${id}')" title="Detalhes"><i class="fa-solid fa-eye"></i></button>
                    <select class="saved-lead-status" data-id="${id}" onchange="App.updateLeadStatus('${id}', this.value)">
                        <option value="Novo" ${status === 'Novo' ? 'selected' : ''}>Novo</option>
                        <option value="Contatado" ${status === 'Contatado' ? 'selected' : ''}>Contatado</option>
                        <option value="Em negociação" ${status === 'Em negociação' ? 'selected' : ''}>Em negociação</option>
                        <option value="Cliente" ${status === 'Cliente' ? 'selected' : ''}>Cliente</option>
                        <option value="Descartado" ${status === 'Descartado' ? 'selected' : ''}>Descartado</option>
                    </select>
                    <button class="btn-delete-lead" onclick="App.deleteLead('${id}')" title="Excluir">
                        <i class="fa-solid fa-trash"></i>
                    </button>
                </div>
            </div>
        `;
    },

    async updateLeadStatus(id, status) {
        try {
            await SupabaseClient.updateEstablishment(id, { leadStatus: status });

            // Update in local arrays too
            const updateIn = arr => {
                const idx = arr.findIndex(e => e.id === id);
                if (idx !== -1) arr[idx].leadStatus = status;
            };
            updateIn(this.savedLeads);
            updateIn(this.results);

            this.toast(`Status alterado para "${status}"`, 'success');
        } catch (err) {
            this.toast('Erro ao atualizar status', 'warning');
        }
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
        if (!confirm('Tem certeza que deseja excluir este lead?')) return;

        try {
            await SupabaseClient.removeEstablishment(id);

            // Remove from all arrays
            this.savedLeads = this.savedLeads.filter(e => e.id !== id);
            this.results = this.results.filter(e => e.id !== id);
            this.filteredResults = this.filteredResults.filter(e => e.id !== id);

            await this.renderSavedLeads();
            this.renderTable();
            this.updateUI();
            this.toast('Lead excluído', 'info');
        } catch (err) {
            this.toast('Erro ao excluir lead', 'warning');
        }
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
                        : '<span class="badge badge-warning"><i class="fa-solid fa-phone-slash"></i> Sem telefone</span>'}
                </td>
                <td>
                    ${est.hasWebsite
                        ? '<span class="badge badge-success"><i class="fa-solid fa-globe"></i> Tem site</span>'
                        : '<span class="badge badge-danger"><i class="fa-solid fa-globe"></i> Sem site</span>'}
                </td>
                <td>
                    ${est.hasMapsLocation
                        ? '<span class="badge badge-success"><i class="fa-solid fa-map-pin"></i> No Maps</span>'
                        : '<span class="badge badge-danger"><i class="fa-solid fa-map-pin"></i> Sem Maps</span>'}
                </td>
                <td>
                    <button class="btn-icon" onclick="App.showDetail('${est.id}')" title="Ver detalhes">
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
        // Busca em results e savedLeads (para leads salvos que não estão na tabela)
        let est = this.results.find(e => e.id === id) || this.savedLeads.find(e => e.id === id);
        if (!est) return;

        const grid = document.getElementById('modalGrid');
        const fields = [
            ['Nome', est.name],
            ['Categoria', est.category],
            ['Estado', est.state || '—'],
            ['Cidade', est.city],
            ['Endereço', est.address || '—'],
            ['Telefone', est.phone || 'Não informado'],
            ['WhatsApp', est.whatsapp || 'Não informado'],
            ['Site', est.website || 'Não possui'],
            ['Instagram', est.instagram || 'Não informado'],
            ['Google Maps', est.hasMapsLocation ? 'Sim' : 'Não'],
            ['Presença Digital', est.hasWebsite ? '✓ Possui site' : '✗ Sem site'],
            ['Avaliação', est.rating ? `${est.rating} (${est.totalReviews} reviews)` : '—'],
            ['Status', est.leadStatus || 'Novo'],
            ['Fonte', est.source === 'google_places' ? 'Google Places' : 'OpenStreetMap']
        ];

        grid.innerHTML = fields.map(([key, val]) => `
            <div class="detail-row">
                <span class="key">${key}</span>
                <span class="val">${this.escape(String(val))}</span>
            </div>
        `).join('');

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
                ? `<i class="fa-solid fa-bookmark"></i> Salvos (${count})`
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
        if (!confirm('Limpar todos os resultados da busca?')) return;
        this.results = [];
        this.filteredResults = [];
        this.renderTable();
        this.updateUI();
        this.toast('Resultados limpos', 'info');
        // Recarrega leads salvos para reaparecerem nos stats
        this.loadSaved();
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
    }
};

document.addEventListener('DOMContentLoaded', () => App.init());