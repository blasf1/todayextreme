import { useEffect, useRef, useCallback, useMemo, memo, useState } from 'react';
import type { CSSProperties } from 'react';
import * as Plot from "@observablehq/plot";
import { selectCity } from '../../../store/slices/selectedCitySlice.js';
import { PREDEFINED_CITIES } from '../../../constants/map.js';
import MapLegend from './MapLegend.js';
import { theme, createStyles } from '../../../styles/design-system.js';
import { useBreakpoint, useBreakpointDown } from '../../../hooks/useBreakpoint.js';
import { useSelectedDate } from '../../../store/slices/selectedDateSlice.js';
import { DateTime } from 'luxon';
import { getNow } from '../../../utils/dateUtils.js';
import { useAppDispatch } from '../../../store/hooks/useAppDispatch.js';
import { fetchGeoJSON } from '../../../store/slices/geoJsonSlice.js';
import { useSampledPlotData, useCityLabelPlotData, useGeoJSON, useGeoJSONStatus, useHeatmapDataStatus } from '../../../store/hooks/hooks.js';
import type { CityLabelDatum } from '../../../store/selectors/heatmapSelectors.js';
import { MIN_LOADING_DISPLAY_DURATION } from '../../../constants/page.js';
import { setDateChangeRenderComplete, useHeatmapRenderComplete } from '../../../store/slices/heatmapGermanySlice.js';
import AsyncLoadingOverlayWrapper from '../../common/AsyncLoadingOverlayWrapper/AsyncLoadingOverlayWrapper.js';

const getPlotContainerLeftAlignStyle = (isVertical: boolean): CSSProperties => ({
    display: 'flex',
    flexDirection: 'column',
    alignItems: isVertical ? 'center' : 'flex-start',
    width: '100%',
});

const getPlotStyle = (dims: { width: number; height: number }): CSSProperties => ({
    position: 'relative',
    width: dims.width,
    height: dims.height,
    marginBottom: theme.spacing.sm,
});

const styles = createStyles({
    plotContainer: {
        display: 'flex',
        flexDirection: 'column' as const,
        alignItems: 'center',
        justifyContent: 'center',
    },
    plotAnimationWrapper: {
        position: 'relative' as const,
        width: '100%',
        height: '100%',
        opacity: 0,
        transition: 'opacity 0.4s ease-in',
    },
    plotAnimationWrapperVisible: {
        opacity: 1,
    },
    staticPlot: {
        width: '100%',
        height: '100%',
        filter: 'none',
    },
    dynamicPlot: {
        position: 'absolute' as const,
        left: 0,
        top: 0,
        zIndex: 1,
        color: theme.colors.textDark
    },
    textStyle: {
        fontSize: 12,
        dy: 8
    },
    plotStyle: {
        stroke: 'none',
        strokeWidth: 0,
        fill: 'white'
    }
});

const buildBorderlessDomain = (featureCollection: any): any => {
    if (!featureCollection?.features || !Array.isArray(featureCollection.features)) {
        return featureCollection;
    }

    const polygons: any[] = [];
    for (const feature of featureCollection.features) {
        const geometry = feature?.geometry;
        if (!geometry) continue;

        if (geometry.type === 'Polygon' && Array.isArray(geometry.coordinates)) {
            polygons.push(geometry.coordinates);
            continue;
        }

        if (geometry.type === 'MultiPolygon' && Array.isArray(geometry.coordinates)) {
            polygons.push(...geometry.coordinates);
        }
    }

    if (polygons.length === 0) {
        return featureCollection;
    }

    return {
        type: 'FeatureCollection',
        features: [
            {
                type: 'Feature',
                properties: {},
                geometry: {
                    type: 'MultiPolygon',
                    coordinates: polygons,
                },
            },
        ],
    };
};

