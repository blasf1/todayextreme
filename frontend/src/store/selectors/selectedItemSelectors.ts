import { createSelector } from '@reduxjs/toolkit';
import type { RootState } from '../index.js';
import City from '../../classes/City.js';
import Station from '../../classes/Station.js';
import StationData from '../../classes/StationData.js';
import { DateTime } from 'luxon';
import { getNow } from '../../utils/dateUtils.js';

/**
 * Granular selectors for selected item data.
 * Each selector returns a specific piece of data, allowing components to subscribe
 * only to what they need, improving performance and developer experience.
 */

// ============================================================================
// Base selectors (direct state access)
// ============================================================================

/**
 * Select the currently selected city ID
 */
export const selectSelectedCityId = (state: RootState): string | null => {
    return state.selectedCity.cityId;
};

/**
 * Select the selected date (ISO string)
 */
export const selectSelectedDate = (state: RootState): string => {
    return state.selectedDate.value;
};

/**
 * Select city data status
 */
export const selectCityDataStatus = (state: RootState) => {
    return state.cityData.status;
};

/**
 * Select all cities (JSON format)
 */
const selectCitiesJSON = (state: RootState) => {
    return state.cityData.data;
};

/**
 * Select all stations (JSON format)
 */
const selectStationsJSON = (state: RootState) => {
    const liveDataResponse = state.liveData.data;
    return liveDataResponse?.stations;
};

/**
 * Select live station data (JSON format)
 */
const selectLiveStationDataJSON = (state: RootState) => {
    const liveDataResponse = state.liveData.data;
    return liveDataResponse?.stationData;
};

/**
 * Select daily-by-date station data keyed by YYYY-MM-DD
 */
const selectDailyRecentByDateData = (state: RootState) => {
    return state.dailyRecentByDate.data as Record<string, Record<string, any>> | undefined;
};

/**
 * Select historical data for all stations
 */
const selectHistoricalDataByStation = (state: RootState) => {
    // The factory returns data directly for keyed state
    return state.historicalDailyData.data as Record<string, Record<string, any>> | undefined;
};

// ============================================================================
// Derived selectors (memoized computations)
// ============================================================================

/**
 * Select the station ID for the currently selected city
 */
const SPAIN_CITY_STATION_OVERRIDES: Record<string, string> = {
    albacete: '8175',
};

export const selectSelectedStationId = createSelector(
    [selectSelectedCityId, selectCitiesJSON, selectStationsJSON],
    (cityId, cities, stations): string | null => {
        if (!cityId || !cities) return null;

        const city = cities[cityId];
        if (!city) return null;

        if (city.stationId) {
            return city.stationId;
        }

        const normalizedName = String(city.name ?? '').trim().toLowerCase();
        const overrideStationId = SPAIN_CITY_STATION_OVERRIDES[normalizedName] ?? null;
        if (overrideStationId) {
            return overrideStationId;
        }

        if (!stations) {
            return null;
        }

        const cityLat = Number(city.lat);
        const cityLon = Number(city.lon);
        if (!Number.isFinite(cityLat) || !Number.isFinite(cityLon)) {
            return null;
        }

        // Last-resort fallback: choose nearest station from loaded station metadata.
        const toRad = (value: number): number => (value * Math.PI) / 180;
        const haversineKm = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
            const r = 6371;
            const dLat = toRad(lat2 - lat1);
            const dLon = toRad(lon2 - lon1);
            const a = Math.sin(dLat / 2) ** 2
                + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
            return 2 * r * Math.asin(Math.sqrt(a));
        };

        let nearestId: string | null = null;
        let nearestDistance = Number.POSITIVE_INFINITY;

        for (const [stationId, station] of Object.entries(stations)) {
            const stationLat = Number((station as any).lat);
            const stationLon = Number((station as any).lon);
            if (!Number.isFinite(stationLat) || !Number.isFinite(stationLon)) {
                continue;
            }

            const distance = haversineKm(cityLat, cityLon, stationLat, stationLon);
            if (distance < nearestDistance) {
                nearestDistance = distance;
                nearestId = stationId;
            }
        }

        return nearestId;
    }
);

/**
 * Select the currently selected city as a City instance
 */
export const selectSelectedCity = createSelector(
    [selectSelectedCityId, selectCitiesJSON, selectCityDataStatus],
    (cityId, cities, status): City | null => {
        if (status !== 'succeeded' || !cityId || !cities) return null;
        const cityJSON = cities[cityId];
        if (!cityJSON) return null;
        return City.fromJSON(cityJSON);
    }
);

/**
 * Select the station for the currently selected city as a Station instance
 */
export const selectSelectedStation = createSelector(
    [selectSelectedStationId, selectStationsJSON, selectCityDataStatus],
    (stationId, stations, status): Station | null => {
        if (status !== 'succeeded' || !stationId) return null;

        const stationJSON = stations?.[stationId];
        if (stationJSON) {
            return Station.fromJSON(stationJSON);
        }

        // Fallback: keep selection usable even if live station metadata is temporarily unavailable.
        return new Station(stationId, stationId, 0, 0, 0);
    }
);

/**
 * Select whether we're looking at today's data
 */
