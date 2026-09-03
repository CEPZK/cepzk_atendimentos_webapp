import { ListPageSkeleton } from "@/app/skeletons";

export default function Loading() {
  return <ListPageSkeleton titleWidth="w-72" rows={6} hasSearch={false} />;
}
