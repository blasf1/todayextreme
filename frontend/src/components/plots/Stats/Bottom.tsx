import { memo } from 'react';
import type { CSSProperties } from 'react';
import { theme } from '../../../styles/design-system.js';
import { useBreakpoint } from '../../../hooks/useBreakpoint.js';
import { useHardinessZone } from '../../../hooks/useHardinessZone.js';
import StatCard from './StatCard.js';

const containerStyle: CSSProperties = {
    display: 'flex',
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: theme.spacing.lg,
    width: '100%',
    padding: `0 ${theme.spacing.sm}px`,
    boxSizing: 'border-box',
};

const USDA_INFO_TEXT = 'The USDA hardiness zone helps gardeners choose suitable plants based on local minimum temperatures. It is based on the average annual minimum temperatures over the last 30 years.';

const StatsBottom = memo(() => {
    const breakpoint = useBreakpoint();
    const isMobile = breakpoint === 'mobile';
    const { zone, aaemt, yearRange, isLoading, error } = useHardinessZone();

    // Format year range for display
    const yearRangeText = `${yearRange.startYear}–${yearRange.endYear}`;

    // Determine display value
    let displayValue: string;
    if (isLoading) {
        displayValue = '...';
    } else if (error || !zone) {
        displayValue = '–';
    } else {
        displayValue = zone.toUpperCase();
    }

    // Build subtitle with actual calculated AAEMT
    let subtitle = `Calculated from data in ${yearRangeText}`;
    if (aaemt !== null && !isLoading && !error) {
        subtitle = `Avg. annual extreme minimum: ${aaemt.toFixed(1)}°C`;
    }

    return (
        <div style={containerStyle}>
            <StatCard
                title="USDA Hardiness Zone"
                value={displayValue}
                subtitle={subtitle}
                footnote={`Based on weather station data ${yearRangeText}`}
                infoText={USDA_INFO_TEXT}
                isLoading={isLoading}
                error={error}
                width={isMobile ? '100%' : 300}
            />
        </div>
    );
});

StatsBottom.displayName = 'StatsBottom';

export default StatsBottom;
