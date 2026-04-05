import { memo, useEffect, useMemo, useRef, useState } from 'react';
import type { CSSProperties } from 'react';
import * as Plot from '@observablehq/plot';
import { DateTime } from 'luxon';
import { useSelectedDate, } from '../../../store/slices/selectedDateSlice.js';
import { useSelectedItem } from '../../../store/hooks/hooks.js';
import { useAppSelector } from '../../../store/hooks/useAppSelector.js';
import { selectSelectedStationId } from '../../../store/selectors/selectedItemSelectors.js';
import { fetchNormalityByDayData, type NormalityRecord } from '../../../services/NormalityByDayService.js';
import { getNow } from '../../../utils/dateUtils.js';

const cardStyle: CSSProperties = {
    display: 'grid',
    gridTemplateRows: 'auto auto',
    gap: 18,
    width: '100%',
};

const chartCardStyle: CSSProperties = {
    border: '1px solid #d0d0d0',
    borderRadius: 8,
    padding: 14,
    backgroundColor: '#ffffff',
    boxSizing: 'border-box',
};

const topGridStyle: CSSProperties = {
    display: 'grid',
    gridTemplateColumns: 'minmax(260px, 360px) minmax(420px, 1fr)',
    gap: 16,
    alignItems: 'start',
};

const bottomGridStyle: CSSProperties = {
    display: 'grid',
    gridTemplateColumns: 'minmax(260px, 360px) minmax(420px, 1fr)',
    gap: 16,
    alignItems: 'start',
};

const textBlockStyle: CSSProperties = {
    fontSize: '1.02rem',
    lineHeight: 1.45,
    color: '#4f4f4f',
};

const compactLineStyle: CSSProperties = {
    marginBottom: 8,
};

const summaryStyle: CSSProperties = { fontSize: '0.98rem', marginBottom: 10 };

const noteStyle: CSSProperties = {
    fontSize: '0.96rem',
    color: '#666',
    lineHeight: 1.45,
    marginBottom: 12,
};

const redAccentStyle: CSSProperties = {
    color: '#c62828',
    fontWeight: 600,
};

const emphasizedNumberStyle: CSSProperties = {
    color: '#c62828',
    fontWeight: 600,
};

const mutedStrongStyle: CSSProperties = {
    color: '#5a5a5a',
    fontWeight: 600,
};

const chartContainerStyle: CSSProperties = {
    minHeight: 280,
};

const bottomChartContainerStyle: CSSProperties = {
    minHeight: 250,
};

const NORMALITY_WINDOW_DAYS = 15;

const quantile = (values: number[], q: number): number | null => {
    if (values.length === 0) return null;
    const sorted = [...values].sort((a, b) => a - b);
    const pos = (sorted.length - 1) * q;
    const base = Math.floor(pos);
    const rest = pos - base;
    const baseVal = sorted[base];
    const nextVal = sorted[base + 1] ?? baseVal;
    return baseVal + rest * (nextVal - baseVal);
};

const linearTrend = (records: Array<{ x: number; y: number }>): { slope: number; intercept: number } | null => {
    if (records.length < 2) return null;
    const n = records.length;
    const sumX = records.reduce((acc, r) => acc + r.x, 0);
    const sumY = records.reduce((acc, r) => acc + r.y, 0);
    const sumXY = records.reduce((acc, r) => acc + (r.x * r.y), 0);
    const sumXX = records.reduce((acc, r) => acc + (r.x * r.x), 0);
    const denom = (n * sumXX) - (sumX * sumX);
    if (denom === 0) return null;
    const slope = ((n * sumXY) - (sumX * sumY)) / denom;
    const intercept = (sumY - slope * sumX) / n;
    return { slope, intercept };
};

