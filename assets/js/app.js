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

    async init() {
        await SupabaseClient.init();
        this.bindEvents();
        await this.loadSaved();
        this.updateUI();
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

        // Tabs
        document.querySelectorAll('.dash-tab').forEach(tab => {
            tab.addEventListener('click', () => {
                document.querySelectorAll('.dash-tab').forEach(t => t.classList.remove('active'));
                tab.classList.add('active');
                this.switchTab(tab.dataset.tab);
            });
        });
    },

    switchTab(tab) {
        const searchCard = document.getElementById('searchCard');
        const resultsSection = document.getElementById('resultsSection');
        const actionsRow = document.getElementById('actionsRow');
        const savedSection = document.getElementById('savedSection');

        if (tab === 'search') {
            searchCard.style.display = 'block';
            resultsSection.style.display = this.results.length ? 'block' : 'none';
            actionsRow.style.display = this.results.length ? 'flex' : 'none';
            savedSection.style.display = 'none';
        } else if (tab === 'saved') {
            searchCard.style.display = 'none';
            resultsSection.style.display = 'none';
            actionsRow.style.display = 'none';
            savedSection.style.display = 'block';
            this.renderSavedLeads();
        } else if (tab === 'panel') {
            this.toast('Painel — Em desenvolvimento', 'info');
        }
    },

    async runSearch() {
        const city = document.getElementById('cityInput').value.trim();
        const category = document.getElementById('categoryInput').value.trim();

        if (!city) {
            this.toast('Informe a cidade para buscar', 'warning');
            return;
        }

        const btn = document.getElementById('searchBtn');
        btn.disabled = true;
        btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Buscando...';

        try {
            const results = await SearchEngine.search({
                city,
                category: category || '',
                radius: 5000,
                filters: {
                    noWebsite: true,
                    noMaps: true,
                    noPhone: false,
                    bothMissing: true
                }
            });

            this.results = results;
            this.filteredResults = results;
            this.currentPage = 1;
            this.renderTable();
            this.updateUI();

            // Auto-save to leads
            if (results.length) {
                const saved = await SupabaseClient.saveEstablishments(results);
                this.savedLeads = await SupabaseClient.getEstablishments();
                this.toast(`${results.length} estabelecimentos encontrados em ${city} (${saved.added} novos salvos)`, 'success');
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
            }
        } catch (err) {
            console.warn('Erro ao carregar dados:', err);
        }
    },

    // ====== SAVED LEADS ======

    async renderSavedLeads() {
        this.savedLeads = await SupabaseClient.getEstablishments();
        const container = document.getElementById('savedLeadsList');
        const empty = document.getElementById('savedEmpty');
        const count = document.getElementById('savedCount');

        count.textContent = `(${this.savedLeads.length})`;

        if (!this.savedLeads.length) {
            container.innerHTML = '';
            empty.style.display = 'block';
            return;
        }

        empty.style.display = 'none';

        container.innerHTML = this.savedLeads.map(lead => `
            <div class="saved-lead-card" data-id="${this.escape(lead.id)}">
                <div class="saved-lead-left">
                    <div class="saved-lead-icon">
                        <i class="fa-solid fa-store"></i>
                    </div>
                    <div class="saved-lead-info">
                        <div class="saved-lead-name">${this.escape(lead.name)}</div>
                        <div class="saved-lead-category">${this.escape(lead.category || 'Sem categoria')}</div>

                        <div class="saved-lead-details">
                            ${lead.address ? `
                            <div class="saved-lead-detail">
                                <i class="fa-solid fa-location-dot"></i>
                                <span>${this.escape(lead.address)}</span>
                            </div>` : ''}
                            ${lead.city ? `
                            <div class="saved-lead-detail">
                                <i class="fa-solid fa-city"></i>
                                <span>${this.escape(lead.city)}</span>
                            </div>` : ''}
                            ${lead.phone ? `
                            <div class="saved-lead-detail">
                                <i class="fa-solid fa-phone"></i>
                                <a href="tel:${lead.phone}">${this.escape(lead.phone)}</a>
                            </div>` : `
                            <div class="saved-lead-detail">
                                <i class="fa-solid fa-phone-slash"></i>
                                <span>Sem telefone</span>
                            </div>`}
                        </div>

                        <div class="saved-lead-badges">
                            <span class="saved-lead-badge danger">
                                <i class="fa-solid fa-globe"></i> Sem site
                            </span>
                            ${lead.hasMapsLocation
                                ? `<span class="saved-lead-badge success"><i class="fa-solid fa-map-pin"></i> No Maps</span>`
                                : `<span class="saved-lead-badge danger"><i class="fa-solid fa-map-pin"></i> Sem Maps</span>`}
                            <span class="saved-lead-badge info">
                                <i class="fa-solid fa-tag"></i> ${lead.leadStatus || 'Novo'}
                            </span>
                        </div>
                    </div>
                </div>

                <div class="saved-lead-right">
                    <select class="saved-lead-status" data-id="${this.escape(lead.id)}" onchange="App.updateLeadStatus('${this.escape(lead.id)}', this.value)">
                        <option value="Novo" ${(lead.leadStatus || 'Novo') === 'Novo' ? 'selected' : ''}>Novo</option>
                        <option value="Contatado" ${lead.leadStatus === 'Contatado' ? 'selected' : ''}>Contatado</option>
                        <option value="Em negociação" ${lead.leadStatus === 'Em negociação' ? 'selected' : ''}>Em negociação</option>
                        <option value="Cliente" ${lead.leadStatus === 'Cliente' ? 'selected' : ''}>Cliente</option>
                        <option value="Descartado" ${lead.leadStatus === 'Descartado' ? 'selected' : ''}>Descartado</option>
                    </select>
                    <button class="btn-delete-lead" onclick="App.deleteLead('${this.escape(lead.id)}')" title="Excluir lead">
                        <i class="fa-solid fa-trash"></i>
                    </button>
                </div>
            </div>
        `).join('');
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

    async deleteLead(id) {
        if (!confirm('Tem certeza que deseja excluir este lead?')) return;

        try {
            await SupabaseClient.removeEstablishment(id);

            // Remove from all arrays
            this.savedLeads = this.savedLeads.filter(e => e.id !== id);
            this.results = this.results.filter(e => e.id !== id);
            this.filteredResults = this.filteredResults.filter(e => e.id !== id);

            this.renderSavedLeads();
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

        tbody.innerHTML = this.paginatedResults.map(est => `
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
                    ${est.aiEnriched
                        ? `<span class="badge badge-info"><i class="fa-solid fa-robot"></i> ${est.leadScore || '—'}</span>`
                        : '<span class="badge badge-warning">Pendente</span>'}
                </td>
                <td>
                    <button class="btn-icon" onclick="App.showDetail('${est.id}')" title="Ver detalhes">
                        <i class="fa-solid fa-eye"></i>
                    </button>
                </td>
            </tr>
        `).join('');

        this.updatePagination();
    },

    showDetail(id) {
        const est = this.results.find(e => e.id === id);
        if (!est) return;

        const grid = document.getElementById('modalGrid');
        const fields = [
            ['Nome', est.name],
            ['Categoria', est.category],
            ['Endereço', est.address || '—'],
            ['Cidade', est.city],
            ['Telefone', est.phone || '—'],
            ['WhatsApp', est.whatsapp || '—'],
            ['Site', est.website || 'Sem site'],
            ['Instagram', est.instagram || '—'],
            ['Google Maps', est.hasMapsLocation ? 'Sim' : 'Não'],
            ['Avaliação', est.rating ? `${est.rating} (${est.totalReviews} reviews)` : '—'],
            ['Score do Lead', est.leadScore ? `${est.leadScore}/100` : '—'],
            ['Status', est.leadStatus || 'Novo'],
            ['Notas da IA', est.notes || '—'],
            ['Fonte', est.source === 'google_places' ? 'Google Places' : 'OpenStreetMap (real)']
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

        if (hasResults) {
            resultsSection.style.display = 'block';
            actionsRow.style.display = 'flex';
        } else {
            resultsSection.style.display = 'none';
            actionsRow.style.display = 'none';
        }

        // Update saved count badge
        const savedTab = document.querySelector('.dash-tab[data-tab="saved"]');
        if (savedTab && this.savedLeads.length) {
            savedTab.innerHTML = `<i class="fa-solid fa-bookmark"></i> Salvos (${this.savedLeads.length})`;
        }
    },

    exportCSV() {
        if (!this.results.length) {
            this.toast('Nenhum dado para exportar', 'warning');
            return;
        }

        const headers = ['Nome', 'Categoria', 'Cidade', 'Endereço', 'Telefone', 'WhatsApp', 'Site', 'Google Maps', 'Score', 'Status', 'Notas'];
        const rows = this.results.map(e => [
            e.name, e.category, e.city, e.address || '', e.phone || '',
            e.whatsapp || '', e.website || '', e.hasMapsLocation ? 'Sim' : 'Não',
            e.leadScore || '', e.leadStatus || 'Novo', e.notes || ''
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