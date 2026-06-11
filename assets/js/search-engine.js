/**
 * Motor de busca com dados REAIS via OpenStreetMap (Nominatim + Overpass).
 * Opcional: Google Places JS API quando CONFIG.googleMaps.apiKey estiver preenchida.
 */

const CATEGORIES = [
    'Restaurante', 'Padaria', 'Farmácia', 'Salão de Beleza',
    'Oficina Mecânica', 'Pet Shop', 'Loja de Roupas', 'Barbearia',
    'Dentista', 'Academia', 'Mercado', 'Floricultura',
    'Imobiliária', 'Advocacia', 'Contabilidade', 'Escola de Idiomas'
];

const OSM_CATEGORY_MAP = {
    'restaurante':        [{ k: 'amenity', v: ['restaurant', 'fast_food'] }, { k: 'amenity', v: ['cafe'] }],
    'padaria':            [{ k: 'shop', v: ['bakery'] }, { k: 'craft', v: ['bakery'] }],
    'farmacia':           [{ k: 'amenity', v: ['pharmacy'] }],
    'farmácia':           [{ k: 'amenity', v: ['pharmacy'] }],
    'salao de beleza':    [{ k: 'shop', v: ['beauty', 'hairdresser'] }],
    'salão de beleza':    [{ k: 'shop', v: ['beauty', 'hairdresser'] }],
    'barbearia':          [{ k: 'amenity', v: ['barber'] }, { k: 'shop', v: ['hairdresser'] }],
    'oficina mecanica':   [{ k: 'shop', v: ['car_repair'] }, { k: 'craft', v: ['car_repair'] }],
    'oficina mecânica':   [{ k: 'shop', v: ['car_repair'] }, { k: 'craft', v: ['car_repair'] }],
    'pet shop':           [{ k: 'shop', v: ['pet'] }],
    'loja de roupas':     [{ k: 'shop', v: ['clothes', 'boutique', 'fashion'] }],
    'dentista':           [{ k: 'amenity', v: ['dentist'] }],
    'academia':           [{ k: 'leisure', v: ['fitness_centre'] }],
    'mercado':            [{ k: 'shop', v: ['supermarket', 'convenience', 'greengrocer'] }],
    'floricultura':       [{ k: 'shop', v: ['florist'] }],
    'imobiliaria':        [{ k: 'office', v: ['estate_agent'] }],
    'imobiliária':        [{ k: 'office', v: ['estate_agent'] }],
    'advocacia':          [{ k: 'office', v: ['lawyer'] }],
    'contabilidade':      [{ k: 'office', v: ['accountant'] }],
    'escola de idiomas':  [{ k: 'amenity', v: ['language_school'] }]
};

const NOMINATIM_SEARCH_TERMS = {
    'restaurante': 'restaurant',
    'padaria': 'bakery',
    'farmacia': 'pharmacy',
    'farmácia': 'pharmacy',
    'salao de beleza': 'hairdresser',
    'salão de beleza': 'hairdresser',
    'barbearia': 'barber',
    'oficina mecanica': 'car repair',
    'oficina mecânica': 'car repair',
    'pet shop': 'pet shop',
    'loja de roupas': 'clothes shop',
    'dentista': 'dentist',
    'academia': 'fitness',
    'mercado': 'supermarket',
    'floricultura': 'florist',
    'imobiliaria': 'estate agent',
    'imobiliária': 'estate agent',
    'advocacia': 'lawyer',
    'contabilidade': 'accountant',
    'escola de idiomas': 'language school'
};

const DEFAULT_OSM_TAGS = [
    { k: 'amenity', v: ['restaurant', 'cafe', 'fast_food', 'pharmacy', 'barber', 'dentist'] },
    { k: 'shop', v: ['supermarket', 'bakery', 'hairdresser', 'beauty', 'clothes', 'pet', 'car_repair'] }
];

