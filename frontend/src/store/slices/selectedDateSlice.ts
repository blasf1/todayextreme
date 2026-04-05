import { createSlice } from '@reduxjs/toolkit';
import type { PayloadAction } from '@reduxjs/toolkit';
import { DateTime } from 'luxon';
import { getNow } from '../../utils/dateUtils.js';
import { fetchYearlyMeanByDay } from './YearlyMeanByDaySlice.js';
import { fetchDailyRecentByDate } from './DailyRecentByDateSlice.js';
import { useAppSelector } from '../hooks/useAppSelector.js';
import type { AppThunk, RootState } from '../index.js';
import { resetDateChangeRenderComplete, setDateChangeRenderComplete } from './heatmapGermanySlice.js';

export interface SelectedDateState {
    value: string;
    isDateChanging: boolean;
}

const initialSelectedDate: SelectedDateState = {
    value: getNow().toISO() ?? new Date().toISOString(),
    isDateChanging: false,
};

const selectedDateSlice = createSlice({
    name: 'selectedDate',
    initialState: initialSelectedDate,
    reducers: {
        setSelectedDate: (state, action: PayloadAction<string>) => {
            state.value = action.payload;
        },
        setIsDateChanging: (state, action: PayloadAction<boolean>) => {
            state.isDateChanging = action.payload;
        },
    },
});

const { setSelectedDate, setIsDateChanging } = selectedDateSlice.actions;

// Thunk to set date and fetch historical data
export const setDateAndFetchHistoricalData = (isoDateString: string): AppThunk => async (dispatch) => {
    dispatch(setIsDateChanging(true));
    dispatch(resetDateChangeRenderComplete());
    dispatch(setSelectedDate(isoDateString));

    const dt = DateTime.fromISO(isoDateString);
    if (!dt.isValid) {
        dispatch(setIsDateChanging(false));
        dispatch(setDateChangeRenderComplete(true));
        return;
    }

    const tasks: Promise<unknown>[] = [];
    tasks.push(
        dispatch(fetchYearlyMeanByDay({ month: dt.month, day: dt.day }))
            .unwrap()
            .catch(() => undefined)
    );

    tasks.push(
        dispatch(fetchDailyRecentByDate({ year: dt.year, month: dt.month, day: dt.day }))
            .unwrap()
            .catch(() => undefined)
    );

    await Promise.allSettled(tasks);

    dispatch(setIsDateChanging(false));
};

export const selectSelectedDateState = (state: RootState): SelectedDateState => state.selectedDate;

export const useSelectedDate = (): string => {
    return useAppSelector(state => state.selectedDate.value);
};

export const useIsDateChanging = (): boolean => {
    return useAppSelector(state => state.selectedDate.isDateChanging);
};

export const selectIsDateChanging = (state: RootState): boolean => state.selectedDate.isDateChanging;

export { setSelectedDate, setIsDateChanging };
export default selectedDateSlice.reducer;
