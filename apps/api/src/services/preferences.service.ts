import {
  vendorPreferencesSchema,
  type UpdateVendorPreferencesInput,
  type VendorPreferences,
} from "@finder/shared";

/**
 * Vendor-controlled privacy (hide prices, hide quantities) is switched off for
 * now: hidden prices make a product impossible to buy online and hide the very
 * details the product page exists to show. While this is false, stored privacy
 * choices are ignored on read and new ones are not saved. The stored values are
 * kept as they are, so flipping this on restores each vendor's earlier choices.
 */
export const PRIVACY_CONTROLS_ENABLED = false;

/**
 * Reads whatever is stored in Vendor.preferences through the schema, so
 * missing keys pick up defaults and stale keys are dropped. Never throws on
 * malformed JSON — a vendor's search visibility must not break over a bad row.
 */
function parseStored(raw: unknown): VendorPreferences {
  const parsed = vendorPreferencesSchema.safeParse(raw ?? {});
  return parsed.success ? parsed.data : vendorPreferencesSchema.parse({});
}

/** The preferences in effect — what discover, checkout and the settings page act on. */
export function readPreferences(raw: unknown): VendorPreferences {
  const prefs = parseStored(raw);
  return PRIVACY_CONTROLS_ENABLED ? prefs : { ...prefs, privacy: vendorPreferencesSchema.shape.privacy.parse({}) };
}

/** The value to store after a patch. Compare readPreferences, which is what is in effect. */
export function mergePreferences(
  current: unknown,
  patch: UpdateVendorPreferencesInput,
): VendorPreferences {
  const base = parseStored(current);
  return {
    notifications: { ...base.notifications, ...patch.notifications },
    privacy: PRIVACY_CONTROLS_ENABLED ? { ...base.privacy, ...patch.privacy } : base.privacy,
    defaults: { ...base.defaults, ...patch.defaults },
  };
}
