/**
 * USDA Plant Hardiness Zone Types
 * 
 * Types related to hardiness zone calculation and display.
 */

import type { HardinessZoneCode, HardinessZoneYearRange, HardinessZoneDetails } from '../utils/HardinessZoneUtils.js';

export type { HardinessZoneCode, HardinessZoneYearRange, HardinessZoneDetails };

/**
 * State returned by the useHardinessZone hook
 */
export interface HardinessZoneState {
    /** The calculated USDA hardiness zone (e.g., "7b") */
    zone: HardinessZoneCode | null;
    /** The Average Annual Extreme Minimum Temperature in Celsius */
    aaemt: number | null;
    /** Human-readable temperature range for the zone */
    temperatureRange: string | null;
    /** The year range used for calculation */
    yearRange: HardinessZoneYearRange;
    /** Whether the zone data is currently loading */
    isLoading: boolean;
    /** Error message if calculation failed */
    error: string | null;
}
