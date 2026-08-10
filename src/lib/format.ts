export function formatCurrency(value: number): string {
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

export function formatDate(iso: string): string {
  // parse as local time — new Date(iso) treats a date-only string as UTC
  // midnight, which shifts a day back once formatted in timezones behind UTC
  const d = new Date(`${iso}T00:00:00`);
  return d.toLocaleDateString('pt-BR');
}

export function todayISO(): string {
  // UTC is the app's date source of truth, matching the backend queries and
  // date-only values stored in Postgres.
  const d = new Date();
  const ano = d.getUTCFullYear();
  const mes = String(d.getUTCMonth() + 1).padStart(2, '0');
  const dia = String(d.getUTCDate()).padStart(2, '0');
  return `${ano}-${mes}-${dia}`;
}

/**
 * Aceita o formato de valor monetário em texto livre no padrão BR:
 * "." como separador de milhar e "," como separador decimal (ex: "1.500,00").
 * Os pontos de milhar precisam ser removidos antes de trocar a vírgula por ponto —
 * senão "1.500,00" vira "1.500.00", que Number() não consegue converter (NaN).
 */
export function parseMoney(raw: string): number {
  return Number(raw.trim().replace(/\./g, '').replace(',', '.'));
}

/** Mantém somente dígitos e uma vírgula com até duas casas decimais. */
export function sanitizeMoneyInput(raw: string): string {
  const sanitized = raw.replace(/\./g, '').replace(/[^\d,]/g, '');
  const [integer, ...decimalParts] = sanitized.split(',');
  if (decimalParts.length === 0) return integer;
  return `${integer},${decimalParts.join('').slice(0, 2)}`;
}

/** Mantém somente dígitos em campos de quantidade inteira. */
export function sanitizeIntegerInput(raw: string): string {
  return raw.replace(/\D/g, '');
}
