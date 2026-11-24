"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { partySchema } from "@/lib/validation";

export async function createParty(formData: FormData) {
  const parsed = partySchema.safeParse({
    name: formData.get("name"),
    roles: formData.getAll("roles"),
    email: formData.get("email") ?? "",
    phone: formData.get("phone") ?? "",
  });

  if (!parsed.success) {
    redirect(
      `/directory/parties?error=${encodeURIComponent(parsed.error.issues[0]?.message ?? "Invalid party")}`
    );
  }

  const supabase = createAdminClient();
  const { name, roles, email, phone } = parsed.data;

  const { data: party, error } = await supabase
    .from("parties")
    .insert({ name, email: email || null, phone: phone || null })
    .select("id")
    .single();

  if (error || !party) {
    redirect(
      `/directory/parties?error=${encodeURIComponent(error?.message ?? "Could not create party")}`
    );
  }

  const { error: rolesError } = await supabase
    .from("party_roles")
    .insert(roles.map((role) => ({ party_id: party.id, role })));

  if (rolesError) {
    redirect(`/directory/parties?error=${encodeURIComponent(rolesError.message)}`);
  }

  revalidatePath("/directory/parties");
  redirect("/directory/parties");
}

/** Quick-add from a modal (new shipment page): one role, no redirect. */
export async function createPartyInline(input: {
  name: string;
  role: string;
  email?: string;
  phone?: string;
}): Promise<{ id: string; name: string } | { error: string }> {
  const parsed = partySchema.safeParse({
    name: input.name,
    roles: [input.role],
    email: input.email ?? "",
    phone: input.phone ?? "",
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid party" };
  }

  const supabase = createAdminClient();
  const { name, roles, email, phone } = parsed.data;

  const { data: party, error } = await supabase
    .from("parties")
    .insert({ name, email: email || null, phone: phone || null })
    .select("id, name")
    .single();
  if (error || !party) return { error: error?.message ?? "Could not create party" };

  const { error: rolesError } = await supabase
    .from("party_roles")
    .insert(roles.map((role) => ({ party_id: party.id, role })));
  if (rolesError) return { error: rolesError.message };

  revalidatePath("/directory/parties");
  return { id: party.id, name: party.name };
}
