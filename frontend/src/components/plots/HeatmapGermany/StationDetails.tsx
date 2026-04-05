import { useMemo } from 'react';
import type { CSSProperties } from 'react';
import { theme, createStyles } from '../../../styles/design-system.js';
import { useBreakpointDown } from '../../../hooks/useBreakpoint.js';
import { useAppSelector } from '../../../store/hooks/useAppSelector.js';
import { useAppDispatch } from '../../../store/hooks/useAppDispatch.js';
import { selectCity } from '../../../store/slices/selectedCitySlice.js';
import { useStationDetailsData } from './useStationDetailsData.js';
import type { StationDetailsData } from './useStationDetailsData.js';

const getPanelStyle = (isVertical: boolean): CSSProperties => ({
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    maxWidth: 340,
    padding: '0 20px 30px 20px',
    marginTop: 20,
    textAlign: 'center',
    color: theme.colors.textLight,
    // marginRight: isVertical ? 0 : 100,
    textShadow: '0px 0px 10px rgba(0, 0, 0, 1)',
});

const getMetricsStyle = (isVertical: boolean): CSSProperties => ({
    display: 'flex',
    flexDirection: 'row',
    gap: 10,
    justifyContent: 'center',
});

const getNameStyle = (isVertical: boolean): CSSProperties => ({
    margin: 0,
    fontSize: '1.6rem',
    lineHeight: 1.2,
    fontWeight: 600,
    color: theme.colors.textLight,
    width: isVertical ? '100%' : undefined,
});

const getSubtitleStyle = (isVertical: boolean): CSSProperties => ({
    fontSize: '0.9rem',
    marginTop: 5,
    marginBottom: 30,
    maxWidth: 300,
    whiteSpaceCollapse: 'preserve' as any,
    textWrap: 'pretty' as any,
    width: isVertical ? '100%' : undefined,
});

const getComparisonStyle = (isVertical: boolean): CSSProperties => ({
    display: 'flex',
    flexDirection: 'column',
    marginTop: 30,
    maxWidth: 300,
});

const placeholderStyle: CSSProperties = {
    backgroundColor: '#555',
    color: 'transparent',
    borderRadius: 4,
    textShadow: 'none',
};

const styles = createStyles({
    questionRow: {
        marginBottom: 14,
        textAlign: 'center',
    },
    questionText: {
        fontSize: '2.1rem',
        fontWeight: 700,
        lineHeight: 1.15,
        marginBottom: 6,
        display: 'inline-flex',
        alignItems: 'baseline',
        flexWrap: 'wrap',
        justifyContent: 'center',
        columnGap: 0,
        rowGap: 0,
    },
    questionLead: {
        marginRight: 6,
    },
    citySelectInlineTrigger: {
        position: 'relative' as const,
        display: 'inline-flex',
        alignItems: 'baseline',
        textDecoration: 'underline',
        textDecorationColor: 'rgba(211,47,47,0.45)',
        cursor: 'pointer',
    },
    citySelectInlineLabel: {
        color: '#d32f2f',
    },
    citySelectInlineArrow: {
        marginLeft: 2,
        color: '#d32f2f',
        fontSize: '0.9rem',
        pointerEvents: 'none' as const,
    },
    citySelectNative: {
        position: 'absolute' as const,
        inset: 0,
        appearance: 'none' as any,
        WebkitAppearance: 'none' as any,
        MozAppearance: 'none' as any,
        border: 'none',
        background: 'transparent',
        color: 'transparent',
        opacity: 0,
        cursor: 'pointer',
        width: '100%',
        height: '100%',
    },
    questionMark: {
        marginLeft: -1,
    },
    answerMain: {
        marginTop: 8,
        fontSize: '3rem',
        fontWeight: 700,
        lineHeight: 1,
    },
    answerSub: {
        marginTop: 8,
        fontSize: '1.4rem',
        fontWeight: 600,
        color: '#d7d7d7',
    },
    placeholder: {
        fontSize: '1rem',
        textAlign: 'center',
        padding: '30px 0',
    },
    doubleCell: {
        display: 'flex',
        flexDirection: 'row',
        gap: 10,
    },
    metricCell: {
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        padding: 4,
        lineHeight: theme.typography.lineHeight.tight
    },
    metricCellHighlight: {
        backgroundColor: theme.colors.backgroundLight,
        borderRadius: 6,
        paddingLeft: 10,
        paddingRight: 10,
        color: theme.colors.textDark,
        boxShadow: '0px 0px 3px 0px white',
        textShadow: 'none'
    },
    metricLabel: {
        fontSize: '0.8rem',
        fontWeight: 'bold',
        textTransform: 'uppercase',
    },
    metricValue: {
        fontSize: '1.2rem',
        fontWeight: 'bold',
        marginTop: 4,
        color: theme.colors.textLight,
        textShadow: 'none',
    },
    metricValueHighlight: {
        color: theme.colors.textDark,
    },
    comparisonMessage: {
        fontSize: '1.4rem',
        lineHeight: 1.2,
        fontWeight: 600,
        color: theme.colors.textLight,
    },
    anomaly: {
        marginTop: 5,
        fontSize: '0.8rem',
    },
    nowrap: {
        whiteSpace: 'nowrap',
    },
});

