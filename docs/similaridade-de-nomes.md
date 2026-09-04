# Comparação de nomes por similaridade — pesquisa de alternativas

> **Escopo:** pesquisa que motivou a troca do algoritmo — e, na seção 11, o registro
> do que foi implementado a partir dela (caminho A).
> Data da pesquisa: 2026-09-04. Todas as versões, datas de publicação, licenças e
> tamanhos foram conferidos no registro npm e na API do GitHub nessa data; todas as
> métricas de acurácia foram medidas neste trabalho (metodologia na seção 3).

## 1. Resumo executivo

1. **O problema não é a biblioteca, é a estratégia.** Trocar o Dice/bigram atual por
   qualquer métrica pronta (Jaro-Winkler, Levenshtein, `token_set_ratio`, trigramas do
   `pg_trgm`) aplicada ao **nome inteiro** melhora o F1 de 66% para no máximo **84%** —
   e continua errando exatamente os casos que você citou, porque qualquer métrica global
   é dominada pelo sobrenome em comum.
2. **O que resolve** é comparar **nome a nome** (token a token), com **normalização
   ortográfica pt-BR** e exigência de par no **primeiro nome** e no **último sobrenome**:
   medimos **F1 98%** (precisão 95%, recall 100%) no conjunto rotulado, acertando os três
   exemplos do pedido. Para isso basta uma métrica de **distância de inserção/remoção
   (indel/LCS)** — que é ~15 linhas de DP e pode ser escrita à mão. Com o ajuste que a
   implementação pediu (seção 11), a regra final chega a **100% / 100%** no mesmo
   conjunto.
3. **Biblioteca é opcional.** A nossa recomendação é resolver dentro de
   `src/lib/assistido.ts`, como o Dice já vive lá hoje: a função de distância que vence é
   ~15 linhas. Se preferirem uma dependência, as melhores são **`fuzzball`** (a mais
   estabelecida — 640★, mantida, e o `ratio()` por token já é o indel normalizado) e
   **`rapidfuzz-js`** (a mais completa e moderna — zero dependências, TypeScript estrito,
   tree-shakeable; porém com adoção quase nula, 1★, e `engines: node>=22`). Nada disso vai
   para o bundle do browser: a comparação roda num server action.
4. **Fonética (Soundex/Metaphone/Double Metaphone/BuscaBR) não ajuda**: medimos
   F1 70–76%, pior que o atual em vários recortes, e erra o caso "Luccas Silva" ≈
   "Luca Silva" (Soundex: `L220` × `L200`).
5. **Há uma saída mais barata e mais forte que qualquer algoritmo**: um campo de
   identificação (CPF e/ou data de nascimento) no cadastro. Hoje `Assistido` só tem
   `id`, `nome_completo` e `data_criacao`, então a deduplicação depende 100% de texto.

## 2. O que existe hoje

| Onde | O quê |
| --- | --- |
| `src/lib/assistido.ts:445` | `normalizeName()` — minúsculas, sem acentos/pontuação |
| `src/lib/assistido.ts:426` | `NAME_PARTICLES` — `de`, `da`, `dos`, `von`… já são ignoradas |
| `src/lib/assistido.ts:461` | `bigrams()` + `dice()` — coeficiente de Sørensen–Dice sobre pares de letras |
| `src/lib/assistido.ts:501` | `nameSimilarity()` — `0.45·(melhor par por token da consulta) + 0.25·(idem, invertido) + 0.30·(Dice das strings concatenadas)` |
| `src/lib/assistido.ts:527` | `SIMILARITY_THRESHOLD = 0.35` |
| `src/lib/assistido.ts:534` | `findSimilarNames()` — filtra, ordena e devolve até 8 |
| `src/app/assistidos/actions.ts:53` | `findSimilarAssistidos()` — server action: `SELECT id, nome_completo` da tabela inteira e compara em memória |
| `src/app/assistidos/novo/new-assistido-flow.tsx:59` | Lista de Assistidos → Cadastrar: chama a action e mostra a tela "Encontrei esses nomes" |

**Por que erra.** A nota é uma média, e o sobrenome em comum já garante uma base alta;
o termo de 30% sobre a string inteira soma os bigramas do sobrenome de novo. Resultado
medido com o código atual:

| Par | Nota atual | Limiar 0,35 | Deveria |
| --- | --- | --- | --- |
| João Silva × Lucas Silva | **0,491** | aponta como parecido | não apontar |
| Luccas Silva × Luca Silveira | **0,653** | aponta como parecido | não apontar |
| Luccas Silva × Luca Silva | 0,879 | aponta como parecido | apontar ✔ |
| Ana Paula Ferreira × Ana Luiza Ferreira | **0,667** | aponta | não apontar |
| Francisco Oliveira × Francislei Oliveira | **0,833** | aponta | não apontar |

No limiar de produção (0,35), sobre o conjunto rotulado da seção 3: **precisão 49%,
recall 100%, F1 66%** — ou seja, **de cada dois nomes apresentados como "já cadastrado",
um não é a mesma pessoa**. Subir o limiar para o melhor valor possível (0,77) leva a
F1 80% e passa a perder duplicados reais (ex.: `Marcos Sousa` × `Marcos Souza`).
Não existe limiar que conserte: a forma da função é que está errada.

## 3. Metodologia

