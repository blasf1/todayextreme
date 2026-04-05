import { useMemo } from 'react';
import { DateTime } from 'luxon';
import type { SelectedItem } from '../../../store/selectors/selectedItemSelectors.js';
import { useSelectedItem } from '../../../store/hooks/hooks.js';
import { useSelectedDate } from '../../../store/slices/selectedDateSlice.js';
import { useYearlyMeanByDayData } from '../../../store/slices/YearlyMeanByDaySlice.js';
import { useReferenceYearlyHourlyInterpolatedByDayData } from '../../../store/slices/ReferenceYearlyHourlyInterpolatedByDaySlice.js';
import { analyzeTemperatureAnomaly } from '../../../utils/TemperatureUtils.js';
import { getNow } from '../../../utils/dateUtils.js';

interface AnomalyDetails {
    comparisonMessage: string;
    anomalyMessage: string;
}

const replaceSpacesWithNbsp = (value: string): string => value.replace(/\s/g, '&nbsp;');

export interface StationDetailsData {
    item: SelectedItem | null;
    anomaly: number | null;
    subtitle: string;
    anomalyDetails: AnomalyDetails | null;
    isToday: boolean;
}

export const useStationDetailsData = (): StationDetailsData => {
    const selectedItem = useSelectedItem();
    const selectedDate = useSelectedDate();
    const yearlyMeanByDayData = useYearlyMeanByDayData();
    const referenceYearlyHourlyInterpolatedByDayData = useReferenceYearlyHourlyInterpolatedByDayData();

    return useMemo(() => {
        // If no item selected, return empty state
        if (!selectedItem) {
            return {
                item: null,
                anomaly: null,
                subtitle: '',
                anomalyDetails: null,
                isToday: false,
            };
        }

        const luxonDate = DateTime.fromISO(selectedDate);
        const now = getNow();
        const isToday = luxonDate.hasSame(now, 'day');

        let subtitle = '';
        if (selectedItem.data.date) {
            let date;
            if (isToday) {
                date = DateTime.fromFormat(selectedItem.data.date, 'dd.MM.yyyy HH:mm', { zone: 'Europe/Berlin' });
            } else {
                date = DateTime.fromFormat(selectedItem.data.date, 'yyyyMMdd', { zone: 'Europe/Berlin' });
            }

            if (date && date.isValid) {
                const localizedDate = date.setLocale('en');
                if (isToday) {
                    const formattedDateTime = localizedDate.toLocaleString({
                        ...DateTime.DATE_FULL,
                        hour: '2-digit',
                        minute: '2-digit',
                        hour12: false
                    });
                    subtitle = `<span class="nowrap">${replaceSpacesWithNbsp(formattedDateTime)}</span>`;
                } else {
                    const formattedDate = localizedDate.toLocaleString(DateTime.DATE_FULL);
                    subtitle = `<span class="nowrap">${replaceSpacesWithNbsp(formattedDate)}</span>`;
                }
            }
        }

        // Calculate anomaly
        let anomaly: number | null = null;

        if (isToday) {
            if (referenceYearlyHourlyInterpolatedByDayData) {
                const { data, month, day } = referenceYearlyHourlyInterpolatedByDayData;
                if (data && month === luxonDate.month && day === luxonDate.day) {
                    const hourlyData = data[selectedItem.station.id];
                    if (hourlyData) {
                        const hour = DateTime.fromFormat(selectedItem.data.date, 'dd.MM.yyyy HH:mm', { zone: 'Europe/Berlin' }).hour;
                        const currentTemperature = selectedItem.data.temperature ?? null;
                        if (currentTemperature !== null) {
                            const referenceTemperature = hourlyData[`hour_${hour}`];
                            if (referenceTemperature !== undefined && referenceTemperature !== null) {
                                anomaly = Math.round((currentTemperature - referenceTemperature) * 10) / 10;
                            }
                        }
                    }
                }
            }
        } else {
            if (yearlyMeanByDayData && Object.keys(yearlyMeanByDayData).length > 0) {
                const maxTemperature = yearlyMeanByDayData[selectedItem.station.id]?.tasmax;
                if (maxTemperature !== undefined && maxTemperature !== null && selectedItem.data.maxTemperature) {
                    anomaly = Math.round((selectedItem.data.maxTemperature - maxTemperature) * 10) / 10;
                }
            }
        }

        // Calculate anomaly details
        const anomalyDetails = anomaly !== null ? analyzeTemperatureAnomaly(isToday, anomaly) : null;

        return {
            item: selectedItem,
            anomaly,
            subtitle,
            anomalyDetails,
            isToday,
        };
    }, [selectedItem, selectedDate, yearlyMeanByDayData, referenceYearlyHourlyInterpolatedByDayData]);
};
