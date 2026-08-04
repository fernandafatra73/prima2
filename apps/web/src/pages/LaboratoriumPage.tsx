import { useCallback, useEffect, useMemo, useState } from 'react';
import { PDFViewer } from '@react-pdf/renderer';
import { ListPageShell } from '../components/ui/ListPageShell.tsx';
import { Modal } from '../components/ui/Modal.tsx';
import { ConfirmModal } from '../components/ui/ConfirmModal.tsx';
import { CetakAmplopLabModal, type CetakAmplopLabPasien } from '../components/CetakAmplopLabModal.tsx';
import type { AppViewId } from '../config/navigation.ts';
import { useListQueryParams, useListSearch } from '../hooks/useListQueryParams.ts';
import { useMutationReload } from '../hooks/useMutationReload.ts';
import { usePaginatedList } from '../hooks/usePaginatedList.ts';
import { apiDelete, apiGet, apiPatch, apiPost, apiPut } from '../lib/api.ts';
import { computeUmurYears, formatRupiah, formatUmurTahun } from '../lib/format.ts';
import type { PaginatedResponse } from '../lib/pagination.ts';
import { LabReportDocument, type LabReportData } from '../pdf/LabReportDocument.tsx';
import { loadLogoDataUrl } from '../pdf/loadLogoDataUrl.ts';
import { printLabReport } from '../pdf/printLabReport.tsx';
import {
  DEFAULT_LAB_TABLE_ROWS,
  PAKET_PEMERIKSAAN_LAB,
  applyLabPackage,
  lookupLabReference,
  groupLabRowsForPdf,
  parseLabKesan,
  serializeLabKesan,
  isLabResultAbnormal,
  formatAbnormalResult,
  type LabTableRow,
  type ParsedLabData,
} from '../lib/labKesan.ts';
import { serializeKlinisData } from '../lib/penunjang.ts';
import '../components/ui/ui.css';

export {
  DEFAULT_LAB_TABLE_ROWS,
  PAKET_PEMERIKSAAN_LAB,
  applyLabPackage,
  lookupLabReference,
  groupLabRowsForPdf,
  parseLabKesan,
  serializeLabKesan,
  isLabResultAbnormal,
  formatAbnormalResult,
  type LabTableRow,
  type ParsedLabData,
};

interface LabPasienItem {
  readonly id: string;
  readonly regCode: string;
  readonly nama: string;
  readonly umur: number;
  readonly jenisKelamin: 'L' | 'P';
  readonly tanggalLahir: string;
  readonly alamat: string | null;
  readonly noTelepon: string | null;
  readonly createdAt: string;
  readonly klinis: string | null;
  readonly kesan: string | null;
  readonly hasilStatus: 'MENUNGGU_HASIL' | 'SELESAI';
  readonly paymentStatus: 'BELUM_LUNAS' | 'LUNAS';
  readonly pengirim: { readonly id: string; readonly nama: string };
  readonly radiolog: { readonly id: string; readonly nama: string } | null;
  readonly pemeriksaan: readonly { readonly id: string; readonly jenisPemeriksaanId: string; readonly nama: string }[];
}

interface PetugasLabItem {
  readonly id: string;
  readonly nama: string;
  readonly nip: string | null;
  readonly noTelepon: string | null;
}

interface Dokter {
  readonly id: string;
  readonly nama: string;
  readonly defaultSharingAmount: string;
}

interface Staff { readonly id: string; readonly nama: string; readonly role: string; }

interface PendaftaranUmumItem {
  readonly id: string;
  readonly noRegistrasi: string;
  readonly namaPasien: string;
  readonly umur: string | null;
  readonly alamat: string | null;
  readonly telpon: string | null;
  readonly dokterPengirim: string | null;
  readonly klinis: string | null;
  readonly tanggalMasuk: string;
  readonly admin: string | null;
}

interface PaketLabItemData {
  readonly id: string;
  readonly grup: string | null;
  readonly pemeriksaan: string;
  readonly nilaiRujukan: string;
  readonly urutan: number;
}

interface PaketLabData {
  readonly id: string;
  readonly nama: string;
  readonly urutan: number;
  readonly harga?: string;
  readonly items: readonly PaketLabItemData[];
}

function formatDateDisplay(dateStr: string): string {
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = d.getFullYear();
    return `${day}/${month}/${year}`;
  } catch {
    return dateStr;
  }
}

interface LaboratoriumPageProps {
  readonly onNavigate?: (view: AppViewId) => void;
}

