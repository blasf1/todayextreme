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

const USDA_INFO_TEXT = 'Die USDA-Winterhärtezone hilft Gärtnern bei der Auswahl geeigneter Pflanzen basierend auf den lokalen Tiefsttemperaturen. Sie basiert auf dem Durchschnitt der jährlichen Tiefsttemperaturen der letzten 30 Jahre.';

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
    let subtitle = `Berechnet aus den Daten von ${yearRangeText}`;
    if (aaemt !== null && !isLoading && !error) {
        subtitle = `Ø jährl. Tiefsttemperatur: ${aaemt.toFixed(1)}°C`;
    }

    return (
        <div style={containerStyle}>
            <StatCard
                title="USDA-Winterhärtezone"
                value={displayValue}
                subtitle={subtitle}
                footnote={`Basierend auf Wetterstationsdaten ${yearRangeText}`}
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
