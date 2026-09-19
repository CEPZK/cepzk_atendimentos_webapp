# Avaliação de conformidade LGPD — CEPZK Atendimentos

**Escopo:** webapp (`CEPZK/cepzk_atendimentos_webapp`, commit `c326367`) + backend/banco
(`CEPZK/cepzk_atendimentos_backend`, migrations até `20260903000009`).

**Data da análise:** 19/09/2026.

> "GLPD" interpretado como **LGPD** (Lei nº 13.709/2018).

---

## 1. Veredito

**Não está em conformidade — mas tem uma base técnica melhor do que a maioria dos projetos
de pequeno porte.**

Os pilares centrais da LGPD que faltam são os **jurídicos/organizacionais**:

1. **Nenhum mecanismo de consentimento, aviso ou registro de base legal** para os assistidos
   (busca exaustiva nos dois repositórios: nenhuma ocorrência de "consentimento", "LGPD",
   "privacidade" ou "termos" em código, docs ou banco).
2. **Direitos do titular (art. 18) inexistem**: nenhum canal para acesso, correção,
   exclusão ou portabilidade.
3. **Sem política de retenção/exclusão/anonimização** (art. 16) — o "arquivamento"
   (soft delete) não é exclusão, e o dado vive para sempre.
4. **Dados de crianças** (Desobsessão Infantil I e II) tratados **sem consentimento do
   responsável** (art. 14).
5. **Sem governança**: sem encarregado (DPO), sem política interna, sem processo de
   incidentes (art. 48), sem contrato/DPA formalizado com o Supabase (art. 38).

E há **falhas técnicas concretas** que ferem o princípio da segurança (art. 6, VI) e as
medidas exigidas pelo art. 46 — as mais graves:

- **RLS v1: qualquer voluntário logado tem SELECT/INSERT/UPDATE/DELETE em todas as 16
  tabelas** (a "permissão real" existe só no frontend — o próprio código do webapp
  documenta isso).
- **O cookie de sessão é legível por JavaScript (`httpOnly: false`) e sem flag `Secure`**
  (padrão do `@supabase/ssr` 0.12.5 — verificado no pacote).
- **O PWA faz cache offline de páginas de dados** (HTML/RSC com nomes, distonias e
  relatórios) por 24 h no dispositivo (verificado no `defaultCache` do Serwist 9.5.12).
- **Página pública `/diagnostico`** (sem login) expõe o projeto, o prefixo da anon key e a
  configuração de auth do Supabase.

Se o projeto for usado **como está para dados sensíveis reais**, a casa (como controladora)
ficaria exposta a sanções da ANPD (arts. 52-54) e a danos reputacionais graves — os dados
envolvem pessoas vulneráveis, incluindo crianças.

### Boas práticas que já existem (vale registrar)

| Item | Situação |
| --- | --- |
| Acesso somente por convite, sem senha (`enable_signup = false`, `shouldCreateUser: false`) | ✅ |
| RLS habilitado em **todas** as tabelas; `anon` sem nenhum acesso | ✅ |
| `service_role` nunca no frontend; nenhuma chave real commitada (verificado no histórico git dos dois repositórios) | ✅ |
| Minimização de dados na coleta: assistido tem só nome + data (sem CPF, data de nascimento, endereço) | ✅ |
| Soft delete (`data_arquivamento`) preservando histórico | ✅ |
| Validação de acesso repetida em **toda** Server Action (não só na tela) | ✅ |
| Sessão validada no servidor (`auth.getUser()`), refresh a cada request, falha → redirect seguro (fail-safe, não fail-open) | ✅ |
| Frontend na região `gru1` (São Paulo, Vercel) | ✅ |
| Migrations versionadas; trigger que protege a coluna `papel`; funções `SECURITY DEFINER` com `search_path` explícito | ✅ |
| E-mails de convite/OTP customizados sem dados de terceiros | ✅ |

---

## 2. Inventário de dados pessoais processados