const HeatmapGermanyRightSide = memo(() => {
    const dispatch = useAppDispatch();
    const breakpoint = useBreakpoint();
    const isVertical = useBreakpointDown('desktop');

    // Fixed dimensions per breakpoint to keep projected shape scale consistent
    const MAP_DIMENSIONS: Record<'mobile' | 'tablet' | 'desktop' | 'wide', { width: number; height: number }> = {
        mobile: { width: 320, height: 435 },
        tablet: { width: 460, height: 625 },
        desktop: { width: 640, height: 870 },
        wide: { width: 700, height: 952 }
    };
    const plotDims = MAP_DIMENSIONS[breakpoint];

    const sampledPlotData = useSampledPlotData();
    const selectedDate = useSelectedDate();
    const cityLabelData = useCityLabelPlotData();
    const geojson = useGeoJSON();
    const borderlessGeojson = useMemo(() => buildBorderlessDomain(geojson), [geojson]);
    const geojsonStatus = useGeoJSONStatus();
    const renderComplete = useHeatmapRenderComplete();

    const staticPlotRef = useRef<HTMLDivElement | null>(null);
    const dynamicPlotRef = useRef<HTMLDivElement | null>(null);
    const lastSelectedCityId = useRef<string | null>(null);

    // Track initial mount to show loading only on first render
    const isInitialMount = useRef<boolean>(true);
    const initialFadeTimeoutRef = useRef<number | null>(null);

    const [isPlotVisible, setShouldAnimatePlot] = useState<boolean>(false);



    const isToday = useMemo(() => DateTime.fromISO(selectedDate).hasSame(getNow(), 'day'), [selectedDate]);

    useEffect(() => {
        if (geojsonStatus === 'idle') {
            dispatch(fetchGeoJSON());
        }
    }, [geojsonStatus, dispatch]);

    const idleIdRef = useRef<number | null>(null);

    useEffect(() => {
        const hasGeoJSON = !!borderlessGeojson;
        const hasSampledData = Array.isArray(sampledPlotData) && sampledPlotData.length > 0;
        const hasAnomalyData = hasSampledData && sampledPlotData.some(d => typeof d.anomaly === 'number');

        // We cannot build any map before geojson is available.
        if (!hasGeoJSON) return;

        // Cancel previous idle task if any
        if (idleIdRef.current !== null && 'cancelIdleCallback' in window) {
            (window as any).cancelIdleCallback(idleIdRef.current);
        }

        const build = () => {
            let isOutlineOnly = false;
            let staticPlot;
            if (hasGeoJSON && !hasSampledData) {
                isOutlineOnly = true;
                staticPlot = Plot.plot({
                    projection: { type: 'mercator', domain: geojson },
                    marks: [Plot.geo(borderlessGeojson, styles.plotStyle)],
                    width: plotDims.width,
                    height: plotDims.height,
                });
            } else if (hasGeoJSON && hasSampledData && !hasAnomalyData) {
                // In local-live mode (for example Spain-only data), anomalies may be unavailable.
                // Render the boundary immediately and let dynamic city overlays provide interactivity.
                isOutlineOnly = true;
                staticPlot = Plot.plot({
                    projection: { type: 'mercator', domain: geojson },
                    marks: [Plot.geo(borderlessGeojson, styles.plotStyle)],
                    width: plotDims.width,
                    height: plotDims.height,
                });
            } else if (hasGeoJSON && hasSampledData && hasAnomalyData) {
                staticPlot = Plot.plot({
                    projection: { type: 'mercator', domain: geojson },
                    color: { type: 'diverging', scheme: 'Turbo', domain: [-10, 10], pivot: 0 },
                    marks: [
                        // Use sampled data for contours to reduce computation
                        Plot.geo(borderlessGeojson, styles.plotStyle),
                        Plot.contour(sampledPlotData, {
                            x: 'stationLon',
                            y: 'stationLat',
                            fill: 'anomaly',
                            blur: 1.5,
                            clip: borderlessGeojson,
                        }),
                    ],
                    width: plotDims.width,
                    height: plotDims.height,
                });
            } else {
                // This should not happen, see conditions that execute build().
                console.error('Cannot build heatmap static plot: unexpected state.');
                return;
            }

            const showPlot = () => {
                if (staticPlotRef.current) {
                    staticPlotRef.current.innerHTML = '';
                    staticPlotRef.current.appendChild(staticPlot);
                }
            }

            if (isOutlineOnly) {
                showPlot();
                setShouldAnimatePlot(true);
                dispatch(setDateChangeRenderComplete(true));
                return;
            }

            showPlot();

            if (isInitialMount.current) {
                isInitialMount.current = false;
                if (initialFadeTimeoutRef.current !== null) {
                    window.clearTimeout(initialFadeTimeoutRef.current);
                }
                initialFadeTimeoutRef.current = window.setTimeout(() => {
                    setShouldAnimatePlot(true);
                    dispatch(setDateChangeRenderComplete(true));
                    initialFadeTimeoutRef.current = null;
                }, MIN_LOADING_DISPLAY_DURATION);
            } else {
                setShouldAnimatePlot(true);
                dispatch(setDateChangeRenderComplete(true));
            }
        };

        if (!hasSampledData || !hasAnomalyData) {
            build();
        } else {
            if ('requestIdleCallback' in window) {
                idleIdRef.current = requestIdleCallback(build);
            } else {
                idleIdRef.current = (window as any).setTimeout(build, 0);
            }
        }
    }, [sampledPlotData, borderlessGeojson, dispatch, plotDims.width, plotDims.height]);

    useEffect(() => {
        return () => {
            if (initialFadeTimeoutRef.current !== null) {
                window.clearTimeout(initialFadeTimeoutRef.current);
                initialFadeTimeoutRef.current = null;
            }
        };
    }, []);

    // Render dynamic overlays (city dots, labels, selection) on every relevant state change
    const renderDynamicOverlay = useCallback(() => {
        if (dynamicPlotRef.current) {
            dynamicPlotRef.current.innerHTML = '';
        }

        const isDataPresent = !!cityLabelData && !!borderlessGeojson;
        if (!isDataPresent || !renderComplete) return;

        const dynamicPlot = Plot.plot({
            projection: {
                type: "mercator",
                domain: borderlessGeojson
            },
            marks: [
                Plot.dot(cityLabelData, {
                    x: "cityLon",
                    y: "cityLat",
                    r: 7,
                    fill: "currentColor",
                    stroke: "white",
                    strokeWidth: 2,
                }),
                Plot.dot(cityLabelData,
                    Plot.pointer({
                        x: "cityLon",
                        y: "cityLat",
                        stroke: "white",
                        strokeWidth: 3,
                        r: 10
                    })
                ),
            ],
            width: plotDims.width,
            height: plotDims.height,
        });

        dynamicPlot.addEventListener("input", () => {
            // If no city is selected, do nothing
            const value = dynamicPlot.value as CityLabelDatum | null;
            if (!value) return;

            // Prevent unnecessary dispatches if the hovered or selected city hasn't changed
            if (value.cityId === lastSelectedCityId.current) return;
            lastSelectedCityId.current = value.cityId;

            const isPredefined = PREDEFINED_CITIES.includes(value.cityName);
            dispatch(selectCity(value.cityId, !isPredefined));
        });

        dynamicPlotRef.current?.appendChild(dynamicPlot as unknown as HTMLElement);
    }, [
        cityLabelData,
        borderlessGeojson,
        dispatch,
        breakpoint,
        renderComplete,
        plotDims.width,
        plotDims.height
    ]);

    useEffect(() => {
        renderDynamicOverlay();
    }, [renderDynamicOverlay]);

    const plotContainerLeftAlignStyle = useMemo(
        () => getPlotContainerLeftAlignStyle(isVertical),
        [isVertical]
    );

    const plotStyle = useMemo(
        () => getPlotStyle(plotDims),
        [plotDims]
    );

    let title = isToday
        ? "Today's temperature anomaly"
        : "Temperature anomaly on " + DateTime.fromISO(selectedDate).setLocale('en').toFormat("d MMMM yyyy");
    title += " vs\u00A01961\u00A0to\u00A01990\u00A0in\u00A0°C";

    return (
        <div style={plotContainerLeftAlignStyle}>
            <div style={styles.plotContainer}>
                <AsyncLoadingOverlayWrapper
                    dataStatusHook={useHeatmapDataStatus}
                    renderCompleteSignal={renderComplete}
                    minDisplayDuration={MIN_LOADING_DISPLAY_DURATION}
                    onError={() => dispatch(setDateChangeRenderComplete(true))}
                    style={plotStyle}
                >
                    <div style={{
                        ...styles.plotAnimationWrapper,
                        ...(isPlotVisible ? styles.plotAnimationWrapperVisible : {})
                    }}>
                        <div ref={staticPlotRef} style={styles.staticPlot}></div>
                        <div ref={dynamicPlotRef} style={styles.dynamicPlot}></div>
                    </div>
                </AsyncLoadingOverlayWrapper>
                <MapLegend title={title} colorScheme="Turbo" />
            </div>
        </div>
    );
});

HeatmapGermanyRightSide.displayName = 'HeatmapGermanyRightSide';

export default HeatmapGermanyRightSide;