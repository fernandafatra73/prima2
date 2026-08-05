import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { ConfirmModal } from '../components/ui/ConfirmModal.tsx';
import { Modal } from '../components/ui/Modal.tsx';
import { ModalFormFooter } from '../components/ui/ModalFormFooter.tsx';
import { ListPageShell } from '../components/ui/ListPageShell.tsx';
import { TableRowActions } from '../components/ui/TableRowActions.tsx';
import { KesanRegioPicker } from '../components/KesanRegioPicker.tsx';
import { parseKlinisData, serializeKlinisData } from '../lib/penunjang.ts';
import { useListQueryParams, useListSearch } from '../hooks/useListQueryParams.ts';
import { useListRefresh } from '../context/ListRefreshContext.tsx';
import { useMutationReload } from '../hooks/useMutationReload.ts';
import { usePaginatedList } from '../hooks/usePaginatedList.ts';
import { apiDelete, apiGet, apiPatch, apiPost } from '../lib/api.ts';
import { birthDateInputMax, birthDateInputMin, isValidBirthDate, normalizeBirthDateOnBlur } from '../lib/birthDate.ts';
import { clampClinicalInput } from '../lib/clinicalText.ts';
import {
  computeAutoSharingAmount,
  computeUmurYears,
  formatRupiah,
  formatUmurTahun,
} from '../lib/format.ts';
import { printPasienReport } from '../lib/pasienPrint.ts';
import type { PaginatedResponse } from '../lib/pagination.ts';
import '../components/ui/ui.css';

interface Dokter {
  readonly id: string;
  readonly nama: string;
  readonly defaultSharingAmount: string;
}

interface Radiolog {
  readonly id: string;
  readonly nama: string;
}

interface Jenis {
  readonly id: string;
  readonly nama: string;
  readonly harga: string | null;
  readonly jumlahFilm: number;
}

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

interface Staff {
  readonly id: string;
  readonly nama: string;
}

interface PasienRow {
  readonly id: string;
  readonly regCode: string;
  readonly nama: string;
  readonly umur: number;
  readonly pengirim: { readonly id: string; readonly nama: string };
  readonly pemeriksaan: readonly { readonly nama: string }[];
  readonly totalHarga: string;
  readonly totalSharing: string;
  readonly hasilStatus: 'MENUNGGU_HASIL' | 'SELESAI';
  readonly paymentStatus: 'BELUM_LUNAS' | 'LUNAS';
  readonly klinis?: string | null;
  readonly kesan?: string | null;
}

interface PemeriksaanItem {
  readonly id: string;
  readonly jenisPemeriksaanId: string;
  readonly nama: string;
  readonly harga: string;
}

interface PasienDetail extends PasienRow {
  readonly tanggalLahir: string;
  readonly noTelepon: string | null;
  readonly alamat: string | null;
  readonly klinis: string | null;
  readonly kesan: string | null;
  readonly admin: string | null;
  readonly radiolog: { readonly id: string; readonly nama: string } | null;
  readonly sharingAmount: string;
  readonly sharingLocked: boolean;
  readonly pemeriksaan: readonly PemeriksaanItem[];
}

interface PasienSummary {
  readonly totalPasien: number;
  readonly menungguHasil: number;
  readonly selesai: number;
  readonly totalOmzet: string;
  readonly totalSharing: string;
}

const HASIL_TABS = [
  { id: 'all', label: 'Semua data' },
  { id: 'MENUNGGU_HASIL', label: 'Menunggu hasil' },
  { id: 'SELESAI', label: 'Selesai' },
] as const;

