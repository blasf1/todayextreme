export type ColorSchemeName = 'BlueWhiteRed' | 'Turbo' | 'BlueRed';

interface ColorStop {
    threshold: number;
    color: string;
}

const blueWhiteRedScheme: ColorStop[] = [
    { threshold: -10, color: "#13437D" },
    { threshold: -8, color: "#07579C" },
    { threshold: -6, color: "#3A7D9D" },
    { threshold: -4, color: "#78BFD6" },
    { threshold: -2, color: "#DBF6FF" },
    { threshold: 0, color: "#FFFFFF" },
    { threshold: 2, color: "#FFE0E0" },
    { threshold: 4, color: "#FB9171" },
    { threshold: 6, color: "#F03C2B" },
    { threshold: 8, color: "#A60F13" },
    { threshold: 10, color: "#5F0000" }
];

const turboScheme: ColorStop[] = [
    { threshold: -10, color: "#23171B" },
    { threshold: -8, color: "#4B48C3" },
    { threshold: -6, color: "#238FF8" },
    { threshold: -4, color: "#25CECF" },
    { threshold: -2, color: "#44F58D" },
    { threshold: 0, color: "#8AFC56" },
    { threshold: 2, color: "#D8E135" },
    { threshold: 4, color: "#FFA924" },
    { threshold: 6, color: "#F86218" },
    { threshold: 8, color: "#BC2309" },
    { threshold: 10, color: "#900C00" }
];

const blueRedScheme: ColorStop[] = [
    { threshold: -10, color: "#1058a0" },
    { threshold: -8, color: "#3787c0" },
    { threshold: -6, color: "#5fa5d1" },
    { threshold: -4, color: "#8fc1de" },
    { threshold: -2, color: "#bbd7eb" },
    { threshold: 0, color: "#ffffcc" },
    { threshold: 2, color: "#ffe896" },
    { threshold: 4, color: "#fec763" },
    { threshold: 6, color: "#fd9741" },
    { threshold: 8, color: "#f9542c" },
    { threshold: 10, color: "#cd0c22" },
];

/** Generates a color for the provided temperature anomaly. */
export const getAnomalyColor = (
    anomaly: number | null | undefined,
    colorScheme?: ColorSchemeName,
): string => {
    let scheme: ColorStop[];
    if (!colorScheme || colorScheme === 'BlueWhiteRed') {
        scheme = blueWhiteRedScheme;
    } else if (colorScheme === 'Turbo') {
        scheme = turboScheme;
    } else {
        throw new Error(`Unknown color scheme: ${colorScheme}`);
    }

    if (anomaly === null || anomaly === undefined || Number.isNaN(anomaly) || !Number.isFinite(anomaly)) {
        return '#aaaaaa';
    }

    for (let i = 0; i < scheme.length - 1; i += 1) {
        const current = scheme[i];
        const next = scheme[i + 1];

        if (!current || !next) {
            continue;
        }
        if (anomaly >= current.threshold && anomaly <= next.threshold) {
            const ratio = (anomaly - current.threshold) / (next.threshold - current.threshold);
            return interpolateColor(current.color, next.color, ratio);
        }
    }

    const firstStop = scheme[0];
    if (firstStop && anomaly < firstStop.threshold) {
        return firstStop.color;
    }
    const lastStop = scheme[scheme.length - 1];
    return lastStop ? lastStop.color : '#aaaaaa';
};

/**
 * Converts RGB values to a hex color string
 * @param rgb Tuple of [red, green, blue] values (0-255)
 * @returns Hex color string (e.g., "#FF00FF")
 */
export function rgbToHex(rgb: [number, number, number]): string {
    return `#${rgb
        .map((v) => {
            const hex = Math.round(v).toString(16);
            return hex.length === 1 ? `0${hex}` : hex;
        })
        .join('')}`;
}

/**
 * Interpolates between two hex colors
 * @param {string} color1 - Starting hex color
 * @param {string} color2 - Ending hex color
 * @param {number} ratio - Value between 0 and 1
 * @returns {string} - Interpolated hex color
 */
function interpolateColor(color1: string, color2: string, ratio: number): string {
    const hex2rgb = (hex: string): [number, number, number] => {
        const r = parseInt(hex.slice(1, 3), 16);
        const g = parseInt(hex.slice(3, 5), 16);
        const b = parseInt(hex.slice(5, 7), 16);
        return [r, g, b];
    };

    const rgb1 = hex2rgb(color1);
    const rgb2 = hex2rgb(color2);
    const clampedRatio = Math.min(Math.max(ratio, 0), 1);
    const rgb: [number, number, number] = [
        rgb1[0] + (rgb2[0] - rgb1[0]) * clampedRatio,
        rgb1[1] + (rgb2[1] - rgb1[1]) * clampedRatio,
        rgb1[2] + (rgb2[2] - rgb1[2]) * clampedRatio,
    ];

    return rgbToHex(rgb);
}

export interface TemperatureAnomalyDetails {
    comparisonMessage: string;
    anomalyMessage: string;
}

