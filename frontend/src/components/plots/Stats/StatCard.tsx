import { useMemo, memo, useState, useCallback } from 'react';
import type { CSSProperties } from 'react';
import { theme } from '../../../styles/design-system.js';
import { useStatsDarkMode } from './StatsDarkModeContext.js';

interface StatCardProps {
    /** Main title of the stat */
    title: string;
    /** Primary value to display (large text) */
    value: string;
    /** Secondary description below the value */
    subtitle?: string;
    /** Small footnote at the bottom */
    footnote?: string;
    /** Info text shown in tooltip/popover */
    infoText?: string;
    /** Whether data is currently loading */
    isLoading?: boolean;
    /** Error message to display */
    error?: string | null;
    /** Card width */
    width?: number | string;
}

// Dark mode colors
const darkColors = {
    cardBg: 'rgba(255, 255, 255, 0.05)',
    title: theme.colors.textLight,
    value: theme.colors.textWhite,
    subtitle: theme.colors.textLight,
    footnote: theme.colors.textLight,
    infoBorder: theme.colors.textLight,
    tooltipBg: 'rgba(0, 0, 0, 0.9)',
    tooltipText: theme.colors.textLight,
};

// Light mode colors
const lightColors = {
    cardBg: 'rgba(0, 0, 0, 0.03)',
    title: theme.colors.textDark,
    value: theme.colors.textDark,
    subtitle: theme.colors.textDark,
    footnote: theme.colors.textDark,
    infoBorder: theme.colors.textDark,
    tooltipBg: 'rgba(50, 50, 50, 0.95)',
    tooltipText: theme.colors.textLight,
};

const getColors = (darkMode: boolean) => darkMode ? darkColors : lightColors;

const getCardStyle = (width: number | string, darkMode: boolean): CSSProperties => ({
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding: theme.spacing.lg,
    backgroundColor: getColors(darkMode).cardBg,
    borderRadius: theme.borderRadius?.md ?? '8px',
    minWidth: typeof width === 'number' ? width : undefined,
    width: typeof width === 'string' ? width : undefined,
    maxWidth: 400,
    position: 'relative',
});

const getHeaderStyle = (): CSSProperties => ({
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: theme.spacing.xs,
    marginBottom: theme.spacing.sm,
});

const getTitleStyle = (darkMode: boolean): CSSProperties => ({
    fontSize: theme.typography.fontSize.md,
    fontWeight: theme.typography.fontWeight.medium,
    color: getColors(darkMode).title,
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
});

const getInfoButtonStyle = (darkMode: boolean): CSSProperties => ({
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: 18,
    height: 18,
    borderRadius: '50%',
    border: `1px solid ${getColors(darkMode).infoBorder}`,
    background: 'transparent',
    color: getColors(darkMode).title,
    fontSize: '11px',
    fontWeight: theme.typography.fontWeight.bold,
    cursor: 'pointer',
    opacity: 0.7,
    transition: 'opacity 0.2s ease-in-out',
    padding: 0,
    lineHeight: 1,
});

const getInfoButtonHoverStyle = (darkMode: boolean): CSSProperties => ({
    ...getInfoButtonStyle(darkMode),
    opacity: 1,
});

const getTooltipStyle = (darkMode: boolean): CSSProperties => ({
    position: 'absolute',
    top: '100%',
    left: '50%',
    transform: 'translateX(-50%)',
    backgroundColor: getColors(darkMode).tooltipBg,
    color: getColors(darkMode).tooltipText,
    padding: theme.spacing.md,
    borderRadius: theme.borderRadius?.sm ?? '4px',
    fontSize: theme.typography.fontSize.sm,
    lineHeight: theme.typography.lineHeight?.normal ?? 1.5,
    maxWidth: 280,
    width: 'max-content',
    zIndex: 100,
    marginTop: theme.spacing.sm,
    boxShadow: '0 4px 12px rgba(0, 0, 0, 0.3)',
    textAlign: 'left',
});

