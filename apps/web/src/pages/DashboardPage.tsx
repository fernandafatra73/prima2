import { useCallback, useEffect, useState } from 'react';
import { DashboardCharts } from '../components/charts/DashboardCharts.tsx';
import { RevenueTrendChart } from '../components/charts/RevenueTrendChart.tsx';
import { useListRefresh } from '../context/ListRefreshContext.tsx';
import { apiGet } from '../lib/api.ts';

interface DashboardResponse {
  readonly metrics: {
    readonly pasienHariIni: number;
    readonly menungguHasil: number;
    readonly selesaiHariIni: number;
    readonly totalPemeriksaan: number;
    readonly omzetHariIni: number;
    readonly totalSharingHariIni: number;
    readonly dokterPengirim: number;
    readonly radiologAktif: number;
  };
  readonly charts: {
    readonly statusHasil: { readonly menunggu: number; readonly selesai: number; readonly percent: number };
    readonly statusBayar: { readonly lunas: number; readonly belum: number; readonly percent: number };
  };
}

export function DashboardPage() {
  const { version: listRefreshVersion } = useListRefresh();
  const [data, setData] = useState<DashboardResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      setData(await apiGet<DashboardResponse>(`/api/dashboard?_=${Date.now()}`));
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Gagal memuat dashboard');
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load, listRefreshVersion]);

  const m = data?.metrics;
  const charts = data?.charts;

  const metrics = m
    ? [
        { label: 'Pasien Hari Ini', value: String(m.pasienHariIni) },
        { label: 'Menunggu Hasil', value: String(m.menungguHasil) },
        { label: 'Selesai Hari Ini', value: String(m.selesaiHariIni) },
        { label: 'Total Pemeriksaan', value: String(m.totalPemeriksaan) },
      ]
    : [];

  return (
    <>
      <div className="page-heading">
        <h2 className="page-heading__title">Dashboard</h2>
        <div className="dashboard-marquee" aria-hidden="true">
          <span className="dashboard-marquee__text">
            Klinik Prima Husada — Jl. Siliwangi Ruko Palapa No 2 Parung Kuda. Telp 0857-1932-5557
          </span>
        </div>
      </div>

      {error && <p className="alert alert--error">{error}</p>}
      {!data && !error && <p className="loading-text">Memuat data…</p>}

      {data && m && charts && (
        <>
          <div className="metric-grid">
            {metrics.map((metric) => (
              <article key={metric.label} className="metric-card">
                <p className="metric-card__label">{metric.label}</p>
                <p className="metric-card__value">{metric.value}</p>
              </article>
            ))}
          </div>

          <DashboardCharts
            statusHasil={charts.statusHasil}
            statusBayar={charts.statusBayar}
            omzetHariIni={m.omzetHariIni}
            totalSharingHariIni={m.totalSharingHariIni}
            pasienHariIni={m.pasienHariIni}
            menungguHasil={m.menungguHasil}
            selesaiHariIni={m.selesaiHariIni}
            totalPemeriksaan={m.totalPemeriksaan}
          />

          <RevenueTrendChart />
        </>
      )}
    </>
  );
}
