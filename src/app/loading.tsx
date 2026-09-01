import { SkeletonBlock } from "@/app/skeletons";

/** Home: the greeting and the feature cards. */
export default function Loading() {
  return (
    <main
      aria-busy="true"
      aria-label="Carregando"
      className="mx-auto w-full max-w-2xl flex-1 p-6"
    >
      <SkeletonBlock className="h-3.5 w-40" />
      <SkeletonBlock className="mt-3 h-8 w-52" />
      <SkeletonBlock className="mt-3 h-5 w-64" />

      <div className="mt-8 space-y-3">
        {Array.from({ length: 2 }, (_, index) => (
          <SkeletonBlock key={index} className="h-24 w-full rounded-2xl" />
        ))}
      </div>
    </main>
  );
}
