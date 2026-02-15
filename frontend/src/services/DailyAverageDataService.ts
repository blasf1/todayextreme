import { RollingAverageRecordBuilder, type RollingAverageRecordList } from '../classes/RollingAverageRecord';
import { fetchAndParseCSV, parseOptionalFloat } from './utils/csvUtils.js';
import { buildUrl } from './utils/serviceUtils.js';

/**
 * Fetch daily (non-smoothed) climate metrics for a specific station.
 * This data contains the actual daily values without rolling average smoothing.
 * 
 * Example CSV data:
 * 
 * date,tasmin,tasmax,tas
 * 1951-01-01,-14.9,-1.1,-3.4
 * 1951-01-02,-5.7,1.7,-3.4
 * 1951-01-03,-9.4,1.1,-1.1
 * 1951-01-04,-3.6,2.2,-1.3
 * 1951-01-05,-4.4,4.4,2.7
 * 
 * @param {string} stationId - Station ID to fetch daily average data for
 * @returns {Promise<RollingAverageRecordList>} Daily average data for the station
 */
export const fetchDailyAverageForStation = async (stationId: string): Promise<RollingAverageRecordList> => {
    return fetchAndParseCSV<RollingAverageRecordList>(
        buildUrl(`/data/rolling_average/1951_2024/daily_0d/${stationId}_1951-2024_avg_0d.csv`, false),
        (rows, headers) => {
            if (!headers || headers.length === 0 || headers[0] !== 'date') {
                throw new Error(`Unexpected header format for daily average data of ${stationId}.`);
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
                throw new Error(`No daily average data found for ${stationId} from 1951 to 2024.`);
            }

            return records;
        },
        {
            validateHeaders: ['date'],
            errorContext: `daily average data for station ${stationId}`
        }
    );
};
