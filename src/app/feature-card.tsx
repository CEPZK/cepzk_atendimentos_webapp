import Link from "next/link";
import type { ReactNode } from "react";
import { ChevronRightIcon } from "@/app/icons";

interface FeatureCardProps {
  href: string;
  title: string;
  description: string;
  icon: ReactNode;
}

/**
 * Entry point for one feature on the home screen. Sized for thumbs: the
 * whole card is the tap target.
 */
export function FeatureCard({
  href,
  title,
  description,
  icon,
}: FeatureCardProps) {
  return (
    <Link
      href={href}
      className="group flex items-center gap-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition-colors hover:border-teal-300 hover:bg-teal-50/40 focus:outline-none focus:ring-2 focus:ring-teal-600 focus:ring-offset-2"
    >
      <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-teal-700 text-white">
        {icon}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-base font-semibold text-slate-900">
          {title}
        </span>
        <span className="mt-0.5 block text-sm leading-relaxed text-slate-500">
          {description}
        </span>
      </span>
      <ChevronRightIcon className="h-5 w-5 shrink-0 text-slate-300 transition-colors group-hover:text-teal-700" />
    </Link>
  );
}
