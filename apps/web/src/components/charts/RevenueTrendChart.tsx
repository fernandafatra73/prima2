import { useCallback, useEffect, useState } from 'react';
import Chart from 'react-apexcharts';
import type { ApexOptions } from 'apexcharts';
import { apiGet } from '../../lib/api.ts';
import { formatRupiah } from '../../lib/format.ts';
import { CHART_COLORS, baseChartOptions } from './chartTheme.ts';

type PendapatanRange = 'harian' | 'mingguan' | 'bulanan' | 'tahunan';

interface PendapatanBucket {
  readonly label: string;
  readonly pendapatan: number;
  readonly keuntungan: number;
}

interface PendapatanResponse {
  readonly range: PendapatanRange;
  readonly series: readonly PendapatanBucket[];
  readonly totalPendapatan: number;
  readonly totalKeuntungan: number;
}

const RANGE_OPTIONS: { readonly id: PendapatanRange; readonly label: string }[] = [
  { id: 'harian', label: 'Harian' },
  { id: 'mingguan', label: 'Mingguan' },
  { id: 'bulanan', label: 'Bulanan' },
  { id: 'tahunan', label: 'Tahunan' },
];

function trendOptions(categories: string[]): ApexOptions {
  return {
    ...baseChartOptions(),
    chart: { ...baseChartOptions().chart, type: 'line', height: 320 },
    colors: [CHART_COLORS.primary, CHART_COLORS.success],
    stroke: { width: [2, 2], curve: 'smooth' },
    fill: {
      type: ['gradient', 'solid'],
      gradient: { shadeIntensity: 1, opacityFrom: 0.35, opacityTo: 0.05 },
    },
    xaxis: {
      categories,
      labels: { style: { colors: '#64748b', fontSize: '12px' } },
    },
    yaxis: {
      labels: {
        style: { colors: '#64748b', fontSize: '12px' },
        formatter: (val: number) => (val >= 1_000_000 ? `${(val / 1_000_000).toFixed(1)}jt` : String(Math.round(val))),
      },
    },
    grid: { borderColor: '#e2e8f0', strokeDashArray: 4 },
    tooltip: {
      y: { formatter: (val: number) => formatRupiah(val) },
    },
  };
}

export function RevenueTrendChart() {
  const [range, setRange] = useState<PendapatanRange>('harian');
  const [data, setData] = useState<PendapatanResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (r: PendapatanRange) => {
    setError(null);
    try {
      setData(await apiGet<PendapatanResponse>(`/api/dashboard/pendapatan?range=${r}`));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gagal memuat data pendapatan');
    }
  }, []);

  useEffect(() => {
    void load(range);
  }, [load, range]);

  const categories = (data?.series ?? []).map((b) => b.label);

  return (
    <section className="chart-card">
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.75rem', marginBottom: '1rem' }}>
        <h3 className="chart-card__title" style={{ margin: 0 }}>
          Pendapatan &amp; Keuntungan Pasien
        </h3>
        <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
          {RANGE_OPTIONS.map((opt) => (
            <button
              key={opt.id}
              type="button"
              className={`btn btn--sm ${range === opt.id ? 'btn--primary' : 'btn--ghost'}`}
              style={range === opt.id ? undefined : { border: '1px solid var(--color-border)' }}
              onClick={() => setRange(opt.id)}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {error && <p className="alert alert--error">{error}</p>}

      {data && (
        <div className="page-summary-grid" style={{ marginBottom: '1rem' }}>
          <div className="form-field">
            <span className="form-field__static-label">Total Pendapatan</span>
            <p className="form-field__static-value">{formatRupiah(data.totalPendapatan)}</p>
          </div>
          <div className="form-field">
            <span className="form-field__static-label">Total Keuntungan (setelah sharing)</span>
            <p className="form-field__static-value">{formatRupiah(data.totalKeuntungan)}</p>
          </div>
        </div>
      )}

      <Chart
        type="line"
        height={320}
        options={trendOptions(categories)}
        series={[
          { name: 'Pendapatan', type: 'area', data: (data?.series ?? []).map((b) => b.pendapatan) },
          { name: 'Keuntungan', type: 'line', data: (data?.series ?? []).map((b) => b.keuntungan) },
        ]}
      />
    </section>
  );
}
