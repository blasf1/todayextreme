import { v4 as uuidv4 } from 'uuid';
import City from '../classes/City';
import type { CityDictionary, CityJSON, ICity } from '../classes/City';
import type { IStation } from '../classes/Station';
import { fetchAndParseCSV, parseOptionalFloat, isValidNumber } from './utils/csvUtils.js';
import { buildUrl } from './utils/serviceUtils.js';
import { ACTIVE_COUNTRY_PROFILE, type CountryProfile } from '../config/countryProfiles.js';

const SPAIN_CITY_STATION_OVERRIDES: Record<string, string> = {
    albacete: '8175',
};

/**
 * Service to fetch country-specific cities from CSV file
 * 
 * Example CSV data:
 * 
 * city_name,lat,lon
 * Zwönitz,50.63027,12.80999
 * Zella-Mehlis,50.65642,10.66046
 * Bad Wünnenberg,51.52002,8.69934
 * Süßen,48.67934,9.75534
 * Brake (Unterweser),53.33333,8.48333
 * Wilhelmitor - Nord,52.2592,10.49848
 * 
 * @returns {Promise<Array>} Array of city data objects
 */
export const fetchCountryCities = async (countryProfile: CountryProfile = ACTIVE_COUNTRY_PROFILE): Promise<City[]> => {
    return fetchAndParseCSV<City[]>(
        buildUrl(countryProfile.cityDataPath, false),
        (rows) => {
            const cities: City[] = [];

            for (const [nameRaw, latRaw, lonRaw] of rows) {
                if (!nameRaw || !latRaw || !lonRaw) continue;

                const lat = parseOptionalFloat(latRaw);
                const lon = parseOptionalFloat(lonRaw);

                if (!isValidNumber(lat, -90, 90) || !isValidNumber(lon, -180, 180)) {
                    continue;
                }

                cities.push(new City(uuidv4(), nameRaw.trim(), lat!, lon!));
            }

            return cities;
        },
        {
            validateHeaders: ['city_name', 'lat', 'lon'],
            errorContext: `${countryProfile.label} cities`
        }
    );
};

export const fetchGermanCities = async (): Promise<City[]> => {
    return fetchCountryCities();
};

/**
 * Calculates the distance between two points in kilometers using the Haversine formula
 * @param {number} lat1 - Latitude of the first point
 * @param {number} lon1 - Longitude of the first point
 * @param {number} lat2 - Latitude of the second point
 * @param {number} lon2 - Longitude of the second point
 * @returns {number} Distance in kilometers
 */
export const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
    const R = 6371; // Radius of the Earth in km
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
        Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
};

/**
 * Finds the nearest weather station for each city
 * @param {Array} cities - Dictionary of city objects keyed by id
 * @param {Object} stations - Dictionary of stationId -> station
 * @returns {Array} Cities with nearest station information
 */
export const findClosestWeatherStationsForCities = (
    cities: Record<string, ICity | City>,
    stations: Record<string, IStation>,
): CityDictionary => {
    const stationList = Object.values(stations).filter((station): station is IStation =>
        Number.isFinite(station.lat) && Number.isFinite(station.lon)
    );

    if (stationList.length === 0) {
        console.warn("No stations available to find nearest for cities");

        // Keep explicit city-to-station overrides even when station metadata is unavailable.
        const fallbackResult: CityDictionary = {};
        for (const cityLike of Object.values(cities)) {
            const city = cityLike instanceof City ? cityLike : toCityInstance(cityLike);
            if (ACTIVE_COUNTRY_PROFILE.id === 'spain') {
                const normalizedCityName = city.name.trim().toLowerCase();
                const forcedStationId = SPAIN_CITY_STATION_OVERRIDES[normalizedCityName];
                if (forcedStationId) {
                    fallbackResult[city.id] = new City(
                        city.id,
                        city.name,
                        city.lat,
                        city.lon,
                        forcedStationId,
                        city.distanceToStation,
                    );
                    continue;
                }
            }

            fallbackResult[city.id] = city;
        }

        return fallbackResult;
    }

    const result: CityDictionary = {};

    for (const cityLike of Object.values(cities)) {
        const city = cityLike instanceof City ? cityLike : toCityInstance(cityLike);

        if (ACTIVE_COUNTRY_PROFILE.id === 'spain') {
            const normalizedCityName = city.name.trim().toLowerCase();
            const forcedStationId = SPAIN_CITY_STATION_OVERRIDES[normalizedCityName];
            const forcedStation = forcedStationId ? stations[forcedStationId] : undefined;

            if (forcedStation && Number.isFinite(forcedStation.lat) && Number.isFinite(forcedStation.lon)) {
                const forcedDistance = calculateDistance(city.lat, city.lon, forcedStation.lat, forcedStation.lon);
                result[city.id] = city.withNearestStation(forcedStation.id, forcedDistance);
                continue;
            }
        }

        let nearestStation: IStation | null = null;
        let minDistance = Number.POSITIVE_INFINITY;

        for (const station of stationList) {
            const distance = calculateDistance(city.lat, city.lon, station.lat, station.lon);
            if (distance < minDistance) {
                minDistance = distance;
                nearestStation = station;
            }
        }

        if (!nearestStation) {
            result[city.id] = city;
            continue;
        }

        result[city.id] = city.withNearestStation(nearestStation.id, minDistance);
    }

    return result;
};

const toCityInstance = (city: ICity | CityJSON): City => {
    if (city instanceof City) {
        return city;
    }

    return new City(
        city.id,
        city.name,
        city.lat,
        city.lon,
        city.stationId ?? undefined,
        city.distanceToStation ?? undefined,
    );
};