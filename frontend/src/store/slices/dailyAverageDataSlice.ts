import { fetchDailyAverageForStation } from '../../services/DailyAverageDataService.js';
import type { RootState } from '../index.js';
import type { RollingAverageRecordList } from '../../classes/RollingAverageRecord.js';
import { createDataSlice } from '../factories/createDataSlice.js';

export interface FetchDailyAverageArgs {
    stationId: string;
}

/**
 * Create dailyAverageData slice using factory.
 * Stores daily (non-smoothed) climate data with tasmin, tasmax, tas for hardiness zone calculation.
 */
const { slice, actions, selectors } = createDataSlice<
    RollingAverageRecordList,
    FetchDailyAverageArgs,
    'simple'
>({
    name: 'dailyAverageData',
    fetchFn: ({ stationId }) => fetchDailyAverageForStation(stationId),
    stateShape: 'simple',
    cache: { strategy: 'none' }, // No caching - always fetch fresh for selected station
});

// Empty constant to avoid creating new [] object every time the state is empty
const EMPTY_DAILY_AVERAGE: RollingAverageRecordList = [];

// Export actions
export const fetchDailyAverageData = actions.fetch;
export const resetDailyAverageData = actions.reset;

// Export selectors
export const selectDailyAverageData = (state: RootState): RollingAverageRecordList =>
    selectors.selectData(state) as RollingAverageRecordList ?? EMPTY_DAILY_AVERAGE;
export const selectDailyAverageDataStatus = selectors.selectStatus;
export const selectDailyAverageDataError = selectors.selectError;

export default slice.reducer;
