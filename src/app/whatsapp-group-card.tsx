import { ExternalLinkIcon, WhatsAppIcon } from "@/app/icons";

interface WhatsAppGroupCardProps {
  /**
   * WhatsApp group invite link (https://chat.whatsapp.com/...). Opens in a
   * new tab: non-members can see the group preview and join from there.
   */
  href: string;
}

/**
 * Home screen entry point for the team's WhatsApp group. Kept consistent
 * with the feature cards, but highlighted with the WhatsApp green and
 * opening in a new tab.
 */
export function WhatsAppGroupCard({ href }: WhatsAppGroupCardProps) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="group flex items-center gap-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition-colors hover:border-sky-300 hover:bg-sky-50/40 focus:outline-none focus:ring-2 focus:ring-sky-600 focus:ring-offset-2"
    >
      <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-[#25d366] text-white">
        <WhatsAppIcon className="h-7 w-7" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-base font-semibold text-slate-900">
          Grupo de WhatsApp
        </span>
        <span className="mt-0.5 block text-sm leading-relaxed text-slate-500">
          Entrar no grupo da equipe. Quem ainda não participa pode entrar pelo
          convite, sem precisar ser adicionado por um administrador.
        </span>
      </span>
      <ExternalLinkIcon className="h-5 w-5 shrink-0 text-slate-300 transition-colors group-hover:text-green-600" />
    </a>
  );
}
