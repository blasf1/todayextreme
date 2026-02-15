import { useMemo } from 'react';
import { useAppSelector } from '../store/hooks/useAppSelector.js';
import { useSelectedStationId } from '../store/hooks/hooks.js';
import {
    selectDailyAverageData,
    selectDailyAverageDataStatus,
    selectDailyAverageDataError,
} from '../store/slices/dailyAverageDataSlice.js';
import { getHardinessZoneDetails, getHardinessZoneYearRange } from '../utils/HardinessZoneUtils.js';
import type { HardinessZoneState } from '../classes/HardinessZone.js';

/**
 * Custom hook to calculate USDA Hardiness Zone for the currently selected station.
 * 
 * Uses daily average data (with tasmin) already fetched for the station and calculates
 * the zone based on the Average Annual Extreme Minimum Temperature (AAEMT)
 * over the last 30 complete years.
 * 
 * @returns {HardinessZoneState} Zone data, loading state, and any errors
 */
export function useHardinessZone(): HardinessZoneState {
    const stationId = useSelectedStationId();
    const dailyAverageData = useAppSelector(selectDailyAverageData);
    const status = useAppSelector(selectDailyAverageDataStatus);
    const errorFromSlice = useAppSelector(selectDailyAverageDataError);

    const isLoading = status === 'loading' || status === 'idle';

    const zoneDetails = useMemo(() => {
        if (!stationId || status !== 'succeeded' || dailyAverageData.length === 0) {
            return null;
        }

        return getHardinessZoneDetails(dailyAverageData);
    }, [stationId, status, dailyAverageData]);

    // Compute error message
    const error = useMemo(() => {
        if (errorFromSlice) return errorFromSlice;
        if (status === 'succeeded' && zoneDetails?.zone === null) {
            return 'Nicht genügend Daten für die Berechnung der Winterhärtezone verfügbar.';
        }
        return null;
    }, [errorFromSlice, status, zoneDetails]);

    // Get year range (always available even if zone calculation fails)
    const yearRange = useMemo(() => getHardinessZoneYearRange(), []);

    return {
        zone: zoneDetails?.zone ?? null,
        aaemt: zoneDetails?.aaemt ?? null,
        temperatureRange: zoneDetails?.temperatureRange ?? null,
        yearRange: zoneDetails?.yearRange ?? yearRange,
        isLoading,
        error,
    };
}

export default useHardinessZone;