/**
 * Panel component to display city information with nearest weather station data
 */
const StationDetails = () => {
    const dispatch = useAppDispatch();
    const selectedCityId = useAppSelector((state) => state.selectedCity.cityId);
    const cities = useAppSelector((state) => state.cityData.data);
    const isVertical = useBreakpointDown('desktop');

    // Get all computed data synchronously from custom hook
    const computedData = useStationDetailsData();

    // Removed displayData state and effect for immediate updates

    // Memoized computed styles
    const panelStyle = useMemo(() => getPanelStyle(isVertical), [isVertical]);
    const metricsStyle = useMemo(() => getMetricsStyle(isVertical), [isVertical]);
    const nameStyle = useMemo(() => getNameStyle(isVertical), [isVertical]);
    const subtitleStyle = useMemo(() => getSubtitleStyle(isVertical), [isVertical]);
    const comparisonStyle = useMemo(() => getComparisonStyle(isVertical), [isVertical]);

    const sortedCities = useMemo(() => {
        if (!cities) return [] as Array<{ id: string; name: string }>;
        return Object.values(cities)
            .map((city) => ({ id: city.id, name: city.name }))
            .sort((a, b) => a.name.localeCompare(b.name));
    }, [cities]);

    const selectedCityName = useMemo(() => {
        if (!selectedCityId) return '';
        return sortedCities.find((city) => city.id === selectedCityId)?.name ?? '';
    }, [sortedCities, selectedCityId]);

    const answer = useMemo(() => {
        const anomaly = computedData.anomaly;
        if (anomaly === null || anomaly === undefined) {
            return null;
        }
        if (anomaly >= 1.5) {
            return { main: 'Yes', sub: 'It is quite warm' };
        }
        if (anomaly <= -1.5) {
            return { main: 'No', sub: 'It is not especially warm' };
        }
        return { main: 'Mixed', sub: 'Close to normal for this date' };
    }, [computedData.anomaly]);

    // If no city is selected, show a placeholder
    if (!selectedCityId) {
        return (
            <div style={panelStyle}>
                <div style={styles.placeholder}>
                    Click a city or use search to display details
                </div>
            </div>
        );
    }

    return (
        <div style={panelStyle}>
            <div style={styles.questionRow}>
                <div style={styles.questionText}>
                    <span style={styles.questionLead}>Is it hot today in</span>
                    <span style={styles.citySelectInlineTrigger}>
                        <span style={styles.citySelectInlineLabel}>{selectedCityName}</span>
                        <span style={styles.citySelectInlineArrow}>▼</span>
                        <select
                            aria-label="Select city"
                            value={selectedCityId ?? ''}
                            onChange={(event) => {
                                if (!event.target.value) return;
                                dispatch(selectCity(event.target.value, true));
                            }}
                            style={styles.citySelectNative}
                        >
                            {sortedCities.map((city) => (
                                <option key={city.id} value={city.id}>
                                    {city.name}
                                </option>
                            ))}
                        </select>
                    </span>
                    <span style={styles.questionMark}>?</span>
                </div>
                {answer && <div style={styles.answerMain}>{answer.main}</div>}
                {answer && <div style={styles.answerSub}>{answer.sub}</div>}
            </div>

            {computedData.item && (
                <>
                    <h2 style={nameStyle}>{computedData.item.city.name}</h2>
                    {computedData.subtitle.trim().length > 0 && (
                        <div style={subtitleStyle} dangerouslySetInnerHTML={{ __html: computedData.subtitle }} />
                    )}
                    <div style={metricsStyle}>
                        <div style={styles.doubleCell}>
                            <div style={{ ...styles.metricCell, ...styles.metricCellHighlight }}>
                                <span style={styles.metricLabel}>{computedData.isToday ? "Latest" : "Mean"}</span>
                                <span style={{ ...styles.metricValue, ...styles.metricValueHighlight }}>
                                    {computedData.item.data.temperature !== undefined
                                        ? `${computedData.item.data.temperature.toFixed(1)}°C`
                                        : "N/A"}
                                </span>
                            </div>
                            <div style={styles.metricCell}>
                                <span style={styles.metricLabel}>Min</span>
                                <span style={styles.metricValue}>
                                    {computedData.item.data.minTemperature !== undefined
                                        ? `${computedData.item.data.minTemperature.toFixed(1)}°C`
                                        : "N/A"}
                                </span>
                            </div>
                        </div>
                        <div style={styles.doubleCell}>
                            <div style={styles.metricCell}>
                                <span style={styles.metricLabel}>Max</span>
                                <span style={styles.metricValue}>
                                    {computedData.item.data.maxTemperature !== undefined
                                        ? `${computedData.item.data.maxTemperature.toFixed(1)}°C`
                                        : "N/A"}
                                </span>
                            </div>
                            <div style={styles.metricCell}>
                                <span style={styles.metricLabel}>Humidity</span>
                                <span style={styles.metricValue}>
                                    {computedData.item.data.humidity !== undefined
                                        ? `${computedData.item.data.humidity.toFixed(0)}%`
                                        : "N/A"}
                                </span>
                            </div>
                        </div>
                    </div>
                    <div style={comparisonStyle}>
                        {computedData.anomalyDetails ? (
                            <>
                                <div style={styles.comparisonMessage}>
                                    {computedData.anomalyDetails.comparisonMessage}
                                </div>
                                <span style={styles.anomaly}>
                                    {computedData.anomalyDetails.anomalyMessage}
                                </span>
                            </>
                        ) : (
                            <>
                                <div style={styles.comparisonMessage}>Live data loaded</div>
                                <span style={styles.anomaly}>Reference baseline for anomaly comparison is not available yet.</span>
                            </>
                        )}
                    </div>
                </>
            )}
            {!computedData.item && (
                <>
                    <h2 style={{ ...nameStyle, ...placeholderStyle }}>A City</h2>

                    <div style={metricsStyle}>
                        <div style={styles.doubleCell}>
                            <div style={{ ...styles.metricCell, ...styles.metricCellHighlight }}>
                                <span style={styles.metricLabel}>{computedData.isToday ? "Latest" : "Mean"}</span>
                                <span style={{ ...styles.metricValue, ...placeholderStyle }}>
                                    20.5°C
                                </span>
                            </div>
                            <div style={styles.metricCell}>
                                <span style={styles.metricLabel}>Min</span>
                                <span style={{ ...styles.metricValue, ...placeholderStyle }}>
                                    14.1°C
                                </span>
                            </div>
                        </div>
                        <div style={styles.doubleCell}>
                            <div style={styles.metricCell}>
                                <span style={styles.metricLabel}>Max</span>
                                <span style={{ ...styles.metricValue, ...placeholderStyle }}>
                                    28.1°C
                                </span>
                            </div>
                            <div style={styles.metricCell}>
                                <span style={styles.metricLabel}>Humidity</span>
                                <span style={{ ...styles.metricValue, ...placeholderStyle }}>
                                    64%
                                </span>
                            </div>
                        </div>
                    </div>

                    <div style={comparisonStyle}>
                        <div style={{ ...styles.comparisonMessage, ...placeholderStyle }}>
                            No data yet
                        </div>
                        <div style={{ ...styles.anomaly, ...placeholderStyle }}>
                            The maximum temperature is 3.1&nbsp;°C below the historical&nbsp;mean.
                        </div>
                    </div>
                </>
            )}

        </div>
    );
};

export default StationDetails;