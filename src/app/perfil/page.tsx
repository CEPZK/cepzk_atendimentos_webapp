import type { Metadata } from "next";
import { requireVolunteer } from "@/lib/current-volunteer";
import { ProfileForm } from "./profile-form";

// Depends on the request cookies (session): never prerender.
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Dados pessoais",
};

export default async function ProfilePage() {
  const { volunteer } = await requireVolunteer();

  return (
    <main className="flex flex-1 items-center justify-center p-6">
      <ProfileForm
        profile={{
          nome: volunteer.nome ?? "",
          sobrenome: volunteer.sobrenome ?? "",
          telefone: volunteer.telefone ?? "",
          email: volunteer.email,
        }}
      />
    </main>
  );
}