export function PasienPage() {
  const { search, setSearch } = useListSearch();
  const [hasilTab, setHasilTab] = useState<string>('all');
  const [paymentFilter, setPaymentFilter] = useState('');
  const [dokterFilter, setDokterFilter] = useState('');
  const [timeFilter, setTimeFilter] = useState<'all'|'today'|'week'>('all');

  const dateParams = useMemo(() => {
    if (timeFilter === 'all') return {};
    const now = new Date();
    // Use local time for dates
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
    return {};
  }, [timeFilter]);

  const queryParams = useListQueryParams(
    {
      modul: 'RADIOLOGI',
      ...(hasilTab !== 'all' ? { hasilStatus: hasilTab } : {}),
      ...(paymentFilter ? { paymentStatus: paymentFilter } : {}),
      ...(dokterFilter ? { pengirimId: dokterFilter } : {}),
      ...(dateParams as Record<string, string>),
    },
    search,
  );

  const { version: listRefreshVersion } = useListRefresh();
  const { items, pagination, setPage, loading, error, reload: reloadList, setError } =
    usePaginatedList<PasienRow>('/api/pasien', queryParams);
  const reload = useMutationReload(reloadList);
  const [dokter, setDokter] = useState<Dokter[]>([]);
  const [radiologList, setRadiologList] = useState<Radiolog[]>([]);
  const [jenis, setJenis] = useState<Jenis[]>([]);
  const [pendaftaranList, setPendaftaranList] = useState<PendaftaranUmumItem[]>([]);
  const [staffList, setStaffList] = useState<Staff[]>([]);
  const [selectedPendaftaranId, setSelectedPendaftaranId] = useState('');
  const [mastersError, setMastersError] = useState<string | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [printingId, setPrintingId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; label: string } | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [quickEditOpen, setQuickEditOpen] = useState(false);
  const [quickEditId, setQuickEditId] = useState<string | null>(null);
  const [quickEditNama, setQuickEditNama] = useState('');
  const [quickEditKesan, setQuickEditKesan] = useState('');
  const [quickEditSaving, setQuickEditSaving] = useState(false);
  const [quickEditError, setQuickEditError] = useState<string | null>(null);
  const [aiFotoOpen, setAiFotoOpen] = useState(false);
  const [aiFotoDataUrl, setAiFotoDataUrl] = useState('');
  const [aiFotoAnalyzing, setAiFotoAnalyzing] = useState(false);
  const [aiFotoError, setAiFotoError] = useState<string | null>(null);
  const [nama, setNama] = useState('');
  const [tanggalLahir, setTanggalLahir] = useState('');
  const [umurManual, setUmurManual] = useState('');
  const [noTelepon, setNoTelepon] = useState('');
  const [alamat, setAlamat] = useState('');
  const [pengirimId, setPengirimId] = useState('');
  const [klinis, setKlinis] = useState('');
  const [kesan, setKesan] = useState('');
  const [admin, setAdmin] = useState('');
  const [radiologId, setRadiologId] = useState('');
  const [hasilStatus, setHasilStatus] = useState<'MENUNGGU_HASIL' | 'SELESAI'>('MENUNGGU_HASIL');
  const [paymentStatus, setPaymentStatus] = useState<'BELUM_LUNAS' | 'LUNAS'>('BELUM_LUNAS');
  const [selectedJenis, setSelectedJenis] = useState<string[]>([]);
  const existingTambahanRef = useRef<{ radTambahan: string[]; labTambahan: string[] }>({
    radTambahan: [],
    labTambahan: [],
  });
  const [sharingAmount, setSharingAmount] = useState('0');
  const [sharingMode, setSharingMode] = useState<string>('auto');
  const [jenisModalMode, setJenisModalMode] = useState<'add' | 'edit' | null>(null);
  const [editingJenisItem, setEditingJenisItem] = useState<Jenis | null>(null);
  const [editingJenisNama, setEditingJenisNama] = useState('');
  const [editingJenisHarga, setEditingJenisHarga] = useState('');
  const [editingJenisJumlahFilm, setEditingJenisJumlahFilm] = useState('1');
  const [savingJenis, setSavingJenis] = useState(false);
  const [jenisError, setJenisError] = useState<string | null>(null);

  const [bhpModalOpen, setBhpModalOpen] = useState(false);
  const [bhpForm, setBhpForm] = useState({
    tanggal: new Date().toISOString().split('T')[0]!,
    pemakaian: '',
    harga: '0',
    dev: '1000',
    fixer: '1000',
    film: '38000',
    amplopKertas: '1000',
    listrik: '2000',
    gajiKaryawan: '2500000',
    kertasCetak: '2000',
    amplop: '2000',
  });
  const [savingBhp, setSavingBhp] = useState(false);
  const [bhpError, setBhpError] = useState<string | null>(null);

  const umurYears = useMemo(() => {
    if (!isValidBirthDate(tanggalLahir)) return 0;
    return computeUmurYears(tanggalLahir) ?? 0;
  }, [tanggalLahir]);

  const selectedDokter = useMemo(() => dokter.find((d) => d.id === pengirimId), [dokter, pengirimId]);

  const autoSharingAmount = useMemo(() => {
    const selectedNames = selectedJenis
      .map((id) => jenis.find((j) => j.id === id)?.nama || '')
      .filter(Boolean);
    return computeAutoSharingAmount(
      selectedDokter?.nama,
      selectedNames,
      umurYears,
      selectedDokter?.defaultSharingAmount || '0',
    );
  }, [selectedDokter, selectedJenis, jenis, umurYears]);

  useEffect(() => {
    if (sharingMode === 'auto') {
      setSharingAmount(autoSharingAmount);
    }
  }, [sharingMode, autoSharingAmount]);

  const [summary, setSummary] = useState<PasienSummary | null>(null);

  const estimate = useMemo(() => {
    const totalHarga = selectedJenis.reduce((sum, id) => {
      const row = jenis.find((j) => j.id === id);
      return sum + Number(row?.harga ?? 0);
    }, 0);
    const amt = Number(sharingAmount);
    const totalSharing = Number.isFinite(amt) ? amt : 0;
    return { totalHarga, totalSharing };
  }, [selectedJenis, jenis, sharingAmount]);

  const loadMasters = useCallback(async () => {
    setMastersError(null);
    try {
      const [dokterRes, jenisRes, radiologRes, pendaftaranRes, staffRes] = await Promise.all([
        apiGet<PaginatedResponse<Dokter>>('/api/dokter?page=1&limit=200'),
        apiGet<PaginatedResponse<Jenis>>('/api/jenis-pemeriksaan?page=1&limit=200'),
        apiGet<PaginatedResponse<Radiolog>>('/api/radiolog?page=1&limit=200'),
        apiGet<PaginatedResponse<PendaftaranUmumItem>>('/api/pendaftaran-umum?page=1&limit=300').catch(() => ({ items: [] })),
        apiGet<PaginatedResponse<Staff>>('/api/admin-pendaftaran?page=1&limit=200').catch(() => ({ items: [] })),
      ]);
      setDokter(dokterRes.items);
      setJenis(jenisRes.items.filter((j) => j.harga !== null));
      setRadiologList(radiologRes.items);
      setPendaftaranList(pendaftaranRes.items);
      setStaffList(staffRes.items);
    } catch (err: unknown) {
      setMastersError(err instanceof Error ? err.message : 'Gagal memuat master data');
    }
  }, []);

  useEffect(() => {
    void loadMasters();
  }, [loadMasters, listRefreshVersion]);

  const loadSummary = useCallback(async () => {
    try {
      const res = await apiGet<PasienSummary>('/api/pasien/summary');
      setSummary(res);
    } catch {
      setSummary(null);
    }
  }, []);

  useEffect(() => {
    void loadSummary();
  }, [loadSummary, items.length]);

  function onPengirimChange(id: string, applyTemplate = true) {
    setPengirimId(id);
    if (!applyTemplate) return;
    const dok = dokter.find((d) => d.id === id);
    if (dok) {
      setSharingAmount(dok.defaultSharingAmount);
      setSharingMode('auto');
    }
  }

  function handlePendaftaranSelect(id: string) {
    setSelectedPendaftaranId(id);
    const p = pendaftaranList.find(x => x.id === id);
    if (!p) {
      setNama('');
      setAlamat('');
      setNoTelepon('');
      setKlinis('');
      setTanggalLahir('');
      setUmurManual('');
      setPengirimId('');
      setSharingAmount('0');
      setSharingMode('auto');
      setAdmin('');
      return;
    }

    setNama(p.namaPasien);
    setAlamat(p.alamat || '');
    setNoTelepon(p.telpon || '');
    setKlinis(p.klinis || '');
    setAdmin(p.admin || '');

    if (p.umur) {
      const match = p.umur.match(/(\d+)/);
      if (match) {
        const years = parseInt(match[1], 10);
        const y = new Date().getFullYear() - years;
        setTanggalLahir(`${y}-01-01`);
        setUmurManual(String(years));
      } else {
        setTanggalLahir('');
        setUmurManual('');
      }
    } else {
      setTanggalLahir('');
      setUmurManual('');
    }
    
    if (p.dokterPengirim) {
      const dok = dokter.find(d => d.nama.toLowerCase() === p.dokterPengirim!.toLowerCase());
      if (dok) {
        setPengirimId(dok.id);
        setSharingAmount(dok.defaultSharingAmount);
      } else {
        setPengirimId('');
        setSharingAmount('0');
      }
    } else {
      setPengirimId('');
      setSharingAmount('0');
    }
  }

  function resetForm() {
    setNama('');
    setTanggalLahir('');
    setUmurManual('');
    setNoTelepon('');
    setAlamat('');
    setPengirimId('');
    setKlinis('');
    setKesan('');
    setAdmin('');
    setRadiologId('');
    setHasilStatus('MENUNGGU_HASIL');
    setPaymentStatus('BELUM_LUNAS');
    setSelectedJenis([]);
    existingTambahanRef.current = { radTambahan: [], labTambahan: [] };
    setSharingAmount('0');
    setSharingMode('auto');
    setEditingId(null);
    setSelectedPendaftaranId('');
  }

  function handleUmurManualChange(value: string) {
    setUmurManual(value);
    const years = parseInt(value, 10);
    if (Number.isFinite(years) && years >= 0) {
      const y = new Date().getFullYear() - years;
      setTanggalLahir(`${y}-01-01`);
    }
  }

  function toggleJenis(id: string) {
    setSelectedJenis((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  }

  async function openEdit(id: string) {
    setError(null);
    try {
      const res = await apiGet<{ item: PasienDetail }>(`/api/pasien/${id}`);
      const p = res.item;
      const parsedKlinis = parseKlinisData(p.klinis);
      setEditingId(p.id);
      setNama(p.nama);
      setTanggalLahir(p.tanggalLahir);
      setNoTelepon(p.noTelepon ?? '');
      setAlamat(p.alamat ?? '');
      setPengirimId(p.pengirim.id);
      setKlinis(parsedKlinis.text);
      existingTambahanRef.current = {
        radTambahan: parsedKlinis.radTambahan,
        labTambahan: parsedKlinis.labTambahan,
      };
      setKesan(p.kesan ?? '');
      setAdmin(p.admin ?? '');
      setRadiologId(p.radiolog?.id ?? '');
      setHasilStatus(p.hasilStatus);
      setPaymentStatus(p.paymentStatus);
      const currentSharing = p.sharingAmount;
      setSharingAmount(currentSharing);
      const dok = dokter.find((d) => d.id === p.pengirim.id);
      const selNames = p.pemeriksaan
        .map((x) => jenis.find((j) => j.id === x.jenisPemeriksaanId)?.nama || '')
        .filter(Boolean);
      const computedAuto = computeAutoSharingAmount(
        dok?.nama,
        selNames,
        computeUmurYears(p.tanggalLahir) ?? 0,
        dok?.defaultSharingAmount || '0'
      );
      if (currentSharing === computedAuto) {
        setSharingMode('auto');
      } else if (['18000', '20000', '33000', '35000', '58000', '88000', '50000', '0'].includes(currentSharing)) {
        setSharingMode(currentSharing);
      } else {
        setSharingMode('custom');
      }
      setSelectedJenis(p.pemeriksaan.map((x) => x.jenisPemeriksaanId));
      setEditOpen(true);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Gagal memuat detail pasien');
    }
  }

  async function openQuickEdit(id: string) {
    setQuickEditError(null);
    try {
      const res = await apiGet<{ item: PasienDetail }>(`/api/pasien/${id}`);
      setQuickEditId(res.item.id);
      setQuickEditNama(res.item.nama);
      setQuickEditKesan(res.item.kesan ?? '');
      setQuickEditOpen(true);
    } catch (err: unknown) {
      setQuickEditError(err instanceof Error ? err.message : 'Gagal memuat detail pasien');
    }
  }

  async function submitQuickEdit(e: FormEvent) {
    e.preventDefault();
    if (!quickEditId) return;
    setQuickEditSaving(true);
    setQuickEditError(null);
    try {
      await apiPatch(`/api/pasien/${quickEditId}`, {
        nama: quickEditNama,
        kesan: quickEditKesan,
      });
      setQuickEditOpen(false);
      await reload();
    } catch (err: unknown) {
      setQuickEditError(err instanceof Error ? err.message : 'Gagal menyimpan perubahan');
    } finally {
      setQuickEditSaving(false);
    }
  }

  function openAiFotoModal() {
    setAiFotoDataUrl('');
    setAiFotoError(null);
    setAiFotoOpen(true);
  }

  function handleAiFotoFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        setAiFotoDataUrl(reader.result);
        setAiFotoError(null);
      }
    };
    reader.readAsDataURL(file);
  }

  async function handleAiFotoAnalyze() {
    if (!aiFotoDataUrl) {
      setAiFotoError('Unggah foto terlebih dahulu sebelum memulai analisa AI.');
      return;
    }
    setAiFotoAnalyzing(true);
    setAiFotoError(null);
    try {
      const res = await apiPost<{ namaPenyakit: string; kesan: string }>('/api/analisa-foto-ai/analyze', {
        fotoDataUrl: aiFotoDataUrl,
      });
      resetForm();
      setKesan(res.kesan);
      setAiFotoOpen(false);
      setAddOpen(true);
    } catch (err) {
      setAiFotoError(err instanceof Error ? err.message : 'Gagal menganalisa foto dengan AI');
    } finally {
      setAiFotoAnalyzing(false);
    }
  }

  async function handlePrint(id: string) {
    setPrintingId(id);
    setError(null);
    try {
      await printPasienReport(id);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Gagal membuat PDF');
    } finally {
      setPrintingId(null);
    }
  }

  async function onSubmitAdd(e: FormEvent) {
    e.preventDefault();
    if (!isValidBirthDate(tanggalLahir)) {
      setError('Tanggal lahir tidak valid');
      return;
    }
    if (selectedJenis.length === 0) {
      setError('Pilih minimal satu jenis pemeriksaan');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await apiPost('/api/pasien', {
        nama,
        tanggalLahir,
        noTelepon,
        alamat,
        pengirimId,
        klinis: serializeKlinisData(klinis, [], []),
        jenisPemeriksaanIds: selectedJenis,
        sharingAmount: Number(sharingAmount),
        radiologId: radiologId || undefined,
        admin: admin || undefined,
      });
      setAddOpen(false);
      resetForm();
      await reload({ resetPage: true });
      await loadSummary();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Gagal menyimpan');
    } finally {
      setSaving(false);
    }
  }

  async function onSubmitEdit(e: FormEvent) {
    e.preventDefault();
    if (!editingId) return;
    if (!isValidBirthDate(tanggalLahir)) {
      setError('Tanggal lahir tidak valid');
      return;
    }
    if (selectedJenis.length === 0) {
      setError('Pilih minimal satu jenis pemeriksaan');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await apiPatch(`/api/pasien/${editingId}`, {
        nama,
        tanggalLahir,
        noTelepon,
        alamat,
        pengirimId,
        klinis: serializeKlinisData(
          klinis,
          existingTambahanRef.current.radTambahan,
          existingTambahanRef.current.labTambahan,
        ),
        hasilStatus,
        paymentStatus,
        sharingAmount: Number(sharingAmount),
        jenisPemeriksaanIds: selectedJenis,
        kesan,
        admin: admin || undefined,
        radiologId: radiologId || null,
      });
      setEditOpen(false);
      resetForm();
      await reload();
      await loadSummary();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Gagal menyimpan perubahan');
    } finally {
      setSaving(false);
    }
  }

  async function confirmDelete() {
    if (!deleteTarget) return;
    setDeleteLoading(true);
    setError(null);
    try {
      await apiDelete(`/api/pasien/${deleteTarget.id}`);
      setDeleteTarget(null);
      await reload();
      await loadSummary();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Gagal menghapus');
    } finally {
      setDeleteLoading(false);
    }
  }

  function openBhpModal() {
    setBhpForm({
      tanggal: new Date().toISOString().split('T')[0]!,
      pemakaian: '',
      harga: '0',
      dev: '1000',
      fixer: '1000',
      film: '38000',
      amplopKertas: '1000',
      listrik: '2000',
      gajiKaryawan: '2500000',
      kertasCetak: '2000',
      amplop: '2000',
    });
    setBhpError(null);
    setBhpModalOpen(true);
  }

  async function handleBhpSubmit(e: FormEvent) {
    e.preventDefault();
    setSavingBhp(true);
    setBhpError(null);
    try {
      await apiPost('/api/bhp-radiologi', {
        tanggal: bhpForm.tanggal,
        pemakaian: bhpForm.pemakaian,
        harga: Number(bhpForm.harga) || 0,
        dev: Number(bhpForm.dev) || 0,
        fixer: Number(bhpForm.fixer) || 0,
        film: Number(bhpForm.film) || 0,
        amplopKertas: Number(bhpForm.amplopKertas) || 0,
        listrik: Number(bhpForm.listrik) || 0,
        gajiKaryawan: Number(bhpForm.gajiKaryawan) || 0,
        kertasCetak: Number(bhpForm.kertasCetak) || 0,
        amplop: Number(bhpForm.amplop) || 0,
      });
      setBhpModalOpen(false);
    } catch (err) {
      setBhpError(err instanceof Error ? err.message : 'Gagal menyimpan data BHP');
    } finally {
      setSavingBhp(false);
    }
  }

  function openAddJenisModal() {
    setEditingJenisItem(null);
    setEditingJenisNama('');
    setEditingJenisHarga('');
    setEditingJenisJumlahFilm('1');
    setJenisError(null);
    setJenisModalMode('add');
  }

  function openEditJenisModal(j: Jenis) {
    setEditingJenisItem(j);
    setEditingJenisNama(j.nama);
    setEditingJenisHarga(j.harga ?? '');
    setEditingJenisJumlahFilm(String(j.jumlahFilm));
    setJenisError(null);
    setJenisModalMode('edit');
  }

  async function onSubmitEditJenis(e: FormEvent) {
    e.preventDefault();
    if (!editingJenisNama.trim()) {
      setJenisError('Nama jenis pemeriksaan wajib diisi');
      return;
    }
    if (!editingJenisHarga.trim() || isNaN(Number(editingJenisHarga))) {
      setJenisError('Harga layanan wajib diisi dengan angka valid');
      return;
    }
    setSavingJenis(true);
    setJenisError(null);
    try {
      if (jenisModalMode === 'add') {
        await apiPost('/api/jenis-pemeriksaan', {
          nama: editingJenisNama.trim(),
          harga: Number(editingJenisHarga),
          jumlahFilm: Number(editingJenisJumlahFilm) || 1,
        });
      } else if (editingJenisItem) {
        await apiPatch(`/api/jenis-pemeriksaan/${editingJenisItem.id}`, {
          nama: editingJenisNama.trim(),
          harga: Number(editingJenisHarga),
          jumlahFilm: Number(editingJenisJumlahFilm) || 1,
        });
      }
      setJenisModalMode(null);
      await loadMasters();
    } catch (err: unknown) {
      setJenisError(err instanceof Error ? err.message : 'Gagal menyimpan jenis pemeriksaan');
    } finally {
      setSavingJenis(false);
    }
  }

  const jenisPemeriksaanField = (
    <div className="form-field form-grid--span-3" style={{ marginTop: '0.5rem' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
        <label style={{ fontWeight: 600, color: '#0369a1' }}>
          Tabel Jenis Pemeriksaan, Harga & Sharing
        </label>
        <span style={{ fontWeight: 600, color: '#0f172a' }}>
          Total Bayar: <span style={{ color: '#0284c7' }}>{formatRupiah(estimate.totalHarga)}</span>
        </span>
      </div>
      <div
        style={{
          border: '1px solid #e0e7ff',
          borderRadius: '8px',
          overflow: 'hidden',
          background: '#ffffff',
          boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.05)',
        }}
      >
        <table className="data-table" style={{ width: '100%', borderCollapse: 'collapse', marginBottom: 0 }}>
          <thead style={{ background: '#f0f9ff', color: '#0369a1', borderBottom: '2px solid #bae6fd' }}>
            <tr>
              <th style={{ width: '70px', textAlign: 'center', padding: '10px' }}>Pilih</th>
              <th style={{ textAlign: 'left', padding: '10px' }}>Jenis Pemeriksaan</th>
              <th style={{ width: '80px', textAlign: 'center', padding: '10px' }}>Film</th>
              <th style={{ width: '150px', textAlign: 'right', padding: '10px' }}>Harga</th>
              <th style={{ width: '150px', textAlign: 'right', padding: '10px' }}>Sharing</th>
              <th style={{ width: '160px', textAlign: 'center', padding: '10px' }}>Aksi</th>
            </tr>
          </thead>
          <tbody>
            {jenis.length === 0 ? (
              <tr>
                <td colSpan={6} style={{ textAlign: 'center', padding: '1.5rem', color: '#64748b' }}>
                  Belum ada data jenis pemeriksaan.
                </td>
              </tr>
            ) : (
              jenis.map((j) => {
                const isChecked = selectedJenis.includes(j.id);
                const itemHarga = Number(j.harga ?? 0);
                const itemSharing = isChecked ? Number(sharingAmount) || 0 : 0;
                return (
                  <tr
                    key={j.id}
                    onClick={() => toggleJenis(j.id)}
                    style={{
                      cursor: 'pointer',
                      backgroundColor: isChecked ? '#eff6ff' : 'transparent',
                      transition: 'background-color 0.15s ease',
                      borderBottom: '1px solid #f1f5f9',
                    }}
                  >
                    <td style={{ textAlign: 'center', padding: '10px' }}>
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={() => toggleJenis(j.id)}
                        onClick={(e) => e.stopPropagation()}
                        style={{ cursor: 'pointer', width: '16px', height: '16px' }}
                      />
                    </td>
                    <td style={{ padding: '10px', fontWeight: isChecked ? 600 : 400, color: '#1e293b' }}>
                      {j.nama}
                    </td>
                    <td style={{ textAlign: 'center', padding: '10px', fontWeight: isChecked ? 600 : 400, color: '#0f172a' }}>
                      {j.jumlahFilm}
                    </td>
                    <td style={{ textAlign: 'right', padding: '10px', fontWeight: isChecked ? 600 : 400, color: '#0f172a' }}>
                      {formatRupiah(itemHarga)}
                    </td>
                    <td style={{ textAlign: 'right', padding: '10px', fontWeight: isChecked ? 600 : 400, color: isChecked ? '#0284c7' : '#64748b' }}>
                      {isChecked
                        ? formatRupiah(itemSharing)
                        : `Otomatis (${formatRupiah(Number(computeAutoSharingAmount(selectedDokter?.nama, [j.nama], umurYears, selectedDokter?.defaultSharingAmount || '0')) || 0)})`}
                    </td>
                    <td style={{ textAlign: 'center', padding: '10px' }}>
                      <div style={{ display: 'inline-flex', gap: '0.35rem' }}>
                        <button
                          type="button"
                          className="btn btn--xs btn--secondary"
                          onClick={(e) => {
                            e.stopPropagation();
                            openEditJenisModal(j);
                          }}
                          style={{
                            padding: '0.25rem 0.55rem',
                            fontSize: '0.78rem',
                            borderRadius: '6px',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '0.25rem',
                            border: '1px solid var(--color-border)',
                            background: '#ffffff',
                            color: '#0f172a',
                            fontWeight: 500,
                          }}
                          title="Edit jenis pemeriksaan & harga"
                        >
                          ✎ Edit
                        </button>
                        <button
                          type="button"
                          className="btn btn--xs btn--primary"
                          onClick={(e) => {
                            e.stopPropagation();
                            openAddJenisModal();
                          }}
                          style={{
                            padding: '0.25rem 0.55rem',
                            fontSize: '0.78rem',
                            borderRadius: '6px',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '0.25rem',
                            fontWeight: 600,
                          }}
                          title="Tambah jenis pemeriksaan baru"
                        >
                          + Tambah
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
          {selectedJenis.length > 0 ? (
            <tfoot style={{ background: '#f8fafc', fontWeight: 600, borderTop: '2px solid #cbd5e1' }}>
              <tr>
                <td colSpan={2} style={{ padding: '10px', textAlign: 'right', color: '#334155' }}>
                  Total Terpilih ({selectedJenis.length} pemeriksaan):
                </td>
                <td style={{ padding: '10px', textAlign: 'center', color: '#0f172a' }}>
                  {jenis
                    .filter((j) => selectedJenis.includes(j.id))
                    .reduce((sum, j) => sum + j.jumlahFilm, 0)}
                </td>
                <td style={{ padding: '10px', textAlign: 'right', color: '#0f172a' }}>
                  {formatRupiah(estimate.totalHarga)}
                </td>
                <td style={{ padding: '10px', textAlign: 'right', color: '#0284c7' }}>
                  {formatRupiah(estimate.totalSharing)}
                </td>
                <td style={{ padding: '10px' }}></td>
              </tr>
            </tfoot>
          ) : null}
        </table>
      </div>
    </div>
  );

  const financePreview =
    selectedJenis.length > 0 ? (
      <div className="form-field finance-preview">
        <span className="finance-preview__label">Perkiraan tagihan</span>
        <div className="finance-preview__row">
          <span>Total layanan</span>
          <strong>{formatRupiah(estimate.totalHarga)}</strong>
        </div>
        <div className="finance-preview__row">
          <span>Sharing</span>
          <strong>{formatRupiah(estimate.totalSharing)}</strong>
        </div>
      </div>
    ) : null;

  const umurPreview = useMemo(() => {
    if (!isValidBirthDate(tanggalLahir)) {
      return null;
    }
    return umurYears;
  }, [tanggalLahir, umurYears]);

  const patientFields = (
    <>
      <div
        className="form-grid--span-3"
        style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: '0.75rem 1.25rem' }}
      >
        <div className="form-field">
          <label htmlFor="nama">Nama</label>
          <input id="nama" required value={nama} onChange={(e) => setNama(e.target.value)} />
        </div>
        <div className="form-field">
          <label htmlFor="tgl">Tanggal lahir</label>
          <input
            id="tgl"
            type="date"
            required
            min={birthDateInputMin()}
            max={birthDateInputMax()}
            value={tanggalLahir}
            onChange={(e) => setTanggalLahir(e.target.value)}
            onBlur={(e) => setTanggalLahir(normalizeBirthDateOnBlur(e.target.value))}
          />
        </div>
        <div className="form-field">
          <span className="form-field__static-label">Umur</span>
          <p className="form-field__static-value">
            {umurPreview === null ? '—' : formatUmurTahun(umurPreview)}
          </p>
        </div>
        <div className="form-field">
          <label htmlFor="telp">No telepon</label>
          <input id="telp" value={noTelepon} onChange={(e) => setNoTelepon(e.target.value)} />
        </div>
        <div className="form-field" style={{ gridColumn: '1' }}>
          <label htmlFor="alamat">Alamat</label>
          <input id="alamat" value={alamat} onChange={(e) => setAlamat(e.target.value)} />
        </div>
        <div className="form-field" style={{ gridColumn: '2' }}>
          <label htmlFor="sharing-select" style={{ fontWeight: 600, color: '#0369a1' }}>
            Pilihan Nominal Sharing
          </label>
          <select
            id="sharing-select"
            value={sharingMode}
            onChange={(e) => {
              const val = e.target.value;
              setSharingMode(val);
              if (val === 'auto') {
                setSharingAmount(autoSharingAmount);
              } else if (val !== 'custom') {
                setSharingAmount(val);
              }
            }}
            style={{
              fontWeight: 600,
              color: '#0284c7',
              backgroundColor: '#f0f9ff',
              border: '1px solid #7dd3fc',
              padding: '0.45rem',
              borderRadius: '6px',
            }}
          >
            <option value="auto">
              ⚡ Otomatis ({formatRupiah(Number(autoSharingAmount) || 0)} — Sesuai Rumus Dokter, Umur &amp; Pemeriksaan)
            </option>
            <option value="18000">Rp 18.000 — Thorax Anak (&lt; 10 th) — dr. Anna Diah</option>
            <option value="20000">Rp 20.000 — Thorax Dewasa (≥ 10 th) — dr. Anna Diah</option>
            <option value="33000">Rp 33.000 — Thorax Anak (&lt; 10 th) — dr. Eva / dr. Iman</option>
            <option value="35000">Rp 35.000 — Thorax Dewasa (≥ 10 th) — dr. Eva / dr. Iman</option>
            <option value="58000">Rp 58.000 — Shoulder Joint</option>
            <option value="88000">Rp 88.000 — Lumbosacral</option>
            <option value="50000">Rp 50.000 — Standar Dokter</option>
            <option value="0">Rp 0 — Tanpa Sharing</option>
            <option value="custom">✎ Input Manual / Lainnya...</option>
          </select>
        </div>
        <div className="form-field" style={{ gridColumn: '3' }}>
          <label htmlFor="sharing">Nominal Sharing (Rp)</label>
          <input
            id="sharing"
            type="number"
            min="0"
            step="1"
            value={sharingAmount}
            onChange={(e) => {
              setSharingAmount(e.target.value);
              setSharingMode('custom');
            }}
          />
        </div>
        <div className="form-field" style={{ gridColumn: '4' }}>
          <span className="form-field__static-label">Total Bayar</span>
          <p className="form-field__static-value">{formatRupiah(estimate.totalHarga)}</p>
        </div>
      </div>
      <div
        className="form-grid--span-3"
        style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr 1fr', gap: '0.75rem 1.25rem' }}
      >
        <div className="form-field">
          <label htmlFor="pengirim">Dokter pengirim</label>
          <select
            id="pengirim"
            required
            value={pengirimId}
            onChange={(e) => onPengirimChange(e.target.value, true)}
          >
            <option value="">Pilih dokter</option>
            {dokter.map((d) => (
              <option key={d.id} value={d.id}>
                {d.nama}
              </option>
            ))}
          </select>
        </div>
        <div className="form-field">
          <label htmlFor="radiolog">Radiolog</label>
          <select id="radiolog" value={radiologId} onChange={(e) => setRadiologId(e.target.value)}>
            <option value="">Pilih radiolog</option>
            {radiologList.map((r) => (
              <option key={r.id} value={r.id}>
                {r.nama}
              </option>
            ))}
          </select>
        </div>
        <div className="form-field">
          <label htmlFor="admin">Admin Pendaftaran</label>
          <select id="admin" value={admin} onChange={(e) => setAdmin(e.target.value)}>
            <option value="">Pilih admin</option>
            {staffList.map((s) => (
              <option key={s.id} value={s.nama}>
                {s.nama}
              </option>
            ))}
          </select>
        </div>
        <div className="form-field">
          <label htmlFor="hasil">Status hasil</label>
          <select
            id="hasil"
            value={hasilStatus}
            onChange={(e) => setHasilStatus(e.target.value as 'MENUNGGU_HASIL' | 'SELESAI')}
          >
            <option value="MENUNGGU_HASIL">Menunggu hasil</option>
            <option value="SELESAI">Selesai</option>
          </select>
        </div>
        <div className="form-field">
          <label htmlFor="bayar">Status pembayaran</label>
          <select
            id="bayar"
            value={paymentStatus}
            onChange={(e) => setPaymentStatus(e.target.value as 'BELUM_LUNAS' | 'LUNAS')}
          >
            <option value="BELUM_LUNAS">Belum lunas</option>
            <option value="LUNAS">Lunas</option>
          </select>
        </div>
      </div>
    </>
  );

  const klinisField = (
    <div className="form-field" style={{ gridColumn: '1' }}>
      <label htmlFor="klinis">Klinis</label>
      <textarea
        id="klinis"
        rows={2}
        value={klinis}
        onChange={(e) => setKlinis(clampClinicalInput(e.target.value))}
      />
    </div>
  );

  const kesanField = (
    <div className="form-field form-grid--span-2">
      <label htmlFor="kesan">Kesan</label>
      <textarea
        id="kesan"
        rows={3}
        value={kesan}
        onChange={(e) => setKesan(clampClinicalInput(e.target.value))}
        placeholder="Isi kesan radiologi..."
      />
    </div>
  );

  const displayError = error ?? mastersError;

  const metrics = summary
    ? [
        {
          label: 'Total pasien',
          value: String(summary.totalPasien),
          tone: 'blue' as const,
          iconKind: 'users' as const,
        },
        {
          label: 'Menunggu hasil',
          value: String(summary.menungguHasil),
          tone: 'amber' as const,
          iconKind: 'clock' as const,
        },
        {
          label: 'Selesai',
          value: String(summary.selesai),
          tone: 'green' as const,
          iconKind: 'check' as const,
        },
        {
          label: 'Omzet',
          value: formatRupiah(summary.totalOmzet),
          tone: 'slate' as const,
          iconKind: 'currency' as const,
        },
        {
          label: 'Komisi',
          value: formatRupiah(summary.totalSharing),
          tone: 'violet' as const,
          iconKind: 'percent' as const,
        },
      ]
    : undefined;

  return (
    <>
      <ListPageShell
        title="Manajemen Pasien"
        subtitle="Registrasi, status hasil, dan pembayaran pasien radiologi"
        action={
          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
            <button type="button" className="aifoto-analyze-btn" onClick={openAiFotoModal} style={{ padding: '0.5rem 0.9rem', fontSize: '0.8rem' }}>
              ✨ AI Foto
            </button>
            <button
              type="button"
              className={`btn btn--sm ${timeFilter === 'today' ? 'btn--primary' : 'btn--ghost'}`}
              onClick={() => {
                setTimeFilter(timeFilter === 'today' ? 'all' : 'today');
                setPage(1);
              }}
              style={timeFilter !== 'today' ? { border: '1px solid var(--color-border)' } : {}}
            >
              📅 Hari Ini
            </button>
            <button
              type="button"
              className="btn btn--sm btn--ghost"
              onClick={openBhpModal}
              style={{ border: '1px solid var(--color-border)' }}
            >
              + Tambah BHP
            </button>
            <button
              type="button"
              className={`btn btn--sm ${timeFilter === 'week' ? 'btn--primary' : 'btn--ghost'}`}
              onClick={() => {
                setTimeFilter(timeFilter === 'week' ? 'all' : 'week');
                setPage(1);
              }}
              style={timeFilter !== 'week' ? { border: '1px solid var(--color-border)' } : {}}
            >
              📅 7 Hari Terakhir
            </button>
            <button
              type="button"
              className="btn btn--primary"
              onClick={() => {
                resetForm();
                setAddOpen(true);
              }}
            >
              + Registrasi Pasien
            </button>
          </div>
        }
        metrics={metrics}
        tabs={HASIL_TABS.map((t) => ({ id: t.id, label: t.label }))}
        activeTab={hasilTab}
        onTabChange={setHasilTab}
        selects={[
          {
            id: 'filter-bayar',
            label: 'Pembayaran',
            value: paymentFilter,
            placeholder: 'Semua',
            options: [
              { value: 'BELUM_LUNAS', label: 'Belum lunas' },
              { value: 'LUNAS', label: 'Lunas' },
            ],
            onChange: setPaymentFilter,
          },
          {
            id: 'filter-dokter',
            label: 'Dokter pengirim',
            value: dokterFilter,
            placeholder: 'Semua dokter',
            options: dokter.map((d) => ({ value: d.id, label: d.nama })),
            onChange: setDokterFilter,
          },
        ]}
        searchPlaceholder="Cari nama, no. reg, telepon…"
        searchValue={search}
        onSearchChange={setSearch}
        onRefresh={() => void reload()}
        error={displayError}
        loading={loading}
        pagination={pagination}
        onPageChange={setPage}
      >
        <table className="data-table">
          <thead>
            <tr>
              <th>No. Reg</th>
              <th>Nama</th>
              <th>Umur</th>
              <th>Pengirim</th>
              <th>Pemeriksaan</th>
              <th>Kesan</th>
              <th>Total</th>
              <th>Sharing</th>
              <th>Hasil</th>
              <th>Bayar</th>
              <th>Aksi</th>
            </tr>
          </thead>
          <tbody>
            {items.length === 0 ? (
              <tr>
                <td colSpan={11}>Belum ada pasien.</td>
              </tr>
            ) : (
              items.map((p) => (
                <tr key={p.id}>
                  <td>{p.regCode}</td>
                  <td>{p.nama}</td>
                  <td>{formatUmurTahun(p.umur)}</td>
                  <td>{p.pengirim.nama}</td>
                  <td>
                    <div>{p.pemeriksaan.map((x) => x.nama).join(', ')}</div>
                    {(() => {
                      const parsed = parseKlinisData(p.klinis);
                      const parts: string[] = [];
                      if (parsed.radTambahan.length > 0)
                        parts.push(`+ Rad: ${parsed.radTambahan.join(', ')}`);
                      if (parsed.labTambahan.length > 0)
                        parts.push(`+ Lab: ${parsed.labTambahan.join(', ')}`);
                      return parts.length > 0 ? (
                        <div
                          style={{
                            fontSize: '0.78rem',
                            color: 'var(--color-primary)',
                            marginTop: '0.15rem',
                          }}
                        >
                          {parts.join(' | ')}
                        </div>
                      ) : null;
                    })()}
                  </td>
                  <td style={{ maxWidth: 220, whiteSpace: 'pre-wrap' }}>{p.kesan || '-'}</td>
                  <td>{formatRupiah(p.totalHarga)}</td>
                  <td>{formatRupiah(p.totalSharing)}</td>
                  <td>
                    <span
                      className={`badge ${p.hasilStatus === 'SELESAI' ? 'badge--ok' : 'badge--pending'}`}
                    >
                      {p.hasilStatus === 'SELESAI' ? 'Selesai' : 'Menunggu'}
                    </span>
                  </td>
                  <td>
                    <span
                      className={`badge ${p.paymentStatus === 'LUNAS' ? 'badge--ok' : 'badge--unpaid'}`}
                    >
                      {p.paymentStatus === 'LUNAS' ? 'Lunas' : 'Belum'}
                    </span>
                  </td>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                      <button
                        type="button"
                        className="btn btn--xs btn--ghost"
                        onClick={() => void openQuickEdit(p.id)}
                        title="Edit cepat: nama & kesan"
                        style={{ border: '1px solid var(--color-border)' }}
                      >
                        Edit²
                      </button>
                      <TableRowActions
                        onPrint={() => void handlePrint(p.id)}
                        onEdit={() => void openEdit(p.id)}
                        onDelete={() => setDeleteTarget({ id: p.id, label: p.nama })}
                        printLabel={
                          printingId === p.id ? 'Membuat PDF…' : 'Cetak hasil radiologi'
                        }
                      />
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </ListPageShell>

      <Modal open={addOpen} title="Registrasi Pasien Baru" onClose={() => setAddOpen(false)} size="xl">
        <form onSubmit={(e) => void onSubmitAdd(e)} className="form-grid form-grid--wide">
          <div
            className="form-grid--span-3"
            style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: '0.75rem 1.25rem', marginBottom: '0.5rem' }}
          >
            <div
              className="form-field"
              style={{ gridColumn: '1', gridRow: '1', background: '#f0f9ff', padding: '1rem', borderRadius: '8px', border: '1px solid #bae6fd' }}
            >
              <label htmlFor="ambil-reg" style={{ color: '#0369a1', fontWeight: 600 }}>Ambil Data dari Pendaftaran Umum (Opsional)</label>
              <select
                id="ambil-reg"
                value={selectedPendaftaranId}
                onChange={(e) => handlePendaftaranSelect(e.target.value)}
                style={{ borderColor: '#7dd3fc', backgroundColor: 'white' }}
              >
                <option value="">-- Pilih Data Pasien --</option>
                {pendaftaranList.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.noRegistrasi} - {p.namaPasien} ({p.umur || '-'})
                  </option>
                ))}
              </select>
            </div>
            <div className="form-field" style={{ gridColumn: '2', gridRow: '1' }}>
              <label htmlFor="nama">Nama *</label>
              <input id="nama" required value={nama} onChange={(e) => setNama(e.target.value)} />
            </div>
            <div className="form-field" style={{ gridColumn: '3', gridRow: '1' }}>
              <label htmlFor="umur-manual">Umur (tahun) *</label>
              <input
                id="umur-manual"
                type="number"
                min="0"
                step="1"
                required
                value={umurManual}
                onChange={(e) => handleUmurManualChange(e.target.value)}
              />
            </div>
            <div className="form-field" style={{ gridColumn: '1', gridRow: '2' }}>
              <label htmlFor="pengirim">Dokter pengirim *</label>
              <select
                id="pengirim"
                required
                value={pengirimId}
                onChange={(e) => onPengirimChange(e.target.value, true)}
              >
                <option value="">Pilih dokter</option>
                {dokter.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.nama}
                  </option>
                ))}
              </select>
            </div>
            <div className="form-field" style={{ gridColumn: '2', gridRow: '2' }}>
              <label htmlFor="radiolog">Radiolog</label>
              <select id="radiolog" value={radiologId} onChange={(e) => setRadiologId(e.target.value)}>
                <option value="">Pilih radiolog</option>
                {radiologList.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.nama}
                  </option>
                ))}
              </select>
            </div>
            <div className="form-field" style={{ gridColumn: '3', gridRow: '2' }}>
              <label htmlFor="admin">Admin Pendaftaran</label>
              <select id="admin" value={admin} onChange={(e) => setAdmin(e.target.value)}>
                <option value="">Pilih admin</option>
                {staffList.map((s) => (
                  <option key={s.id} value={s.nama}>
                    {s.nama}
                  </option>
                ))}
              </select>
            </div>
            <div className="form-field" style={{ gridColumn: '4', gridRow: '1' }}>
              <label htmlFor="sharing-select">Pilihan Nominal Sharing</label>
              <select
                id="sharing-select"
                value={sharingMode}
                onChange={(e) => {
                  const val = e.target.value;
                  setSharingMode(val);
                  if (val === 'auto') {
                    setSharingAmount(autoSharingAmount);
                  } else if (val !== 'custom') {
                    setSharingAmount(val);
                  }
                }}
              >
                <option value="auto">
                  ⚡ Otomatis ({formatRupiah(Number(autoSharingAmount) || 0)} — Sesuai Rumus Dokter, Umur &amp; Pemeriksaan)
                </option>
                <option value="18000">Rp 18.000 — Thorax Anak (&lt; 10 th) — dr. Anna Diah</option>
                <option value="20000">Rp 20.000 — Thorax Dewasa (≥ 10 th) — dr. Anna Diah</option>
                <option value="33000">Rp 33.000 — Thorax Anak (&lt; 10 th) — dr. Eva / dr. Iman</option>
                <option value="35000">Rp 35.000 — Thorax Dewasa (≥ 10 th) — dr. Eva / dr. Iman</option>
                <option value="58000">Rp 58.000 — Shoulder Joint</option>
                <option value="88000">Rp 88.000 — Lumbosacral</option>
                <option value="50000">Rp 50.000 — Standar Dokter</option>
                <option value="0">Rp 0 — Tanpa Sharing</option>
                <option value="custom">✎ Input Manual / Lainnya...</option>
              </select>
            </div>
            <div className="form-field" style={{ gridColumn: '4', gridRow: '2' }}>
              <label htmlFor="sharing">Nominal Sharing (Rp)</label>
              <input
                id="sharing"
                type="number"
                min="0"
                step="1"
                value={sharingAmount}
                onChange={(e) => {
                  setSharingAmount(e.target.value);
                  setSharingMode('custom');
                }}
              />
            </div>
          </div>

          {jenisPemeriksaanField}
          {financePreview}
          <div className="form-grid--span-3">
            <ModalFormFooter
              onCancel={() => setAddOpen(false)}
              submitLabel="Simpan"
              loading={saving}
            />
          </div>
        </form>
      </Modal>

      <Modal open={editOpen} title="Ubah Data Pasien" onClose={() => setEditOpen(false)} size="xl">
        <form onSubmit={(e) => void onSubmitEdit(e)} className="form-grid form-grid--wide">
          {patientFields}
          {klinisField}
          {kesanField}
          {jenisPemeriksaanField}
          <div
            className="form-grid--span-3"
            style={{ display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}
          >
            {financePreview}
            <div style={{ marginLeft: 'auto' }}>
              <ModalFormFooter
                onCancel={() => setEditOpen(false)}
                submitLabel="Simpan perubahan"
                loading={saving}
              />
            </div>
          </div>
        </form>
      </Modal>

      <ConfirmModal
        open={deleteTarget !== null}
        title="Hapus pasien"
        message={`Yakin hapus "${deleteTarget?.label ?? ''}"? Tindakan ini tidak bisa dibatalkan.`}
        loading={deleteLoading}
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => void confirmDelete()}
      />

      <Modal
        open={quickEditOpen}
        title="Edit Cepat: Nama & Kesan"
        onClose={() => setQuickEditOpen(false)}
        size="xl"
      >
        <form onSubmit={(e) => void submitQuickEdit(e)} className="form-grid">
          {quickEditError && (
            <div className="alert alert--error form-grid--full">{quickEditError}</div>
          )}

          <div className="form-field form-grid--full">
            <KesanRegioPicker onSelect={(teks) => setQuickEditKesan(teks)} />
          </div>

          <div className="form-field form-grid--full">
            <label htmlFor="qe-nama">Nama pasien</label>
            <input
              id="qe-nama"
              required
              value={quickEditNama}
              onChange={(e) => setQuickEditNama(e.target.value)}
            />
          </div>
          <div className="form-field form-grid--full">
            <label htmlFor="qe-kesan">Kesan</label>
            <textarea
              id="qe-kesan"
              rows={4}
              value={quickEditKesan}
              onChange={(e) => setQuickEditKesan(clampClinicalInput(e.target.value))}
              placeholder="Isi kesan radiologi..."
            />
          </div>
          <ModalFormFooter
            onCancel={() => setQuickEditOpen(false)}
            submitLabel="Simpan"
            loading={quickEditSaving}
          />
        </form>
      </Modal>

      <Modal open={aiFotoOpen} title="✨ AI Foto — Analisa & Isi Kesan Otomatis" onClose={() => setAiFotoOpen(false)} size="md">
        <div className="form-grid">
          {aiFotoError && <div className="alert alert--error form-grid--full">{aiFotoError}</div>}

          <div className="form-field form-grid--full">
            <label htmlFor="pasien-ai-foto">Foto</label>
            {!aiFotoDataUrl ? (
              <label htmlFor="pasien-ai-foto" className="aifoto-upload" style={{ cursor: 'pointer' }}>
                <span className="aifoto-upload__icon">📤</span>
                <strong>Klik untuk unggah foto</strong>
                <p className="aifoto-upload__hint">JPEG, PNG, GIF, atau WEBP</p>
              </label>
            ) : (
              <div className="aifoto-preview">
                <img src={aiFotoDataUrl} alt="Preview foto" />
              </div>
            )}
            <input
              id="pasien-ai-foto"
              type="file"
              accept="image/*"
              onChange={handleAiFotoFileChange}
              style={aiFotoDataUrl ? { marginTop: '0.5rem' } : { display: 'none' }}
            />
          </div>

          <div className="form-field form-grid--full">
            <button
              type="button"
              className="aifoto-analyze-btn"
              disabled={aiFotoAnalyzing || !aiFotoDataUrl}
              onClick={() => void handleAiFotoAnalyze()}
            >
              {aiFotoAnalyzing ? '⏳ Menganalisa foto...' : '✨ Start — Analisa Foto dengan AI'}
            </button>
          </div>
        </div>
      </Modal>

      <Modal
        open={jenisModalMode !== null}
        title={
          jenisModalMode === 'add'
            ? 'Tambah Jenis Pemeriksaan, Harga & Sharing'
            : 'Ubah Jenis Pemeriksaan, Harga & Sharing'
        }
        onClose={() => setJenisModalMode(null)}
        size="md"
      >
        <form onSubmit={(e) => void onSubmitEditJenis(e)} style={{ display: 'flex', flexDirection: 'column', gap: '1rem', padding: '0.25rem 0' }}>
          {jenisError ? <div className="alert alert--error">{jenisError}</div> : null}
          <div className="form-field">
            <label htmlFor="edit-jenis-nama">Nama Jenis Pemeriksaan</label>
            <input
              id="edit-jenis-nama"
              type="text"
              value={editingJenisNama}
              onChange={(e) => setEditingJenisNama(e.target.value)}
              required
            />
          </div>
          <div className="form-field">
            <label htmlFor="edit-jenis-harga">Harga Layanan (Rp)</label>
            <input
              id="edit-jenis-harga"
              type="number"
              min="0"
              step="1"
              value={editingJenisHarga}
              onChange={(e) => setEditingJenisHarga(e.target.value)}
              required
            />
          </div>
          <div className="form-field">
            <label htmlFor="edit-jenis-jumlah-film">Jumlah Film</label>
            <input
              id="edit-jenis-jumlah-film"
              type="number"
              min="1"
              step="1"
              value={editingJenisJumlahFilm}
              onChange={(e) => setEditingJenisJumlahFilm(e.target.value)}
              required
            />
          </div>
          <div className="form-field">
            <label>Ketentuan Sharing Dokter (Otomatis)</label>
            <div
              style={{
                padding: '0.6rem 0.8rem',
                backgroundColor: '#f0f9ff',
                border: '1px solid #bae6fd',
                borderRadius: '6px',
                color: '#0369a1',
                fontWeight: 600,
              }}
            >
              Otomatis (
              {formatRupiah(
                Number(
                  computeAutoSharingAmount(
                    selectedDokter?.nama,
                    [editingJenisNama],
                    umurYears,
                    selectedDokter?.defaultSharingAmount || '0',
                  ),
                ) || 0,
              )}
              ) — Sesuai Usia &amp; Pemeriksaan
            </div>
          </div>
          <ModalFormFooter
            onCancel={() => setJenisModalMode(null)}
            submitLabel={jenisModalMode === 'add' ? 'Tambah' : 'Simpan perubahan'}
            loading={savingJenis}
          />
        </form>
      </Modal>

      <Modal open={bhpModalOpen} title="Tambah Data BHP Radiologi" onClose={() => setBhpModalOpen(false)}>
        <form onSubmit={(e) => void handleBhpSubmit(e)} className="form-grid">
          {bhpError ? (
            <div className="alert alert--error form-field--full">{bhpError}</div>
          ) : null}
          <div className="form-field form-field--full">
            <label htmlFor="bhp-quick-pemakaian">Pemakaian *</label>
            <input
              id="bhp-quick-pemakaian"
              required
              placeholder="Contoh: Pemakaian BHP Rontgen Thorax"
              value={bhpForm.pemakaian}
              onChange={(e) => setBhpForm((f) => ({ ...f, pemakaian: e.target.value }))}
            />
          </div>
          <div className="form-field">
            <label htmlFor="bhp-quick-tanggal">Tanggal *</label>
            <input
              id="bhp-quick-tanggal"
              type="date"
              required
              value={bhpForm.tanggal}
              onChange={(e) => setBhpForm((f) => ({ ...f, tanggal: e.target.value }))}
            />
          </div>
          <div className="form-field">
            <label htmlFor="bhp-quick-harga">Harga (Rp)</label>
            <input
              id="bhp-quick-harga"
              type="number"
              min="0"
              step="1"
              value={bhpForm.harga}
              onChange={(e) => setBhpForm((f) => ({ ...f, harga: e.target.value }))}
            />
          </div>
          <div className="form-field">
            <label htmlFor="bhp-quick-dev">Dev (Rp)</label>
            <input
              id="bhp-quick-dev"
              type="number"
              min="0"
              step="1"
              value={bhpForm.dev}
              onChange={(e) => setBhpForm((f) => ({ ...f, dev: e.target.value }))}
            />
          </div>
          <div className="form-field">
            <label htmlFor="bhp-quick-fixer">Fixer (Rp)</label>
            <input
              id="bhp-quick-fixer"
              type="number"
              min="0"
              step="1"
              value={bhpForm.fixer}
              onChange={(e) => setBhpForm((f) => ({ ...f, fixer: e.target.value }))}
            />
          </div>
          <div className="form-field">
            <label htmlFor="bhp-quick-film">Film Setiap Pemeriksaan (Rp)</label>
            <input
              id="bhp-quick-film"
              type="number"
              min="0"
              step="1"
              value={bhpForm.film}
              onChange={(e) => setBhpForm((f) => ({ ...f, film: e.target.value }))}
            />
          </div>
          <div className="form-field">
            <label htmlFor="bhp-quick-amplop-kertas">Amplop Kertas (Rp)</label>
            <input
              id="bhp-quick-amplop-kertas"
              type="number"
              min="0"
              step="1"
              value={bhpForm.amplopKertas}
              onChange={(e) => setBhpForm((f) => ({ ...f, amplopKertas: e.target.value }))}
            />
          </div>
          <div className="form-field">
            <label htmlFor="bhp-quick-listrik">Listrik (Rp)</label>
            <input
              id="bhp-quick-listrik"
              type="number"
              min="0"
              step="1"
              value={bhpForm.listrik}
              onChange={(e) => setBhpForm((f) => ({ ...f, listrik: e.target.value }))}
            />
          </div>
          <div className="form-field">
            <label htmlFor="bhp-quick-gaji-karyawan">Gaji Karyawan (Rp)</label>
            <input
              id="bhp-quick-gaji-karyawan"
              type="number"
              min="0"
              step="1"
              value={bhpForm.gajiKaryawan}
              onChange={(e) => setBhpForm((f) => ({ ...f, gajiKaryawan: e.target.value }))}
            />
          </div>
          <div className="form-field">
            <label htmlFor="bhp-quick-kertas-cetak">Kertas Cetak (Rp)</label>
            <input
              id="bhp-quick-kertas-cetak"
              type="number"
              min="0"
              step="1"
              value={bhpForm.kertasCetak}
              onChange={(e) => setBhpForm((f) => ({ ...f, kertasCetak: e.target.value }))}
            />
          </div>
          <div className="form-field">
            <label htmlFor="bhp-quick-amplop">Amplop (Rp)</label>
            <input
              id="bhp-quick-amplop"
              type="number"
              min="0"
              step="1"
              value={bhpForm.amplop}
              onChange={(e) => setBhpForm((f) => ({ ...f, amplop: e.target.value }))}
            />
          </div>
          <ModalFormFooter
            onCancel={() => setBhpModalOpen(false)}
            submitLabel="Simpan"
            loading={savingBhp}
          />
        </form>
      </Modal>
    </>
  );
}