const TodayNormalityRightSide = memo(() => {
    const selectedItem = useSelectedItem();
    const selectedDate = useSelectedDate();
    const selectedCityId = useAppSelector((state) => state.selectedCity.cityId);
    const selectedStationId = useAppSelector(selectSelectedStationId);
    const selectedCityName = useAppSelector((state) => {
        const cityId = state.selectedCity.cityId;
        if (!cityId) return null;
        const cities = state.cityData.data as Record<string, { name?: string }> | undefined;
        return cities?.[cityId]?.name ?? null;
    });
    const selectedDateDaily = useAppSelector((state) => {
        const stationId = selectedStationId ?? selectedItem?.station.id;
        if (!stationId) return null;

        const dt = DateTime.fromISO(selectedDate);
        if (!dt.isValid) return null;

        const dateKey = dt.toFormat('yyyy-MM-dd');
        const byDate = state.dailyRecentByDate.data as Record<string, Record<string, any>> | undefined;
        return byDate?.[dateKey]?.[stationId] ?? null;
    });
    const scatterRef = useRef<HTMLDivElement | null>(null);
    const distributionRef = useRef<HTMLDivElement | null>(null);
    const [records, setRecords] = useState<NormalityRecord[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const dt = DateTime.fromISO(selectedDate);
        if (!dt.isValid) {
            setRecords([]);
            return;
        }

        let cancelled = false;
        setLoading(true);
        setError(null);

        fetchNormalityByDayData(dt.month, dt.day)
            .then((data) => {
                if (!cancelled) {
                    setRecords(data);
                }
            })
            .catch((err: unknown) => {
                if (!cancelled) {
                    const message = err instanceof Error ? err.message : 'Failed to load normality chart data.';
                    setError(message);
                    setRecords([]);
                }
            })
            .finally(() => {
                if (!cancelled) {
                    setLoading(false);
                }
            });

        return () => {
            cancelled = true;
        };
    }, [selectedDate]);

    const content = useMemo(() => {
        const stationIdForPanel = selectedStationId ?? selectedItem?.station.id ?? null;

        if (!selectedCityId) {
            return {
                title: 'No city selected',
                station: '',
                dayMeanValue: null as number | null,
                dayMinValue: null as number | null,
                dayMaxValue: null as number | null,
                p5: null as number | null,
                p50: null as number | null,
                p95: null as number | null,
                percentile: null as number | null,
                trendPerDecade: null as number | null,
                windowSeries: [] as NormalityRecord[],
                referenceSeries: [] as NormalityRecord[],
                availableYears: null as [number, number] | null,
                dailyDataNotice: null as string | null,
            };
        }

        const windowSeries = stationIdForPanel
            ? records.filter((r) => r.stationId === stationIdForPanel).sort((a, b) => a.year - b.year)
            : [];
        const referenceSeries = windowSeries.filter((r) => r.year >= 1981 && r.year <= 2010);

        const dayMeanValue = typeof selectedDateDaily?.meanTemperature === 'number'
            ? selectedDateDaily.meanTemperature
            : (typeof selectedItem?.data.temperature === 'number' ? selectedItem.data.temperature : null);
        const dayMinValue = typeof selectedDateDaily?.minTemperature === 'number'
            ? selectedDateDaily.minTemperature
            : (typeof selectedItem?.data.minTemperature === 'number' ? selectedItem.data.minTemperature : null);
        const dayMaxValue = typeof selectedDateDaily?.maxTemperature === 'number'
            ? selectedDateDaily.maxTemperature
            : (typeof selectedItem?.data.maxTemperature === 'number' ? selectedItem.data.maxTemperature : null);
        const isToday = DateTime.fromISO(selectedDate).hasSame(getNow(), 'day');
        const dailyDataNotice = isToday
            ? 'Today\'s values are observed so far (provisional) and update as new observations arrive.'
            : null;
        const ref = referenceSeries.map((r) => r.tas);
        const p5 = quantile(ref, 0.05);
        const p50 = quantile(ref, 0.50);
        const p95 = quantile(ref, 0.95);

        let percentile: number | null = null;
        if (dayMeanValue !== null && ref.length > 0) {
            const lowerOrEqual = ref.filter((v) => v <= dayMeanValue).length;
            percentile = Number(((lowerOrEqual / ref.length) * 100).toFixed(1));
        }

        const trendInput = windowSeries.map((r) => ({ x: r.year, y: r.tas }));
        const trend = linearTrend(trendInput);
        const trendPerDecade = trend ? Number((trend.slope * 10).toFixed(2)) : null;

        const availableYears = windowSeries.length > 0
            ? [windowSeries[0].year, windowSeries[windowSeries.length - 1].year]
            : null;

        return {
            title: selectedCityName ?? selectedItem?.city.name ?? 'Selected city',
            station: selectedItem?.station.name ?? (stationIdForPanel ?? ''),
            dayMeanValue,
            dayMinValue,
            dayMaxValue,
            p5,
            p50,
            p95,
            percentile,
            trendPerDecade,
            windowSeries,
            referenceSeries,
            availableYears,
            dailyDataNotice,
        };
    }, [selectedItem, selectedDate, selectedDateDaily, records, selectedCityId, selectedCityName, selectedStationId]);

    useEffect(() => {
        if (!scatterRef.current) return;
        scatterRef.current.innerHTML = '';

        if (!selectedItem || content.windowSeries.length === 0) {
            return;
        }

        const rules: any[] = [];
        if (content.p5 !== null) rules.push(Plot.ruleY([content.p5], { stroke: '#888', strokeDasharray: '4,3' }));
        if (content.p95 !== null) rules.push(Plot.ruleY([content.p95], { stroke: '#888', strokeDasharray: '4,3' }));

        const marks: any[] = [
            Plot.dot(content.windowSeries, {
                x: 'year',
                y: 'tas',
                r: 1.6,
                fill: '#9e9e9e',
                opacity: 0.35,
            }),
            ...rules,
        ];

        if (content.dayMeanValue !== null) {
            marks.push(
                Plot.dot([{ year: DateTime.fromISO(selectedDate).year, tas: content.dayMeanValue }], {
                    x: 'year',
                    y: 'tas',
                    r: 4,
                    fill: '#d32f2f',
                })
            );
        }

        const trend = linearTrend(content.windowSeries.map((r) => ({ x: r.year, y: r.tas })));
        if (trend) {
            const minYear = content.windowSeries[0]?.year;
            const maxYear = content.windowSeries[content.windowSeries.length - 1]?.year;
            if (minYear !== undefined && maxYear !== undefined) {
                marks.push(
                    Plot.line(
                        [
                            { x: minYear, y: trend.intercept + trend.slope * minYear },
                            { x: maxYear, y: trend.intercept + trend.slope * maxYear },
                        ],
                        { x: 'x', y: 'y', stroke: '#455a64', strokeWidth: 1.2 }
                    )
                );
            }
        }

        const plot = Plot.plot({
            width: 620,
            height: 270,
            marginLeft: 50,
            marginBottom: 40,
            x: { label: 'Year' },
            y: { label: 'Daily mean temperature (°C)' },
            marks,
        });

        scatterRef.current.appendChild(plot as unknown as Node);
    }, [content, selectedDate, selectedItem]);

    useEffect(() => {
        if (!distributionRef.current) return;
        distributionRef.current.innerHTML = '';

        if (!selectedItem || content.windowSeries.length === 0) {
            return;
        }

        const values = content.windowSeries.map((r) => r.tas);
        const marks: any[] = [
            Plot.rectY(values, Plot.binX({ y: 'count' }, { x: (d: number) => d, fill: '#9e9e9e', opacity: 0.7 })),
        ];

        if (content.p5 !== null) marks.push(Plot.ruleX([content.p5], { stroke: '#222', strokeDasharray: '4,2' }));
        if (content.p50 !== null) marks.push(Plot.ruleX([content.p50], { stroke: '#222', strokeDasharray: '2,2' }));
        if (content.p95 !== null) marks.push(Plot.ruleX([content.p95], { stroke: '#222', strokeDasharray: '4,2' }));
        if (content.dayMeanValue !== null) marks.push(Plot.ruleX([content.dayMeanValue], { stroke: '#d32f2f', strokeWidth: 2 }));

        const plot = Plot.plot({
            width: 620,
            height: 250,
            marginLeft: 50,
            marginBottom: 45,
            x: { label: 'Daily mean temperature (°C)' },
            y: { label: 'Frequency' },
            marks,
        });

        distributionRef.current.appendChild(plot as unknown as Node);
    }, [content, selectedItem]);

    return (
        <div style={cardStyle}>
            <div style={chartCardStyle}>
                <h3 style={{ marginTop: 0 }}>{content.title}</h3>

                <div style={topGridStyle}>
                    <div style={textBlockStyle}>
                        <div style={summaryStyle}>
                            Tmax:&nbsp;<span style={emphasizedNumberStyle}>{content.dayMaxValue?.toFixed(1) ?? 'N/A'}°C</span>,&nbsp;
                            Tmin:&nbsp;<span style={emphasizedNumberStyle}>{content.dayMinValue?.toFixed(1) ?? 'N/A'}°C</span>,&nbsp;
                            Tmed:&nbsp;<span style={emphasizedNumberStyle}>{content.dayMeanValue?.toFixed(1) ?? 'N/A'}°C</span>
                        </div>
                        <div style={{ ...summaryStyle, ...compactLineStyle }}>
                            (<span style={redAccentStyle}>percentile {content.percentile?.toFixed(1) ?? 'N/A'}</span>&nbsp;for this time of year).
                        </div>
                        <div style={noteStyle}>
                            Dashed lines mark historical p05 and p95 from the 1981-2010 reference period.
                        </div>
                        <div style={noteStyle}>
                            Grey dots show daily mean values within ±{NORMALITY_WINDOW_DAYS} days around the selected date, across all available years.
                        </div>
                        {content.dailyDataNotice && (
                            <div style={{ ...summaryStyle, color: '#b26a00' }}>
                                {content.dailyDataNotice}
                            </div>
                        )}
                        <div style={summaryStyle}>
                            <span style={mutedStrongStyle}>Trend:</span> {content.trendPerDecade === null ? 'N/A' : `${content.trendPerDecade.toFixed(2)} °C/decade`}
                        </div>
                        {content.availableYears && (
                            <div style={summaryStyle}>
                                <span style={mutedStrongStyle}>Shown period:</span> {content.availableYears[0]}-{content.availableYears[1]} / <span style={mutedStrongStyle}>reference:</span> 1981-2010
                            </div>
                        )}
                    </div>

                    <div style={chartContainerStyle}>
                        {loading && <div>Loading normality chart...</div>}
                        {error && <div style={{ color: '#c62828' }}>{error}</div>}
                        <div ref={scatterRef} />
                    </div>
                </div>
            </div>

            <div style={chartCardStyle}>
                <div style={bottomGridStyle}>
                    <div style={textBlockStyle}>
                        <div style={{ ...summaryStyle, marginBottom: 12 }}>
                            Distribution of daily mean temperatures in <span style={redAccentStyle}>{content.title}</span> for this period of the year.
                        </div>
                        <div style={noteStyle}>
                            Black lines mark percentiles p05, p50, and p95 from the reference period 1981-2010.
                        </div>
                        <div style={noteStyle}>
                            The red line corresponds to today (<span style={redAccentStyle}>percentile {content.percentile?.toFixed(1) ?? 'N/A'}</span>).
                        </div>
                        <div style={summaryStyle}>
                            p05: {content.p5?.toFixed(1) ?? 'N/A'}°C, p50: {content.p50?.toFixed(1) ?? 'N/A'}°C, p95: {content.p95?.toFixed(1) ?? 'N/A'}°C
                        </div>
                    </div>

                    <div style={bottomChartContainerStyle}>
                        <div ref={distributionRef} />
                    </div>
                </div>
            </div>
        </div>
    );
});

TodayNormalityRightSide.displayName = 'TodayNormalityRightSide';

export default TodayNormalityRightSide;
