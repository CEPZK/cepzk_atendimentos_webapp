import { ListPageSkeleton } from "@/app/skeletons";

export default function Loading() {
  return <ListPageSkeleton titleWidth="w-80" rows={6} hasSearch />;
}
