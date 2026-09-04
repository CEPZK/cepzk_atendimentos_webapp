import "server-only";

import { cache } from "react";
import { redirect } from "next/navigation";
import {
  getSupabase,
  loadVolunteerAtendimentos,
  requireVolunteer,
  type CurrentVolunteer,
} from "@/lib/current-volunteer";
import { isAdmin } from "@/lib/volunteer";
import type { AtendimentoItem } from "@/lib/atendimento";

/**
 * Who the signed-in volunteer may see in the assistidos screens.
 *
 * Two levels:
 *
 * - **full** — admins only: every assistido, every treatment;
 * - **por escala** — the teams: only the assistidos with a
 *   treatment in one of the atendimentos they are scheduled for, and of
 *   those assistidos only their own treatment is shown in full.
 *
 * The Atendimento Fraterno no longer reads the assistidos here: their
 * entry point is the Cadastrar Assistido screen. The database still
 * grants full access to every authenticated user (RLS v1), so this is
 * the real gate and has to be checked again inside every Server Action.
 */
export interface AssistidoAccess extends CurrentVolunteer {
  /** Sees every assistido and every treatment. */
  isFull: boolean;
  /** Atendimentos of the volunteer's escala. */
  atendimentos: AtendimentoItem[];
  atendimentoIds: number[];
  /** Whether this treatment can be read in full. */
  canSeeTreatment: (atendimentoId: number | null) => boolean;
  /** Whether this treatment's state can be changed by this volunteer. */
  canManageTreatment: (atendimentoId: number | null) => boolean;
}

export const requireAssistidoAccess = cache(
  async (): Promise<AssistidoAccess> => {
    const supabase = await getSupabase();
    const { volunteer } = await requireVolunteer();

    const atendimentos = await loadVolunteerAtendimentos(
      supabase,
      volunteer.id,
    );

    const admin = isAdmin(volunteer);
    const isFull = admin;
    const atendimentoIds = atendimentos.map((atendimento) => atendimento.id);

    // Without a single escala (and not an admin): there is nothing to show.
    if (!isFull && atendimentoIds.length === 0) {
      redirect("/");
    }

    const scheduled = new Set(atendimentoIds);

    return {
      supabase,
      volunteer,
      isFull,
      atendimentos,
      atendimentoIds,
      canSeeTreatment: (atendimentoId) =>
        isFull || (atendimentoId !== null && scheduled.has(atendimentoId)),
      // Giving alta / starting the treatment belongs to the team that
      // runs it — the admin can fix.
      canManageTreatment: (atendimentoId) =>
        admin || (atendimentoId !== null && scheduled.has(atendimentoId)),
    };
  },
);
