import { useMemo, memo } from 'react';
import type { CSSProperties } from 'react';
import { theme } from '../../../styles/design-system.js';
import { useBreakpoint } from '../../../hooks/useBreakpoint.js';
import PlotDescription from '../../common/PlotDescription/PlotDescription.js';

const getContainerStyle = (isMobile: boolean): CSSProperties => ({
    textAlign: 'center',
    marginRight: isMobile ? 0 : theme.spacing.lg,
    color: theme.colors.textLight,
});

const IceAndHotDaysLeftSide = memo(() => {
    const breakpoint = useBreakpoint();
    const isMobile = breakpoint === 'mobile' || breakpoint === 'tablet';

    const containerStyle = useMemo(() => getContainerStyle(isMobile), [isMobile]);

    return (
        <PlotDescription style={containerStyle}>
            <h2>Ice Days and Hot Days</h2>
            <p>
                This chart shows how extreme temperature days evolve over time. The lower blue bars represent the number of ice days, which are days with a maximum temperature of 0°C or below. The upper red bars represent hot days with maximum temperatures above 30°C.
            </p>
            <p>
                Color intensity indicates how extreme each year was relative to the reference period (1961–1990). Stronger colors indicate larger deviations, with the scale ranging from dark blue (very few ice days) through light (normal) to dark red (many hot days).
            </p>
            <p style={{ fontSize: '0.9em', opacity: 0.8 }}>
                <em>Color saturation is based on the 5th to 95th percentile of the reference period to emphasize extreme years.</em>
            </p>
        </PlotDescription>
    );
});

IceAndHotDaysLeftSide.displayName = 'IceAndHotDaysLeftSide';

export default IceAndHotDaysLeftSide;