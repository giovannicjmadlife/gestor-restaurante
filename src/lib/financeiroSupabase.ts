export type FormaPagamentoBase = "Dinheiro" | "PIX" | "Débito" | "Crédito" | "Correntista";
export type FormaPagamentoVenda = FormaPagamentoBase | "Dividido" | string;

export type PagamentoVenda = {
  id?: string;
  forma: FormaPagamentoBase | string;
  valorPago: number;
  taxaPercentual?: number;
  taxaDescontada?: number;
  valorTaxa?: number;
  valorLiquido?: number;
};

export type ItemVendaResumo = {
  id?: string;
  produtoId?: string;
  nome: string;
  quantidade: number;
  precoUnitario: number;
  total: number;
};

export type Colaborador = {
  id: string;
  nome: string;
  percentualComissao: number;
  ativo: boolean;
  telefone?: string;
  observacoes?: string;
  salarioMensal?: number;
  diaPagamento?: number;
  funcao?: string;
  criadoEm?: string;
  atualizadoEm?: string;
};

export type RegistroFinanceiro = Record<string, any>;

export type TipoTaxaFinanceira = "Percentual" | "Valor fixo" | string;

export type TaxaFinanceira = {
  id?: string;
  categoria?: "maquininha" | "delivery" | "entrega" | string;
  nome?: string;
  tipo?: TipoTaxaFinanceira;
  valor?: number | string;
  percentual?: number | string;
  taxa?: number | string;
  porcentagem?: number | string;
  ativo?: boolean;
};

export type TaxasFinanceirasPayload = {
  maquininhas: TaxaFinanceira[];
  delivery: TaxaFinanceira[];
  entrega: TaxaFinanceira | null;
  todas: TaxaFinanceira[];
};

export const LS_ENTRADAS = "gestor-restaurante-entradas";
export const LS_SAIDAS = "gestor-restaurante-saidas";
export const LS_CONTAS_RECEBER = "gestor-restaurante-contas-receber";
export const LS_FOLHA = "gestor-restaurante-folha-pagamento";
export const LS_INVESTIMENTOS = "gestor-restaurante-investimentos";
export const LS_VENDAS_DETALHADAS = "gestor-restaurante-vendas-detalhadas";
export const LS_COLABORADORES = "gestor-restaurante-colaboradores";

