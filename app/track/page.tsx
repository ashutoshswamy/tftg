import {
  ArrowPathIcon,
  KeyIcon,
  MapPinIcon,
} from "@heroicons/react/24/outline";

import { Card } from "@/components/card";
import { SubmitButton, Input } from "@/components/ui";
import { PublicShell } from "@/components/public-shell";
import { lookupTrackingCode } from "@/lib/actions/track";

const STEPS = [
  { Icon: KeyIcon, title: "Enter your code", text: "It starts with TFTG and is in your confirmation." },
  { Icon: ArrowPathIcon, title: "See the status", text: "Pending, assigned, in transit or delivered, updated as it happens." },
  { Icon: MapPinIcon, title: "Follow the truck", text: "A live map shows the route once your freight is moving." },
];

export default async function TrackPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string | string[]; code?: string }>;
}) {
  const { error, code } = await searchParams;
  const errorMessage = Array.isArray(error) ? error[0] : error;

  return (
    <PublicShell width="max-w-5xl">
      <div className="grid items-center gap-8 pt-2 lg:min-h-[60dvh] lg:grid-cols-2 lg:gap-14">
        <div className="space-y-6">
          <div className="space-y-2">
            <h1 className="text-4xl font-bold leading-tight sm:text-5xl">
              Where is my freight?
            </h1>
            <p className="max-w-[40ch] text-lg text-muted">
              Enter the tracking code from your confirmation. No account needed.
            </p>
          </div>

          <form action={lookupTrackingCode} className="space-y-3">
            {errorMessage && (
              <p className="message-error" role="alert">
                {errorMessage}
              </p>
            )}
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start">
              <Input
                label="Tracking code"
                name="code"
                required
                autoComplete="off"
                autoCapitalize="characters"
                defaultValue={code ?? ""}
                className="flex-1"
              />
              <SubmitButton large>Track shipment</SubmitButton>
            </div>
          </form>
        </div>

        <Card title="How it works">
          <ol className="space-y-4">
            {STEPS.map(({ Icon, title, text }) => (
              <li key={title} className="flex gap-4">
                <span className="flex size-10 flex-none items-center justify-center rounded-lg bg-brand-soft text-brand-ink">
                  <Icon className="size-5" aria-hidden="true" />
                </span>
                <div>
                  <p className="font-semibold">{title}</p>
                  <p className="text-sm text-muted">{text}</p>
                </div>
              </li>
            ))}
          </ol>
        </Card>
      </div>
    </PublicShell>
  );
}
