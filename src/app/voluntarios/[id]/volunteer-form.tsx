"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  ROLE_LABELS,
  VOLUNTEER_ROLES,
  type Volunteer,
  type VolunteerRole,
} from "@/lib/volunteer";
import { updateVolunteer } from "../actions";

const FIELD_CLASS =
  "w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-teal-600 focus:outline-none focus:ring-2 focus:ring-teal-600/30 disabled:bg-slate-50 disabled:text-slate-500";

export function VolunteerForm({
  volunteer,
  isCurrentUser,
}: {
  volunteer: Volunteer;
  isCurrentUser: boolean;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const [nome, setNome] = useState(volunteer.nome ?? "");
  const [sobrenome, setSobrenome] = useState(volunteer.sobrenome ?? "");
  const [telefone, setTelefone] = useState(volunteer.telefone ?? "");
  const [papel, setPapel] = useState<VolunteerRole>(volunteer.papel);
  const [feedback, setFeedback] = useState<{
    ok: boolean;
    message: string;
  } | null>(null);

  const isDirty =
    nome !== (volunteer.nome ?? "") ||
    sobrenome !== (volunteer.sobrenome ?? "") ||
    telefone !== (volunteer.telefone ?? "") ||
    papel !== volunteer.papel;

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFeedback(null);

    startTransition(async () => {
      const result = await updateVolunteer(volunteer.id, {
        nome,
        sobrenome,
        telefone,
        papel,
      });

      setFeedback({
        ok: result.ok,
        message: result.message ?? (result.ok ? "Dados atualizados." : "Erro."),
      });

      if (result.ok) router.refresh();
    });
  }

  return (
    <section className="mt-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <h2 className="text-base font-semibold text-slate-900">Dados</h2>

      <form onSubmit={handleSubmit} className="mt-4 space-y-4" noValidate>
        <div>
          <label htmlFor="nome" className="mb-1.5 block text-sm font-medium text-slate-700">
            Nome
          </label>
          <input
            id="nome"
            value={nome}
            onChange={(event) => setNome(event.target.value)}
            required
            className={FIELD_CLASS}
          />
        </div>

        <div>
          <label htmlFor="sobrenome" className="mb-1.5 block text-sm font-medium text-slate-700">
            Sobrenome
          </label>
          <input
            id="sobrenome"
            value={sobrenome}
            onChange={(event) => setSobrenome(event.target.value)}
            className={FIELD_CLASS}
          />
        </div>

        <div>
          <label htmlFor="email" className="mb-1.5 block text-sm font-medium text-slate-700">
            E-mail
          </label>
          <input id="email" value={volunteer.email} disabled className={FIELD_CLASS} />
          <p className="mt-1.5 text-xs text-slate-500">
            Sincronizado com o login do voluntário; não pode ser alterado por aqui.
          </p>
        </div>

        <div>
          <label htmlFor="telefone" className="mb-1.5 block text-sm font-medium text-slate-700">
            Telefone
          </label>
          <input
            id="telefone"
            type="tel"
            inputMode="tel"
            value={telefone}
            onChange={(event) => setTelefone(event.target.value)}
            placeholder="(11) 90000-0000"
            className={FIELD_CLASS}
          />
        </div>

        <div>
          <label htmlFor="papel" className="mb-1.5 block text-sm font-medium text-slate-700">
            Papel
          </label>
          <select
            id="papel"
            value={papel}
            onChange={(event) => setPapel(event.target.value as VolunteerRole)}
            disabled={isCurrentUser}
            className={FIELD_CLASS}
          >
            {VOLUNTEER_ROLES.map((role) => (
              <option key={role} value={role}>
                {ROLE_LABELS[role]}
              </option>
            ))}
          </select>
          {isCurrentUser && (
            <p className="mt-1.5 text-xs text-slate-500">
              Você não pode alterar o seu próprio papel.
            </p>
          )}
        </div>

        {feedback && (
          <p
            role="status"
            className={`rounded-lg border px-4 py-3 text-sm ${
              feedback.ok
                ? "border-teal-200 bg-teal-50 text-teal-800"
                : "border-red-200 bg-red-50 text-red-700"
            }`}
          >
            {feedback.message}
          </p>
        )}

        <button
          type="submit"
          disabled={isPending || !isDirty}
          className="w-full rounded-lg bg-teal-700 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-teal-800 focus:outline-none focus:ring-2 focus:ring-teal-600 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isPending ? "Salvando..." : "Salvar alterações"}
        </button>
      </form>
    </section>
  );
}
