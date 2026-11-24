"use client";

import { useRouter } from "next/navigation";
import { SegmentedControl } from "@ashutoshswamy/smoui";

export function StatusFilter({
  value,
  options,
}: {
  value: string;
  options: { value: string; label: string }[];
}) {
  const router = useRouter();
  return (
    <SegmentedControl
      label="Filter by status"
      options={options}
      value={value}
      onChange={(v) => router.push(v ? `/shipments?status=${v}` : "/shipments")}
    />
  );
}
