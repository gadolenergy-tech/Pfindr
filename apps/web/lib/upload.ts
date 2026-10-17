import {
  UPLOAD_IMAGE_TYPES,
  UPLOAD_MAX_BYTES,
  type PresignedUpload,
  type UploadPurpose,
} from "@finder/shared";
import { api, ApiError } from "./api";

export const UPLOAD_ACCEPT = Object.keys(UPLOAD_IMAGE_TYPES).join(",");

/**
 * Uploads an image straight to the bucket and returns the public URL to save.
 * The API only signs the request; the file itself never passes through it.
 */
export async function uploadImage(file: File, purpose: UploadPurpose): Promise<string> {
  if (!(file.type in UPLOAD_IMAGE_TYPES)) {
    throw new Error("Use a JPG, PNG or WebP image.");
  }
  if (file.size > UPLOAD_MAX_BYTES) {
    throw new Error("Images can be at most 5 MB.");
  }

  const signed = await api.post<PresignedUpload>("/uploads/presign", {
    purpose,
    contentType: file.type,
    size: file.size,
  });

  let res: Response;
  try {
    res = await fetch(signed.uploadUrl, { method: "PUT", headers: signed.headers, body: file });
  } catch {
    throw new Error("The upload could not reach storage. Check your connection and try again.");
  }
  if (!res.ok) throw new ApiError(res.status, "UPLOAD_FAILED", "The upload was rejected. Please try again.");

  return signed.publicUrl;
}
