import { useEffect, useState, type CSSProperties } from 'react';
import { pdf } from '@react-pdf/renderer';
import { ConfirmModal } from '../components/ui/ConfirmModal.tsx';
import { SharingPdfPreviewModal } from '../components/ui/SharingPdfPreviewModal.tsx';
import { useMutationReload } from '../hooks/useMutationReload.ts';
import { usePaginatedList } from '../hooks/usePaginatedList.ts';
import { apiDelete, apiGet, apiPatch, apiPost } from '../lib/api.ts';
import { formatDateShort } from '../lib/format.ts';
import { terbilangRupiah } from '../lib/terbilang.ts';
import { loadLogoDataUrl } from '../pdf/loadLogoDataUrl.ts';
import { AplikasiTambahanExpertiseDocument } from '../pdf/AplikasiTambahanExpertiseDocument.tsx';
import { AplikasiTambahanLabelDocument } from '../pdf/AplikasiTambahanLabelDocument.tsx';
import { pathnameForView } from '../config/navigation.ts';
import './aplikasiTambahan.css';

interface AplikasiTambahanItem {
  readonly id: string;
  readonly kodePasien: string;
  readonly nama: string;
  readonly umur: string | null;
  readonly umurSatuan: string | null;
  readonly noTelp: string | null;
  readonly alamat: string | null;
  readonly pengirim: string | null;
  readonly pemeriksaan: string | null;
  readonly klinis: string | null;
  readonly sharing: string | null;
  readonly harga: string;
  readonly kesan1: string | null;
  readonly kesan2: string | null;
  readonly kesan3: string | null;
  readonly kesan4: string | null;
  readonly staffTag: string | null;
  readonly tanggal: string;
}

interface DokterItem {
  readonly id: string;
  readonly nama: string;
}

interface JenisItem {
  readonly id: string;
  readonly nama: string;
}

const TOP_MENU_TEMPLATES: readonly { readonly label: string; readonly text?: string }[] = [
  { label: 'Tb Paru aktif', text: 'Tampak infiltrat pada kedua paru disertai gambaran fibrotik, kesan TB Paru aktif.' },
  { label: 'BP', text: 'Tampak perselubungan inhomogen pada lapang paru, kesan Bronkopneumonia.' },
  { label: 'Bronchitis', text: 'Corakan bronkovaskuler meningkat, kesan Bronchitis.' },
  { label: 'Cardiomegali', text: 'Cor: CTR > 50%, kesan Cardiomegali.' },
  { label: 'LS', text: 'Tampak penyempitan diskus intervertebralis, kesan Spondylosis Lumbal.' },
  { label: 'Genu', text: 'Tak tampak fraktur/dislokasi pada os genu, celah sendi baik.' },
  { label: 'BNO', text: 'Tak tampak bayangan batu radioopak pada traktus urinarius.' },
  { label: 'Shoulder Joint', text: 'Tak tampak fraktur/dislokasi pada shoulder joint.' },
  { label: 'SPN+MD', text: 'Sinus paranasalis dan mandibula dalam batas normal.' },
  { label: 'Kepala', text: 'Tak tampak fraktur pada tulang kepala.' },
  { label: 'Cruris Ap/Lat', text: 'Tak tampak fraktur pada os cruris.' },
  { label: 'USG', text: 'Organ intraabdomen dalam batas normal pada pemeriksaan USG.' },
  { label: 'Ossa manus', text: 'Tak tampak fraktur pada ossa manus.' },
  { label: 'Normal', text: 'Cor dan pulmo dalam batas normal.' },
  { label: 'OAT 6bln', text: 'Kontrol OAT 6 bulan, tampak perbaikan gambaran radiologis.' },
];

const STAFF_BUTTONS = ['Anna', 'Eva', 'Luar', 'Perawat', 'PKM', 'Maulina Resa', 'Fajar', 'Helmi', 'Ferry S'];

