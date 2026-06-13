/**
 * SaaS MAPS - Sistema de Internacionalização (i18n)
 * Suporte: pt-BR, en-US, es-ES
 * 
 * Uso:
 *   i18n.setLocale('en-US')
 *   i18n.t('search.title') // "Search Establishments"
 *   i18n.t('common.save')  // "Save"
 */

const I18N = {
    _locale: CONFIG.locale || 'pt-BR',
    _fallback: CONFIG.fallbackLocale || 'pt-BR',
    _cache: {},

    // ===== TRADUÇÕES =====
    translations: {
        'pt-BR': {
            common: {
                app_name: 'SaaS Maps',
                save: 'Salvar',
                saving: 'Salvando...',
                cancel: 'Cancelar',
                confirm: 'Confirmar',
                delete: 'Excluir',
                edit: 'Editar',
                close: 'Fechar',
                loading: 'Carregando...',
                search: 'Buscar',
                searching: 'Buscando...',
                no_results: 'Nenhum resultado encontrado',
                error: 'Erro',
                success: 'Sucesso',
                warning: 'Aviso',
                info: 'Informação',
                logout: 'Sair',
                back: 'Voltar',
                next: 'Próximo',
                previous: 'Anterior',
                page: 'Página',
                of: 'de',
                all: 'Todos',
                export: 'Exportar',
                filter: 'Filtrar',
                sort: 'Ordenar',
                recent: 'Mais recentes',
                oldest: 'Mais antigos',
                no_site: 'Sem site',
                no_maps: 'Sem Maps',
                select: 'Selecionar',
                optional: 'Opcional',
                required: 'Obrigatório',
                enabled: 'Ativado',
                disabled: 'Desativado',
                online: 'Online',
                offline: 'Offline',
                yes: 'Sim',
                no: 'Não',
                or: 'OU',
                and: 'e',
                here: 'aqui'
            },
            auth: {
                login: 'Entrar',
                register: 'Criar conta',
                login_title: 'Saas Maps',
                login_subtitle: 'Encontre empresas sem presença digital',
                register_title: 'Crie sua conta para começar',
                email: 'Seu e-mail',
                password: 'Sua senha',
                name: 'Seu nome',
                remember: 'Lembrar-me',
                forgot_password: 'Esqueci minha senha',
                no_account: 'Não possui conta?',
                has_account: 'Já possui conta?',
                create_account: 'Criar conta',
                login_google: 'Entrar com Google',
                register_google: 'Criar conta com Google',
                logging_in: 'Entrando...',
                registering: 'Criando conta...',
                connecting_google: 'Conectando...',
                success_login: 'Login realizado com sucesso!',
                success_register: 'Conta criada! Verifique seu e-mail para confirmar o cadastro.',
                error_invalid_credentials: 'E-mail ou senha inválidos',
                error_email_taken: 'Este e-mail já está cadastrado',
                error_weak_password: 'A senha deve ter no mínimo 6 caracteres',
                error_google_not_configured: 'Login com Google não configurado. Use e-mail e senha.',
                logout_confirm_title: 'Sair da conta?',
                logout_confirm_message: 'Tem certeza que deseja encerrar sua sessão?'
            },
            dashboard: {
                title: 'Busca de Estabelecimentos',
                subtitle: 'Encontre negócios que ainda não têm presença digital — sem site e sem cadastro no Google Maps.',
                subtitle_line: 'Oportunidades esperando por você.',
                tab_search: 'Buscar',
                tab_saved: 'Salvos',
                tab_panel: 'Painel',
                search_state: 'Estado',
                search_city: 'Cidade',
                search_category: 'Tipo de Negócio',
                search_placeholder_state: 'Selecione o estado',
                search_placeholder_city: 'Digite para buscar a cidade...',
                search_placeholder_category: 'Categoria...',
                select_state_first: 'Selecione o estado primeiro...',
                loading_cities: 'Carregando cidades...',
                error_loading_cities: 'Erro ao carregar — digite a cidade',
                results: 'Resultados',
                results_count: 'Resultados ({count})',
                filter_results: 'Filtrar resultados...',
                no_leads_found: 'Nenhum lead encontrado',
                no_leads_message: 'Informe uma cidade real (ex: "Fortaleza, CE") e clique em Buscar. Os dados vêm do OpenStreetMap.',
                no_saved_leads: 'Nenhum lead salvo',
                no_saved_leads_message: 'Faça uma busca e os leads aparecerão aqui automaticamente.',
                no_filter_results: 'Nenhum lead encontrado com esse filtro.',
                export_csv: 'Exportar CSV',
                clear: 'Limpar',
                delete_selected: 'Excluir selecionados ({count})',
                leads_saved: 'lead salvos',
                save_lead_success: 'salvo com sucesso!',
                lead_already_saved: 'Este lead já está salvo',
                lead_deleted: 'Lead excluído',
                leads_deleted: 'leads excluídos',
                delete_confirm_title: 'Excluir lead?',
                delete_confirm_message: 'Tem certeza que deseja excluir <strong>{name}</strong>?',
                delete_selected_confirm_title: 'Excluir leads selecionados?',
                delete_selected_confirm_message: 'Tem certeza que deseja excluir <strong>{count} lead(s)</strong> selecionado(s)?',
                clear_confirm_title: 'Limpar resultados?',
                clear_confirm_message: 'Tem certeza que deseja limpar todos os resultados da busca?',
                status_changed: 'Status alterado para "{status}"',
                error_updating_status: 'Erro ao atualizar status',
                csv_exported: 'CSV exportado com sucesso!',
                csv_empty: 'Nenhum dado para exportar',
                results_cleared: 'Resultados limpos',
                column_name: 'Estabelecimento',
                column_city: 'Cidade',
                column_phone: 'Telefone',
                column_website: 'Site',
                column_maps: 'Google Maps',
                column_details: 'Detalhes',
                column_save: 'Salvar',
                saved_since: 'salvo'
            },
            panel: {
                title: 'Painel de Oportunidades',
                subtitle: 'Visão geral dos seus leads, presença digital e funil comercial',
                updated_at: 'Atualizado às {time}',
                total_leads: 'Total de leads',
                total_leads_sub: 'Oportunidades mapeadas',
                with_site: 'Com site',
                with_site_sub: 'Presença digital ativa',
                without_site: 'Sem site',
                without_site_sub: 'Prioridade comercial',
                categories: 'Categorias',
                categories_sub: 'Segmentos encontrados',
                digital_presence: 'Presença digital',
                by_category: 'Por categoria',
                commercial_funnel: 'Funil comercial',
                new: 'Novo',
                contacted: 'Contatado',
                negotiating: 'Em negociação',
                client: 'Cliente',
                discarded: 'Descartado',
                opportunity_with_site: 'Negócio com presença digital estabelecida.',
                opportunity_no_site: 'Oportunidade — sem site, mas presente no Maps.',
                opportunity_high_potential: 'Alto potencial — sem presença digital.',
                indicators_appear_after: 'Os indicadores aparecem após buscar ou carregar leads.',
                categories_grouped_here: 'As categorias serão agrupadas aqui.',
                save_leads_for_funnel: 'Salve leads para acompanhar o funil comercial aqui.'
            },
            plan: {
                title: 'Planos e Preços',
                subtitle: 'Escolha o plano ideal para suas necessidades',
                monthly: 'Mensal',
                yearly: 'Anual',
                current_plan: 'Plano atual',
                upgrade: 'Fazer upgrade',
                downgrade: 'Downgrade',
                select: 'Selecionar plano',
                most_popular: 'Mais popular',
                per_month: '/mês',
                features: 'Recursos',
                max_leads: 'Até {count} leads/mês',
                max_searches: 'Até {count} buscas/dia',
                free: 'Grátis',
                contact_us: 'Fale conosco',
                basic_name: 'Basic',
                pro_name: 'Pro',
                enterprise_name: 'Enterprise'
            },
            profile: {
                title: 'Meu Perfil',
                account_info: 'Informações da Conta',
                personal_info: 'Informações Pessoais',
                preferences: 'Preferências',
                language: 'Idioma',
                theme: 'Tema',
                dark: 'Escuro',
                light: 'Claro',
                system: 'Sistema',
                plan: 'Plano',
                subscription: 'Assinatura',
                expires: 'Expira em',
                active: 'Ativa',
                cancelled: 'Cancelada',
                save_preferences: 'Salvar preferências',
                preferences_saved: 'Preferências salvas com sucesso!'
            },
            search: {
                establishments_found: '{count} estabelecimentos encontrados em {city}',
                no_establishments: 'Nenhum estabelecimento encontrado',
                with_phone: 'Com telefone',
                without_phone: 'Sem telefone',
                has_site: 'Tem site',
                has_no_site: 'Sem site',
                on_maps: 'No Maps',
                not_on_maps: 'Sem Maps',
                from_google: 'Google Places',
                from_osm: 'OpenStreetMap',
                error: 'Erro na busca'
            },
            errors: {
                generic: 'Ocorreu um erro. Tente novamente.',
                network: 'Erro de conexão. Verifique sua internet.',
                timeout: 'A requisição excedeu o tempo limite.',
                unauthorized: 'Sessão expirada. Faça login novamente.',
                not_found: 'Recurso não encontrado.',
                validation: 'Verifique os campos obrigatórios.',
                fill_all_fields: 'Preencha todos os campos',
                select_state: 'Selecione o estado',
                enter_city: 'Informe a cidade para buscar',
                password_too_short: 'A senha deve ter no mínimo 6 caracteres',
                invalid_email: 'E-mail inválido'
            },
            time: {
                just_now: 'agora',
                minutes_ago: '{min} min atrás',
                hours_ago: '{h} horas atrás',
                yesterday: 'ontem',
                days_ago: '{d} dias atrás'
            },
            footer: {
                all_rights_reserved: 'Todos os direitos reservados.',
                terms: 'Termos de Serviço',
                privacy: 'Privacidade',
                faq: 'FAQ',
                contact: 'Contato',
                pricing: 'Preços'
            },
            nav: {
                search: 'Buscar',
                saved: 'Salvos',
                panel: 'Painel',
                profile: 'Perfil',
                plans: 'Planos',
                logout: 'Sair',
                admin: 'Admin'
            }
        },

        'en-US': {
            common: {
                app_name: 'SaaS Maps',
                save: 'Save',
                saving: 'Saving...',
                cancel: 'Cancel',
                confirm: 'Confirm',
                delete: 'Delete',
                edit: 'Edit',
                close: 'Close',
                loading: 'Loading...',
                search: 'Search',
                searching: 'Searching...',
                no_results: 'No results found',
                error: 'Error',
                success: 'Success',
                warning: 'Warning',
                info: 'Info',
                logout: 'Logout',
                back: 'Back',
                next: 'Next',
                previous: 'Previous',
                page: 'Page',
                of: 'of',
                all: 'All',
                export: 'Export',
                filter: 'Filter',
                sort: 'Sort',
                recent: 'Most recent',
                oldest: 'Oldest',
                no_site: 'No website',
                no_maps: 'No Maps',
                select: 'Select',
                optional: 'Optional',
                required: 'Required',
                enabled: 'Enabled',
                disabled: 'Disabled',
                online: 'Online',
                offline: 'Offline',
                yes: 'Yes',
                no: 'No',
                or: 'OR',
                and: 'and',
                here: 'here'
            },
            auth: {
                login: 'Sign In',
                register: 'Create Account',
                login_title: 'Saas Maps',
                login_subtitle: 'Find businesses without digital presence',
                register_title: 'Create your account to start',
                email: 'Your email',
                password: 'Your password',
                name: 'Your name',
                remember: 'Remember me',
                forgot_password: 'Forgot password?',
                no_account: "Don't have an account?",
                has_account: 'Already have an account?',
                create_account: 'Create Account',
                login_google: 'Sign in with Google',
                register_google: 'Sign up with Google',
                logging_in: 'Signing in...',
                registering: 'Creating account...',
                connecting_google: 'Connecting...',
                success_login: 'Logged in successfully!',
                success_register: 'Account created! Check your email to confirm.',
                error_invalid_credentials: 'Invalid email or password',
                error_email_taken: 'This email is already registered',
                error_weak_password: 'Password must be at least 6 characters',
                error_google_not_configured: 'Google login not configured. Use email and password.',
                logout_confirm_title: 'Logout?',
                logout_confirm_message: 'Are you sure you want to end your session?'
            },
            dashboard: {
                title: 'Business Search',
                subtitle: 'Find businesses without digital presence — no website and no Google Maps listing.',
                subtitle_line: 'Opportunities waiting for you.',
                tab_search: 'Search',
                tab_saved: 'Saved',
                tab_panel: 'Dashboard',
                search_state: 'State',
                search_city: 'City',
                search_category: 'Business Type',
                search_placeholder_state: 'Select state',
                search_placeholder_city: 'Type to search city...',
                search_placeholder_category: 'Category...',
                select_state_first: 'Select state first...',
                loading_cities: 'Loading cities...',
                error_loading_cities: 'Error loading — type city name',
                results: 'Results',
                results_count: 'Results ({count})',
                filter_results: 'Filter results...',
                no_leads_found: 'No leads found',
                no_leads_message: 'Enter a real city (e.g. "New York, NY") and click Search. Data comes from OpenStreetMap.',
                no_saved_leads: 'No saved leads',
                no_saved_leads_message: 'Run a search and leads will appear here automatically.',
                no_filter_results: 'No leads found with this filter.',
                export_csv: 'Export CSV',
                clear: 'Clear',
                delete_selected: 'Delete selected ({count})',
                leads_saved: 'saved leads',
                save_lead_success: 'saved successfully!',
                lead_already_saved: 'This lead is already saved',
                lead_deleted: 'Lead deleted',
                leads_deleted: 'leads deleted',
                delete_confirm_title: 'Delete lead?',
                delete_confirm_message: 'Are you sure you want to delete <strong>{name}</strong>?',
                delete_selected_confirm_title: 'Delete selected leads?',
                delete_selected_confirm_message: 'Are you sure you want to delete <strong>{count} lead(s)</strong>?',
                clear_confirm_title: 'Clear results?',
                clear_confirm_message: 'Are you sure you want to clear all search results?',
                status_changed: 'Status changed to "{status}"',
                error_updating_status: 'Error updating status',
                csv_exported: 'CSV exported successfully!',
                csv_empty: 'No data to export',
                results_cleared: 'Results cleared',
                column_name: 'Business',
                column_city: 'City',
                column_phone: 'Phone',
                column_website: 'Website',
                column_maps: 'Google Maps',
                column_details: 'Details',
                column_save: 'Save',
                saved_since: 'saved'
            },
            panel: {
                title: 'Opportunity Dashboard',
                subtitle: 'Overview of your leads, digital presence and sales funnel',
                updated_at: 'Updated at {time}',
                total_leads: 'Total leads',
                total_leads_sub: 'Mapped opportunities',
                with_site: 'With website',
                with_site_sub: 'Active digital presence',
                without_site: 'Without website',
                without_site_sub: 'Sales priority',
                categories: 'Categories',
                categories_sub: 'Segments found',
                digital_presence: 'Digital presence',
                by_category: 'By category',
                commercial_funnel: 'Sales funnel',
                new: 'New',
                contacted: 'Contacted',
                negotiating: 'Negotiating',
                client: 'Client',
                discarded: 'Discarded',
                opportunity_with_site: 'Business with established digital presence.',
                opportunity_no_site: 'Opportunity — no website, but present on Maps.',
                opportunity_high_potential: 'High potential — no digital presence.',
                indicators_appear_after: 'Indicators appear after searching or loading leads.',
                categories_grouped_here: 'Categories will be grouped here.',
                save_leads_for_funnel: 'Save leads to track your sales funnel here.'
            },
            plan: {
                title: 'Plans & Pricing',
                subtitle: 'Choose the best plan for your needs',
                monthly: 'Monthly',
                yearly: 'Yearly',
                current_plan: 'Current plan',
                upgrade: 'Upgrade',
                downgrade: 'Downgrade',
                select: 'Select plan',
                most_popular: 'Most popular',
                per_month: '/mo',
                features: 'Features',
                max_leads: 'Up to {count} leads/month',
                max_searches: 'Up to {count} searches/day',
                free: 'Free',
                contact_us: 'Contact us',
                basic_name: 'Basic',
                pro_name: 'Pro',
                enterprise_name: 'Enterprise'
            },
            profile: {
                title: 'My Profile',
                account_info: 'Account Information',
                personal_info: 'Personal Information',
                preferences: 'Preferences',
                language: 'Language',
                theme: 'Theme',
                dark: 'Dark',
                light: 'Light',
                system: 'System',
                plan: 'Plan',
                subscription: 'Subscription',
                expires: 'Expires on',
                active: 'Active',
                cancelled: 'Cancelled',
                save_preferences: 'Save preferences',
                preferences_saved: 'Preferences saved successfully!'
            },
            search: {
                establishments_found: '{count} establishments found in {city}',
                no_establishments: 'No establishments found',
                with_phone: 'Has phone',
                without_phone: 'No phone',
                has_site: 'Has website',
                has_no_site: 'No website',
                on_maps: 'On Maps',
                not_on_maps: 'Not on Maps',
                from_google: 'Google Places',
                from_osm: 'OpenStreetMap',
                error: 'Search error'
            },
            errors: {
                generic: 'An error occurred. Please try again.',
                network: 'Connection error. Check your internet.',
                timeout: 'Request timed out.',
                unauthorized: 'Session expired. Please login again.',
                not_found: 'Resource not found.',
                validation: 'Please check required fields.',
                fill_all_fields: 'Please fill all required fields',
                select_state: 'Please select a state',
                enter_city: 'Please enter a city',
                password_too_short: 'Password must be at least 6 characters',
                invalid_email: 'Invalid email'
            },
            time: {
                just_now: 'just now',
                minutes_ago: '{min} min ago',
                hours_ago: '{h} hours ago',
                yesterday: 'yesterday',
                days_ago: '{d} days ago'
            },
            footer: {
                all_rights_reserved: 'All rights reserved.',
                terms: 'Terms of Service',
                privacy: 'Privacy',
                faq: 'FAQ',
                contact: 'Contact',
                pricing: 'Pricing'
            },
            nav: {
                search: 'Search',
                saved: 'Saved',
                panel: 'Dashboard',
                profile: 'Profile',
                plans: 'Plans',
                logout: 'Logout',
                admin: 'Admin'
            }
        },

        'es-ES': {
            common: {
                app_name: 'SaaS Maps',
                save: 'Guardar',
                saving: 'Guardando...',
                cancel: 'Cancelar',
                confirm: 'Confirmar',
                delete: 'Eliminar',
                edit: 'Editar',
                close: 'Cerrar',
                loading: 'Cargando...',
                search: 'Buscar',
                searching: 'Buscando...',
                no_results: 'Sin resultados',
                error: 'Error',
                success: 'Éxito',
                warning: 'Aviso',
                info: 'Información',
                logout: 'Salir',
                back: 'Volver',
                next: 'Siguiente',
                previous: 'Anterior',
                page: 'Página',
                of: 'de',
                all: 'Todos',
                export: 'Exportar',
                filter: 'Filtrar',
                sort: 'Ordenar',
                recent: 'Más recientes',
                oldest: 'Más antiguos',
                no_site: 'Sin web',
                no_maps: 'Sin Maps',
                select: 'Seleccionar',
                optional: 'Opcional',
                required: 'Obligatorio',
                enabled: 'Activado',
                disabled: 'Desactivado',
                online: 'En línea',
                offline: 'Desconectado',
                yes: 'Sí',
                no: 'No',
                or: 'O',
                and: 'y',
                here: 'aquí'
            },
            auth: {
                login: 'Iniciar sesión',
                register: 'Crear cuenta',
                login_title: 'Saas Maps',
                login_subtitle: 'Encuentre empresas sin presencia digital',
                register_title: 'Cree su cuenta para comenzar',
                email: 'Su correo',
                password: 'Su contraseña',
                name: 'Su nombre',
                remember: 'Recordarme',
                forgot_password: '¿Olvidó su contraseña?',
                no_account: '¿No tiene cuenta?',
                has_account: '¿Ya tiene cuenta?',
                create_account: 'Crear cuenta',
                login_google: 'Iniciar con Google',
                register_google: 'Registrarse con Google',
                logging_in: 'Iniciando sesión...',
                registering: 'Creando cuenta...',
                connecting_google: 'Conectando...',
                success_login: '¡Inicio de sesión exitoso!',
                success_register: '¡Cuenta creada! Revise su correo para confirmar.',
                error_invalid_credentials: 'Correo o contraseña inválidos',
                error_email_taken: 'Este correo ya está registrado',
                error_weak_password: 'La contraseña debe tener al menos 6 caracteres',
                error_google_not_configured: 'Google no configurado. Use correo y contraseña.',
                logout_confirm_title: '¿Cerrar sesión?',
                logout_confirm_message: '¿Está seguro de que desea cerrar su sesión?'
            },
            dashboard: {
                title: 'Búsqueda de Establecimientos',
                subtitle: 'Encuentre negocios sin presencia digital — sin web y sin Google Maps.',
                subtitle_line: 'Oportunidades esperando por usted.',
                tab_search: 'Buscar',
                tab_saved: 'Guardados',
                tab_panel: 'Panel',
                search_state: 'Estado',
                search_city: 'Ciudad',
                search_category: 'Tipo de Negocio',
                search_placeholder_state: 'Seleccione el estado',
                search_placeholder_city: 'Escriba para buscar ciudad...',
                search_placeholder_category: 'Categoría...',
                select_state_first: 'Seleccione el estado primero...',
                loading_cities: 'Cargando ciudades...',
                error_loading_cities: 'Error al cargar — escriba la ciudad',
                results: 'Resultados',
                results_count: 'Resultados ({count})',
                filter_results: 'Filtrar resultados...',
                no_leads_found: 'Ningún lead encontrado',
                no_leads_message: 'Ingrese una ciudad real (ej: "Madrid") y haga clic en Buscar. Los datos vienen de OpenStreetMap.',
                no_saved_leads: 'Sin leads guardados',
                no_saved_leads_message: 'Haga una búsqueda y los leads aparecerán aquí automáticamente.',
                no_filter_results: 'Ningún lead encontrado con ese filtro.',
                export_csv: 'Exportar CSV',
                clear: 'Limpiar',
                delete_selected: 'Eliminar seleccionados ({count})',
                leads_saved: 'leads guardados',
                save_lead_success: '¡guardado con éxito!',
                lead_already_saved: 'Este lead ya está guardado',
                lead_deleted: 'Lead eliminado',
                leads_deleted: 'leads eliminados',
                delete_confirm_title: '¿Eliminar lead?',
                delete_confirm_message: '¿Está seguro de eliminar <strong>{name}</strong>?',
                delete_selected_confirm_title: '¿Eliminar leads seleccionados?',
                delete_selected_confirm_message: '¿Está seguro de eliminar <strong>{count} lead(s)</strong>?',
                clear_confirm_title: '¿Limpiar resultados?',
                clear_confirm_message: '¿Está seguro de limpiar todos los resultados?',
                status_changed: 'Estado cambiado a "{status}"',
                error_updating_status: 'Error al actualizar estado',
                csv_exported: '¡CSV exportado con éxito!',
                csv_empty: 'Sin datos para exportar',
                results_cleared: 'Resultados limpios',
                column_name: 'Establecimiento',
                column_city: 'Ciudad',
                column_phone: 'Teléfono',
                column_website: 'Sitio web',
                column_maps: 'Google Maps',
                column_details: 'Detalles',
                column_save: 'Guardar',
                saved_since: 'guardado'
            },
            panel: {
                title: 'Panel de Oportunidades',
                subtitle: 'Resumen de sus leads, presencia digital y embudo comercial',
                updated_at: 'Actualizado a las {time}',
                total_leads: 'Total leads',
                total_leads_sub: 'Oportunidades mapeadas',
                with_site: 'Con web',
                with_site_sub: 'Presencia digital activa',
                without_site: 'Sin web',
                without_site_sub: 'Prioridad comercial',
                categories: 'Categorías',
                categories_sub: 'Segmentos encontrados',
                digital_presence: 'Presencia digital',
                by_category: 'Por categoría',
                commercial_funnel: 'Embudo comercial',
                new: 'Nuevo',
                contacted: 'Contactado',
                negotiating: 'Negociando',
                client: 'Cliente',
                discarded: 'Descartado',
                opportunity_with_site: 'Negocio con presencia digital establecida.',
                opportunity_no_site: 'Oportunidad — sin web, pero presente en Maps.',
                opportunity_high_potential: 'Alto potencial — sin presencia digital.',
                indicators_appear_after: 'Los indicadores aparecen después de buscar o cargar leads.',
                categories_grouped_here: 'Las categorías se agruparán aquí.',
                save_leads_for_funnel: 'Guarde leads para seguir su embudo comercial aquí.'
            },
            plan: {
                title: 'Planes y Precios',
                subtitle: 'Elija el plan ideal para sus necesidades',
                monthly: 'Mensual',
                yearly: 'Anual',
                current_plan: 'Plan actual',
                upgrade: 'Mejorar',
                downgrade: 'Degradar',
                select: 'Seleccionar plan',
                most_popular: 'Más popular',
                per_month: '/mes',
                features: 'Características',
                max_leads: 'Hasta {count} leads/mes',
                max_searches: 'Hasta {count} búsquedas/día',
                free: 'Gratis',
                contact_us: 'Contáctenos',
                basic_name: 'Basic',
                pro_name: 'Pro',
                enterprise_name: 'Enterprise'
            },
            profile: {
                title: 'Mi Perfil',
                account_info: 'Información de la Cuenta',
                personal_info: 'Información Personal',
                preferences: 'Preferencias',
                language: 'Idioma',
                theme: 'Tema',
                dark: 'Oscuro',
                light: 'Claro',
                system: 'Sistema',
                plan: 'Plan',
                subscription: 'Suscripción',
                expires: 'Expira el',
                active: 'Activa',
                cancelled: 'Cancelada',
                save_preferences: 'Guardar preferencias',
                preferences_saved: '¡Preferencias guardadas con éxito!'
            },
            search: {
                establishments_found: '{count} establecimientos encontrados en {city}',
                no_establishments: 'Ningún establecimiento encontrado',
                with_phone: 'Con teléfono',
                without_phone: 'Sin teléfono',
                has_site: 'Tiene web',
                has_no_site: 'Sin web',
                on_maps: 'En Maps',
                not_on_maps: 'Sin Maps',
                from_google: 'Google Places',
                from_osm: 'OpenStreetMap',
                error: 'Error en la búsqueda'
            },
            errors: {
                generic: 'Ocurrió un error. Intente de nuevo.',
                network: 'Error de conexión. Verifique su internet.',
                timeout: 'La solicitud excedió el tiempo límite.',
                unauthorized: 'Sesión expirada. Inicie sesión de nuevo.',
                not_found: 'Recurso no encontrado.',
                validation: 'Verifique los campos obligatorios.',
                fill_all_fields: 'Complete todos los campos obligatorios',
                select_state: 'Seleccione un estado',
                enter_city: 'Ingrese una ciudad',
                password_too_short: 'La contraseña debe tener al menos 6 caracteres',
                invalid_email: 'Correo inválido'
            },
            time: {
                just_now: 'ahora',
                minutes_ago: 'hace {min} min',
                hours_ago: 'hace {h} horas',
                yesterday: 'ayer',
                days_ago: 'hace {d} días'
            },
            footer: {
                all_rights_reserved: 'Todos los derechos reservados.',
                terms: 'Términos de Servicio',
                privacy: 'Privacidad',
                faq: 'FAQ',
                contact: 'Contacto',
                pricing: 'Precios'
            },
            nav: {
                search: 'Buscar',
                saved: 'Guardados',
                panel: 'Panel',
                profile: 'Perfil',
                plans: 'Planes',
                logout: 'Salir',
                admin: 'Admin'
            }
        }
    },

    // ===== MÉTODOS =====

    /**
     * Define o idioma ativo
     */
    setLocale(locale) {
        if (this.translations[locale]) {
            this._locale = locale;
            localStorage.setItem('saas_locale', locale);
            this._notifyListeners();
            return true;
        }
        return false;
    },

    /**
     * Retorna o idioma ativo
     */
    getLocale() {
        // Tenta carregar preferência salva
        try {
            const saved = localStorage.getItem('saas_locale');
            if (saved && this.translations[saved]) {
                return saved;
            }
        } catch (e) {}
        return this._locale;
    },

    /**
     * Retorna os idiomas disponíveis
     */
    getAvailableLocales() {
        return Object.keys(this.translations);
    },

    /**
     * Retorna o nome do idioma
     */
    getLocaleName(locale) {
        const names = {
            'pt-BR': 'Português (Brasil)',
            'en-US': 'English (US)',
            'es-ES': 'Español'
        };
        return names[locale] || locale;
    },

    /**
     * Traduz uma chave com interpolação de variáveis
     * 
     * @param {string} key - Chave no formato "section.key"
     * @param {Object} vars - Variáveis para interpolação ({name}, {count}, etc)
     * @returns {string} Texto traduzido
     */
    t(key, vars = {}) {
        const parts = key.split('.');
        let translation = this.translations[this._locale];
        
        // Navega pela árvore de traduções
        for (const part of parts) {
            if (translation && translation[part] !== undefined) {
                translation = translation[part];
            } else {
                // Fallback para o idioma padrão
                translation = this.translations[this._fallback];
                for (const p of parts) {
                    if (translation && translation[p] !== undefined) {
                        translation = translation[p];
                    } else {
                        return key; // Chave não encontrada
                    }
                }
                break;
            }
        }

        if (typeof translation !== 'string') {
            return key;
        }

        // Interpolação de variáveis
        return translation.replace(/\{(\w+)\}/g, (match, varName) => {
            return vars[varName] !== undefined ? vars[varName] : match;
        });
    },

    /**
     * Retorna o idioma atual como código HTML (lang attribute)
     */
    getHtmlLang() {
        return this._locale;
    },

    // ===== LISTENERS =====
    _listeners: [],

    onChange(callback) {
        this._listeners.push(callback);
        return () => {
            this._listeners = this._listeners.filter(l => l !== callback);
        };
    },

    _notifyListeners() {
        this._listeners.forEach(cb => cb(this._locale));
    },

    /**
     * Inicializa o i18n com o idioma salvo
     */
    init() {
        const saved = this.getLocale();
        if (saved && saved !== this._locale) {
            this._locale = saved;
        }
        // Aplica o atributo lang no HTML
        document.documentElement.lang = this.getHtmlLang();
        return this._locale;
    }
};

// Inicializa automaticamente
I18N.init();

// Atalho global
const __ = (key, vars) => I18N.t(key, vars);