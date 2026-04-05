import YearlyMeanByDay, { type YearlyMeanByDayByStationId } from '../classes/YearlyMeanByDay';
import { fetchAndParseCSV, parseOptionalFloat } from './utils/csvUtils.js';
import { buildUrl } from './utils/serviceUtils.js';
import { ACTIVE_COUNTRY_PROFILE } from '../config/countryProfiles.js';

/**
 * Service to fetch historical average data for a specific day (month and day)
 * 
 * Example CSV data:
 * 
 * station_id,tasmin,tasmax,tas
 * 1792,-1.4,3.3,1.2
 * 6158,-3.6,1.6,-1.2
 * 4887,-4.0,1.5,-1.6
 * 6263,-3.0,2.6,-0.3
 * 5109,-3.4,1.4,-0.9
 * 3034,-4.5,0.2,-2.3
 * 13710,-4.1,2.4,-1.0
 * 4592,-3.5,1.7,-1.1
 * 
 * @param {number} month - Month (1-12)
 * @param {number} day - Day (1-31)
 * @returns {Promise<YearlyMeanByDayByStationId>} Yearly mean data by station ID
 */
export const fetchYearlyMeanByDayData = async (month: number, day: number): Promise<YearlyMeanByDayByStationId> => {
    const formattedMonth = String(month).padStart(2, '0');
    const formattedDay = String(day).padStart(2, '0');
    const dataPath = `${ACTIVE_COUNTRY_PROFILE.dataRoot}/yearly_mean_by_day/1961_1990/${formattedMonth}_${formattedDay}.csv`;

    try {
        return await fetchAndParseCSV<YearlyMeanByDayByStationId>(
            buildUrl(dataPath, false),
            (rows) => {
                const result: YearlyMeanByDayByStationId = {};

                for (const [stationIdRaw, tasminRaw, tasmaxRaw, tasRaw] of rows) {
                    if (!stationIdRaw) continue;

                    const record = new YearlyMeanByDay(
                        stationIdRaw,
                        parseOptionalFloat(tasminRaw),
                        parseOptionalFloat(tasmaxRaw),
                        parseOptionalFloat(tasRaw),
                    );

                    result[record.stationId] = record.toJSON();
                }

                if (Object.keys(result).length === 0) {
                    throw new Error(`No yearly mean data rows parsed for ${formattedMonth}-${formattedDay}.`);
                }

                return result;
            },
            {
                validateHeaders: ['station_id', 'tasmin', 'tasmax', 'tas'],
                errorContext: `yearly mean data for ${formattedMonth}-${formattedDay}`
            }
        );
    } catch (error) {
        if (
            error instanceof Error
            && (
                error.message.includes('404')
                || error.message.includes('Missing required headers: station_id')
            )
        ) {
            console.warn(`Missing yearly mean data for ${formattedMonth}-${formattedDay}; continuing with empty fallback.`);
            return {};
        }

        throw error;
    }
};