/**
 * Inline icons used by the dashboard cards and the administration
 * screens. Kept local to avoid an icon dependency.
 *
 * Two families live here:
 *
 * - the Heroicons outline set (24px viewBox), used for the generic UI
 *   affordances (chevrons, search, check, trash…);
 * - the project's own icons, mirroring the SVG files in `public/icons`
 *   (Phosphor 256px viewBox, plus Lucide's book-heart in 24px). Those
 *   files are the source of truth for the artwork; they are inlined here
 *   so the icons inherit `currentColor` and cost no extra request.
 */
type IconProps = { className?: string };

export function UsersIcon({ className = "h-6 w-6" }: IconProps) {
  return (
    <svg
      className={className}
      fill="none"
      viewBox="0 0 24 24"
      strokeWidth={1.6}
      stroke="currentColor"
      aria-hidden="true"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M15 19.128a9.38 9.38 0 0 0 2.625.372 9.337 9.337 0 0 0 4.121-.952 4.125 4.125 0 0 0-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 0 1 8.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0 1 11.964-3.07M12 6.375a3.375 3.375 0 1 1-6.75 0 3.375 3.375 0 0 1 6.75 0Zm8.25 2.25a2.625 2.625 0 1 1-5.25 0 2.625 2.625 0 0 1 5.25 0Z"
      />
    </svg>
  );
}

export function ChevronRightIcon({ className = "h-5 w-5" }: IconProps) {
  return (
    <svg
      className={className}
      fill="none"
      viewBox="0 0 24 24"
      strokeWidth={1.8}
      stroke="currentColor"
      aria-hidden="true"
    >
      <path strokeLinecap="round" strokeLinejoin="round" d="m8.25 4.5 7.5 7.5-7.5 7.5" />
    </svg>
  );
}

export function ChevronLeftIcon({ className = "h-5 w-5" }: IconProps) {
  return (
    <svg
      className={className}
      fill="none"
      viewBox="0 0 24 24"
      strokeWidth={1.8}
      stroke="currentColor"
      aria-hidden="true"
    >
      <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5 8.25 12l7.5-7.5" />
    </svg>
  );
}

export function ArrowLeftIcon({ className = "h-5 w-5" }: IconProps) {
  return (
    <svg
      className={className}
      fill="none"
      viewBox="0 0 24 24"
      strokeWidth={1.8}
      stroke="currentColor"
      aria-hidden="true"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M10.5 19.5 3 12m0 0 7.5-7.5M3 12h18"
      />
    </svg>
  );
}

export function SearchIcon({ className = "h-5 w-5" }: IconProps) {
  return (
    <svg
      className={className}
      fill="none"
      viewBox="0 0 24 24"
      strokeWidth={1.8}
      stroke="currentColor"
      aria-hidden="true"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z"
      />
    </svg>
  );
}


export function CheckIcon({ className = "h-5 w-5" }: IconProps) {
  return (
    <svg
      className={className}
      fill="none"
      viewBox="0 0 24 24"
      strokeWidth={1.8}
      stroke="currentColor"
      aria-hidden="true"
    >
      <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
    </svg>
  );
}

export function PlusIcon({ className = "h-5 w-5" }: IconProps) {
  return (
    <svg
      className={className}
      fill="none"
      viewBox="0 0 24 24"
      strokeWidth={1.8}
      stroke="currentColor"
      aria-hidden="true"
    >
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
    </svg>
  );
}

export function TrashIcon({ className = "h-5 w-5" }: IconProps) {
  return (
    <svg
      className={className}
      fill="none"
      viewBox="0 0 24 24"
      strokeWidth={1.8}
      stroke="currentColor"
      aria-hidden="true"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0"
      />
    </svg>
  );
}


export function ClipboardUserIcon({ className = "h-6 w-6" }: IconProps) {
  return (
    <svg
      className={className}
      fill="none"
      viewBox="0 0 24 24"
      strokeWidth={1.6}
      stroke="currentColor"
      aria-hidden="true"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M9 3.75a1.5 1.5 0 0 1 1.5-1.5h3a1.5 1.5 0 0 1 1.5 1.5v.75h1.5A1.5 1.5 0 0 1 18 6v13.5a1.5 1.5 0 0 1-1.5 1.5h-9A1.5 1.5 0 0 1 6 19.5V6a1.5 1.5 0 0 1 1.5-1.5H9v-.75Zm3 6a2.25 2.25 0 1 1 0 4.5 2.25 2.25 0 0 1 0-4.5Zm-3.375 8.25a3.75 3.75 0 0 1 6.75 0"
      />
    </svg>
  );
}

