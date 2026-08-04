import { ListRefreshProvider } from './context/ListRefreshContext.tsx';
import { MusicPlayerProvider } from './context/MusicPlayerContext.tsx';
import { AppShell } from './components/layout/AppShell.tsx';
import { PdfPreviewHost } from './pdf/pdfPreviewHost.tsx';
import { DASHBOARD_NAV_ID, getNavLabel, isViewAllowedForRole, type AppViewId } from './config/navigation.ts';
import { useAppNavigation } from './hooks/useAppNavigation.ts';
import { clearStoredAuthUser, loadStoredAuthUser, storeAuthUser, type AuthUser } from './lib/auth.ts';
import { DashboardPage } from './pages/DashboardPage.tsx';
import { DokterPage } from './pages/DokterPage.tsx';
import { KaryawanKlinikPage } from './pages/KaryawanKlinikPage.tsx';
import { TandaTanganElektronikPage } from './pages/TandaTanganElektronikPage.tsx';
import { JenisPemeriksaanPage } from './pages/JenisPemeriksaanPage.tsx';
import { KesanPage } from './pages/KesanPage.tsx';
import { LaboratoriumPage } from './pages/LaboratoriumPage.tsx';
import { LabDuplikatPage } from './pages/LabDuplikatPage.tsx';
import { HargaPemeriksaanLabPage } from './pages/HargaPemeriksaanLabPage.tsx';
import { PaketLabMasterPage } from './pages/PaketLabMasterPage.tsx';
import { KlasifikasiPaketPage } from './pages/KlasifikasiPaketPage.tsx';
import { HitunganLedPage } from './pages/HitunganLedPage.tsx';
import { MusikPage } from './pages/MusikPage.tsx';
import { FatraPage } from './pages/FatraPage.tsx';
import { PendaftaranUmumPage } from './pages/PendaftaranUmumPage.tsx';
import { TransferPage } from './pages/TransferPage.tsx';
import { DaftarTelponPage } from './pages/DaftarTelponPage.tsx';
import { KalenderPage } from './pages/KalenderPage.tsx';
import { WhatsAppPage } from './pages/WhatsAppPage.tsx';
import { LoginPage } from './pages/LoginPage.tsx';
import { PasienPage } from './pages/PasienPage.tsx';
import { PetugasLabPage } from './pages/PetugasLabPage.tsx';
import { RadiologMasterPage } from './pages/RadiologMasterPage.tsx';
import { RadiograferPage } from './pages/RadiograferPage.tsx';
import { KondisiAlatPage } from './pages/KondisiAlatPage.tsx';
import { LogbookPasienPage } from './pages/LogbookPasienPage.tsx';
import { GajiKaryawanPage } from './pages/GajiKaryawanPage.tsx';
import { KaryawanPage } from './pages/KaryawanPage.tsx';
import { AdvantagePage } from './pages/AdvantagePage.tsx';
import { BhpRadiologiPage } from './pages/BhpRadiologiPage.tsx';
import { RadiologDuplikatPage } from './pages/RadiologDuplikatPage.tsx';
import { RadiologWorkPage } from './pages/RadiologWorkPage.tsx';
import { CetakALPage } from './pages/CetakALPage.tsx';
import { CetakLabLabPage } from './pages/CetakLabLabPage.tsx';
import { KwitansiRadiologiPage } from './pages/KwitansiRadiologiPage.tsx';
import { KwitansiLaboratoriumPage } from './pages/KwitansiLaboratoriumPage.tsx';
import { SharingArsipPage } from './pages/SharingArsipPage.tsx';
import { RolePage } from './pages/RolePage.tsx';
import { SharingPage } from './pages/SharingPage.tsx';
import { LaporanTahunanPage } from './pages/LaporanTahunanPage.tsx';
import { LaporanPajakPage } from './pages/LaporanPajakPage.tsx';
import { LaporanPajakBulananPage } from './pages/LaporanPajakBulananPage.tsx';
import { LaporanNeracaPage } from './pages/LaporanNeracaPage.tsx';
import { TempletPage } from './pages/TempletPage.tsx';
import { AnalisaFotoRontgenPage } from './pages/AnalisaFotoRontgenPage.tsx';
import { AdminPage } from './pages/AdminPage.tsx';
import { FarmasiBhpPage } from './pages/FarmasiBhpPage.tsx';
import { AbsensiPage } from './pages/AbsensiPage.tsx';
import { KeuanganPembukuanPage } from './pages/KeuanganPembukuanPage.tsx';
import { PetugasKasirPage } from './pages/PetugasKasirPage.tsx';
import { PetugasAdminKlinikPage } from './pages/PetugasAdminKlinikPage.tsx';
import { AdminPendaftaranPage } from './pages/AdminPendaftaranPage.tsx';
import { LogoPerusahaanPage } from './pages/LogoPerusahaanPage.tsx';
import { AnatomiPage } from './pages/AnatomiPage.tsx';
import { useState } from 'react';

