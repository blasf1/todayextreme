import React, { Suspense, useState, useEffect, useRef } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import { Provider } from 'react-redux';
import { store } from './store';
import Header from './components/header/Header';
import Footer from './components/footer/Footer';
import { DEFAULT_CITY, PREDEFINED_CITIES } from './constants/map';
import { fetchYearlyMeanByDay } from './store/slices/YearlyMeanByDaySlice';
import { fetchReferenceYearlyHourlyInterpolatedByDay } from './store/slices/ReferenceYearlyHourlyInterpolatedByDaySlice';
import { fetchLiveData, selectLiveDataStatus, selectStationsJSON } from './store/slices/liveDataSlice';
import { fetchDailyRecentByDate } from './store/slices/DailyRecentByDateSlice';
import { fetchCityData, selectCities, selectCityDataStatus } from './store/slices/cityDataSlice';
import { selectCity } from './store/slices/selectedCitySlice';
import { fetchDailyDataForStation } from './store/slices/historicalDataForStationSlice';
import { fetchStationDateRange } from './store/slices/stationDateRangesSlice';

import { getNow } from './utils/dateUtils';
import { useAppSelector } from './store/hooks/useAppSelector';
import { useAppDispatch } from './store/hooks/useAppDispatch';
import theme, { createStyles } from './styles/design-system';
import { useBreakpoint } from './hooks/useBreakpoint';
import type { CSSProperties } from 'react';
import { ACTIVE_COUNTRY_PROFILE } from './config/countryProfiles.js';

// Plot registry-based lazy loading
import { plots } from './components/plots/registry';
const ImpressumPage = React.lazy(() => import('./pages/ImpressumPage'));
const Closing = React.lazy(() => import('./components/closing/Closing'));

// Pure style computation functions
const getAppContainerStyle = (): CSSProperties => ({
    position: 'relative',
    width: '100%',
    minHeight: '100vh',
    overflowX: 'visible',
    backgroundColor: theme.colors.background,
    display: 'flex',
    flexDirection: 'column',
});

const getContentWrapperStyle = (isMobile: boolean): CSSProperties => ({
    width: '100%',
    position: 'relative',
    flex: 1,
    marginTop: isMobile ? 100 : 60,
});

const getLoadingContainerStyle = (): CSSProperties => ({
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    height: '100vh',
    fontSize: '1.5rem',
    color: '#666',
});

const styles = createStyles({
    errorContainer: {
        display: 'flex',
        justifyContent: 'center',
        textAlign: 'center',
        alignItems: 'center',
        padding: '100px',
        color: '#d32f2f',
        fontWeight: 500,
    },
    warningBanner: {
        margin: '8px 16px 0 16px',
        padding: '10px 12px',
        borderRadius: 6,
        backgroundColor: 'rgba(211, 47, 47, 0.1)',
        border: '1px solid rgba(211, 47, 47, 0.35)',
        color: '#d32f2f',
        fontSize: '0.95rem',
        textAlign: 'center',
    },
    errorPageLayout: {
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
    },
});

