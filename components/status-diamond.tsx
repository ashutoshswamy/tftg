import { Badge } from "@ashutoshswamy/smoui";
import type { ComponentType, SVGProps } from "react";
import {
  CheckCircleIcon,
  ClockIcon,
  TruckIcon,
  UserCircleIcon,
  XCircleIcon,
} from "@heroicons/react/24/solid";

// Status is a tinted tile with a Heroicon plus the text label (see
// StatusBadge): colour is never the only carrier, the icon is decorative.
export const STATUS_META = {
  pending: { label: "Pending", n: 1, Icon: ClockIcon, fg: "#475569", bg: "#eef1f6" },
  assigned: { label: "Assigned", n: 2, Icon: UserCircleIcon, fg: "#1d4ed8", bg: "#e6edff" },
  in_transit: { label: "In transit", n: 3, Icon: TruckIcon, fg: "#b34a00", bg: "#ffe8d2" },
  delivered: { label: "Delivered", n: 4, Icon: CheckCircleIcon, fg: "#15803d", bg: "#dff5e6" },
  cancelled: { label: "Cancelled", n: 5, Icon: XCircleIcon, fg: "#b91c1c", bg: "#fde4e4" },
} as const satisfies Record<
  string,
  {
    label: string;
    n: number;
    Icon: ComponentType<SVGProps<SVGSVGElement>>;
    fg: string;
    bg: string;
  }
>;

export type ShipmentStatus = keyof typeof STATUS_META;

export function isShipmentStatus(value: string): value is ShipmentStatus {
  return value in STATUS_META;
}

export function StatusIcon({
  status,
  size = 28,
  className,
}: {
  status: string;
  size?: number;
  className?: string;
}) {
  const meta = isShipmentStatus(status) ? STATUS_META[status] : STATUS_META.pending;
  const Icon = meta.Icon;

  return (
    <span
      aria-hidden="true"
      className={`inline-flex flex-none items-center justify-center rounded-lg ${className ?? ""}`}
      style={{ width: size, height: size, background: meta.bg, color: meta.fg }}
    >
      <Icon style={{ width: size * 0.62, height: size * 0.62 }} />
    </span>
  );
}

const BADGE = {
  pending: { tone: "neutral", icon: "clock" },
  assigned: { tone: "accent", icon: "userPlus" },
  in_transit: { tone: "warning", icon: "arrowRight" },
  delivered: { tone: "positive", icon: "check" },
  cancelled: { tone: "negative", icon: "xMark" },
} as const;

/** smoui Badge: icon plus its text label, so colour is never the only carrier. */
export function StatusBadge({ status }: { status: string }) {
  if (!isShipmentStatus(status)) return <Badge>{status.replace("_", " ")}</Badge>;
  const { tone, icon } = BADGE[status];
  return (
    <Badge tone={tone} icon={icon}>
      {STATUS_META[status].label}
    </Badge>
  );
}
