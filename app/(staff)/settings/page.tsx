import { CountedTextarea } from "@ashutoshswamy/smoui";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAdminUser } from "@/lib/auth";
import { getLogoVersion } from "@/lib/logo";
import { updateCompanySettings, createTaxRate, uploadLogo, removeLogo } from "@/lib/actions/settings";
import { SubmitButton, CheckField, Select, Input } from "@/components/ui";

export default async function SettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string | string[] }>;
}) {
  await requireAdminUser();
  const { error } = await searchParams;
  const supabase = createAdminClient();

  const [{ data: company }, { data: taxRates }, logoVersion] = await Promise.all([
    supabase.from("company_settings").select("*").single(),
    supabase.from("tax_rates").select("id, name, rate_pct, active").order("name"),
    getLogoVersion(),
  ]);

  const errorMessage = Array.isArray(error) ? error[0] : error;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="page-title">Settings</h1>
        <p className="mt-1 text-sm text-muted">
          Company details, invoice defaults and tax rates. Only admins can change these.
        </p>
      </div>

      {errorMessage && (
        <p className="message-error" role="alert">
          {errorMessage}
        </p>
      )}

      <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_340px]">
        <div className="space-y-6">
        <Card
          title="Logo"
          description={logoVersion ? "Printed at the top of every invoice. It is saved as a 240 x 240 square, so use a square image for the sharpest result." : "Showing the default Too Far To Go logo. Upload your own (PNG or JPEG, up to 2MB, ideally 240 x 240) to print it on invoices."}
        >
          <div className="flex flex-wrap items-center gap-5">
            <div className="flex size-60 flex-none items-center justify-center rounded-xl bg-ground">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={`/api/logo?shape=square&v=${encodeURIComponent(logoVersion ?? "default")}`}
                alt="Company logo"
                width={240}
                height={240}
                className="max-h-full max-w-full object-contain"
              />
            </div>
            <div className="space-y-3">
              <form action={uploadLogo} className="flex flex-wrap items-center gap-3">
                <input
                  type="file"
                  name="logo"
                  accept="image/png,image/jpeg"
                  required
                  aria-label="Logo file"
                  className="max-w-64 text-sm file:mr-3 file:rounded-lg file:border-0 file:bg-fill file:px-3 file:py-2 file:font-semibold"
                />
                <SubmitButton>{logoVersion ? "Replace logo" : "Upload a logo"}</SubmitButton>
              </form>
              {logoVersion && (
                <form action={removeLogo}>
                  <SubmitButton tone="danger">Remove logo</SubmitButton>
                </form>
              )}
            </div>
          </div>
        </Card>

        <form action={updateCompanySettings} className="space-y-6">
          <Card
            title="Company"
            description="Printed on invoices and shown to your team."
          >
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Name" name="name" defaultValue={company?.name} required />
              <Field label="Legal name" name="legalName" defaultValue={company?.legal_name} />
              <Field label="Tax ID" name="taxId" defaultValue={company?.tax_id} />
            </div>
            <Field label="Address" name="address" defaultValue={company?.address} textarea />
          </Card>

          <Card
            title="Invoicing"
            description="Defaults for every new invoice. Each invoice keeps its own snapshot."
          >
            <div className="grid gap-4 sm:grid-cols-2">
              <Field
                label="Default currency"
                name="defaultCurrency"
                defaultValue={company?.default_currency}
                maxLength={3}
                className="uppercase"
              />
              <Select
                name="defaultTaxRateId"
                label="Default tax rate"
                defaultValue={company?.default_tax_rate_id ?? ""}
                options={[
                  { value: "", label: "None" },
                  ...(taxRates ?? []).map((rate) => ({
                    value: rate.id,
                    label: `${rate.name} (${rate.rate_pct}%)`,
                  })),
                ]}
              />
              <Field
                label="Invoice prefix"
                name="invoicePrefix"
                defaultValue={company?.invoice_prefix}
              />
              <Field
                label="Payment terms (days)"
                name="paymentTermsDays"
                type="number"
                defaultValue={String(company?.payment_terms_days ?? 15)}
              />
            </div>

            <CheckField name="pricesIncludeTax" defaultChecked={company?.prices_include_tax}>
              Line prices include tax by default
            </CheckField>

            <Field
              label="Bank details"
              name="bankDetails"
              defaultValue={company?.bank_details}
              textarea
            />
          </Card>

          <div className="flex justify-end">
            <SubmitButton>Save changes</SubmitButton>
          </div>
        </form>
        </div>

        <Card title="Tax rates" description="Pick one as the default under Invoicing.">
          <ul className="space-y-1.5 text-sm">
            {taxRates?.map((rate) => (
              <li
                key={rate.id}
                className="flex items-center justify-between rounded-lg bg-ground px-3 py-2"
              >
                <span>{rate.name}</span>
                <span className="tabular-nums text-muted">
                  {rate.rate_pct}%{!rate.active && " (inactive)"}
                </span>
              </li>
            ))}
            {!taxRates?.length && <li className="text-muted">No tax rates yet.</li>}
          </ul>

          <form action={createTaxRate} className="space-y-3">
            <div className="grid grid-cols-[minmax(0,1fr)_7.5rem] gap-3">
              <Input label="Name" name="name" required />
              <Input label="Rate %" name="ratePct" type="number" step="0.01" required />
            </div>
            <SubmitButton tone="secondary" full>Add tax rate</SubmitButton>
          </form>
        </Card>
      </div>
    </div>
  );
}

function Card({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-4 rounded-xl bg-panel p-5 sm:p-6">
      <header>
        <h2 className="section-title">{title}</h2>
        {description && <p className="mt-0.5 text-sm text-muted">{description}</p>}
      </header>
      {children}
    </section>
  );
}

function Field({
  label,
  name,
  defaultValue,
  required,
  type = "text",
  maxLength,
  textarea,
  className = "",
}: {
  label: string;
  name: string;
  defaultValue?: string | null;
  required?: boolean;
  type?: string;
  maxLength?: number;
  textarea?: boolean;
  className?: string;
}) {
  return (
    textarea ? (
      <CountedTextarea label={label} name={name} rows={2} defaultValue={defaultValue ?? ""} />
    ) : (
      <Input
        label={label}
        name={name}
        type={type}
        required={required}
        maxLength={maxLength}
        defaultValue={defaultValue ?? ""}
        style={className ? { textTransform: "uppercase" } : undefined}
      />
    )
  );
}
