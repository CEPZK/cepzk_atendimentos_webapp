"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { VolunteerProfile } from "@/lib/volunteer";

interface CompleteProfileFormProps {
  profile: VolunteerProfile;
}

export function CompleteProfileForm({ profile }: CompleteProfileFormProps) {
  const router = useRouter();

  const [nome, setNome] = useState(profile.nome ?? "");
  const [sobrenome, setSobrenome] = useState(profile.sobrenome ?? "");
  const [telefone, setTelefone] = useState(profile.telefone ?? "");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    const values = {
      nome: nome.trim(),
      sobrenome: sobrenome.trim(),
      telefone: telefone.trim(),
    };

    if (!values.nome || !values.sobrenome || !values.telefone) {
      setError("Todos os campos são obrigatórios.");
      return;
    }

    // Basic phone validation: only digits/spaces/+()- and at least 8 digits.
    const phoneDigits = values.telefone.replace(/\D/g, "");
    if (phoneDigits.length < 8) {
      setError("Informe um telefone válido.");
      return;
    }

    setIsSubmitting(true);

    try {
      const { createClient } = await import("@/lib/supabase/client");
      const supabase = createClient();

      // The first name lives in the Auth metadata; the database triggers
      // mirror it to `cepzk_voluntario.nome`.
      const { error: updateUserError } = await supabase.auth.updateUser({
        data: { nome: values.nome },
      });
      if (updateUserError) {
        setError("Não foi possível salvar seus dados. Tente novamente.");
        setIsSubmitting(false);
        return;
      }

      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        setError("Sua sessão expirou. Entre novamente.");
        setIsSubmitting(false);
        return;
      }

      // Last name and phone are stored directly in the volunteer profile.
      const { error: profileError } = await supabase
        .from("cepzk_voluntario")
        .update({ sobrenome: values.sobrenome, telefone: values.telefone })
        .eq("id", user.id);

      if (profileError) {
        setError("Não foi possível salvar seus dados. Tente novamente.");
        setIsSubmitting(false);
        return;
      }
    } catch {
      setError(
        "Serviço temporariamente indisponível. Tente novamente em alguns instantes.",
      );
      setIsSubmitting(false);
      return;
    }

    setIsSubmitting(false);
    router.replace("/");
    router.refresh();
  }

  return (
    <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
      <h1 className="text-2xl font-semibold tracking-tight text-slate-900">
        Complete seu cadastro
      </h1>
      <p className="mt-2 text-sm leading-relaxed text-slate-600">
        Antes de começar, precisamos de algumas informações suas. Todos os
        campos são obrigatórios.
      </p>

      {error && (
        <div className="mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="mt-6 space-y-4" noValidate>
        <div>
          <label
            htmlFor="nome"
            className="mb-1.5 block text-sm font-medium text-slate-700"
          >
            Nome
          </label>
          <input
            id="nome"
            name="nome"
            type="text"
            autoComplete="given-name"
            required
            value={nome}
            onChange={(event) => setNome(event.target.value)}
            placeholder="Seu nome"
            className="w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-teal-600 focus:outline-none focus:ring-2 focus:ring-teal-600/30"
          />
        </div>

        <div>
          <label
            htmlFor="sobrenome"
            className="mb-1.5 block text-sm font-medium text-slate-700"
          >
            Sobrenome
          </label>
          <input
            id="sobrenome"
            name="sobrenome"
            type="text"
            autoComplete="family-name"
            required
            value={sobrenome}
            onChange={(event) => setSobrenome(event.target.value)}
            placeholder="Seu sobrenome"
            className="w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-teal-600 focus:outline-none focus:ring-2 focus:ring-teal-600/30"
          />
        </div>

        <div>
          <label
            htmlFor="telefone"
            className="mb-1.5 block text-sm font-medium text-slate-700"
          >
            Telefone
          </label>
          <input
            id="telefone"
            name="telefone"
            type="tel"
            autoComplete="tel"
            required
            value={telefone}
            onChange={(event) => setTelefone(event.target.value)}
            placeholder="(00) 00000-0000"
            className="w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-teal-600 focus:outline-none focus:ring-2 focus:ring-teal-600/30"
          />
        </div>

        <button
          type="submit"
          disabled={isSubmitting}
          className="w-full rounded-lg bg-teal-700 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-teal-800 focus:outline-none focus:ring-2 focus:ring-teal-600 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isSubmitting ? "Salvando..." : "Salvar e continuar"}
        </button>
      </form>
    </div>
  );
}
