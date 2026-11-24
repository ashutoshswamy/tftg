"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { UserButton } from "@clerk/nextjs";
import { Sidebar, type SidebarItem } from "@ashutoshswamy/smoui";
import { Brand } from "@/components/brand";

// heroicons outline truck. smoui's Sidebar only takes its own icon names and
// has no vehicle, so this path is swapped into the Fleet item's svg below.
const TRUCK =
  "M8.25 18.75a1.5 1.5 0 0 1-3 0m3 0a1.5 1.5 0 0 0-3 0m3 0h6m-9 0H3.375a1.125 1.125 0 0 1-1.125-1.125V14.25m17.25 4.5a1.5 1.5 0 0 1-3 0m3 0a1.5 1.5 0 0 0-3 0m3 0h1.125c.621 0 1.129-.504 1.09-1.124a17.902 17.902 0 0 0-3.213-9.193 2.056 2.056 0 0 0-1.58-.86H14.25M16.5 18.75h-2.25m0-11.177v-.958c0-.568-.422-1.048-.987-1.106a48.554 48.554 0 0 0-10.026 0 1.106 1.106 0 0 0-.987 1.106v7.635m12-6.677v6.677m0 4.5v-4.5m0 0h-12";

const ITEMS: (SidebarItem & { href: string })[] = [
  { id: "dashboard", href: "/dashboard", label: "Dashboard", icon: "squares" },
  {
    id: "shipments",
    href: "/shipments",
    label: "Shipments",
    icon: "inboxStack",
  },
  {
    id: "dispatch",
    href: "/dispatch",
    label: "Dispatch",
    icon: "arrowsRightLeft",
  },
  { id: "map", href: "/map", label: "Live map", icon: "mapPin" },
  { id: "fleet", href: "/fleet", label: "Fleet", icon: "users" },
  {
    id: "directory",
    href: "/directory/parties",
    label: "Directory",
    icon: "folder",
  },
  { id: "invoices", href: "/invoices", label: "Invoices", icon: "document" },
  { id: "settings", href: "/settings", label: "Settings", icon: "cog" },
  {
    id: "organization",
    href: "/organization",
    label: "Organization",
    icon: "shieldCheck",
  },
];

export function AppSidebar({
  name,
  role,
}: {
  name: string;
  role: "admin" | "dispatcher";
}) {
  const items =
    role === "admin" ? ITEMS : ITEMS.filter((i) => i.id !== "settings");
  const router = useRouter();
  const pathname = usePathname();
  const [narrow, setNarrow] = useState(false);

  // Fold to icons on phones. Remount (key) because smoui reads
  // defaultCollapsed once.
  useEffect(() => {
    setNarrow(window.matchMedia("(max-width: 767px)").matches);
  }, []);

  // No deps: smoui re-renders its rows on collapse and route change, and
  // the swap is idempotent.
  const fleetAt = items.findIndex((i) => i.id === "fleet") + 1;
  useEffect(() => {
    const svg = document.querySelector(
      `.app-sidebar div[role="listitem"]:nth-of-type(${fleetAt}) svg`,
    );
    if (svg && svg.getAttribute("data-truck") !== "1") {
      svg.setAttribute("data-truck", "1");
      svg.innerHTML = `<path d="${TRUCK}"/>`;
    }
  });

  const active = items.find(
    (i) => pathname === i.href || pathname.startsWith(`${i.href}/`),
  )?.id;

  return (
    <Sidebar
      key={narrow ? "narrow" : "wide"}
      defaultCollapsed={narrow}
      height="100dvh"
      // smoui draws its own sparkles tile; hide it so TFTG is the only logo.
      className="app-sidebar"
      title={<Brand size={30} />}
      items={items}
      value={active}
      onChange={(id) => router.push(ITEMS.find((i) => i.id === id)!.href)}
      footer={(collapsed) => (
        <div className="flex flex-col gap-3 px-2 pb-1">
          <div className="flex items-center gap-3">
            <UserButton appearance={{ elements: { avatarBox: "size-9" } }} />
            {!collapsed && (
              <div className="min-w-0 text-sm">
                <p className="truncate font-semibold">{name}</p>
                <p className="capitalize text-muted">{role}</p>
              </div>
            )}
          </div>
        </div>
      )}
    />
  );
}