const getValueStyle = (isLoading: boolean, hasError: boolean, darkMode: boolean): CSSProperties => ({
    fontSize: '3rem',
    fontWeight: theme.typography.fontWeight.bold,
    color: hasError ? theme.colors.neutral : getColors(darkMode).value,
    marginBottom: theme.spacing.sm,
    opacity: isLoading ? 0.5 : 1,
    transition: 'opacity 0.2s ease-in-out',
});

const getSubtitleStyle = (darkMode: boolean): CSSProperties => ({
    fontSize: theme.typography.fontSize.sm,
    color: getColors(darkMode).subtitle,
    opacity: 0.8,
    marginBottom: theme.spacing.xs,
    textAlign: 'center',
});

const getFootnoteStyle = (darkMode: boolean): CSSProperties => ({
    fontSize: theme.typography.fontSize.xs,
    color: getColors(darkMode).footnote,
    opacity: 0.6,
    fontStyle: 'italic',
    marginTop: theme.spacing.sm,
    textAlign: 'center',
});

const errorStyle: CSSProperties = {
    fontSize: theme.typography.fontSize.sm,
    color: theme.colors.hot,
    opacity: 0.9,
    marginTop: theme.spacing.xs,
    textAlign: 'center',
};

/**
 * StatCard Component
 * 
 * A reusable card component for displaying a single statistic with title,
 * large value, subtitle, and footnote. Handles loading and error states.
 * Includes optional info button with tooltip for additional context.
 */
const StatCard = memo(({
    title,
    value,
    subtitle,
    footnote,
    infoText,
    isLoading = false,
    error = null,
    width = 280,
}: StatCardProps) => {
    const darkMode = useStatsDarkMode();
    const [showTooltip, setShowTooltip] = useState(false);
    const [isHovered, setIsHovered] = useState(false);
    const [wasClicked, setWasClicked] = useState(false);

    const cardStyle = useMemo(() => getCardStyle(width, darkMode), [width, darkMode]);
    const valueStyle = useMemo(() => getValueStyle(isLoading, !!error, darkMode), [isLoading, error, darkMode]);
    const headerStyle = useMemo(() => getHeaderStyle(), []);
    const titleStyle = useMemo(() => getTitleStyle(darkMode), [darkMode]);
    const subtitleStyle = useMemo(() => getSubtitleStyle(darkMode), [darkMode]);
    const footnoteStyle = useMemo(() => getFootnoteStyle(darkMode), [darkMode]);
    const tooltipStyle = useMemo(() => getTooltipStyle(darkMode), [darkMode]);
    const infoButtonStyleMemo = useMemo(() => getInfoButtonStyle(darkMode), [darkMode]);
    const infoButtonHoverStyleMemo = useMemo(() => getInfoButtonHoverStyle(darkMode), [darkMode]);

    const handleInfoClick = useCallback((e: React.MouseEvent) => {
        e.stopPropagation();
        setWasClicked(true);
        setShowTooltip(prev => !prev);
    }, []);

    const handleMouseEnter = useCallback(() => {
        setIsHovered(true);
        if (!wasClicked) {
            setShowTooltip(true);
        }
    }, [wasClicked]);

    const handleMouseLeave = useCallback(() => {
        setIsHovered(false);
        if (!wasClicked) {
            setShowTooltip(false);
        }
    }, [wasClicked]);

    return (
        <div style={cardStyle}>
            <div style={headerStyle}>
                <div style={titleStyle}>{title}</div>
                {infoText && (
                    <button
                        type="button"
                        style={isHovered ? infoButtonHoverStyleMemo : infoButtonStyleMemo}
                        onClick={handleInfoClick}
                        onMouseEnter={handleMouseEnter}
                        onMouseLeave={handleMouseLeave}
                        aria-label="Mehr Informationen"
                    >
                        i
                    </button>
                )}
            </div>
            <div style={valueStyle}>{value}</div>
            {subtitle && !error && <div style={subtitleStyle}>{subtitle}</div>}
            {error && <div style={errorStyle}>{error}</div>}
            {footnote && <div style={footnoteStyle}>{footnote}</div>}
            {showTooltip && infoText && (
                <div style={tooltipStyle}>{infoText}</div>
            )}
        </div>
    );
});

StatCard.displayName = 'StatCard';

export default StatCard;
