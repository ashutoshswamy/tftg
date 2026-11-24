"use client";

import { useRef } from "react";
import { Kanban, type KanbanColumn } from "@ashutoshswamy/smoui";
import { moveShipment } from "@/lib/actions/shipments";

// Drop a card in another column and the shipment's status changes (and a
// status event is logged), exactly like the status form on its page.
export function DispatchBoard({ columns }: { columns: KanbanColumn[] }) {
  const where = useRef(
    new Map(columns.flatMap((c) => c.cards.map((card) => [card.id, c.id] as const)))
  );

  return (
    <Kanban
      columns={columns}
      onChange={(next) => {
        for (const col of next) {
          for (const card of col.cards) {
            if (where.current.get(card.id) !== col.id) {
              where.current.set(card.id, col.id);
              void moveShipment(card.id, col.id);
            }
          }
        }
      }}
    />
  );
}
