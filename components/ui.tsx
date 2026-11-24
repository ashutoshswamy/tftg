"use client";

import { useState, type CSSProperties, type ReactNode } from "react";
import { type ComponentProps } from "react";
import { Checkbox, Combobox, FloatingInput, SegmentedControl, StatefulButton } from "@ashutoshswamy/smoui";

// Thin bridges between smoui and server-action forms. smoui has no plain
// Button, and its Combobox/Checkbox do not post a value on their own.

const TONES: Record<string, CSSProperties> = {
  primary: { background: "var(--color-brand)", color: "var(--color-ink)" },
  secondary: { background: "var(--color-fill)", color: "var(--color-ink)" },
  danger: { background: "#fde4e4", color: "var(--color-cancelled)" },
  quiet: { background: "transparent", color: "var(--color-brand-ink)" },
};

/** smoui StatefulButton as a native submit. The label is the same in every
 *  phase so the server redirect never flashes a fake "Saved". */
export function SubmitButton({
  children,
  tone = "primary",
  full,
  small,
  large,
  className,
}: {
  children: string;
  tone?: keyof typeof TONES;
  full?: boolean;
  small?: boolean;
  large?: boolean;
  className?: string;
}) {
  return (
    <StatefulButton
      type="submit"
      loadingLabel={children}
      successLabel={children}
      errorLabel={children}
      className={className}
      style={{
        ...TONES[tone],
        border: 0,
        font: "inherit",
        fontSize: 14,
        fontWeight: 600,
        height: small ? 32 : large ? 56 : 40,
        padding: large ? "0 24px" : "0 16px",
        borderRadius: 8,
        width: full ? "100%" : undefined,
      }}
    >
      {children}
    </StatefulButton>
  );
}

// smoui fields carry an inline minWidth (220/240px) that spills over the
// next cell in narrow grids. min-w-0! lets the parent's column decide.
const FIT = "min-w-0! w-full";

/** smoui FloatingInput that shrinks to its grid cell. */
export function Input({ className = FIT, ...props }: ComponentProps<typeof FloatingInput>) {
  return <FloatingInput className={className} {...props} />;
}

/** smoui Combobox that posts its value under `name`. */
export function Select({
  name,
  label,
  options,
  defaultValue = "",
  className = FIT,
  onChange,
}: {
  name: string;
  label: string;
  options: { value: string; label: string }[];
  defaultValue?: string;
  className?: string;
  onChange?: (value: string) => void;
}) {
  const [value, setValue] = useState(defaultValue);
  return (
    <>
      <input type="hidden" name={name} value={value} />
      <Combobox
        label={label}
        options={options}
        value={value}
        onChange={(v) => {
          setValue(v);
          onChange?.(v);
        }}
        className={className}
      />
    </>
  );
}

/** smoui Checkbox that posts `value` under `name` while checked. */
export function CheckField({
  name,
  value = "on",
  defaultChecked,
  children,
}: {
  name: string;
  value?: string;
  defaultChecked?: boolean;
  children: ReactNode;
}) {
  const [on, setOn] = useState(!!defaultChecked);
  return (
    <>
      {on && <input type="hidden" name={name} value={value} />}
      <Checkbox checked={on} onChange={setOn}>
        {children}
      </Checkbox>
    </>
  );
}

/** smoui SegmentedControl that posts its value under `name`. One tap to pick. */
export function Segmented({
  name,
  label,
  options,
  defaultValue,
}: {
  name: string;
  label: string;
  options: { value: string; label: string }[];
  defaultValue: string;
}) {
  const [value, setValue] = useState(defaultValue);
  return (
    <>
      <input type="hidden" name={name} value={value} />
      <SegmentedControl label={label} options={options} value={value} onChange={setValue} />
    </>
  );
}
