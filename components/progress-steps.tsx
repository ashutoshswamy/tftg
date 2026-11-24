import { CheckIcon } from "@heroicons/react/24/solid";
import { Badge } from "@ashutoshswamy/smoui";
import { STATUS_META } from "@/components/status-diamond";

const STEPS = ["pending", "assigned", "in_transit", "delivered"] as const;

/** Where the shipment is on its way: done steps tick, the current one is tinted. */
export function ProgressSteps({ status }: { status: string }) {
  if (status === "cancelled") {
    return (
      <Badge tone="negative" icon="xMark">
        Cancelled
      </Badge>
    );
  }
  const current = STEPS.indexOf(status as (typeof STEPS)[number]);

  return (
    <ol className="isolate flex items-start" aria-label="Shipment progress">
      {STEPS.map((step, i) => {
        const done = i < current || status === "delivered";
        const now = i === current && status !== "delivered";
        const { Icon, label } = STATUS_META[step];
        return (
          <li
            key={step}
            aria-current={now ? "step" : undefined}
            className="relative flex flex-1 flex-col items-center gap-2 text-center"
          >
            {i > 0 && (
              <span
                aria-hidden="true"
                className={`absolute right-[calc(50%+1rem)] top-4 h-0.5 w-[calc(100%-2rem)] -translate-y-1/2 ${
                  i <= current || status === "delivered" ? "bg-brand" : "bg-line"
                }`}
              />
            )}
            <span
              aria-hidden="true"
              className={`relative z-10 flex size-8 items-center justify-center rounded-full ${
                done
                  ? "bg-brand text-ink"
                  : now
                    ? "bg-brand-soft text-brand-ink"
                    : "bg-fill text-muted"
              }`}
            >
              {done ? <CheckIcon className="size-4" /> : <Icon className="size-4" />}
            </span>
            <span
              className={`text-xs ${now ? "font-semibold text-ink" : "text-muted"}`}
            >
              {label}
            </span>
          </li>
        );
      })}
    </ol>
  );
}
