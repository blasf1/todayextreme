import XYData from '../../../../classes/XYData.js';
import { fetchAndParseJSON } from '../../../../services/utils/jsonUtils.js';
import { buildUrl } from '../../../../services/utils/serviceUtils.js';
import { ACTIVE_COUNTRY_PROFILE } from '../../../../config/countryProfiles.js';
import type { IIceAndHotDaysForStation } from '../classes/IceAndHotDaysForStation.js';

/**
 * Service to fetch ice and hot days data for a station
 * 
 * Example JSON data:
 * 
 * {
 *   "daysBelow0Tmax": {
 *     "x": [
 *       1951,
 *       1952,
 *       ...
 *       2023,
 *       2024
 *     ],
 *     "y": [
 *       13,
 *       22,
 *       7,
 *       7
 *     ]
 *   },
 *   "daysAbove30Tmax": {
 *     "x": [
 *       1951,
 *       1952,
 *       ...
 *       2023,
 *       2024
 *     ],
 *     "y": [
 *       5,
 *       10,
 *       ...
 *       16,
 *       24
 *     ]
 *   }
 * }
 * 
 * @param {string} stationId - The station ID to fetch data for
 * @returns {Promise<IIceAndHotDaysForStation>} The ice and hot days data for the station
 */
export const fetchIceAndHotDays = async (stationId: string): Promise<IIceAndHotDaysForStation> => {
    return fetchAndParseJSON<IIceAndHotDaysForStation>(
        buildUrl(`${ACTIVE_COUNTRY_PROFILE.dataRoot}/ice_and_hot_days/${stationId}_ice_and_hot_days_historical.json`, true, 'yyyyLLdd'),
        (data) => {
            return {
                stationId,
                iceDays: data.daysBelow0Tmax,
                hotDays: data.daysAbove30Tmax
            };
        },
        {
            validateKeys: ['daysBelow0Tmax', 'daysAbove30Tmax'],
            errorContext: `ice and hot days for station ${stationId}`
        }
    );
};