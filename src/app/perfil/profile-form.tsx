"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

interface ProfileFormProps {
  profile: {
    nome: string;
    sobrenome: string;
    telefone: string;
    email: string;
  };
}

/**
 * The volunteer's personal data, same shape as the first-login screen:
 * everything is editable and required, except the e-mail — the login
 * itself — which is shown read-only.
 */
export function ProfileForm({ profile }: ProfileFormProps) {
  const router = useRouter();

  const [nome, setNome] = useState(profile.nome);
  const [sobrenome, setSobrenome] = useState(profile.sobrenome);
  const [telefone, setTelefone] = useState(profile.telefone);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setSaved(false);

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
        console.error("[cepzk] Failed to update the auth metadata", updateUserError);
        setError(
          `Não foi possível salvar seus dados (${updateUserError.message}).`,
        );
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
        console.error("[cepzk] Failed to save the profile", profileError);
        setError(
          `Não foi possível salvar seus dados (${profileError.code ?? "erro"}: ${profileError.message}).`,
        );
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
    setSaved(true);
    // The app bar shows the name taken from the profile; refresh the
    // server components so it reflects the change right away.
    router.refresh();
  }

  const inputClass =
    "w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-sky-600 focus:outline-none focus:ring-2 focus:ring-sky-600/30";

  return (
    <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
      <h1 className="text-2xl font-semibold tracking-tight text-slate-900">
        Dados pessoais
      </h1>
      <p className="mt-2 text-sm leading-relaxed text-slate-600">
        Confira e mantenha seus dados atualizados. Todos os campos são
        obrigatórios, exceto o e-mail, que é o seu acesso e não pode ser
        alterado.
      </p>

      {error && (
        <div className="mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}
      {saved && !error && (
        <div className="mt-4 rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">
          Dados salvos.
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
            className={inputClass}
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
            className={inputClass}
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
            className={inputClass}
          />
        </div>

        <div>
          <label
            htmlFor="email"
            className="mb-1.5 block text-sm font-medium text-slate-700"
          >
            E-mail
          </label>
          <input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            readOnly
            value={profile.email}
            className="w-full cursor-not-allowed rounded-lg border border-slate-200 bg-slate-100 px-3.5 py-2.5 text-sm text-slate-500 focus:outline-none"
          />
          <p className="mt-1.5 text-xs text-slate-500">
            O e-mail é o seu login e não pode ser alterado.
          </p>
        </div>

        <button
          type="submit"
          disabled={isSubmitting}
          className="w-full rounded-lg bg-sky-600 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-sky-700 focus:outline-none focus:ring-2 focus:ring-sky-600 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isSubmitting ? "Salvando..." : "Salvar alterações"}
        </button>
      </form>

      <Link
        href="/"
        className="mt-4 block text-center text-sm font-medium text-sky-700 transition-colors hover:text-sky-800"
      >
        Voltar ao início
      </Link>
    </div>
  );
}
