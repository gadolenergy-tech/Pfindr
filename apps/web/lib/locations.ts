/**
 * City centres for the search location picker — the fallback when the browser
 * cannot (or may not) share a GPS position. Distances are then measured from
 * the centre of the chosen city.
 */
export type SearchOrigin = {
  lat: number;
  lng: number;
  label: string;
  source: "gps" | "city";
};

export const CITY_CENTRES = [
  { label: "Port Harcourt", lat: 4.8156, lng: 7.0498 },
  { label: "Lagos", lat: 6.5244, lng: 3.3792 },
  { label: "Abuja", lat: 9.0765, lng: 7.3986 },
  { label: "Ibadan", lat: 7.3775, lng: 3.947 },
  { label: "Enugu", lat: 6.4584, lng: 7.5464 },
  { label: "Kano", lat: 12.0022, lng: 8.592 },
  { label: "Benin City", lat: 6.335, lng: 5.6037 },
  { label: "Owerri", lat: 5.484, lng: 7.0351 },
  { label: "Aba", lat: 5.1066, lng: 7.3667 },
  { label: "Warri", lat: 5.516, lng: 5.75 },
  { label: "Uyo", lat: 5.0377, lng: 7.9128 },
  { label: "Calabar", lat: 4.9757, lng: 8.3417 },
  { label: "Kaduna", lat: 10.5105, lng: 7.4165 },
] as const;

const STORAGE_KEY = "finder:search-city";

/** The city the user picked last time, if any. Storage can be unavailable. */
export function readSavedCity(): SearchOrigin | null {
  try {
    const label = localStorage.getItem(STORAGE_KEY);
    const city = CITY_CENTRES.find((c) => c.label === label);
    return city ? { ...city, source: "city" } : null;
  } catch {
    return null;
  }
}

export function saveCity(label: string) {
  try {
    localStorage.setItem(STORAGE_KEY, label);
  } catch {
    // Private mode or blocked storage — the choice just won't persist.
  }
}

/** "350 m", "2.4 km", "38 km", "612 km". */
export function formatDistance(km: number): string {
  if (km < 1) return `${Math.max(50, Math.round((km * 1000) / 50) * 50)} m`;
  if (km < 10) return `${km.toFixed(1)} km`;
  return `${Math.round(km).toLocaleString()} km`;
}
