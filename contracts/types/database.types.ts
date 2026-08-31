/**
 * ┌─────────────────────────────────────────────────────────────────────────┐
 * │ CONTRACT FILE — SHARED BY BOTH REPOS                                    │
 * │ cepzk_atendimentos_web (this file is the FE copy of the contract)       │
 * │ cepzk_atendimentos_backend (source of truth = generated from your DB)   │
 * └─────────────────────────────────────────────────────────────────────────┘
 *
 * Region 1 (IDENTITY) below is frozen and is what the frontend compiles
 * against today. Region 2 (DOMAIN) is intentionally empty until the schema
 * is agreed; `npm run types:generate` overwrites THIS file from the live
 * project and the FE re-verifies against it.
 *
 * Regenerate with:
 *   SUPABASE_PROJECT_REF=<ref> npm run types:generate
 * which runs:
 *   supabase gen types typescript --project-id <ref> --schema public
 */

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

/* ───────────────────────── Region 1: IDENTITY (frozen) ─────────────────── */

/**
 * Roles live in `auth.users.app_metadata`, not in a join table, so RLS
 * policies can read them straight from the JWT with zero extra queries.
 * Adding a role = code change in both repos by design (see contracts/auth.md).
 */
export type AppRole = "admin" | "staff" | "client";

export type ProfileStatus = "active" | "invited" | "disabled";

export type Profile = {
  /** Same uuid as auth.users.id (1:1, no surrogate key). */
  id: string;
  email: string;
  display_name: string | null;
  avatar_url: string | null;
  phone: string | null;
  status: ProfileStatus;
  created_at: string;
  updated_at: string;
};

/* ───────────────────────── Region 2: DOMAIN (proposed) ──────────────────── */
/*
 * Mirrors sql/0002_domain.sql, which reconciles the owner's schema — see
 * schema-review.md. Region 2 is therefore PROVISIONAL in three places
 * (aca_encontro split, assistido.tratamento_atual removal, aca_sessao.presenca
 * feedback); `npm run types:generate` after `supabase db push` is the version
 * that actually ships. Column names stay Portuguese: they are the domain's
 * vocabulary, and translating them would put two names on every field.
 */

export type TratamentoStatus = "em_andamento" | "encerrado";
export type TratamentoMotivoEncerramento =
  "alta" | "desistencia" | "transferencia" | "obito" | "outro";
export type SessaoPresenca =
  "prevista" | "presente" | "falta" | "falta_justificada" | "cancelada";

export type Departamento = {
  id: number;
  nome: string;
  ativo: boolean;
  criado_em: string;
  updated_at: string;
};

export type Setor = {
  id: number;
  nome: string;
  departamento_id: number;
  /** Gates whether the agenda de sessões UI appears for this setor. */
  tem_agenda: boolean;
  ativo: boolean;
  criado_em: string;
  updated_at: string;
};

/** `descricao` is a label for humans; day+hora are what queries and conflicts use. */
export type Horario = {
  id: number;
  /** 0 = domingo … 6 = sábado, matching JS `getDay()`. */
  dia_semana: number;
  /** `HH:MM:SS`, wall-clock in America/Sao_Paulo. */
  hora: string;
  descricao: string;
  ativo: boolean;
  criado_em: string;
  updated_at: string;
};

export type Voluntario = {
  id: number;
  /** The identity the JWT resolves to; never sent by the client. */
  auth_user_id: string;
  nome: string;
  email: string;
  ativo: boolean;
  status: ProfileStatus;
  criado_em: string;
  updated_at: string;
};

export type VoluntarioSetor = {
  voluntario_id: number;
  setor_id: number;
  horario_id: number;
  desde: string;
  ate: string | null;
};

export type Assistido = {
  id: number;
  /** AST-000123 — the human handle; stable across name corrections. */
  codigo: string;
  nome: string;
  nome_social: string | null;
  nascimento: string | null;
  observacao: string | null;
  entrevistador_id: number;
  cadastrado_em: string;
  updated_at: string;
  /** Soft erasure (LGPD art. 18); `null` means visible. */
  removido_em: string | null;
  removido_por: number | null;
};

