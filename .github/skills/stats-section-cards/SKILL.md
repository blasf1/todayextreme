---
name: stats-section-cards
description: Implement new static cards in the Klimastatistiken (climate statistics) section. Use when adding statistical displays like climate indices, averages, or classification systems that show calculated values with loading/error states and info tooltips.
---

# Stats Section Cards Skill

## Purpose

This skill enables implementation of new static cards in the "Klimastatistiken" (climate statistics) section. Use this when adding new statistical displays like climate indices, averages, or classification systems.

## Prerequisites

Before using this skill, gather context via subagents:

```
// Launch in parallel:
Subagent 1: "Find frontend/src/components/plots/Stats/. Return: all files, component structure, imports."
Subagent 2: "Find StatCard.tsx. Return: full component code, props interface, styling patterns."
Subagent 3: "Find StatsDarkModeContext.tsx. Return: context usage pattern, hook export."
Subagent 4: "Find frontend/src/styles/design-system.ts. Return: theme object structure, color tokens."
```

## Component Architecture

The Stats section follows this structure:

```
Stats/
├── View.tsx              # Main container, provides dark mode context
├── Top.tsx               # Section header with title and description
├── Bottom.tsx            # Container for stat cards
├── StatCard.tsx          # Reusable card component with info tooltip
└── StatsDarkModeContext.tsx  # Theme context for dark/light mode
```

## Implementation Steps

### Step 1: Create Utility Functions

**Location**: `frontend/src/utils/MyStatUtils.ts`

Calculate the statistic from available data:

```typescript
import type { RollingAverageRecordList } from '../classes/RollingAverageRecord.js';

export interface MyStatDetails {
    value: number | null;
    displayValue: string;
    // ... other computed properties
}

/**
 * Calculate [statistic description] from daily climate data.
 * 
 * @param data - Daily climate records with date, tas, tasmin, tasmax
 * @returns Calculated statistic details or null if insufficient data
 */
export function calculateMyStat(data: RollingAverageRecordList): MyStatDetails | null {
    if (!data || data.length === 0) {
        return null;
    }

    // Calculation logic here
    const value = /* ... calculation ... */;

    return {
        value,
        displayValue: `${value.toFixed(1)}°C`,
    };
}
```

### Step 2: Write Unit Tests

**Location**: `frontend/src/utils/MyStatUtils.test.ts`

```typescript
import { describe, it, expect } from 'vitest';
import { calculateMyStat } from './MyStatUtils.js';
import type { RollingAverageRecordList } from '../classes/RollingAverageRecord.js';

describe('calculateMyStat', () => {
    it('returns null for empty data', () => {
        expect(calculateMyStat([])).toBeNull();
    });

    it('calculates correctly for valid data', () => {
        const data: RollingAverageRecordList = [
            { date: '2024-01-01', tasmin: -5, tasmax: 5, tas: 0 },
            // ... test data
        ];
        
        const result = calculateMyStat(data);
        
        expect(result).not.toBeNull();
        expect(result?.value).toBe(/* expected value */);
    });

    // Add edge case tests
});
```

Run tests: `cd frontend && npm test -- --run src/utils/MyStatUtils`

### Step 3: Create Data Access Hook

**Location**: `frontend/src/hooks/useMyStat.ts`

```typescript
import { useMemo } from 'react';
import { useAppSelector } from '../store/hooks/useAppSelector.js';
import { useSelectedStationId } from '../store/hooks/hooks.js';
import {
    selectDailyAverageData,
    selectDailyAverageDataStatus,
    selectDailyAverageDataError,
} from '../store/slices/dailyAverageDataSlice.js';
import { calculateMyStat } from '../utils/MyStatUtils.js';

export interface MyStatState {
    value: string;
    subtitle: string;
    isLoading: boolean;
    error: string | null;
}

/**
 * Custom hook to calculate [statistic] for the currently selected station.
 */
export function useMyStat(): MyStatState {
    const stationId = useSelectedStationId();
    const dailyData = useAppSelector(selectDailyAverageData);
    const status = useAppSelector(selectDailyAverageDataStatus);
    const errorFromSlice = useAppSelector(selectDailyAverageDataError);

    const isLoading = status === 'loading' || status === 'idle';

    const statDetails = useMemo(() => {
        if (!stationId || status !== 'succeeded' || dailyData.length === 0) {
            return null;
        }
        return calculateMyStat(dailyData);
    }, [stationId, status, dailyData]);

    const error = useMemo(() => {
        if (errorFromSlice) return errorFromSlice;
        if (status === 'succeeded' && !statDetails) {
            return 'Nicht genügend Daten für die Berechnung verfügbar.';
        }
        return null;
    }, [errorFromSlice, status, statDetails]);

    return {
        value: statDetails?.displayValue ?? '—',
        subtitle: statDetails ? 'Beschreibung der Statistik' : '',
        isLoading,
        error,
    };
}

export default useMyStat;
```