| Dado | Onde | Categoria LGPD |
| --- | --- | --- |
| Nome, e-mail, **telefone**, papel dos voluntários | `cepzk_voluntario`, `auth.users` | Pessoal |
| **Nome completo dos assistidos** | `cepzk_assistido.nome_completo` | Pessoal (identificador) |
| **Distonia: TEA, Esquizofrenia…** | `aca_distonia` + `aca_tratamento` | **Sensível — saúde (art. 5, II)** |
| **Queixas: convulsão, comportamentos violentos…** | `aca_queixa` + `aca_tratamento_queixa` | **Sensível — saúde** |
| **Relatórios com observações livres** | `aca_relatorio.obs`, `cepzk_tratamento.obs` | **Sensível — saúde (texto livre não estruturado)** |
| Sessões/procedimentos, estados de tratamento | `aca_sessao`, `aca_sessao_procedimento`, `cepzk_tratamento` | Pessoal (deriva saúde) |
| **Crianças** (Desobsessão Infantil I/II) | assistidos nesses setores | **Pessoal de menor + sensível (art. 14)** |

**Observação-chave:** os assistidos **não são usuários** da plataforma — todo o dado
sobre eles é digitado por voluntários. A casa é controladora; os voluntários, operadores
(art. 38) — precisam de instruções formais (política interna) e treinamento.

---

## 3. Pontos de falha e como resolver

Severidade: 🔴 crítica · 🟠 alta · 🟡 média · 🟢 baixa.

### 🔴 F1 — Sem base legal, consentimento ou aviso para os assistidos

**O que falta:** nada coleta nem registra consentimento; nada informa o assistido sobre o
tratamento de seus dados (art. 9). Dados de saúde exigem base específica com
restrições (art. 11, I e §1-2) — para organização privada, na prática, **consentimento
explícito** (art. 8: livre, informado, claro e proeminente, revogável).

**Como resolver:**
1. Redigir um **aviso de privacidade** curto (o que é coletado, para quê, por quanto tempo,
   quem acessa, direitos do titular, contato do encarregado) — mostrar/entregar no
   Atendimento Fraterno, no momento do cadastro.
2. **Termo de consentimento** (papel assinado no início é aceitável e barato para o porte da
   casa; digital é o ideal) — com **versão** do texto.
3. Registrar no banco (novo migration):

```sql
create table public.cepzk_consentimento (
    id          serial primary key,
    assistido_id int not null references public.cepzk_assistido(id) on delete cascade,
    tipo        text not null,   -- 'tratamento', 'dados_sensiveis', 'menor_responsavel'
    versao      text not null,   -- versão do texto aceito
    data_hora   timestamptz not null default now(),
    informado_por uuid references public.cepzk_voluntario(id),
    responsavel_nome text        -- para menores: nome de quem consentiu
);
```

4. Bloquear o cadastro do assistido no app enquanto o consentimento não for registrado
   (checkbox obrigatório no fluxo de cadastro).

### 🔴 F2 — Dados de crianças sem consentimento do responsável (art. 14)

**O que falta:** os setores Desobsessão Infantil I/II tratam nome + distonia + queixas +
relatórios de **crianças/adolescentes**. A LGPD exige consentimento de ao menos um dos
pais/responsável, com exigências adicionais (mais rigorosas) quando os dados são sensíveis.

**Como resolver:**
- No cadastro de assistido desses setores: campos obrigatórios **nome do responsável** +
  consentimento explícito (usar `tipo = 'menor_responsavel'` no `cepzk_consentimento` acima).
- Treinar a equipe: para crianças, o registro de observações livres deve ser ainda mais
   contido (minimização — ver F11).

### 🔴 F3 — RLS v1: acesso total a qualquer usuário logado (princípio da segurança, arts. 6 VI e 46)

**O que existe (mig. 003):** política única `autenticados_acesso_completo`
(`using (true) with check (true)`) em **todas** as tabelas. Ou seja, qualquer voluntário —
ou quem roubar um JWT de voluntário — consegue pela API pública do Supabase (a anon key já
está no bundle do app, o que é esperado e inofensivo por si só) **ler, alterar e apagar tudo**:
todos os assistidos, distonias, relatórios, telefones e e-mails dos voluntários, até
catálogos. As telas escondem, mas a API não. O próprio comentário em
`src/lib/assistido-access.ts` admite: *"The database still grants full access to every
authenticated user (RLS v1), so this is the real gate"*.

**Como resolver** (implementar os "refinamentos planejados" que já estão documentados no
README do backend):

