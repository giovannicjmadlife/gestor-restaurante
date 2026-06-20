"use client";

function formatarDataFiltro(data: string) {
  if (!data) return "";
  const [ano, mes, dia] = data.split("-");
  if (!ano || !mes || !dia) return data;
  return `${dia}/${mes}/${ano}`;
}

export function dataNoPeriodo(
  data: string,
  dataInicial: string,
  dataFinal: string
) {
  const dataNormalizada = String(data || "").slice(0, 10);
  const inicioNormalizado = String(dataInicial || "").slice(0, 10);
  const fimNormalizado = String(dataFinal || "").slice(0, 10);

  // A tela permanece vazia até as duas datas serem escolhidas.
  if (!dataNormalizada || !inicioNormalizado || !fimNormalizado) return false;

  // Intervalo inválido também não carrega registros.
  if (inicioNormalizado > fimNormalizado) return false;

  // Datas ISO (AAAA-MM-DD) podem ser comparadas diretamente.
  return dataNormalizada >= inicioNormalizado && dataNormalizada <= fimNormalizado;
}

export function descricaoPeriodo(dataInicial: string, dataFinal: string) {
  if (!dataInicial || !dataFinal) return "nenhum período selecionado";
  if (dataInicial > dataFinal) return "intervalo inválido";
  return `${formatarDataFiltro(dataInicial)} até ${formatarDataFiltro(dataFinal)}`;
}

type Props = {
  dataInicial: string;
  dataFinal: string;
  onDataInicialChange: (data: string) => void;
  onDataFinalChange: (data: string) => void;
  titulo?: string;
  descricao?: string;
};

export default function FinancePeriodFilter({
  dataInicial,
  dataFinal,
  onDataInicialChange,
  onDataFinalChange,
  titulo = "Consultar por período",
  descricao = "Selecione a data inicial e a data final para carregar os lançamentos.",
}: Props) {
  const intervaloCompleto = Boolean(dataInicial && dataFinal);
  const intervaloInvalido = intervaloCompleto && dataInicial > dataFinal;

  let descricaoExibida = descricao;
  if (!dataInicial && !dataFinal) {
    descricaoExibida =
      "A tela permanece limpa. Selecione a data inicial e a data final para carregar os registros.";
  } else if (!dataInicial) {
    descricaoExibida = "Selecione a data inicial do período.";
  } else if (!dataFinal) {
    descricaoExibida = "Selecione a data final do período.";
  } else if (intervaloInvalido) {
    descricaoExibida = "A data final não pode ser anterior à data inicial.";
  }

  function limparPeriodo() {
    onDataInicialChange("");
    onDataFinalChange("");
  }

  return (
    <div className="mb-8 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h2 className="text-xl font-bold text-slate-950">{titulo}</h2>
          <p
            className={`mt-1 text-sm ${
              intervaloInvalido ? "font-semibold text-red-600" : "text-slate-500"
            }`}
          >
            {descricaoExibida}
          </p>

          {intervaloCompleto && !intervaloInvalido && (
            <p className="mt-3 inline-flex rounded-full bg-orange-50 px-3 py-1.5 text-xs font-black text-orange-700">
              Exibindo de {formatarDataFiltro(dataInicial)} até {formatarDataFiltro(dataFinal)}
            </p>
          )}
        </div>

        <div className="flex w-full flex-col gap-3 sm:flex-row lg:w-auto lg:items-end">
          <label className="w-full text-sm font-semibold text-slate-700 sm:min-w-[190px]">
            De
            <input
              type="date"
              value={dataInicial}
              max={dataFinal || undefined}
              onChange={(event) => onDataInicialChange(event.target.value)}
              className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm font-bold outline-none focus:border-orange-500 focus:ring-4 focus:ring-orange-100"
            />
          </label>

          <label className="w-full text-sm font-semibold text-slate-700 sm:min-w-[190px]">
            Até
            <input
              type="date"
              value={dataFinal}
              min={dataInicial || undefined}
              onChange={(event) => onDataFinalChange(event.target.value)}
              className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm font-bold outline-none focus:border-orange-500 focus:ring-4 focus:ring-orange-100"
            />
          </label>

          <button
            type="button"
            onClick={limparPeriodo}
            disabled={!dataInicial && !dataFinal}
            className="rounded-xl border border-slate-200 px-4 py-3 text-sm font-black text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
          >
            Limpar
          </button>
        </div>
      </div>
    </div>
  );
}
