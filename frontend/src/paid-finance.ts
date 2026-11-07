export const sites = ['centrale', 'succursale'] as const;
export const campusName = (site: string) => site === 'centrale' ? 'Centrale' : 'Succursale';
export const euro = (cents: number) => (cents / 100).toLocaleString('it-IT', { style: 'currency', currency: 'EUR' });
export type FinancialTotal = { cost: number; unpriced: number; budget: number | null; remaining: number | null; percent: number | null };
export type FinanceSummary = { sites: Record<string, FinancialTotal>; configured: string[]; overall: FinancialTotal | null; all: FinancialTotal };
export type PayClass = 'laureato' | 'diplomato';
export type FinancialConfig = { sites: Record<string, { budget: number | null; laureato: number | null; diplomato: number | null }>; overrides: Record<string, PayClass> };
export function parseEuro(text: string): number | null {
  const value = text.trim();
  if (!value) return null;
  // Accept Italian grouping only with a decimal comma; a bare dot is decimal.
  const normalized = value.includes(',') ? value.replace(/\./g, '').replace(',', '.') : value;
  if (value.includes(',') && !/^(?:\d+|\d{1,3}(?:\.\d{3})+)(?:,\d{1,2})?$/.test(value) || !/^\d+(?:\.\d{1,2})?$/.test(normalized)) throw new Error('Inserisci un importo non negativo con massimo due decimali.');
  const [whole, fraction = ''] = normalized.split('.');
  const result = Number(whole) * 100 + Number(fraction.padEnd(2, '0'));
  if (!Number.isSafeInteger(result) || result > 999999999999) throw new Error('Importo troppo grande.');
  return result;
}
export const amountInput = (cents: number | null) => cents === null ? '' : `${Math.floor(cents / 100)},${String(cents % 100).padStart(2, '0')}`;