export type Tratamento = {
  id: number;
  assistido_id: number;
  setor_id: number;
  horario_id: number | null;
  status: TratamentoStatus;
  motivo_encerramento: TratamentoMotivoEncerramento | null;
  encerrado_em: string | null;
  encerrado_por: number | null;
  ordem: number;
  obs: string | null;
  criado_por: number;
  criado_em: string;
  updated_at: string;
};

export type TratamentoEvento = {
  id: string;
  tratamento_id: number;
  tipo:
    | "criado"
    | "encerrado"
    | "reaberto"
    | "horario_trocado"
    | "obs_editada"
    | "encontro_marcado";
  autor_id: number | null;
  autor_auth_uid: string;
  dados: Json;
  criado_em: string;
};

export type AcaCatalogo = { id: number; nome: string; ativo: boolean };

export type AcaTratamento = {
  /** Same id as the parent cepzk_tratamento row (1:1 subclass). */
  tratamento_id: number;
  /** Nullable: the person arrives before anyone knows what is being treated. */
  distonia_id: number | null;
  distonia_em: string;
  obs: string | null;
};

export type AcaEncontro = {
  id: number;
  setor_id: number;
  horario_id: number | null;
  data: string;
  ponte_id: number | null;
  dirigente_id: number;
  relatorio: string | null;
  relatorio_em: string | null;
  relatorio_por: number | null;
  cancelado_em: string | null;
  criado_em: string;
  updated_at: string;
};

export type AcaSessao = {
  id: number;
  encontro_id: number;
  tratamento_id: number;
  presenca: SessaoPresenca;
  obs: string | null;
  criado_em: string;
  updated_at: string;
};

export type AcaSessaoProcedimento = {
  sessao_id: number;
  procedimento_id: number;
  aplicado_em: string;
  aplicado_por: number | null;
};

export type AssistidoSituacao = {
  assistido_id: number;
  codigo: string;
  nome: string;
  tratamentos_ativos: number;
  altas: number;
  setores_ativos: string[];
  cadastrado_em: string;
};

export type FilaAtendimento = {
  tratamento_id: number;
  assistido_id: number;
  codigo: string;
  assistido_nome: string;
  setor_id: number;
  setor_nome: string;
  departamento_nome: string;
  horario_id: number | null;
  dia_semana: number | null;
  hora: string | null;
  ordem: number;
  criado_em: string;
  /** Postgres `interval`, serialised as HH:MM:SS (may exceed 24h). */
  tempo_na_fila: string;
};

/* ─────────────────────────────── Database type ─────────────────────────── */

