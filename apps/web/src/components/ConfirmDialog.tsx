"use client";

import { useEffect, useRef } from "react";
import { ExclamationTriangleIcon } from "@heroicons/react/24/outline";

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  description: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: "danger" | "warning";
  onConfirm: () => void;
  onCancel: () => void;
}

export default function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  variant = "danger",
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const cancelRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (open) cancelRef.current?.focus();
  }, [open]);

  useEffect(() => {
    if (!open) return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onCancel();
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open, onCancel]);

  if (!open) return null;

  const confirmColor =
    variant === "danger"
      ? "bg-destructive text-destructive-foreground hover:bg-red-700"
      : "bg-yellow-500 text-white hover:bg-yellow-600";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" role="dialog" aria-modal="true" aria-labelledby="confirm-title">
      <div className="fixed inset-0 bg-black/50" onClick={onCancel} />
      <div className="relative z-10 mx-4 w-full max-w-sm rounded-xl bg-card p-6 shadow-xl">
        <div className="mb-4 flex items-start gap-3">
          <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${variant === "danger" ? "bg-red-100" : "bg-yellow-100"}`}>
            <ExclamationTriangleIcon className={`h-5 w-5 ${variant === "danger" ? "text-destructive" : "text-yellow-600"}`} />
          </div>
          <div>
            <h3 id="confirm-title" className="text-base font-semibold text-card-foreground">{title}</h3>
            <p className="mt-1 text-sm text-muted-foreground">{description}</p>
          </div>
        </div>
        <div className="flex justify-end gap-3">
          <button
            ref={cancelRef}
            onClick={onCancel}
            className="cursor-pointer rounded-lg border border-border px-4 py-2 text-sm font-medium text-card-foreground hover:bg-muted focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
          >
            {cancelLabel}
          </button>
          <button
            onClick={onConfirm}
            className={`cursor-pointer rounded-lg px-4 py-2 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 ${confirmColor}`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
