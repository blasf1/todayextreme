import type { FeatureCollection, GeoJsonProperties, Geometry } from 'geojson';
import { ACTIVE_COUNTRY_PROFILE, type CountryProfile } from '../config/countryProfiles.js';

export type BoundaryGeoJSON = FeatureCollection<Geometry, GeoJsonProperties>;
export type GermanyBoundaryGeoJSON = BoundaryGeoJSON;

/**
 * Service to fetch country-specific GeoJSON boundaries.
 * 
 * @return {Promise<BoundaryGeoJSON>} GeoJSON boundaries
 */
export const fetchCountryGeoJSON = async (countryProfile: CountryProfile = ACTIVE_COUNTRY_PROFILE): Promise<BoundaryGeoJSON> => {
    try {
        const url = countryProfile.boundaryGeoJsonPath;
        const response = await fetch(url);
        const data = await response.json();
        return data as BoundaryGeoJSON;
    } catch (error) {
        console.error(`Error loading ${countryProfile.label} GeoJSON boundaries:`, error);
        throw error;
    }
};

export const fetchGermanyGeoJSON = async (): Promise<BoundaryGeoJSON> => {
    return fetchCountryGeoJSON();
};