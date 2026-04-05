import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { FaCalendarDay } from 'react-icons/fa';
import { DayPicker } from 'react-day-picker';
import 'react-day-picker/dist/style.css';
import { setDateAndFetchHistoricalData } from '../../store/slices/selectedDateSlice.js'
import { getNow } from '../../utils/dateUtils.js';
import { useDateRangeForStation } from '../../store/slices/stationDateRangesSlice.js';
import { useSelectedStationId } from '../../store/hooks/hooks.js';
import { useIsDateChanging, useSelectedDate } from '../../store/slices/selectedDateSlice.js';
import { createStyles } from '../../styles/design-system.js';
import { useBreakpointDown } from '../../hooks/useBreakpoint.js';
import { DateTime } from 'luxon';
import { useAppDispatch } from '../../store/hooks/useAppDispatch.js';

const styles = createStyles({
    container: {
        position: 'relative',
        display: 'inline-block',
    },
    row: {
        display: 'flex',
        alignItems: 'center',
        gap: 10,
    },
    calendarIconContainer: {
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 9,
        cursor: 'pointer',
        transition: 'all 0.2s',
        position: 'relative',
        boxSizing: 'border-box',
        borderWidth: 1,
        borderStyle: 'solid',
        borderColor: '#ccc',
        borderRadius: 4,
        boxShadow: '0 2px 4px rgba(0, 0, 0, 0.1)',
        backgroundColor: '#fefefe',
    },
    calendarIconContainerHover: {
        backgroundColor: '#e0e0e0',
    },
    calendarIconContainerActive: {
        backgroundColor: 'rgb(7, 87, 156)',
        borderColor: 'rgb(7, 87, 156)',
    },
    calendarIconContainerDisabled: {
        cursor: 'not-allowed',
        opacity: 0.5,
        backgroundColor: '#f5f5f5',
        borderColor: '#e0e0e0',
        boxShadow: 'none',
    },
    icon: {
        fontSize: '1rem',
        color: '#555',
    },
    iconActive: {
        color: 'rgb(7, 87, 156)',
    },
    iconInActiveContainer: {
        color: '#f8f9fa',
    },
    iconDisabled: {
        color: '#999',
    },
    toggleButton: {
        cursor: 'pointer',
        transition: 'all 0.2s',
        position: 'relative',
        boxSizing: 'border-box',
        padding: '6.5px 12px',
        fontSize: '1rem',
        borderWidth: 1,
        borderStyle: 'solid',
        borderColor: '#ccc',
        borderRadius: 4,
        boxShadow: '0 2px 4px rgba(0, 0, 0, 0.1)',
        backgroundColor: '#fefefe',
    },
    toggleButtonHover: {
        backgroundColor: '#f8f9fa',
    },
    toggleButtonActive: {
        backgroundColor: 'rgb(7, 87, 156)',
        color: '#f8f9fa',
        borderColor: 'rgb(7, 87, 156)',
    },
    toggleButtonDisabled: {
        cursor: 'not-allowed',
        opacity: 0.5,
        backgroundColor: '#f5f5f5',
        borderColor: '#e0e0e0',
        color: '#999',
        boxShadow: 'none',
    },
    popup: {
        position: 'absolute',
        top: 'calc(100% + 5px)',
        left: 0,
        backgroundColor: '#f8f9fa',
        borderRadius: 6,
        boxShadow: '0 2px 10px rgba(0, 0, 0, 0.1)',
        padding: 15,
        zIndex: 1000,
        minWidth: 250,
    },
    popupMobile: {
        position: 'fixed',
        left: '50%',
        transform: 'translate(-50%)',
        maxWidth: 350,
    },
});

/**
 * Component for selecting "Yesterday", "Today", or an arbitrary date of a preconfigured selection of years.
 */

const convertYYYYMMDDToDate = (dateString: string): DateTime => {
    // Returns a Luxon DateTime object
    return DateTime.fromFormat(dateString, 'yyyyLLdd');
}