export function normalizarTexto(valor: unknown) {
  return String(valor || "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

export function numeroSeguro(valor: unknown) {
  if (typeof valor === "number") {
    return Number.isFinite(valor) ? valor : 0;
  }

  if (typeof valor === "string") {
    let texto = valor
      .replace("R$", "")
      .replace(/\s/g, "")
      .replace(/[^\d,.-]/g, "");

    if (texto.includes(",") && texto.includes(".")) {
      texto = texto.replace(/\./g, "").replace(",", ".");
    } else if (texto.includes(",")) {
      texto = texto.replace(",", ".");
    }

    const numero = Number(texto);
    return Number.isFinite(numero) ? numero : 0;
  }

  return 0;
}

export function arredondar2(valor: number) {
  return Number((valor || 0).toFixed(2));
}

export function formatarMoeda(valor: number) {
  return valor.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

export function hojeISO() {
  const agora = new Date();
  const ano = agora.getFullYear();
  const mes = String(agora.getMonth() + 1).padStart(2, "0");
  const dia = String(agora.getDate()).padStart(2, "0");

  return `${ano}-${mes}-${dia}`;
}

export function mesAtualISO() {
  return hojeISO().slice(0, 7);
}

export function anoAtualISO() {
  return hojeISO().slice(0, 4);
}

export function lerArrayLocalStorage<T = RegistroFinanceiro>(chave: string): T[] {
  if (typeof window === "undefined") return [];

  try {
    const dados = localStorage.getItem(chave);
    if (!dados) return [];

    const parsed = JSON.parse(dados);
    return Array.isArray(parsed) ? (parsed as T[]) : [];
  } catch {
    return [];
  }
}

export function salvarArrayLocalStorage<T>(chave: string, dados: T[]) {
  if (typeof window === "undefined") return;
  localStorage.setItem(chave, JSON.stringify(dados));
}

export function dataDoRegistro(registro: RegistroFinanceiro) {
  const data = String(registro.data || "");
  if (data.length >= 10) return data.slice(0, 10);

  const dataHora = String(
    registro.dataHora || registro.criadoEm || registro.createdAt || registro.created_at || ""
  );

  if (dataHora.length >= 10) return dataHora.slice(0, 10);

  return hojeISO();
}

export function registroEstaNoDia(registro: RegistroFinanceiro, dia = hojeISO()) {
  return dataDoRegistro(registro) === dia;
}

export function registroEstaNoMes(registro: RegistroFinanceiro, mes = mesAtualISO()) {
  return dataDoRegistro(registro).slice(0, 7) === mes;
}

export function registroEstaNoAno(registro: RegistroFinanceiro, ano = anoAtualISO()) {
  return dataDoRegistro(registro).slice(0, 4) === ano;
}

export function registroEstaNoPeriodo(
  registro: RegistroFinanceiro,
  filtro: { tipo: "dia" | "mes" | "ano" | "todos"; dia?: string; mes?: string; ano?: string }
) {
  if (filtro.tipo === "todos") return true;
  if (filtro.tipo === "dia") return registroEstaNoDia(registro, filtro.dia || hojeISO());
  if (filtro.tipo === "mes") return registroEstaNoMes(registro, filtro.mes || mesAtualISO());
  return registroEstaNoAno(registro, filtro.ano || anoAtualISO());
}

export function formaPagamentoNormalizada(forma: unknown) {
  const texto = normalizarTexto(forma);

  if (texto.includes("dinheiro")) return "Dinheiro";
  if (texto.includes("pix")) return "PIX";
  if (texto.includes("debito")) return "Débito";
  if (texto.includes("credito")) return "Crédito";
  if (texto.includes("correntista") || texto.includes("fiado") || texto.includes("conta")) {
    return "Correntista";
  }
  if (texto.includes("dividido") || texto.includes("misto")) return "Dividido";

  return String(forma || "Não informado");
}

export function valorDaTaxaCadastro(taxa: TaxaFinanceira | null | undefined) {
  if (!taxa || taxa.ativo === false) return 0;

  return (
    numeroSeguro(taxa.valor) ||
    numeroSeguro(taxa.percentual) ||
    numeroSeguro(taxa.taxa) ||
    numeroSeguro(taxa.porcentagem)
  );
}

export function calcularValorTaxaCadastroFinanceiro(
  valorBase: number,
  taxa: TaxaFinanceira | null | undefined
) {
  const valorTaxaCadastro = valorDaTaxaCadastro(taxa);
  if (!taxa || valorBase <= 0 || valorTaxaCadastro <= 0) return 0;

  const tipo = normalizarTexto(taxa.tipo || "Percentual");
  if (tipo.includes("fixo") || tipo.includes("valor")) {
    return arredondar2(valorTaxaCadastro);
  }

  return arredondar2((valorBase * valorTaxaCadastro) / 100);
}

export function buscarTaxaMaquininhaPorForma(
  forma: unknown,
  taxasMaquininhas: TaxaFinanceira[] = []
) {
  const formaNormalizada = formaPagamentoNormalizada(forma);

  if (
    formaNormalizada === "Dinheiro" ||
    formaNormalizada === "Correntista" ||
    formaNormalizada === "Dividido"
  ) {
    return null;
  }

  const alvo =
    formaNormalizada === "Crédito"
      ? ["credito", "crédito", "cartao credito", "cartão crédito"]
      : formaNormalizada === "Débito"
        ? ["debito", "débito", "cartao debito", "cartão débito"]
        : ["pix"];

  return (
    taxasMaquininhas.find((taxa) => {
      if (!taxa || taxa.ativo === false) return false;
      const texto = normalizarTexto(
        [taxa.nome, taxa.categoria, taxa.tipo, taxa.valor, taxa.percentual, taxa.taxa, taxa.porcentagem].join(" ")
      );
      return alvo.some((palavra) => texto.includes(normalizarTexto(palavra)));
    }) || null
  );
}

export function registroEhDelivery(registro: RegistroFinanceiro) {
  const texto = normalizarTexto(
    [
      registro.atendimentoTipo,
      registro.atendimento_tipo,
      registro.tipoVenda,
      registro.tipo_venda,
      registro.categoria,
      registro.origem,
      registro.descricao,
      registro.canal,
      registro.delivery,
    ].join(" ")
  );

  return texto.includes("delivery") || texto.includes("ifood") || texto.includes("aiqfome");
}

export function taxaRegistroComCadastro(
  registro: RegistroFinanceiro,
  taxasMaquininhas: TaxaFinanceira[] = [],
  taxasDelivery: TaxaFinanceira[] = []
) {
  const taxaJaSalva = taxaRegistro(registro);
  if (taxaJaSalva > 0) return taxaJaSalva;

  const pagamentos = pagamentosDoRegistro(registro);
  const bruto = valorBrutoRegistro(registro);

  let taxaMaquininha = 0;

  if (pagamentos.length > 1) {
    taxaMaquininha = pagamentos.reduce((total, pagamento) => {
      const taxa = buscarTaxaMaquininhaPorForma(pagamento.forma, taxasMaquininhas);
      return total + calcularValorTaxaCadastroFinanceiro(numeroSeguro(pagamento.valorPago), taxa);
    }, 0);
  } else {
    const forma =
      pagamentos[0]?.forma ||
      registro.formaPagamento ||
      registro.formaRecebimento ||
      registro.forma;
    const taxa = buscarTaxaMaquininhaPorForma(forma, taxasMaquininhas);
    taxaMaquininha = calcularValorTaxaCadastroFinanceiro(bruto, taxa);
  }

  const taxaDelivery = registroEhDelivery(registro)
    ? calcularValorTaxaCadastroFinanceiro(bruto, taxasDelivery.find((taxa) => taxa.ativo !== false) || null)
    : 0;

  return arredondar2(taxaMaquininha + taxaDelivery);
}

export function valorLiquidoRegistroComCadastro(
  registro: RegistroFinanceiro,
  taxasMaquininhas: TaxaFinanceira[] = [],
  taxasDelivery: TaxaFinanceira[] = []
) {
  const taxa = taxaRegistroComCadastro(registro, taxasMaquininhas, taxasDelivery);
  return arredondar2(valorBrutoRegistro(registro) - taxa);
}

export async function buscarTaxasSupabase(): Promise<TaxasFinanceirasPayload> {
  const resposta = await fetch('/api/taxas', {
    method: 'GET',
    cache: 'no-store',
  });

  if (!resposta.ok) {
    const detalhe = await resposta.text().catch(() => '');
    throw new Error(detalhe || 'Erro ao buscar taxas no Supabase.');
  }

  const dados = await resposta.json();

  return {
    maquininhas: Array.isArray(dados.maquininhas) ? dados.maquininhas : [],
    delivery: Array.isArray(dados.delivery) ? dados.delivery : [],
    entrega: dados.entrega || null,
    todas: Array.isArray(dados.todas) ? dados.todas : [],
  };
}

export function valorBrutoRegistro(registro: RegistroFinanceiro) {
  return arredondar2(
    numeroSeguro(registro.valorBruto) ||
      numeroSeguro(registro.valorCobrado) ||
      numeroSeguro(registro.valorOriginal) ||
      numeroSeguro(registro.subtotalItens) ||
      numeroSeguro(registro.valor)
  );
}

export function descontoRegistro(registro: RegistroFinanceiro) {
  return arredondar2(numeroSeguro(registro.descontoValor) || numeroSeguro(registro.desconto));
}

export function pagamentosDoRegistro(registro: RegistroFinanceiro): PagamentoVenda[] {
  const pagamentosOriginais = Array.isArray(registro.pagamentos)
    ? registro.pagamentos
    : Array.isArray(registro.formasPagamento)
      ? registro.formasPagamento
      : [];

  if (pagamentosOriginais.length > 0) {
    return pagamentosOriginais
      .map((pagamento: Record<string, any>) => {
        const valorPago = arredondar2(
          numeroSeguro(pagamento.valorPago) ||
            numeroSeguro(pagamento.valor) ||
            numeroSeguro(pagamento.valorBruto)
        );
        const valorTaxa = arredondar2(
          numeroSeguro(pagamento.valorTaxa) || numeroSeguro(pagamento.taxaDescontada)
        );
        const valorLiquidoInformado = numeroSeguro(pagamento.valorLiquido);

        return {
          id: String(pagamento.id || ""),
          forma: formaPagamentoNormalizada(pagamento.forma || pagamento.formaPagamento),
          valorPago,
          taxaPercentual: numeroSeguro(pagamento.taxaPercentual),
          taxaDescontada: valorTaxa,
          valorTaxa,
          valorLiquido:
            valorLiquidoInformado > 0
              ? arredondar2(valorLiquidoInformado)
              : arredondar2(valorPago - valorTaxa),
        };
      })
      .filter((pagamento) => pagamento.valorPago > 0);
  }

  const valorPago = valorBrutoRegistro(registro);
  const valorTaxa = arredondar2(
    numeroSeguro(registro.taxaDescontada) + numeroSeguro(registro.taxaDeliveryDescontada)
  );
  const valorLiquidoInformado = numeroSeguro(registro.valorLiquido);

  return [
    {
      forma: formaPagamentoNormalizada(
        registro.formaPagamento || registro.formaRecebimento || registro.forma
      ),
      valorPago,
      taxaPercentual: numeroSeguro(registro.taxaPercentual),
      taxaDescontada: valorTaxa,
      valorTaxa,
      valorLiquido:
        valorLiquidoInformado > 0
          ? arredondar2(valorLiquidoInformado)
          : arredondar2(valorPago - valorTaxa),
    },
  ].filter((pagamento) => pagamento.valorPago > 0);
}

export function taxaRegistro(registro: RegistroFinanceiro) {
  const taxaPagamentos = pagamentosDoRegistro(registro).reduce(
    (total, pagamento) => total + numeroSeguro(pagamento.valorTaxa),
    0
  );

  const taxaSalva =
    numeroSeguro(registro.taxaDescontada) ||
    numeroSeguro(registro.valorTaxas) ||
    numeroSeguro(registro.valor_taxas) ||
    arredondar2(
      numeroSeguro(registro.taxaMaquininhaDescontada) +
        numeroSeguro(registro.taxaDeliveryDescontada)
    );

  if (taxaSalva > 0 || taxaPagamentos > 0) {
    return arredondar2(Math.max(taxaSalva, taxaPagamentos));
  }

  const bruto = valorBrutoRegistro(registro);
  const liquido = numeroSeguro(registro.valorLiquido);

  if (bruto > 0 && liquido > 0 && bruto > liquido) {
    return arredondar2(bruto - liquido);
  }

  return 0;
}

export function valorLiquidoRegistro(registro: RegistroFinanceiro) {
  const pagamentos = pagamentosDoRegistro(registro);

  if (pagamentos.length > 1) {
    return arredondar2(
      pagamentos.reduce((total, pagamento) => total + numeroSeguro(pagamento.valorLiquido), 0)
    );
  }

  const liquido = numeroSeguro(registro.valorLiquido);
  if (liquido > 0) return arredondar2(liquido);

  return arredondar2(valorBrutoRegistro(registro) - taxaRegistro(registro));
}

export function formaResumoRegistro(registro: RegistroFinanceiro) {
  const pagamentos = pagamentosDoRegistro(registro);

  if (pagamentos.length > 1) {
    return "Pagamento dividido";
  }

  return pagamentos[0]?.forma || "Não informado";
}

export function itensDoRegistro(registro: RegistroFinanceiro): ItemVendaResumo[] {
  const itensOriginais = Array.isArray(registro.itens) ? registro.itens : [];

  return itensOriginais
    .map((item: Record<string, any>, index: number) => {
      const quantidade = numeroSeguro(item.quantidade) || 1;
      const precoUnitario = numeroSeguro(item.precoUnitario) || numeroSeguro(item.preco) || 0;
      const total = numeroSeguro(item.total) || quantidade * precoUnitario;

      return {
        id: String(item.id || `item-${index}`),
        produtoId: String(item.produtoId || item.id || ""),
        nome: String(item.nome || item.descricao || "Produto sem nome"),
        quantidade,
        precoUnitario,
        total: arredondar2(total),
      };
    })
    .filter((item) => item.nome && item.total > 0);
}

export function vendaFinalizada(registro: RegistroFinanceiro) {
  const status = normalizarTexto(registro.status || "Finalizado");
  if (status.includes("cancelado")) return false;
  if (status.includes("abertura")) return false;
  if (status.includes("fechamento")) return false;
  if (status.includes("sangria")) return false;
  if (status.includes("refor")) return false;
  return true;
}

export function descricaoFiltroPeriodo(tipo: "dia" | "mes" | "ano" | "todos", valor: string) {
  if (tipo === "dia") return valor.split("-").reverse().join("/");
  if (tipo === "mes") {
    const [ano, mes] = valor.split("-");
    return `${mes}/${ano}`;
  }
  if (tipo === "ano") return valor;
  return "todos os registros";
}

export type FinanceiroPayloadSupabase = {
  entradas?: RegistroFinanceiro[];
  vendasDetalhadas?: RegistroFinanceiro[];
  saidas?: RegistroFinanceiro[];
  contasReceber?: RegistroFinanceiro[];
  folhaPagamento?: RegistroFinanceiro[];
  investimentos?: RegistroFinanceiro[];
  colaboradores?: Colaborador[];
};

export function deduplicarPorId<T extends Record<string, any>>(lista: T[]) {
  const mapa = new Map<string, T>();

  lista.forEach((item, index) => {
    const id = String(item?.id || `sem-id-${index}`);
    if (!mapa.has(id)) mapa.set(id, item);
  });

  return Array.from(mapa.values());
}

export async function buscarFinanceiroSupabase(): Promise<FinanceiroPayloadSupabase> {
  const resposta = await fetch('/api/financeiro', {
    method: 'GET',
    cache: 'no-store',
  });

  if (!resposta.ok) {
    const detalhe = await resposta.text().catch(() => '');
    throw new Error(detalhe || 'Erro ao buscar financeiro no Supabase.');
  }

  return resposta.json();
}

export async function salvarVendaFinanceiroSupabase(payload: {
  entrada?: RegistroFinanceiro;
  vendaDetalhada?: RegistroFinanceiro;
  contaReceber?: RegistroFinanceiro | null;
}) {
  const resposta = await fetch('/api/financeiro', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  if (!resposta.ok) {
    const detalhe = await resposta.text().catch(() => '');
    throw new Error(detalhe || 'Erro ao salvar venda no Supabase.');
  }

  return resposta.json();
}

export async function importarFinanceiroLocalParaSupabase() {
  if (typeof window === 'undefined') return { ok: false, ignorado: true };

  const payload = {
    importarLocal: true,
    entradas: lerArrayLocalStorage<RegistroFinanceiro>(LS_ENTRADAS),
    vendasDetalhadas: lerArrayLocalStorage<RegistroFinanceiro>(LS_VENDAS_DETALHADAS),
    saidas: lerArrayLocalStorage<RegistroFinanceiro>(LS_SAIDAS),
    contasReceber: lerArrayLocalStorage<RegistroFinanceiro>(LS_CONTAS_RECEBER),
    folhaPagamento: lerArrayLocalStorage<RegistroFinanceiro>(LS_FOLHA),
    investimentos: lerArrayLocalStorage<RegistroFinanceiro>(LS_INVESTIMENTOS),
    colaboradores: lerArrayLocalStorage<Colaborador>(LS_COLABORADORES),
  };

  const total =
    payload.entradas.length +
    payload.vendasDetalhadas.length +
    payload.saidas.length +
    payload.contasReceber.length +
    payload.folhaPagamento.length +
    payload.investimentos.length +
    payload.colaboradores.length;

  if (total === 0) return { ok: true, total: 0 };

  const resposta = await fetch('/api/financeiro', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  if (!resposta.ok) {
    const detalhe = await resposta.text().catch(() => '');
    throw new Error(detalhe || 'Erro ao importar dados locais para o Supabase.');
  }

  return resposta.json();
}

export async function salvarFinanceiroSupabase(payload: FinanceiroPayloadSupabase & {
  entrada?: RegistroFinanceiro;
  vendaDetalhada?: RegistroFinanceiro;
  saida?: RegistroFinanceiro;
  contaReceber?: RegistroFinanceiro | null;
  folha?: RegistroFinanceiro;
  investimento?: RegistroFinanceiro;
}) {
  const resposta = await fetch('/api/financeiro', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  if (!resposta.ok) {
    const detalhe = await resposta.text().catch(() => '');
    throw new Error(detalhe || 'Erro ao salvar financeiro no Supabase.');
  }

  return resposta.json();
}

export async function removerLancamentoFinanceiroSupabase(tipo: string, id: string) {
  const resposta = await fetch('/api/financeiro', {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ tipo, id }),
  });

  if (!resposta.ok) {
    const detalhe = await resposta.text().catch(() => '');
    throw new Error(detalhe || 'Erro ao remover lançamento no Supabase.');
  }

  return resposta.json();
}

export async function buscarColaboradoresSupabase(): Promise<Colaborador[]> {
  const resposta = await fetch('/api/colaboradores', { cache: 'no-store' });

  if (!resposta.ok) {
    const detalhe = await resposta.text().catch(() => '');
    throw new Error(detalhe || 'Erro ao buscar colaboradores no Supabase.');
  }

  const dados = await resposta.json();
  return Array.isArray(dados) ? dados : dados.colaboradores || [];
}

export async function salvarColaboradoresSupabase(colaboradores: Colaborador[]) {
  const resposta = await fetch('/api/colaboradores', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ colaboradores }),
  });

  if (!resposta.ok) {
    const detalhe = await resposta.text().catch(() => '');
    throw new Error(detalhe || 'Erro ao salvar colaboradores no Supabase.');
  }

  return resposta.json();
}
