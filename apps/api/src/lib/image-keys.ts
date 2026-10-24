/**
 * Photos are matched to products by name, not by id: a vendor names a file
 * after the product code or product, and the same file keeps matching after the
 * product row is deleted and re-imported. Keys are the lowercase letters and
 * digits of the name, so "MED-001.jpg", "med 001" and "Med_001" all agree.
 */

export const normalizeKey = (text: string | null | undefined): string =>
  (text ?? "").toLowerCase().replace(/[^a-z0-9]+/g, "");

/** "MED-001.jpg" → "med001". */
export const fileKey = (fileName: string): string => normalizeKey(fileName.replace(/\.[a-z0-9]{2,5}$/i, ""));

/**
 * The keys a product answers to, strongest first: its SKU, then name with the
 * brand either side, then the bare name. The bare name is the weakest because
 * two brands of the same product share it.
 */
export function itemKeys(item: { sku: string | null; name: string; brand: string | null }): {
  strong: string[];
  nameOnly: string;
} {
  const name = normalizeKey(item.name);
  const brand = normalizeKey(item.brand);
  const strong = [normalizeKey(item.sku), brand && `${brand}${name}`, brand && `${name}${brand}`].filter(
    (k): k is string => Boolean(k),
  );
  return { strong, nameOnly: name };
}
