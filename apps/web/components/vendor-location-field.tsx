"use client";

import { useState } from "react";
import { AlertTriangle, CheckCircle2, ExternalLink, Loader2, LocateFixed, X } from "lucide-react";
import { CITY_CENTRES } from "@/lib/locations";

export type PinnedLocation = {
  latitude: number;
  longitude: number;
  /** "gps" is the vendor's real position; "city" is a coarse city-centre fallback. */
  source: "gps" | "city";
  /** GPS accuracy radius in metres, when known. */
  accuracy?: number;
};

/** Above this, distances shown to buyers could be off by more than a neighbourhood. */
const LOW_ACCURACY_M = 500;

/** Saved coordinates from the server, typed as a pin. */
export function pinFromVendor(v: { latitude: number | null; longitude: number | null }): PinnedLocation | null {
  if (v.latitude === null || v.longitude === null) return null;
  const isCityCentre = CITY_CENTRES.some((c) => c.lat === v.latitude && c.lng === v.longitude);
  return { latitude: v.latitude, longitude: v.longitude, source: isCityCentre ? "city" : "gps" };
}

/**
 * Where the vendor's stock physically is. Buyers' search results are ranked
 * by distance from this point, so a vendor without one always ranks last.
 */
export function VendorLocationField({
  value,
  onChange,
  error,
}: {
  value: PinnedLocation | null;
  onChange: (next: PinnedLocation | null) => void;
  error?: string | null;
}) {
  const [locating, setLocating] = useState(false);
  const [gpsError, setGpsError] = useState<string | null>(null);

  function pinCurrentLocation() {
    setGpsError(null);
    if (!navigator.geolocation) {
      setGpsError("This browser cannot share a location. Choose your city below.");
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLocating(false);
        onChange({
          latitude: Number(pos.coords.latitude.toFixed(6)),
          longitude: Number(pos.coords.longitude.toFixed(6)),
          accuracy: Math.round(pos.coords.accuracy),
          source: "gps",
        });
      },
      (err) => {
        setLocating(false);
        setGpsError(
          err.code === err.PERMISSION_DENIED
            ? "Location access was blocked. Allow it in your browser, or choose your city below."
            : "We could not get your location. Try again, or choose your city below.",
        );
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 },
    );
  }

  const cityLabel =
    value?.source === "city"
      ? CITY_CENTRES.find((c) => c.lat === value.latitude && c.lng === value.longitude)?.label
      : undefined;

  return (
    <div className="space-y-3">
      <p className="text-xs text-muted-foreground">
        Buyers see the nearest vendors first. Pin this <strong>while you are at your shop or warehouse</strong> so
        the distances they see are accurate.
      </p>

      {value ? (
        <div className="rounded-lg border border-green-500/25 bg-green-500/[0.06] p-3 text-sm space-y-1.5">
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-center gap-2 text-green-400 font-medium">
              <CheckCircle2 className="h-4 w-4 shrink-0" />
              {value.source === "gps" ? "Shop location pinned" : `Using ${cityLabel ?? "city"} centre`}
            </div>
            <button
              type="button"
              onClick={() => onChange(null)}
              className="text-muted-foreground hover:text-foreground"
              aria-label="Clear location"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
            <span className="tabular-nums">
              {value.latitude.toFixed(5)}, {value.longitude.toFixed(5)}
              {value.accuracy !== undefined && ` · accurate to ±${value.accuracy.toLocaleString()} m`}
            </span>
            <a
              href={`https://www.google.com/maps?q=${value.latitude},${value.longitude}`}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 text-primary hover:underline"
            >
              Check on map <ExternalLink className="h-3 w-3" />
            </a>
          </div>
          {value.source === "city" && (
            <p className="flex items-start gap-1.5 text-xs text-amber-400">
              <AlertTriangle className="h-3.5 w-3.5 shrink-0 mt-px" />
              Approximate. Buyers will see distances from the city centre. Pin your exact location for better ranking.
            </p>
          )}
          {value.accuracy !== undefined && value.accuracy > LOW_ACCURACY_M && (
            <p className="flex items-start gap-1.5 text-xs text-amber-400">
              <AlertTriangle className="h-3.5 w-3.5 shrink-0 mt-px" />
              Low accuracy. Laptops often guess from the network. For a precise pin, do this on your phone at the shop.
            </p>
          )}
        </div>
      ) : null}

      <button
        type="button"
        onClick={pinCurrentLocation}
        disabled={locating}
        className="w-full inline-flex items-center justify-center gap-2 rounded-md border border-primary/40 bg-primary/10 px-4 h-10 text-sm font-medium text-primary hover:bg-primary/15 disabled:opacity-60 transition-colors"
      >
        {locating ? <Loader2 className="h-4 w-4 animate-spin" /> : <LocateFixed className="h-4 w-4" />}
        {locating ? "Getting your location…" : value?.source === "gps" ? "Re-pin my current location" : "Use my current location"}
      </button>

      {gpsError && <p className="text-xs text-amber-400">{gpsError}</p>}

      <div className="flex items-center gap-2">
        <span className="text-xs text-muted-foreground shrink-0">Or use a city centre:</span>
        <select
          value={cityLabel ?? ""}
          onChange={(e) => {
            const city = CITY_CENTRES.find((c) => c.label === e.target.value);
            if (city) onChange({ latitude: city.lat, longitude: city.lng, source: "city" });
          }}
          className="flex-1 h-9 rounded-md border border-input bg-background px-2 text-sm text-foreground"
        >
          <option value="">Select city</option>
          {CITY_CENTRES.map((c) => (
            <option key={c.label} value={c.label}>
              {c.label}
            </option>
          ))}
        </select>
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}
    </div>
  );
}
