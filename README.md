# CEPZK — Atendimentos (Webapp)

Frontend do sistema de controle dos atendimentos de tratamentos da Casa
Espírita CEPZK. Um **PWA** construído com [Next.js](https://nextjs.org)
(App Router) e hospedado na [Vercel](https://vercel.com).

> Convenção do projeto: aplicação em Português (BR); **código em inglês**,
> com exceção da documentação.

## Stack

- **Next.js 16** (App Router, TypeScript, Tailwind CSS v4);
- **Supabase** (backend + banco + autenticação) — repositório:
  [CEPZK/cepzk_atendimentos_backend](https://github.com/CEPZK/cepzk_atendimentos_backend);
- **@supabase/ssr** — sessão por cookies (leitura no servidor e no browser);
- **Serwist** — service worker / PWA (offline-first, apenas em produção);
- **Vercel** — deploy (integrados com o projeto do Supabase).

## Começando

### 1. Instale as dependências

```bash
npm install
```

### 2. Configure o ambiente

```bash
cp .env.example .env.local
# preencha com a URL e a anon key do projeto Supabase
# (Dashboard do Supabase → Project Settings → API)
```

> A `service_role key` **nunca** deve ser usada no frontend.

### 3. Rode em desenvolvimento

```bash
npm run dev
```

Acesse `http://localhost:3000`.

### 4. Build de produção

```bash
npm run build
npm start
```

O service worker é gerado apenas no build de produção
(`public/sw.js`, ignorado pelo git).

### 5. Rode os testes

```bash
npm test              # executa uma vez
npm run test:watch    # reexecuta ao salvar
```

Cobrem a comparação de nomes por similaridade (`src/lib/assistido.ts`),
usada no cadastro de assistidos. A pesquisa que definiu as regras, os
limiares e as alternativas avaliadas está em
[`docs/similaridade-de-nomes.md`](docs/similaridade-de-nomes.md).

## Deploy na Vercel

O projeto já está pronto para deploy (o build usa webpack
explicitamente via `next build --webpack` — necessário enquanto o
Suporte a Turbopack do Serwist for experimental).

1. **Importe o repositório** em [vercel.com/new](https://vercel.com/new)
   (framework detectado automaticamente: Next.js);
2. **Configure as variáveis de ambiente** em
   *Project Settings → Environment Variables* (nos ambientes Production
   e Preview):
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
3. **No Supabase** (*Authentication → URL Configuration*), adicione à
   allowlist de redirects:
   - `https://SEU-APP.vercel.app/auth/callback` (produção);
   - `https://SEU-APP-PREVIEW.vercel.app/auth/callback` (previews, se
     quiser testar o magic link neles — o endereço de cada preview é
     gerado a cada deploy);
4. **Deploy.** O `public/sw.js` é gerado no build e servido com
   `Cache-Control: no-cache` (via `vercel.json`), garantindo que o
   navegador sempre verifique atualizações do service worker.

> O primeiro admin não pode ser convidado pelo sistema — crie-o
> manualmente no Supabase (*Authentication → Users → Add user*, marcando
> *Auto confirm user*), como documentado no backend.

> ⚠️ As variáveis `NEXT_PUBLIC_*` são **embutidas no build** pelo Next.
> Para o app não depender disso (um *redeploy* reaproveitando o build cache
> gera um bundle sem elas), o servidor publica a URL e a anon key no HTML a
> cada request (`src/app/supabase-env.tsx`) e o cliente prefere esses
> valores. Ou seja: basta a variável existir no ambiente da Vercel.
>
> Detalhe histórico: antes disso, Se você
> adicioná-las depois de um deploy, é preciso **redeployar** (*Deployments
> → ⋯ → Redeploy*) para que passem a valer. Enquanto estiverem ausentes, o
> app não quebra: todas as rotas levam ao `/login`, que exibe um aviso de
> configuração pendente (antes disso, o proxy lançava exceção e a
> aplicação inteira respondia `Internal Server Error`).

## Autenticação

O acesso é **sem senha** e **somente por convite (invite-only)**:

1. O admin convida o voluntário pelo e-mail (Supabase Dashboard);
2. O voluntário informa o e-mail na tela de **Entrar** e um
   **magic link** é enviado (`signInWithOtp` com `shouldCreateUser: false`);
3. Ao clicar no link, o usuário cai em `/auth/callback`, que conclui o
   login (fluxo PKCE do magic link **e** fluxo de convite, cujo token
   chega no hash da URL) e o redireciona para a página de destino;
4. **Primeiro acesso:** como o perfil ainda está incompleto (faltam
   sobrenome e telefone), o usuário é redirecionado para
   `/complete-profile` — nome, sobrenome e telefone são obrigatórios;
5. Em seguida, ele cai na página inicial, que por enquanto exibe apenas
   **"Bem-vindo, {nome}!"**.

### Fluxo no código

| Rota                | Descrição                                                                 |
| ------------------- | ------------------------------------------------------------------------- |
| `/login`            | Formulário de e-mail → envia o magic link                                  |
| `/auth/callback`    | Conclui o login (código PKCE ou token de convite no hash)                 |
| `/complete-profile` | Primeiro acesso: preenchimento de nome, sobrenome e telefone              |
| `/`                 | Página inicial (Bem-vindo) — exige perfil completo                         |
| `src/proxy.ts`      | Protege as rotas e renova a sessão a cada request (convenção `proxy` do Next 16) |

O perfil do voluntário fica em `cepzk_voluntario` (espelho 1:1 do
`auth.users`). O **nome** é sincronizado com o Supabase Auth
(`auth.updateUser({ data: { nome } })` + triggers no banco); **sobrenome**
e **telefone** são gravados direto na tabela.

## PWA

- `public/manifest.webmanifest` — manifesto da aplicação;
- `public/icons/` + `src/app/favicon.ico` — ícones gerados a partir de
  `public/icon.svg` (regere com `npm run icons`);
- `src/app/sw.ts` — entrada do service worker (Serwist);
- `src/app/register-sw.tsx` — registro do service worker (apenas produção).

## Scripts

| Comando          | Descrição                                          |
| ---------------- | -------------------------------------------------- |
| `npm run dev`    | Servidor de desenvolvimento                        |
| `npm run build`  | Build de produção (gera o service worker)          |
| `npm start`      | Serve o build de produção                          |
| `npm run lint`   | ESLint                                             |
| `npm test`       | Testes (Vitest), executados uma vez                |
| `npm run test:watch` | Testes em modo *watch*                         |
| `npm run icons`  | Regenera ícones PWA e favicon a partir do SVG      |

## Variáveis de ambiente

| Variável                  | Obrigatória | Uso                                    |
| ------------------------- | ----------- | -------------------------------------- |
| `NEXT_PUBLIC_SUPABASE_URL`| Sim         | URL do projeto Supabase                |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Sim   | Chave pública (anon) do projeto        |

Veja `.env.example`.

## Licença

MIT — veja [LICENSE](LICENSE).
