import { z } from "zod";

/** Image types vendors may upload, and the file extension each is stored under. */
export const UPLOAD_IMAGE_TYPES = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
} as const;

export const UPLOAD_MAX_BYTES = 5 * 1024 * 1024;

export const UPLOAD_PURPOSES = ["logo", "product"] as const;
export type UploadPurpose = (typeof UPLOAD_PURPOSES)[number];

export const presignUploadSchema = z.object({
  purpose: z.enum(UPLOAD_PURPOSES),
  contentType: z.enum(Object.keys(UPLOAD_IMAGE_TYPES) as [keyof typeof UPLOAD_IMAGE_TYPES, ...(keyof typeof UPLOAD_IMAGE_TYPES)[]]),
  size: z.number().int().positive().max(UPLOAD_MAX_BYTES, "Images can be at most 5 MB"),
});
export type PresignUploadInput = z.infer<typeof presignUploadSchema>;

export type PresignedUpload = {
  /** PUT the file here, with exactly the headers below. */
  uploadUrl: string;
  headers: Record<string, string>;
  /** Save this on the vendor or inventory item once the PUT succeeds. */
  publicUrl: string;
};

/** Most photos one bulk upload may register at once. */
export const IMAGE_LIBRARY_BATCH = 50;

/** POST /inventory/images — photos already PUT to the bucket, to add to the library. */
export const registerImagesSchema = z.object({
  images: z
    .array(
      z.object({
        url: z.string().url().max(500),
        /** The name the file had on the vendor's computer, e.g. "MED-001.jpg". */
        fileName: z.string().trim().min(1).max(200),
      }),
    )
    .min(1)
    .max(IMAGE_LIBRARY_BATCH),
});
export type RegisterImagesInput = z.infer<typeof registerImagesSchema>;

/** What a library upload or auto-match did to the vendor's products. */
export type ImageMatchResult = {
  /** Products that were given a photo. */
  matched: number;
  /** Photos that matched no product (they stay in the library for later). */
  unmatched: string[];
};
