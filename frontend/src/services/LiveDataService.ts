import Station from "../classes/Station";
import StationData from "../classes/StationData";
import { fetchAndParseCSV, parseOptionalFloat, replaceInvalidWithUndefined } from './utils/csvUtils.js';
import { buildUrl } from './utils/serviceUtils.js';
import { getNow } from "../utils/dateUtils";
import { ACTIVE_COUNTRY_PROFILE } from '../config/countryProfiles.js';

export interface LiveStationRecord {
    station: Station;
    data: StationData;
}

export interface LiveDataResponse {
    stations: Record<string, Station>;
    stationData: Record<string, StationData>;
}

/**
 * Service to fetch weather stations data from CSV file
 * 
 * Example CSV data:
 * 
 * station_id,station_name,data_date,elevation,lat,lon,humidity,max_temperature,min_temperature,temperature
 * 3137,Mainz-Lerchenberg (ZDF),20.10.2025 22:20,199,49.9658,8.2049,88.2,14.4,8.9,12.9
 * 3147,Mallersdorf-Pfaffenberg-Oberlindhart,20.10.2025 22:20,390,48.7548,12.2118,82.7,13.5,3.6,9.3
 * 3155,Manderscheid-Sonnenhof,20.10.2025 22:20,415,50.1015,6.8009,99.1,14.5,9.2,9.9
 * 3158,Manschnow,20.10.2025 22:20,12,52.5468,14.5453,70.6,13.0,-0.3,9.4
 * 3164,"Cölbe, Kr. Marburg-Biedenkopf",20.10.2025 22:20,187,50.8492,8.7745,87.4,,,-999
 * 3166,Marienberg,20.10.2025 22:20,639,50.6511,13.1469,77.0,10.8,2.7,6.8
 * 3167,"Marienberg, Bad",20.10.2025 22:20,547,50.6621,7.9603,94.3,11.3,7.9,10.9
 * 3181,Markt Erlbach-Hagenhofen,20.10.2025 22:20,360,49.4875,10.6277,99.1,13.6,4.4,6.3
 * 
 * @returns {Promise<Array>} Array of station data objects
 */
export const fetchLiveData = async (): Promise<LiveDataResponse> => {
    const parseLiveRows = (rows: string[][]): LiveDataResponse => {
        const stations: Record<string, Station> = {};
        const stationData: Record<string, StationData> = {};

        for (const [stationId, stationName, date, elevationRaw, latRaw, lonRaw, humidityRaw, maxTemperatureRaw, minTemperatureRaw, temperatureRaw] of rows) {
            if (!stationId || !stationName || !date) continue;

            const elevation = parseOptionalFloat(elevationRaw);
            const lat = parseOptionalFloat(latRaw);
            const lon = parseOptionalFloat(lonRaw);

            if (elevation === undefined || lat === undefined || lon === undefined) continue;

            const cleanedStationName = stationName.replace(/^"|"$/g, '');

            stations[stationId] = new Station(
                stationId,
                cleanedStationName,
                elevation,
                lat,
                lon
            );

            stationData[stationId] = new StationData(
                stationId,
                date,
                replaceInvalidWithUndefined(parseOptionalFloat(temperatureRaw)),
                replaceInvalidWithUndefined(parseOptionalFloat(minTemperatureRaw)),
                replaceInvalidWithUndefined(parseOptionalFloat(maxTemperatureRaw)),
                replaceInvalidWithUndefined(parseOptionalFloat(humidityRaw))
            );
        }

        return { stations, stationData };
    };

    const baseDate = getNow();
    const lookbackDays = 3;
    let lastError: unknown = null;

    for (let offset = 0; offset <= lookbackDays; offset += 1) {
        const candidateDate = baseDate.minus({ days: offset });
        const yearMonthDay = candidateDate.toFormat('yyyyLLdd');
        const dataPath = `${ACTIVE_COUNTRY_PROFILE.dataRoot}/station_data/10min_station_data_${yearMonthDay}.csv`;

        try {
            return await fetchAndParseCSV<LiveDataResponse>(
                buildUrl(dataPath, true, 'yyyyLLddHH'),
                parseLiveRows,
                {
                    validateHeaders: ['station_id', 'station_name', 'data_date', 'elevation', 'lat', 'lon', 'humidity', 'max_temperature', 'min_temperature', 'temperature'],
                    errorContext: `live station data (${yearMonthDay})`
                }
            );
        } catch (error) {
            lastError = error;
            const message = error instanceof Error ? error.message : '';
            const isNotFound = message.includes('404');
            const hasMissingHeaders = message.includes('Missing required headers');
            if (!isNotFound && !hasMissingHeaders) {
                throw error;
            }
        }
    }

    throw (lastError instanceof Error ? lastError : new Error('Failed to load live station data.'));
};