/** Returns localized strings describing a temperature anomaly. */
export const analyzeTemperatureAnomaly = (
    isLiveData: boolean,
    anomaly: number | null | undefined,
): TemperatureAnomalyDetails => {
    if (anomaly === undefined || anomaly === null) {
        return {
            comparisonMessage: 'Not enough information.',
            anomalyMessage: 'No historical data available.',
        };
    }

    const tenseVerb = isLiveData ? 'is' : 'was';
    let comparisonMessage: string;

    if (anomaly <= -10) {
        comparisonMessage = `It ${tenseVerb} freezing!`;
    } else if (anomaly <= -8) {
        comparisonMessage = `It ${tenseVerb} very cold!`;
    } else if (anomaly <= -6) {
        comparisonMessage = `It ${tenseVerb} cold!`;
    } else if (anomaly <= -4) {
        comparisonMessage = `It ${tenseVerb} quite chilly!`;
    } else if (anomaly <= -2) {
        comparisonMessage = `It ${tenseVerb} cool`;
    } else if (anomaly === 0) {
        comparisonMessage = `It ${tenseVerb} exactly average`;
    } else if (anomaly < 2) {
        comparisonMessage = `It ${tenseVerb} fairly normal`;
    } else if (anomaly < 4) {
        comparisonMessage = `It ${tenseVerb} warm`;
    } else if (anomaly < 6) {
        comparisonMessage = `It ${tenseVerb} very warm!`;
    } else if (anomaly < 8) {
        comparisonMessage = `It ${tenseVerb} hot!`;
    } else if (anomaly < 10) {
        comparisonMessage = `It ${tenseVerb} very hot!`;
    } else {
        comparisonMessage = `It ${tenseVerb} scorching hot!`;
    }

    const anomalyMagnitude = Math.abs(anomaly).toFixed(1);
    const direction = anomaly > 0 ? 'above' : 'below';

    const anomalyMessage = isLiveData
        ? `The most recent measured temperature was ${anomalyMagnitude}\u00A0°C ${direction} the historical hourly mean.`
        : `The maximum measured temperature was ${anomalyMagnitude}\u00A0°C ${direction} the historical maximum mean.`;

    return {
        comparisonMessage,
        anomalyMessage,
    };
};

/**
 * Maps a value to a color in the given scheme, using the outermost color for outliers.
 * @param value The value to map.
 * @param domain [min, max] domain for the "normal" range.
 * @param colorScheme The color scheme to use.
 */
export function getPercentileColor(
    value: number,
    domain: [number, number],
    colorScheme: ColorSchemeName = 'Turbo'
): string {
    let scheme: ColorStop[];
    switch (colorScheme) {
        case 'Turbo':
            scheme = turboScheme;
            break;
        case 'BlueWhiteRed':
            scheme = blueWhiteRedScheme;
            break;
        case 'BlueRed':
            scheme = blueRedScheme;
            break;
        default:
            throw new Error(`Unknown color scheme: ${colorScheme}`);
    }
    const min = domain[0];
    const max = domain[1];

    if (value <= min) {
        return scheme[0]!.color;
    }
    if (value >= max) {
        return scheme[scheme.length - 1]!.color;
    }

    // Map value to [0, 1] within domain and interpolate between indices 1 to length-2
    for (let i = 1; i < scheme.length - 1; i++) {
        const t0 = min + ((max - min) * (i - 1)) / (scheme.length - 2);
        const t1 = min + ((max - min) * i) / (scheme.length - 2);
        if (value >= t0 && value <= t1) {
            const localRatio = (value - t0) / (t1 - t0);
            return interpolateColor(scheme[i]!.color, scheme[i + 1]!.color, localRatio);
        }
    }
    // Fallback
    return scheme[scheme.length - 1]!.color;
}

/**
 * Maps a value to a color in the given scheme, respecting a pivot point, which must be a threshold in the specified scheme.
 * Negative values map to the blue side (indices 0 to midpoint), positive values map to the red side (midpoint to end).
 * @param value The value to map.
 * @param domain [min, max] domain for the "normal" range.
 * @param colorScheme The color scheme to use.
 * @param pivotPoint The pivot point (usually 0).
 */
export function getPercentileColorWithPivot(
    value: number,
    domain: [number, number],
    colorScheme: ColorSchemeName = 'Turbo',
    pivotPoint: number = 0,
): string {
    let scheme: ColorStop[];
    switch (colorScheme) {
        case 'Turbo':
            scheme = turboScheme;
            break;
        case 'BlueWhiteRed':
            scheme = blueWhiteRedScheme;
            break;
        case 'BlueRed':
            scheme = blueRedScheme;
            break;
        default:
            throw new Error(`Unknown color scheme: ${colorScheme}`);
    }

    const min = domain[0];
    const max = domain[1];

    // Outliers: use outermost colors
    if (value <= min) {
        return scheme[0]!.color;
    }
    if (value >= max) {
        return scheme[scheme.length - 1]!.color;
    }

    const midpoint = scheme.findIndex(stop => stop.threshold === pivotPoint);

    if (value < pivotPoint) {
        // Negative side: map to blue side (1 to midpoint)
        const negativeRatio = (value - min) / (pivotPoint - min);
        const schemeIndex = 1 + negativeRatio * (midpoint - 1);

        const lowerIndex = Math.floor(schemeIndex);
        const upperIndex = Math.ceil(schemeIndex);
        const localRatio = schemeIndex - lowerIndex;

        if (lowerIndex === upperIndex) {
            return scheme[lowerIndex]!.color;
        }

        return interpolateColor(
            scheme[lowerIndex]!.color,
            scheme[upperIndex]!.color,
            localRatio
        );
    } else {
        // Positive side: map to red side (midpoint to length-2)
        const positiveRatio = (value - pivotPoint) / (max - pivotPoint);
        const schemeIndex = midpoint + positiveRatio * (scheme.length - 2 - midpoint);

        const lowerIndex = Math.floor(schemeIndex);
        const upperIndex = Math.ceil(schemeIndex);
        const localRatio = schemeIndex - lowerIndex;

        if (lowerIndex === upperIndex) {
            return scheme[lowerIndex]!.color;
        }

        return interpolateColor(
            scheme[lowerIndex]!.color,
            scheme[upperIndex]!.color,
            localRatio
        );
    }
}

