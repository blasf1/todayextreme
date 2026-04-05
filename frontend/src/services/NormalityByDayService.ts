import { fetchAndParseCSV, parseOptionalFloat, parseOptionalInt } from './utils/csvUtils.js';
import { buildUrl } from './utils/serviceUtils.js';
import { ACTIVE_COUNTRY_PROFILE } from '../config/countryProfiles.js';
import { getNow } from '../utils/dateUtils.js';

export interface NormalityRecord {
    stationId: string;
    year: number;
    tas: number;
    tasmin?: number;
    tasmax?: number;
}

export const fetchNormalityByDayData = async (month: number, day: number): Promise<NormalityRecord[]> => {
    const parseRows = (rows: string[][]): NormalityRecord[] => {
        const records: NormalityRecord[] = [];

        for (const [stationIdRaw, yearRaw, tasRaw, tasminRaw, tasmaxRaw] of rows) {
            if (!stationIdRaw) continue;

            const year = parseOptionalInt(yearRaw);
            const tas = parseOptionalFloat(tasRaw);
            if (year === undefined || tas === undefined) continue;

            records.push({
                stationId: stationIdRaw,
                year,
                tas,
                tasmin: parseOptionalFloat(tasminRaw),
                tasmax: parseOptionalFloat(tasmaxRaw),
            });
        }

        return records;
    };

    const today = getNow();
    const candidates: Array<{ month: number; day: number }> = [{ month, day }];
    for (let offset = 1; offset <= 3; offset += 1) {
        const candidate = today.minus({ days: offset });
        candidates.push({ month: candidate.month, day: candidate.day });
    }

    let lastError: unknown = null;

    for (const candidate of candidates) {
        const formattedMonth = String(candidate.month).padStart(2, '0');
        const formattedDay = String(candidate.day).padStart(2, '0');
        const path = `${ACTIVE_COUNTRY_PROFILE.dataRoot}/normality_by_day/${formattedMonth}_${formattedDay}.csv`;

        try {
            return await fetchAndParseCSV<NormalityRecord[]>(
                buildUrl(path, true, 'yyyyLLddHH'),
                parseRows,
                {
                    validateHeaders: ['station_id', 'year', 'tas'],
                    errorContext: `normality data for ${formattedMonth}/${formattedDay}`,
                }
            );
        } catch (error) {
            lastError = error;
            const message = error instanceof Error ? error.message : '';
            const isNotFound = message.includes('404');
            const hasMissingHeaders = message.includes('Missing required headers');
            if (!isNotFound && !hasMissingHeaders) {
                throw error;
            }
        }
    }

    if (lastError instanceof Error && lastError.message.includes('Missing required headers')) {
        return [];
    }

    return [];
};