```sql
-- Padrão: substituir autenticados_acesso_completo por políticas por função.
-- Exemplo — assistidos: quem vê é admin ou equipe do atendimento do assistido.

create policy assistido_select on public.cepzk_assistido
for select to authenticated
using (
    exists (select 1 from public.cepzk_voluntario v
            where v.id = auth.uid() and v.papel = 'admin')
    or exists (
        select 1
        from public.cepzk_tratamento t
        join public.cepzk_escala e on e.atendimento_id = t.atendimento_id
        where t.assistido_id = cepzk_assistido.id
          and e.voluntario_id = auth.uid()
    )
);

-- Escrita: só equipe do Atendimento Fraterno + admin.
create policy assistido_write_af on public.cepzk_assistido
for insert to authenticated with check (
    exists (select 1 from public.cepzk_voluntario v
            where v.id = auth.uid() and v.papel = 'admin')
    or exists (
        select 1
        from public.cepzk_escala e
        join public.cepzk_atendimento a on a.id = e.atendimento_id
        join public.cepzk_setor s       on s.id = a.setor_id
        where e.voluntario_id = auth.uid() and s.nome = 'Atendimento Fraterno'
    )
);
-- (update/delete análogos; delete idealmente só admin — ver F8)
```

Regras-alvo por tabela:

| Tabela | SELECT | INSERT/UPDATE | DELETE |
| --- | --- | --- | --- |
| catálogos (`departamento`, `setor`, `horario`, `atendimento`, `aca_distonia`, `aca_queixa`, `aca_procedimento`) | todos autenticados | **ninguém** (apenas via service_role/admin local) | ninguém |
| `cepzk_voluntario` | todos autenticados | só a própria linha (`auth.uid() = id`); `papel` só admin (já protegido por trigger — reforçar na RLS) | só admin |
| `cepzk_escala` | admin | admin | admin |
| `cepzk_assistido` | admin + equipe do atendimento do assistido | AF + admin | **só admin** (ou nenhum — só arquivar) |
| `cepzk_tratamento` e `aca_*` | admin + equipe do atendimento do tratamento | idem (relatório só da equipe que atende a sessão) | **só admin** |

Extras:
- Adicionar um **check em CI** (ou migration de rotina): falhar se alguma tabela da schema
  `public` estiver sem RLS habilitado — evita regredir ao adicionar novas tabelas.
- Depois disso, as validações do frontend deixam de ser "a" fronteira de segurança — o que
  elas hoje, de fato, precisam parar de ser.

### 🔴 F4 — Cookie de sessão legível por JavaScript e sem `Secure`

**O que existe:** o webapp não personaliza as opções de cookie do `@supabase/ssr`. No
pacote `0.12.5` instalado, o default é:

```js
DEFAULT_COOKIE_OPTIONS = {
  path: "/", sameSite: "lax",
  httpOnly: false,          // ← o JWT de sessão (access + refresh) é lido por JS
  maxAge: 400 * 24 * 60 * 60
}                           // ← sem flag `secure`
```

Consequência: qualquer XSS (hoje o app não tem Content-Security-Policy — ver F16) lê
`document.cookie` e rouba a sessão inteira → acesso a **todos** os dados sensíveis.

**Como resolver:**
```ts
// src/lib/supabase/client.ts e server.ts — passar cookieOptions em produção:
createBrowserClient(url, anonKey, {
  cookieOptions: { httpOnly: true, secure: true, sameSite: "lax" },
});
```
- Ressalva prática: o cliente **browser** do Supabase precisa ler o cookie para manter a
  sessão em memória. Com `httpOnly: true`, a única tela que usa o browser-client
  autenticado (`/complete-profile`: `updateUser` + `getUser`) passa a falhar — **mover
  essas duas chamadas para Server Actions** (o padrão do projeto já existe, ex.
  `src/app/voluntarios/actions.ts`). Os fluxos de login/OTP rodam pré-autenticação e não
  sofrem impacto.
- Como compensação, adicionar CSP (F16) — cookie httpOnly + CSP é a combinação que de fato
  blinda contra roubo de sessão via XSS.

### 🔴 F5 — PWA faz cache offline de conteúdo sensível

