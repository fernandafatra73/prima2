import { useState, useEffect, useCallback } from 'react';
import { apiGet, apiPost, apiPut } from '../lib/api.ts';
import { Modal } from '../components/ui/Modal.tsx';
import { ModalFormFooter } from '../components/ui/ModalFormFooter.tsx';
import '../components/ui/ui.css';

export interface PaketLabItemData {
  id: string;
  paketId: string;
  grup: string | null;
  pemeriksaan: string;
  nilaiRujukan: string;
  satuan?: string;
  harga?: string;
  urutan: number;
}

export interface PaketLabData {
  id: string;
  nama: string;
  urutan: number;
  items: PaketLabItemData[];
}

const KLASIFIKASI_TABS = [
  'Hematologi',
  'Diffcount',
  'Kimia darah',
  'Diabetes',
  'Imunologi',
  'Urinalisa',
  'Urine rutin',
  'Laju Endap Darah',
  'Widal',
] as const;

interface TableRowItem {
  id: string;
  paketId: string;
  klasifikasi: string;
  grup: string | null;
  pemeriksaan: string;
  nilaiRujukan: string;
  satuan?: string;
  harga?: string;
  urutan: number;
  pkgIdx: number;
  origIdx: number;
}

export function KlasifikasiPaketPage() {
  const [, setPaketList] = useState<PaketLabData[]>([]);
  const [editablePaketList, setEditablePaketList] = useState<PaketLabData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [activeTab, setActiveTab] = useState<string>(KLASIFIKASI_TABS[0]);
  const [searchQuery, setSearchQuery] = useState('');

  const [savingPackageId, setSavingPackageId] = useState<string | null>(null);
  const [initLoading, setInitLoading] = useState(false);
  const [saveSuccessMsg, setSaveSuccessMsg] = useState<string | null>(null);

  // Modal tambah item
  const [showAddModal, setShowAddModal] = useState(false);
  const [targetPaketId, setTargetPaketId] = useState<string>('');
  const [newPemeriksaan, setNewPemeriksaan] = useState('');
  const [newSatuan, setNewSatuan] = useState('');
  const [newNilaiRujukan, setNewNilaiRujukan] = useState('');
  const [newHarga, setNewHarga] = useState('0');
  const [modalError, setModalError] = useState<string | null>(null);

  const fetchPaketList = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await apiGet<{ items: PaketLabData[] }>('/api/paket-lab');
      setPaketList(res.items);
      setEditablePaketList(JSON.parse(JSON.stringify(res.items)));
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Gagal memuat daftar klasifikasi paket.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPaketList();
  }, [fetchPaketList]);

  const handleInitDefaults = async () => {
    setInitLoading(true);
    setError(null);
    try {
      await apiPost('/api/paket-lab/init-defaults', {});
      await fetchPaketList();
      setSaveSuccessMsg('Berhasil menginisialisasi 8 Paket Langsung Jadi Laboratorium.');
      setTimeout(() => setSaveSuccessMsg(null), 4000);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Gagal menginisialisasi paket.');
    } finally {
      setInitLoading(false);
    }
  };

  const handleFieldChange = (
    pkgIdx: number,
    origIdx: number,
    field: 'pemeriksaan' | 'nilaiRujukan' | 'satuan' | 'harga',
    value: string,
  ) => {
    setEditablePaketList((prev) => {
      const copy = JSON.parse(JSON.stringify(prev)) as PaketLabData[];
      const pkg = copy[pkgIdx];
      if (pkg && pkg.items[origIdx]) {
        if (field === 'harga') {
          const num = value.replace(/[^0-9]/g, '');
          pkg.items[origIdx].harga = num;
        } else {
          pkg.items[origIdx][field] = value;
        }
      }
      return copy;
    });
  };

  const handleDeleteItem = (pkgIdx: number, origIdx: number) => {
    setEditablePaketList((prev) => {
      const copy = JSON.parse(JSON.stringify(prev)) as PaketLabData[];
      const pkg = copy[pkgIdx];
      if (pkg) {
        pkg.items.splice(origIdx, 1);
        pkg.items.forEach((item, idx) => {
          item.urutan = idx;
        });
      }
      return copy;
    });
  };

  const handleSavePackage = async (paket: PaketLabData) => {
    setSavingPackageId(paket.id);
    setError(null);
    try {
      const cleanItems = paket.items.map((it, idx) => ({
        grup: it.grup || null,
        pemeriksaan: it.pemeriksaan.trim() || 'Pemeriksaan Tanpa Nama',
        nilaiRujukan: it.nilaiRujukan?.trim() || '',
        satuan: it.satuan?.trim() || '',
        harga: parseInt(it.harga || '0', 10) || 0,
        urutan: idx,
      }));
      await apiPut(`/api/paket-lab/${paket.id}/items`, { items: cleanItems });
      setSaveSuccessMsg(`Berhasil menyimpan perubahan pada klasifikasi: ${paket.nama}`);
      setTimeout(() => setSaveSuccessMsg(null), 4000);
      await fetchPaketList();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Gagal menyimpan perubahan.');
    } finally {
      setSavingPackageId(null);
    }
  };

  const handleSaveAllVisible = async () => {
    setLoading(true);
    setError(null);
    try {
      for (const p of editablePaketList) {
        const payloadItems = p.items.map((it, idx) => ({
          grup: it.grup || p.nama,
          pemeriksaan: it.pemeriksaan,
          nilaiRujukan: it.nilaiRujukan,
          satuan: it.satuan || '',
          harga: parseInt(it.harga || '0', 10) || 0,
          urutan: idx,
        }));
        await apiPut(`/api/paket-lab/${p.id}/items`, { items: payloadItems });
      }
      setSaveSuccessMsg('Semua perubahan pada klasifikasi dan nilai rujukan berhasil disimpan!');
      setTimeout(() => setSaveSuccessMsg(null), 4000);
      await fetchPaketList();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Gagal menyimpan perubahan.');
    } finally {
      setLoading(false);
    }
  };

  const flattenAllItems = (list: PaketLabData[]): TableRowItem[] => {
    const all: TableRowItem[] = [];
    list.forEach((pkg, pIndex) => {
      let kName = pkg.nama.trim();
      if (kName.toLowerCase().includes('hematologi')) kName = 'Hematologi';
      else if (kName.toLowerCase().includes('kimia darah')) kName = 'Kimia darah';
      else if (kName.toLowerCase().includes('diabetes')) kName = 'Diabetes';
      else if (kName.toLowerCase().includes('imunologi')) kName = 'Imunologi';
      else if (kName.toLowerCase().includes('urin rutin')) kName = 'Urine rutin';
      else if (kName.toLowerCase().includes('urinalisa')) kName = 'Urinalisa';
      else if (kName.toLowerCase().includes('diffcount')) kName = 'Diffcount';
      else if (kName.toLowerCase().includes('laju endap darah')) kName = 'Laju Endap Darah';
      else if (kName.toLowerCase().includes('widal')) kName = 'Widal';

      pkg.items.forEach((it, iIndex) => {
        all.push({
          id: it.id,
          paketId: pkg.id,
          klasifikasi: kName,
          grup: it.grup,
          pemeriksaan: it.pemeriksaan,
          nilaiRujukan: it.nilaiRujukan || '',
          satuan: it.satuan || '',
          harga: it.harga || '0',
          urutan: it.urutan,
          pkgIdx: pIndex,
          origIdx: iIndex,
        });
      });
    });
    return all;
  };

  const getFilteredItems = (): TableRowItem[] => {
    let all = flattenAllItems(editablePaketList);

    all = all.filter((item) => {
      const itemKlas = item.klasifikasi.toLowerCase();
      const tabKlas = activeTab.toLowerCase();
      if (tabKlas === 'hematologi') return itemKlas.includes('hematologi');
      if (tabKlas === 'kimia darah') return itemKlas.includes('kimia');
      if (tabKlas === 'diabetes') return itemKlas.includes('diabetes');
      if (tabKlas === 'imunologi') return itemKlas.includes('imunologi');
      if (tabKlas === 'urine rutin') return itemKlas.includes('rutin') || itemKlas.includes('urine rutin');
      if (tabKlas === 'urinalisa') return itemKlas.includes('urinalisa') || itemKlas.includes('urine');
      return itemKlas === tabKlas;
    });

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      all = all.filter(
        (it) =>
          it.pemeriksaan.toLowerCase().includes(q) ||
          it.klasifikasi.toLowerCase().includes(q) ||
          it.satuan?.toLowerCase().includes(q) ||
          it.nilaiRujukan.toLowerCase().includes(q),
      );
    }

    return all;
  };

  const handleClearActivePackage = async () => {
    const activePkg = editablePaketList.find((p) => p.nama.toLowerCase() === activeTab.toLowerCase());
    if (!activePkg) return;
    if (!window.confirm(`Yakin ingin mengosongkan semua pemeriksaan pada klasifikasi "${activePkg.nama}"?`)) return;
    setLoading(true);
    setError(null);
    try {
      await apiPut(`/api/paket-lab/${activePkg.id}/items`, { items: [] });
      setSaveSuccessMsg(`Berhasil mengosongkan pemeriksaan pada klasifikasi "${activePkg.nama}".`);
      setTimeout(() => setSaveSuccessMsg(null), 4000);
      await fetchPaketList();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Gagal mengosongkan pemeriksaan pada klasifikasi ini.');
    } finally {
      setLoading(false);
    }
  };

  const handleClearAllPackages = async () => {
    if (!window.confirm('Yakin ingin menghapus semua pemeriksaan dari seluruh klasifikasi paket lab?')) return;
    setLoading(true);
    setError(null);
    try {
      for (const p of editablePaketList) {
        await apiPut(`/api/paket-lab/${p.id}/items`, { items: [] });
      }
      setSaveSuccessMsg('Berhasil menghapus / mengosongkan seluruh klasifikasi paket pemeriksaan lab.');
      setTimeout(() => setSaveSuccessMsg(null), 4000);
      await fetchPaketList();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Gagal menghapus semua item klasifikasi.');
    } finally {
      setLoading(false);
    }
  };

  const handleOpenAddModal = (defaultPaketId?: string) => {
    setModalError(null);
    const pid = defaultPaketId || (editablePaketList.length > 0 ? editablePaketList[0].id : '');
    setTargetPaketId(pid);
    setNewPemeriksaan('');
    setNewSatuan('');
    setNewNilaiRujukan('');
    setNewHarga('0');
    setShowAddModal(true);
  };

  const handleConfirmAddItem = () => {
    if (!newPemeriksaan.trim()) {
      setModalError('Nama pemeriksaan wajib diisi.');
      return;
    }
    setEditablePaketList((prev) => {
      const copy = JSON.parse(JSON.stringify(prev)) as PaketLabData[];
      const pkg = copy.find((p) => p.id === targetPaketId);
      if (pkg) {
        pkg.items.push({
          id: `tmp_${Date.now()}_${Math.random()}`,
          paketId: targetPaketId,
          grup: pkg.nama,
          pemeriksaan: newPemeriksaan.trim(),
          satuan: newSatuan.trim(),
          nilaiRujukan: newNilaiRujukan.trim(),
          harga: newHarga || '0',
          urutan: pkg.items.length,
        });
      }
      return copy;
    });
    setShowAddModal(false);
  };

  const filteredItems = getFilteredItems();

  return (
    <div className="view-container">
      <div className="view-header" style={{ borderBottom: '2px solid #0284c7', paddingBottom: '16px', marginBottom: '20px' }}>
        <div>
          <h1 className="view-title" style={{ color: '#0369a1', fontWeight: 800 }}>
            Klasifikasi Paket & Nilai Rujukan Laboratorium
          </h1>
          <p className="view-subtitle" style={{ color: '#475569' }}>
            Daftar Paket Langsung Jadi: <b>Hematologi, Diffcount, Kimia darah, Diabetes, Imunologi, Urinalisa, Urine Rutin, Laju Endap Darah, dan Widal</b> lengkap dengan pemeriksaan, hasil (satuan), nilai rujukan, dan harga.
          </p>
        </div>

        <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
          <button
            type="button"
            onClick={handleInitDefaults}
            disabled={initLoading || loading}
            style={{
              padding: '10px 16px',
              backgroundColor: '#e0f2fe',
              color: '#0369a1',
              border: '2px solid #38bdf8',
              borderRadius: '8px',
              fontWeight: 700,
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              boxShadow: '0 2px 4px rgba(14, 165, 233, 0.15)',
            }}
          >
            {initLoading ? '⚡ Memproses...' : '⚡ Inisialisasi 9 Paket Langsung Jadi'}
          </button>

          <button
            type="button"
            onClick={() => handleOpenAddModal()}
            style={{
              padding: '10px 16px',
              backgroundColor: '#0284c7',
              color: '#ffffff',
              border: 'none',
              borderRadius: '8px',
              fontWeight: 700,
              cursor: 'pointer',
              boxShadow: '0 2px 4px rgba(2, 132, 199, 0.25)',
            }}
          >
            + Tambah Pemeriksaan Baru
          </button>

          <button
            type="button"
            onClick={handleSaveAllVisible}
            disabled={loading || filteredItems.length === 0}
            style={{
              padding: '10px 18px',
              backgroundColor: '#0369a1',
              color: '#ffffff',
              border: 'none',
              borderRadius: '8px',
              fontWeight: 700,
              cursor: 'pointer',
              boxShadow: '0 2px 6px rgba(3, 105, 161, 0.3)',
            }}
          >
            💾 Simpan Semua Perubahan
          </button>

          <button
            type="button"
            onClick={handleClearActivePackage}
            disabled={loading}
            style={{
              padding: '10px 14px',
              backgroundColor: '#fee2e2',
              color: '#b91c1c',
              border: '1px solid #f87171',
              borderRadius: '8px',
              fontWeight: 700,
              cursor: 'pointer',
            }}
          >
            🗑️ Kosongkan Klasifikasi Ini
          </button>

          <button
            type="button"
            onClick={handleClearAllPackages}
            disabled={loading}
            style={{
              padding: '10px 14px',
              backgroundColor: '#fef2f2',
              color: '#991b1b',
              border: '1px solid #ef4444',
              borderRadius: '8px',
              fontWeight: 700,
              cursor: 'pointer',
            }}
          >
            ⚠️ Hapus Semua Pemeriksaan
          </button>
        </div>
      </div>

      {error && (
        <div
          style={{
            backgroundColor: '#fee2e2',
            color: '#991b1b',
            padding: '12px 16px',
            borderRadius: '8px',
            marginBottom: '16px',
            borderLeft: '4px solid #ef4444',
            fontWeight: 600,
          }}
        >
          {error}
        </div>
      )}

      {saveSuccessMsg && (
        <div
          style={{
            backgroundColor: '#d0f8ce',
            color: '#15803d',
            padding: '12px 16px',
            borderRadius: '8px',
            marginBottom: '16px',
            borderLeft: '4px solid #22c55e',
            fontWeight: 600,
          }}
        >
          {saveSuccessMsg}
        </div>
      )}

      {/* Tab bar untuk Klasifikasi */}
      <div
        style={{
          display: 'flex',
          gap: '8px',
          overflowX: 'auto',
          borderBottom: '2px solid #bae6fd',
          paddingBottom: '12px',
          marginBottom: '20px',
        }}
      >
        {KLASIFIKASI_TABS.map((tab) => {
          const isActive = activeTab === tab;
          return (
            <button
              key={tab}
              type="button"
              onClick={() => setActiveTab(tab)}
              style={{
                padding: '10px 18px',
                borderRadius: '8px',
                border: isActive ? '2px solid #0284c7' : '1px solid #e2e8f0',
                backgroundColor: isActive ? '#e0f2fe' : '#ffffff',
                color: isActive ? '#0369a1' : '#64748b',
                fontWeight: isActive ? 800 : 600,
                cursor: 'pointer',
                whiteSpace: 'nowrap',
                transition: 'all 0.15s ease',
                boxShadow: isActive ? '0 2px 4px rgba(2, 132, 199, 0.15)' : 'none',
              }}
            >
              {tab}
            </button>
          );
        })}
      </div>

      {/* Search Input & Info Summary */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: '16px',
          marginBottom: '16px',
          flexWrap: 'wrap',
        }}
      >
        <div style={{ position: 'relative', flex: '1 1 320px', maxWidth: '420px' }}>
          <input
            type="text"
            placeholder="Cari pemeriksaan, klasifikasi, hasil, atau nilai rujukan..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{
              width: '100%',
              padding: '10px 14px 10px 38px',
              borderRadius: '8px',
              border: '2px solid #bae6fd',
              fontSize: '14px',
              outline: 'none',
              backgroundColor: '#f8fafc',
            }}
          />
          <span style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#0369a1' }}>
            🔍
          </span>
        </div>

        <div style={{ color: '#334155', fontWeight: 600, fontSize: '14px' }}>
          Menampilkan <span style={{ color: '#0369a1', fontWeight: 800 }}>{filteredItems.length}</span> pemeriksaan dalam klasifikasi ini
        </div>
      </div>

      {/* Tabel Klasifikasi & Nilai Rujukan */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: '48px', color: '#64748b' }}>Memuat data klasifikasi laboratorium...</div>
      ) : filteredItems.length === 0 ? (
        <div
          style={{
            textAlign: 'center',
            padding: '48px',
            backgroundColor: '#f8fafc',
            borderRadius: '12px',
            border: '2px dashed #bae6fd',
          }}
        >
          <p style={{ color: '#475569', fontSize: '16px', marginBottom: '16px', fontWeight: 600 }}>
            Belum ada item pemeriksaan untuk klasifikasi: <b>{activeTab}</b>
          </p>
          <button
            type="button"
            onClick={handleInitDefaults}
            style={{
              padding: '10px 20px',
              backgroundColor: '#0284c7',
              color: '#ffffff',
              border: 'none',
              borderRadius: '8px',
              fontWeight: 700,
              cursor: 'pointer',
            }}
          >
            ⚡ Klik untuk Inisialisasi Paket Langsung Jadi
          </button>
        </div>
      ) : (
        <div style={{ overflowX: 'auto', borderRadius: '10px', border: '1px solid #bae6fd', boxShadow: '0 2px 8px rgba(0,0,0,0.04)' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', backgroundColor: '#ffffff' }}>
            <thead>
              <tr style={{ backgroundColor: '#0284c7', color: '#ffffff', textAlign: 'left', fontSize: '14px' }}>
                <th style={{ padding: '14px 12px', width: '50px', textAlign: 'center' }}>No</th>
                <th style={{ padding: '14px 12px', width: '170px' }}>Klasifikasi Paket</th>
                <th style={{ padding: '14px 12px', width: '260px' }}>Pemeriksaan</th>
                <th style={{ padding: '14px 12px', width: '180px' }}>Hasil (Satuan/Format)</th>
                <th style={{ padding: '14px 12px', width: '220px' }}>Nilai Rujukan / Normal</th>
                <th style={{ padding: '14px 12px', width: '160px', textAlign: 'right' }}>Harga (Rp)</th>
                <th style={{ padding: '14px 12px', width: '120px', textAlign: 'center' }}>Aksi</th>
              </tr>
            </thead>
            <tbody>
              {filteredItems.map((row, idx) => {
                const isOdd = idx % 2 !== 0;
                const rowBg = isOdd ? '#e0f2fe' : '#ffffff';

                return (
                  <tr
                    key={row.id}
                    style={{
                      backgroundColor: rowBg,
                      borderBottom: '1px solid #e2e8f0',
                      transition: 'background-color 0.1s ease',
                    }}
                  >
                    <td style={{ padding: '12px', textAlign: 'center', fontWeight: 600, color: '#334155' }}>
                      {idx + 1}
                    </td>

                    <td style={{ padding: '12px' }}>
                      <span
                        style={{
                          display: 'inline-block',
                          padding: '4px 10px',
                          borderRadius: '6px',
                          backgroundColor: '#bae6fd',
                          color: '#0369a1',
                          fontWeight: 700,
                          fontSize: '12px',
                        }}
                      >
                        {row.klasifikasi}
                      </span>
                    </td>

                    <td style={{ padding: '12px' }}>
                      <input
                        type="text"
                        value={row.pemeriksaan}
                        onChange={(e) => handleFieldChange(row.pkgIdx, row.origIdx, 'pemeriksaan', e.target.value)}
                        style={{
                          width: '100%',
                          padding: '6px 10px',
                          borderRadius: '6px',
                          border: '1px solid #cbd5e1',
                          fontWeight: 600,
                          color: '#0f172a',
                          backgroundColor: '#ffffff',
                        }}
                      />
                    </td>

                    <td style={{ padding: '12px' }}>
                      <input
                        type="text"
                        value={row.satuan || ''}
                        placeholder="Contoh: g/dL, U/L, %"
                        onChange={(e) => handleFieldChange(row.pkgIdx, row.origIdx, 'satuan', e.target.value)}
                        style={{
                          width: '100%',
                          padding: '6px 10px',
                          borderRadius: '6px',
                          border: '1px solid #cbd5e1',
                          color: '#0369a1',
                          fontWeight: 600,
                          backgroundColor: '#ffffff',
                        }}
                      />
                    </td>

                    <td style={{ padding: '12px' }}>
                      <input
                        type="text"
                        value={row.nilaiRujukan}
                        placeholder="Contoh: 12.0 - 16.0 / Negatif"
                        onChange={(e) => handleFieldChange(row.pkgIdx, row.origIdx, 'nilaiRujukan', e.target.value)}
                        style={{
                          width: '100%',
                          padding: '6px 10px',
                          borderRadius: '6px',
                          border: '1px solid #cbd5e1',
                          color: '#334155',
                          backgroundColor: '#ffffff',
                        }}
                      />
                    </td>

                    <td style={{ padding: '12px', textAlign: 'right' }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '4px' }}>
                        <span style={{ fontSize: '12px', color: '#64748b' }}>Rp</span>
                        <input
                          type="number"
                          value={row.harga || 0}
                          onChange={(e) => handleFieldChange(row.pkgIdx, row.origIdx, 'harga', e.target.value)}
                          style={{
                            width: '90px',
                            padding: '6px 8px',
                            textAlign: 'right',
                            borderRadius: '6px',
                            border: '1px solid #cbd5e1',
                            fontWeight: 600,
                            backgroundColor: '#ffffff',
                          }}
                        />
                      </div>
                    </td>

                    <td style={{ padding: '12px', textAlign: 'center' }}>
                      <div style={{ display: 'flex', gap: '6px', justifyContent: 'center' }}>
                        <button
                          type="button"
                          onClick={() => {
                            const pkg = editablePaketList[row.pkgIdx];
                            if (pkg) handleSavePackage(pkg);
                          }}
                          disabled={savingPackageId === row.paketId}
                          title="Simpan perubahan paket ini"
                          style={{
                            padding: '6px 10px',
                            backgroundColor: '#0284c7',
                            color: '#ffffff',
                            border: 'none',
                            borderRadius: '6px',
                            fontWeight: 700,
                            fontSize: '12px',
                            cursor: 'pointer',
                          }}
                        >
                          {savingPackageId === row.paketId ? '...' : 'Simpan'}
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteItem(row.pkgIdx, row.origIdx)}
                          title="Hapus pemeriksaan ini"
                          style={{
                            padding: '6px 8px',
                            backgroundColor: '#fee2e2',
                            color: '#dc2626',
                            border: '1px solid #f87171',
                            borderRadius: '6px',
                            fontWeight: 700,
                            fontSize: '12px',
                            cursor: 'pointer',
                          }}
                        >
                          ✕
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Modal Tambah Item Pemeriksaan */}
      {showAddModal && (
        <Modal open={showAddModal} title="Tambah Pemeriksaan ke Klasifikasi Paket" onClose={() => setShowAddModal(false)}>
          <form onSubmit={handleConfirmAddItem} style={{ display: 'flex', flexDirection: 'column', gap: '14px', padding: '8px 0' }}>
            {modalError && (
              <div
                style={{
                  backgroundColor: '#fee2e2',
                  color: '#991b1b',
                  padding: '10px 12px',
                  borderRadius: '6px',
                  fontSize: '13px',
                  fontWeight: 600,
                }}
              >
                {modalError}
              </div>
            )}

            <div>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: 700, color: '#334155', marginBottom: '6px' }}>
                Pilih Klasifikasi Paket:
              </label>
              <select
                value={targetPaketId}
                onChange={(e) => setTargetPaketId(e.target.value)}
                style={{
                  width: '100%',
                  padding: '10px',
                  borderRadius: '8px',
                  border: '2px solid #bae6fd',
                  backgroundColor: '#ffffff',
                  fontWeight: 600,
                }}
              >
                {editablePaketList.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.nama}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: 700, color: '#334155', marginBottom: '6px' }}>
                Nama Pemeriksaan (Parameter):
              </label>
              <input
                type="text"
                placeholder="Contoh: Hemoglobin / SGOT / Glukosa Puasa"
                value={newPemeriksaan}
                onChange={(e) => setNewPemeriksaan(e.target.value)}
                style={{
                  width: '100%',
                  padding: '10px',
                  borderRadius: '8px',
                  border: '2px solid #bae6fd',
                }}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: 700, color: '#334155', marginBottom: '6px' }}>
                Hasil (Satuan / Format Default):
              </label>
              <input
                type="text"
                placeholder="Contoh: g/dL, U/L, %, Negatif/Positif"
                value={newSatuan}
                onChange={(e) => setNewSatuan(e.target.value)}
                style={{
                  width: '100%',
                  padding: '10px',
                  borderRadius: '8px',
                  border: '2px solid #bae6fd',
                }}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: 700, color: '#334155', marginBottom: '6px' }}>
                Nilai Rujukan / Normal:
              </label>
              <input
                type="text"
                placeholder="Contoh: 12.0 - 16.0 / < 35 / Negatif"
                value={newNilaiRujukan}
                onChange={(e) => setNewNilaiRujukan(e.target.value)}
                style={{
                  width: '100%',
                  padding: '10px',
                  borderRadius: '8px',
                  border: '2px solid #bae6fd',
                }}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: 700, color: '#334155', marginBottom: '6px' }}>
                Harga Pemeriksaan (Rp):
              </label>
              <input
                type="number"
                placeholder="0"
                value={newHarga}
                onChange={(e) => setNewHarga(e.target.value)}
                style={{
                  width: '100%',
                  padding: '10px',
                  borderRadius: '8px',
                  border: '2px solid #bae6fd',
                }}
              />
            </div>

            <ModalFormFooter
              onCancel={() => setShowAddModal(false)}
              submitLabel="Tambah ke Klasifikasi"
            />
          </form>
        </Modal>
      )}
    </div>
  );
}
