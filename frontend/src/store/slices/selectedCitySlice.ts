import { createSlice } from '@reduxjs/toolkit';
import type { PayloadAction } from '@reduxjs/toolkit';
import { addRememberedCity } from './rememberedCitiesSlice.js';
import { fetchRollingAverageData, resetRollingAverageData } from './rollingAverageDataSlice.js';
import { fetchDailyAverageData, resetDailyAverageData } from './dailyAverageDataSlice.js';
import type { AppThunk, RootState } from '../index.js';
import { selectSelectedStationId } from '../selectors/selectedItemSelectors.js';
import { useAppSelector } from '../hooks/useAppSelector.js';
import {
    resetCityChangeRenderComplete,
    setCityChangeRenderComplete,
} from './temperatureAnomaliesByDayOverYearsSlice.js';
import { fetchIceAndHotDays } from '../../components/plots/iceAndHotDays/services/IceAndHotDaysService.js';
import { fetchIceAndHotDaysData, resetIceAndHotDaysData } from './iceAndHotDaysDataSlice.js';
import { resetIceAndHotDaysRenderComplete, setIceAndHotDaysRenderComplete } from './iceAndHotDaysSlice.js';

export interface SelectedCityState {
    cityId: string | null;
    isCityChanging: boolean;
}

const initialState: SelectedCityState = {
    cityId: null,
    isCityChanging: false,
};

const selectedCitySlice = createSlice({
    name: 'selectedCity',
    initialState,
    reducers: {
        setSelectedCity: (state, action: PayloadAction<string | null>) => {
            state.cityId = action.payload;
        },
        setIsCityChanging: (state, action: PayloadAction<boolean>) => {
            state.isCityChanging = action.payload;
        },
    },
});

const { setSelectedCity, setIsCityChanging } = selectedCitySlice.actions;

export const selectCity = (
    cityId: string | null,
    remember = false,
): AppThunk => async (dispatch, getState) => {
    const previousCityId = getState().selectedCity.cityId;

    if (previousCityId === cityId) {
        return;
    }

    if (!cityId) {
        dispatch(setSelectedCity(null));
        dispatch(resetRollingAverageData());
        dispatch(resetDailyAverageData());
        dispatch(resetIceAndHotDaysData());
        dispatch(setCityChangeRenderComplete(true));
        dispatch(setIceAndHotDaysRenderComplete(true));
        dispatch(setIsCityChanging(false));
        return;
    }

    dispatch(setIsCityChanging(true));
    dispatch(resetCityChangeRenderComplete());
    dispatch(resetIceAndHotDaysRenderComplete());
    dispatch(setSelectedCity(cityId));

    if (remember && cityId) {
        dispatch(addRememberedCity(cityId));
    }

    const stateAfterSelection = getState();
    const stationId = selectSelectedStationId(stateAfterSelection);

    dispatch(resetRollingAverageData());
    dispatch(resetDailyAverageData());
    dispatch(resetIceAndHotDaysData());

    let didDispatchFetch = false;

    if (stationId) {
        didDispatchFetch = true;

        await Promise.allSettled([
            dispatch(fetchRollingAverageData({ stationId })).unwrap().catch(() => undefined),
            dispatch(fetchDailyAverageData({ stationId })).unwrap().catch(() => undefined),
            dispatch(fetchIceAndHotDaysData({ stationId })).unwrap().catch(() => undefined),
        ]);
    }

    dispatch(setIsCityChanging(false));

    if (!didDispatchFetch) {
        dispatch(setCityChangeRenderComplete(true));
        dispatch(setIceAndHotDaysRenderComplete(true));
    }
};

export const useIsCityChanging = (): boolean => {
    return useAppSelector(state => state.selectedCity.isCityChanging);
};

export const selectIsCityChanging = (state: RootState): boolean => state.selectedCity.isCityChanging;

export { setSelectedCity, setIsCityChanging };
export default selectedCitySlice.reducer;