import { useCallback, useEffect, useState } from 'react';
import { ListPageShell } from '../components/ui/ListPageShell.tsx';
import { Modal } from '../components/ui/Modal.tsx';
import { ModalFormFooter } from '../components/ui/ModalFormFooter.tsx';
import { apiGet, apiPatch } from '../lib/api.ts';
import { formatRupiah } from '../lib/format.ts';
import '../components/ui/ui.css';

interface BulanPajakBulananItem {
  readonly no: number;
  readonly bulan: string;
  readonly jumlahPasien: number;
  readonly harga: number;
  readonly pendapatan: number;
  readonly biayaSewaTempat: number;
  readonly biayaListrikAir: number;
  readonly gajiFernanda: number;
  readonly gajiChalimatusadiah: number;
  readonly gajiRiki: number;
  readonly gajiAgung: number;
  readonly gajiKaryawan1: number;
  readonly gajiKaryawan2: number;
  readonly bahanRoentgen: number;
  readonly peralatanRoentgen: number;
  readonly penyusutanManual: number;
  readonly perbaikanAlat: number;
  readonly totalBebanUsaha: number;
  readonly labaBersih: number;
  readonly hargaPeralatan: number;
  readonly tarifPenyusutanTahunanPersen: number;
  readonly penyusutanPeralatanBulan: number;
  readonly akumulasiPenyusutanAwal: number;
  readonly akumulasiPenyusutanAkhir: number;
  readonly modalAwal: number;
  readonly modalAkhir: number;
  readonly kasAwal: number;
  readonly kasAkhir: number;
  readonly piutangUsaha: number;
  readonly perlengkapan: number;
  readonly utangUsaha: number;
  readonly peralatanNet: number;
  readonly jumlahAktiva: number;
  readonly modalPH: number;
  readonly modalAwalTahun: number;
  readonly kasAwalTahun: number;
  readonly akumulasiPenyusutanAwalTahun: number;
}

interface LaporanPajakBulananData {
  readonly year: number;
  readonly modul: 'RADIOLOGI' | 'LABORATORIUM';
  readonly bulan: readonly BulanPajakBulananItem[];
  readonly totalJumlahPasien: number;
  readonly totalPendapatan: number;
  readonly totalBebanUsaha: number;
  readonly totalLabaBersih: number;
}

const emptyEditForm = {
  harga: '0',
  biayaSewaTempat: '0', biayaListrikAir: '0',
  gajiFernanda: '0', gajiChalimatusadiah: '0', gajiRiki: '0', gajiAgung: '0',
  gajiKaryawan1: '0', gajiKaryawan2: '0',
  bahanRoentgen: '0', peralatanRoentgen: '0', penyusutanManual: '0', perbaikanAlat: '0',
  hargaPeralatan: '0', tarifPenyusutanTahunanPersen: '10',
  piutangUsaha: '0', perlengkapan: '0', utangUsaha: '0',
  modalAwalTahun: '0', kasAwalTahun: '0', akumulasiPenyusutanAwalTahun: '0',
};

function n(v: string): number {
  return Number(v) || 0;
}

interface LaporanPajakBulananPageProps {
  readonly modul?: 'RADIOLOGI' | 'LABORATORIUM';
}