export const selectIsToday = createSelector(
    [selectSelectedDate],
    (selectedDate): boolean => {
        const selectedDateLuxon = DateTime.fromISO(selectedDate);
        return getNow().hasSame(selectedDateLuxon, 'day');
    }
);

/**
 * Select the station data for the currently selected station
 * Handles both live data (today) and historical data (past dates)
 */
export const selectSelectedStationData = createSelector(
    [
        selectSelectedStationId,
        selectSelectedDate,
        selectIsToday,
        selectDailyRecentByDateData,
        selectLiveStationDataJSON,
        selectHistoricalDataByStation,
        selectCityDataStatus,
    ],
    (stationId, selectedDate, isToday, dailyByDateData, liveData, historicalData, status): StationData | null => {
        if (status !== 'succeeded' || !stationId) return null;

        const toStationDataFromDaily = (dailyForDate: any): StationData => {
            return new StationData(
                stationId,
                dailyForDate.date,
                dailyForDate.meanTemperature,
                dailyForDate.minTemperature,
                dailyForDate.maxTemperature,
                dailyForDate.meanHumidity,
            );
        };

        const getLatestAvailableDailyForStation = (): any | null => {
            if (!dailyByDateData) return null;

            const dateKeys = Object.keys(dailyByDateData).sort();
            for (let i = dateKeys.length - 1; i >= 0; i -= 1) {
                const byStation = dailyByDateData[dateKeys[i]];
                const candidate = byStation?.[stationId];
                if (candidate) return candidate;
            }

            return null;
        };

        const getLatestAvailableHistoricalForStation = (): any | null => {
            const stationHistoricalData = historicalData?.[stationId];
            if (!stationHistoricalData) return null;

            const historicalKeys = Object.keys(stationHistoricalData).sort();
            if (historicalKeys.length === 0) return null;

            return stationHistoricalData[historicalKeys[historicalKeys.length - 1]] ?? null;
        };

        const toStationDataFromHistorical = (entry: any): StationData => {
            return new StationData(
                stationId,
                entry.date,
                entry.meanTemperature,
                entry.minTemperature,
                entry.maxTemperature,
                entry.meanHumidity,
            );
        };

        if (isToday) {
            // Use live data for today so "Latest" stays a true latest observation.
            const liveStationData = liveData?.[stationId];
            if (liveStationData) {
                return StationData.fromJSON(liveStationData);
            }

            // Fallback: if live data is missing, use daily-by-date aggregate if present.
            const selectedDateLuxon = DateTime.fromISO(selectedDate);
            const dateKey = selectedDateLuxon.toFormat('yyyy-MM-dd');
            const dailyForDate = dailyByDateData?.[dateKey]?.[stationId];
            if (dailyForDate) {
                return toStationDataFromDaily(dailyForDate);
            }

            // Last-resort fallback: use most recent available daily record for this station.
            const latestDaily = getLatestAvailableDailyForStation();
            if (latestDaily) {
                return toStationDataFromDaily(latestDaily);
            }

            const latestHistorical = getLatestAvailableHistoricalForStation();
            if (latestHistorical) {
                return toStationDataFromHistorical(latestHistorical);
            }

            return null;
        } else {
            // For non-today dates, prefer daily-by-date aggregate when available.
            const selectedDateLuxon = DateTime.fromISO(selectedDate);
            const dateKey = selectedDateLuxon.toFormat('yyyy-MM-dd');
            const dailyForDate = dailyByDateData?.[dateKey]?.[stationId];
            if (dailyForDate) {
                return toStationDataFromDaily(dailyForDate);
            }

            // Fallback to historical-by-station data for past dates.
            const stationHistoricalData = historicalData?.[stationId];
            if (!stationHistoricalData) return null;

            const selectedDateYYYYMMDD = selectedDateLuxon.toFormat('yyyyLLdd');
            const matchingEntry = stationHistoricalData[selectedDateYYYYMMDD];

            if (!matchingEntry) return null;

            return new StationData(
                stationId,
                matchingEntry.date,
                matchingEntry.meanTemperature,
                matchingEntry.minTemperature,
                matchingEntry.maxTemperature,
                matchingEntry.meanHumidity,
            );
        }
    }
);

/**
 * Select the complete selected item (city, station, data)
 * This is a convenience selector that combines all three.
 */
export interface SelectedItem {
    city: City;
    station: Station;
    data: StationData;
}

export const selectSelectedItem = createSelector(
    [selectSelectedCity, selectSelectedStation, selectSelectedStationData],
    (city, station, data): SelectedItem | null => {
        if (!city || !station) return null;

        if (data) {
            return { city, station, data };
        }

        // Preserve selected city/station context even when measurement feeds are missing.
        return {
            city,
            station,
            data: new StationData(station.id, '', undefined, undefined, undefined, undefined),
        };
    }
);

/**
 * Returns just the selected city name (or null)
 */
export const selectSelectedCityName = createSelector(
    [selectSelectedCity],
    (city): string | null => city?.name ?? null
);

/**
 * Returns just the selected station name (or null)
 */
export const selectSelectedStationName = createSelector(
    [selectSelectedStation],
    (station): string | null => station?.name ?? null
);
