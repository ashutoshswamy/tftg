-- TMS core schema. Run this once in the Supabase SQL editor (or via the
-- Supabase CLI) on a fresh project.

create extension if not exists "pgcrypto";

-- ===== system =====================================================

create table profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text not null,
  role text not null default 'dispatcher' check (role in ('admin', 'dispatcher')),
  created_at timestamptz not null default now()
);

create table company_settings (
  id boolean primary key default true check (id), -- enforces a single row
  name text not null default '',
  legal_name text,
  tax_id text,
  address text,
  default_currency text not null default 'USD',
  default_tax_rate_id uuid,
  prices_include_tax boolean not null default false,
  invoice_prefix text not null default 'INV',
  payment_terms_days int not null default 15,
  bank_details text
);
insert into company_settings (id) values (true);

create table tax_rates (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  rate_pct numeric(7, 4) not null,
  active boolean not null default true
);

alter table company_settings
  add constraint company_settings_tax_rate_fk
  foreign key (default_tax_rate_id) references tax_rates (id);

-- ===== directory (reusable across shipments) ======================

create table parties (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  legal_name text,
  tax_id text,
  email text,
  phone text,
  default_currency text,
  default_tax_rate_id uuid references tax_rates (id),
  payment_terms_days int,
  notes text,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table party_roles (
  party_id uuid not null references parties (id) on delete cascade,
  role text not null check (
    role in ('customer', 'shipper', 'consignee', 'supplier', 'carrier', 'agent', 'notify_party')
  ),
  primary key (party_id, role)
);

create table contacts (
  id uuid primary key default gen_random_uuid(),
  party_id uuid not null references parties (id) on delete cascade,
  name text not null,
  role text,
  email text,
  phone text,
  is_primary boolean not null default false
);

create table locations (
  id uuid primary key default gen_random_uuid(),
  party_id uuid references parties (id) on delete set null,
  label text not null,
  address_line1 text,
  address_line2 text,
  city text,
  state text,
  postal_code text,
  country text,
  port_code text,
  lat double precision,
  lng double precision,
  hours text,
  notes text,
  active boolean not null default true
);

create table drivers (
  id uuid primary key default gen_random_uuid(),
  carrier_id uuid references parties (id) on delete set null,
  name text not null,
  phone text,
  email text,
  license_no text,
  active boolean not null default true
);

create table vehicles (
  id uuid primary key default gen_random_uuid(),
  carrier_id uuid references parties (id) on delete set null,
  type text not null default 'truck' check (type in ('truck', 'van', 'rail_car', 'container', 'other')),
  plate text,
  capacity text,
  telematics_id text,
  active boolean not null default true
);

create table charge_catalog (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  default_unit_price_minor bigint not null default 0,
  currency text,
  tax_rate_id uuid references tax_rates (id),
  active boolean not null default true
);

create table cargo_templates (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  commodity text,
  packaging text,
  weight_kg numeric,
  dims text,
  hazmat boolean not null default false
);

-- ===== operations ===================================================

create table shipments (
  id uuid primary key default gen_random_uuid(),
  tracking_code text not null unique,
  customer_token text not null unique,
  driver_token text not null unique,
  tokens_expire_at timestamptz,

  mode text not null default 'road' check (mode in ('road', 'rail', 'air', 'ocean', 'courier')),
  status text not null default 'pending' check (
    status in ('pending', 'assigned', 'in_transit', 'delivered', 'cancelled')
  ),

  customer_id uuid references parties (id),
  shipper_id uuid references parties (id),
  consignee_id uuid references parties (id),
  carrier_id uuid references parties (id),
  driver_id uuid references drivers (id),
  vehicle_id uuid references vehicles (id),

  currency text,
  tax_rate_id uuid references tax_rates (id),
  prices_include_tax boolean,

  details jsonb not null default '{}'::jsonb, -- mode-specific fields (container no., AWB, BL, etc.)
  notes text,

  created_by uuid references profiles (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index shipments_status_idx on shipments (status);
create index shipments_customer_idx on shipments (customer_id);

create table stops (
  id uuid primary key default gen_random_uuid(),
  shipment_id uuid not null references shipments (id) on delete cascade,
  sequence int not null,
  kind text not null default 'stop' check (kind in ('pickup', 'dropoff', 'transit_hub', 'stop')),
  location_id uuid references locations (id),
  -- snapshot of the address at booking time, so editing the saved location
  -- later never rewrites history on this shipment
  address_snapshot text,
  scheduled_at timestamptz,
  arrived_at timestamptz,
  departed_at timestamptz
);

create index stops_shipment_idx on stops (shipment_id, sequence);

create table status_events (
  id uuid primary key default gen_random_uuid(),
  shipment_id uuid not null references shipments (id) on delete cascade,
  status text not null,
  note text,
  created_by text, -- profile id for staff, 'driver' for token-authenticated updates
  created_at timestamptz not null default now()
);

create index status_events_shipment_idx on status_events (shipment_id, created_at);

create table documents (
  id uuid primary key default gen_random_uuid(),
  shipment_id uuid not null references shipments (id) on delete cascade,
  kind text not null default 'other' check (kind in ('pod', 'invoice', 'bol', 'photo', 'other')),
  storage_path text not null,
  uploaded_by text,
  created_at timestamptz not null default now()
);

create table location_pings (
  id bigint generated always as identity primary key,
  shipment_id uuid not null references shipments (id) on delete cascade,
  lat double precision not null,
  lng double precision,
  speed numeric,
  heading numeric,
  accuracy numeric,
  recorded_at timestamptz not null default now()
);

create index location_pings_shipment_idx on location_pings (shipment_id, recorded_at desc);

-- ===== money =========================================================

create table invoices (
  id uuid primary key default gen_random_uuid(),
  number text unique, -- assigned at finalize, null while draft
  shipment_id uuid references shipments (id),
  customer_id uuid references parties (id),
  status text not null default 'draft' check (status in ('draft', 'sent', 'paid', 'void')),
  currency text not null,
  prices_include_tax boolean not null default false,
  issue_date date,
  due_date date,
  subtotal_minor bigint not null default 0,
  tax_total_minor bigint not null default 0,
  total_minor bigint not null default 0,
  notes text,
  pdf_path text,
  invoice_token text not null unique default encode(gen_random_bytes(24), 'base64url'),
  created_at timestamptz not null default now()
);

create table invoice_items (
  id uuid primary key default gen_random_uuid(),
  invoice_id uuid not null references invoices (id) on delete cascade,
  description text not null,
  qty numeric not null default 1,
  unit_price_minor bigint not null,
  tax_rate_pct numeric(7, 4) not null default 0,
  tax_name text,
  amount_minor bigint not null -- qty * unit_price_minor, computed app-side
);

create table payments (
  id uuid primary key default gen_random_uuid(),
  invoice_id uuid not null references invoices (id) on delete cascade,
  amount_minor bigint not null,
  paid_at date not null default current_date,
  method text,
  reference text
);

-- ===== invoice numbering (sequential, no gaps on failed finalizes) ===

create sequence invoice_number_seq start 1;

create or replace function next_invoice_number() returns text as $$
declare
  prefix text;
  n bigint;
begin
  select invoice_prefix into prefix from company_settings where id = true;
  n := nextval('invoice_number_seq');
  return prefix || '-' || to_char(now(), 'YYYY') || '-' || lpad(n::text, 4, '0');
end;
$$ language plpgsql;

-- ===== row level security: staff only, service role bypasses ========

alter table profiles enable row level security;
alter table company_settings enable row level security;
alter table tax_rates enable row level security;
alter table parties enable row level security;
alter table party_roles enable row level security;
alter table contacts enable row level security;
alter table locations enable row level security;
alter table drivers enable row level security;
alter table vehicles enable row level security;
alter table charge_catalog enable row level security;
alter table cargo_templates enable row level security;
alter table shipments enable row level security;
alter table stops enable row level security;
alter table status_events enable row level security;
alter table documents enable row level security;
alter table location_pings enable row level security;
alter table invoices enable row level security;
alter table invoice_items enable row level security;
alter table payments enable row level security;

-- one policy per table: any authenticated staff member (row exists in
-- profiles) gets full access. Public token routes use the service-role
-- client, which ignores RLS and authorizes on the token itself.
do $$
declare
  t text;
begin
  for t in select unnest(array[
    'profiles', 'company_settings', 'tax_rates', 'parties', 'party_roles',
    'contacts', 'locations', 'drivers', 'vehicles', 'charge_catalog',
    'cargo_templates', 'shipments', 'stops', 'status_events', 'documents',
    'location_pings', 'invoices', 'invoice_items', 'payments'
  ])
  loop
    execute format(
      'create policy staff_all on %I for all using (auth.uid() is not null) with check (auth.uid() is not null)',
      t
    );
  end loop;
end $$;

-- storage buckets for documents/invoice PDFs are created via the dashboard
-- or the storage API, not SQL — see README for the two bucket names.