**O que existe:** `src/app/sw.ts` usa `defaultCache` do `@serwist/next` 9.5.12. Verificado
no pacote: em produção ele faz `NetworkFirst`/`CacheFirst` (24 h, até 32 entradas) de:
- **payloads RSC** (prefetch e navegação) de **todas** as rotas same-origin exceto `/api/` —
  RSC contém os dados renderizados no servidor, ou seja, nome, distonia, queixas e
  relatórios dos assistidos;
- **páginas HTML** same-origin — o SSR dessas rotas também carrega os mesmos dados;
- demais GETs same-origin ("others").

Consequência: qualquer pessoa com acesso físico ao dispositivo (computador compartilhado da
casa, celular perdido) abre o cache offline do navegador e lê dados de assistidos — e o
service worker pode servir páginas em cache **sem revalidar a sessão**. O SW é registrado
indistintamente em produção (`register-sw.tsx`), inclusive antes do login.

**Como resolver:**
1. Trocar `defaultCache` por uma estratégia **mínima que só cacheia assets estáticos**
   (fontes, ícones, imagens, `/_next/static`) — mantendo o precache de build — e
   **explicitamente sem** HTML/RSC de rotas de dados:

```ts
// src/app/sw.ts — em produção
const serwist = new Serwist({
  precacheEntries: self.__SW_MANIFEST,
  skipWaiting: true,
  clientsClaim: true,
  navigationPreload: true,
  runtimeCaching: [
    // só entradas estáticas do defaultCache (fontes/imagens/_next/static) —
    // remover: RSC prefetch, RSC, HTML, "others", cross-origin
  ],
});
```

2. (Complementar) registrar o SW só quando autenticado e **limpar o cache no logout**
   (`caches.keys().then(ks => Promise.all(ks.map(k => caches.delete(k))))`).
3. Testar o PWA offline depois da mudança (o app deve continuar "instalável", mas dados de
   assistidos nunca devem ficar no dispositivo).

### 🔴 F6 — Sem MFA: o único fator de autenticação é o e-mail (OTP de 6 dígitos)

**O que existe:** login por e-mail convidado → código OTP de 6 dígitos (e magic link). Sem
MFA, sem senha, sem segunda via. Comprometimento da conta de e-mail do voluntário =
acesso total à plataforma (com o RLS v1, acesso total aos dados).

**Como resolver:**
- Ativar **MFA TOTP** no Supabase (Authentication → MFA) — no mínimo para `admin` e
  `coordenador`; idealmente para todos.
- Reduzir validade do OTP e o número de tentativas (Authentication → Rate Limits / OTP
  Settings) e testar o bloqueio.
- **Rate-limit por IP** no endpoint de login (Vercel + Upstash Ratelimit, por exemplo) —
  hoje o formulário aceita spam de OTPs para e-mail conhecido.
- Comunicar aos voluntários: a casa **nunca** pedirá o código por telefone/WhatsApp
  (o template de e-mail já avisa "se você não solicitou, ignore" — bom).

### 🟠 F7 — `/diagnostico` é pública (sem login) e vaza detalhes de infraestrutura

**O que existe:** `src/proxy.ts` trata `/diagnostico` como rota pública. A página mostra
`env`, host, commit, **referência do projeto Supabase**, **prefixo (12 chars) + sufixo (6
chars) da anon key**, e os valores de `/auth/v1/settings` (e-mail habilitado,
`disable_signup`, `mailer_autoconfirm`). É informação de reconhecimento direto para quem
quer atacar o projeto.

**Como resolver:** em produção, exigir `requireAdmin` (ou remover a rota do deploy);
manter disponível só em `localhost`/previews de desenvolvimento. Se mantiver, tirar o
prefixo da anon key do output.

### 🟠 F8 — DELETE duro com cascata disponível para qualquer voluntário logado

**O que existe:** com a RLS v1, qualquer usuário autenticado pode `DELETE` em
`cepzk_assistido` — e o cascade apaga **todo** o histórico (tratamentos → extensão ACA →
queixas → sessões → procedimentos → relatórios). Também pode apagar escalas e editar
qualquer voluntário (nome/telefone — a trigger protege só `papel`). O "arquivamento"
existe como fluxo do app, mas a exclusão dura fica exposta pela API.

