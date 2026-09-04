/**
 * Acolher com Amor — relatórios das sessões.
 *
 * Cada sessão (`aca_sessao`) pode ter um relatório (`aca_relatorio`) com
 * o dirigente, o ponte e as observações da sessão. Procedimentos são
 * parte da sessão e portanto aparecem também na lista de relatórios
 * para consulta.
 */

/** Um relatório como aparece na lista e no detalhe. */
export interface AcaRelatorio {
  id: number;
  sessaoId: number;
  /** Data da sessão, em ISO. */
  data: string;
  /** Nome completo do assistido atendido. */
  assistidoNome: string;
  /** ID do assistido, para abrir o detalhe dele quando preciso. */
  assistidoId: number;
  /** Tratamentos do assistido (todos os setores). */
  tratamentos: string[];
  /** Procedimentos realizados na sessão, em ordem alfabética. */
  procedimentos: string[];
  /** Nome do dirigente (voluntário que conduziu). */
  dirigenteNome: string;
  /** Nome do ponte (médium). */
  ponteNome: string;
  /** Observações livres da sessão. */
  obs: string | null;
}
