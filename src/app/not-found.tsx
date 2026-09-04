import Link from "next/link";

export default function NotFound() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-4 p-6 text-center">
      <p className="text-5xl font-semibold text-sky-700">404</p>
      <h1 className="text-2xl font-semibold tracking-tight text-slate-900">
        Página não encontrada
      </h1>
      <p className="max-w-md text-sm leading-relaxed text-slate-600">
        A página que você procura não existe ou foi movida.
      </p>
      <Link
        href="/"
        className="rounded-lg bg-sky-600 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-sky-700"
      >
        Voltar ao início
      </Link>
    </main>
  );
}
