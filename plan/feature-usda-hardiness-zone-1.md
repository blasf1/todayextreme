---
goal: Add USDA Hardiness Zone Stats Section to Weather Dashboard
version: 1.1
date_created: 2025-02-15
last_updated: 2025-02-15
change_notes: v1.1 - Made year range dynamic (last 30 complete years based on current date)
owner: Frontend Team
status: 'Planned'
tags: ['feature', 'frontend', 'climate-data', 'gardening', 'stats']
---

# Introduction

![Status: Planned](https://img.shields.io/badge/status-Planned-blue)

This plan adds a new "Stats" section to the weather dashboard that displays calculated statistics for the currently selected city. The first statistic will be the USDA Plant Hardiness Zone, calculated from historical minimum temperature data to reflect current climate conditions. This enables gardeners to make informed planting decisions based on actual local climate data rather than outdated approximations.

## 1. Requirements & Constraints

### Requirements

- **REQ-001**: Display a new Stats section below existing plots on the main page
- **REQ-002**: Show USDA Hardiness Zone (e.g., "7b") for the selected city's nearest weather station
- **REQ-003**: Calculate zone from Average Annual Extreme Minimum Temperature (AAEMT) using the last 30 complete years of data (dynamically calculated based on current date, e.g., Feb 2026 → 1996-2025)
- **REQ-004**: Include explanatory title and subtitle for the statistic
- **REQ-005**: Show loading state while calculating zone from historical data
- **REQ-006**: Handle missing data gracefully with appropriate fallback messaging
- **REQ-007**: Stats must update when user selects a different city

### Security Requirements

- **SEC-001**: No external API calls for zone calculation - all data already available locally

### Constraints

- **CON-001**: Must use existing `RollingAverageDataService` for temperature data (1951-2024 available)
- **CON-002**: Must follow existing component patterns (`createStackedPlotView` or similar)
- **CON-003**: Must use existing design system tokens from `design-system.ts`
- **CON-004**: Rolling average data provides `tasmin` (daily minimum temperature) in Celsius
- **CON-005**: Data available per station, not per city - must use nearest station approach

### Guidelines

- **GUD-001**: Follow existing code patterns in `frontend/src/components/plots/` directory
- **GUD-002**: Use TypeScript with proper interface definitions
- **GUD-003**: Use React hooks and memoization patterns consistent with existing components
- **GUD-004**: Responsive design using `useBreakpoint` hook

### Patterns to Follow

- **PAT-001**: Use `createStackedPlotView` for new section layout (simple top/bottom structure)
- **PAT-002**: Use Redux selectors from `selectedItemSelectors.ts` for accessing selected city/station
- **PAT-003**: Use custom hooks (prefixed `use`) for data fetching and calculations
- **PAT-004**: Style using inline `CSSProperties` with design system tokens

## 2. Implementation Steps

### Implementation Phase 1: Core Calculation Logic

- GOAL-001: Create utility functions for USDA hardiness zone calculation

| Task | Description | Completed | Date |
|------|-------------|-----------|------|
| TASK-001 | Create `HardinessZoneUtils.ts` in `/frontend/src/utils/` with zone calculation functions | | |
| TASK-002 | Implement `calculateAverageAnnualExtremeMinimum()` function to compute AAEMT from rolling average data | | |
| TASK-003 | Implement `getHardinessZoneYearRange()` function to calculate dynamic 30-year range based on current date | | |
| TASK-003b | Implement `getHardinessZone()` function to convert AAEMT to USDA zone string (e.g., "7b") | | |
| TASK-004 | Implement `getHardinessZoneDetails()` to return zone with temperature range description | | |
| TASK-005 | Add unit tests for zone calculation (create `HardinessZoneUtils.test.ts`) | | |

### Implementation Phase 2: React Hook for Zone Data

- GOAL-002: Create a custom hook to fetch and calculate hardiness zone for selected station

| Task | Description | Completed | Date |
|------|-------------|-----------|------|
| TASK-006 | Create `useHardinessZone.ts` hook in `/frontend/src/hooks/` | | |
| TASK-007 | Hook should use `selectSelectedStationId` selector to get current station | | |
| TASK-008 | Hook should fetch rolling average data using existing service | | |
| TASK-009 | Hook should calculate zone on data change and memoize result | | |
| TASK-010 | Hook should return `{ zone, temperatureRange, isLoading, error }` | | |

### Implementation Phase 3: Stats Section Components

- GOAL-003: Create the visual Stats section components

| Task | Description | Completed | Date |
|------|-------------|-----------|------|
| TASK-011 | Create directory `/frontend/src/components/plots/Stats/` | | |
| TASK-012 | Create `View.tsx` using `createStackedPlotView` pattern | | |
| TASK-013 | Create `Top.tsx` for section header ("Climate Statistics") | | |
| TASK-014 | Create `Bottom.tsx` containing the hardiness zone stat display | | |
| TASK-015 | Create `StatCard.tsx` - reusable component for displaying a single stat with title/subtitle/value | | |
| TASK-016 | Style components using design system tokens (dark mode consistent with other plots) | | |

### Implementation Phase 4: Integration

- GOAL-004: Integrate Stats section into the main application

| Task | Description | Completed | Date |
|------|-------------|-----------|------|
| TASK-017 | Add Stats entry to plot registry in `/frontend/src/components/plots/registry.ts` | | |
| TASK-018 | Ensure Stats section renders below existing plots (based on registry order) | | |
| TASK-019 | Verify Stats updates correctly when city selection changes | | |
| TASK-020 | Test on mobile/tablet/desktop breakpoints for responsive behavior | | |

### Implementation Phase 5: Types and Export Cleanup

- GOAL-005: Ensure proper TypeScript types and module exports

| Task | Description | Completed | Date |
|------|-------------|-----------|------|
| TASK-021 | Create `HardinessZone.ts` type definitions in `/frontend/src/classes/` | | |
| TASK-022 | Export new hook from hooks index (if one exists) | | |
| TASK-023 | Verify no TypeScript errors across all new files | | |

## 3. Alternatives

- **ALT-001**: Use last 20 years instead of 30 years for AAEMT calculation
  - *Rejected*: 30 years is WMO standard and provides statistical robustness while still capturing climate change effects. 20 years would be too volatile.

- **ALT-002**: Add Stats as a standalone component outside the plot registry
  - *Rejected*: Using the registry maintains consistency with existing architecture and enables lazy loading.

- **ALT-003**: Create a dedicated "Stats page" instead of section on main page
  - *Rejected*: For MVP, inline display is simpler and more discoverable. Could be evolved later.

- **ALT-004**: Use last 50 years for calculation
  - *Rejected*: Too much historical data dilutes the signal of recent climate change. The goal is to reflect current planting conditions, not long-term averages.

- **ALT-005**: Fetch zone from external API
  - *Rejected*: All necessary data already available locally; calculation is straightforward and keeps the app self-contained.

## 4. Dependencies

- **DEP-001**: `RollingAverageDataService.ts` - provides daily tasmin data from 1951-2024
- **DEP-002**: `selectedItemSelectors.ts` - provides `selectSelectedStationId` selector
- **DEP-003**: `design-system.ts` - provides theme tokens for styling
- **DEP-004**: `createStackedPlotView.tsx` - factory for creating consistent section layouts
- **DEP-005**: `useBreakpoint.ts` - hook for responsive design

## 5. Files

| ID | Path | Action | Description |
|----|------|--------|-------------|
| FILE-001 | `frontend/src/utils/HardinessZoneUtils.ts` | NEW | Zone calculation utilities |
| FILE-002 | `frontend/src/utils/HardinessZoneUtils.test.ts` | NEW | Unit tests for zone calculations |
| FILE-003 | `frontend/src/hooks/useHardinessZone.ts` | NEW | Custom hook for zone data |
| FILE-004 | `frontend/src/components/plots/Stats/View.tsx` | NEW | Stats section main component |
| FILE-005 | `frontend/src/components/plots/Stats/Top.tsx` | NEW | Section header component |
| FILE-006 | `frontend/src/components/plots/Stats/Bottom.tsx` | NEW | Stats content component |
| FILE-007 | `frontend/src/components/plots/Stats/StatCard.tsx` | NEW | Reusable stat display card |
| FILE-008 | `frontend/src/classes/HardinessZone.ts` | NEW | Type definitions |
| FILE-009 | `frontend/src/components/plots/registry.ts` | MODIFY | Add Stats to plot registry |

## 6. Testing

- **TEST-001**: Unit test `getHardinessZoneYearRange()` - Feb 2026 → { startYear: 1996, endYear: 2025 }
- **TEST-002**: Unit test `getHardinessZoneYearRange()` - Jan 2027 → { startYear: 1997, endYear: 2026 }
- **TEST-003**: Unit test `calculateAverageAnnualExtremeMinimum()` with known dataset, verify correct AAEMT
- **TEST-004**: Unit test `getHardinessZone()` with boundary values (e.g., -17.8°C = 7a, -15.0°C = 7b)
- **TEST-005**: Unit test zone calculation with edge cases (empty data, single year of data)
- **TEST-006**: Integration test: selecting a city loads and displays correct zone
- **TEST-007**: Visual test: verify Stats section renders correctly on all breakpoints
- **TEST-008**: Test loading state appears while data is being fetched
- **TEST-009**: Test error state displays when station data is unavailable

## 7. Risks & Assumptions

### Risks

- **RISK-001**: Rolling average data may have gaps for some stations
  - **Mitigation**: Filter years with insufficient data; require minimum 20 years of valid data for calculation
  
- **RISK-002**: Zone calculation may differ slightly from official USDA maps
  - **Mitigation**: Clearly label as "calculated from local station data" in subtitle
  
- **RISK-003**: Performance impact from processing 30 years of daily data
  - **Mitigation**: Calculate on demand and memoize; data is already fetched for other features

### Assumptions

- **ASSUMPTION-001**: Rolling average data `tasmin` is accurate daily minimum temperature
- **ASSUMPTION-002**: Nearest station provides representative data for the city
- **ASSUMPTION-003**: Rolling average dataset includes data through the previous complete year (data available 1951-2024, updated annually)
- **ASSUMPTION-004**: Users understand USDA hardiness zones (gardening context)

## 8. Multi-Agent Execution Notes

### Execution Order

- **Parallel tasks**: TASK-001 through TASK-005 (Phase 1) can run in parallel with type definitions (TASK-021)
- **Sequential dependencies**:
  - Phase 1 (utils) → Phase 2 (hook) → Phase 3 (components) → Phase 4 (integration)
  - TASK-006 requires TASK-001 to TASK-004 completed
  - TASK-012 through TASK-016 require TASK-006 completed
  - TASK-017 requires TASK-012 completed

### Agent Context Requirements

- Agent needs access to existing rolling average data structure (see Code Reference 10.1)
- Agent should follow existing component patterns (see Code Reference 10.3)
- Agent must use design system tokens (see Code Reference 10.5)

### Validation Checkpoints

- **After TASK-005**: Run unit tests to verify zone calculation accuracy
- **After TASK-010**: Verify hook returns correct data structure with console logging
- **After Phase 3**: Visual inspection of Stats section in browser
- **After Phase 4**: Full integration test with city selection changes

## 9. Related Specifications / Further Reading

- [USDA Plant Hardiness Zone Map](https://planthardiness.ars.usda.gov/)
- [WMO Climate Normals](https://public.wmo.int/en/programmes/global-climate-observing-system/data/climate-normals)
- Existing plot components in `frontend/src/components/plots/`

## 10. Code Reference (REQUIRED)

### 10.1 Rolling Average Data Service

**File**: `frontend/src/services/RollingAverageDataService.ts`

```typescript
import { RollingAverageRecordBuilder, type RollingAverageRecordList } from '../classes/RollingAverageRecord';
import { fetchAndParseCSV, parseOptionalFloat } from './utils/csvUtils.js';
import { buildUrl } from './utils/serviceUtils.js';

export const fetchRollingAverageForStation = async (stationId: string): Promise<RollingAverageRecordList> => {
    return fetchAndParseCSV<RollingAverageRecordList>(
        buildUrl(`/data/rolling_average/1951_2024/daily/${stationId}_1951-2024_avg_7d.csv`, false),
        (rows, headers) => {
            // Parses CSV with columns: date, tas, tasmin, tasmax, hurs
            // Returns array of { date, tasmin, tasmax, tas, hurs }
        }
    );
};
```

**Data format (CSV)**:
```csv
date,tas,tasmin,tasmax,hurs
1951-01-01,0.9,-2.1,3.5,82
1951-01-02,1.24,-1.5,4.2,79
```

### 10.2 Rolling Average Record Type

**File**: `frontend/src/classes/RollingAverageRecord.ts`

```typescript
export type RollingAverageMetricKey = 'tas' | 'tasmin' | 'tasmax' | 'hurs' | string;

export interface RollingAverageRecordJSON {
    date: string;
    tas?: number;      // mean temperature (°C)
    tasmin?: number;   // minimum temperature (°C)
    tasmax?: number;   // maximum temperature (°C)
    hurs?: number;     // humidity (%)
    [metric: string]: number | string | undefined;
}

export type RollingAverageRecordList = RollingAverageRecordJSON[];
```

### 10.3 Selected Station Selector

**File**: `frontend/src/store/selectors/selectedItemSelectors.ts`

```typescript
import { createSelector } from '@reduxjs/toolkit';

export const selectSelectedStationId = createSelector(
    [selectSelectedCityId, selectCitiesJSON],
    (cityId, cities): string | null => {
        if (!cityId || !cities) return null;
        return cities[cityId]?.stationId ?? null;
    }
);

export const selectSelectedCityName = createSelector(
    [selectSelectedCityId, selectCitiesJSON],
    (cityId, cities): string | null => {
        if (!cityId || !cities) return null;
        return cities[cityId]?.name ?? null;
    }
);
```

### 10.4 createStackedPlotView Pattern

**File**: `frontend/src/components/common/PlotView/createStackedPlotView.tsx`

```typescript
import React from 'react';
import StackedPlotView from './StackedPlotView.js';

interface CreateStackedPlotViewOptions {
    topContent: React.ComponentType;
    bottomContent: React.ComponentType;
    config: {
        darkMode?: boolean;
    };
    useShouldRender?: () => boolean;
}

export const createStackedPlotView = (options: CreateStackedPlotViewOptions) => {
    const StackedPlotViewComponent = () => {
        const shouldRender = options.useShouldRender ? options.useShouldRender() : true;
        if (!shouldRender) return null;

        const TopComp = options.topContent;
        const BottomComp = options.bottomContent;

        return (
            <StackedPlotView
                topContent={<TopComp />}
                bottomContent={<BottomComp />}
                {...options.config}
            />
        );
    };
    return React.memo(StackedPlotViewComponent);
};
```

**Example usage** (from `iceAndHotDays/View.tsx`):
```typescript
import { createStackedPlotView } from '../../common/PlotView/createStackedPlotView.js';
import IceAndHotDaysTop from './Top.js';
import IceAndHotDaysBottom from './Bottom.js';

const IceAndHotDays = createStackedPlotView({
    topContent: IceAndHotDaysTop,
    bottomContent: IceAndHotDaysBottom,
    config: { darkMode: true },
});

export default IceAndHotDays;
```

### 10.5 Design System Tokens

**File**: `frontend/src/styles/design-system.ts`

```typescript
export const theme = {
    spacing: {
        none: 0, xs: 4, sm: 8, md: 15, lg: 20, xl: 30, xxl: 40,
    },
    colors: {
        background: '#222222',
        backgroundLight: '#eeeeee',
        textDark: '#222222',
        textLight: '#dddddd',
        textWhite: '#ffffff',
        plotDark: {
            background: '#222222',
            foreground: '#eeeeee',
            text: '#eeeeee',
        },
    },
    typography: {
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
        fontSize: { xs: '12px', sm: '14px', md: '16px', lg: '18px', xl: '20px', xxl: '24px', title: '1.5rem' },
        fontWeight: { normal: 400, medium: 500, bold: 700 },
    },
    breakpoints: { mobile: 480, tablet: 768, desktop: 1024, wide: 1440 },
};
```

### 10.6 Plot Registry

**File**: `frontend/src/components/plots/registry.ts`

```typescript
export interface PlotRegistryEntry {
    id: string;
    loader: () => Promise<{ default: React.ComponentType<any> }>;
}

export const plots: PlotRegistryEntry[] = [
    { id: 'country-heatmap', loader: () => import('./HeatmapGermany/View') },
    { id: 'historical-analysis', loader: () => import('./TemperatureAnomaliesByDayOverYears/View') },
    { id: 'ice-and-hot-days', loader: () => import('./iceAndHotDays/View') },
    // Add Stats entry here:
    // { id: 'stats', loader: () => import('./Stats/View') },
];
```

### 10.7 USDA Hardiness Zone Calculation Algorithm

**Reference implementation** (to be placed in `HardinessZoneUtils.ts`):

```typescript
/**
 * USDA Hardiness Zones temperature boundaries (in Celsius)
 * Each zone spans ~5.6°C, sub-zones span ~2.8°C
 */
export const HARDINESS_ZONES = [
    { zone: '1a', minC: -51.1, maxC: -48.3 },
    { zone: '1b', minC: -48.3, maxC: -45.6 },
    { zone: '2a', minC: -45.6, maxC: -42.8 },
    { zone: '2b', minC: -42.8, maxC: -40.0 },
    { zone: '3a', minC: -40.0, maxC: -37.2 },
    { zone: '3b', minC: -37.2, maxC: -34.4 },
    { zone: '4a', minC: -34.4, maxC: -31.7 },
    { zone: '4b', minC: -31.7, maxC: -28.9 },
    { zone: '5a', minC: -28.9, maxC: -26.1 },
    { zone: '5b', minC: -26.1, maxC: -23.3 },
    { zone: '6a', minC: -23.3, maxC: -20.6 },
    { zone: '6b', minC: -20.6, maxC: -17.8 },
    { zone: '7a', minC: -17.8, maxC: -15.0 },
    { zone: '7b', minC: -15.0, maxC: -12.2 },
    { zone: '8a', minC: -12.2, maxC: -9.4 },
    { zone: '8b', minC: -9.4, maxC: -6.7 },
    { zone: '9a', minC: -6.7, maxC: -3.9 },
    { zone: '9b', minC: -3.9, maxC: -1.1 },
    { zone: '10a', minC: -1.1, maxC: 1.7 },
    { zone: '10b', minC: 1.7, maxC: 4.4 },
    { zone: '11a', minC: 4.4, maxC: 7.2 },
    { zone: '11b', minC: 7.2, maxC: 10.0 },
    { zone: '12a', minC: 10.0, maxC: 12.8 },
    { zone: '12b', minC: 12.8, maxC: 15.6 },
    { zone: '13a', minC: 15.6, maxC: 18.3 },
    { zone: '13b', minC: 18.3, maxC: 21.1 },
];

/**
 * Get the year range for AAEMT calculation (last 30 complete years)
 * 
 * @param currentDate - Current date (defaults to now)
 * @returns { startYear, endYear } - e.g., for Feb 2026 returns { startYear: 1996, endYear: 2025 }
 */
export function getHardinessZoneYearRange(currentDate: Date = new Date()): { startYear: number; endYear: number } {
    const currentYear = currentDate.getFullYear();
    // Use the last complete year (previous year) as end year
    const endYear = currentYear - 1;
    // Start year is 30 years before the end year (inclusive, so 29 years back)
    const startYear = endYear - 29;
    return { startYear, endYear };
}

/**
 * Calculate Average Annual Extreme Minimum Temperature (AAEMT)
 * 
 * @param records - Rolling average records with tasmin values
 * @param startYear - First year to include (default: dynamically calculated)
 * @param endYear - Last year to include (default: dynamically calculated)
 * @returns AAEMT in Celsius, or null if insufficient data
 */
export function calculateAverageAnnualExtremeMinimum(
    records: RollingAverageRecordList,
    startYear?: number,
    endYear?: number
): number | null {
    // If years not provided, calculate dynamically
    if (startYear === undefined || endYear === undefined) {
        const range = getHardinessZoneYearRange();
        startYear = range.startYear;
        endYear = range.endYear;
    }
    // Group records by year
    const yearlyMinimums: Map<number, number> = new Map();
    
    for (const record of records) {
        if (record.tasmin === undefined) continue;
        
        const year = parseInt(record.date.substring(0, 4), 10);
        if (year < startYear || year > endYear) continue;
        
        const currentMin = yearlyMinimums.get(year);
        if (currentMin === undefined || record.tasmin < currentMin) {
            yearlyMinimums.set(year, record.tasmin);
        }
    }
    
    // Require at least 20 years of data
    if (yearlyMinimums.size < 20) return null;
    
    // Calculate average
    const sum = Array.from(yearlyMinimums.values()).reduce((a, b) => a + b, 0);
    return sum / yearlyMinimums.size;
}

/**
 * Get USDA hardiness zone from AAEMT
 * 
 * @param aaemtCelsius - Average Annual Extreme Minimum Temperature in Celsius
 * @returns Zone string (e.g., "7b") or null if out of range
 */
export function getHardinessZone(aaemtCelsius: number): string | null {
    for (const zone of HARDINESS_ZONES) {
        if (aaemtCelsius >= zone.minC && aaemtCelsius < zone.maxC) {
            return zone.zone;
        }
    }
    // Handle extremes
    if (aaemtCelsius < -51.1) return '1a';
    if (aaemtCelsius >= 21.1) return '13b';
    return null;
}
```

### 10.8 useBreakpoint Hook Pattern

**File**: `frontend/src/hooks/useBreakpoint.ts`

```typescript
export type Breakpoint = 'mobile' | 'tablet' | 'desktop' | 'wide';

export const useBreakpoint = (): Breakpoint => {
    const [breakpoint, setBreakpoint] = useState<Breakpoint>(getBreakpoint());
    
    useEffect(() => {
        const handleResize = () => setBreakpoint(getBreakpoint());
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);
    
    return breakpoint;
};

// Usage in components:
const breakpoint = useBreakpoint();
const isMobile = breakpoint === 'mobile';
```

### 10.9 Hooks from Store

**File**: `frontend/src/store/hooks/hooks.ts` (partial)

```typescript
import { useSelector, useDispatch } from 'react-redux';
import type { RootState, AppDispatch } from '../index';

export const useAppDispatch = () => useDispatch<AppDispatch>();
export const useAppSelector = <T>(selector: (state: RootState) => T) => useSelector(selector);

// Convenience hooks
export const useSelectedStationId = (): string | null => {
    return useAppSelector(selectSelectedStationId);
};

export const useSelectedCityName = (): string | null => {
    return useAppSelector(selectSelectedCityName);
};
```
