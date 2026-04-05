import { ACTIVE_COUNTRY_PROFILE } from '../config/countryProfiles.js';

// Predefined list of important cities to always show on the map
export const PREDEFINED_CITIES = [...ACTIVE_COUNTRY_PROFILE.predefinedCities];

export const DEFAULT_CITY = ACTIVE_COUNTRY_PROFILE.defaultCityQuery;