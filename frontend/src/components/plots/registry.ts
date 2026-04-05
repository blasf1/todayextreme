import { ACTIVE_COUNTRY_PROFILE } from '../../config/countryProfiles.js';

export interface PlotRegistryEntry {
    id: string;
    loader: () => Promise<{ default: React.ComponentType<any> }>;
}

const baseHeatmap: PlotRegistryEntry = {
    id: 'country-heatmap',
    loader: () => import('./HeatmapGermany/View'),
};

const defaultPlots: PlotRegistryEntry[] = [
    baseHeatmap,
    {
        id: 'historical-analysis',
        loader: () => import('./TemperatureAnomaliesByDayOverYears/View'),
    },
    {
        id: 'ice-and-hot-days',
        loader: () => import('./iceAndHotDays/View'),
    },
    {
        id: 'stats',
        loader: () => import('./Stats/View'),
    },
];

const spainPlots: PlotRegistryEntry[] = [
    baseHeatmap,
    {
        id: 'spain-normality-check',
        loader: () => import('./TodayNormality/View'),
    },
];

export const plots: PlotRegistryEntry[] = ACTIVE_COUNTRY_PROFILE.id === 'spain'
    ? spainPlots
    : defaultPlots;
