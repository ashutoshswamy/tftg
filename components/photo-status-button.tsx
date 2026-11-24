"use client";

import { useRef } from "react";
import { useFormStatus } from "react-dom";
import { CameraIcon } from "@heroicons/react/24/outline";

function Label({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <>
      <CameraIcon className="size-6" aria-hidden="true" />
      {pending ? "Uploading" : label}
    </>
  );
}

// One tap opens the camera; the status is sent together with the photo, and
// the server refuses the change without one.
export function PhotoStatusButton({
  action,
  status,
  label,
  primary,
}: {
  action: (formData: FormData) => void;
  status: "in_transit" | "delivered";
  label: string;
  primary?: boolean;
}) {
  const form = useRef<HTMLFormElement>(null);
  const input = useRef<HTMLInputElement>(null);

  return (
    <form ref={form} action={action} encType="multipart/form-data">
      <input type="hidden" name="status" value={status} />
      <input
        ref={input}
        type="file"
        name="file"
        accept="image/*"
        capture="environment"
        required
        className="sr-only"
        tabIndex={-1}
        aria-label={`Photo for ${label}`}
        onChange={(e) => e.currentTarget.files?.length && form.current?.requestSubmit()}
      />
      <button
        type="button"
        onClick={() => input.current?.click()}
        className={`btn min-h-16 w-full gap-2 px-3 text-base ${primary ? "btn-primary" : "btn-secondary"}`}
      >
        <Label label={label} />
      </button>
    </form>
  );
}
