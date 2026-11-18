import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { StatCard, StatCards } from '../shared/page';
import { fetchCashFlow } from '../../utils/storageManager';
import { localDateIso } from '../../utils/dates';
import { formatPeso } from '../../utils/profileFormat';
import { subscribe } from '../../hooks/useSupabaseCollection';

/** Aggregated on the server, including orders outside the dashboard's loaded window. */
export default function CashFlowSummary({ days = 30, version = 0 }) {
  const to = localDateIso();
  const from = new Date(`${to}T00:00:00Z`);
  from.setUTCDate(from.getUTCDate() - days + 1);
  const first = from.toISOString().slice(0, 10);
  const key = `${first}/${to}`;
  const [state, setState] = useState(null);
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    let cancelled = false;
    let request = 0;
    const load = async () => {
      const current = ++request;
      const result = await fetchCashFlow(first, to);
      if (!cancelled && current === request) setState({ key, ...result });
    };
    load();
    const stop = subscribe(load);
    return () => { cancelled = true; stop(); };
  }, [first, to, key, version, retry]);

  const ready = state?.key === key;
  const data = ready && state.ok ? state.data : null;
  return <section aria-label="Recorded cash flow" className="flex min-w-0 flex-col gap-3 rounded-lg border border-border bg-card p-4 shadow-xs">
    <div><h2 className="m-0 text-base font-semibold">Recorded cash flow</h2>
      <p className="m-0 text-sm text-muted-fg">{first} to {to} · Manila dates, including today</p></div>
    {!ready ? <p role="status">Loading recorded cash flow…</p> : !state.ok ? <div role="alert">
      <p>{state.message}</p><Button variant="outline" onClick={() => setRetry((n) => n + 1)}>Retry cash flow</Button>
    </div> : <>
      <StatCards label="Cash flow totals" min={170}>
        {[
          ['Customer collections', data.customer_collections], ['Customer refunds', data.customer_refunds],
          ['Supplier cash payments', data.supplier_payments], ['Supplier cash refunds', data.supplier_refunds],
          ['Card-bill payments', data.card_settlements], ['Net recorded cash movement', data.net_cash],
        ].map(([label, value]) => <StatCard key={label} compact label={label} value={formatPeso(value)} />)}
      </StatCards>
      <dl className="m-0 flex flex-wrap gap-x-8 gap-y-3 text-sm">
        <div><dt className="text-muted-fg">Agreed purchases in this period</dt><dd className="m-0 font-semibold">{formatPeso(data.purchases)}</dd></div>
        <div><dt className="text-muted-fg">Supplier balance still owed · all dates</dt><dd className="m-0 font-semibold">{formatPeso(data.supplier_outstanding)}</dd></div>
        <div><dt className="text-muted-fg">Recorded card balance · all dates</dt><dd className="m-0 font-semibold">{formatPeso(data.card_balance)}{data.card_balance < 0 ? ' credit' : ''}</dd></div>
      </dl>
      {data.undated_refunds > 0 && <p className="m-0 text-sm text-warning-fg">{data.undated_refunds} older customer refund entries have no date and are excluded. Reconcile them before using these totals.</p>}
    </>}
    <p className="m-0 text-sm text-muted-fg">Collections + supplier cash refunds − customer refunds − supplier cash payments − card-bill payments.
      Cash includes recorded bank, GCash and check payments. Card charges are excluded until the card bill is paid.
      Only transactions recorded here are included. These figures are not a bank balance or profit.</p>
  </section>;
}