### Step 4: Add Card to Bottom.tsx

**File**: `frontend/src/components/plots/Stats/Bottom.tsx`

Add the new stat card alongside existing cards:

```typescript
import { useMyStat } from '../../../hooks/useMyStat.js';

const StatsBottom = memo(() => {
    const myStat = useMyStat();
    // ... existing hooks

    return (
        <section style={sectionStyle}>
            {/* Existing cards */}
            
            <StatCard
                title="Mein Statistik-Titel"
                value={myStat.value}
                subtitle={myStat.subtitle}
                footnote="Basierend auf Wetterstationsdaten YYYY–YYYY"
                infoText="Erklärung der Statistik für Benutzer. Was bedeutet dieser Wert und wie wird er berechnet?"
                isLoading={myStat.isLoading}
                error={myStat.error}
            />
        </section>
    );
});
```

## StatCard Props Reference

| Prop | Type | Required | Description |
|------|------|----------|-------------|
| `title` | string | Yes | Card header (uppercase, small text) |
| `value` | string | Yes | Main display value (large text) |
| `subtitle` | string | No | Description below value |
| `footnote` | string | No | Small italic text at bottom |
| `infoText` | string | No | Tooltip text for info button |
| `isLoading` | boolean | No | Shows loading state |
| `error` | string \| null | No | Error message to display |
| `width` | number \| string | No | Card width (default: 280) |

## Dark/Light Mode Support

The StatCard automatically uses `useStatsDarkMode()` context. No additional work needed.

To control dark/light mode for the entire Stats section, modify `View.tsx`:

```typescript
// Set to false for light mode, true for dark mode
const DARK_MODE = false;
```

## Styling Guidelines

### Color Tokens

Use design system tokens for colors:

```typescript
import { theme } from '../../../styles/design-system.js';

// Dark mode
const darkColors = {
    text: theme.colors.textLight,
    value: theme.colors.textWhite,
};

// Light mode  
const lightColors = {
    text: theme.colors.textDark,
    value: theme.colors.textDark,
};
```

### Style Patterns

Always memoize styles:

```typescript
const myStyle = useMemo(() => ({
    fontSize: theme.typography.fontSize.md,
    fontWeight: theme.typography.fontWeight.medium,
    // ... other properties
}), [/* dependencies */]);
```

## Validation Checklist

After implementation, verify:

1. **Unit tests pass**: `cd frontend && npm test -- --run src/utils/MyStatUtils`
2. **TypeScript compiles**: `cd frontend && npm run build`
3. **Card displays correctly**: Check in browser with dev server
4. **Loading state works**: Card shows loading when data is fetching
5. **Error state works**: Card shows error when calculation fails
6. **Info tooltip works**: Hover and click show tooltip
7. **Dark/light mode**: Test both modes by changing `DARK_MODE` in View.tsx

## Common Files to Modify

| File | Change |
|------|--------|
| `frontend/src/utils/MyStatUtils.ts` | NEW - Calculation logic |
| `frontend/src/utils/MyStatUtils.test.ts` | NEW - Unit tests |
| `frontend/src/hooks/useMyStat.ts` | NEW - Data access hook |
| `frontend/src/components/plots/Stats/Bottom.tsx` | MODIFY - Add StatCard |

## Reference Implementation

See `HardinessZoneUtils.ts`, `useHardinessZone.ts`, and `Bottom.tsx` for a complete working example of this pattern (USDA Hardiness Zone implementation).

## Multiple Cards Layout

When adding multiple cards, use flexbox layout in Bottom.tsx:

```typescript
const sectionStyle: CSSProperties = {
    display: 'flex',
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: theme.spacing.lg,
    justifyContent: 'center',
    padding: theme.spacing.lg,
};
```

Cards will automatically wrap on smaller screens.