- **Conjunto rotulado artesanal** (Apêndice A): 21 pares que *deveriam* ser sinalizados
  (variantes ortográficas, partículas, sufixos, acentos, erros de digitação), 22 pares que
  *não deveriam* (pessoas diferentes com sobrenome igual, pares de gênero, sobrenomes
  parecidos) e 6 **ambíguos**, medidos à parte porque qualquer resposta é defensável
  (`João` × `João Silva`, apelidos, abreviações).
- Para cada candidato foi feita **varredura de limiar** (0,30 → 1,00, passo 0,01) e
  reportado o **melhor F1**, para não comparar bibliotecas em limiares arbitrários.
- **Limitação honesta:** 43 pares é pouco. Os números servem para *ordenar* as
  abordagens, não como medida absoluta.
- O conjunto virou teste automatizado (`src/lib/assistido.test.ts`, seção 11), com dois
  pares positivos a mais que entraram durante a implementação (`Fabrício`/`Fabrizio` e
  `Sônia`/`Sonja`) — por isso os testes falam em 23 e as tabelas desta pesquisa, em 21.
- As medições foram feitas em Node 22.22.3 com as bibliotecas instaladas do npm.

## 4. Resultado 1 — só trocar a métrica não resolve

Melhor F1 de cada métrica aplicada à **string do nome inteiro**, no mesmo conjunto:

| Biblioteca / métrica | Melhor limiar | Precisão | Recall | F1 |
| --- | --- | --- | --- | --- |
| `rapidfuzz-js` `dice.normalizedSimilarity` | 0,85 | 94% | 76% | **84%** |
| `strsimkit` `dice` / `jaccard(2)` | 0,85 / 0,74 | 94% | 76% | **84%** |
| `natural` `DiceCoefficient` | 0,85 | 94% | 76% | **84%** |
| `rapidfuzz-js` `fuzz.tokenSetRatio` | 0,89 | 74% | 95% | 83% |
| `rapidfuzz-js` `fuzz.weightedRatio` (WRatio) | 0,89 | 74% | 95% | 83% |
| `rapidfuzz-js` `jaro.similarity` | 0,91 | 76% | 90% | 83% |
| `pg_trgm` `similarity()` (simulado em JS) | 0,65 | 84% | 76% | 80% |
| `rapidfuzz-js` `jaroWinkler.similarity` | 0,91 | 62% | 100% | 76% |
| `natural` / `strsimkit` / `string-comparisons` Jaro-Winkler | 0,93 | 68% | 90% | 78% |
| `fuzzball` `ratio` / `token_set_ratio` / `WRatio` | 0,90 | 71% | 81% | 76% |
| `rapidfuzz-js` `levenshtein` / `osa` / `indel` normalizados | 0,85–0,89 | 71–72% | 81–86% | 76–78% |
| **atual** (Dice por token + string inteira) | 0,35 (produção) | 49% | 100% | **66%** |

Leituras importantes:

- **Jaro-Winkler é a métrica "clássica para nomes" e aqui é das piores**: medido por
  token, `silva` × `silveira` = **0,925**, *acima* de `luccas` × `luca` = **0,922**. O
  bônus de prefixo premia justamente o par que precisamos separar, e ainda dá 0,483 para
  `joao` × `lucas` (o Dice atual dá 0,20 — o Jaro-Winkler seria *pior* nesse ponto).
- **`token_set_ratio` (o "token set" do fuzzywuzzy/RapidFuzz) tem uma armadilha**: ele é
  desenhado para dar 100 quando um lado é subconjunto do outro, então `João` casa com
  *todo* `João …` da base. Como a tela de cadastro exige só 3 caracteres, isso viraria
  uma enxurrada de falsos positivos.
- O Dice continua sendo a melhor métrica *global* (84%) — sinal de que o defeito está na
  agregação, não no coeficiente.

## 5. Resultado 2 — comparar nome a nome, com normalização pt-BR

Estratégia avaliada (detalhes no Apêndice B):

1. Normalizar (acentos, caixa, pontuação), remover **partículas** (`de`, `da`, `dos`…) e
   **sufixos de geração** (`junior`, `filho`, `neto`, `segundo`…);
2. Reduzir as **variantes ortográficas** comuns em nomes brasileiros (o *fold* pt-BR):
   `ph→f`, `y→i`, `w→v`, `k→c`, `z→s`, `h` mudo, e letras duplas (`cc→c`, `ss→s`,
   `rr→r`, `ll→l`, `pp→p`, `tt→t`, `oo→o`, `ee→e`);
3. Emparelhar os tokens **um a um** (cada nome de um lado precisa de um par no outro) e
   exigir par no **primeiro token** e no **último token**;
4. Métrica por token: **similaridade de indel/LCS normalizada ≥ 0,86** — isto é, só
   inserção e remoção contam como edição; **substituição custa o dobro** (uma
   transposição equivale a 1 inserção + 1 remoção, por isso `Nogueira`/`Nogreira`
   continua casando).

**A escolha da métrica por token, isolada** (mesma regra campo-a-campo, mesmo fold, só a
função de distância trocada — varredura de limiar):

| Métrica por token | Limiar | Precisão | Recall | F1 |
| --- | --- | --- | --- | --- |
| **indel / LCS** | **0,86** | **95%** | **100%** | **98%** |
| **dice (bigram)** | **0,84** | **100%** | 95% | **98%** |
| levenshtein normalizado | 0,86 | 95% | 95% | 95% |
| OSA (Damerau restrito) | 0,86 | 95% | 95% | 95% |
| levenshtein / OSA | 0,80 | 78% | 100% | 88% |
| indel | 0,84 | 81% | 100% | 89% |
| jaro-winkler | 0,90 | 66% | 100% | 79% |
| jaro-winkler | 0,95 | 100% | 95% | 98% |