const SearchEngine = {
    _lastRequest: 0,

    async search(params) {
        const { city, category, radius, filters } = params;

        const location = await this.geocodeCity(city);
        let results;

        if (CONFIG.googleMaps.apiKey && typeof google !== 'undefined' && google?.maps?.places) {
            results = await this.searchGooglePlaces(location, category, radius);
        } else {
            results = await this.searchOpenStreetMap(location, category, radius);
        }

        if (!results.length) {
            throw new Error(`Nenhum estabelecimento encontrado em ${location.city}. Tente outra categoria ou aumente o raio.`);
        }

        return this.applyFilters(results, filters);
    },

    async nominatimFetch(path) {
        const now = Date.now();
        const wait = 1100 - (now - this._lastRequest);
        if (wait > 0) await new Promise(r => setTimeout(r, wait));
        this._lastRequest = Date.now();

        const res = await fetch(`https://nominatim.openstreetmap.org/${path}`, {
            headers: { 'Accept': 'application/json' }
        });

        if (!res.ok) throw new Error('Erro ao consultar OpenStreetMap');
        return res.json();
    },

    async geocodeCity(city) {
        const query = city.includes(',') ? city : `${city}, ${CONFIG.openStreetMap?.defaultCountry || 'Brasil'}`;
        const data = await this.nominatimFetch(
            `search?${new URLSearchParams({ q: query, format: 'json', addressdetails: '1', limit: '1' })}`
        );

        if (!data.length) {
            throw new Error(`Cidade "${city}" não encontrada. Use o formato "Cidade, Estado" ou "Cidade, País".`);
        }

        const place = data[0];
        const bbox = place.boundingbox?.map(Number) || null;

        return {
            lat: parseFloat(place.lat),
            lng: parseFloat(place.lon),
            displayName: place.display_name,
            city: place.address?.city || place.address?.town || place.address?.municipality || city.split(',')[0].trim(),
            state: place.address?.state || '',
            country: place.address?.country || '',
            bbox
        };
    },

    async searchOpenStreetMap(location, category, radius) {
        let results = await this.searchNominatimPlaces(location, category);

        if (results.length < 15) {
            try {
                const overpass = await this.searchOverpass(location, category, radius);
                results = this.mergeResults(results, overpass);
            } catch (err) {
                console.warn('Overpass indisponível, usando apenas Nominatim:', err.message);
            }
        }

        const max = CONFIG.defaults.maxResults || 80;
        return results.slice(0, max);
    },

    async searchNominatimPlaces(location, category) {
        const term = this.categoryToSearchTerm(category);
        const params = new URLSearchParams({
            q: term,
            format: 'json',
            addressdetails: '1',
            extratags: '1',
            limit: String(CONFIG.defaults.maxResults || 80)
        });

        if (location.bbox) {
            const [minLat, maxLat, minLon, maxLon] = location.bbox;
            params.set('viewbox', `${minLon},${maxLat},${maxLon},${minLat}`);
            params.set('bounded', '1');
        } else {
            params.set('lat', String(location.lat));
            params.set('lon', String(location.lng));
        }

        const data = await this.nominatimFetch(`search?${params}`);
        const commercial = data.filter(p =>
            p.class === 'amenity' || p.class === 'shop' || p.class === 'office' ||
            p.class === 'craft' || p.class === 'leisure' || p.type === 'commercial'
        );

        const pool = commercial.length ? commercial : data;
        return pool
            .filter(p => p.name || p.display_name)
            .map(p => this.normalizeNominatimPlace(p, location));
    },

    normalizeNominatimPlace(place, location) {
        const tags = place.extratags || {};
        const addr = place.address || {};

        const website = tags.website || tags['contact:website'] || tags.url || null;
        const phone = tags.phone || tags['contact:phone'] || tags['contact:mobile'] || null;
        const hasGoogleMaps = !!(
            tags['contact:google_maps'] || tags.google_maps || tags['ref:google']
        );

        const street = [addr.road, addr.house_number].filter(Boolean).join(', ');
        const address = street || place.display_name?.split(',')[0] || '';

        return {
            id: `osm-${place.osm_type}-${place.osm_id}`,
            name: place.name || place.display_name?.split(',')[0],
            category: this.humanCategoryFromType(place.type, place.class),
            address,
            city: addr.city || addr.town || addr.municipality || location.city,
            state: addr.state || location.state,
            phone: phone ? this.formatPhone(phone) : null,
            website: website ? this.normalizeUrl(website) : null,
            hasWebsite: !!website,
            hasMapsLocation: hasGoogleMaps,
            rating: null,
            totalReviews: 0,
            mapsUrl: hasGoogleMaps
                ? tags['contact:google_maps']
                : `https://www.openstreetmap.org/${place.osm_type}/${place.osm_id}`,
            latitude: parseFloat(place.lat),
            longitude: parseFloat(place.lon),
            instagram: tags['contact:instagram'] || null,
            facebook: tags['contact:facebook'] || null,
            whatsapp: tags['contact:whatsapp'] || null,
            email: tags.email || tags['contact:email'] || null,
            openingHours: tags.opening_hours || null,
            source: 'openstreetmap',
            osmType: place.osm_type,
            osmId: place.osm_id,
            aiEnriched: false,
            createdAt: new Date().toISOString()
        };
    },

    async searchOverpass(location, category, radius) {
        const tags = this.resolveOsmTags(category);
        const query = this.buildOverpassQuery(location.lat, location.lng, radius, tags);

        const endpoints = [
            'https://overpass.kumi.systems/api/interpreter',
            'https://overpass-api.de/api/interpreter'
        ];

        for (const endpoint of endpoints) {
            try {
                const res = await fetch(endpoint, {
                    method: 'POST',
                    body: `data=${encodeURIComponent(query)}`,
                    headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
                });

                if (!res.ok) continue;
                const data = await res.json();
                return (data.elements || [])
                    .filter(el => el.tags?.name)
                    .map(el => this.normalizeOsmElement(el, location));
            } catch {
                continue;
            }
        }

        throw new Error('Overpass indisponível');
    },

    mergeResults(a, b) {
        const map = new Map();
        for (const item of [...a, ...b]) {
            const key = `${item.name?.toLowerCase()}-${item.latitude?.toFixed(4)}`;
            if (!map.has(key)) map.set(key, item);
        }
        return Array.from(map.values());
    },

    categoryToSearchTerm(category) {
        if (!category?.trim()) return 'shop';
        const key = category.trim().toLowerCase()
            .normalize('NFD').replace(/[\u0300-\u036f]/g, '');
        return NOMINATIM_SEARCH_TERMS[key] || NOMINATIM_SEARCH_TERMS[category.trim().toLowerCase()] || category;
    },

    resolveOsmTags(category) {
        if (!category?.trim()) return DEFAULT_OSM_TAGS;
        const key = category.trim().toLowerCase()
            .normalize('NFD').replace(/[\u0300-\u036f]/g, '');
        return OSM_CATEGORY_MAP[key] || OSM_CATEGORY_MAP[category.trim().toLowerCase()] || DEFAULT_OSM_TAGS;
    },

    buildOverpassQuery(lat, lng, radius, tags) {
        const conditions = [];
        for (const tag of tags) {
            for (const value of tag.v) {
                conditions.push(`node["${tag.k}"="${value}"](around:${radius},${lat},${lng});`);
            }
        }
        return `[out:json][timeout:25];(${conditions.join('')});out body;`;
    },

    normalizeOsmElement(el, location) {
        const tags = el.tags || {};
        const lat = el.lat ?? el.center?.lat;
        const lng = el.lon ?? el.center?.lon;
        const website = tags.website || tags['contact:website'] || null;
        const phone = tags.phone || tags['contact:phone'] || tags['contact:mobile'] || null;
        const hasGoogleMaps = !!(tags['contact:google_maps'] || tags.google_maps || tags['ref:google']);

        return {
            id: `osm-${el.type}-${el.id}`,
            name: tags.name,
            category: this.humanCategory(tags),
            address: [tags['addr:street'], tags['addr:housenumber']].filter(Boolean).join(', '),
            city: tags['addr:city'] || location.city,
            state: tags['addr:state'] || location.state,
            phone: phone ? this.formatPhone(phone) : null,
            website: website ? this.normalizeUrl(website) : null,
            hasWebsite: !!website,
            hasMapsLocation: hasGoogleMaps,
            rating: null,
            totalReviews: 0,
            mapsUrl: lat && lng ? `https://www.openstreetmap.org/?mlat=${lat}&mlon=${lng}#map=18/${lat}/${lng}` : null,
            latitude: lat,
            longitude: lng,
            source: 'openstreetmap',
            osmType: el.type,
            osmId: el.id,
            aiEnriched: false,
            createdAt: new Date().toISOString()
        };
    },

    humanCategoryFromType(type, cls) {
        const map = {
            restaurant: 'Restaurante', cafe: 'Café', fast_food: 'Fast Food',
            pharmacy: 'Farmácia', barber: 'Barbearia', dentist: 'Dentista',
            bakery: 'Padaria', supermarket: 'Supermercado', hairdresser: 'Salão de Beleza',
            beauty: 'Salão de Beleza', clothes: 'Loja de Roupas', pet: 'Pet Shop',
            car_repair: 'Oficina Mecânica', florist: 'Floricultura',
            lawyer: 'Advocacia', accountant: 'Contabilidade',
            estate_agent: 'Imobiliária', fitness_centre: 'Academia'
        };
        return map[type] || type?.replace(/_/g, ' ') || cls || 'Estabelecimento';
    },

    humanCategory(tags) {
        for (const key of ['amenity', 'shop', 'office', 'craft', 'leisure']) {
            if (tags[key]) return this.humanCategoryFromType(tags[key], key);
        }
        return 'Estabelecimento';
    },

    async searchGooglePlaces(location, category, radius) {
        return new Promise((resolve, reject) => {
            const service = new google.maps.places.PlacesService(document.createElement('div'));
            service.nearbySearch({
                location: new google.maps.LatLng(location.lat, location.lng),
                radius,
                keyword: category || 'estabelecimento comercial'
            }, (results, status) => {
                if (status !== google.maps.places.PlacesServiceStatus.OK) {
                    reject(new Error('Google Places: ' + status));
                    return;
                }
                resolve((results || []).map(p => this.normalizeGooglePlace(p, location.city)));
            });
        });
    },

    normalizeGooglePlace(place, city) {
        return {
            id: place.place_id,
            name: place.name,
            category: place.types?.[0]?.replace(/_/g, ' ') || 'Estabelecimento',
            address: place.vicinity || '',
            city,
            phone: null,
            website: null,
            hasWebsite: false,
            hasMapsLocation: true,
            rating: place.rating || null,
            totalReviews: place.user_ratings_total || 0,
            mapsUrl: `https://www.google.com/maps/place/?q=place_id:${place.place_id}`,
            latitude: place.geometry?.location?.lat(),
            longitude: place.geometry?.location?.lng(),
            source: 'google_places',
            aiEnriched: false,
            createdAt: new Date().toISOString()
        };
    },

    applyFilters(results, filters) {
        let filtered = [...results];
        if (filters?.noWebsite) filtered = filtered.filter(e => !e.hasWebsite);
        if (filters?.noMaps) filtered = filtered.filter(e => !e.hasMapsLocation);
        if (filters?.noPhone) filtered = filtered.filter(e => !e.phone);
        if (filters?.bothMissing) filtered = filtered.filter(e => !e.hasWebsite && !e.hasMapsLocation);
        return filtered;
    },

    formatPhone(phone) {
        const digits = phone.replace(/\D/g, '');
        if (digits.length === 11) return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
        if (digits.length === 10) return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
        return phone;
    },

    normalizeUrl(url) {
        return url.startsWith('http') ? url : 'https://' + url;
    },

    generatePhone() {
        const ddd = ['11', '21', '31', '41', '51', '61', '71', '81', '85'][Math.floor(Math.random() * 9)];
        const num = Math.floor(900000000 + Math.random() * 99999999);
        return `(${ddd}) 9${String(num).slice(0, 4)}-${String(num).slice(4, 8)}`;
    }
};