**Como resolver:** com as novas políticas RLS (F3), **remover `DELETE` de todos exceto
admin** (e, se possível, nem admin: exclusão só via rotina de anonimização/backup).
Integridade do histórico é exigência prática do art. 46 ("integridade") e do art. 6, IV
("qualidade dos dados").

### 🟠 F9 — Sem trilhas de auditoria e sem registro de tratamento (arts. 37 e 46)

**O que existe:** nenhum log de **quem** criou/alterou/apagou assistidos, tratamentos,
relatórios — nem de quem acessou. `data_atualizacao` existe em `cepzk_tratamento`
(atualizada pela aplicação) e `data_criacao` em algumas tabelas; mas não há *quem*. A ANPD
pode exigir registros das operações de tratamento (art. 37), e a ausência de trilha impede
responder incidentes (art. 48) e requisições (art. 18) com segurança.

**Como resolver:**
```sql
create table public.cepzk_auditoria (
    id            bigserial primary key,
    voluntario_id uuid references public.cepzk_voluntario(id),  -- auth.uid()
    entidade      text not null,      -- 'cepzk_assistido', 'aca_relatorio', ...
    registro_id   int,
    acao          text not null,      -- 'insert' | 'update' | 'delete'
    antes         jsonb,
    depois        jsonb,
    data_hora     timestamptz not null default now()
);
```
Trigger genérico (`to_jsonb(old)`/`to_jsonb(new)`) nas tabelas sensíveis
(`cepzk_assistido`, `cepzk_tratamento`, `aca_relatorio`, `aca_sessao`,
`cepzk_voluntario`). Conservar ≥ 5 anos (alinhado à retenção de registro de incidentes do
Regulamento da ANPD).

### 🟠 F10 — Sem política de retenção, exclusão ou anonimização (arts. 16 e 18)

**O que existe:** `data_arquivamento` marca assistido/tratamento como arquivados — mas o
dado permanece integralmente para sempre. Não há processo de exclusão por pedido do
titular, nem de anonimização ao fim do tratamento.

**Como resolver:**
1. Definir e documentar **prazos de guarda** por categoria (ex.: manter dados do
   assistido ativos + N anos após a alta, com justificativa; catálogos por tempo
   indeterminado — não são pessoais).
2. Implementar, no fim do prazo ou a pedido:
   - **anonimização** (art. 5, XI) do `nome_completo` → substituir por pseudônimo
     irreversível (ex.: hash salgado mantido fora do banco), preservando a estatística;
   - **exclusão** quando aplicável (dados tratados com base em consentimento podem ser
     apagados a pedido — art. 18, V), com registro do pedido e da ação.
3. Canal para pedidos: e-mail/telefone do encarregado + checklist interno (ver F14/F15).
   **Portabilidade** (art. 18, IV): a esse porte, um export SQL/CSV por assistido basta —
   documentar o processo.

### 🟠 F11 — Texto livre em campos sensíveis (`obs`) sem orientação (minimização — art. 6, III)

**O que existe:** `cepzk_tratamento.obs` e `aca_relatorio.obs` são `text` livre. Sem
orientação, voluntários podem digitar diagnósticos detalhados, CPFs, endereços, nomes de
familiares — mais dado sensível do que o necessário, em campo que qualquer voluntário
lê (RLS v1).

**Como resolver:** orientação escrita no campo (placeholder/dica): o que registrar e o que
**não** registrar (sem diagnóstico médico fora dos catálogos, sem documentos, sem dados de
terceiros); revisitar periodicamente o conteúdo. A longo prazo, migrar para campos
estruturados sempre que possível.

### 🟠 F12 — Transferência internacional de dados (arts. 33-34): região do Supabase não garantida

**O que existe:** o Vercel está fixado em `gru1` (São Paulo) ✅. Mas nada no repositório
garante que o **projeto Supabase** foi criado no Brasil — se o projeto está na região
padrão (EUA), dados pessoais de brasileiros saem do país.

**Como resolver:**
- Criar (ou migrar) o projeto Supabase em **sa-east-1 (São Paulo)** — região disponível no
  Supabase (confirmado na documentação oficial). Documentar a decisão no README do
  backend.
- Se por alguma razão precisar de outra região: formalizar salvaguarda (DPA do Supabase,
  ver F13) e registrar a avaliação.