export type Database = {
  public: {
    Tables: {
      cepzk_departamento: {
        Row: Departamento;
        Insert: Partial<Departamento>;
        Update: Partial<Departamento>;
        Relationships: [];
      };
      cepzk_setor: {
        Row: Setor;
        Insert: Partial<Setor>;
        Update: Partial<Setor>;
        Relationships: [];
      };
      cepzk_horario: {
        Row: Horario;
        Insert: Partial<Horario>;
        Update: Partial<Horario>;
        Relationships: [];
      };
      cepzk_voluntario: {
        Row: Voluntario;
        Insert: Partial<Voluntario>;
        Update: Partial<Voluntario>;
        Relationships: [];
      };
      cepzk_voluntario_setor: {
        Row: VoluntarioSetor;
        Insert: Partial<VoluntarioSetor>;
        Update: Partial<VoluntarioSetor>;
        Relationships: [];
      };
      cepzk_assistido: {
        Row: Assistido;
        Insert: Partial<Assistido>;
        Update: Partial<Assistido>;
        Relationships: [];
      };
      cepzk_tratamento: {
        Row: Tratamento;
        Insert: Partial<Tratamento>;
        Update: Partial<Tratamento>;
        Relationships: [];
      };
      cepzk_tratamento_evento: {
        Row: TratamentoEvento;
        Insert: Partial<TratamentoEvento>;
        Update: Partial<TratamentoEvento>;
        Relationships: [];
      };
      aca_distonia: {
        Row: AcaCatalogo;
        Insert: Partial<AcaCatalogo>;
        Update: Partial<AcaCatalogo>;
        Relationships: [];
      };
      aca_queixa: {
        Row: AcaCatalogo;
        Insert: Partial<AcaCatalogo>;
        Update: Partial<AcaCatalogo>;
        Relationships: [];
      };
      aca_procedimento: {
        Row: AcaCatalogo;
        Insert: Partial<AcaCatalogo>;
        Update: Partial<AcaCatalogo>;
        Relationships: [];
      };
      aca_tratamento: {
        Row: AcaTratamento;
        Insert: Partial<AcaTratamento>;
        Update: Partial<AcaTratamento>;
        Relationships: [];
      };
      aca_tratamento_queixa: {
        Row: { tratamento_id: number; queixa_id: number };
        Insert: { tratamento_id: number; queixa_id: number };
        Update: Partial<{ tratamento_id: number; queixa_id: number }>;
        Relationships: [];
      };
      aca_sessao_procedimento: {
        Row: AcaSessaoProcedimento;
        Insert: Partial<AcaSessaoProcedimento>;
        Update: Partial<AcaSessaoProcedimento>;
        Relationships: [];
      };
      aca_encontro: {
        Row: AcaEncontro;
        Insert: Partial<AcaEncontro>;
        Update: Partial<AcaEncontro>;
        Relationships: [];
      };
      aca_sessao: {
        Row: AcaSessao;
        Insert: Partial<AcaSessao>;
        Update: Partial<AcaSessao>;
        Relationships: [];
      };
      /** `profiles` is superseded by cepzk_voluntario — see schema-review.md P0-2. */
      profiles: {
        Row: Profile;
        Insert: Partial<Profile> & Pick<Profile, "id" | "email">;
        Update: Partial<Profile>;
        Relationships: [];
      };
    };
    Views: {
      cepzk_assistido_situacao: {
        Row: AssistidoSituacao;
        Insert: never;
        Update: never;
        Relationships: [];
      };
      cepzk_fila_atendimento: {
        Row: FilaAtendimento;
        Insert: never;
        Update: never;
        Relationships: [];
      };
    };
    Functions: {
      current_app_role: {
        Args: Record<PropertyKey, never>;
        Returns: AppRole | null;
      };
      is_staff: {
        Args: Record<PropertyKey, never>;
        Returns: boolean;
      };
      is_admin: {
        Args: Record<PropertyKey, never>;
        Returns: boolean;
      };
      /** JWT role AND an active cepzk_voluntario row — the gate on every policy. */
      is_voluntario_ativo: {
        Args: Record<PropertyKey, never>;
        Returns: boolean;
      };
      /**
       * is_active_member() is intentionally ABSENT: it is a security-definer
       * helper used inside policies, has no `execute` grant for `authenticated`,
       * and leaking it into the RPC surface invites a probe for "which accounts
       * are active". Omitting it makes `.rpc('is_active_member')` a compile
       * error, which is the correct amount of "you can't do that".
       */
    };
    Enums: {
      app_role: AppRole;
      profile_status: ProfileStatus;
      tratamento_status: TratamentoStatus;
      tratamento_motivo_encerramento: TratamentoMotivoEncerramento;
      sessao_presenca: SessaoPresenca;
    };
    CompositeTypes: Record<PropertyKey, never>;
  };
};

/* ─────────────────────────── Convenience helpers ───────────────────────── */

export type Tables<T extends keyof Database["public"]["Tables"]> =
  Database["public"]["Tables"][T]["Row"];

export type TablesInsert<T extends keyof Database["public"]["Tables"]> =
  Database["public"]["Tables"][T]["Insert"];

export type Enums<T extends keyof Database["public"]["Enums"]> =
  Database["public"]["Enums"][T];

export type Views<T extends keyof Database["public"]["Views"]> =
  Database["public"]["Views"][T]["Row"];

/**
 * Shape of the verified JWT as returned by `supabase.auth.getClaims()`.
 * The frontend trusts ONLY these fields for routing decisions, and RLS
 * remains the actual security boundary for data access.
 */
export type SessionClaims = {
  sub: string;
  email: string;
  role: "authenticated" | "anon";
  app_metadata?: { role?: AppRole };
  user_metadata?: { display_name?: string };
  /** Seconds since epoch. */
  exp: number;
  iat: number;
  iss: string;
  aud: string;
};
