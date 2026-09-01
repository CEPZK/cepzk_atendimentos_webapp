/**
 * Loading placeholders.
 *
 * Every screen reads from Supabase on the server, so a navigation can
 * take a moment. These skeletons are rendered by the route's
 * `loading.tsx` the instant the link is clicked: the app answers right
 * away instead of looking frozen.
 */

export function SkeletonBlock({ className = "" }: { className?: string }) {
  return <div className={`animate-pulse rounded bg-slate-200 ${className}`} />;
}

function SkeletonRow() {
  return (
    <li className="flex items-center gap-3 p-4">
      <SkeletonBlock className="h-10 w-10 shrink-0 rounded-full" />
      <div className="min-w-0 flex-1 space-y-2">
        <SkeletonBlock className="h-3.5 w-2/5" />
        <SkeletonBlock className="h-3 w-3/5" />
      </div>
    </li>
  );
}

function SkeletonHeader({ titleWidth }: { titleWidth: string }) {
  return (
    <>
      <SkeletonBlock className="h-4 w-20" />
      <SkeletonBlock className={`mt-5 h-7 ${titleWidth}`} />
    </>
  );
}

/** Screen with a search field and a list of records. */
export function ListPageSkeleton({
  titleWidth = "w-56",
  rows = 6,
  hasSearch = true,
}: {
  titleWidth?: string;
  rows?: number;
  hasSearch?: boolean;
}) {
  return (
    <main
      aria-busy="true"
      aria-label="Carregando"
      className="mx-auto w-full max-w-2xl flex-1 p-6"
    >
      <SkeletonHeader titleWidth={titleWidth} />

      {hasSearch && <SkeletonBlock className="mt-5 h-11 w-full rounded-xl" />}
      <SkeletonBlock className="mt-3 h-11 w-full rounded-xl" />
      <SkeletonBlock className="mt-4 h-3 w-28" />

      <ul className="mt-2 divide-y divide-slate-100 overflow-hidden rounded-2xl border border-slate-200 bg-white">
        {Array.from({ length: rows }, (_, index) => (
          <SkeletonRow key={index} />
        ))}
      </ul>
    </main>
  );
}

/** Screen with cards of details (assistido, voluntário, cadastro). */
export function DetailPageSkeleton({
  titleWidth = "w-64",
  cards = 2,
}: {
  titleWidth?: string;
  cards?: number;
}) {
  return (
    <main
      aria-busy="true"
      aria-label="Carregando"
      className="mx-auto w-full max-w-2xl flex-1 p-6"
    >
      <SkeletonHeader titleWidth={titleWidth} />
      <SkeletonBlock className="mt-3 h-3.5 w-72 max-w-full" />

      {Array.from({ length: cards }, (_, index) => (
        <section
          key={index}
          className="mt-6 space-y-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"
        >
          <SkeletonBlock className="h-4 w-32" />
          <SkeletonBlock className="h-3.5 w-4/5" />
          <SkeletonBlock className="h-3.5 w-3/5" />
          <SkeletonBlock className="h-3.5 w-2/5" />
        </section>
      ))}
    </main>
  );
}
