import {
    ReferenceYearlyHourlyInterpolatedByDayBuilder,
    type ReferenceHourKey,
    type ReferenceYearlyHourlyInterpolatedByDayByStationId,
} from '../classes/ReferenceYearlyHourlyInterpolatedByDay';
import { fetchAndParseCSV, parseOptionalFloat } from './utils/csvUtils.js';
import { buildUrl } from './utils/serviceUtils.js';
import { ACTIVE_COUNTRY_PROFILE } from '../config/countryProfiles.js';

/**
 * Service to fetch interpolated hourly historical temperature data for a specific day
 * 
 * Example CSV data:
 * 
 * station_id,hour_0,hour_1,hour_2,hour_3,hour_4,hour_5,hour_6,hour_7,hour_8,hour_9,hour_10,hour_11,hour_12,hour_13,hour_14,hour_15,hour_16,hour_17,hour_18,hour_19,hour_20,hour_21,hour_22,hour_23
 * 44,0.23,-0.15,-0.51,-0.84,-1.12,-1.36,-1.53,-1.64,-1.69,-0.66,0.48,1.47,2.24,2.72,2.88,2.84,2.74,2.57,2.34,2.05,1.72,1.36,0.97,0.56
 * 73,-2.69,-3.18,-3.65,-4.07,-4.43,-4.71,-4.92,-5.04,-4.79,-3.32,-1.96,-0.80,0.09,0.64,0.83,0.78,0.64,0.41,0.11,-0.28,-0.72,-1.20,-1.72,-2.26
 * 78,0.38,-0.02,-0.39,-0.73,-1.02,-1.26,-1.44,-1.56,-1.60,-0.50,0.68,1.69,2.46,2.95,3.12,3.08,2.98,2.80,2.56,2.27,1.93,1.55,1.15,0.73
 * 91,-1.22,-1.61,-1.98,-2.31,-2.59,-2.82,-2.99,-3.10,-3.09,-1.90,-0.79,0.16,0.89,1.34,1.50,1.46,1.36,1.18,0.94,0.65,0.31,-0.06,-0.46,-0.88
 * 96,-0.97,-1.35,-1.71,-2.04,-2.33,-2.57,-2.74,-2.85,-2.90,-1.86,-0.71,0.28,1.05,1.53,1.70,1.66,1.56,1.38,1.15,0.85,0.52,0.14,-0.26,-0.67
 * 131,-1.13,-1.53,-1.91,-2.25,-2.54,-2.78,-2.96,-3.06,-3.10,-1.86,-0.71,0.27,1.03,1.51,1.67,1.63,1.52,1.34,1.09,0.79,0.43,0.04,-0.37,-0.80
 * 
 * @param {number} month - month (1-12) to fetch data for
 * @param {number} day - day (1-31) to fetch data for
 * @returns {Promise<ReferenceYearlyHourlyInterpolatedByDayByStationId>} Interpolated hourly data for the specified day 
*/
export const fetchReferenceYearlyHourlyInterpolatedByDayData = async (
    month: number,
    day: number,
): Promise<ReferenceYearlyHourlyInterpolatedByDayByStationId> => {
    const formattedMonth = String(month).padStart(2, '0');
    const formattedDay = String(day).padStart(2, '0');
    const dataPath = `${ACTIVE_COUNTRY_PROFILE.dataRoot}/interpolated_hourly/1961_1990/interpolated_hourly_temperatures_1961_1990_${formattedMonth}_${formattedDay}.csv`;

    try {
        return await fetchAndParseCSV<ReferenceYearlyHourlyInterpolatedByDayByStationId>(
            buildUrl(dataPath, false),
            (rows, headers) => {
                if (!headers || headers.length === 0) {
                    throw new Error(`Missing header for interpolated hourly data of ${formattedMonth}/${formattedDay}.`);
                }

                const result: ReferenceYearlyHourlyInterpolatedByDayByStationId = {};

                for (const values of rows) {
                    const stationId = values[0];
                    if (!stationId) continue;

                    const builder = new ReferenceYearlyHourlyInterpolatedByDayBuilder().setStationId(stationId);

                    for (let columnIndex = 1; columnIndex < headers.length; columnIndex += 1) {
                        const columnName = headers[columnIndex];
                        const hourKey = parseHourKey(columnName);

                        if (!hourKey || columnIndex >= values.length) continue;

                        const value = parseOptionalFloat(values[columnIndex]);
                        builder.setHourValue(hourKey, value);
                    }

                    const record = builder.build();
                    if (record) {
                        result[stationId] = record.toJSON();
                    }
                }

                if (Object.keys(result).length === 0) {
                    throw new Error(`No hourly data rows parsed for day ${formattedMonth}/${formattedDay}.`);
                }

                return result;
            },
            {
                validateHeaders: ['station_id'],
                errorContext: `interpolated hourly data for ${formattedMonth}/${formattedDay}`
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
            console.warn(`Missing interpolated hourly data for ${formattedMonth}/${formattedDay}; continuing with empty fallback.`);
            return {};
        }

        throw error;
    }
};

const parseHourKey = (value: string | undefined): ReferenceHourKey | null => {
    if (!value) return null;

    const match = /^hour_(\d{1,2})$/.exec(value);
    if (!match) return null;

    const hour = Number.parseInt(match[1] ?? '', 10);
    if (Number.isNaN(hour) || hour < 0 || hour > 23) return null;

    return value as ReferenceHourKey;
};