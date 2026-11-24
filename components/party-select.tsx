"use client";

import { useState, useTransition } from "react";
import { Dialog } from "@ashutoshswamy/smoui";
import { createPartyInline } from "@/lib/actions/parties";
import { Select, Input } from "@/components/ui";

type Option = { id: string; name: string };

// A party dropdown with "+ New" always one tap away. The dialog creates the
// party in place and selects it, so the half-filled shipment form is never left.
export function PartySelect({
  label,
  name,
  role,
  options: initial,
  defaultValue,
  onChange,
}: {
  label: string;
  name: string;
  role: string;
  options: Option[];
  defaultValue?: string | null;
  onChange?: (id: string) => void;
}) {
  const [options, setOptions] = useState(initial);
  const [selected, setSelected] = useState(defaultValue ?? "");
  const [rev, setRev] = useState(0);
  const [draft, setDraft] = useState({ name: "", email: "", phone: "" });

  // Select keeps its own value; remount it (key) to adopt a newly created party.
  const [, startTransition] = useTransition();

  async function create() {
    const res = await createPartyInline({ role, ...draft });
    if ("error" in res) throw new Error(res.error);
    startTransition(() => {
      setOptions((o) => [...o, res]);
      setSelected(res.id);
      onChange?.(res.id);
      setRev((n) => n + 1);
      setDraft({ name: "", email: "", phone: "" });
    });
  }

  return (
    <div className="space-y-1">
      <Select
        key={rev}
        name={name}
        label={label}
        defaultValue={selected}
        onChange={onChange}
        options={[
          { value: "", label: "None" },
          ...options.map((p) => ({ value: p.id, label: p.name })),
        ]}
      />

      <Dialog
        trigger={`+ New ${label.toLowerCase()}`}
        title={`Add ${label.toLowerCase()}`}
        triggerClassName="btn btn-quiet -ml-2 min-h-8"
        confirmLabel="Add"
        onConfirm={create}
      >
        {/* Portalled out of the shipment form: forms cannot nest. */}
        <div className="space-y-3 pt-2">
          <Input
            label="Name"
            required
            value={draft.name}
            onChange={(e) => setDraft({ ...draft, name: e.target.value })}
          />
          <Input
            label="Email"
            type="email"
            value={draft.email}
            onChange={(e) => setDraft({ ...draft, email: e.target.value })}
          />
          <Input
            label="Phone"
            value={draft.phone}
            onChange={(e) => setDraft({ ...draft, phone: e.target.value })}
          />
        </div>
      </Dialog>
    </div>
  );
}