| Estratégia | Precisão | Recall | F1 | Ambíguos aceitos |
| --- | --- | --- | --- | --- |
| **campo-a-campo + fold pt-BR, indel ≥ 0,86** | 95% | **100%** | **98%** | 1/6 |
| **campo-a-campo + fold pt-BR, dice ≥ 0,84** | **100%** | 95% | **98%** | 1/6 |
| campo-a-campo + fold pt-BR, OSA ≥ 0,86 | 95% | 95% | 95% | 0/6 |
| campo-a-campo + fold, Jaro-Winkler ≥ 0,95 | 100% | 95% | 98% | 1/6 |
| campo-a-campo **sem** fold, OSA ≥ 0,90 | 100% | 90% | 95% | 0/6 |
| campo-a-campo sem fold, OSA ≥ 0,80 | 78% | 100% | 88% | 2/6 |
| (melhor métrica global, seção 4) | 94% | 76% | 84% | — |
| (algoritmo atual, limiar ótimo 0,77) | 69% | 95% | 80% | 3/6 |

**Os três casos do pedido, com indel ≥ 0,86:**

| Par | Resultado | Por quê |
| --- | --- | --- |
| João Silva × Lucas Silva | **diferente** | primeiro nome `joao` × `lucas` = 0,20 |
| Luccas Silva × Luca Silva | **parecido** | fold `cc→c` ⇒ `lucas` × `luca` = 0,89 (1 remoção); sobrenome idêntico |
| Luccas Silva × Luca Silveira | **diferente** | sobrenome `silva` × `silveira` = 0,77 (3 letras a mais) — abaixo do limiar |

Por que o **indel** e não o Levenshtein? Porque em nomes brasileiros as variantes
legítimas são quase todas *inserção/remoção/transposição* (consoante dupla, `h` mudo,
sufixo, letra trocada de lugar), enquanto **nomes diferentes quase sempre exigem
substituição** — e é a substituição que separa `Eduardo` de `Eduarda`, `Renato` de
`Renata`, `Claudio` de `Claudia`, `Mariana` de `Mariane`, `Lima` de `Lira`. O
Levenshtein/OSA conta todos esses como 1 edição e os aceita; o indel os penaliza em
dobro. Daí as duas melhores configurações: **indel ≥ 0,86** (recall 100%, precisão 95%)
e **dice ≥ 0,84** (precisão 100%, recall 95%) — a escolha entre elas é o custo de cada
erro: deixar passar um duplicado real (recall) ou incomodar o voluntário com um falso
positivo (precisão).

**Erros residuais medidos** (únicos em 43 pares — o primeiro foi eliminado depois,
ver seção 11):

- `Alessandra Rodrigues` × `Alexandra Rodrigues` → **aceito** (falso positivo, mas
  discutível: no Brasil são grafias concorrentes do mesmo nome). Não vem de nenhum fold
  (`x` não é dobrado na configuração medida): é o indel de 2 edições num token longo
  (`alesandra` × `alexandra` = 0,889). Subir o limiar do **primeiro nome** para 0,90
  elimina esse caso sem tocar nos demais.
- Com `dice ≥ 0,84` o único erro é o inverso: perde `Ana Beatriz Nogueira` ×
  `Ana Beatriz Nogreira` (transposição).
- `Marcos Vinicius Almeida` × `Marcos Aurelio Almeida`, `Pedro Santos` × `Paulo Santos`,
  `Francisco Oliveira` × `Francislei Oliveira`, `Antonio Pereira` × `Antonio Peres`,
  `Rafael Lima` × `Rafael Lira` → todos corretamente rejeitados (hoje são aceitos).

**Desempenho** (20.000 nomes × 4 buscas, Node 22, mesma máquina):

| Abordagem | Tempo |
| --- | --- |
| atual (Dice por token + string) | 1.674 ms |
| `rapidfuzz-js` `tokenSetRatio` global | 315 ms |
| campo-a-campo indel ≥ 0,86 (com cache de tokens) | **62 ms** |

Parte do ganho vem do *early exit*: a grande maioria dos registros é descartada já no
primeiro nome. Para o tamanho real da base do CEPZK (centenas/poucos milhares de
registros) qualquer uma das três é instantânea — desempenho **não** é critério de
decisão aqui; acurácia e manutenção são.

## 6. Resultado 3 — codificação fonética não compensa

Regra "todos os tokens com o mesmo código" / "primeiro e último token com o mesmo código":

| Codec | Pacote | Todos os tokens (F1) | 1º + último (F1) |
| --- | --- | --- | --- |
| Double Metaphone | `double-metaphone`, `natural` | 76% | 73% |
| Metaphone | `metaphone`, `natural` | 73% | 70% |
| Soundex | `soundex-code`, `natural` | 73% | 70% |
| BuscaBR | `busca-br` | 74% | 71% |

Exemplos que explicam o resultado:

