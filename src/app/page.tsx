import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { isProfileComplete } from "@/lib/volunteer";

export const metadata: Metadata = {
  title: "Início",
};

export default async function HomePage() {
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

  // First-time users must complete their profile (name, last name and
  // phone) before using the platform.
  const needsProfileCompletion =
    !volunteer || !isProfileComplete(volunteer);

  if (needsProfileCompletion) {
    redirect("/complete-profile");
  }

  return (
    <main className="flex flex-1 items-center justify-center p-6">
      <h1 className="text-center text-3xl font-semibold tracking-tight text-slate-900 sm:text-4xl">
        Bem-vindo, {volunteer.nome}!
      </h1>
    </main>
  );
}
