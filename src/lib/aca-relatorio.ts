/**
 * Acolher com Amor — relatórios das sessões.
 *
 * Cada sessão (`aca_sessao`) pode ter um relatório (`aca_relatorio`) com
 * o dirigente, o ponte e as observações da sessão. Procedimentos são
 * parte da sessão e portanto aparecem também na lista de relatórios
 * para consulta.
 *
 * O relatório carrega ainda o que o cadastro registrou do assistido
 * (distonia, queixas e observações): a tela do relatório é lida sem que
 * o voluntário precise abrir a tela do assistido para entender o caso.
 */

/** Um relatório como aparece na lista e na tela de detalhe. */
export interface AcaRelatorio {
  id: number;
  sessaoId: number;
  /** Data da sessão, em ISO. */
  data: string;
  /** Nome completo do assistido atendido. */
  assistidoNome: string;
  /** ID do assistido, para abrir o detalhe dele quando preciso. */
  assistidoId: number;
  /**
   * Tratamentos do assistido (todos os setores), como "Setor — Horário".
   * As telas do Acolher com Amor os chamam de "assistências".
   */
  tratamentos: string[];
  /** Distonia relatada no cadastro do tratamento. */
  distonia: string | null;
  /** Principais queixas do cadastro, em ordem alfabética. */
  queixas: string[];
  /** Observações do cadastro, escritas pelo Atendimento Fraterno. */
  obsCadastro: string | null;
  /** Procedimentos realizados na sessão, em ordem alfabética. */
  procedimentos: string[];
  /** Nome do dirigente (voluntário que conduziu). */
  dirigenteNome: string;
  /** Nome do ponte (médium). */
  ponteNome: string;
  /** Observações livres da sessão. */
  obs: string | null;
}