| Token | Soundex | Metaphone | Double Metaphone | BuscaBR |
| --- | --- | --- | --- | --- |
| luccas | `L220` | `LKKS` | `LKS` | `RCK` |
| luca | `L200` | `LK` | `LK` | `RK` |
| silva | `S410` | `SLF` | `SLF` | `SRV` |
| silveira | `S416` | `SLFR` | `SLFR` | `SRVR` |
| eduardo | `E363` | `ETRT` | `ATRT` | `DRD` |
| eduarda | `E363` | `ETRT` | `ATRT` | `DRD` |

Todos os codecs são desenhados para **inglês**: acertam o par negativo
(`silva` ≠ `silveira`), mas **erram o par positivo do pedido** (`luccas` ≠ `luca`) e
**colapsam pares de gênero** (`eduardo` = `eduarda`). O Double Metaphone ainda salva o
caso `Wagner`/`Vagner` pelo segundo código (`FKNR`), que é o único ponto em que fonética
agrega. Existe um *Metaphone pt-BR* (projeto `metaphoneptbr`, SourceForge, ligado à
Prefeitura de Várzea Paulista) e o algoritmo acadêmico *BuscaBR*, mas nenhum tem pacote
npm mantido — o `busca-br` é de 2016. **Conclusão: não usar fonética como critério; no
máximo como sinal auxiliar (W/V, Z/S), que o fold ortográfico já cobre.**

## 7. Catálogo de bibliotecas avaliadas

Todas instaladas e testadas neste trabalho. "Bundle" = tamanho minificado+gzip medido
com esbuild importando **só a métrica usada** (relevante só se um dia a comparação for
para o cliente — hoje ela roda num server action, então não vai para o bundle do
browser).

| Pacote | Versão (publicação) | Licença | Deps | Instalado | Bundle | GitHub | Métricas úteis aqui | Veredito |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| **`fuzzball`** | 2.2.6 (abr/2026) | MIT | 3 (`heap`, `lodash`, `setimmediate`) | 486 KB | 14,9 KB | 640★, ativo | `ratio` (= indel normalizado), `token_set_ratio`, `extract`, `dedupe` | **Recomendado** se quiser dependência: é o port JS do fuzzywuzzy/RapidFuzz, mantido, TS embutido, e o `ratio()` por token já entrega a métrica que vence. `dedupe()` serve para auditar duplicados já existentes na base |
| **`rapidfuzz-js`** | 0.12.0 (ago/2026) | MIT | 0 | 2,0 MB | 7,5 KB | **1★**, muito ativo | `indel`, `levenshtein`, `osa`, `dice`, `jaro`, `jaro-winkler`, `fuzz.*`, `createMatcher`, índices | Tecnicamente o melhor (TS estrito, tree-shakeable, roda em browser/edge, API de índice). **Risco: adoção quase nula e `engines: node>=22`** (o repo declara `>=20.9.0`; na Vercel isso já sobe para Node 24, mas o `npm install` local em Node 20 avisa `EBADENGINE`) |
| **`strsimkit`** | 0.1.0 (jun/2026) | MIT | 0 | 152 KB | **0,73 KB** | 0★ | `lcsSimilarity`, `jaroWinkler`, `dice`, `jaccard`, `soundex`, `doubleMetaphone` | Minúsculo e com tipos; mesmo risco de adoção do anterior. Bom se o critério for "dependência quase gratuita" |
| `natural` | 8.1.1 (fev/2026) | MIT | **14** (`mongoose`, `pg`, `redis`, `wordnet-db`, `dotenv`, `underscore`…) | **14 MB** | — | 10.881★ | `DiceCoefficient`, `JaroWinklerDistance`, `LevenshteinDistance`, `DamerauLevenshteinDistance`, fonética | **Descartado pelo peso**: traz drivers de banco e dicionários de NLP que não usamos, só para chegar a funções de 20 linhas |
| `leven` | 4.1.0 (set/2025) | MIT | 0 | 24 KB | ~1 KB | 735★ | só Levenshtein (+ `closestMatch`) | Bom e popular, mas só Levenshtein — que é justamente a métrica que aceita `Eduardo`/`Eduarda` |
| `fastest-levenshtein` | 1.0.16 (2022) | MIT | 0 | 57 KB | ~2 KB | — | só Levenshtein, muito rápido | Idem; velocidade não é o gargalo |
| `string-comparisons` | 0.0.20 (abr/2024) | MIT | 0 | 44 KB | ~2 KB | 16★ | 13 algoritmos num pacote só (Dice, Jaro-Winkler, OSA, trigram, n-gram, cosseno…) | Prático para experimentar; API inconsistente (algumas classes não expõem `similarity`), pouco mantido |
| `@bybrave/string-similarity2` | 5.0.1 (jul/2026) | MIT | 0 | 28 KB | ~1 KB | 0★ | Dice/bigram + `findBestMatch` | Fork mantido do `string-similarity` arquivado. É *o que já temos* em pacote: não resolve |
| `talisman` | 1.1.4 (jun/2022) | MIT | 6 | 832 KB | — | 732★, parado | dezenas de distâncias + fonéticas | Abandonado (última publicação em 2022) |
| `string-similarity` | 4.0.4 (2021) | ISC | 0 | — | — | 2.530★, **arquivado** | Dice | **Não usar**: repositório arquivado no GitHub |
| `jaro-winkler` | 0.2.8 (~2016) | MIT | 0 | — | — | 85★ | Jaro-Winkler | Abandonado; e Jaro-Winkler é métrica ruim para este caso |
| `fuse.js` | 7.5.0 (ago/2026) | Apache-2.0 | 0 | ~120 KB | ~7 KB | 20.468★ | busca fuzzy (Bitap) com pesos por campo | **Ferramenta errada**: é para autocomplete/filtro de lista (como `assistidos-list.tsx`), não para decidir "é a mesma pessoa?". Também pode ser útil lá, mas é outra questão |
| `fuzzysort`, `rapid-fuzzy` | — | — | — | — | — | 2★ (`rapid-fuzzy`) | busca fuzzy / Rust+WASM | Mesma observação do Fuse.js; `rapid-fuzzy` ainda exige Node ≥22 e WASM |

