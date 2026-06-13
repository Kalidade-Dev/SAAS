const CONFIG = {
    // Supabase — preencher quando receber as credenciais
    supabase: {
        url: 'https://ufhnivjbtuxdenvjgdpu.supabase.co',
        anonKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVmaG5pdmpidHV4ZGVudmpnZHB1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODEyMDA5NjEsImV4cCI6MjA5Njc3Njk2MX0.ftjWM-6nhUlQuGcFmD0UWMMLm8bXGFSL2XChsdxdtT0'
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