function AccessDenied({ viewId }: { readonly viewId: AppViewId }) {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '0.75rem',
        padding: '4rem 2rem',
        textAlign: 'center',
        color: 'var(--color-text-muted)',
      }}
    >
      <h2 style={{ margin: 0, color: 'var(--color-text)' }}>Akses ditolak</h2>
      <p style={{ margin: 0 }}>
        Akun Anda (Pekerja) tidak memiliki akses ke halaman &quot;{getNavLabel(viewId)}&quot;. Hubungi
        manajemen jika Anda memerlukan akses ini.
      </p>
    </div>
  );
}

function renderView(viewId: AppViewId, role: 'ADMIN' | 'KARYAWAN', navigate: (view: AppViewId) => void) {
  if (!isViewAllowedForRole(viewId, role)) {
    return <AccessDenied viewId={viewId} />;
  }

  switch (viewId) {
    case DASHBOARD_NAV_ID:
      return <DashboardPage />;
    case 'templet':
      return <TempletPage />;
    case 'musik-ph':
      return <MusikPage />;
    case 'fatra':
      return <FatraPage />;
    case 'pasien':
      return <PasienPage />;
    case 'pendaftaran-umum':
      return <PendaftaranUmumPage />;
    case 'transfer':
      return <TransferPage />;
    case 'daftar-telpon':
      return <DaftarTelponPage />;
    case 'kalender':
      return <KalenderPage />;
    case 'whatsapp':
      return <WhatsAppPage />;
    case 'harga-pemeriksaan-lab':
      return <HargaPemeriksaanLabPage />;
    case 'lab':
      return <LaboratoriumPage onNavigate={navigate} />;
    case 'lab-duplikat':
      return <LabDuplikatPage />;
    case 'kwitansi-laboratorium':
      return <KwitansiLaboratoriumPage />;
    case 'sharing-lab':
      return <SharingArsipPage modul="LABORATORIUM" />;
    case 'paket-lab-master':
      return <PaketLabMasterPage />;
    case 'petugas-lab-master':
      return <PetugasLabPage />;
    case 'klasifikasi-paket':
      return <KlasifikasiPaketPage />;
    case 'hitungan-led':
      return <HitunganLedPage />;
    case 'sharing':
      return <SharingPage />;
    case 'laporan-tahunan':
      return <LaporanTahunanPage />;
    case 'laporan-pajak':
      return <LaporanPajakPage />;
    case 'laporan-pajak-bulanan':
      return <LaporanPajakBulananPage />;
    case 'laporan-pajak-lab':
      return <LaporanPajakPage modul="LABORATORIUM" />;
    case 'laporan-pajak-bulanan-lab':
      return <LaporanPajakBulananPage modul="LABORATORIUM" />;
    case 'laporan-neraca':
      return <LaporanNeracaPage />;
    case 'neracarad':
      return <LaporanNeracaPage modul="RADIOLOGI" />;
    case 'radiolog':
      return <RadiologWorkPage />;
    case 'radiolog-duplikat':
      return <RadiologDuplikatPage />;
    case 'kwitansi-radiologi':
      return <KwitansiRadiologiPage />;
    case 'sharing-radiologi':
      return <SharingArsipPage modul="RADIOLOGI" />;
    case 'cetak-al':
      return <CetakALPage />;
    case 'cetak-amplop-lab':
      return <CetakLabLabPage mode="amplop" />;
    case 'cetak-label-lab':
      return <CetakLabLabPage mode="label" />;
    case 'dokter':
      return <DokterPage />;
    case 'karyawan-klinik':
      return <KaryawanKlinikPage />;
    case 'tanda-tangan-elektronik':
      return <TandaTanganElektronikPage />;
    case 'jenis-pemeriksaan':
      return <JenisPemeriksaanPage />;
    case 'kesan':
      return <KesanPage />;
    case 'radiolog-master':
      return <RadiologMasterPage />;
    case 'radiografer':
      return <RadiograferPage />;
    case 'kondisi-alat':
      return <KondisiAlatPage />;
    case 'logbook-pasien':
      return <LogbookPasienPage />;
    case 'gaji-karyawan':
      return <GajiKaryawanPage />;
    case 'karyawan-radiologi':
      return <KaryawanPage departemen="RADIOLOGI" />;
    case 'karyawan-laboratorium':
      return <KaryawanPage departemen="LABORATORIUM" />;
    case 'advantage':
      return <AdvantagePage />;
    case 'bhp-radiologi':
      return <BhpRadiologiPage />;
    case 'analisa-foto-rontgen':
      return <AnalisaFotoRontgenPage />;
    case 'role':
      return <RolePage />;
    case 'admin':
      return <AdminPage />;
    case 'farmasi-bhp':
      return <FarmasiBhpPage />;
    case 'absensi':
      return <AbsensiPage />;
    case 'keuangan-pembukuan':
      return <KeuanganPembukuanPage />;
    case 'petugas-kasir':
      return <PetugasKasirPage />;
    case 'petugas-admin-klinik':
      return <PetugasAdminKlinikPage />;
    case 'logo-perusahaan':
      return <LogoPerusahaanPage />;
    case 'admin-pendaftaran':
      return <AdminPendaftaranPage />;
    case 'anatomi-thorak':
      return <AnatomiPage regio="thorak" />;
    case 'anatomi-kepala':
      return <AnatomiPage regio="kepala" />;
    case 'anatomi-ossa-manus':
      return <AnatomiPage regio="ossa-manus" />;
    case 'anatomi-anthebrachi':
      return <AnatomiPage regio="anthebrachi" />;
    case 'anatomi-shoulder-joint':
      return <AnatomiPage regio="shoulder-joint" />;
    case 'anatomi-lumbosacral':
      return <AnatomiPage regio="lumbosacral" />;
    case 'anatomi-bno':
      return <AnatomiPage regio="bno" />;
    case 'anatomi-femur':
      return <AnatomiPage regio="femur" />;
    case 'anatomi-cruris':
      return <AnatomiPage regio="cruris" />;
    case 'anatomi-ankle-joint':
      return <AnatomiPage regio="ankle-joint" />;
    case 'anatomi-pedis':
      return <AnatomiPage regio="pedis" />;
    default:
      return <DashboardPage />;
  }
}

export function App() {
  const { activeView, navigate } = useAppNavigation();
  const [authUser, setAuthUser] = useState<AuthUser | null>(() => loadStoredAuthUser());

  function handleLogin(user: AuthUser): void {
    storeAuthUser(user);
    setAuthUser(user);
  }

  function handleLogout(): void {
    clearStoredAuthUser();
    setAuthUser(null);
  }

  if (!authUser) {
    return <LoginPage onLogin={handleLogin} />;
  }

  return (
    <ListRefreshProvider>
      <MusicPlayerProvider>
        <PdfPreviewHost>
          <AppShell activeView={activeView} authUser={authUser} onNavigate={navigate} onLogout={handleLogout}>
            {renderView(activeView, authUser.role, navigate)}
          </AppShell>
        </PdfPreviewHost>
      </MusicPlayerProvider>
    </ListRefreshProvider>
  );
}