export function LaporanPajakBulananPage({ modul = 'RADIOLOGI' }: LaporanPajakBulananPageProps) {
  const currentYear = new Date().getFullYear();
  const [year, setYear] = useState<number>(currentYear);
  const moduleLabel = modul === 'RADIOLOGI' ? 'Radiologi' : 'Laboratorium';
  const [data, setData] = useState<LaporanPajakBulananData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [editing, setEditing] = useState<BulanPajakBulananItem | null>(null);
  const [editForm, setEditForm] = useState(emptyEditForm);
  const [saving, setSaving] = useState(false);
  const [savingAll, setSavingAll] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await apiGet<LaporanPajakBulananData>(
        `/api/laporan/pajak-bulanan?year=${year}&modul=${modul}`,
      );
      setData(res);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gagal memuat laporan pajak bulanan');
    } finally {
      setLoading(false);
    }
  }, [year, modul]);

  useEffect(() => {
    void fetchData();
  }, [fetchData]);

  const yearOptions = [];
  for (let y = currentYear + 1; y >= currentYear - 5; y--) {
    yearOptions.push(y);
  }

  function openEdit(item: BulanPajakBulananItem) {
    setEditForm({
      harga: String(item.harga),
      biayaSewaTempat: String(item.biayaSewaTempat), biayaListrikAir: String(item.biayaListrikAir),
      gajiFernanda: String(item.gajiFernanda), gajiChalimatusadiah: String(item.gajiChalimatusadiah),
      gajiRiki: String(item.gajiRiki), gajiAgung: String(item.gajiAgung),
      gajiKaryawan1: String(item.gajiKaryawan1), gajiKaryawan2: String(item.gajiKaryawan2),
      bahanRoentgen: String(item.bahanRoentgen), peralatanRoentgen: String(item.peralatanRoentgen),
      penyusutanManual: String(item.penyusutanManual), perbaikanAlat: String(item.perbaikanAlat),
      hargaPeralatan: String(item.hargaPeralatan),
      tarifPenyusutanTahunanPersen: String(item.tarifPenyusutanTahunanPersen),
      piutangUsaha: String(item.piutangUsaha), perlengkapan: String(item.perlengkapan),
      utangUsaha: String(item.utangUsaha),
      modalAwalTahun: String(item.modalAwalTahun), kasAwalTahun: String(item.kasAwalTahun),
      akumulasiPenyusutanAwalTahun: String(item.akumulasiPenyusutanAwalTahun),
    });
    setError(null);
    setEditing(item);
  }

  async function handleEditSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!editing) return;
    setSaving(true);
    setError(null);
    try {
      await apiPatch('/api/laporan/pajak-bulanan', {
        year,
        bulan: editing.no,
        modul,
        harga: n(editForm.harga),
        biayaSewaTempat: n(editForm.biayaSewaTempat), biayaListrikAir: n(editForm.biayaListrikAir),
        gajiFernanda: n(editForm.gajiFernanda), gajiChalimatusadiah: n(editForm.gajiChalimatusadiah),
        gajiRiki: n(editForm.gajiRiki), gajiAgung: n(editForm.gajiAgung),
        gajiKaryawan1: n(editForm.gajiKaryawan1), gajiKaryawan2: n(editForm.gajiKaryawan2),
        bahanRoentgen: n(editForm.bahanRoentgen), peralatanRoentgen: n(editForm.peralatanRoentgen),
        penyusutanManual: n(editForm.penyusutanManual), perbaikanAlat: n(editForm.perbaikanAlat),
        hargaPeralatan: n(editForm.hargaPeralatan),
        tarifPenyusutanTahunanPersen: n(editForm.tarifPenyusutanTahunanPersen),
        piutangUsaha: n(editForm.piutangUsaha), perlengkapan: n(editForm.perlengkapan),
        utangUsaha: n(editForm.utangUsaha),
        modalAwalTahun: n(editForm.modalAwalTahun), kasAwalTahun: n(editForm.kasAwalTahun),
        akumulasiPenyusutanAwalTahun: n(editForm.akumulasiPenyusutanAwalTahun),
      });
      setEditing(null);
      await fetchData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gagal menyimpan laporan bulan ini');
    } finally {
      setSaving(false);
    }
  }

  async function handleSimpanSemua() {
    if (!data || data.bulan.length === 0) return;
    setSavingAll(true);
    setError(null);
    try {
      await Promise.all(
        data.bulan.map((b) =>
          apiPatch('/api/laporan/pajak-bulanan', {
            year,
            bulan: b.no,
            modul,
            harga: b.harga,
            biayaSewaTempat: b.biayaSewaTempat,
            biayaListrikAir: b.biayaListrikAir,
            gajiFernanda: b.gajiFernanda,
            gajiChalimatusadiah: b.gajiChalimatusadiah,
            gajiRiki: b.gajiRiki,
            gajiAgung: b.gajiAgung,
            gajiKaryawan1: b.gajiKaryawan1,
            gajiKaryawan2: b.gajiKaryawan2,
            bahanRoentgen: b.bahanRoentgen,
            peralatanRoentgen: b.peralatanRoentgen,
            penyusutanManual: b.penyusutanManual,
            perbaikanAlat: b.perbaikanAlat,
            hargaPeralatan: b.hargaPeralatan,
            tarifPenyusutanTahunanPersen: b.tarifPenyusutanTahunanPersen,
            piutangUsaha: b.piutangUsaha,
            perlengkapan: b.perlengkapan,
            utangUsaha: b.utangUsaha,
            modalAwalTahun: b.modalAwalTahun,
            kasAwalTahun: b.kasAwalTahun,
            akumulasiPenyusutanAwalTahun: b.akumulasiPenyusutanAwalTahun,
          }),
        ),
      );
      await fetchData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gagal menyimpan laporan pajak bulanan');
    } finally {
      setSavingAll(false);
    }
  }

  const editPendapatan = editing ? n(editForm.harga) * editing.jumlahPasien : 0;
  const editTotalBeban = editing
    ? n(editForm.biayaSewaTempat) + n(editForm.biayaListrikAir) +
      n(editForm.gajiFernanda) + n(editForm.gajiChalimatusadiah) + n(editForm.gajiRiki) + n(editForm.gajiAgung) +
      n(editForm.gajiKaryawan1) + n(editForm.gajiKaryawan2) +
      n(editForm.bahanRoentgen) + n(editForm.peralatanRoentgen) + n(editForm.penyusutanManual) + n(editForm.perbaikanAlat)
    : 0;
  const editLabaBersih = editPendapatan - editTotalBeban;

  return (
    <>
      <ListPageShell
        title={`Laporan Pajak Bulanan ${moduleLabel}`}
        subtitle={`Pembukuan Pendapatan Jasa Pelayanan, Beban Usaha, Penyusutan & mini Neraca per bulan (Januari–Desember) untuk modul ${moduleLabel}. Jumlah Pasien diambil otomatis dari Laporan Pajak.`}
        metrics={[
          {
            label: 'Total Pasien Setahun',
            value: String(data?.totalJumlahPasien ?? 0),
            tone: 'blue',
            iconKind: 'clipboard',
          },
          {
            label: 'Total Pendapatan Setahun',
            value: formatRupiah(data?.totalPendapatan ?? 0),
            tone: 'green',
            iconKind: 'document',
          },
          {
            label: 'Total Laba Bersih Setahun',
            value: formatRupiah(data?.totalLabaBersih ?? 0),
            tone: 'amber',
            iconKind: 'percent',
          },
        ]}
        onRefresh={() => void fetchData()}
        error={error}
        loading={loading}
        filterExtra={
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
            <div className="form-field" style={{ minWidth: '130px', margin: 0 }}>
              <label htmlFor="filter-year-pajak-bulanan">Tahun</label>
              <select
                id="filter-year-pajak-bulanan"
                value={year}
                onChange={(e) => setYear(Number(e.target.value))}
              >
                {yearOptions.map((y) => (
                  <option key={y} value={y}>{y}</option>
                ))}
              </select>
            </div>
            <button
              type="button"
              className="btn btn--sm btn--primary"
              onClick={() => void handleSimpanSemua()}
              disabled={savingAll || !data || data.bulan.length === 0}
              title="Simpan seluruh 12 bulan tahun ini sebagai data final (mengunci nilai yang sedang ditampilkan)"
            >
              💾 {savingAll ? 'Menyimpan...' : 'Simpan'}
            </button>
          </div>
        }
      >
        <div style={{ overflowX: 'auto' }}>
          <table className="data-table">
            <thead>
              <tr>
                <th>Bulan</th>
                <th style={{ textAlign: 'right' }}>Jumlah Pasien</th>
                <th style={{ textAlign: 'right' }}>Harga</th>
                <th style={{ textAlign: 'right' }}>Pendapatan</th>
                <th style={{ textAlign: 'right' }}>Total Beban</th>
                <th style={{ textAlign: 'right' }}>Laba Bersih</th>
                <th style={{ textAlign: 'right' }}>Modal (Akhir Bulan)</th>
                <th style={{ textAlign: 'right' }}>Jumlah Aktiva</th>
                <th style={{ width: '80px' }}>Aksi</th>
              </tr>
            </thead>
            <tbody>
              {!data || data.bulan.length === 0 ? (
                <tr>
                  <td colSpan={9} style={{ textAlign: 'center', padding: '1.5rem' }}>
                    Belum ada data untuk tahun {year}.
                  </td>
                </tr>
              ) : (
                data.bulan.map((b) => (
                  <tr key={b.no}>
                    <td style={{ fontWeight: 600 }}>{b.bulan}</td>
                    <td style={{ textAlign: 'right' }}>{b.jumlahPasien}</td>
                    <td style={{ textAlign: 'right' }}>{formatRupiah(b.harga)}</td>
                    <td style={{ textAlign: 'right' }}>{formatRupiah(b.pendapatan)}</td>
                    <td style={{ textAlign: 'right' }}>{formatRupiah(b.totalBebanUsaha)}</td>
                    <td style={{ textAlign: 'right', fontWeight: 600, color: b.labaBersih >= 0 ? '#15803d' : '#b91c1c' }}>
                      {formatRupiah(b.labaBersih)}
                    </td>
                    <td style={{ textAlign: 'right' }}>{formatRupiah(b.modalAkhir)}</td>
                    <td style={{ textAlign: 'right' }}>{formatRupiah(b.jumlahAktiva)}</td>
                    <td>
                      <button
                        type="button"
                        className="btn btn--xs btn--secondary"
                        onClick={() => openEdit(b)}
                      >
                        ✏️ Edit
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
            {data && data.bulan.length > 0 && (
              <tfoot>
                <tr style={{ background: '#f8fafc', fontWeight: 700 }}>
                  <td>Total</td>
                  <td style={{ textAlign: 'right' }}>{data.totalJumlahPasien}</td>
                  <td />
                  <td style={{ textAlign: 'right', color: 'var(--color-primary)' }}>
                    {formatRupiah(data.totalPendapatan)}
                  </td>
                  <td style={{ textAlign: 'right' }}>{formatRupiah(data.totalBebanUsaha)}</td>
                  <td style={{ textAlign: 'right', color: data.totalLabaBersih >= 0 ? '#15803d' : '#b91c1c' }}>
                    {formatRupiah(data.totalLabaBersih)}
                  </td>
                  <td colSpan={3} />
                </tr>
              </tfoot>
            )}
          </table>
        </div>

        <p style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)', marginTop: '1rem' }}>
          * Jumlah Pasien diambil otomatis dari data yang sama dengan Laporan Pajak (arsip Duplikat).
          Beban Usaha diisi manual per bulan. Modal &amp; Kas bulan berjalan otomatis melanjutkan
          saldo akhir bulan sebelumnya (Modal/Kas Awal Tahun hanya dipakai untuk Januari). Penyusutan
          Peralatan &amp; mini Neraca dihitung otomatis dari Harga Peralatan dan tarif penyusutan.
        </p>
      </ListPageShell>

      {editing && (
        <Modal
          open={true}
          title={`Ubah Pembukuan — ${editing.bulan} ${year}`}
          onClose={() => setEditing(null)}
          size="lg"
        >
          <form onSubmit={(e) => void handleEditSubmit(e)} className="form-grid">
            <div className="form-field">
              <span className="form-field__static-label">Jumlah Pasien (otomatis)</span>
              <p className="form-field__static-value">{editing.jumlahPasien}</p>
            </div>
            <div className="form-field">
              <label htmlFor="pb-harga">Harga (Rp / pasien)</label>
              <input id="pb-harga" type="number" min="0" step="1" value={editForm.harga} onChange={(e) => setEditForm((f) => ({ ...f, harga: e.target.value }))} />
            </div>

            <div className="form-field form-field--full" style={{ fontWeight: 700, borderTop: '1px dashed var(--color-border)', paddingTop: '0.5rem' }}>
              Beban Usaha
            </div>
            <div className="form-field">
              <label htmlFor="pb-sewa">Beban Sewa Tempat</label>
              <input id="pb-sewa" type="number" min="0" step="1" value={editForm.biayaSewaTempat} onChange={(e) => setEditForm((f) => ({ ...f, biayaSewaTempat: e.target.value }))} />
            </div>
            <div className="form-field">
              <label htmlFor="pb-listrik">Beban Listrik &amp; Air</label>
              <input id="pb-listrik" type="number" min="0" step="1" value={editForm.biayaListrikAir} onChange={(e) => setEditForm((f) => ({ ...f, biayaListrikAir: e.target.value }))} />
            </div>
            <div className="form-field">
              <label htmlFor="pb-gaji-fernanda">Gaji — Fernanda</label>
              <input id="pb-gaji-fernanda" type="number" min="0" step="1" value={editForm.gajiFernanda} onChange={(e) => setEditForm((f) => ({ ...f, gajiFernanda: e.target.value }))} />
            </div>
            <div className="form-field">
              <label htmlFor="pb-gaji-chalimatusadiah">Gaji — Chalimatusadiah</label>
              <input id="pb-gaji-chalimatusadiah" type="number" min="0" step="1" value={editForm.gajiChalimatusadiah} onChange={(e) => setEditForm((f) => ({ ...f, gajiChalimatusadiah: e.target.value }))} />
            </div>
            <div className="form-field">
              <label htmlFor="pb-gaji-riki">Gaji — Riki</label>
              <input id="pb-gaji-riki" type="number" min="0" step="1" value={editForm.gajiRiki} onChange={(e) => setEditForm((f) => ({ ...f, gajiRiki: e.target.value }))} />
            </div>
            <div className="form-field">
              <label htmlFor="pb-gaji-agung">Gaji — Agung</label>
              <input id="pb-gaji-agung" type="number" min="0" step="1" value={editForm.gajiAgung} onChange={(e) => setEditForm((f) => ({ ...f, gajiAgung: e.target.value }))} />
            </div>
            <div className="form-field">
              <label htmlFor="pb-gaji-k1">Gaji — Karyawan 1</label>
              <input id="pb-gaji-k1" type="number" min="0" step="1" value={editForm.gajiKaryawan1} onChange={(e) => setEditForm((f) => ({ ...f, gajiKaryawan1: e.target.value }))} />
            </div>
            <div className="form-field">
              <label htmlFor="pb-gaji-k2">Gaji — Karyawan 2</label>
              <input id="pb-gaji-k2" type="number" min="0" step="1" value={editForm.gajiKaryawan2} onChange={(e) => setEditForm((f) => ({ ...f, gajiKaryawan2: e.target.value }))} />
            </div>
            <div className="form-field">
              <label htmlFor="pb-bahan-roentgen">Bahan Roentgen</label>
              <input id="pb-bahan-roentgen" type="number" min="0" step="1" value={editForm.bahanRoentgen} onChange={(e) => setEditForm((f) => ({ ...f, bahanRoentgen: e.target.value }))} />
            </div>
            <div className="form-field">
              <label htmlFor="pb-peralatan-roentgen">Peralatan Roentgen</label>
              <input id="pb-peralatan-roentgen" type="number" min="0" step="1" value={editForm.peralatanRoentgen} onChange={(e) => setEditForm((f) => ({ ...f, peralatanRoentgen: e.target.value }))} />
            </div>
            <div className="form-field">
              <label htmlFor="pb-penyusutan-manual">Penyusutan (Beban Usaha)</label>
              <input id="pb-penyusutan-manual" type="number" min="0" step="1" value={editForm.penyusutanManual} onChange={(e) => setEditForm((f) => ({ ...f, penyusutanManual: e.target.value }))} />
            </div>
            <div className="form-field">
              <label htmlFor="pb-perbaikan-alat">Perbaikan Alat</label>
              <input id="pb-perbaikan-alat" type="number" min="0" step="1" value={editForm.perbaikanAlat} onChange={(e) => setEditForm((f) => ({ ...f, perbaikanAlat: e.target.value }))} />
            </div>

            <div
              className="form-field form-field--full"
              style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 700, padding: '0.5rem 0', borderTop: '1px dashed var(--color-border)' }}
            >
              <span>Pendapatan (Harga × Jumlah Pasien)</span>
              <span style={{ color: 'var(--color-primary)' }}>{formatRupiah(editPendapatan)}</span>
            </div>
            <div
              className="form-field form-field--full"
              style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 700, padding: '0.5rem 0' }}
            >
              <span>Total Beban Usaha</span>
              <span>{formatRupiah(editTotalBeban)}</span>
            </div>
            <div
              className="form-field form-field--full"
              style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 700, padding: '0.5rem 0', borderTop: '1px dashed var(--color-border)' }}
            >
              <span>Laba Bersih Bulan Ini</span>
              <span style={{ color: editLabaBersih >= 0 ? '#15803d' : '#b91c1c' }}>{formatRupiah(editLabaBersih)}</span>
            </div>

            <div className="form-field form-field--full" style={{ fontWeight: 700, borderTop: '1px dashed var(--color-border)', paddingTop: '0.5rem' }}>
              Peralatan &amp; Penyusutan
            </div>
            <div className="form-field">
              <label htmlFor="pb-harga-peralatan">Harga Peralatan</label>
              <input id="pb-harga-peralatan" type="number" min="0" step="1" value={editForm.hargaPeralatan} onChange={(e) => setEditForm((f) => ({ ...f, hargaPeralatan: e.target.value }))} />
            </div>
            <div className="form-field">
              <label htmlFor="pb-tarif-penyusutan">Tarif Penyusutan / Tahun (%)</label>
              <input id="pb-tarif-penyusutan" type="number" min="0" step="0.1" value={editForm.tarifPenyusutanTahunanPersen} onChange={(e) => setEditForm((f) => ({ ...f, tarifPenyusutanTahunanPersen: e.target.value }))} />
            </div>

            <div className="form-field form-field--full" style={{ fontWeight: 700, borderTop: '1px dashed var(--color-border)', paddingTop: '0.5rem' }}>
              Mini Neraca (bulan ini)
            </div>
            <div className="form-field">
              <label htmlFor="pb-piutang">Piutang Usaha</label>
              <input id="pb-piutang" type="number" min="0" step="1" value={editForm.piutangUsaha} onChange={(e) => setEditForm((f) => ({ ...f, piutangUsaha: e.target.value }))} />
            </div>
            <div className="form-field">
              <label htmlFor="pb-perlengkapan">Perlengkapan</label>
              <input id="pb-perlengkapan" type="number" min="0" step="1" value={editForm.perlengkapan} onChange={(e) => setEditForm((f) => ({ ...f, perlengkapan: e.target.value }))} />
            </div>
            <div className="form-field">
              <label htmlFor="pb-utang">Utang Usaha</label>
              <input id="pb-utang" type="number" min="0" step="1" value={editForm.utangUsaha} onChange={(e) => setEditForm((f) => ({ ...f, utangUsaha: e.target.value }))} />
            </div>

            {editing.no === 1 && (
              <>
                <div className="form-field form-field--full" style={{ fontWeight: 700, borderTop: '1px dashed var(--color-border)', paddingTop: '0.5rem' }}>
                  Saldo Awal Tahun (khusus Januari — titik awal rantai Modal &amp; Kas)
                </div>
                <div className="form-field">
                  <label htmlFor="pb-modal-awal-tahun">Modal Awal Tahun</label>
                  <input id="pb-modal-awal-tahun" type="number" min="0" step="1" value={editForm.modalAwalTahun} onChange={(e) => setEditForm((f) => ({ ...f, modalAwalTahun: e.target.value }))} />
                </div>
                <div className="form-field">
                  <label htmlFor="pb-kas-awal-tahun">Kas Awal Tahun</label>
                  <input id="pb-kas-awal-tahun" type="number" min="0" step="1" value={editForm.kasAwalTahun} onChange={(e) => setEditForm((f) => ({ ...f, kasAwalTahun: e.target.value }))} />
                </div>
                <div className="form-field">
                  <label htmlFor="pb-akumulasi-awal-tahun">Akumulasi Penyusutan Awal Tahun</label>
                  <input id="pb-akumulasi-awal-tahun" type="number" min="0" step="1" value={editForm.akumulasiPenyusutanAwalTahun} onChange={(e) => setEditForm((f) => ({ ...f, akumulasiPenyusutanAwalTahun: e.target.value }))} />
                </div>
              </>
            )}

            <ModalFormFooter
              onCancel={() => setEditing(null)}
              submitLabel="Simpan"
              loading={saving}
            />
          </form>
        </Modal>
      )}
    </>
  );
}
