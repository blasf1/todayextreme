import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import type { CSSProperties } from 'react';
import { useNavigate } from 'react-router-dom';
import { FaSearch } from 'react-icons/fa';
import { PREDEFINED_CITIES } from '../../constants/map.js';
import { selectCity } from '../../store/slices/selectedCitySlice.js';
import { selectCities, selectCityDataStatus } from '../../store/slices/cityDataSlice.js';
import { selectLiveData } from '../../store/slices/liveDataSlice.js';
import { theme, createStyles } from '../../styles/design-system.js';
import { useBreakpointDown } from '../../hooks/useBreakpoint.js';
import { useAppSelector } from '../../store/hooks/useAppSelector.js';
import { useAppDispatch } from '../../store/hooks/useAppDispatch.js';
import type { ICity } from '../../classes/City.js';
import type StationData from '../../classes/StationData.js';

const getDropdownStyle = (isMobile: boolean): CSSProperties => ({
    position: isMobile ? 'fixed' : 'absolute',
    top: isMobile ? undefined : 'calc(100% + 5px)',
    left: isMobile ? '50%' : 0,
    transform: isMobile ? 'translateX(-50%)' : undefined,
    width: isMobile ? undefined : '100%',
    maxWidth: isMobile ? 350 : undefined,
    maxHeight: 300,
    overflowY: 'auto',
    backgroundColor: '#fefefe',
    border: '1px solid #ccc',
    borderRadius: '0 0 4px 4px',
    boxShadow: '0 2px 4px rgba(0, 0, 0, 0.1)',
    zIndex: 1001,
    animation: isMobile ? 'fadeInMobile 0.2s ease-in-out' : 'fadeIn 0.2s ease-in-out',
});

const getSearchInputStyle = (isMobile: boolean, inputFocused: boolean): CSSProperties => ({
    position: 'relative',
    boxSizing: 'border-box',
    width: '100%',
    padding: '8px 12px',
    fontSize: isMobile ? 16 : '1rem',
    border: '1px solid #ccc',
    borderRadius: 4,
    backgroundColor: '#fefefe',
    paddingLeft: 35,
    outline: inputFocused ? 'none' : undefined,
    borderColor: '#ccc',
    boxShadow: inputFocused ? 'inset 0 0 0 1px ' + theme.colors.primary + ', 0 2px 4px rgba(0, 0, 0, 0.1)' : '0 2px 4px rgba(0, 0, 0, 0.1)',
});

const styles = createStyles({
    container: {
        position: 'relative',
        width: '100%',
    },
    inputContainer: {
        position: 'relative',
        width: '100%',
    },
    icon: {
        position: 'absolute',
        left: 10,
        top: '50%',
        transform: 'translateY(-50%)',
        color: theme.colors.textLight,
        zIndex: 2,
    },
    item: {
        padding: '8px 12px',
        cursor: 'pointer',
        borderBottom: '1px solid #eee',
        display: 'flex',
        justifyContent: 'space-between',
    },
    itemMobile: {
        padding: 10,
    },
    itemHover: {
        backgroundColor: '#f5f5f5',
    },
    itemSelected: {
        backgroundColor: '#f0f0f0',
    },
    itemFocused: {
        backgroundColor: '#e6f2ff',
    },
    temperature: {
        color: theme.colors.textLight,
        fontSize: '0.9em',
    },
});

interface StationSearchProps {
    showSearchIcon?: boolean;
}

