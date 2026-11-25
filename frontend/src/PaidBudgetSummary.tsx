import { campusName, euro, sites, type FinanceSummary, type FinancialTotal } from './paid-finance';

function Total({ title, value }: { title: string; value: FinancialTotal }) {
  return <div className="paid-budget-total"><h3>{title}</h3><p><strong>{euro(value.cost)}</strong> impegnati{value.unpriced > 0 ? ' · totale parziale' : ''}</p>
    {value.unpriced > 0 && <p className="ui-notice" role="status">{value.unpriced} ore da valorizzare</p>}
    {value.budget === null ? <p>Budget non configurato</p> : <><p>Budget {euro(value.budget)} · <strong>{value.percent === null ? 'Percentuale non disponibile (budget zero)' : `${value.percent.toLocaleString('it-IT', { maximumFractionDigits: 2 })}% utilizzato`}</strong></p>
      {value.percent !== null && <progress aria-label={`Budget utilizzato · ${title}`} max={100} value={Math.min(100, value.percent)} />}
      <p>{value.remaining !== null && value.remaining < 0 ? <strong>Superato di {euro(-value.remaining)}</strong> : `Residuo ${euro(value.remaining || 0)}`}</p></>}
  </div>;
}
export function PaidBudgetSummary({ finance, site = 'both' }: { finance: FinanceSummary; site?: string }) {
  return <section className="paid-budgets" aria-label="Budget supplenze a pagamento"><h2>Budget supplenze a pagamento</h2>
    <p>Tutte le ore registrate, anche future, indipendentemente dalla settimana visualizzata.</p>
    <div className="paid-budget-grid">{sites.filter(s => site === 'both' || site === s).map(s => <Total key={s} title={campusName(s)} value={finance.sites[s]} />)}
      {site === 'both' && finance.overall && <Total title={finance.configured.length === 2 ? 'Totale sedi' : `Solo budget configurati · ${finance.configured.map(campusName).join(', ')}`} value={finance.overall} />}
    </div>
    {site === 'both' && <p>Totale tutte le sedi: <strong>{euro(finance.all.cost)}</strong> impegnati{finance.all.unpriced > 0 && ` · totale parziale, ${finance.all.unpriced} ore da valorizzare`}.{finance.configured.length === 1 && ' La percentuale complessiva esclude la sede senza budget.'}</p>}
  </section>;
}
