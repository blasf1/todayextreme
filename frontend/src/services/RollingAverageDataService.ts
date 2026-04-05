import { RollingAverageRecordBuilder, type RollingAverageRecordList } from '../classes/RollingAverageRecord';
import { fetchAndParseCSV, parseOptionalFloat } from './utils/csvUtils.js';
import { buildUrl } from './utils/serviceUtils.js';
import { ACTIVE_COUNTRY_PROFILE } from '../config/countryProfiles.js';

/**
 * Fetch rolling average climate metrics for a specific station.
 * 
 * Example CSV data:
 * 
 * date,tas
 * 1951-01-01,0.9
 * 1951-01-02,1.24
 * 1951-01-03,1.23
 * 1951-01-04,1.71
 * 1951-01-05,1.98
 * 1951-01-06,2.12
 * 1951-01-07,2.28
 * 1951-01-08,2.35
 * 1951-01-09,2.69
 * 1951-01-10,3.04
 * 1951-01-11,3.41
 * 1951-01-12,3.7
 * 
 * @param {string} stationId - Station ID to fetch rolling average data for
 * @returns {Promise<RollingAverageRecordList>} Rolling average data for the station
 */
export const fetchRollingAverageForStation = async (stationId: string): Promise<RollingAverageRecordList> => {
    return fetchAndParseCSV<RollingAverageRecordList>(
        buildUrl(`${ACTIVE_COUNTRY_PROFILE.dataRoot}/rolling_average/1951_2024/daily/${stationId}_1951-2024_avg_7d.csv`, false),
        (rows, headers) => {
            if (!headers || headers.length === 0 || headers[0] !== 'date') {
                throw new Error(`Unexpected header format for rolling average data of ${stationId}.`);
            }

            const records: RollingAverageRecordList = [];

            for (const columns of rows) {
                const dateRaw = columns[0];
                if (!dateRaw) continue;

                const builder = new RollingAverageRecordBuilder().setDate(dateRaw);

                for (let columnIndex = 1; columnIndex < headers.length; columnIndex += 1) {
                    const metric = headers[columnIndex];
                    if (!metric || columnIndex >= columns.length) continue;

                    const value = parseOptionalFloat(columns[columnIndex]);
                    builder.setMetric(metric, value);
                }

                const record = builder.build();
                if (record) {
                    records.push(record.toJSON());
                }
            }

            if (records.length === 0) {
                throw new Error(`No data found for ${stationId} from 1951 to 2024.`);
            }

            return records;
        },
        {
            validateHeaders: ['date'],
            errorContext: `rolling average data for station ${stationId}`
        }
    );
};