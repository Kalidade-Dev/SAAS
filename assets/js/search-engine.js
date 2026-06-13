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

        // Verificar presença digital de forma precisa
        results = await this.verifyDigitalPresence(results);

        return this.applyFilters(results, filters);
    },

    async verifyDigitalPresence(results) {
        const verified = [];
        const batchSize = 12;

        for (let i = 0; i < results.length; i += batchSize) {
            const batch = results.slice(i, i + batchSize);
            const checks = batch.map(async (est) => {
                const checked = { ...est };

                if (est.website) {
                    try {
                        const controller = new AbortController();
                        const timeout = setTimeout(() => controller.abort(), 2500);
                        const res = await fetch(est.website, {
                            method: 'HEAD',
                            mode: 'no-cors',
                            signal: controller.signal
                        });
                        clearTimeout(timeout);
                        // no-cors sempre retorna opaque, mas se não deu error o site existe
                        checked.hasWebsite = true;
                    } catch {
                        checked.hasWebsite = false;
                        checked.website = null;
                    }
                }

                // Validar telefone brasileiro
                if (est.phone) {
                    let digits = est.phone.replace(/\D/g, '');
                    // Remover código de país +55 se presente
                    if (digits.startsWith('55') && digits.length > 11) {
                        digits = digits.slice(2);
                    }
                    // Telefone válido: 10 ou 11 dígitos, começa com DDD válido
                    const ddd = parseInt(digits.slice(0, 2));
                    const validDDD = digits.length >= 2 && ddd >= 11 && ddd <= 99;
                    const validLength = digits.length === 10 || digits.length === 11;
                    checked.hasPhone = validDDD && validLength;
                    if (!checked.hasPhone) {
                        // Mantém o telefone mesmo que formato não seja padrão
                        checked.phone = est.phone;
                    }
                } else {
                    checked.hasPhone = false;
                }

                // Verificar se tem endereço real
                checked.hasAddress = !!(est.address && est.address.length > 5);

                return checked;
            });

            const batchResults = await Promise.all(checks);
            verified.push(...batchResults);
        }

        return verified;
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
        // Buscar via Nominatim (nome e tipo)
        let nominatimResults = await this.searchNominatimPlaces(location, category);

        // SEMPRE buscar dados detalhados via Overpass (telefone, site, redes sociais)
        let overpassResults = [];
        try {
            overpassResults = await this.searchOverpass(location, category, radius);
        } catch (err) {
            console.warn('Overpass indisponível, usando apenas Nominatim:', err.message);
        }

        // Merge: Overpass tem dados mais completos, mas Nominatim pode ter alguns exclusivos
        const results = this.mergeResults(nominatimResults, overpassResults);

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
        const query = this.buildOverpassQuery(location, radius, tags);

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
            const key = this.resultKey(item);
            if (!map.has(key)) {
                map.set(key, item);
                continue;
            }

            const current = map.get(key);
            map.set(key, this.mergeBusinessData(current, item));
        }

        return Array.from(map.values())
            .sort((x, y) => this.dataCompletenessScore(y) - this.dataCompletenessScore(x));
    },

    resultKey(item) {
        const cleanName = (item.name || '')
            .toLowerCase()
            .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
            .replace(/[^a-z0-9]+/g, ' ')
            .trim();
        const lat = Number(item.latitude || 0).toFixed(3);
        const lng = Number(item.longitude || 0).toFixed(3);
        return `${cleanName}-${lat}-${lng}`;
    },

    mergeBusinessData(base, incoming) {
        const richerFirst = this.dataCompletenessScore(incoming) > this.dataCompletenessScore(base)
            ? [incoming, base]
            : [base, incoming];

        const [primary, fallback] = richerFirst;
        return {
            ...fallback,
            ...primary,
            name: primary.name || fallback.name,
            category: primary.category || fallback.category,
            address: primary.address || fallback.address,
            city: primary.city || fallback.city,
            state: primary.state || fallback.state,
            phone: primary.phone || fallback.phone,
            website: primary.website || fallback.website,
            hasWebsite: Boolean(primary.website || fallback.website || primary.hasWebsite || fallback.hasWebsite),
            hasMapsLocation: Boolean(primary.hasMapsLocation || fallback.hasMapsLocation),
            mapsUrl: primary.mapsUrl || fallback.mapsUrl,
            latitude: primary.latitude || fallback.latitude,
            longitude: primary.longitude || fallback.longitude,
            instagram: primary.instagram || fallback.instagram,
            facebook: primary.facebook || fallback.facebook,
            whatsapp: primary.whatsapp || fallback.whatsapp,
            email: primary.email || fallback.email,
            openingHours: primary.openingHours || fallback.openingHours,
            postcode: primary.postcode || fallback.postcode,
        };
    },

    dataCompletenessScore(item) {
        let score = 0;
        if (item.phone) score += 8;
        if (item.website) score += 8;
        if (item.facebook) score += 5;
        if (item.instagram) score += 5;
        if (item.whatsapp) score += 5;
        if (item.email) score += 4;
        if (item.address) score += 4;
        if (item.openingHours) score += 2;
        if (item.mapsUrl) score += 1;
        return score;
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

    buildOverpassQuery(location, radius, tags) {
        const conditions = [];
        const hasBbox = Array.isArray(location.bbox) && location.bbox.length === 4;
        const bbox = hasBbox
            ? `(${location.bbox[0]},${location.bbox[2]},${location.bbox[1]},${location.bbox[3]})`
            : null;

        for (const tag of tags) {
            for (const value of tag.v) {
                if (bbox) {
                    conditions.push(`node["${tag.k}"="${value}"]${bbox};`);
                    conditions.push(`way["${tag.k}"="${value}"]${bbox};`);
                    conditions.push(`relation["${tag.k}"="${value}"]${bbox};`);
                } else {
                    conditions.push(`node["${tag.k}"="${value}"](around:${radius},${location.lat},${location.lng});`);
                    conditions.push(`way["${tag.k}"="${value}"](around:${radius},${location.lat},${location.lng});`);
                    conditions.push(`relation["${tag.k}"="${value}"](around:${radius},${location.lat},${location.lng});`);
                }
            }
        }
        return `[out:json][timeout:35];(${conditions.join('')});out center tags;`;
    },

    normalizeOsmElement(el, location) {
        const tags = el.tags || {};
        const lat = el.lat ?? el.center?.lat;
        const lng = el.lon ?? el.center?.lon;

        // Website: prioriza o site real, depois considera redes sociais
        const website = tags.website || tags['contact:website'] || tags.url || null;
        const facebook = tags['contact:facebook'] || tags.facebook || null;
        const instagram = tags['contact:instagram'] || tags.instagram || null;
        const whatsapp = tags['contact:whatsapp'] || tags.whatsapp || null;
        const email = tags.email || tags['contact:email'] || null;
        const phone = tags.phone || tags['contact:phone'] || tags['contact:mobile'] || null;
        const openingHours = tags.opening_hours || null;

        // Endereço completo
        const street = tags['addr:street'] || '';
        const housenumber = tags['addr:housenumber'] || '';
        const postcode = tags['addr:postcode'] || '';
        const suburb = tags['addr:suburb'] || '';
        const addressParts = [street, housenumber].filter(Boolean);
        if (suburb && !street) addressParts.push(suburb);
        const address = addressParts.join(', ') || null;

        // Cidade com mais fontes
        const city = tags['addr:city'] || location.city || '';
        const state = tags['addr:state'] || location.state || '';

        // Google Maps
        const hasGoogleMaps = !!(tags['contact:google_maps'] || tags.google_maps || tags['ref:google']);
        const mapsUrl = lat && lng
            ? `https://www.openstreetmap.org/?mlat=${lat}&mlon=${lng}#map=18/${lat}/${lng}`
            : null;

        return {
            id: `osm-${el.type}-${el.id}`,
            name: tags.name,
            category: this.humanCategory(tags),
            address: address || '',
            city,
            state,
            phone: phone ? this.formatPhone(phone) : null,
            website: website ? this.normalizeUrl(website) : null,
            hasWebsite: !!website,
            hasMapsLocation: hasGoogleMaps,
            mapsUrl: mapsUrl || '',
            latitude: lat,
            longitude: lng,
            instagram: instagram || null,
            facebook: facebook || null,
            whatsapp: whatsapp || null,
            email: email || null,
            openingHours,
            rating: null,
            totalReviews: 0,
            postcode: postcode || null,
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
        if (!filters) return results;
        let filtered = [...results];
        if (filters.noWebsite) filtered = filtered.filter(e => !e.hasWebsite);
        if (filters.noMaps) filtered = filtered.filter(e => !e.hasMapsLocation);
        if (filters.noPhone) filtered = filtered.filter(e => !e.phone);
        if (filters.bothMissing) filtered = filtered.filter(e => !e.hasWebsite && !e.hasMapsLocation);
        return filtered;
    },

    formatPhone(phone) {
        let digits = phone.replace(/\D/g, '');
        // Remove código internacional +55 ou 55
        if (digits.startsWith('55') && digits.length >= 12) {
            digits = digits.slice(2);
        }
        if (digits.length === 11) return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
        if (digits.length === 10) return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
        // Retorna o original formatado manualmente se possível
        if (digits.length >= 8) return phone;
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
