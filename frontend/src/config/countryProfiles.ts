export type CountryId = 'germany' | 'netherlands' | 'spain';

export interface CountryProfile {
    readonly id: CountryId;
    readonly label: string;
    readonly defaultCityQuery: string;
    readonly predefinedCities: readonly string[];
    readonly cityDataPath: string;
    readonly boundaryGeoJsonPath: string;
    readonly dataRoot: string;
}

const COUNTRY_PROFILES: Record<CountryId, CountryProfile> = {
    germany: {
        id: 'germany',
        label: 'Germany',
        defaultCityQuery: 'berlin',
        predefinedCities: [
            'Berlin',
            'Hamburg',
            'München',
            'Köln',
            'Frankfurt am Main',
            'Düsseldorf',
            'Stuttgart',
            'Leipzig',
            'Dortmund',
            'Bremen',
        ],
        cityDataPath: '/german_cities_p5000.csv',
        boundaryGeoJsonPath: '/eu.geojson',
        dataRoot: '/data',
    },
    netherlands: {
        id: 'netherlands',
        label: 'Netherlands',
        defaultCityQuery: 'amsterdam',
        predefinedCities: [
            'Amsterdam',
            'Rotterdam',
            'Den Haag',
            'Utrecht',
            'Eindhoven',
            'Groningen',
            'Tilburg',
            'Almere',
            'Breda',
            'Nijmegen',
        ],
        cityDataPath: '/netherlands_cities_p5000.csv',
        boundaryGeoJsonPath: '/eu.geojson',
        dataRoot: '/data/netherlands',
    },
    spain: {
        id: 'spain',
        label: 'Spain',
        defaultCityQuery: 'albacete',
        predefinedCities: [
            'Madrid',
            'Barcelona',
            'Valencia',
            'Sevilla',
            'Zaragoza',
            'Malaga',
            'Murcia',
            'Palma',
            'Bilbao',
            'Alicante',
            'Albacete',
        ],
        cityDataPath: '/spanish_cities_p5000.csv',
        boundaryGeoJsonPath: '/eu.geojson',
        dataRoot: '/data/spain',
    },
};

const COUNTRY_ALIASES: Record<string, CountryId> = {
    de: 'germany',
    germany: 'germany',
    nl: 'netherlands',
    netherlands: 'netherlands',
    es: 'spain',
    spain: 'spain',
};

const normalizeCountryId = (value: string | undefined | null): CountryId | null => {
    if (!value) {
        return null;
    }

    const normalized = value.trim().toLowerCase();
    return COUNTRY_ALIASES[normalized] ?? null;
};

export const getCountryProfile = (countryId: string | undefined | null): CountryProfile => {
    const normalizedCountryId = normalizeCountryId(countryId);
    if (normalizedCountryId) {
        return COUNTRY_PROFILES[normalizedCountryId];
    }

    return COUNTRY_PROFILES.spain;
};

export const getActiveCountryProfile = (): CountryProfile => {
    // EU-first mode: keep one active dataset profile and do not switch by URL/env.
    return COUNTRY_PROFILES.spain;
};

export const ACTIVE_COUNTRY_PROFILE = getActiveCountryProfile();
export const COUNTRY_PROFILES_BY_ID = COUNTRY_PROFILES;