export function LaboratoriumPage({ onNavigate }: LaboratoriumPageProps) {
  const { search, setSearch } = useListSearch();
  const [timeFilter, setTimeFilter] = useState<'all' | 'today' | 'week' | 'custom'>('all');
  const [customStart, setCustomStart] = useState('');
  const [customEnd, setCustomEnd] = useState('');

  const dateParams = useMemo(() => {
    if (timeFilter === 'all') return {};
    const now = new Date();
    const yyyy = now.getFullYear();
    const mm = String(now.getMonth() + 1).padStart(2, '0');
    const dd = String(now.getDate()).padStart(2, '0');
    const todayStr = `${yyyy}-${mm}-${dd}`;

    if (timeFilter === 'today') {
      return { startDate: todayStr, endDate: todayStr };
    }
    if (timeFilter === 'week') {
      const start = new Date(now);
      start.setDate(now.getDate() - 7);
      const sy = start.getFullYear();
      const sm = String(start.getMonth() + 1).padStart(2, '0');
      const sd = String(start.getDate()).padStart(2, '0');
      return { startDate: `${sy}-${sm}-${sd}`, endDate: todayStr };
    }
    if (timeFilter === 'custom') {
      return {
        ...(customStart ? { startDate: customStart } : {}),
        ...(customEnd ? { endDate: customEnd } : {}),
      };
    }
    return {};
  }, [timeFilter, customStart, customEnd]);

  const queryParams = useListQueryParams(
    { modul: 'LABORATORIUM', ...(dateParams as Record<string, string>) },
    search,
  );
  const { items, pagination, setPage, loading, error, setError, reload: reloadList } =
    usePaginatedList<LabPasienItem>('/api/pasien', queryParams);
  const reload = useMutationReload(reloadList);

  const [selected, setSelected] = useState<LabPasienItem | null>(null);
  const [previewItem, setPreviewItem] = useState<LabPasienItem | null>(null);
  const [amplopItem, setAmplopItem] = useState<LabPasienItem | null>(null);
  const [labRows, setLabRows] = useState<LabTableRow[]>([]);
  const [analisList, setAnalisList] = useState<PetugasLabItem[]>([]);
  const [analisId, setAnalisId] = useState('');
  const [analisNama, setAnalisNama] = useState('');
  const [hasilStatus, setHasilStatus] = useState<'MENUNGGU_HASIL' | 'SELESAI'>('MENUNGGU_HASIL');
  const [paymentStatus, setPaymentStatus] = useState<'BELUM_LUNAS' | 'LUNAS'>('BELUM_LUNAS');
  const [editPaketIds, setEditPaketIds] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [printingId, setPrintingId] = useState<string | null>(null);
  const [logoSrc, setLogoSrc] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; label: string } | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  // Registrasi Lab state
  const [regModalOpen, setRegModalOpen] = useState(false);
  const [dokterList, setDokterList] = useState<Dokter[]>([]);
    const [pendaftaranList, setPendaftaranList] = useState<PendaftaranUmumItem[]>([]);
  const [regSaving, setRegSaving] = useState(false);
  
    const [regNama, setRegNama] = useState('');
  const [regTanggalLahir, setRegTanggalLahir] = useState('');
  const [regUmurManual, setRegUmurManual] = useState('');
  const [regNoTelepon, setRegNoTelepon] = useState('');
  const [regAlamat, setRegAlamat] = useState('');
  const [regKlinis, setRegKlinis] = useState('');
  const [regPengirimId, setRegPengirimId] = useState('');
  const [regPaketIds, setRegPaketIds] = useState<string[]>([]);
  const [regSharingAmount, setRegSharingAmount] = useState('0');
  const [regAdmin, setRegAdmin] = useState('');
  const [regAnalisId, setRegAnalisId] = useState('');
  const [regLabRows, setRegLabRows] = useState<LabTableRow[]>([]);
  const [staffList, setStaffList] = useState<Staff[]>([]);

  // Master Paket state
  const [paketModalOpen, setPaketModalOpen] = useState(false);
  const [paketList, setPaketList] = useState<PaketLabData[]>([]);
  const [paketLoading, setPaketLoading] = useState(false);
  const [editPaket, setEditPaket] = useState<PaketLabData | null>(null);
  const [editItemRows, setEditItemRows] = useState<{ grup: string; pemeriksaan: string; nilaiRujukan: string }[]>([]);
  const [newPaketNama, setNewPaketNama] = useState('');
  const [paketSaving, setPaketSaving] = useState(false);
  const [paketError, setPaketError] = useState<string | null>(null);
  const [deletePaketTarget, setDeletePaketTarget] = useState<PaketLabData | null>(null);
  const [deletePaketLoading, setDeletePaketLoading] = useState(false);

  const regTotalHarga = useMemo(
    () =>
      paketList
        .filter((p) => regPaketIds.includes(p.id))
        .reduce((sum, p) => sum + Number(p.harga ?? 0), 0),
    [paketList, regPaketIds],
  );

  const editTotalHarga = useMemo(
    () =>
      paketList
        .filter((p) => editPaketIds.includes(p.id))
        .reduce((sum, p) => sum + Number(p.harga ?? 0), 0),
    [paketList, editPaketIds],
  );

  const loadAnalis = useCallback(async () => {
    try {
      const res = await apiGet<PaginatedResponse<PetugasLabItem>>('/api/petugas-lab?page=1&limit=200');
      setAnalisList(res.items);
    } catch {
      setAnalisList([]);
    }
  }, []);

  const loadPaketList = useCallback(async () => {
    setPaketLoading(true);
    try {
      const res = await apiGet<{ items: PaketLabData[] }>('/api/paket-lab');
      setPaketList(res.items);
    } catch {
      setPaketList([]);
    } finally {
      setPaketLoading(false);
    }
  }, []);

  const loadRegistrationMasters = useCallback(async () => {
    try {
      const [pendRes, dokRes, staffRes] = await Promise.all([
        apiGet<PaginatedResponse<PendaftaranUmumItem>>('/api/pendaftaran-umum?page=1&limit=300'),
        apiGet<PaginatedResponse<Dokter>>('/api/dokter?page=1&limit=200'),
        apiGet<PaginatedResponse<Staff>>('/api/staff?page=1&limit=200'),
      ]);
      setPendaftaranList(pendRes.items);
      setDokterList(dokRes.items);
      setStaffList(staffRes.items);
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    void loadAnalis();
    void loadPaketList();
    void loadRegistrationMasters();
    void loadLogoDataUrl().then(setLogoSrc).catch(() => setLogoSrc(''));
  }, [loadAnalis, loadPaketList, loadRegistrationMasters]);

  function openEdit(item: LabPasienItem) {
    setSelected(item);
    const parsed = parseLabKesan(item.kesan);
    setLabRows(parsed.rows.length > 0 ? parsed.rows : Array.from(DEFAULT_LAB_TABLE_ROWS));
    setAnalisId(parsed.analisId || '');
    setAnalisNama(parsed.analisNama || '');
    setHasilStatus(item.hasilStatus);
    setPaymentStatus(item.paymentStatus);
    setEditPaketIds(item.pemeriksaan.map((x) => x.jenisPemeriksaanId));
  }

  async function confirmDelete() {
    if (!deleteTarget) return;
    setDeleteLoading(true);
    setError(null);
    try {
      await apiDelete(`/api/pasien/${deleteTarget.id}`);
      setDeleteTarget(null);
      await reload();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Gagal menghapus');
    } finally {
      setDeleteLoading(false);
    }
  }

  function handleRowChange(index: number, field: keyof LabTableRow, value: string) {
    setLabRows((prev) => {
      const updated = [...prev];
      const target = updated[index];
      if (target) {
        let nextRow = { ...target, [field]: value };
        if (field === 'pemeriksaan') {
          const match = lookupLabReference(value, paketList);
          if (match) {
            nextRow = {
              ...nextRow,
              klasifikasi: match.klasifikasi,
              nilaiRujukan: match.nilaiRujukan,
            };
          }
        }
        updated[index] = nextRow;
      }
      return updated;
    });
  }

  function handleAddRow() {
    setLabRows((prev) => [
      ...prev,
      { id: String(Date.now()), klasifikasi: '', pemeriksaan: '', hasil: '', nilaiRujukan: '' },
    ]);
  }

  function handleRemoveRow(index: number) {
    setLabRows((prev) => prev.filter((_, i) => i !== index));
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!selected) return;
    setSaving(true);
    setError(null);
    try {
      const selectedAnalis = analisList.find((a) => a.id === analisId);
      const finalAnalisNama = selectedAnalis ? selectedAnalis.nama : analisNama;
      const formattedRows = labRows.map((r) => ({
        ...r,
        hasil: formatAbnormalResult(r.hasil, r.nilaiRujukan, selected?.jenisKelamin),
      }));
      const serialized = serializeLabKesan(formattedRows, '', finalAnalisNama, analisId);
      await apiPatch(`/api/pasien/${selected.id}`, {
        kesan: serialized,
        hasilStatus,
        paymentStatus,
        jenisPemeriksaanIds: editPaketIds.length > 0 ? editPaketIds : undefined,
      });
      setSelected(null);
      await reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gagal menyimpan hasil laboratorium');
    } finally {
      setSaving(false);
    }
  }

  async function handlePrint(item: LabPasienItem) {
    setPrintingId(item.id);
    try {
      await printLabReport(item.id);
    } catch (err) {
      console.error('Print error:', err);
    } finally {
      setPrintingId(null);
    }
  }


  function handlePendaftaranSelect(id: string) {
    const p = pendaftaranList.find(x => x.id === id);
    if (!p) {
      setRegNama('');
      setRegAlamat('');
      setRegNoTelepon('');
      setRegKlinis('');
      setRegTanggalLahir('');
      setRegUmurManual('');
      setRegPengirimId('');
      setRegSharingAmount('0');
      setRegAdmin('');
      return;
    }
    setRegNama(p.namaPasien || '');
    setRegAlamat(p.alamat || '');
    setRegNoTelepon(p.telpon || '');
    setRegKlinis(p.klinis || '');
    if (p.tanggalMasuk) {
      try {
        const d = new Date(p.tanggalMasuk);
        const yyyy = d.getFullYear();
        const mm = String(d.getMonth() + 1).padStart(2, '0');
        const dd = String(d.getDate()).padStart(2, '0');
        const tgl = `${yyyy}-${mm}-${dd}`;
        setRegTanggalLahir(tgl);
        const years = computeUmurYears(tgl);
        setRegUmurManual(years === null ? '' : String(years));
      } catch {
        setRegTanggalLahir('');
        setRegUmurManual('');
      }
    } else if (p.umur) {
      const match = p.umur.match(/(\d+)/);
      if (match) {
        const years = parseInt(match[1], 10);
        const y = new Date().getFullYear() - years;
        setRegTanggalLahir(`${y}-01-01`);
        setRegUmurManual(String(years));
      } else {
        setRegTanggalLahir('');
        setRegUmurManual('');
      }
    } else {
      setRegTanggalLahir('');
      setRegUmurManual('');
    }
    if (p.dokterPengirim) {
      const dok = dokterList.find(d => d.nama.toLowerCase().includes(p.dokterPengirim!.toLowerCase()));
      if (dok) { setRegPengirimId(dok.id); setRegSharingAmount(dok.defaultSharingAmount); }
      else { setRegPengirimId(''); setRegSharingAmount('0'); }
    } else {
      setRegPengirimId(''); setRegSharingAmount('0');
    }
    if (p.admin) {
      const st = staffList.find(s => s.nama.toLowerCase().includes(p.admin!.toLowerCase()));
      if (st) setRegAdmin(st.id);
      else setRegAdmin(p.admin);
    } else {
      setRegAdmin('');
    }
  }

  function handleRegUmurManualChange(value: string) {
    setRegUmurManual(value);
    const years = parseInt(value, 10);
    if (Number.isFinite(years) && years >= 0) {
      const y = new Date().getFullYear() - years;
      setRegTanggalLahir(`${y}-01-01`);
    }
  }

  async function handleRegisterPasien(e: React.FormEvent) {
    e.preventDefault();
    setRegSaving(true);
    setError(null);
    try {
      const res = await apiPost<{ item: { id: string } }>('/api/pasien', {
        nama: regNama,
        tanggalLahir: regTanggalLahir,
        noTelepon: regNoTelepon || undefined,
        alamat: regAlamat || undefined,
        pengirimId: regPengirimId,
        klinis: serializeKlinisData(regKlinis, [], []),
        jenisPemeriksaanIds: regPaketIds.length > 0 ? regPaketIds : undefined,
        sharingAmount: Number(regSharingAmount),
        admin: regAdmin || undefined,
        asalModul: 'LABORATORIUM',
      });

      if (regLabRows.length > 0) {
        const selectedAnalis = analisList.find((a) => a.id === regAnalisId);
        const analisNama = selectedAnalis ? selectedAnalis.nama : '';
        const serialized = serializeLabKesan(regLabRows, regKlinis, analisNama, regAnalisId);
        
        await apiPatch(`/api/pasien/${res.item.id}`, {
          kesan: serialized,
          hasilStatus: 'SELESAI',
        });
      }

      setRegModalOpen(false);
      await reload({ resetPage: true });
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Gagal mendaftar pasien');
    } finally {
      setRegSaving(false);
    }
  }

  async function handleCreatePaket(e: React.FormEvent) {
    e.preventDefault();
    if (!newPaketNama.trim()) return;
    setPaketSaving(true);
    setPaketError(null);
    try {
      await apiPost<{ item: PaketLabData }>('/api/paket-lab', { nama: newPaketNama.trim() });
      setNewPaketNama('');
      await loadPaketList();
    } catch (err: unknown) {
      setPaketError(err instanceof Error ? err.message : 'Gagal membuat paket');
    } finally {
      setPaketSaving(false);
    }
  }

  async function handleDeletePaket() {
    if (!deletePaketTarget) return;
    setDeletePaketLoading(true);
    setPaketError(null);
    try {
      await apiDelete(`/api/paket-lab/${deletePaketTarget.id}`);
      setDeletePaketTarget(null);
      if (editPaket?.id === deletePaketTarget.id) setEditPaket(null);
      await loadPaketList();
    } catch (err: unknown) {
      setPaketError(err instanceof Error ? err.message : 'Gagal menghapus paket');
    } finally {
      setDeletePaketLoading(false);
    }
  }

  async function handleSavePaketItems() {
    if (!editPaket) return;
    setPaketSaving(true);
    setPaketError(null);
    try {
      await apiPut(`/api/paket-lab/${editPaket.id}/items`, {
        items: editItemRows
          .filter((r) => r.pemeriksaan.trim() !== '')
          .map((r, i) => ({ grup: r.grup || undefined, pemeriksaan: r.pemeriksaan, nilaiRujukan: r.nilaiRujukan, urutan: i })),
      });
      await loadPaketList();
      setEditPaket(null);
    } catch (err: unknown) {
      setPaketError(err instanceof Error ? err.message : 'Gagal menyimpan item paket');
    } finally {
      setPaketSaving(false);
    }
  }

  function openEditPaket(p: PaketLabData) {
    setEditPaket(p);
    setEditItemRows(
      p.items.length > 0
        ? p.items.map((it) => ({ grup: it.grup ?? '', pemeriksaan: it.pemeriksaan, nilaiRujukan: it.nilaiRujukan }))
        : [{ grup: '', pemeriksaan: '', nilaiRujukan: '' }],
    );
    setPaketError(null);
  }

  function applyPaketFromDB(p: PaketLabData) {
    const newRows: LabTableRow[] = p.items.map((it, i) => ({
      id: `db-${p.id}-${i}-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      klasifikasi: p.nama,
      pemeriksaan: it.pemeriksaan,
      hasil: '',
      nilaiRujukan: it.nilaiRujukan,
    }));
    setLabRows((prev) => {
      const filtered = prev.filter((r) => r.pemeriksaan.trim() !== '' || r.hasil.trim() !== '');
      return [...filtered, ...newRows];
    });
  }

  const waitingCount = items.filter((i) => i.hasilStatus === 'MENUNGGU_HASIL').length;
  const doneCount = items.filter((i) => i.hasilStatus === 'SELESAI').length;

  // Build preview data from previewItem (read from saved kesan)
  const previewData: LabReportData | null = previewItem
    ? (() => {
        const parsed = parseLabKesan(previewItem.kesan);
        return {
          logoSrc,
          regCode: previewItem.regCode,
          dokterNama: previewItem.pengirim?.nama || '—',
          tanggalPemeriksaan: formatDateDisplay(previewItem.createdAt),
          namaPasien: previewItem.nama,
          umurLabel: `${formatUmurTahun(previewItem.umur)} (${previewItem.jenisKelamin})`,
          alamat: previewItem.alamat || '—',
          labResultsText: undefined,
          rows: groupLabRowsForPdf(parsed.rows, previewItem.jenisKelamin),
          petugasLabNama: parsed.analisNama || undefined,
        };
      })()
    : null;

  return (
    <ListPageShell
      title="Registrasi Lab"
      metrics={[
        {
          label: 'Total registrasi pasien',
          value: String(pagination.total),
          tone: 'blue',
          iconKind: 'clipboard',
        },
        {
          label: 'Menunggu hasil lab',
          value: String(waitingCount),
          tone: 'violet',
          iconKind: 'stethoscope',
        },
        {
          label: 'Selesai pemeriksaan',
          value: String(doneCount),
          tone: 'green',
          iconKind: 'document',
        },
      ]}
      searchPlaceholder="Cari nama pasien, reg code, alamat..."
      searchValue={search}
      onSearchChange={setSearch}
      onRefresh={() => void reload()}
      filterExtra={
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
          <button
            type="button"
            className={`btn btn--sm ${timeFilter === 'today' ? 'btn--primary' : 'btn--ghost'}`}
            onClick={() => { setTimeFilter(timeFilter === 'today' ? 'all' : 'today'); setPage(1); }}
            style={timeFilter !== 'today' ? { border: '1px solid var(--color-border)' } : {}}
          >
            📅 Pasien Hari Ini
          </button>
          {onNavigate && (
            <button
              type="button"
              className="btn btn--sm btn--ghost"
              onClick={() => onNavigate('hitungan-led')}
              style={{ border: '1px solid var(--color-border)' }}
              title="Buka Hitungan LED"
            >
              🧮 Hitungan LED
            </button>
          )}
          <button
            type="button"
            className={`btn btn--sm ${timeFilter === 'week' ? 'btn--primary' : 'btn--ghost'}`}
            onClick={() => { setTimeFilter(timeFilter === 'week' ? 'all' : 'week'); setPage(1); }}
            style={timeFilter !== 'week' ? { border: '1px solid var(--color-border)' } : {}}
          >
            🗓️ Pasien Minggu Ini
          </button>
          <button
            type="button"
            className={`btn btn--sm ${timeFilter === 'custom' ? 'btn--primary' : 'btn--ghost'}`}
            onClick={() => setTimeFilter(timeFilter === 'custom' ? 'all' : 'custom')}
            style={timeFilter !== 'custom' ? { border: '1px solid var(--color-border)' } : {}}
          >
            🔧 Custom
          </button>
          <button
            type="button"
            className={`btn btn--sm ${timeFilter === 'all' ? 'btn--primary' : 'btn--ghost'}`}
            onClick={() => { setTimeFilter('all'); setPage(1); }}
            style={timeFilter !== 'all' ? { border: '1px solid var(--color-border)' } : {}}
          >
            Lihat Semua
          </button>
          {timeFilter === 'custom' && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              <input
                type="date"
                value={customStart}
                onChange={(e) => { setCustomStart(e.target.value); setPage(1); }}
                style={{ padding: '0.35rem 0.5rem', borderRadius: '6px', border: '1px solid var(--color-border)' }}
                aria-label="Tanggal mulai"
              />
              <span>–</span>
              <input
                type="date"
                value={customEnd}
                onChange={(e) => { setCustomEnd(e.target.value); setPage(1); }}
                style={{ padding: '0.35rem 0.5rem', borderRadius: '6px', border: '1px solid var(--color-border)' }}
                aria-label="Tanggal akhir"
              />
            </div>
          )}
        </div>
      }
      error={error}
      loading={loading}
      pagination={pagination}
      onPageChange={setPage}
      action={
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
          <button
            type="button"
            className="btn btn--secondary btn--sm"
            onClick={() => setPaketModalOpen(true)}
            style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', whiteSpace: 'nowrap' }}
          >
            ⚙️ Master Paket
          </button>
          <button
            type="button"
            className="btn btn--primary btn--sm"
            onClick={() => {
                            setRegNama('');
              setRegTanggalLahir('');
              setRegUmurManual('');
              setRegNoTelepon('');
              setRegAlamat('');
              setRegKlinis('');
              setRegPengirimId('');
                            setRegSharingAmount('0');
              setRegAdmin('');
              setRegAnalisId('');
              setRegLabRows([]);
              setRegModalOpen(true);
              void loadRegistrationMasters();
            }}
            style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', whiteSpace: 'nowrap' }}
          >
            + Registrasi Pasien Lab
          </button>
        </div>
      }
    >
      <table className="data-table">
        <thead>
          <tr>
            <th>No</th>
            <th>Nama Pasien</th>
            <th>Umur / JK</th>
            <th>Dokter Pengirim</th>
            <th>Status Hasil</th>
            <th>Aksi</th>
          </tr>
        </thead>
        <tbody>
          {items.length === 0 ? (
            <tr>
              <td colSpan={6} style={{ textAlign: 'center', padding: '2rem' }}>
                Belum ada data pendaftaran pasien laboratorium.
              </td>
            </tr>
          ) : (
            items.map((item, idx) => (
              <tr key={item.id}>
                <td>{(pagination.page - 1) * pagination.limit + idx + 1}</td>
                <td>
                  <strong>{item.nama}</strong>
                  <div style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)' }}>
                    {item.alamat || '—'}
                  </div>
                </td>
                <td>
                  {formatUmurTahun(item.umur)} ({item.jenisKelamin})
                </td>
                <td>{item.pengirim.nama}</td>
                <td>
                  <span
                    className={`badge ${item.hasilStatus === 'SELESAI' ? 'badge--ok' : 'badge--pending'}`}
                  >
                    {item.hasilStatus === 'SELESAI' ? 'SELESAI' : 'MENUNGGU HASIL'}
                  </span>
                </td>
                <td>
                  <div style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap' }}>
                    <button
                      type="button"
                      className="btn btn--secondary btn--sm"
                      onClick={() => openEdit(item)}
                    >
                      ⚡ Hasil Lab
                    </button>
                    <button
                      type="button"
                      className="btn btn--secondary btn--sm"
                      onClick={() => openEdit(item)}
                      title="Edit Hasil Pemeriksaan Lab"
                    >
                      ✏️ Edit
                    </button>
                    <button
                      type="button"
                      className="btn btn--ghost btn--sm"
                      onClick={() => setDeleteTarget({ id: item.id, label: item.nama })}
                      style={{ border: '1px solid var(--color-border)', color: '#ef4444' }}
                      title="Hapus Registrasi Pasien"
                    >
                      🗑️ Hapus
                    </button>
                    <button
                      type="button"
                      className="btn btn--primary btn--sm"
                      onClick={() => setPreviewItem(item)}
                      title="Preview & Cetak hasil lab"
                    >
                      🖨️ Preview & Cetak
                    </button>
                    <button
                      type="button"
                      className="btn btn--secondary btn--sm"
                      onClick={() => setAmplopItem(item)}
                      title="Cetak Amplop Hasil Laboratorium"
                    >
                      ✉️ Amplop
                    </button>
                  </div>
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>

      {/* Edit Modal: form only, no preview */}
      {selected && (
        <Modal
          title={`Input Hasil Laboratorium — ${selected.nama} (${selected.regCode})`}
          open={true}
          onClose={() => setSelected(null)}
          size="xl"
        >
          {/* Top section: Form full-width */}
          <form onSubmit={(e) => void handleSave(e)}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem 1.25rem', marginBottom: '1rem' }}>
              {/* Interactive Table for Lab Tests (full width) */}
              <div className="form-field" style={{ gridColumn: '1 / -1' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem', flexWrap: 'wrap', gap: '0.5rem' }}>
                  <label style={{ margin: 0, fontWeight: 'bold' }}>Tabel Hasil Pemeriksaan (Pemeriksaan | Hasil | Nilai Rujukan)</label>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', flexWrap: 'wrap' }}>
                    
                    {(paketList.length > 0
                      ? paketList
                      : PAKET_PEMERIKSAAN_LAB.map((p) => ({
                          id: p.id,
                          nama: p.label,
                          urutan: 0,
                          items: p.items.map((it, idx) => ({
                            id: `${idx}`,
                            grup: p.label,
                            pemeriksaan: it.pemeriksaan,
                            nilaiRujukan: it.nilaiRujukan,
                            urutan: idx,
                          })),
                        }))
                    ).map((p) => (
                      <button
                        key={p.id}
                        type="button"
                        className="btn btn--secondary btn--sm"
                        onClick={() => applyPaketFromDB(p)}
                        title={`Terapkan paket: ${p.nama}`}
                        style={{ background: '#e0f2fe', color: '#0369a1', border: '1px solid #38bdf8', fontWeight: 700 }}
                      >
                        ⚡ {p.nama}
                      </button>
                    ))}
                    <button
                      type="button"
                      className="btn btn--secondary btn--sm"
                      onClick={handleAddRow}
                      style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}
                    >
                      <span>+</span> Tambah Baris
                    </button>
                  </div>
                </div>
                <div style={{ overflowY: 'auto', maxHeight: '240px', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-card)' }}>
                  <table className="data-table" style={{ fontSize: '0.85rem', marginBottom: 0 }}>
                    <thead>
                      <tr>
                        <th style={{ width: '25%' }}>Klasifikasi Pemeriksaan</th>
                        <th style={{ width: '30%' }}>Pemeriksaan</th>
                        <th style={{ width: '20%' }}>Hasil</th>
                        <th style={{ width: '20%' }}>Nilai Rujukan</th>
                        <th style={{ width: '5%', textAlign: 'center' }}>Aksi</th>
                      </tr>
                    </thead>
                    <tbody>
                      {labRows.map((row, index) => (
                        <tr key={row.id}>
                          <td style={{ padding: '0.3rem 0.4rem' }}>
                            <input
                              type="text"
                              list="list-klasifikasi-lab"
                              value={row.klasifikasi || ''}
                              onChange={(e) => handleRowChange(index, 'klasifikasi', e.target.value)}
                              placeholder="Klasifikasi..."
                              style={{ width: '100%', padding: '0.3rem 0.45rem', fontSize: '0.83rem', backgroundColor: '#e0f2fe', color: '#0369a1', fontWeight: 600, border: '1px solid #38bdf8', borderRadius: '4px' }}
                            />
                          </td>
                          <td style={{ padding: '0.3rem 0.4rem' }}>
                            <input
                              type="text"
                              list="list-pemeriksaan-lab"
                              value={row.pemeriksaan}
                              onChange={(e) => handleRowChange(index, 'pemeriksaan', e.target.value)}
                              placeholder="Nama pemeriksaan..."
                              style={{ width: '100%', padding: '0.3rem 0.45rem', fontSize: '0.83rem', fontWeight: 600 }}
                            />
                          </td>
                          <td style={{ padding: '0.3rem 0.4rem' }}>
                            <input
                              type="text"
                              value={row.hasil}
                              onChange={(e) => handleRowChange(index, 'hasil', e.target.value)}
                              onBlur={(e) => {
                                const formatted = formatAbnormalResult(
                                  e.target.value,
                                  row.nilaiRujukan,
                                  previewItem?.jenisKelamin,
                                );
                                if (formatted !== row.hasil) {
                                  handleRowChange(index, 'hasil', formatted);
                                }
                              }}
                              placeholder="Hasil lab..."
                              style={{
                                width: '100%',
                                padding: '0.3rem 0.45rem',
                                fontSize: '0.83rem',
                                fontWeight: 'bold',
                                color: isLabResultAbnormal(
                                  row.hasil,
                                  row.nilaiRujukan,
                                  previewItem?.jenisKelamin,
                                )
                                  ? '#dc2626'
                                  : 'var(--color-primary)',
                                background: isLabResultAbnormal(
                                  row.hasil,
                                  row.nilaiRujukan,
                                  previewItem?.jenisKelamin,
                                )
                                  ? '#fef2f2'
                                  : undefined,
                              }}
                            />
                          </td>
                          <td style={{ padding: '0.3rem 0.4rem' }}>
                            <input
                              type="text"
                              value={row.nilaiRujukan}
                              onChange={(e) => handleRowChange(index, 'nilaiRujukan', e.target.value)}
                              placeholder="Nilai rujukan..."
                              style={{ width: '100%', padding: '0.3rem 0.45rem', fontSize: '0.83rem' }}
                            />
                          </td>
                          <td style={{ padding: '0.3rem 0.4rem', textAlign: 'center' }}>
                            <button
                              type="button"
                              className="btn btn--ghost btn--sm"
                              onClick={() => handleRemoveRow(index)}
                              title="Hapus baris"
                              style={{ color: '#ef4444', padding: '0.2rem 0.45rem' }}
                            >
                              ✕
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  <datalist id="list-klasifikasi-lab">
                    {Array.from(
                      new Set([
                        ...paketList.map((p) => p.nama),
                        ...PAKET_PEMERIKSAAN_LAB.map((p) => p.label),
                      ]),
                    ).map((label) => (
                      <option key={label} value={label} />
                    ))}
                  </datalist>
                  <datalist id="list-pemeriksaan-lab">
                    {Array.from(
                      new Set([
                        ...paketList.flatMap((p) => p.items.map((it) => it.pemeriksaan)),
                        ...PAKET_PEMERIKSAAN_LAB.flatMap((p) => p.items.map((it) => it.pemeriksaan)),
                      ]),
                    ).map((pem) => (
                      <option key={pem} value={pem} />
                    ))}
                  </datalist>
                </div>
              </div>

              {/* Paket Pemeriksaan Lab (bisa diubah) */}
              <div
                className="form-field"
                style={{
                  gridColumn: '1 / -1',
                  padding: '0.75rem',
                  border: '1px solid var(--color-border)',
                  borderRadius: 'var(--radius-card)',
                }}
              >
                <label style={{ fontWeight: 600, marginBottom: '0.5rem', display: 'block' }}>
                  Pilih Jenis Pemeriksaan Lab (Paket)
                </label>
                <div className="checkbox-list" style={{ flexDirection: 'row', flexWrap: 'wrap', maxHeight: '150px', overflowY: 'auto' }}>
                  {paketList.map((p) => (
                    <label key={p.id} style={{ minWidth: '220px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem' }}>
                      <span style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                        <input
                          type="checkbox"
                          checked={editPaketIds.includes(p.id)}
                          onChange={() => {
                            setEditPaketIds((prev) =>
                              prev.includes(p.id) ? prev.filter((id) => id !== p.id) : [...prev, p.id],
                            );
                          }}
                        />
                        {p.nama}
                      </span>
                      <span style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)', whiteSpace: 'nowrap' }}>
                        {formatRupiah(p.harga ?? '0')}
                      </span>
                    </label>
                  ))}
                </div>
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    marginTop: '0.75rem',
                    paddingTop: '0.6rem',
                    borderTop: '1px dashed var(--color-border)',
                    fontWeight: 700,
                  }}
                >
                  <span>Total Harga Pemeriksaan</span>
                  <span style={{ color: 'var(--color-primary)' }}>{formatRupiah(editTotalHarga)}</span>
                </div>
              </div>

              {/* Analis Pemeriksa, Status Hasil & Status Pembayaran sejajar */}
              <div
                style={{
                  gridColumn: '1 / -1',
                  display: 'grid',
                  gridTemplateColumns: '1fr 1fr 1fr',
                  gap: '0.75rem 1.25rem',
                }}
              >
                <div className="form-field">
                  <label htmlFor="lab-analis-pemeriksa">Analis Pemeriksa</label>
                  <select
                    id="lab-analis-pemeriksa"
                    value={analisId}
                    onChange={(e) => {
                      const id = e.target.value;
                      setAnalisId(id);
                      const found = analisList.find((a) => a.id === id);
                      if (found) setAnalisNama(found.nama);
                      else setAnalisNama('');
                    }}
                  >
                    <option value="">Pilih analis laboratorium...</option>
                    {analisList.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.nama} {a.nip ? `(NIP: ${a.nip})` : ''}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="form-field">
                  <label htmlFor="lab-hasil-status">Status Hasil</label>
                  <select id="lab-hasil-status" value={hasilStatus}
                    onChange={(e) => setHasilStatus(e.target.value as 'MENUNGGU_HASIL' | 'SELESAI')}>
                    <option value="MENUNGGU_HASIL">MENUNGGU HASIL</option>
                    <option value="SELESAI">SELESAI</option>
                  </select>
                </div>

                <div className="form-field">
                  <label htmlFor="lab-payment-status">Status Pembayaran</label>
                  <select id="lab-payment-status" value={paymentStatus}
                    onChange={(e) => setPaymentStatus(e.target.value as 'BELUM_LUNAS' | 'LUNAS')}>
                    <option value="BELUM_LUNAS">BELUM LUNAS</option>
                    <option value="LUNAS">LUNAS</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Footer: Simpan + Batal */}
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.6rem', borderTop: '1px solid var(--color-border)', paddingTop: '1rem', marginTop: '0.5rem' }}>
              <button
                type="button"
                className="btn btn--ghost"
                onClick={() => setSelected(null)}
              >
                Batal
              </button>
              <button
                type="submit"
                className="btn btn--secondary"
                disabled={saving}
              >
                {saving ? 'Menyimpan...' : '💾 Simpan Hasil Lab'}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* Preview-only Modal */}
      {previewItem && previewData && (
        <Modal
          title={`Preview Hasil Lab — ${previewItem.nama} (${previewItem.regCode})`}
          open={true}
          onClose={() => setPreviewItem(null)}
          size="xl"
        >
          {/* Header: label + Cetak button */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
            <label style={{ fontWeight: 'bold', color: 'var(--color-primary)', display: 'flex', alignItems: 'center', gap: '0.4rem', margin: 0 }}>
              🖨️ Pratinjau Cetak PDF
            </label>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <button
                type="button"
                className="btn btn--secondary btn--sm"
                onClick={() => { setPreviewItem(null); openEdit(previewItem); }}
              >
                ✏️ Edit Hasil
              </button>
              <button
                type="button"
                className="btn btn--primary btn--sm"
                onClick={() => void handlePrint(previewItem)}
                disabled={printingId === previewItem.id}
              >
                {printingId === previewItem.id ? 'Membuat PDF...' : '🖨️ Cetak PDF'}
              </button>
            </div>
          </div>

          {/* Full-width PDF Viewer */}
          <div style={{
            width: '100%',
            height: '600px',
            border: '1px solid var(--color-border)',
            borderRadius: 'var(--radius-card)',
            overflow: 'hidden',
            background: '#525659',
            boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.1)',
          }}>
            <PDFViewer style={{ width: '100%', height: '100%', border: 'none' }}>
              <LabReportDocument data={previewData} />
            </PDFViewer>
          </div>
        </Modal>
      )}

      {/* ─── Master Paket Pemeriksaan Modal ─────────────────────────────────── */}
      <Modal
        open={paketModalOpen}
        title="Master Paket Pemeriksaan Laboratorium"
        onClose={() => { setPaketModalOpen(false); setEditPaket(null); setPaketError(null); }}
        size="xl"
      >
        <div style={{ display: 'grid', gridTemplateColumns: '280px 1fr', gap: '1.25rem', minHeight: '400px' }}>
          {/* Left: daftar paket */}
          <div style={{ borderRight: '1px solid var(--color-border)', paddingRight: '1.25rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            <form onSubmit={(e) => void handleCreatePaket(e)} style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
              <label style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--color-text-muted)' }}>Buat Paket Baru</label>
              <div style={{ display: 'flex', gap: '0.4rem' }}>
                <input
                  type="text"
                  value={newPaketNama}
                  onChange={(e) => setNewPaketNama(e.target.value)}
                  placeholder="Nama paket..."
                  style={{ flex: 1, padding: '0.45rem 0.65rem', fontSize: '0.85rem', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-button)' }}
                />
                <button type="submit" className="btn btn--primary btn--sm" disabled={paketSaving || !newPaketNama.trim()}>
                  {paketSaving ? '...' : '+'}
                </button>
              </div>
            </form>
            {paketError && <p style={{ color: '#ef4444', fontSize: '0.8rem', margin: 0 }}>{paketError}</p>}
            <div style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--color-text-muted)', borderTop: '1px solid var(--color-border)', paddingTop: '0.6rem' }}>
              Daftar Paket ({paketList.length})
            </div>
            {paketLoading ? (
              <p style={{ color: 'var(--color-text-muted)', fontSize: '0.85rem' }}>Memuat...</p>
            ) : paketList.length === 0 ? (
              <p style={{ color: 'var(--color-text-muted)', fontSize: '0.85rem', fontStyle: 'italic' }}>Belum ada paket</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem', overflowY: 'auto', maxHeight: '320px' }}>
                {paketList.map((p) => (
                  <div
                    key={p.id}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '0.5rem 0.65rem',
                      borderRadius: 'var(--radius-button)',
                      background: editPaket?.id === p.id ? 'var(--color-primary-soft)' : 'var(--color-bg-page)',
                      border: `1px solid ${editPaket?.id === p.id ? 'var(--color-primary)' : 'var(--color-border)'}`,
                      cursor: 'pointer',
                    }}
                    onClick={() => openEditPaket(p)}
                  >
                    <span style={{ fontSize: '0.85rem', fontWeight: editPaket?.id === p.id ? 600 : 400 }}>{p.nama}</span>
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); setDeletePaketTarget(p); }}
                      style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#ef4444', fontSize: '0.9rem', padding: '0 0.25rem', lineHeight: 1 }}
                      title="Hapus paket"
                    >
                      ✕
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Right: edit items paket */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {!editPaket ? (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--color-text-muted)', fontStyle: 'italic', fontSize: '0.9rem' }}>
                Pilih paket di kiri untuk mengedit item pemeriksaannya
              </div>
            ) : (
              <>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <h4 style={{ margin: 0, fontSize: '0.95rem' }}>Items: <strong>{editPaket.nama}</strong></h4>
                  <button
                    type="button"
                    className="btn btn--ghost btn--sm"
                    onClick={() => setEditItemRows((r) => [...r, { grup: '', pemeriksaan: '', nilaiRujukan: '' }])}
                  >
                    + Tambah Baris
                  </button>
                </div>
                <div style={{ overflowY: 'auto', maxHeight: '320px', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-card)' }}>
                  <table className="data-table" style={{ fontSize: '0.83rem', marginBottom: 0 }}>
                    <thead>
                      <tr>
                        <th style={{ width: '25%' }}>Grup/Header</th>
                        <th style={{ width: '40%' }}>Nama Pemeriksaan</th>
                        <th style={{ width: '25%' }}>Nilai Rujukan</th>
                        <th style={{ width: '10%', textAlign: 'center' }}>Aksi</th>
                      </tr>
                    </thead>
                    <tbody>
                      {editItemRows.map((row, i) => (
                        <tr key={i}>
                          <td style={{ padding: '0.25rem 0.4rem' }}>
                            <input
                              type="text"
                              value={row.grup}
                              onChange={(e) => setEditItemRows((r) => r.map((x, j) => j === i ? { ...x, grup: e.target.value } : x))}
                              placeholder="Grup (opsional)"
                              style={{ width: '100%', padding: '0.25rem 0.4rem', fontSize: '0.82rem', border: '1px solid var(--color-border)', borderRadius: '4px' }}
                            />
                          </td>
                          <td style={{ padding: '0.25rem 0.4rem' }}>
                            <input
                              type="text"
                              value={row.pemeriksaan}
                              onChange={(e) => setEditItemRows((r) => r.map((x, j) => j === i ? { ...x, pemeriksaan: e.target.value } : x))}
                              placeholder="Nama pemeriksaan"
                              style={{ width: '100%', padding: '0.25rem 0.4rem', fontSize: '0.82rem', border: '1px solid var(--color-border)', borderRadius: '4px', fontWeight: 500 }}
                            />
                          </td>
                          <td style={{ padding: '0.25rem 0.4rem' }}>
                            <input
                              type="text"
                              value={row.nilaiRujukan}
                              onChange={(e) => setEditItemRows((r) => r.map((x, j) => j === i ? { ...x, nilaiRujukan: e.target.value } : x))}
                              placeholder="Nilai rujukan"
                              style={{ width: '100%', padding: '0.25rem 0.4rem', fontSize: '0.82rem', border: '1px solid var(--color-border)', borderRadius: '4px' }}
                            />
                          </td>
                          <td style={{ padding: '0.25rem 0.4rem', textAlign: 'center' }}>
                            <button
                              type="button"
                              onClick={() => setEditItemRows((r) => r.filter((_, j) => j !== i))}
                              style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#ef4444', fontSize: '1rem' }}
                              title="Hapus baris"
                            >✕</button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', borderTop: '1px solid var(--color-border)', paddingTop: '0.75rem' }}>
                  <button type="button" className="btn btn--ghost" onClick={() => setEditPaket(null)}>Batal</button>
                  <button type="button" className="btn btn--primary" disabled={paketSaving} onClick={() => void handleSavePaketItems()}>
                    {paketSaving ? 'Menyimpan...' : '💾 Simpan Items'}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </Modal>

      {/* Modal Registrasi Lab */}
      {regModalOpen && (
        <Modal
          title="Registrasi Pasien Laboratorium"
          open={true}
          onClose={() => setRegModalOpen(false)}
          size="lg"
        >
          <form onSubmit={(e) => void handleRegisterPasien(e)} className="form-grid">
            <div className="form-field form-field--full" style={{ marginBottom: '1rem', paddingBottom: '1rem', borderBottom: '1px solid var(--color-border)' }}>
              <label style={{ fontWeight: 600, color: 'var(--color-primary)' }}>Pilih dari Pendaftaran Umum (Opsional)</label>
              <select 
                onChange={(e) => {
                  handlePendaftaranSelect(e.target.value);
                }}
                style={{ marginTop: '0.5rem' }}
              >
                <option value="">-- Ketik Data Baru / Manual --</option>
                {pendaftaranList.map(p => (
                  <option key={p.id} value={p.id}>{p.namaPasien} - {p.telpon || 'Tanpa No.Telp'}</option>
                ))}
              </select>
            </div>

            <div className="form-field">
              <label htmlFor="rNama">Nama Pasien *</label>
              <input id="rNama" required value={regNama} onChange={(e) => setRegNama(e.target.value)} />
            </div>

            <div className="form-field">
              <label htmlFor="rUmurManual">Umur (tahun) *</label>
              <input
                id="rUmurManual"
                type="number"
                min="0"
                step="1"
                required
                value={regUmurManual}
                onChange={(e) => handleRegUmurManualChange(e.target.value)}
              />
            </div>

            <div className="form-field">
              <label htmlFor="rDok">Dokter Pengirim *</label>
              <select id="rDok" required value={regPengirimId} onChange={(e) => {
                const id = e.target.value;
                setRegPengirimId(id);
                const d = dokterList.find(x => x.id === id);
                if (d) setRegSharingAmount(d.defaultSharingAmount);
              }}>
                <option value="">-- Pilih Dokter --</option>
                {dokterList.map(d => (
                  <option key={d.id} value={d.id}>{d.nama}</option>
                ))}
              </select>
            </div>

            <div className="form-field form-grid--full" style={{ padding: '0.75rem', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-card)' }}>
              <label style={{ fontWeight: 600, marginBottom: '0.5rem', display: 'block' }}>2. Pilih Jenis Pemeriksaan Lab (Paket) *</label>
              <div className="checkbox-list" style={{ flexDirection: 'row', flexWrap: 'wrap', maxHeight: '420px', overflowY: 'auto' }}>
                {paketList.map((p) => (
                  <label key={p.id} style={{ minWidth: '220px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem' }}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                      <input
                        type="checkbox"
                        checked={regPaketIds.includes(p.id)}
                        onChange={() => {
                          setRegPaketIds(prev => prev.includes(p.id) ? prev.filter(id => id !== p.id) : [...prev, p.id]);
                        }}
                      />
                      {p.nama}
                    </span>
                    <span style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)', whiteSpace: 'nowrap' }}>
                      {formatRupiah(p.harga ?? '0')}
                    </span>
                  </label>
                ))}
              </div>
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginTop: '0.75rem',
                  paddingTop: '0.6rem',
                  borderTop: '1px dashed var(--color-border)',
                  fontWeight: 700,
                }}
              >
                <span>Total Harga Pemeriksaan</span>
                <span style={{ color: 'var(--color-primary)' }}>{formatRupiah(regTotalHarga)}</span>
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.6rem', borderTop: '1px solid var(--color-border)', paddingTop: '1rem', marginTop: '0.5rem', gridColumn: '1 / -1' }}>
              <button type="button" className="btn btn--ghost" onClick={() => setRegModalOpen(false)}>
                Batal
              </button>
              <button type="submit" className="btn btn--primary" disabled={regSaving}>
                {regSaving ? 'Menyimpan...' : '💾 Registrasi Pasien'}
              </button>
            </div>
          </form>
        </Modal>
      )}

      <ConfirmModal
        open={deletePaketTarget !== null}
        title="Hapus Paket"
        message={`Yakin hapus paket "${deletePaketTarget?.nama ?? ''}"? Semua item di dalamnya juga akan terhapus.`}
        loading={deletePaketLoading}
        onClose={() => setDeletePaketTarget(null)}
        onConfirm={() => void handleDeletePaket()}
      />

      <ConfirmModal
        open={deleteTarget !== null}
        title="Hapus Registrasi Pasien"
        message={`Yakin hapus registrasi "${deleteTarget?.label ?? ''}"? Tindakan ini tidak bisa dibatalkan.`}
        loading={deleteLoading}
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => void confirmDelete()}
      />

      <CetakAmplopLabModal
        open={amplopItem !== null}
        onClose={() => setAmplopItem(null)}
        pasien={amplopItem as CetakAmplopLabPasien | null}
      />
    </ListPageShell>
  );
}