// -----------------------------------------------------------------------------
// Project icons — mirrors of `public/icons/*.svg`.
// -----------------------------------------------------------------------------

/** Shared props of the Phosphor-based icons (256px viewBox, 16px stroke). */
const phosphor = {
  viewBox: "0 0 256 256",
  fill: "none",
  stroke: "currentColor",
  strokeLinecap: "round",
  strokeLinejoin: "round",
  strokeWidth: 16,
  "aria-hidden": true,
} as const;

/** `public/icons/user-plus.svg` — Cadastrar Assistido. */
export function UserPlusIcon({ className = "h-6 w-6" }: IconProps) {
  return (
    <svg className={className} {...phosphor}>
      <line x1="200" y1="136" x2="248" y2="136" />
      <line x1="224" y1="112" x2="224" y2="160" />
      <circle cx="108" cy="100" r="60" />
      <path d="M24,200c20.55-24.45,49.56-40,84-40s63.45,15.55,84,40" />
    </svg>
  );
}

/** `public/icons/user-list.svg` — Assistidos em Desobsessão Infantil I/II. */
export function UserListIcon({ className = "h-6 w-6" }: IconProps) {
  return (
    <svg className={className} {...phosphor}>
      <circle cx="80" cy="104" r="40" />
      <line x1="160" y1="80" x2="248" y2="80" />
      <line x1="160" y1="128" x2="248" y2="128" />
      <line x1="184" y1="176" x2="248" y2="176" />
      <path d="M16,192c7.1-27.6,34.18-48,64-48s56.9,20.4,64,48" />
    </svg>
  );
}

/** `public/icons/list-heart.svg` — Lista de Espera do Acolher com Amor. */
export function ListHeartIcon({ className = "h-6 w-6" }: IconProps) {
  return (
    <svg className={className} {...phosphor}>
      <line x1="40" y1="64" x2="216" y2="64" />
      <line x1="40" y1="128" x2="104" y2="128" />
      <line x1="40" y1="192" x2="120" y2="192" />
      <path d="M192,144a24,24,0,0,1,48,0c0,32-48,56-48,56s-48-24-48-56a24,24,0,0,1,48,0Z" />
    </svg>
  );
}

/** `public/icons/calendar-heart.svg` — Calendário do Acolher com Amor. */
export function CalendarHeartIcon({ className = "h-6 w-6" }: IconProps) {
  return (
    <svg className={className} {...phosphor}>
      <rect x="40" y="40" width="176" height="176" rx="8" />
      <line x1="176" y1="24" x2="176" y2="56" />
      <line x1="80" y1="24" x2="80" y2="56" />
      <path d="M128,120a24,24,0,0,1,48,0c0,32-48,56-48,56s-48-24-48-56a24,24,0,0,1,48,0Z" />
    </svg>
  );
}

/** `public/icons/puzzle-piece.svg` — the distonia of a treatment. */
export function PuzzlePieceIcon({ className = "h-5 w-5" }: IconProps) {
  return (
    <svg className={className} {...phosphor}>
      <path d="M64,216a8,8,0,0,1-8-8V165.31a28,28,0,1,1,0-50.62V72a8,8,0,0,1,8-8h46.69a28,28,0,1,1,50.61,0H208a8,8,0,0,1,8,8v42.69a28,28,0,1,0,0,50.62V208a8,8,0,0,1-8,8Z" />
    </svg>
  );
}

/** `public/icons/book-heart.svg` — Relatório de Atendimentos (Lucide). */
export function BookHeartIcon({ className = "h-6 w-6" }: IconProps) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H19a1 1 0 0 1 1 1v18a1 1 0 0 1-1 1H6.5a1 1 0 0 1 0-5H20" />
      <path d="M8.62 9.8A2.25 2.25 0 1 1 12 6.836a2.25 2.25 0 1 1 3.38 2.966l-2.626 2.856a.998.998 0 0 1-1.507 0z" />
    </svg>
  );
}