const StationSearch = ({ showSearchIcon = true }: StationSearchProps) => {
    const dispatch = useAppDispatch();
    const navigate = useNavigate();
    const cities = useAppSelector(selectCities);
    const cityDataStatus = useAppSelector(selectCityDataStatus);
    const liveData = useAppSelector(selectLiveData);
    const selectedCityId = useAppSelector(state => state.selectedCity.cityId);
    const isMobile = useBreakpointDown('mobile');

    const [searchTerm, setSearchTerm] = useState<string>('');
    const [isDropdownOpen, setIsDropdownOpen] = useState<boolean>(false);
    const [filteredCities, setFilteredCities] = useState<ICity[]>([]);
    const [focusedIndex, setFocusedIndex] = useState<number>(-1);
    const [hoveredIndex, setHoveredIndex] = useState<number>(-1);
    const [inputFocused, setInputFocused] = useState<boolean>(false);
    const searchRef = useRef<HTMLDivElement | null>(null);
    const inputRef = useRef<HTMLInputElement | null>(null);

    // Handle city selection
    const handleCitySelect = useCallback((city: ICity) => {
        const isPredefined = PREDEFINED_CITIES.includes(city.name);
        dispatch(selectCity(city.id, !isPredefined));
        setSearchTerm('');
        setIsDropdownOpen(false);
        navigate('/'); // Navigate to home page when a city is selected
    }, [dispatch, navigate]);

    // Handle clicks outside of the dropdown to close it
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (searchRef.current && event.target instanceof Node && !searchRef.current.contains(event.target)) {
                setIsDropdownOpen(false);
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, []);

    // Filter cities based on search term - no fuzzy search
    useEffect(() => {
        if (cityDataStatus !== 'succeeded') return;

        if (!searchTerm.trim()) {
            setFilteredCities([]);
            return;
        }

        const searchTermLower = searchTerm.toLowerCase();

        const filtered = Object.values(cities)
            .filter((city) => city.name.toLowerCase().includes(searchTermLower))
            .sort((a, b) => a.name.length - b.name.length)
            .slice(0, 15);

        setFilteredCities(filtered);
    }, [searchTerm, cities, cityDataStatus]);

    // Reset focused index when filtered cities change
    useEffect(() => {
        setFocusedIndex(-1);
    }, [filteredCities]);

    const searchInputStyle = useMemo(
        () => getSearchInputStyle(isMobile, inputFocused),
        [isMobile, inputFocused]
    );

    return (
        <div ref={searchRef} style={styles.container}>
            <div style={styles.inputContainer}>
                {showSearchIcon && <FaSearch style={styles.icon} />}
                <input
                    ref={inputRef}
                    type="text"
                    placeholder="Search city..."
                    value={searchTerm}
                    onChange={(e) => {
                        setSearchTerm(e.target.value);
                        setIsDropdownOpen(true);
                    }}
                    onClick={() => setIsDropdownOpen(true)}
                    onFocus={() => setInputFocused(true)}
                    onBlur={() => setInputFocused(false)}
                    style={searchInputStyle}
                />

                {isDropdownOpen && searchTerm && liveData && cityDataStatus === 'succeeded' && (
                    <div style={getDropdownStyle(isMobile)}>
                        {filteredCities.length > 0 ? (
                            filteredCities.map((city, index) => {
                                const data: StationData | undefined = liveData[city.stationId!];

                                const hasTemperature = data.temperature !== undefined;
                                const isSelected = city.id === selectedCityId;
                                const isHovered = hoveredIndex === index;
                                const isFocused = focusedIndex === index;

                                return (
                                    <div
                                        key={city.id}
                                        onClick={() => handleCitySelect(city)}
                                        onMouseEnter={() => setHoveredIndex(index)}
                                        onMouseLeave={() => setHoveredIndex(-1)}
                                        style={{
                                            ...styles.item,
                                            ...(isMobile && styles.itemMobile),
                                            ...(isHovered && styles.itemHover),
                                            ...(isSelected && styles.itemSelected),
                                            ...(isFocused && styles.itemFocused),
                                            ...(index === filteredCities.length - 1 && { borderBottom: 'none' }),
                                        }}
                                        title={`${city.name}${hasTemperature ? `: ${data.temperature.toFixed(1)}°C` : ''}`}
                                    >
                                        <span>{city.name}</span>
                                        <span style={styles.temperature}>
                                            {hasTemperature ? `${data.temperature.toFixed(1)}°C` : ''}
                                        </span>
                                    </div>
                                );
                            })
                        ) : (
                            <div style={{
                                ...styles.item,
                                ...(isMobile && styles.itemMobile),
                                cursor: 'default',
                            }}>
                                No cities found
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
};

export default StationSearch;
