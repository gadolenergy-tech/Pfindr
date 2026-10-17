import crypto from "crypto";
import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { UPLOAD_IMAGE_TYPES, type PresignedUpload, type PresignUploadInput } from "@finder/shared";
import { env } from "../env";
import { AppError, badRequest } from "./errors";

/**
 * Direct-to-bucket uploads. The API never touches the file: it hands the
 * browser a short-lived presigned PUT URL, scoped to one key, one content type
 * and one exact size, and the browser uploads straight to the bucket.
 */

const { storage } = env;

export const storageEnabled = () =>
  Boolean(storage.bucket && storage.accessKeyId && storage.secretAccessKey && storage.publicUrl);

let client: S3Client | null = null;
function s3(): S3Client {
  client ??= new S3Client({
    region: storage.region,
    endpoint: storage.endpoint || undefined,
    forcePathStyle: Boolean(storage.endpoint),
    credentials: { accessKeyId: storage.accessKeyId, secretAccessKey: storage.secretAccessKey },
    // R2 rejects the newer default checksum headers a presigned PUT cannot carry.
    requestChecksumCalculation: "WHEN_REQUIRED",
  });
  return client;
}

/** Everything a vendor uploads lives under their own prefix. */
const prefixFor = (vendorId: string) => `${storage.publicUrl}/vendors/${vendorId}/`;

export async function createUploadUrl(vendorId: string, input: PresignUploadInput): Promise<PresignedUpload> {
  if (!storageEnabled()) {
    throw new AppError(503, "UPLOADS_DISABLED", "Image uploads are not set up yet.");
  }

  const ext = UPLOAD_IMAGE_TYPES[input.contentType];
  const key = `vendors/${vendorId}/${input.purpose}/${crypto.randomUUID()}.${ext}`;

  const uploadUrl = await getSignedUrl(
    s3(),
    new PutObjectCommand({
      Bucket: storage.bucket,
      Key: key,
      ContentType: input.contentType,
      ContentLength: input.size,
      CacheControl: "public, max-age=31536000, immutable",
    }),
    { expiresIn: 300, signableHeaders: new Set(["content-type", "content-length"]) },
  );

  return {
    uploadUrl,
    headers: { "Content-Type": input.contentType },
    publicUrl: `${storage.publicUrl}/${key}`,
  };
}

/**
 * An image URL may only be one of this vendor's own uploads (or cleared).
 * Without this a vendor could point a listing at any third-party URL, or at
 * another vendor's files.
 */
export function assertOwnImageUrl(vendorId: string, url: string | null | undefined): void {
  if (url === undefined || url === null || url === "") return;
  if (!storageEnabled() || !url.startsWith(prefixFor(vendorId)) || url.includes("..")) {
    throw badRequest("Upload the image through Finder instead of linking to it.");
  }
}
