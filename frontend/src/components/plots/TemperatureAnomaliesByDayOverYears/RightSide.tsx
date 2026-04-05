import { useSelectedDate } from '../../../store/slices/selectedDateSlice.js';
import { DateTime } from 'luxon';
import { getNow } from '../../../utils/dateUtils.js';
import { useSelectedCityName } from '../../../store/hooks/hooks.js';
import { useMemo, type CSSProperties } from 'react';
import useBreakpoint from '../../../hooks/useBreakpoint.js';
import PlotDescription from '../../common/PlotDescription/PlotDescription.js';


const getContainerStyle = (isVertical: boolean): CSSProperties => ({
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
    textAlign: isVertical ? 'justify' : undefined,
});


const TemperatureAnomaliesByDayOverYearsRightSide = () => {
    const breakpoint = useBreakpoint();
    const isMobile = breakpoint === 'mobile' || breakpoint === 'tablet';

    const customStyle = useMemo(
        () => getContainerStyle(isMobile),
        [isMobile]
    );

    const selectedCityName = useSelectedCityName();
    const selectedDate = useSelectedDate();

    const isToday = DateTime.fromISO(selectedDate).hasSame(getNow(), 'day');
    const selectedCityNameDisplay = selectedCityName ?? 'this city';
    const formattedDate = DateTime.fromISO(selectedDate).setLocale('en').toFormat("d MMMM yyyy");

    return (
        <PlotDescription style={customStyle}>
            <div>
                This chart shows how warm <strong>{isToday ? "today" : formattedDate}</strong> is compared with previous years. It includes data since <strong>1951</strong> for the weather station near {selectedCityNameDisplay}.
            </div>
            <div>
                Each <strong>colored dot</strong> represents one year. The value shows the average daily temperature on {isToday ? "today's calendar day" : formattedDate}. To smooth random weather fluctuations, the chart uses an average over surrounding days (7 days before and 7 days after).
            </div>
            <div>
                The horizontal <strong>zero line</strong> is the average for <strong>1961-1990</strong>. <span style={{ color: '#d73027' }}>Red&nbsp;dots</span> above this line indicate warmer years, while <span style={{ color: '#4575b4' }}>blue&nbsp;dots</span> indicate colder years. Gray background dots show surrounding-day values and provide broader context.
            </div>
            {isToday && (
                <div>
                    The <strong>current value</strong> is based on temperatures measured so far today. The full picture is available only at the end of the day or after the daily maximum is reached.
                </div>
            )}
        </PlotDescription>
    );
};

TemperatureAnomaliesByDayOverYearsRightSide.displayName = 'TemperatureAnomaliesByDayOverYearsRightSide';

export default TemperatureAnomaliesByDayOverYearsRightSide;
