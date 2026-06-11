const CONFIG = {
    // Supabase — preencher quando receber as credenciais
    supabase: {
        url: '',
        anonKey: ''
    },

    // Google OAuth — login com conta Google
    googleAuth: {
        clientId: '647277378288-5nl44kg2c2ar7uuh1mcqkram46tnrlda.apps.googleusercontent.com'
    },

    // Google Places API (opcional) — chave diferente, começa com AIza...
    // Crie em: Google Cloud Console > APIs e Serviços > Credenciais > Chave de API
    googleMaps: {
        apiKey: ''
    },

    // API de IA (OpenAI, Gemini, etc.) — para enriquecer dados
    ai: {
        provider: 'openai', // 'openai' | 'gemini' | 'mock'
        apiKey: '',
        model: 'gpt-4o-mini'
    },

    // Busca real via OpenStreetMap (Nominatim + Overpass) — sem API key
    openStreetMap: {
        enabled: true,
        defaultCountry: 'Brasil'
    },

    defaults: {
        radius: 5000,
        maxResults: 80
    }
};