### 🟠 F13 — Sem contrato de operador (DPA) com Supabase/Vercel (art. 38)

**O que falta:** a casa (controladora) delega armazenamento/processamento ao Supabase
(operador). A LGPD exige instrumento contratual que discipline obrigações, segurança e
responsabilidades.

**Como resolver:** assinar o **DPA do Supabase** (disponível no dashboard/página legal da
empresa) e guardar; mesmo tratamento com a Vercel. Revisar anualmente a lista de
subprocessadores do Supabase.

### 🟠 F14 — Sem processo de resposta a incidentes (art. 48)

**O que falta:** nada define quem avalia, quem decide comunicar e como comunicar. O
**Regulamento de Incidentes da ANPD (Res. CD/ANPD nº 15/2024)** fixa: comunicação à ANPD e
aos titulares em **3 dias úteis** contados do conhecimento do incidente (agentes de
**pequeno porte** — como a casa provavelmente se enquadra, pela Res. CD/ANPD nº 2/2022 —
têm o prazo **em dobro: 6 dias úteis**); complementação em 20 dias úteis; **registro do
incidente por 5 anos**, inclusive os não comunicados.

**Como resolver:** playbook de 1 página: (1) detectar → (2) avaliar risco/dano relevante
(dados sensíveis de assistidos contam a favor da comunicação) → (3) conter (revogar sessões:
*Authentication → Users*, rotacionar chaves se preciso) → (4) comunicar à ANPD (portal) +
titulares de forma individualizada → (5) registrar tudo (usar a tabela de auditoria, F9).
Ensaio anual.

### 🟠 F15 — Sem encarregado (DPO), política interna nem registro de operações (arts. 37, 40, 41)

**O que falta:** nenhum encarregado identificado, nenhuma política interna, nenhum registro
simples do que é tratado/com qual base/por quanto tempo. A ANPD também pode determinar
**DPIA** (art. 40) — o tratamento aqui é inteiramente de dados sensíveis, então o
enquadramento é provável; este documento serve de insumo.

**Como resolver:**
- Nomear um **encarregado** (voluntário dedicado, com e-mail público, ex.
  `privacidade@...`) — não precisa ser "DPO profissional", mas precisa existir e ser
  identificável.
- Criar **política interna** (1-2 páginas): quem são controlador/operadores, bases legais,
  finalidades, retenção, medidas de segurança, incidentes, canal do titular.
- Manter **registro das operações** (uma planilha/tabela serve): tabela → finalidade → base
  legal → retenção → acesso.
- **Treinamento** rápido dos voluntários (o que é dado sensível, o que não digitar nos
  `obs`, phishing de código, dispositivos).

### 🟡 F16 — Headers de segurança ausentes (CSP, frame-ancestors, X-Content-Type-Options)

**O que existe:** `vercel.json` define apenas `Cache-Control` do SW/manifest;
`next.config.ts` não adiciona headers. (HSTS já vem aplicado pela Vercel por padrão.) Sem
CSP, um XSS tem campo livre — e o cookie de sessão é legível por JS (F4).

**Como resolver:** adicionar em `next.config.ts`:
```ts
headers: async () => [{
  source: "/(.*)",
  headers: [
    { key: "Content-Security-Policy",
      value: "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self' https://*.supabase.co; frame-ancestors 'none'; base-uri 'self'" },
    { key: "X-Content-Type-Options", value: "nosniff" },
    { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  ],
}]
```
(ajustar `script-src` ao que o build exigir — o script inline do `supabase-env.tsx` já é
o único `'unsafe-inline'` justificado; avaliar hash de nonce).

### 🟡 F17 — Identificação dos assistidos só por nome (qualidade/privacidade)

`nome_completo` é `unique` (duas pessoas homônimas não cabem — limite de escala e erro de
cadastro) e é o **único** identificador. A própria doc interna
(`docs/similaridade-de-nomes.md`) propõe CPF/data de nascimento para deduplicar — **não
fazer**: aumentaria o dado sensível coletado. Caminho LGPD-friendly: manter só o nome +
considerar um **pseudônimo interno** (ID curto) exibido nas telas, com o nome completo
visível só para quem realmente precisa (AF/admin) — minimização de exposição.

