"use client";

import { useEffect, useRef, useState } from "react";
import { X } from "lucide-react";

import { cn } from "@/lib/cn";

interface ProofThumbnailProps {
  /** Signed Storage URL for the proof image. Pre-generated server-side. */
  signedUrl: string | null;
  /** Aria-label / alt text describing the proof. */
  alt: string;
  className?: string;
  /** Smaller variant for print / mobile. */
  size?: "sm" | "md";
}

/**
 * Square thumbnail; click to open a centered lightbox with the full image.
 * Uses native <dialog> for built-in ESC-to-close and overlay semantics.
 * Print-hidden via the .print-hide utility (the parent table replaces with
 * a tiny inline thumbnail for printout).
 */
export function ProofThumbnail({
  signedUrl,
  alt,
  className,
  size = "md",
}: ProofThumbnailProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [open, setOpen] = useState(false);

  // Native <dialog> open/close kept in sync with React state.
  useEffect(() => {
    const d = dialogRef.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);

  if (!signedUrl) {
    return null;
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={`Open ${alt}`}
        className={cn(
          "block overflow-hidden border border-border bg-surface focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-foreground focus-visible:ring-offset-2 focus-visible:ring-offset-background",
          size === "sm" ? "h-8 w-8" : "h-14 w-14",
          className,
        )}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={signedUrl}
          alt={alt}
          className="h-full w-full object-cover"
          loading="lazy"
        />
      </button>

      <dialog
        ref={dialogRef}
        onClose={() => setOpen(false)}
        onClick={(e) => {
          // Click backdrop closes the dialog.
          if (e.target === e.currentTarget) setOpen(false);
        }}
        className="print-hide fixed inset-0 m-auto h-fit w-fit max-h-[90vh] max-w-[95vw] border border-border bg-surface p-0 text-foreground backdrop:bg-foreground/60"
      >
        <div className="relative">
          <button
            type="button"
            onClick={() => setOpen(false)}
            aria-label="Close preview"
            className="absolute right-2 top-2 inline-flex h-8 w-8 items-center justify-center border border-border bg-surface text-foreground hover:bg-surface-deep"
          >
            <X size={14} aria-hidden />
          </button>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={signedUrl}
            alt={alt}
            className="block max-h-[90vh] max-w-[95vw] object-contain"
          />
        </div>
      </dialog>
    </>
  );
}
