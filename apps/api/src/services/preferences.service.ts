import {
  vendorPreferencesSchema,
  type UpdateVendorPreferencesInput,
  type VendorPreferences,
} from "@finder/shared";

/**
 * Reads whatever is stored in Vendor.preferences through the schema, so
 * missing keys pick up defaults and stale keys are dropped. Never throws on
 * malformed JSON — a vendor's search visibility must not break over a bad row.
 */
export function readPreferences(raw: unknown): VendorPreferences {
  const parsed = vendorPreferencesSchema.safeParse(raw ?? {});
  return parsed.success ? parsed.data : vendorPreferencesSchema.parse({});
}

export function mergePreferences(
  current: unknown,
  patch: UpdateVendorPreferencesInput,
): VendorPreferences {
  const base = readPreferences(current);
  return {
    notifications: { ...base.notifications, ...patch.notifications },
    privacy: { ...base.privacy, ...patch.privacy },
    defaults: { ...base.defaults, ...patch.defaults },
  };
}
