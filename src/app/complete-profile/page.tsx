import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { isProfileComplete } from "@/lib/volunteer";
import { CompleteProfileForm } from "./complete-profile-form";

// These pages depend on the request cookies (session): never prerender
// them, otherwise a build made without the Supabase credentials would bake
// a permanent redirect into the output.
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Complete seu cadastro",
};

export default async function CompleteProfilePage() {
  const supabase = await createClient();
  if (!supabase) {
    redirect("/login?error=config");
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    redirect("/login");
  }

  const { data: volunteer } = await supabase
    .from("cepzk_voluntario")
    .select("id, nome, sobrenome, telefone")
    .eq("id", user.id)
    .maybeSingle();

  // The row is created by a database trigger as soon as the invite is
  // sent, but fall back to the Auth metadata if it is not there yet.
  const profile = {
    id: volunteer?.id ?? user.id,
    nome: volunteer?.nome ?? (user.user_metadata?.nome as string | undefined) ?? null,
    sobrenome: volunteer?.sobrenome ?? null,
    telefone: volunteer?.telefone ?? null,
  };

  if (isProfileComplete(profile)) {
    redirect("/");
  }

  return (
    <main className="flex flex-1 items-center justify-center p-6">
      <CompleteProfileForm profile={profile} />
    </main>
  );
}
