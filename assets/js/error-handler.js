/**
 * SaaS MAPS - Sistema Centralizado de Tratamento de Erros
 * 
 * Uso:
 *   ErrorHandler.try(() => { ... }, 'contexto')
 *   ErrorHandler.toast('Mensagem', 'error')
 *   ErrorHandler.log('Ação executada', 'info')
 */

const ErrorHandler = {
    // ===== NÍVEIS DE LOG =====
    LEVELS: {
        DEBUG: 'debug',
        INFO: 'info',
        WARN: 'warn',
        ERROR: 'error',
        FATAL: 'fatal'
    },

    // ===== CONFIGURAÇÃO =====
    _config: {
        enabled: true,
        consoleOutput: true,
        toastErrors: true,
        toastDuration: 5000,
        logToServer: false,  // Ativar quando tiver backend
        maxLogEntries: 100
    },

    _logHistory: [],

    // ===== INIT =====
    init(config = {}) {
        Object.assign(this._config, config);
        
        // Intercepta erros não tratados
        window.addEventListener('error', (event) => {
            this.handleError(event.error || event.message, {
                source: event.filename,
                line: event.lineno,
                column: event.colno,
                fatal: true
            });
        });

        // Intercepta promessas rejeitadas não tratadas
        window.addEventListener('unhandledrejection', (event) => {
            this.handleError(event.reason || 'Promise rejection', {
                type: 'unhandledrejection',
                fatal: true
            });
        });

        return this;
    },

    // ===== MÉTODO PRINCIPAL - try/catch seguro =====
    try(fn, context = 'anonymous', options = {}) {
        if (!this._config.enabled) {
            try { return fn(); } catch (e) { return null; }
        }

        try {
            return fn();
        } catch (error) {
            this.handleError(error, { context, ...options });
            return options.fallback ?? null;
        }
    },

    // ===== TRATAMENTO DE ERRO =====
    handleError(error, details = {}) {
        const errorInfo = this._normalizeError(error, details);
        
        // Log no console
        if (this._config.consoleOutput) {
            const method = errorInfo.level === this.LEVELS.ERROR || errorInfo.level === this.LEVELS.FATAL
                ? 'error'
                : errorInfo.level === this.LEVELS.WARN
                    ? 'warn'
                    : 'info';
            console[method](`[${errorInfo.level.toUpperCase()}] [${errorInfo.context}]`, errorInfo.message, errorInfo.details);
        }

        // Toast para o usuário (apenas erros e fatais)
        if (this._config.toastErrors && 
            (errorInfo.level === this.LEVELS.ERROR || errorInfo.level === this.LEVELS.FATAL)) {
            this._showToast(errorInfo.userMessage || errorInfo.message, 'error');
        }

        // Salva histórico
        this._addToHistory(errorInfo);

        // Log no servidor (quando implementado)
        if (this._config.logToServer) {
            this._sendToServer(errorInfo);
        }

        return errorInfo;
    },

    // ===== NORMALIZAÇÃO =====
    _normalizeError(error, details = {}) {
        const context = details.context || 'unknown';
        
        let message, stack, level, userMessage, code;

        if (error instanceof Error) {
            message = error.message;
            stack = error.stack;
            code = error.code || details.code;
        } else if (typeof error === 'string') {
            message = error;
            stack = details.stack || null;
        } else if (error && error.message) {
            message = error.message;
            stack = error.stack || details.stack;
            code = error.code || details.code;
        } else {
            message = String(error || 'Unknown error');
            stack = null;
        }

        // Determina o nível baseado no tipo
        if (details.fatal) {
            level = this.LEVELS.FATAL;
        } else if (details.level) {
            level = details.level;
        } else if (error instanceof TypeError || error instanceof ReferenceError || error instanceof SyntaxError) {
            level = this.LEVELS.ERROR;
        } else if (error && (error.status === 401 || error.status === 403)) {
            level = this.LEVELS.WARN;
        } else {
            level = this.LEVELS.ERROR;
        }

        // Mensagem amigável para o usuário
        userMessage = this._getUserMessage(error, message, code);

        return {
            id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
            timestamp: new Date().toISOString(),
            level,
            context,
            message,
            userMessage,
            code,
            stack,
            details: {
                ...details,
                url: window.location.href,
                userAgent: navigator.userAgent,
                timestamp: new Date().toISOString()
            }
        };
    },

    // ===== MENSAGENS AMIGÁVEIS =====
    _getUserMessage(error, originalMessage, code) {
        // Erros conhecidos do Supabase
        if (originalMessage?.includes('Invalid login credentials')) {
            return I18N.t('auth.error_invalid_credentials');
        }
        if (originalMessage?.includes('Email not confirmed')) {
            return 'Confirme seu e-mail antes de fazer login.';
        }
        if (originalMessage?.includes('User already registered')) {
            return I18N.t('auth.error_email_taken');
        }
        if (originalMessage?.includes('Password should be at least 6 characters')) {
            return I18N.t('errors.password_too_short');
        }

        // Erros de rede
        if (originalMessage?.includes('fetch') || originalMessage?.includes('NetworkError')) {
            return I18N.t('errors.network');
        }
        if (originalMessage?.includes('timeout') || originalMessage?.includes('timed out')) {
            return I18N.t('errors.timeout');
        }

        // Erros HTTP
        if (error?.status === 401) {
            return I18N.t('errors.unauthorized');
        }
        if (error?.status === 404) {
            return I18N.t('errors.not_found');
        }
        if (error?.status === 429) {
            return 'Muitas requisições. Aguarde um momento e tente novamente.';
        }

        // Códigos de erro específicos
        if (code === 'PGRST301') {
            return 'Erro de permissão no banco de dados.';
        }

        return I18N.t('errors.generic');
    },

    // ===== MÉTODOS DE LOG =====
    log(message, level = 'info', details = {}) {
        return this.handleError(message, { level, ...details });
    },

    info(message, details = {}) {
        return this.log(message, 'info', details);
    },

    warn(message, details = {}) {
        return this.log(message, 'warn', details);
    },

    error(message, details = {}) {
        return this.log(message, 'error', details);
    },

    fatal(message, details = {}) {
        return this.log(message, 'fatal', details);
    },

    // ===== TOAST =====
    toast(message, type = 'info') {
        this._showToast(message, type);
    },

    _showToast(message, type = 'info') {
        if (typeof App !== 'undefined' && App.toast) {
            App.toast(message, type);
        } else {
            // Fallback: toast global mínimo
            const container = document.getElementById('toastContainer');
            if (!container) return;
            const toast = document.createElement('div');
            toast.className = `toast toast-${type}`;
            const icons = { success: 'check-circle', warning: 'triangle-exclamation', error: 'circle-xmark', info: 'circle-info' };
            toast.innerHTML = `<i class="fa-solid fa-${icons[type] || icons.info}"></i> ${message}`;
            container.appendChild(toast);
            setTimeout(() => toast.remove(), this._config.toastDuration);
        }
    },

    // ===== HISTÓRICO =====
    _addToHistory(errorInfo) {
        this._logHistory.unshift(errorInfo);
        if (this._logHistory.length > this._config.maxLogEntries) {
            this._logHistory.pop();
        }
    },

    getHistory() {
        return [...this._logHistory];
    },

    clearHistory() {
        this._logHistory = [];
    },

    // ===== LOG NO SERVIDOR =====
    async _sendToServer(errorInfo) {
        try {
            if (typeof SupabaseClient !== 'undefined' && SupabaseClient.ready) {
                await SupabaseClient.client
                    .from('AuditLog')
                    .insert({
                        userId: App?.currentUser?.id || null,
                        action: 'error',
                        entity: errorInfo.context,
                        details: errorInfo
                    });
            }
        } catch (e) {
            console.warn('Erro ao enviar log para servidor:', e);
        }
    },

    // ===== VALIDAÇÃO =====
    validate(condition, message, details = {}) {
        if (!condition) {
            this.handleError(new Error(message), { level: this.LEVELS.WARN, ...details });
            return false;
        }
        return true;
    },

    // ===== SANITIZAÇÃO XSS =====
    sanitize(str) {
        if (!str) return '';
        const div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    },

    sanitizeObject(obj) {
        if (!obj || typeof obj !== 'object') return obj;
        const sanitized = {};
        for (const [key, value] of Object.entries(obj)) {
            sanitized[key] = typeof value === 'string' ? this.sanitize(value) : value;
        }
        return sanitized;
    }
};

// Inicializa automaticamente
ErrorHandler.init();