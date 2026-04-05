import { useMemo } from 'react';
import { DateTime } from 'luxon';
import { useAppSelector } from './useAppSelector.js';
import { selectGeoJSONData, selectGeoJSONStatus } from '../slices/geoJsonSlice.js';
import {
    selectSelectedStationId,
    selectSelectedItem,
    selectSelectedCityName,
    selectSelectedStationName,
    selectSelectedStationData,
    type SelectedItem,
} from '../selectors/selectedItemSelectors.js';
import {
    selectSampledPlotData,
    selectCityLabelPlotData,
    type PlotDatum,
    type CityLabelDatum,
} from '../selectors/heatmapSelectors.js';
import {
    selectRollingAverageDataStatus,
    selectRollingAverageDataError,
} from '../slices/rollingAverageDataSlice.js';
import { getNow } from '../../utils/dateUtils.js';
import type { DateKey } from '../slices/DailyRecentByDateSlice.js';
import { ACTIVE_COUNTRY_PROFILE } from '../../config/countryProfiles.js';

/**
 * Convenience hooks that wrap the granular selectors.
 * Uses useAppSelector to pass state to the memoized selectors created with createSelector.
 */

export const useSelectedCityName = () => useAppSelector(selectSelectedCityName);
export const useSelectedStationId = () => useAppSelector(selectSelectedStationId);
export const useSelectedStationName = () => useAppSelector(selectSelectedStationName);
export const useSelectedStationData = () => useAppSelector(selectSelectedStationData);
export const useSelectedItem = () => useAppSelector(selectSelectedItem);
export const useSampledPlotData = () => useAppSelector(selectSampledPlotData);
export const useCityLabelPlotData = () => useAppSelector(selectCityLabelPlotData) as CityLabelDatum[] | null;
export const useGeoJSON = () => useAppSelector(selectGeoJSONData);
export const useGeoJSONStatus = () => useAppSelector(selectGeoJSONStatus);
export const useTemperatureAnomaliesDataStatus = () => {
    const rollingAverageStatus = useAppSelector(selectRollingAverageDataStatus);
    const rollingAverageError = useAppSelector(selectRollingAverageDataError);
    const isCityChanging = useAppSelector(state => state.selectedCity.isCityChanging);

    return useMemo(() => ({
        isLoading: isCityChanging || rollingAverageStatus === 'loading',
        error: rollingAverageError ?? null,
    }), [isCityChanging, rollingAverageError, rollingAverageStatus]);
};

export const useHeatmapDataStatus = () => {
    const selectedDate = useAppSelector(state => state.selectedDate.value);
    const geoJSONStatus = useGeoJSONStatus();
    const geoJSONError = useAppSelector(state => state.geoJson.error);
    const yearlyMeanSlice = useAppSelector(state => state.yearlyMeanByDay);
    const dailyRecentSlice = useAppSelector(state => state.dailyRecentByDate);
    const referenceHourlySlice = useAppSelector(state => state.referenceYearlyHourlyInterpolatedByDay);

    return useMemo(() => {
        const dateTime = DateTime.fromISO(selectedDate);
        const now = getNow();
        const isToday = dateTime.isValid && now.hasSame(dateTime, 'day');

        const geoLoading = geoJSONStatus === 'idle' || geoJSONStatus === 'loading';

        const isSpainMode = ACTIVE_COUNTRY_PROFILE.id === 'spain';

        const yearlyStatus = yearlyMeanSlice.status;
        const yearlyError = yearlyMeanSlice.error;
        const yearlyLoading = !isSpainMode && !isToday && (yearlyStatus === 'idle' || yearlyStatus === 'loading');

        const dailyStatus = dailyRecentSlice.status;
        const dailyError = dailyRecentSlice.error;
        const dateKey = dateTime.isValid
            ? `${dateTime.year}-${String(dateTime.month).padStart(2, '0')}-${String(dateTime.day).padStart(2, '0')}` as DateKey
            : null;
        const dailyData = (dailyRecentSlice.data ?? {}) as Record<DateKey, unknown>;
        const loadingKeySet = new Set<DateKey>(dailyRecentSlice.loadingKeys ?? []);
        const dailyKeyLoading = dateKey ? loadingKeySet.has(dateKey) : false;
        const hasDailyData = dateKey ? Boolean(dailyData[dateKey]) : false;
        const dailyLoading = !isSpainMode && !isToday && (
            dailyKeyLoading ||
            dailyStatus === 'loading' ||
            (dailyStatus === 'idle' && !hasDailyData)
        );

        const referenceStatus = referenceHourlySlice.status;
        const referenceError = referenceHourlySlice.error;
        const referenceContext = (referenceHourlySlice as any).context as { month?: number; day?: number } | undefined;
        const referenceMatchesContext = Boolean(
            referenceContext &&
            dateTime.isValid &&
            referenceContext.month === dateTime.month &&
            referenceContext.day === dateTime.day
        );
        const referenceLoading = !isSpainMode && isToday && (
            !referenceMatchesContext ||
            referenceStatus === 'idle' ||
            referenceStatus === 'loading'
        );

        const isLoading = geoLoading || yearlyLoading || dailyLoading || referenceLoading;

        const error = geoJSONError
            || (isSpainMode
                ? null
                : (!isToday ? (dailyError || yearlyError) : (referenceError || yearlyError)));

        return {
            isLoading,
            error: error ?? null,
        };
    }, [
        dailyRecentSlice,
        geoJSONError,
        geoJSONStatus,
        referenceHourlySlice,
        selectedDate,
        yearlyMeanSlice,
    ]);
};

// Re-export types
export type { SelectedItem, PlotDatum, CityLabelDatum };
