import { useMemo } from 'react';
import { DateTime } from 'luxon';
import * as d3 from 'd3';
import { useAppSelector } from '../../../../store/hooks/useAppSelector.js';
import { selectRollingAverageData } from '../../../../store/slices/rollingAverageDataSlice.js';
import { useSelectedDate } from '../../../../store/slices/selectedDateSlice.js';
import { useSelectedStationData } from '../../../../store/hooks/hooks.js';
import { filterTemperatureDataByDateWindow } from '../rollingAverageUtils.js';
import { getNow } from '../../../../utils/dateUtils.js';

interface BasePlotEntry {
    year: number;
    temperature: number;
    date: string;
    isPrimaryDay: boolean;
    isCurrent?: boolean;
}

export type PlotEntry = BasePlotEntry & { anomaly: number };

interface UseTemperatureAnomalyPlotDataOptions {
    fromYear: number;
    toYear: number;
    baselineStartYear: number;
    baselineEndYear: number;
}

interface TemperatureAnomalyPlotDataResult {
    plotData: PlotEntry[] | null;
    anomaliesForDetails: PlotEntry[];
    todayDataPoint: PlotEntry | null;
    formattedTrend: string | null;
    isToday: boolean;
    targetDate: DateTime | null;
    error: string | null;
}

const initialResult: TemperatureAnomalyPlotDataResult = {
    plotData: null,
    anomaliesForDetails: [],
    todayDataPoint: null,
    formattedTrend: null,
    isToday: false,
    targetDate: null,
    error: null,
};

export const useTemperatureAnomalyPlotData = ({
    fromYear,
    toYear,
    baselineStartYear,
    baselineEndYear,
}: UseTemperatureAnomalyPlotDataOptions): TemperatureAnomalyPlotDataResult => {
    const rollingAverageData = useAppSelector(selectRollingAverageData);
    const selectedStationData = useSelectedStationData();
    const selectedDate = useSelectedDate();

    return useMemo(() => {
        if (!selectedDate) {
            return initialResult;
        }

        const luxonDate = DateTime.fromISO(selectedDate);
        if (!luxonDate.isValid) {
            console.warn('[TemperatureAnomaly] Invalid selected date provided.');
            return {
                ...initialResult,
                error: 'Invalid date for visualization',
            };
        }

        if (!Array.isArray(rollingAverageData) || rollingAverageData.length === 0) {
            // Data not ready yet
            return {
                ...initialResult,
                targetDate: luxonDate,
            };
        }

        const isToday = luxonDate.hasSame(getNow(), 'day');
        const month = String(luxonDate.month).padStart(2, '0');
        const day = String(luxonDate.day).padStart(2, '0');
        const todayMonthDay = `${month}-${day}`;

        const { primaryDayData, surroundingDaysData } = filterTemperatureDataByDateWindow(
            rollingAverageData,
            todayMonthDay,
            7,
            fromYear,
            toYear
        );

        if (primaryDayData.length === 0) {
            console.warn('[TemperatureAnomaly] No primary day data found for', todayMonthDay);
            return {
                ...initialResult,
                targetDate: luxonDate,
                error: `No data found for ${todayMonthDay} in the selected period`,
            };
        }

        const mapEntry = (entry: typeof primaryDayData[number]): BasePlotEntry | null => {
            const [yearString] = entry.date.split('-');
            const year = Number(yearString);
            const temperature = typeof entry.tas === 'number' ? entry.tas : null;

            if (!Number.isFinite(year) || temperature === null) {
                return null;
            }

            return {
                year,
                temperature,
                date: entry.date,
                isPrimaryDay: entry.isPrimaryDay,
            } satisfies BasePlotEntry;
        };

        const formattedPrimaryData = primaryDayData
            .map(mapEntry)
            .filter((entry): entry is BasePlotEntry => entry !== null);

        const formattedSurroundingData = surroundingDaysData
            .map(mapEntry)
            .filter((entry): entry is BasePlotEntry => entry !== null);

        const baselinePrimaryDayData = formattedPrimaryData.filter(
            (d) => d.year >= baselineStartYear && d.year <= baselineEndYear
        );

        const averageTempForPrimaryDay = d3.mean(baselinePrimaryDayData, (d) => d.temperature);

        if (averageTempForPrimaryDay == null || Number.isNaN(averageTempForPrimaryDay)) {
            console.warn('[TemperatureAnomaly] Baseline data insufficient or invalid.');
            return {
                ...initialResult,
                targetDate: luxonDate,
                error: 'Insufficient baseline data to calculate anomaly',
            };
        }

        const primaryDayWithAnomalies: PlotEntry[] = formattedPrimaryData.map((entry) => ({
            ...entry,
            anomaly: entry.temperature - averageTempForPrimaryDay,
        }));

        const surroundingDaysWithAnomalies: PlotEntry[] = formattedSurroundingData.map((entry) => ({
            ...entry,
            anomaly: entry.temperature - averageTempForPrimaryDay,
        }));

        const allDataWithAnomalies: PlotEntry[] = [
            ...primaryDayWithAnomalies,
            ...surroundingDaysWithAnomalies,
        ];

        allDataWithAnomalies.sort((a, b) => a.year - b.year);

        const primaryDayOnly = allDataWithAnomalies.filter((d) => d.isPrimaryDay);

        let formattedTrend: string | null = null;
        if (primaryDayOnly.length >= 2) {
            const n = primaryDayOnly.length;
            const sumX = d3.sum(primaryDayOnly, ({ year }) => year);
            const sumY = d3.sum(primaryDayOnly, ({ anomaly }) => anomaly);
            const sumXY = d3.sum(primaryDayOnly, ({ year, anomaly }) => year * anomaly);
            const sumXX = d3.sum(primaryDayOnly, ({ year }) => year * year);
            const denominator = n * sumXX - sumX * sumX;

            if (denominator !== 0) {
                const slope = (n * sumXY - sumX * sumY) / denominator;
                const trendPerDecade = slope * 10;
                formattedTrend = trendPerDecade.toFixed(2).replace('.', ',');
            }
        }

        let todayDataPoint: PlotEntry | null = null;
        if (selectedStationData) {
            const { minTemperature, maxTemperature } = selectedStationData;
            if (typeof minTemperature === 'number' && typeof maxTemperature === 'number') {
                const averageTemperature = (minTemperature + maxTemperature) / 2;
                const todayAnomaly = averageTemperature - averageTempForPrimaryDay;
                todayDataPoint = {
                    year: luxonDate.year,
                    temperature: averageTemperature,
                    anomaly: todayAnomaly,
                    date: `${luxonDate.year}-${month}-${day}`,
                    isPrimaryDay: true,
                    isCurrent: true,
                };
            }
        }

        const anomaliesForDetails = primaryDayOnly.map((entry) => ({ ...entry }));
        if (todayDataPoint) {
            anomaliesForDetails.push(todayDataPoint);
        }

        return {
            plotData: allDataWithAnomalies,
            anomaliesForDetails,
            todayDataPoint,
            formattedTrend,
            isToday,
            targetDate: luxonDate,
            error: null,
        };
    }, [
        baselineEndYear,
        baselineStartYear,
        fromYear,
        rollingAverageData,
        selectedDate,
        selectedStationData,
        toYear,
    ]);
};

export type { TemperatureAnomalyPlotDataResult };
