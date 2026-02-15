import { describe, it, expect } from 'vitest';
import {
    getHardinessZoneYearRange,
    calculateAverageAnnualExtremeMinimum,
    getHardinessZone,
    getTemperatureRange,
    getHardinessZoneDetails,
    HARDINESS_ZONES,
} from './HardinessZoneUtils.js';
import type { RollingAverageRecordList } from '../classes/RollingAverageRecord.js';

describe('HardinessZoneUtils', () => {
    describe('getHardinessZoneYearRange', () => {
        it('should return last 30 complete years for Feb 2026', () => {
            const date = new Date('2026-02-15');
            const range = getHardinessZoneYearRange(date);
            expect(range).toEqual({ startYear: 1996, endYear: 2025 });
        });

        it('should return last 30 complete years for Jan 2027', () => {
            const date = new Date('2027-01-15');
            const range = getHardinessZoneYearRange(date);
            expect(range).toEqual({ startYear: 1997, endYear: 2026 });
        });

        it('should return last 30 complete years for Dec 2025', () => {
            const date = new Date('2025-12-15');
            const range = getHardinessZoneYearRange(date);
            expect(range).toEqual({ startYear: 1995, endYear: 2024 });
        });

        it('should work without a date parameter (uses current date)', () => {
            const range = getHardinessZoneYearRange();
            expect(range.endYear).toBe(new Date().getFullYear() - 1);
            expect(range.startYear).toBe(range.endYear - 29);
        });
    });

    describe('calculateAverageAnnualExtremeMinimum', () => {
        it('should calculate AAEMT correctly from known dataset', () => {
            // Create mock data with known yearly minimums
            const records: RollingAverageRecordList = [];

            // Generate 30 years of data (1996-2025) with known annual minimums
            // Yearly minimums: -10, -12, -14, ... alternating pattern
            for (let year = 1996; year <= 2025; year++) {
                const yearlyMin = -10 - ((year - 1996) % 10);
                // Add records for each day of year, with one day having the minimum
                for (let day = 1; day <= 365; day++) {
                    const dateStr = `${year}-${String(Math.ceil(day / 30)).padStart(2, '0')}-${String((day % 28) + 1).padStart(2, '0')}`;
                    records.push({
                        date: dateStr,
                        tasmin: day === 50 ? yearlyMin : yearlyMin + 20, // Only the 50th day has minimum
                    });
                }
            }

            const aaemt = calculateAverageAnnualExtremeMinimum(records, 1996, 2025);
            expect(aaemt).not.toBeNull();
            // Average of -10, -11, -12, -13, -14, -15, -16, -17, -18, -19 repeated 3 times
            // (30 years with modulo 10 pattern) = average is -14.5
            expect(aaemt).toBeCloseTo(-14.5, 1);
        });

        it('should return null if insufficient data (less than 20 years)', () => {
            const records: RollingAverageRecordList = [];

            // Only 10 years of data
            for (let year = 2015; year <= 2024; year++) {
                records.push({ date: `${year}-01-15`, tasmin: -15 });
            }

            const aaemt = calculateAverageAnnualExtremeMinimum(records, 1996, 2025);
            expect(aaemt).toBeNull();
        });

        it('should return null for empty records', () => {
            const aaemt = calculateAverageAnnualExtremeMinimum([], 1996, 2025);
            expect(aaemt).toBeNull();
        });

        it('should ignore records without tasmin', () => {
            const records: RollingAverageRecordList = [
                { date: '2020-01-15', tas: 5 }, // No tasmin
                { date: '2020-02-15', tasmax: 10 }, // No tasmin
            ];

            const aaemt = calculateAverageAnnualExtremeMinimum(records, 2020, 2020);
            expect(aaemt).toBeNull();
        });

        it('should filter records by year range', () => {
            const records: RollingAverageRecordList = [
                { date: '1990-01-15', tasmin: -30 }, // Before range
                { date: '2000-01-15', tasmin: -15 }, // In range
                { date: '2030-01-15', tasmin: -5 }, // After range
            ];

            // Only one year in range, should return null (needs 20+)
            const aaemt = calculateAverageAnnualExtremeMinimum(records, 1996, 2025);
            expect(aaemt).toBeNull();
        });

        it('should use dynamic year range when not provided', () => {
            const records: RollingAverageRecordList = [];
            const currentYear = new Date().getFullYear();
            const endYear = currentYear - 1;
            const startYear = endYear - 29;

            // Add 30 years of data
            for (let year = startYear; year <= endYear; year++) {
                records.push({ date: `${year}-01-15`, tasmin: -15 });
            }

            const aaemt = calculateAverageAnnualExtremeMinimum(records);
            expect(aaemt).toBe(-15);
        });
    });

    describe('getHardinessZone', () => {
        it('should return correct zone for boundary values', () => {
            // Zone 7a: -17.8°C to -15.0°C
            expect(getHardinessZone(-17.8)).toBe('7a');
            expect(getHardinessZone(-16.0)).toBe('7a');
            expect(getHardinessZone(-15.1)).toBe('7a');

            // Zone 7b: -15.0°C to -12.2°C
            expect(getHardinessZone(-15.0)).toBe('7b');
            expect(getHardinessZone(-14.0)).toBe('7b');
            expect(getHardinessZone(-12.3)).toBe('7b');
        });

        it('should handle zone 1a for extreme cold', () => {
            expect(getHardinessZone(-60)).toBe('1a');
            expect(getHardinessZone(-100)).toBe('1a');
        });

        it('should handle zone 13b for extreme warm', () => {
            expect(getHardinessZone(25)).toBe('13b');
            expect(getHardinessZone(50)).toBe('13b');
        });

        it('should return null for NaN or Infinity', () => {
            expect(getHardinessZone(NaN)).toBeNull();
            expect(getHardinessZone(Infinity)).toBeNull();
            expect(getHardinessZone(-Infinity)).toBeNull();
        });

        it('should cover all zone boundaries correctly', () => {
            // Test each zone's lower boundary
            for (const zone of HARDINESS_ZONES) {
                expect(getHardinessZone(zone.minC)).toBe(zone.zone);
            }
        });
    });

    describe('getTemperatureRange', () => {
        it('should return correct range for zone 7b', () => {
            const range = getTemperatureRange('7b');
            expect(range).toBe('-15.0°C bis -12.2°C');
        });

        it('should return correct range for zone 8a', () => {
            const range = getTemperatureRange('8a');
            expect(range).toBe('-12.2°C bis -9.4°C');
        });

        it('should return null for null zone', () => {
            expect(getTemperatureRange(null)).toBeNull();
        });

        it('should return null for invalid zone', () => {
            expect(getTemperatureRange('invalid' as any)).toBeNull();
        });
    });

    describe('getHardinessZoneDetails', () => {
        it('should return complete details for valid data', () => {
            const records: RollingAverageRecordList = [];

            // Generate 30 years of data with consistent minimum of -14°C (zone 7b)
            for (let year = 1996; year <= 2025; year++) {
                records.push({ date: `${year}-01-15`, tasmin: -14 });
                records.push({ date: `${year}-07-15`, tasmin: 15 }); // Summer temps
            }

            const details = getHardinessZoneDetails(records, new Date('2026-02-15'));

            expect(details.zone).toBe('7b');
            expect(details.aaemt).toBe(-14);
            expect(details.temperatureRange).toBe('-15.0°C bis -12.2°C');
            expect(details.yearRange).toEqual({ startYear: 1996, endYear: 2025 });
        });

        it('should return null zone for insufficient data', () => {
            const records: RollingAverageRecordList = [
                { date: '2020-01-15', tasmin: -10 },
            ];

            const details = getHardinessZoneDetails(records, new Date('2026-02-15'));

            expect(details.zone).toBeNull();
            expect(details.aaemt).toBeNull();
            expect(details.temperatureRange).toBeNull();
            expect(details.yearRange).toEqual({ startYear: 1996, endYear: 2025 });
        });

        it('should return null zone for empty records', () => {
            const details = getHardinessZoneDetails([], new Date('2026-02-15'));

            expect(details.zone).toBeNull();
            expect(details.aaemt).toBeNull();
            expect(details.temperatureRange).toBeNull();
        });
    });
});
