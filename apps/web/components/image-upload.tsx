"use client";

import { useRef, useState, type ReactNode } from "react";
import { Loader2 } from "lucide-react";
import type { UploadPurpose } from "@finder/shared";
import { UPLOAD_ACCEPT, uploadImage } from "@/lib/upload";

/**
 * A button that opens the file picker, uploads the chosen image and hands the
 * resulting URL to `onUploaded`. Rendering the preview is up to the caller.
 */
export function ImageUploadButton({
  purpose,
  onUploaded,
  onError,
  className,
  children,
}: {
  purpose: UploadPurpose;
  onUploaded: (url: string) => void | Promise<void>;
  onError: (message: string) => void;
  className?: string;
  children: ReactNode;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);

  async function onPick(file: File | undefined) {
    if (!file) return;
    setBusy(true);
    try {
      await onUploaded(await uploadImage(file, purpose));
    } catch (err) {
      onError(err instanceof Error ? err.message : "The upload failed.");
    } finally {
      setBusy(false);
      if (input.current) input.current.value = "";
    }
  }

  return (
    <>
      <input
        ref={input}
        type="file"
        accept={UPLOAD_ACCEPT}
        className="hidden"
        onChange={(e) => void onPick(e.target.files?.[0])}
      />
      <button type="button" disabled={busy} onClick={() => input.current?.click()} className={className}>
        {busy ? <Loader2 className="h-3 w-3 animate-spin inline mr-1.5" /> : null}
        {children}
      </button>
    </>
  );
}