## 8. Alternativa no banco: `pg_trgm` / `fuzzystrmatch` no Supabase

O comentário em `src/app/assistidos/actions.ts:50` diz que a comparação ficou na
aplicação para evitar habilitar `pg_trgm`. Vale registrar que **o Supabase já traz as
duas extensões na lista de extensões habilitáveis** (Dashboard → Database → Extensions,
ou `CREATE EXTENSION pg_trgm;` no SQL Editor), junto com `unaccent`, `citext`, `rum` e
`vector`. Ou seja, o obstáculo é uma migração no repo de backend
(`CEPZK/cepzk_atendimentos_backend`), não uma limitação de plataforma.

```sql
CREATE EXTENSION IF NOT EXISTS pg_trgm;      -- similarity(), %, <->, índice GIN
CREATE EXTENSION IF NOT EXISTS unaccent;     -- busca sem acento
CREATE INDEX assistido_nome_trgm_idx
  ON cepzk_assistido USING gin (nome_completo gin_trgm_ops);

-- pré-filtro indexado + reordenação
SELECT id, nome_completo, similarity(nome_completo, :nome) AS nota
FROM cepzk_assistido
WHERE nome_completo % :nome          -- usa o índice GIN (limiar em pg_trgm.similarity_threshold)
ORDER BY nome_completo <-> :nome
LIMIT 8;
```

Medimos o `similarity()` do `pg_trgm` (reimplementado em JS, Jaccard sobre trigramas com
padding) no mesmo conjunto rotulado: **melhor F1 = 80% no limiar 0,65**. Ou seja:
*é a mesma classe de erro das métricas globais* (0,278 para João×Lucas — bom; mas 0,714
para `Antonio Pereira` × `Antonio Peres` — ruim).

Quando faz sentido ir para o banco:

- a base crescer a ponto de o `SELECT` completo por consulta incomodar (hoje não incomoda);
- quiser **pré-filtrar** com índice e deixar o app aplicar só a regra campo-a-campo nos
  candidatos (a combinação certa: `pg_trgm` como funil, regra do Apêndice B como decisão);
- quiser deduplicar **em massa** (auditoria da base atual) com `dedupe()`/SQL, sem baixar
  a tabela.

`fuzzystrmatch` também oferece `levenshtein()`, `levenshtein_less_equal()`, `soundex()`,
`metaphone()` e `daitch_mokotoff()` — mas `levenshtein()` não é indexável (limite de 255
caracteres) e as fonéticas são anglófonas (seção 6).

## 9. O que considerar além do algoritmo

- **Chave de identidade.** O modelo `Assistido` (`src/lib/assistido.ts:27`) tem só `id`,
  `nome_completo` e `data_criacao`. Adicionar **CPF** (ou ao menos **data de
  nascimento**) no cadastro transforma a deduplicação de "heurística de texto" em
  "comparação de chave": CPF igual = duplicado certo; CPF diferente = pessoa diferente,
  independentemente do nome. Isso exige mudança no backend e no formulário, mas é o que
  de fato elimina o problema. Vale lembrar que num centro espírita há assistidos sem
  documento (situação de rua, crianças) — o campo precisaria ser opcional, e a
  similaridade de nome continuaria sendo o fallback.