const THEME_PALETTE = [
  { accent: '#2f6fb0', accentDark: '#1f4e82', tableHead: '#1f8a8a' },
  { accent: '#2f8f5b', accentDark: '#1e6b41', tableHead: '#8a6a1f' },
  { accent: '#a0522f', accentDark: '#7a3a1f', tableHead: '#5b3f8a' },
];

const TABS = ['Aplikasi', 'Bacaan Cepat', 'Foto', 'Kwitansi', 'Cetak Amplop', 'PKM'];

const emptyForm = {
  nama: '',
  umurAngka: '',
  umurSatuan: 'Thn',
  noTelp: '',
  alamat: '',
  pengirim: '',
  pemeriksaan: '',
  klinis: '',
  sharing: '',
  harga: '',
  kesan1: '',
  kesan2: '',
  kesan3: '',
  kesan4: '',
};

export function AplikasiTambahanPage() {
  const { items, pagination, loading, error, setError, reload: reloadList } =
    usePaginatedList<AplikasiTambahanItem>('/api/aplikasi-tambahan');
  const reload = useMutationReload(reloadList);

  const [dokterList, setDokterList] = useState<DokterItem[]>([]);
  const [jenisList, setJenisList] = useState<JenisItem[]>([]);
  const [logoSrc, setLogoSrc] = useState('');

  const [form, setForm] = useState(emptyForm);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [noRegistrasi, setNoRegistrasi] = useState('');
  const [staffTag, setStaffTag] = useState('');
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState('Aplikasi');
  const [themeIndex, setThemeIndex] = useState(0);
  const [showTerbilang, setShowTerbilang] = useState(false);

  const [deleteTarget, setDeleteTarget] = useState<AplikasiTambahanItem | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewBlob, setPreviewBlob] = useState<Blob | null>(null);
  const [previewFilename, setPreviewFilename] = useState('Dokumen.pdf');
  const [printBusy, setPrintBusy] = useState(false);

  useEffect(() => {
    void loadLogoDataUrl().then(setLogoSrc).catch(() => setLogoSrc(''));
    apiGet<{ items: DokterItem[] }>('/api/dokter?limit=200').then((res) => setDokterList(res.items)).catch(() => {});
    apiGet<{ items: JenisItem[] }>('/api/jenis-pemeriksaan?limit=200').then((res) => setJenisList(res.items)).catch(() => {});
  }, []);

  const theme = THEME_PALETTE[themeIndex % THEME_PALETTE.length]!;

  function resetForm() {
    setForm(emptyForm);
    setSelectedId(null);
    setStaffTag('');
    setShowTerbilang(false);
    setNoRegistrasi('');
  }

  function loadIntoForm(item: AplikasiTambahanItem) {
    setSelectedId(item.id);
    setNoRegistrasi(item.kodePasien);
    setForm({
      nama: item.nama,
      umurAngka: item.umur ?? '',
      umurSatuan: item.umurSatuan ?? 'Thn',
      noTelp: item.noTelp ?? '',
      alamat: item.alamat ?? '',
      pengirim: item.pengirim ?? '',
      pemeriksaan: item.pemeriksaan ?? '',
      klinis: item.klinis ?? '',
      sharing: item.sharing ?? '',
      harga: item.harga ?? '',
      kesan1: item.kesan1 ?? '',
      kesan2: item.kesan2 ?? '',
      kesan3: item.kesan3 ?? '',
      kesan4: item.kesan4 ?? '',
    });
    setStaffTag(item.staffTag ?? '');
    setShowTerbilang(false);
  }

  function buildBody(overrideStaffTag?: string) {
    return {
      nama: form.nama,
      umur: form.umurAngka,
      umurSatuan: form.umurSatuan,
      noTelp: form.noTelp,
      alamat: form.alamat,
      pengirim: form.pengirim,
      pemeriksaan: form.pemeriksaan,
      klinis: form.klinis,
      sharing: form.sharing,
      harga: Number(form.harga) || 0,
      kesan1: form.kesan1,
      kesan2: form.kesan2,
      kesan3: form.kesan3,
      kesan4: form.kesan4,
      staffTag: overrideStaffTag ?? staffTag,
    };
  }

  async function handleTambah() {
    if (!form.nama.trim()) {
      setError('Nama wajib diisi');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const res = await apiPost<{ item: AplikasiTambahanItem }>('/api/aplikasi-tambahan', buildBody());
      resetForm();
      await reload();
      setSelectedId(res.item.id);
      setNoRegistrasi(res.item.kodePasien);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gagal menyimpan data');
    } finally {
      setSaving(false);
    }
  }

  async function handleEdit() {
    if (!selectedId) {
      setError('Pilih data pada tabel terlebih dahulu untuk diubah');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await apiPatch(`/api/aplikasi-tambahan/${selectedId}`, buildBody());
      await reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gagal mengubah data');
    } finally {
      setSaving(false);
    }
  }

  async function handleSaveAsStaff(name: string) {
    setStaffTag(name);
    setSaving(true);
    setError(null);
    try {
      if (selectedId) {
        await apiPatch(`/api/aplikasi-tambahan/${selectedId}`, buildBody(name));
      } else {
        if (!form.nama.trim()) {
          setError('Nama wajib diisi sebelum menyimpan');
          setSaving(false);
          return;
        }
        const res = await apiPost<{ item: AplikasiTambahanItem }>('/api/aplikasi-tambahan', buildBody(name));
        setSelectedId(res.item.id);
      }
      await reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gagal menyimpan data');
    } finally {
      setSaving(false);
    }
  }

  async function confirmDelete() {
    if (!deleteTarget) return;
    setDeleteLoading(true);
    setError(null);
    try {
      await apiDelete(`/api/aplikasi-tambahan/${deleteTarget.id}`);
      if (selectedId === deleteTarget.id) resetForm();
      setDeleteTarget(null);
      await reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gagal menghapus data');
    } finally {
      setDeleteLoading(false);
    }
  }

  function insertKesanTemplate(text: string) {
    setForm((f) => {
      const slots: (keyof typeof f)[] = ['kesan1', 'kesan2', 'kesan3', 'kesan4'];
      for (const slot of slots) {
        if (!f[slot].trim()) {
          return { ...f, [slot]: text };
        }
      }
      return { ...f, kesan4: text };
    });
  }

  function umurLabel(item: Pick<AplikasiTambahanItem, 'umur' | 'umurSatuan'>): string {
    if (!item.umur) return '—';
    return `${item.umur} ${item.umurSatuan ?? 'Thn'}`;
  }

  async function buildExpertiseBlob(item: AplikasiTambahanItem) {
    return pdf(
      <AplikasiTambahanExpertiseDocument
        data={{
          logoSrc,
          kodePasien: item.kodePasien,
          tanggal: formatDateShort(item.tanggal),
          nama: item.nama,
          umur: umurLabel(item),
          pemeriksaan: item.pemeriksaan ?? '',
          klinis: item.klinis ?? '',
          pengirim: item.pengirim ?? '',
          kesan1: item.kesan1 ?? '',
          kesan2: item.kesan2 ?? '',
          kesan3: item.kesan3 ?? '',
          kesan4: item.kesan4 ?? '',
        }}
      />,
    ).toBlob();
  }

  async function handleExpertise() {
    const item = items.find((x) => x.id === selectedId) ?? items[0];
    if (!item) {
      setError('Belum ada data untuk dicetak');
      return;
    }
    setPrintBusy(true);
    try {
      const blob = await buildExpertiseBlob(item);
      setPreviewFilename(`Expertise_${item.kodePasien}.pdf`);
      setPreviewBlob(blob);
      setPreviewOpen(true);
    } finally {
      setPrintBusy(false);
    }
  }

  async function handleCetakTerbaru() {
    const item = items[0];
    if (!item) {
      setError('Belum ada data');
      return;
    }
    setPrintBusy(true);
    try {
      const blob = await buildExpertiseBlob(item);
      setPreviewFilename(`Expertise_Terbaru_${item.kodePasien}.pdf`);
      setPreviewBlob(blob);
      setPreviewOpen(true);
    } finally {
      setPrintBusy(false);
    }
  }

  async function handleLabelOrAmplop(variant: 'label' | 'amplop') {
    const item = items.find((x) => x.id === selectedId) ?? items[0];
    if (!item) {
      setError('Belum ada data untuk dicetak');
      return;
    }
    setPrintBusy(true);
    try {
      const blob = await pdf(
        <AplikasiTambahanLabelDocument
          variant={variant}
          data={{
            kodePasien: item.kodePasien,
            nama: item.nama,
            umur: umurLabel(item),
            alamat: item.alamat ?? '',
            noTelp: item.noTelp ?? '',
            pemeriksaan: item.pemeriksaan ?? '',
            tanggal: formatDateShort(item.tanggal),
          }}
        />,
      ).toBlob();
      setPreviewFilename(`${variant === 'label' ? 'Label' : 'Amplop'}_${item.kodePasien}.pdf`);
      setPreviewBlob(blob);
      setPreviewOpen(true);
    } finally {
      setPrintBusy(false);
    }
  }

  function handlePrintData() {
    window.print();
  }

  function handleGantiWarna() {
    setThemeIndex((i) => (i + 1) % THEME_PALETTE.length);
  }

  function handleLabNav() {
    const path = pathnameForView('lab');
    window.history.pushState(null, '', path);
    window.dispatchEvent(new PopStateEvent('popstate'));
  }

  return (
    <div
      className="at-page"
      style={
        {
          '--at-accent': theme.accent,
          '--at-accent-dark': theme.accentDark,
          '--at-table-head': theme.tableHead,
        } as CSSProperties
      }
    >
      <div className="at-menubar">
        {TOP_MENU_TEMPLATES.map((m) => (
          <button key={m.label} type="button" onClick={() => insertKesanTemplate(m.text ?? m.label)} title="Sisipkan ke Kesan">
            {m.label}
          </button>
        ))}
        <button type="button" onClick={handleGantiWarna}>Ganti Warna</button>
        <button type="button" onClick={handleGantiWarna}>G Warna</button>
        <button type="button" onClick={() => void reload()}>Tampilkan</button>
        <button type="button" onClick={handlePrintData}>Print Data</button>
        <button type="button" onClick={() => void handleExpertise()}>Cetak Expertise lama</button>
        <button type="button" onClick={handleLabNav}>Lab</button>
      </div>

      {error && <div className="at-error">{error}</div>}

      <div className="at-body">
        <div className="at-rail">
          {STAFF_BUTTONS.map((name) => (
            <button key={name} type="button" disabled={saving} onClick={() => void handleSaveAsStaff(name)}>
              {name === 'Perawat' || name === 'PKM' ? name : `Save ${name}`}
            </button>
          ))}
          <button type="button" className="at-rail__baru" onClick={resetForm}>
            Baru
          </button>
        </div>

        <div className="at-main">
          <div className="at-tabs">
            {TABS.map((tab) => (
              <button
                key={tab}
                type="button"
                className={tab === activeTab ? 'at-tab--active' : ''}
                onClick={() => setActiveTab(tab)}
              >
                {tab}
              </button>
            ))}
          </div>

          {activeTab !== 'Aplikasi' ? (
            <p style={{ fontSize: '11.5px', color: '#64748b', padding: '1rem 0' }}>
              Tab &quot;{activeTab}&quot; belum tersedia pada halaman ini.
            </p>
          ) : (
            <>
              <div className="at-form-row">
                <div className="at-field">
                  <label htmlFor="at-no-registrasi">No Registrasi</label>
                  <input id="at-no-registrasi" value={noRegistrasi} readOnly placeholder="Otomatis" />
                </div>
                <div className="at-field">
                  <label htmlFor="at-nama">Nama</label>
                  <input id="at-nama" value={form.nama} onChange={(e) => setForm((f) => ({ ...f, nama: e.target.value }))} />
                </div>
                <div className="at-field">
                  <label>Umur</label>
                  <div className="at-field--split">
                    <select value={form.umurSatuan} onChange={(e) => setForm((f) => ({ ...f, umurSatuan: e.target.value }))}>
                      <option value="Thn">Thn</option>
                      <option value="Bln">Bln</option>
                    </select>
                    <input
                      inputMode="numeric"
                      value={form.umurAngka}
                      onChange={(e) => setForm((f) => ({ ...f, umurAngka: e.target.value.replace(/[^0-9]/g, '') }))}
                    />
                  </div>
                </div>
              </div>

              <div className="at-form-row">
                <div className="at-field">
                  <label htmlFor="at-pemeriksaan">Pemeriksaan</label>
                  <input
                    id="at-pemeriksaan"
                    list="at-jenis-list"
                    value={form.pemeriksaan}
                    onChange={(e) => setForm((f) => ({ ...f, pemeriksaan: e.target.value }))}
                  />
                  <datalist id="at-jenis-list">
                    {jenisList.map((j) => (
                      <option key={j.id} value={j.nama} />
                    ))}
                  </datalist>
                </div>
                <div className="at-field">
                  <label htmlFor="at-klinis">Klinis</label>
                  <input id="at-klinis" value={form.klinis} onChange={(e) => setForm((f) => ({ ...f, klinis: e.target.value }))} />
                </div>
                <div />
              </div>

              <div className="at-form-row">
                <div className="at-field">
                  <label htmlFor="at-notelp">No Telp</label>
                  <div className="at-field--inline">
                    <input id="at-notelp" value={form.noTelp} onChange={(e) => setForm((f) => ({ ...f, noTelp: e.target.value }))} />
                    <button type="button" className="at-terbilang-link" onClick={() => void handleLabelOrAmplop('amplop')}>
                      Print
                    </button>
                  </div>
                </div>
                <div className="at-field">
                  <label htmlFor="at-sharing">Sharing</label>
                  <input id="at-sharing" value={form.sharing} onChange={(e) => setForm((f) => ({ ...f, sharing: e.target.value }))} />
                </div>
                <div />
              </div>

              <div className="at-form-row">
                <div className="at-field">
                  <label htmlFor="at-alamat">Alamat</label>
                  <input id="at-alamat" value={form.alamat} onChange={(e) => setForm((f) => ({ ...f, alamat: e.target.value }))} />
                </div>
                <div className="at-field">
                  <label htmlFor="at-harga">Harga</label>
                  <div className="at-field--inline">
                    <input
                      id="at-harga"
                      inputMode="numeric"
                      value={form.harga}
                      onChange={(e) => setForm((f) => ({ ...f, harga: e.target.value.replace(/[^0-9]/g, '') }))}
                    />
                    <button
                      type="button"
                      className="at-terbilang-link"
                      onClick={() => {
                        if (!form.harga || Number.isNaN(Number(form.harga))) {
                          setError('Harga harus berupa angka');
                          return;
                        }
                        setError(null);
                      }}
                    >
                      OK
                    </button>
                  </div>
                  <button type="button" className="at-terbilang-link" onClick={() => setShowTerbilang((s) => !s)}>
                    Terbilang
                  </button>
                  {showTerbilang && <span className="at-terbilang-text">{terbilangRupiah(form.harga || 0)}</span>}
                </div>
                <div />
              </div>

              <div className="at-form-row">
                <div className="at-field">
                  <label htmlFor="at-pengirim">Pengirim</label>
                  <input
                    id="at-pengirim"
                    list="at-dokter-list"
                    value={form.pengirim}
                    onChange={(e) => setForm((f) => ({ ...f, pengirim: e.target.value }))}
                  />
                  <datalist id="at-dokter-list">
                    {dokterList.map((d) => (
                      <option key={d.id} value={d.nama} />
                    ))}
                  </datalist>
                </div>
                <div />
                <div />
              </div>

              <div className="at-table-wrap">
                <table className="at-table">
                  <thead>
                    <tr>
                      <th>Kode Pasien</th>
                      <th>Nama Pasien</th>
                      <th>Umur</th>
                      <th>Tanggal</th>
                      <th>Jenis Pemeriksaan</th>
                    </tr>
                  </thead>
                  <tbody>
                    {loading ? (
                      <tr>
                        <td colSpan={5}>Memuat data…</td>
                      </tr>
                    ) : items.length === 0 ? (
                      <tr>
                        <td colSpan={5}>Belum ada data.</td>
                      </tr>
                    ) : (
                      items.map((item) => (
                        <tr
                          key={item.id}
                          className={item.id === selectedId ? 'at-row--active' : ''}
                          onClick={() => loadIntoForm(item)}
                        >
                          <td>{item.kodePasien}</td>
                          <td>{item.nama}</td>
                          <td>{umurLabel(item)}</td>
                          <td>{formatDateShort(item.tanggal)}</td>
                          <td>{item.pemeriksaan || '—'}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
              <p style={{ fontSize: '10.5px', color: '#64748b', margin: '0 0 6px' }}>
                Total data: {pagination.total}. Klik salah satu baris untuk memuat ke form (Edit/Expertise/Hapus).
              </p>

              <div className="at-groupbox">
                <span className="at-groupbox__title">GroupBox3</span>
                <div className="at-kesan-grid">
                  <label htmlFor="at-kesan1">Kesan1</label>
                  <input id="at-kesan1" value={form.kesan1} onChange={(e) => setForm((f) => ({ ...f, kesan1: e.target.value }))} />
                  <label htmlFor="at-kesan2">Kesan2</label>
                  <input id="at-kesan2" value={form.kesan2} onChange={(e) => setForm((f) => ({ ...f, kesan2: e.target.value }))} />
                  <label htmlFor="at-kesan3">Kesan3</label>
                  <input id="at-kesan3" value={form.kesan3} onChange={(e) => setForm((f) => ({ ...f, kesan3: e.target.value }))} />
                  <label htmlFor="at-kesan4">Kesan4</label>
                  <input id="at-kesan4" value={form.kesan4} onChange={(e) => setForm((f) => ({ ...f, kesan4: e.target.value }))} />
                </div>
              </div>

              <div className="at-groupbox">
                <span className="at-groupbox__title">GroupBox1</span>
                <div className="at-actions">
                  <button type="button" onClick={() => void handleCetakTerbaru()} disabled={printBusy}>
                    Cetak Terbaru
                  </button>
                  <button type="button" onClick={() => void handleLabelOrAmplop('label')} disabled={printBusy}>
                    Label Baru
                  </button>
                  <button type="button" onClick={() => void handleLabelOrAmplop('amplop')} disabled={printBusy}>
                    Cetak Amplop
                  </button>
                  <button type="button" className="at-actions__primary" onClick={() => void handleTambah()} disabled={saving}>
                    Tambah
                  </button>
                  <button type="button" onClick={() => void handleEdit()} disabled={saving || !selectedId}>
                    Edit
                  </button>
                  <button type="button" onClick={() => void handleExpertise()} disabled={printBusy}>
                    Expertise
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const item = items.find((x) => x.id === selectedId);
                      if (!item) {
                        setError('Pilih data pada tabel terlebih dahulu untuk dihapus');
                        return;
                      }
                      setDeleteTarget(item);
                    }}
                    disabled={!selectedId}
                  >
                    Hapus
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      <ConfirmModal
        open={deleteTarget !== null}
        title="Hapus data Aplikasi Tambahan"
        message={`Yakin hapus data "${deleteTarget?.nama ?? ''}" (${deleteTarget?.kodePasien ?? ''})?`}
        loading={deleteLoading}
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => void confirmDelete()}
      />

      <SharingPdfPreviewModal
        open={previewOpen}
        blob={previewBlob}
        filename={previewFilename}
        onClose={() => setPreviewOpen(false)}
        title="Pratinjau Cetak"
      />
    </div>
  );
}
