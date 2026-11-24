-- Order lines live on the shipment, entered when it is created. Invoicing
-- copies them into invoice_items and only asks staff to confirm.
create table shipment_items (
  id uuid primary key default gen_random_uuid(),
  shipment_id uuid not null references shipments (id) on delete cascade,
  position int not null default 0,
  description text not null,
  qty numeric not null default 1 check (qty > 0),
  unit_price_minor bigint not null default 0,
  tax_rate_pct numeric(7, 4) not null default 0,
  tax_name text
);

create index shipment_items_shipment_idx on shipment_items (shipment_id, position);

alter table shipment_items enable row level security;
create policy staff_all on shipment_items for all
  using (auth.uid() is not null) with check (auth.uid() is not null);
