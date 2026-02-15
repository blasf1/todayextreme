import { useMemo, memo } from 'react';
import type { CSSProperties } from 'react';
import { theme } from '../../../styles/design-system.js';
import { useBreakpoint } from '../../../hooks/useBreakpoint.js';
import PlotDescription from '../../common/PlotDescription/PlotDescription.js';
import { useStatsDarkMode } from './StatsDarkModeContext.js';

const getContainerStyle = (isMobile: boolean, darkMode: boolean): CSSProperties => ({
    textAlign: 'center',
    marginRight: isMobile ? 0 : theme.spacing.lg,
    color: darkMode ? theme.colors.textLight : theme.colors.textDark,
});

const StatsTop = memo(() => {
    const breakpoint = useBreakpoint();
    const darkMode = useStatsDarkMode();
    const isMobile = breakpoint === 'mobile' || breakpoint === 'tablet';

    const containerStyle = useMemo(
        () => getContainerStyle(isMobile, darkMode),
        [isMobile, darkMode]
    );

    return (
        <PlotDescription style={containerStyle}>
            <h2>Klimastatistiken</h2>
            <p>
                Diese Sektion zeigt berechnete Klimastatistiken für die ausgewählte Stadt.
            </p>
        </PlotDescription>
    );
});

StatsTop.displayName = 'StatsTop';

export default StatsTop;
