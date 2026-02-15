---
name: data-services-integration
description: Integrate new CSV data services with Redux store architecture. Use when adding new data sources that need to be fetched per weather station and made accessible throughout the application via Redux selectors and custom hooks.
---

# Data Services Integration Skill

## Purpose

This skill enables implementation of new data services and their integration with the Redux store architecture. Use this when adding new CSV data sources or API endpoints that need to be accessible throughout the application.

## Prerequisites

Before using this skill, gather context via subagents:

```
// Launch in parallel:
Subagent 1: "Find all files in frontend/src/services/. Return: service function patterns, import utilities used."
Subagent 2: "Find frontend/src/store/factories/createDataSlice.ts. Return: full file contents, type parameters."
Subagent 3: "Find frontend/src/store/index.ts. Return: how reducers are registered, imports pattern."
Subagent 4: "Find frontend/src/store/slices/selectedCitySlice.ts. Return: how data fetches are triggered on city change."
```

## Implementation Steps

### Step 1: Define Types

Create or extend TypeScript types for your data structure.

**Location**: `frontend/src/classes/` or `frontend/src/types/`

```typescript
// Example: If using existing RollingAverageRecord structure
import type { RollingAverageRecordList } from '../classes/RollingAverageRecord.js';

// Or define new interface
export interface MyDataRecord {
    date: string;
    value: number;
    // ... other fields
}
export type MyDataRecordList = MyDataRecord[];
```

### Step 2: Create Data Service

**Location**: `frontend/src/services/MyDataService.ts`

**Pattern**:
```typescript
import { fetchAndParseCSV, parseOptionalFloat } from './utils/csvUtils.js';
import { buildUrl } from './utils/serviceUtils.js';
import type { MyDataRecordList } from '../types/MyData.js';

/**
 * Fetch [description] for a specific station.
 * 
 * Example CSV data:
 * 
 * date,column1,column2
 * 2024-01-01,value1,value2
 * 
 * @param {string} stationId - Station ID to fetch data for
 * @returns {Promise<MyDataRecordList>} Parsed data records
 */
export const fetchMyDataForStation = async (stationId: string): Promise<MyDataRecordList> => {
    return fetchAndParseCSV<MyDataRecordList>(
        buildUrl(`/data/path/to/${stationId}_data.csv`, false),
        (rows, headers) => {
            if (!headers || headers.length === 0 || headers[0] !== 'date') {
                throw new Error(`Unexpected header format for data of ${stationId}.`);
            }

            const records: MyDataRecordList = [];

            for (const columns of rows) {
                const dateRaw = columns[0];
                if (!dateRaw) continue;

                // Parse columns into record
                const record: MyDataRecord = {
                    date: dateRaw,
                    value: parseOptionalFloat(columns[1]) ?? 0,
                };
                
                records.push(record);
            }

            if (records.length === 0) {
                throw new Error(`No data found for ${stationId}.`);
            }

            return records;
        },
        {
            validateHeaders: ['date', 'column1'],
            errorContext: `data for station ${stationId}`
        }
    );
};
```

### Step 3: Create Redux Slice

**Location**: `frontend/src/store/slices/myDataSlice.ts`

**Pattern** (using createDataSlice factory):
```typescript
import { fetchMyDataForStation } from '../../services/MyDataService.js';
import type { RootState } from '../index.js';
import type { MyDataRecordList } from '../../types/MyData.js';
import { createDataSlice } from '../factories/createDataSlice.js';

export interface FetchMyDataArgs {
    stationId: string;
}

/**
 * Create myData slice using factory.
 * [Brief description of what this data represents]
 */
const { slice, actions, selectors } = createDataSlice<
    MyDataRecordList,
    FetchMyDataArgs,
    'simple'
>({
    name: 'myData',
    fetchFn: ({ stationId }) => fetchMyDataForStation(stationId),
    stateShape: 'simple',
    cache: { strategy: 'none' }, // No caching for station-specific data
});

// Empty constant to avoid creating new [] object every time
const EMPTY_DATA: MyDataRecordList = [];

// Export actions
export const fetchMyData = actions.fetch;
export const resetMyData = actions.reset;

// Export selectors
export const selectMyData = (state: RootState): MyDataRecordList =>
    selectors.selectData(state) as MyDataRecordList ?? EMPTY_DATA;
export const selectMyDataStatus = selectors.selectStatus;
export const selectMyDataError = selectors.selectError;

export default slice.reducer;
```

### Step 4: Register Slice in Store

**File**: `frontend/src/store/index.ts`

Add import and reducer registration:

```typescript
// Add import (maintain alphabetical order in imports section)
import myDataReducer from './slices/myDataSlice.js';

// Add to reducer object (maintain alphabetical order)
export const store = configureStore({
    reducer: {
        // ... existing reducers
        myData: myDataReducer,
        // ... existing reducers
    },
});
```

### Step 5: Wire Up Data Fetching Trigger

**File**: `frontend/src/store/slices/selectedCitySlice.ts`

Add the data fetch to the city selection flow:

```typescript
// Add imports
import { fetchMyData, resetMyData } from './myDataSlice.js';

// In the selectCity thunk, add reset and fetch:

// In the null case (city deselected):
if (!cityId) {
    dispatch(resetMyData());
    // ... existing resets
}

// In the city selection case:
dispatch(resetMyData());

// After successful fetch of other data, fetch new data:
if (stationId) {
    dispatch(fetchMyData({ stationId }));
}
```

### Step 6: Create Data Access Hook (Optional)

**Location**: `frontend/src/hooks/useMyData.ts`

Create a custom hook for convenient data access:

```typescript
import { useMemo } from 'react';
import { useAppSelector } from '../store/hooks/useAppSelector.js';
import {
    selectMyData,
    selectMyDataStatus,
    selectMyDataError,
} from '../store/slices/myDataSlice.js';

export interface MyDataState {
    data: MyDataRecordList;
    isLoading: boolean;
    error: string | null;
}

/**
 * Custom hook to access [description] data.
 */
export function useMyData(): MyDataState {
    const data = useAppSelector(selectMyData);
    const status = useAppSelector(selectMyDataStatus);
    const error = useAppSelector(selectMyDataError);

    const isLoading = status === 'loading' || status === 'idle';

    return useMemo(() => ({
        data,
        isLoading,
        error,
    }), [data, isLoading, error]);
}

export default useMyData;
```

## Validation Checklist

After implementation, verify:

1. **TypeScript compiles**: `cd frontend && npm run build`
2. **Imports use .js extension**: Even for .ts files
3. **Slice is registered**: Check store/index.ts includes new reducer
4. **Data triggers on city change**: Check selectedCitySlice.ts includes fetch/reset
5. **Empty constant defined**: Prevents unnecessary re-renders
6. **Error messages are descriptive**: Include station ID in error messages

## Common Files to Modify

| File | Change |
|------|--------|
| `frontend/src/services/NewService.ts` | NEW - Data fetching service |
| `frontend/src/store/slices/newSlice.ts` | NEW - Redux slice |
| `frontend/src/store/index.ts` | MODIFY - Register reducer |
| `frontend/src/store/slices/selectedCitySlice.ts` | MODIFY - Add fetch trigger |
| `frontend/src/hooks/useNewData.ts` | NEW (optional) - Data access hook |

## Reference Implementation

See `DailyAverageDataService.ts` and `dailyAverageDataSlice.ts` for a complete working example of this pattern.