function AppContent() {
    const dispatch = useAppDispatch();
    const navigate = useNavigate();
    const breakpoint = useBreakpoint();

    const [error, setError] = useState<string | null>(null);
    const didFetchDataRef = useRef(false);
    const didRetryCorrelationRef = useRef(false);

    const stationsJSON = useAppSelector(selectStationsJSON);
    const cities = useAppSelector(selectCities);
    const selectedCityId = useAppSelector(state => state.selectedCity.cityId);

    const liveDataStatus = useAppSelector(selectLiveDataStatus);
    const cityDataStatus = useAppSelector(selectCityDataStatus);

    const normalizeCityToken = (value: string): string => {
        return value
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .replace(/[^a-zA-Z0-9]+/g, ' ')
            .trim()
            .toLowerCase();
    };

    // Handle redirect from error.html
    useEffect(() => {
        const params = new URLSearchParams(window.location.search);
        const redirectPath = params.get('redirect');
        if (redirectPath) {
            window.history.replaceState(null, '', redirectPath);
            navigate(redirectPath);
        }
    }, [navigate]);

    useEffect(() => {
        if (didFetchDataRef.current) return;

        didFetchDataRef.current = true;

        const loadData = async () => {
            setError(null);

            try {
                // Get today's date for historical data
                const today = getNow();
                const month = today.month;
                const day = today.day;
                let stations = store.getState().liveData.data?.stations ?? {};

                // Load weather stations first, then cities (which need stations)
                try {
                    const liveData = await dispatch(fetchLiveData()).unwrap();
                    stations = liveData?.stations ?? {};
                } catch (liveDataError) {
                    console.warn('Live data unavailable, continuing with empty map fallback.', liveDataError);
                    setError('Live station data is currently unavailable. Showing map with available boundaries only.');
                }

                // Spain currently runs with local live data only; historical datasets are optional.
                const yesterday = today.minus({ days: 1 });
                const requests: Array<Promise<unknown>> = [
                    dispatch(fetchCityData({ stations })).unwrap(),
                    dispatch(fetchYearlyMeanByDay({ month, day })).unwrap(),
                    dispatch(fetchDailyRecentByDate({ year: today.year, month, day })).unwrap(),
                    dispatch(fetchDailyRecentByDate({
                        year: yesterday.year,
                        month: yesterday.month,
                        day: yesterday.day,
                    })).unwrap(),
                ];

                if (ACTIVE_COUNTRY_PROFILE.id !== 'spain') {
                    requests.push(
                        dispatch(fetchReferenceYearlyHourlyInterpolatedByDay({ month, day })).unwrap(),
                    );
                }

                // Load all dependent datasets; keep the app running even if some fail.
                const results = await Promise.allSettled(requests);

                const failed = results.filter(result => result.status === 'rejected');
                if (failed.length > 0 && !error) {
                    setError('Some datasets are currently unavailable. The map will show what can be loaded.');
                }
            } catch (error) {
                console.error("Failed to load data:", error);
                setError('Some data could not be loaded. The map will continue with available data.');
            }
        };

        loadData();
    }, [dispatch]);

    // If live station metadata was unavailable during initial load, cities may have no stationId.
    // Retry correlation once station metadata arrives.
    useEffect(() => {
        if (didRetryCorrelationRef.current) {
            return;
        }

        if (!stationsJSON || !cities || Object.keys(stationsJSON).length === 0) {
            return;
        }

        const hasMissingStationIds = Object.values(cities).some((city) => !city.stationId);
        if (!hasMissingStationIds) {
            didRetryCorrelationRef.current = true;
            return;
        }

        didRetryCorrelationRef.current = true;
        dispatch(fetchCityData({ stations: stationsJSON })).catch(() => undefined);
    }, [dispatch, stationsJSON, cities]);

    // Set default city when cities are loaded
    useEffect(() => {
        if (!cities) {
            return;
        }

        if (selectedCityId && cities[selectedCityId]) {
            return;
        }

        const params = new URLSearchParams(window.location.search);
        const queryCity = params.get('city');
        const normalizedQueryCity = queryCity ? normalizeCityToken(queryCity) : '';

        if (normalizedQueryCity) {
            const queryMatch = Object.values(cities).find(city =>
                normalizeCityToken(city.id) === normalizedQueryCity
                || normalizeCityToken(city.name) === normalizedQueryCity
            );

            if (queryMatch) {
                dispatch(selectCity(queryMatch.id, false));
                return;
            }
        }

        // Try to find the default city in the predefined list first
        const city = Object.values(cities).find(city =>
            PREDEFINED_CITIES.includes(city.name) &&
            city.name.toLowerCase().includes(DEFAULT_CITY));

        if (city) {
            dispatch(selectCity(city.id, false));
        }
    }, [cities, selectedCityId, dispatch]);

    useEffect(() => {
        if (!selectedCityId || !cities) {
            return;
        }

        const city = cities[selectedCityId];
        if (!city) {
            return;
        }

        const params = new URLSearchParams(window.location.search);
        params.set('city', city.name);
        const nextUrl = `${window.location.pathname}?${params.toString()}`;
        window.history.replaceState(null, '', nextUrl);
    }, [cities, selectedCityId]);

    // Load DilyRecentByStation data when a city is selected
    useEffect(() => {
        if (!selectedCityId || cityDataStatus !== 'succeeded') return;

        const city = cities[selectedCityId];
        if (!city) return;

        const stationId = city.stationId;
        if (!stationId || !stationsJSON) {
            return;
        }
        const station = stationsJSON[stationId];
        if (!station) return;

        // Fetch both historical data and date range for the station
        dispatch(fetchDailyDataForStation({ stationId: station.id }));
        dispatch(fetchStationDateRange({ stationId: station.id }));
    }, [dispatch, selectedCityId, cityDataStatus, cities, stationsJSON]);

    const LazyEntries = React.useMemo(() => {
        return plots.map(p => ({ ...p, Comp: React.lazy(p.loader) }));
    }, []);

    const MainPage = React.useMemo(() => {
        return () => (
            <>
                <Suspense fallback={<div style={getLoadingContainerStyle()}>Loading map data...</div>}>
                    {error && <div style={styles.warningBanner}>{error}</div>}
                    {LazyEntries.map(entry => {
                        const Comp = entry.Comp;
                        return <Comp key={entry.id} />;
                    })}
                </Suspense>
                <Closing />
            </>
        );
    }, [error, LazyEntries]);

    const isMobile = breakpoint === 'mobile';

    const appContainerStyle = React.useMemo(() => getAppContainerStyle(), []);
    const contentWrapperStyle = React.useMemo(() => getContentWrapperStyle(isMobile), [isMobile]);
    const loadingContainerStyle = React.useMemo(() => getLoadingContainerStyle(), []);

    return (
        <div style={appContainerStyle}>
            <Header />
            <main style={contentWrapperStyle}>
                <Routes>
                    <Route path="/" element={<MainPage />} />
                    <Route path="/impressum" element={
                        <Suspense fallback={<div style={loadingContainerStyle}>Loading...</div>}>
                            <ImpressumPage />
                        </Suspense>
                    } />
                    {/* Redirect any other routes to home */}
                    <Route path="*" element={<Navigate to="/" replace />} />
                </Routes>
            </main>
            <Footer />
        </div>
    );
}

// Main App component that provides the Router context
function App() {
    return (
        <Provider store={store}>
            <BrowserRouter>
                <AppContent />
            </BrowserRouter>
        </Provider>
    );
}

export default App;