- **UX de revisão.** A tela atual (`new-assistido-flow.tsx:142`) apresenta os parecidos
  como um bloco único, sem dizer *por que* apareceram. Mostrar o motivo ("mesmo
  sobrenome, primeiro nome difere em 1 letra") e separar "provavelmente é o mesmo" de
  "vale conferir" reduz muito o custo do falso positivo — e torna o limiar menos crítico.
- **Testes.** Qualquer que fosse a escolha, o conjunto do Apêndice A deveria virar um
  teste de unidade — virou, com **Vitest** (`npm test`), que roda a função pura de
  `src/lib/assistido.ts` sem mock nenhum (detalhes e os dois tropeços de instalação na
  seção 11).
- **O que *não* usar:** embeddings/`pgvector` para isso. Vetores semânticos aproximam
  "João Silva" e "Lucas Silva" (mesmo contexto semântico) — piorariam exatamente o caso
  relatado.

## 10. Recomendação

| Caminho | O que muda | Custo | Risco | F1 medido |
| --- | --- | --- | --- | --- |
| **A. Regra nova, sem dependência** (recomendado) | Reescrever `nameSimilarity`/`findSimilarNames` em `src/lib/assistido.ts` com fold pt-BR + emparelhamento token a token + indel (≈60 linhas, como o Dice de hoje) | Baixo | Baixo: nada novo para manter | 98% |
| **B. Regra nova + `fuzzball`** | Mesma regra, usando `fuzzball.ratio()` por token; ganha `dedupe()`/`extract()` de brinde | Baixo | Baixo: pacote estabelecido (640★, ativo) | 98% |
| **C. Regra nova + `rapidfuzz-js`** | Mesma regra, usando `indel.normalizedSimilarity`; API mais limpa e com tipos estritos | Baixo | Médio: 1★ no GitHub, `engines node>=22` | 98% |
| **D. `pg_trgm` no Supabase** | Migração no backend + `rpc()` no lugar do `SELECT` completo | Médio | Médio: muda onde a regra vive (o comentário do código atual defende justamente o contrário) | 80% sozinho; bom como *funil* |
| E. Só trocar a métrica mantendo a agregação atual | Ex.: Jaro-Winkler ou `token_set_ratio` no lugar do Dice | Mínimo | **Alto: não resolve** | ≤84% |

**Escolhido: A** — implementado na seção 11. A sugestão original era **A** (ou **B**,
se preferissem não manter a função de distância à mão), acompanhada de

1. um teste de unidade com o Apêndice A;
2. limiar **0,86** para recall máximo ou **0,90** se a prioridade for não incomodar com
   falsos positivos (a 0,90 perde-se `Luccas Silva` × `Luca Silva`, o caso do pedido —
   então 0,86–0,88 é o ponto certo);
3. na tela de revisão, explicar por que cada nome apareceu.

Depois, se/quando o cadastro ganhar CPF, a similaridade de nome vira apenas o fallback.

## 11. O que foi implementado (caminho A)

Sem dependência de runtime nova. Tudo em `src/lib/assistido.ts`, no lugar do
`nameSimilarity`/`dice` anterior:

| Símbolo | O que é |
| --- | --- |
| `NAME_GENERATIONS` | `junior`, `filho`, `neto`, `segundo`… ignorados como as partículas já eram |
| `NAME_FOLDINGS` | o *fold* pt-BR: `ph→f`, `h` mudo, `y→i`, `w→v`, `k→c`, `z→s`, `c→s` antes de `e`/`i`, letras duplas. A ordem importa: `ph` antes do `h` mudo, e o `c` antes das duplas |
| `NAME_MATCH_THRESHOLD` | `0.86`, o limiar medido na seção 5 (exportado para os testes) |
| `sharedLetters` / `indelSimilarity` | LCS e a similaridade que conta só letra acrescentada ou retirada |
| `tokenSimilarity` | a comparação de **um** nome contra outro |
| `compareNames` | emparelhamento 1:1 dos nomes + exigência de par no primeiro nome e no último sobrenome |
| `similarityReason` | a frase em PT-BR que explica, na tela, por que o nome apareceu |
| `findSimilarNames` | mesma assinatura de antes, agora com `reason` em cada `SimilarAssistido` |

`normalizeName`, `nameTokens` e `assistidoInitials` ficaram como estavam — as telas de
lista (`assistidos-list.tsx`, `di-list.tsx`) e os avatares não mudam de comportamento.

### Os dois ajustes que a implementação exigiu

A configuração medida na seção 5 (indel ≥ 0,86 campo a campo) tinha um falso positivo:
`Alessandra` × `Alexandra` = 0,889. A causa é estrutural — **palavras do mesmo
comprimento não ganharam nem perderam letra**, então aplicar indel ali é medir uma
substituição pelo preço de duas edições. A regra final separa os dois casos:

| Comprimento | O que vale | Exemplos |
| --- | --- | --- |
| diferentes | indel ≥ 0,86 | `Luccas`/`Luca` ✔, `Silva`/`Silveira` ✗ |
| iguais | só **transposição** de letras vizinhas (`Nogueira`/`Nogreira`) ou **troca de vogal por consoante** (`Sônia`/`Sonja`) | `Eduardo`/`Eduarda` ✗, `Lima`/`Lira` ✗, `Alessandra`/`Alexandra` ✗ |

O critério é linguístico e vale a pena registrar: em nomes brasileiros, **trocar vogal
por vogal** é quase sempre gênero ou outro nome (`Renato`/`Renata`,
`Mariana`/`Mariane`, `Juliana`/`Juliano`), e **trocar consoante por consoante** é quase
sempre outro sobrenome (`Lima`/`Lira`, `Alessandra`/`Alexandra`); já **trocar vogal por
consoante** não produz nome nenhum — é dedo escorregado.

Mais dois acréscimos, ambos cobertos por teste:

- `c→s` antes de `e`/`i` no *fold*, para `Fabrício`/`Fabrizio` e `Cecília`/`Sesília`
  (medido: não afeta nenhum par negativo — `Marcio`/`Marcelo` e `Francisco`/`Francislei`
  continuam diferentes);
- **iniciais**: um nome de uma letra casa com qualquer nome que comece com ela, com nota
  fraca (0,5) para aparecer por último na lista. Isso resolve o caso de um assistido
  cadastrado como "Jose A. Silva" e muda uma das decisões do conjunto ambíguo — está
  fixado em teste como escolha deliberada;
- **ordem dos nomes**: quando os dois lados têm a mesma quantidade de nomes, a posição
  não importa ("Silva João" encontra "João Silva"). Quando as quantidades diferem, o
  emparelhamento só prova que o lado mais curto está contido no mais longo, e aí o
  primeiro nome e o último sobrenome precisam casar **na posição** — sem isso, digitar
  só "Ana" devolveria todas as "Ana …" da base.

### Resultado medido

`npm test` (Vitest): **75 testes**, todos passando — os 23 pares positivos (nos dois
sentidos), os 22 negativos (nos dois sentidos), as 6 decisões documentadas e os casos
unitários. Ou seja, **precisão 100% e recall 100%** no conjunto do Apêndice A, contra
49%/100% do algoritmo anterior no mesmo conjunto.

Os três casos do pedido:

| Par | Antes | Agora |
| --- | --- | --- |
| João Silva × Lucas Silva | parecido (0,491) | **diferente** |
| Luccas Silva × Luca Silva | parecido (0,879) | **parecido** (`lucas` × `luca` = 0,89) |
| Luccas Silva × Luca Silveira | parecido (0,653) | **diferente** (`silva` × `silveira` = 0,77) |

### Na tela

`Lista de Assistidos → Cadastrar` continua com os mesmos passos; cada nome da lista de
revisão ganhou uma linha dizendo por que apareceu ("Grafia parecida em “Luccas” e
“Luca”." / "Mesmo nome, com outros acentos, partículas ou sufixos."), para que o
voluntário decida em vez de adivinhar.

### Dependências de desenvolvimento

Entrou **`vitest`** (devDependency, fixado em `4.1.11`) com `npm test` /
`npm run test:watch`. Dois detalhes de instalação que valem o registro:

- `vitest@5` exige `@types/node` ^22 ou ≥24, e o projeto está em `^20` — por isso a
  linha 4.x, que aceita `^20`;
- o npm 10.9.8 trava num bug do arborist (`Cannot read properties of null (reading
  'edgesOut')`) ao resolver os peers opcionais do Vitest; a instalação precisa de
  `npm install --legacy-peer-deps`.

### O que ficou de fora (candidatos a uma próxima rodada)

- **Apelidos e formas curtas**: `Beth` × `Elizabeth`, `Ana Maria` × `Ana Maria do
  Carmo`. Nenhuma regra ortográfica resolve — precisaria de uma tabela de apelidos;
- **CPF / data de nascimento** como chave de deduplicação (seção 9), que é o que de fato
  encerra o assunto;
- **`pg_trgm` como funil** no backend (seção 8), se a tabela crescer;
- a decisão de subir `engines.node` (Node 20 está EOL desde abril/2026 e a Vercel o
  desliga em 1º/out/2026), que destravaria o `vitest@5` e o `rapidfuzz-js`.

## Apêndice A — conjunto rotulado

**Deveria apontar como possível duplicado (23):**

```
Luccas Silva            × Luca Silva                       (pedido do usuário)
João Silva              × Joao da Silva
Maria Aparecida Souza   × Maria Aparecida de Souza
José Carlos Pereira     × Jose Carlos Pereira              (acentos)
Francisco Oliveira      × Francisco de Oliveira
Ana Beatriz Nogueira    × Ana Beatriz Nogreira             (vogal por consoante)
Carlos Eduardo Santos   × Carlos Eduardo dos Santos
Márcia Regina Lima      × Marcia Regina de Lima
Wagner Souza            × Vagner Souza                     (W/V)
Joao Batista Ferreira   × João Batista Ferreira Júnior     (sufixo)
Reginaldo Assunção      × Reginaldo Assuncão
Kleber Andrade          × Cleber Andrade                   (K/C)
Marcos Sousa            × Marcos Souza                     (Z/S)
Thiago Ribeiro          × Tiago Ribeiro                    (H mudo)
Christiane Lopes        × Cristiane Lopes
Gisele Moraes           × Giselle Moraes                   (consoante dupla)
Luiz Fernando Gomes     × Luis Fernando Gomes
Teresa Batista          × Tereza Batista
Cesar Augusto           × Cezar Augusto
Vanderlei Costa         × Wanderley Costa                  (V/W + Y/I)
Aparecida Ramos         × Apparecida Ramos
Fabrício Nunes          × Fabrizio Nunes                   (C/S + Z/S)
Sônia Peixoto           × Sonja Peixoto                    (vogal por consoante)
```

**Não deveria apontar (22):**

```
João Silva              × Lucas Silva                      (pedido do usuário)
Luccas Silva            × Luca Silveira                    (pedido do usuário)
Ana Paula Ferreira      × Ana Luiza Ferreira
Francisco Oliveira      × Francislei Oliveira
Maria Silva             × José Silva
Pedro Santos            × Paulo Santos
Antonio Pereira         × Antonio Peres
Silvia Ramos            × Silvana Ramos
Marcos Vinicius Almeida × Marcos Aurelio Almeida
Joana Darc Souza        × Joana Souza Lima
Rosangela Costa         × Rosana Costa
Ivanildo Prado          × Ivan Prado
Alessandra Rodrigues    × Alexandra Rodrigues
Rafael Lima             × Rafael Lira                      (distância 1!)
Eduarda Melo            × Eduardo Melo                     (par de gênero)
Mariana Castro          × Mariane Castro
Juliana Prado           × Juliano Prado
Ivan Teixeira           × Ivo Teixeira
Sonia Braga             × Soraia Braga
Renato Aragao           × Renata Aragao
Claudio Nunes           × Claudia Nunes
Marcio Sales            × Marcelo Sales
```

**Ambíguos (6)** — qualquer resposta é defensável; medidos à parte e **fixados em
teste** com a decisão que a regra final tomou:

```
João                    × João Silva                       (nome incompleto)  → diferente
Ana Maria               × Ana Maria do Carmo               (outro sobrenome)  → diferente
Jose Antonio Silva      × Jose A. Silva                    (abreviação)       → parecido
Sebastiana Rocha        × Sebastiao Rocha                  (variante de gênero)→ diferente
Marco Lima              × Marcos Lima                                         → parecido
Beth Souza              × Elizabeth Souza                  (apelido)          → diferente
```

## Apêndice B — referência da estratégia vencedora

Pseudocódigo fiel ao que foi **medido na pesquisa**. A implementação final
(`src/lib/assistido.ts`, seção 11) refinou dois pontos: tokens de mesmo comprimento não
passam pelo indel (só transposição de vizinhas ou troca de vogal por consoante) e o
*fold* inclui `c→s` antes de `e`/`i`. A referência é o código do repositório; isto aqui
é o registro do que foi medido:

```ts
const PARTICLES = new Set(["de","da","do","das","dos","e","del","della","di","du","la","le","van","von","y","d"]);
const GENERATION = new Set(["junior","jr","filho","neto","segundo","terceiro","sobrinho","senior","sr","sra"]);

// "fold" pt-BR: variantes ortográficas recorrentes em nomes
const FOLD: [string, string][] = [
  ["ph","f"], ["y","i"], ["w","v"], ["k","c"], ["z","s"], ["ç","c"],
  ["ss","s"], ["cc","c"], ["rr","r"], ["ll","l"], ["mm","m"], ["nn","n"],
  ["tt","t"], ["pp","p"], ["ff","f"], ["oo","o"], ["ee","e"], ["h",""],
];
// NB: não reduzir "x" (Alexandra ≠ Alessandra) nem "au/al".

const THRESHOLD = 0.86;              // 0,90 se a prioridade for precisão

/** 1 - (inserções + remoções) / (|a| + |b|) — LCS, sem substituição. */
function indelSimilarity(a: string, b: string): number {
  if (!a.length || !b.length) return 0;
  let prev = new Array(b.length + 1).fill(0);
  let cur  = new Array(b.length + 1).fill(0);
  for (let i = 1; i <= a.length; i++) {
    cur[0] = 0;
    for (let j = 1; j <= b.length; j++) {
      cur[j] = a[i - 1] === b[j - 1] ? prev[j - 1] + 1 : Math.max(prev[j], cur[j - 1]);
    }
    [prev, cur] = [cur, prev];
  }
  return (2 * prev[b.length]) / (a.length + b.length);
}

function nameTokens(value: string): string[] {
  return normalizeName(value)                      // já existe em src/lib/assistido.ts
    .split(" ")
    .filter((t) => t && !PARTICLES.has(t) && !GENERATION.has(t))
    .map((t) => FOLD.reduce((s, [from, to]) => s.split(from).join(to), t));
}

function isLikelySamePerson(a: string, b: string): boolean {
  const ta = nameTokens(a), tb = nameTokens(b);
  if (!ta.length || !tb.length) return false;

  // 1. todo nome de `a` precisa de um par em `b` (emparelhamento 1:1, guloso)
  const used = new Array(tb.length).fill(false);
  for (const token of ta) {
    let best = -1, at = -1;
    for (let i = 0; i < tb.length; i++) {
      if (used[i]) continue;
      const score = token === tb[i] ? 1 : indelSimilarity(token, tb[i]);
      if (score > best) { best = score; at = i; }
    }
    if (best < THRESHOLD) return false;            // sobrou um nome sem par
    used[at] = true;
  }

  // 2. primeiro nome e último sobrenome precisam casar explicitamente
  return indelSimilarity(ta[0], tb[0]) >= THRESHOLD
      && indelSimilarity(ta.at(-1)!, tb.at(-1)!) >= THRESHOLD;
}
```

Trocar `indelSimilarity` por `fuzzball.ratio(a, b, { full_process: false }) / 100`
(caminho B) ou por `rapidfuzz-js`'s `indel.normalizedSimilarity` (caminho C) produz o
mesmo resultado — conferimos as três implementações par a par, e também uma versão
escrita à mão: os valores coincidem até a terceira casa decimal.

## Referências

- Código avaliado: `src/lib/assistido.ts` (445–550), `src/app/assistidos/actions.ts`
  (40–81), `src/app/assistidos/novo/new-assistido-flow.tsx` (40–200).
- Supabase, *Postgres Extensions Overview* — `pg_trgm`, `fuzzystrmatch`, `unaccent`,
  `vector` disponíveis: https://supabase.com/docs/guides/database/extensions
- PostgreSQL, *pg_trgm* / *fuzzystrmatch*: https://www.postgresql.org/docs/current/pgtrgm.html
- Vercel, *Supported Node.js versions* (24.x padrão; 20.x descontinuado em 1º/out/2026;
  `engines: ">=20.0.0"` sobe para 24.x): https://vercel.com/docs/functions/runtimes/node-js/node-js-versions
- `fuzzball.js` (port de fuzzywuzzy/RapidFuzz): https://github.com/nol13/fuzzball.js
- RapidFuzz (referência dos algoritmos `ratio`/`token_set_ratio`/`WRatio`):
  https://github.com/rapidfuzz/RapidFuzz
- `rapidfuzz-js`: https://github.com/sarunast/rapidfuzz-js
- `natural`: https://github.com/NaturalNode/natural
- `string-similarity` (arquivado, não usar): https://github.com/aceakash/string-similarity
- Metaphone pt-BR / BuscaBR (fonética brasileira, sem pacote mantido):
  https://sourceforge.net/projects/metaphoneptbr
