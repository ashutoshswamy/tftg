"use client";

import { useState } from "react";
import { Dialog, SegmentedControl } from "@ashutoshswamy/smoui";
import { PartySelect } from "@/components/party-select";
import { Input, Select } from "@/components/ui";
import { createDriverInline, createVehicleInline } from "@/lib/actions/fleet";

type Carrier = { id: string; name: string };
type Driver = { id: string; name: string; carrierId: string | null };
type Vehicle = { id: string; plate: string; carrierId: string | null };

// Who moves the freight. "Own fleet" picks from the company's drivers and
// vehicles; "Third-party" picks a carrier first, then only that carrier's
// drivers and vehicles. Either way the driver and vehicle are optional, and a
// missing one can be added on the spot. Posts carrierId, driverId, vehicleId.
export function FleetFields({
  carriers,
  drivers: initialDrivers,
  vehicles: initialVehicles,
  defaults,
}: {
  carriers: Carrier[];
  drivers: Driver[];
  vehicles: Vehicle[];
  defaults: {
    carrierId: string | null;
    driverId: string | null;
    vehicleId: string | null;
  };
}) {
  const [kind, setKind] = useState(defaults.carrierId ? "third" : "own");
  const [carrierId, setCarrierId] = useState(defaults.carrierId ?? "");
  const [drivers, setDrivers] = useState(initialDrivers);
  const [vehicles, setVehicles] = useState(initialVehicles);
  const [driverId, setDriverId] = useState(defaults.driverId ?? "");
  const [vehicleId, setVehicleId] = useState(defaults.vehicleId ?? "");
  const [newDriver, setNewDriver] = useState({ name: "", phone: "" });
  const [newPlate, setNewPlate] = useState("");

  const owner = kind === "third" ? carrierId : "";
  const mine = <T extends { carrierId: string | null }>(r: T) =>
    (r.carrierId ?? "") === owner;
  const driverOptions = [
    { value: "", label: "None" },
    ...drivers.filter(mine).map((d) => ({ value: d.id, label: d.name })),
  ];
  const vehicleOptions = [
    { value: "", label: "None" },
    ...vehicles.filter(mine).map((v) => ({ value: v.id, label: v.plate })),
  ];
  // Remount the pickers when the owner changes so a stale pick cannot survive.
  const scope = `${kind}-${carrierId}`;
  const needCarrier = kind === "third" && !carrierId;

  function pickKind(next: string) {
    setKind(next);
    setDriverId("");
    setVehicleId("");
  }

  async function addDriver() {
    const res = await createDriverInline({ ...newDriver, ownerId: owner });
    if ("error" in res) throw new Error(res.error);
    setDrivers((d) => [
      ...d,
      { id: res.id, name: res.name, carrierId: owner || null },
    ]);
    setDriverId(res.id);
    setNewDriver({ name: "", phone: "" });
  }

  async function addVehicle() {
    const res = await createVehicleInline({ plate: newPlate, ownerId: owner });
    if ("error" in res) throw new Error(res.error);
    setVehicles((v) => [
      ...v,
      { id: res.id, plate: res.plate, carrierId: owner || null },
    ]);
    setVehicleId(res.id);
    setNewPlate("");
  }

  return (
    <div className="space-y-5">
      <input type="hidden" name="carrierId" value={owner} />
      <input type="hidden" name="driverId" value={driverId} />
      <input type="hidden" name="vehicleId" value={vehicleId} />

      <div className="overflow-x-auto">
        <SegmentedControl
          label="Whose fleet"
          value={kind}
          onChange={pickKind}
          options={[
            { value: "own", label: "Own fleet" },
            { value: "third", label: "Third-party carrier" },
          ]}
        />
      </div>

      {kind === "third" && (
        <PartySelect
          label="Carrier"
          role="carrier"
          name="carrierPick"
          options={carriers}
          defaultValue={carrierId}
          onChange={(id) => {
            setCarrierId(id);
            setDriverId("");
            setVehicleId("");
          }}
        />
      )}

      {needCarrier ? (
        <p className="text-sm text-muted">
          Pick the carrier to choose its driver and vehicle.
        </p>
      ) : (
        <div className="grid items-start gap-4 sm:grid-cols-2">
          <div className="space-y-1">
            <Select
              key={`d-${scope}-${drivers.length}`}
              name="driverPick"
              label="Driver"
              options={driverOptions}
              defaultValue={driverId}
              onChange={setDriverId}
            />
            <Dialog
              trigger="+ New driver"
              triggerClassName="btn btn-quiet -ml-2 min-h-8"
              title="Add driver"
              confirmLabel="Add"
              onConfirm={addDriver}
            >
              <div className="space-y-3 pt-2">
                <Input
                  label="Name"
                  value={newDriver.name}
                  onChange={(e) =>
                    setNewDriver({ ...newDriver, name: e.target.value })
                  }
                />
                <Input
                  label="Phone"
                  type="tel"
                  value={newDriver.phone}
                  onChange={(e) =>
                    setNewDriver({ ...newDriver, phone: e.target.value })
                  }
                />
              </div>
            </Dialog>
          </div>

          <div className="space-y-1">
            <Select
              key={`v-${scope}-${vehicles.length}`}
              name="vehiclePick"
              label="Vehicle"
              options={vehicleOptions}
              defaultValue={vehicleId}
              onChange={setVehicleId}
            />
            <Dialog
              trigger="+ New vehicle"
              triggerClassName="btn btn-quiet -ml-2 min-h-8"
              title="Add vehicle"
              confirmLabel="Add"
              onConfirm={addVehicle}
            >
              <div className="space-y-3 pt-2">
                <Input
                  label="Plate or vehicle number"
                  value={newPlate}
                  onChange={(e) => setNewPlate(e.target.value)}
                />
              </div>
            </Dialog>
          </div>
        </div>
      )}
    </div>
  );
}