### 🟢 F18 — Observações operacionais

- **Plano gratuito do Supabase**: projetos inativos são pausados e o backup/PITR depende do
  plano — disponibilidade é parte da segurança (art. 46). Confirmar o plano/retenção de
  backups e **testar uma restauração** a cada 6 meses.
- **Postgres direto**: manter a senha do projeto confidencial e nunca expor a string de
  conexão (por padrão a porta não é aberta — confirmar no dashboard).
- **Repositórios públicos**: verificado que não há segredos nem PII no histórico — ok.
  Publicar o esquema ajuda um atacante a mapear o alvo; aceito para o porte do sistema,
  mas manter a vigilância (nunca commitear `.env` real).
- **`enable_confirmations`**: a `config.toml` local desativa confirmação de e-mail;
  confirmar que a configuração do dashboard de produção está coerente com o fluxo de
  convite tratado no `auth/callback` (`token_hash&type=signup` já é suportado no app ✅).
- **Rate limit de e-mails**: conferir os limites padrão do projeto (convites + logins
  enviam e-mail) e ajustar para não travar o uso normal nem facilitar spam.

---

## 4. Roadmap sugerido

**P0 — antes de ampliar o uso (dias/semanas)**
1. Consentimento + aviso de privacidade no Atendimento Fraterno (incl. responsável de
   menores) + tabela `cepzk_consentimento` (F1, F2).
2. Projeto Supabase em sa-east-1 (F12).
3. RLS por função (F3) + remover DELETE de não-admins (F8).
4. Cookie `httpOnly: true, secure: true` + mover `complete-profile` para Server Action
   (F4).
5. SW: remover cache de HTML/RSC (F5).
6. `/diagnostico` atrás de admin em produção (F7).
7. Encarregado + playbook de incidentes (F14, F15).

**P1 — em ~1-2 meses**
8. Auditoria (F9) · MFA para admin/coordenadores + rate-limit no login (F6) ·
   retenção/anonimização (F10) · DPAs assinados (F13) · política interna + treinamento
   (F15) · CSP (F16) · orientação nos campos `obs` (F11).

**P2 — evolução**
9. Pseudônimos nas telas (F17) · campos estruturados no lugar de `obs` · DPIA formal
   (art. 40) · export/portabilidade automatizado · revisão anual de conformidade.

---

## 5. Checklist rápido do dashboard do Supabase (produção)

- [ ] Região do projeto: **São Paulo (sa-east-1)**
- [ ] Authentication → Providers → Email: **Allow new users to sign up: OFF** (invite-only)
- [ ] Authentication → URL Configuration: Site URL + **apenas** as URLs de callback do app
- [ ] Authentication → Rate Limits / OTP: tentativas e cooldown reduzidos
- [ ] Authentication → MFA: habilitado (no mínimo para admins)
- [ ] SMTP próprio (ex.: Resend) para entrega confiável dos e-mails
- [ ] Backups/PITR: plano e retenção confirmados; **restauração testada**
- [ ] API Keys: `service_role` usada **apenas** em Edge Functions (hoje não há nenhuma — ok)
- [ ] Conexão direta ao Postgres: senha confidencial, porta fechada

---

## 6. Base legal consultada

LGPD (Lei 13.709/2018): arts. 5 (definições, dados sensíveis), 6 (princípios), 7-9
(bases, consentimento, aviso), 11 (dados sensíveis), 14 (crianças), 15-16 (finalidade,
retenção), 18 (direitos do titular), 33-34 (transferência internacional), 37-38 (registro,
controlador/operador), 40-41 (DPIA, encarregado), 46 (segurança), 48 (incidentes);
Res. CD/ANPD nº 2/2022 (pequeno porte) e Res. CD/ANPD nº 15/2024 (comunicado de
incidente — CIS, prazos de 3 dias úteis / 6 para pequeno porte, registro por 5 anos).

Verificações empíricas nesta análise: migrations e RLS do backend (mig. 001-009); fluxo de
auth e `proxy.ts` do webapp; fonte de `@supabase/ssr@0.12.5` (cookies default) e
`@serwist/next@9.5.12` (`defaultCache`); histórico git dos dois repositórios (sem segredos/
PII); `vercel.json` (região gru1); templates de e-mail.
