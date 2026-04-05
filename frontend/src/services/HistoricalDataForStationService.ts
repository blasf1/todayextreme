import DateRange from "../classes/DateRange";
import DailyRecentByStation from "../classes/DailyRecentByStation";
import { fetchAndParseCSV, parseOptionalFloat, replaceInvalidWithUndefined } from './utils/csvUtils.js';
import { buildUrl } from './utils/serviceUtils.js';
import { ACTIVE_COUNTRY_PROFILE } from '../config/countryProfiles.js';

/**
 * Service to fetch daily weather station data from CSV file
 * 
 * Example CSV data:
 * 
 * date,temperature_mean,temperature_min,temperature_max,humidity_mean
 * 20250101,5.1,0.1,9.1,64.00
 * 20250102,4.2,0.0,9.0,78.00
 * 20250103,1.3,-1.3,3.6,-999
 * 20250104,-999,-4.5,0.5,84.00
 * 20250105,-1.5,-5.3,3.6,89.00
 *
 * @param {string} stationId - station ID of a station to fetch data for
 * @returns {Promise<{data: {[date: string]: DailyRecentByStation}, dateRange: DateRange}>} Historical data for station
 */
export interface DailyWeatherStationDataResponse {
    data: Record<string, DailyRecentByStation>;
    dateRange: DateRange;
}

export const fetchDailyWeatherStationData = async (stationId: string): Promise<DailyWeatherStationDataResponse> => {
    const dataPath = `${ACTIVE_COUNTRY_PROFILE.dataRoot}/daily_recent_by_station/${stationId}.csv`;

    return fetchAndParseCSV<DailyWeatherStationDataResponse>(
        buildUrl(dataPath, true, 'yyyyLLddHH'),
        (rows) => {
            if (rows.length === 0) {
                throw new Error(`No data found for station ${stationId}.`);
            }

            const earliestDate = rows[0]?.[0]?.trim();
            const latestDate = rows[rows.length - 1]?.[0]?.trim();

            if (!earliestDate || !latestDate) {
                throw new Error(`Invalid date range found for station ${stationId}: ${earliestDate} - ${latestDate}.`);
            }

            const data = rows
                .map(([dateRaw, temperatureMeanRaw, temperatureMinRaw, temperatureMaxRaw, humidityMeanRaw]) => {
                    if (!dateRaw) return null;

                    return new DailyRecentByStation(
                        stationId,
                        dateRaw,
                        replaceInvalidWithUndefined(parseOptionalFloat(temperatureMeanRaw)),
                        replaceInvalidWithUndefined(parseOptionalFloat(temperatureMinRaw)),
                        replaceInvalidWithUndefined(parseOptionalFloat(temperatureMaxRaw)),
                        replaceInvalidWithUndefined(parseOptionalFloat(humidityMeanRaw))
                    );
                })
                .filter((item): item is DailyRecentByStation => Boolean(item));

            if (!data.length) {
                throw new Error(`No historical data found for station ${stationId}.`);
            }

            const result: Record<string, DailyRecentByStation> = Object.fromEntries(
                data.map(item => [item.date, item])
            );

            return {
                data: result,
                dateRange: new DateRange(earliestDate, latestDate)
            };
        },
        {
            validateHeaders: ['date', 'temperature_mean', 'temperature_min', 'temperature_max', 'humidity_mean'],
            errorContext: `daily weather station data for ${stationId}`
        }
    );
};