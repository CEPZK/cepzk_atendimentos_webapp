import { SkeletonBlock } from "@/app/skeletons";

/** Home: the full-width profile app bar, the pair lines and the cards. */
export default function Loading() {
  return (
    <>
      <div className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex w-full max-w-2xl items-center gap-3 px-6 py-3">
          <SkeletonBlock className="h-10 w-10 shrink-0 rounded-full" />
          <SkeletonBlock className="h-5 w-40 flex-1" />
          <SkeletonBlock className="h-10 w-10 shrink-0 rounded-full" />
        </div>
      </div>

      <main
        aria-busy="true"
        aria-label="Carregando"
        className="mx-auto w-full max-w-2xl flex-1 p-6"
      >
        <SkeletonBlock className="h-4 w-44" />

        <div className="mt-6 space-y-3">
          {Array.from({ length: 2 }, (_, index) => (
            <SkeletonBlock key={index} className="h-24 w-full rounded-2xl" />
          ))}
        </div>
      </main>
    </>
  );
}
