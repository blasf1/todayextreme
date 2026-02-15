import type { RollingAverageRecordList } from '../classes/RollingAverageRecord.js';

/**
 * USDA Hardiness Zones temperature boundaries (in Celsius)
 * Each zone spans ~5.6°C, sub-zones span ~2.8°C
 */
export const HARDINESS_ZONES = [
    { zone: '1a', minC: -51.1, maxC: -48.3 },
    { zone: '1b', minC: -48.3, maxC: -45.6 },
    { zone: '2a', minC: -45.6, maxC: -42.8 },
    { zone: '2b', minC: -42.8, maxC: -40.0 },
    { zone: '3a', minC: -40.0, maxC: -37.2 },
    { zone: '3b', minC: -37.2, maxC: -34.4 },
    { zone: '4a', minC: -34.4, maxC: -31.7 },
    { zone: '4b', minC: -31.7, maxC: -28.9 },
    { zone: '5a', minC: -28.9, maxC: -26.1 },
    { zone: '5b', minC: -26.1, maxC: -23.3 },
    { zone: '6a', minC: -23.3, maxC: -20.6 },
    { zone: '6b', minC: -20.6, maxC: -17.8 },
    { zone: '7a', minC: -17.8, maxC: -15.0 },
    { zone: '7b', minC: -15.0, maxC: -12.2 },
    { zone: '8a', minC: -12.2, maxC: -9.4 },
    { zone: '8b', minC: -9.4, maxC: -6.7 },
    { zone: '9a', minC: -6.7, maxC: -3.9 },
    { zone: '9b', minC: -3.9, maxC: -1.1 },
    { zone: '10a', minC: -1.1, maxC: 1.7 },
    { zone: '10b', minC: 1.7, maxC: 4.4 },
    { zone: '11a', minC: 4.4, maxC: 7.2 },
    { zone: '11b', minC: 7.2, maxC: 10.0 },
    { zone: '12a', minC: 10.0, maxC: 12.8 },
    { zone: '12b', minC: 12.8, maxC: 15.6 },
    { zone: '13a', minC: 15.6, maxC: 18.3 },
    { zone: '13b', minC: 18.3, maxC: 21.1 },
] as const;

export type HardinessZoneCode = typeof HARDINESS_ZONES[number]['zone'];

export interface HardinessZoneYearRange {
    startYear: number;
    endYear: number;
}

export interface HardinessZoneDetails {
    zone: HardinessZoneCode | null;
    aaemt: number | null;
    temperatureRange: string | null;
    yearRange: HardinessZoneYearRange;
}

/** Minimum number of years required for reliable AAEMT calculation */
const MIN_YEARS_REQUIRED = 20;

/**
 * Get the year range for AAEMT calculation (last 30 complete years)
 * 
 * @param currentDate - Current date (defaults to now)
 * @returns { startYear, endYear } - e.g., for Feb 2026 returns { startYear: 1996, endYear: 2025 }
 */
export function getHardinessZoneYearRange(currentDate: Date = new Date()): HardinessZoneYearRange {
    const currentYear = currentDate.getFullYear();
    // Use the last complete year (previous year) as end year
    const endYear = currentYear - 1;
    // Start year is 30 years before the end year (inclusive, so 29 years back)
    const startYear = endYear - 29;
    return { startYear, endYear };
}

/**
 * Calculate Average Annual Extreme Minimum Temperature (AAEMT)
 * 
 * @param records - Daily average records with tasmin values (date format: YYYY-MM-DD)
 * @param startYear - First year to include (default: dynamically calculated)
 * @param endYear - Last year to include (default: dynamically calculated)
 * @returns AAEMT in Celsius, or null if insufficient data
 */
export function calculateAverageAnnualExtremeMinimum(
    records: RollingAverageRecordList,
    startYear?: number,
    endYear?: number
): number | null {
    // If years not provided, calculate dynamically
    if (startYear === undefined || endYear === undefined) {
        const range = getHardinessZoneYearRange();
        startYear = range.startYear;
        endYear = range.endYear;
    }

    // Group records by year and find minimum tasmin for each year
    const yearlyMinimums: Map<number, number> = new Map();

    for (const record of records) {
        if (record.tasmin === undefined) continue;

        // Date format is YYYY-MM-DD
        const year = parseInt(record.date.substring(0, 4), 10);
        if (isNaN(year) || year < startYear || year > endYear) continue;

        const currentMin = yearlyMinimums.get(year);
        if (currentMin === undefined || record.tasmin < currentMin) {
            yearlyMinimums.set(year, record.tasmin);
        }
    }

    // Require at least MIN_YEARS_REQUIRED years of data
    if (yearlyMinimums.size < MIN_YEARS_REQUIRED) return null;

    // Calculate average of yearly minimums
    const sum = Array.from(yearlyMinimums.values()).reduce((a, b) => a + b, 0);
    return sum / yearlyMinimums.size;
}

/**
 * Get USDA hardiness zone from AAEMT
 * 
 * @param aaemtCelsius - Average Annual Extreme Minimum Temperature in Celsius
 * @returns Zone string (e.g., "7b") or null if out of range
 */
export function getHardinessZone(aaemtCelsius: number): HardinessZoneCode | null {
    if (!Number.isFinite(aaemtCelsius)) return null;

    for (const zone of HARDINESS_ZONES) {
        if (aaemtCelsius >= zone.minC && aaemtCelsius < zone.maxC) {
            return zone.zone;
        }
    }

    // Handle extremes
    const firstZone = HARDINESS_ZONES[0];
    const lastZone = HARDINESS_ZONES[HARDINESS_ZONES.length - 1];
    if (firstZone && aaemtCelsius < firstZone.minC) return '1a';
    if (lastZone && aaemtCelsius >= lastZone.maxC) return '13b';

    return null;
}

/**
 * Get temperature range description for a hardiness zone
 * 
 * @param zone - USDA zone code (e.g., "7b")
 * @returns Temperature range string (e.g., "-15.0°C to -12.2°C") or null if invalid
 */
export function getTemperatureRange(zone: HardinessZoneCode | null): string | null {
    if (!zone) return null;

    const zoneData = HARDINESS_ZONES.find((z) => z.zone === zone);
    if (!zoneData) return null;

    return `${zoneData.minC.toFixed(1)}°C bis ${zoneData.maxC.toFixed(1)}°C`;
}

/**
 * Get complete hardiness zone details from daily average data
 * 
 * @param records - Daily average records with tasmin values
 * @param currentDate - Current date for year range calculation (defaults to now)
 * @returns Complete zone details including zone code, AAEMT, temperature range, and year range
 */
export function getHardinessZoneDetails(
    records: RollingAverageRecordList,
    currentDate: Date = new Date()
): HardinessZoneDetails {
    const yearRange = getHardinessZoneYearRange(currentDate);
    const aaemt = calculateAverageAnnualExtremeMinimum(records, yearRange.startYear, yearRange.endYear);
    const zone = aaemt !== null ? getHardinessZone(aaemt) : null;
    const temperatureRange = getTemperatureRange(zone);

    return {
        zone,
        aaemt,
        temperatureRange,
        yearRange,
    };
}
