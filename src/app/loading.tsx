import { SkeletonBlock } from "@/app/skeletons";

/** Home: the profile app bar, the role line and the feature cards. */
export default function Loading() {
  return (
    <main
      aria-busy="true"
      aria-label="Carregando"
      className="mx-auto w-full max-w-2xl flex-1 p-6"
    >
      <div className="-mx-6 -mt-6 border-b border-slate-200 bg-white px-6 py-3">
        <div className="flex items-center gap-3">
          <SkeletonBlock className="h-10 w-10 shrink-0 rounded-full" />
          <SkeletonBlock className="h-5 w-40" />
        </div>
      </div>

      <SkeletonBlock className="h-4 w-44" />

      <div className="mt-6 space-y-3">
        {Array.from({ length: 2 }, (_, index) => (
          <SkeletonBlock key={index} className="h-24 w-full rounded-2xl" />
        ))}
      </div>
    </main>
  );
}