const DateSelection = () => {
    const dispatch = useAppDispatch();
    const navigate = useNavigate();
    const selectedDate = useSelectedDate();
    const isDateChanging = useIsDateChanging();
    const selectedStationId = useSelectedStationId();
    const dateRange = useDateRangeForStation(selectedStationId);
    const isMobile = useBreakpointDown('mobile');

    const [isYesterdaySelected, setIsYesterdaySelected] = useState<boolean>(false);
    const [isTodaySelected, setIsTodaySelected] = useState<boolean>(true);
    const [isCalendarOpen, setIsCalendarOpen] = useState<boolean>(false);
    const [recentlyClosed, setRecentlyClosed] = useState<boolean>(false);
    const [renderYesterdayButton, setRenderYesterdayButton] = useState<boolean>(false);
    const [isReady, setIsReady] = useState<boolean>(false);

    const [hoveredButton, setHoveredButton] = useState<'yesterday' | 'today' | 'calendar' | null>(null);

    const [startMonth, setStartMonth] = useState<Date | null>(null);
    const [endMonth, setEndMonth] = useState<Date | null>(null);
    const [disabledBefore, setDisabledBefore] = useState<Date | null>(null);
    const [disabledAfter, setDisabledAfter] = useState<Date | null>(null);

    const dateSelectRef = useRef<HTMLDivElement | null>(null);

    const canInteract = isReady && !isDateChanging;
    const canUseYesterday = canInteract && renderYesterdayButton;

    useEffect(() => {
        if (!dateRange) return;

        // Calculate yesterday's date using Luxon
        const yesterday = getNow().minus({ days: 1 });

        // Convert to YYYYMMDD format as string
        const yesterdayFormatted = yesterday.toFormat('yyyyLLdd');

        // Check if yesterday is within the historical date range (using string comparison)
        const isWithinRange =
            dateRange.from <= yesterdayFormatted &&
            dateRange.to >= yesterdayFormatted;

        setStartMonth(convertYYYYMMDDToDate(dateRange.from).toJSDate());
        setEndMonth(convertYYYYMMDDToDate(dateRange.to).toJSDate());
        setDisabledBefore(convertYYYYMMDDToDate(dateRange.from).toJSDate());
        setDisabledAfter(convertYYYYMMDDToDate(dateRange.to).toJSDate());

        setRenderYesterdayButton(isWithinRange);
        setIsReady(true);
    }, [dateRange])

    const handleDateSelection = useCallback((date: DateTime) => {
        dispatch(setDateAndFetchHistoricalData(date.toISO()!));
    }, [dispatch]);

    // Handle today selection
    const handleTodayClick = () => {
        if (!isReady || isDateChanging) return;

        const today = getNow();

        if (today.hasSame(DateTime.fromISO(selectedDate), 'day')) {
            return;
        }

        handleDateSelection(today);
        if (window.location.pathname !== '/') {
            navigate('/');
        }
    };

    // Handle yesterday selection
    const handleYesterdayClick = () => {
        if (!isReady || !renderYesterdayButton || isDateChanging) return;

        const yesterday = getNow().minus({ days: 1 });
        handleDateSelection(yesterday);
        if (window.location.pathname !== '/') {
            navigate('/');
        }
    };

    const handleDateSelect = (date: Date | undefined) => {
        // date is a JS Date from DayPicker, convert to Luxon
        if (!date) {
            setIsCalendarOpen(false);
            return;
        }
        const selected = DateTime.fromJSDate(date).setZone('Europe/Berlin');
        const today = getNow();

        if (selected.hasSame(DateTime.fromISO(selectedDate), 'day')) {
            setIsCalendarOpen(false);
            return;
        }

        if (selected.hasSame(today, 'day')) {
            setIsCalendarOpen(false);
            handleTodayClick();
            return;
        }
        const yesterday = today.minus({ days: 1 });
        if (selected.hasSame(yesterday, 'day')) {
            setIsCalendarOpen(false);
            handleYesterdayClick();
            return;
        }
        handleDateSelection(selected);
        setIsCalendarOpen(false);
        if (window.location.pathname !== '/') {
            navigate('/');
        }
    };

    // Handle calendar icon click
    const toggleCalendar = () => {
        if (!isReady || isDateChanging) return;

        // Don't open if it was recently closed
        if (recentlyClosed && !isCalendarOpen) {
            return;
        }
        setIsCalendarOpen(!isCalendarOpen);
    };

    useEffect(() => {
        // Set state of buttons based on selected date
        if (selectedDate) {
            const selected = DateTime.fromISO(selectedDate);
            const today = getNow();
            const yesterday = today.minus({ days: 1 });
            setIsTodaySelected(selected.hasSame(today, 'day'));
            setIsYesterdaySelected(selected.hasSame(yesterday, 'day'));
        } else {
            setIsTodaySelected(false);
            setIsYesterdaySelected(false);
        }
    }, [selectedDate]);

    // Handle clicks outside of the calendar to close it
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (dateSelectRef.current && event.target instanceof Node && !dateSelectRef.current.contains(event.target)) {
                setIsCalendarOpen(false);
                setRecentlyClosed(true);
                window.setTimeout(() => {
                    setRecentlyClosed(false);
                }, 500);
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, []);

    return (
        <div style={styles.container}>
            <div style={styles.row}>
                <div
                    style={{
                        ...styles.toggleButton,
                        ...(!canUseYesterday ? styles.toggleButtonDisabled : {}),
                        ...(canUseYesterday && hoveredButton === 'yesterday' && !isYesterdaySelected ? styles.toggleButtonHover : {}),
                        ...(canUseYesterday && isYesterdaySelected ? styles.toggleButtonActive : {}),
                    }}
                    onClick={handleYesterdayClick}
                    onMouseEnter={() => canUseYesterday && setHoveredButton('yesterday')}
                    onMouseLeave={() => canUseYesterday && setHoveredButton(null)}
                >
                    Yesterday
                </div>

                <div
                    style={{
                        ...styles.toggleButton,
                        ...(!canInteract ? styles.toggleButtonDisabled : {}),
                        ...(canInteract && hoveredButton === 'today' && !isTodaySelected ? styles.toggleButtonHover : {}),
                        ...(canInteract && isTodaySelected ? styles.toggleButtonActive : {}),
                    }}
                    onClick={handleTodayClick}
                    onMouseEnter={() => canInteract && setHoveredButton('today')}
                    onMouseLeave={() => canInteract && setHoveredButton(null)}
                >
                    Today
                </div>

                <div
                    style={{
                        ...styles.calendarIconContainer,
                        ...(!canInteract ? styles.calendarIconContainerDisabled : {}),
                        ...(canInteract && hoveredButton === 'calendar' && !(!isYesterdaySelected && !isTodaySelected) ? styles.calendarIconContainerHover : {}),
                        ...(canInteract && !isYesterdaySelected && !isTodaySelected ? styles.calendarIconContainerActive : {}),
                    }}
                    onClick={toggleCalendar}
                    onMouseEnter={() => canInteract && setHoveredButton('calendar')}
                    onMouseLeave={() => canInteract && setHoveredButton(null)}
                >
                    <FaCalendarDay style={{
                        ...styles.icon,
                        ...(!canInteract ? styles.iconDisabled : {}),
                        ...(canInteract && isCalendarOpen ? styles.iconActive : {}),
                        ...(canInteract && !isYesterdaySelected && !isTodaySelected ? styles.iconInActiveContainer : {}),
                    }} />
                </div>
            </div>

            {isCalendarOpen && startMonth && endMonth && disabledBefore && disabledAfter && (
                <div
                    ref={dateSelectRef}
                    style={{
                        ...styles.popup,
                        ...(isMobile && styles.popupMobile),
                    }}
                >
                    <DayPicker
                        mode="single"
                        selected={selectedDate ? DateTime.fromISO(selectedDate).toJSDate() : undefined}
                        onSelect={handleDateSelect}
                        startMonth={startMonth}
                        endMonth={endMonth}
                        disabled={{ before: disabledBefore, after: disabledAfter }}
                        navLayout='around'
                        showOutsideDays
                    />
                </div>
            )}
        </div>
    );
};

export default DateSelection;