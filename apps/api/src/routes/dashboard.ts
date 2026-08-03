import type { FastifyInstance, FastifyReply } from 'fastify';
import { Decimal } from '../generated/prisma/internal/prismaNamespace.js';
import { prisma } from '../lib/prisma.js';
import { toNumber } from '../lib/serialize.js';

function badRequest(reply: FastifyReply, message: string): FastifyReply {
  return reply.status(400).send({ error: message });
}

export async function registerDashboardRoutes(app: FastifyInstance): Promise<void> {
  app.get('/api/dashboard', async () => {
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);

    const [
      pasienHariIni,
      menungguHasil,
      selesaiHariIni,
      totalPemeriksaan,
      dokterCount,
      radiologCount,
      omzetAgg,
      sharingAgg,
      lunasCount,
      totalPasien,
    ] = await Promise.all([
      prisma.pasien.count({ where: { createdAt: { gte: startOfDay } } }),
      prisma.pasien.count({ where: { hasilStatus: 'MENUNGGU_HASIL' } }),
      prisma.pasien.count({
        where: { hasilStatus: 'SELESAI', updatedAt: { gte: startOfDay } },
      }),
      prisma.pasienPemeriksaan.count(),
      prisma.dokter.count(),
      prisma.radiolog.count(),
      prisma.pasien.aggregate({
        where: { createdAt: { gte: startOfDay } },
        _sum: { totalHarga: true },
      }),
      prisma.pasien.aggregate({
        where: { createdAt: { gte: startOfDay } },
        _sum: { totalSharing: true },
      }),
      prisma.pasien.count({ where: { paymentStatus: 'LUNAS' } }),
      prisma.pasien.count(),
    ]);

    const lunasPercent = totalPasien === 0 ? 0 : Math.round((lunasCount / totalPasien) * 100);
    const hasilSelesai = totalPasien - menungguHasil;
    const hasilPercent =
      totalPasien === 0 ? 0 : Math.round((hasilSelesai / totalPasien) * 100);

    return {
      metrics: {
        pasienHariIni,
        menungguHasil,
        selesaiHariIni,
        totalPemeriksaan,
        omzetHariIni: toNumber(omzetAgg._sum.totalHarga ?? new Decimal(0)),
        totalSharingHariIni: toNumber(sharingAgg._sum.totalSharing ?? new Decimal(0)),
        dokterPengirim: dokterCount,
        radiologAktif: radiologCount,
      },
      charts: {
        statusHasil: { menunggu: menungguHasil, selesai: hasilSelesai, percent: hasilPercent },
        statusBayar: { lunas: lunasCount, belum: totalPasien - lunasCount, percent: lunasPercent },
      },
    };
  });

  app.get<{ Querystring: { year?: string } }>('/api/laporan/tahunan', async (req) => {
    const yearStr = req.query.year || new Date().getFullYear().toString();
    const year = parseInt(yearStr, 10);
    
    if (isNaN(year)) {
      return { error: 'Tahun tidak valid' };
    }

    const startOfYear = new Date(year, 0, 1);
    const endOfYear = new Date(year, 11, 31, 23, 59, 59, 999);

    const [aggPendapatan, pasienCount, pasienRecords] = await Promise.all([
      prisma.pasien.aggregate({
        where: { createdAt: { gte: startOfYear, lte: endOfYear } },
        _sum: { totalHarga: true }
      }),
      prisma.pasien.count({
        where: { createdAt: { gte: startOfYear, lte: endOfYear } }
      }),
      prisma.pasien.findMany({
        where: { createdAt: { gte: startOfYear, lte: endOfYear } },
        select: {
          pengirim: { select: { nama: true } },
          pemeriksaan: {
            select: { jenisPemeriksaan: { select: { nama: true } } }
          }
        }
      })
    ]);

    const totalPendapatan = toNumber(aggPendapatan._sum.totalHarga ?? new Decimal(0));
    
    const countPemeriksaan = new Map<string, number>();
    const countDokter = new Map<string, number>();

    for (const p of pasienRecords) {
      const dName = p.pengirim?.nama || 'Tanpa Dokter';
      countDokter.set(dName, (countDokter.get(dName) || 0) + 1);

      for (const pem of p.pemeriksaan) {
        const pName = pem.jenisPemeriksaan?.nama || 'Unknown';
        countPemeriksaan.set(pName, (countPemeriksaan.get(pName) || 0) + 1);
      }
    }

    const pemeriksaanArr = Array.from(countPemeriksaan.entries()).map(([nama, count]) => ({ nama, count })).sort((a, b) => b.count - a.count);
    
    const dokterArr = Array.from(countDokter.entries()).map(([nama, count]) => ({
      nama,
      count,
      percentage: pasienCount > 0 ? (count / pasienCount) * 100 : 0
    })).sort((a, b) => b.count - a.count);

    return {
      year,
      totalPendapatan,
      totalPasien: pasienCount,
      pemeriksaan: pemeriksaanArr,
      dokterPengirim: dokterArr
    };
  });

  const BULAN_NAMA = [
    'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
    'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember',
  ];

  /** PPh Final UMKM (PP 23/2018): 0.5% dari total penerimaan bruto per bulan. */
  const TARIF_PAJAK_FINAL = 0.005;

  app.get<{ Querystring: { year?: string; modul?: string } }>('/api/laporan/pajak', async (req) => {
    const yearStr = req.query.year || new Date().getFullYear().toString();
    const year = parseInt(yearStr, 10);
    if (isNaN(year)) {
      return { error: 'Tahun tidak valid' };
    }
    const modul = req.query.modul === 'LABORATORIUM' ? 'LABORATORIUM' : 'RADIOLOGI';

    const startOfYear = new Date(year, 0, 1);
    const endOfYear = new Date(year, 11, 31, 23, 59, 59, 999);

    const [records, overrides] = await Promise.all([
      prisma.pasienDuplikat.findMany({
        where: { asalModul: modul, registeredAt: { gte: startOfYear, lte: endOfYear } },
        select: { registeredAt: true, totalHarga: true },
      }),
      prisma.laporanPajakOverride.findMany({ where: { year, modul } }),
    ]);

    const perBulan = Array.from({ length: 12 }, () => ({ jumlahPasien: 0, totalPenerimaan: 0 }));
    for (const r of records) {
      const idx = r.registeredAt.getMonth();
      perBulan[idx]!.jumlahPasien += 1;
      perBulan[idx]!.totalPenerimaan += toNumber(r.totalHarga);
    }

    const overrideByBulan = new Map(overrides.map((o) => [o.bulan, o]));

    const bulanData = perBulan.map((b, idx) => {
      const bulanKe = idx + 1;
      const override = overrideByBulan.get(bulanKe);
      const jumlahPasien = override ? override.jumlahPasien : b.jumlahPasien;
      const totalPenerimaan = override ? toNumber(override.totalPenerimaan) : b.totalPenerimaan;
      const harga = override
        ? toNumber(override.harga)
        : jumlahPasien > 0
          ? totalPenerimaan / jumlahPasien
          : 0;
      const pajak = totalPenerimaan * TARIF_PAJAK_FINAL;
      return {
        no: bulanKe,
        bulan: BULAN_NAMA[idx],
        jumlahPasien,
        harga,
        totalPenerimaan,
        pajak,
        isOverride: Boolean(override),
      };
    });

    const totalJumlahPasien = bulanData.reduce((s, b) => s + b.jumlahPasien, 0);
    const totalPenerimaan = bulanData.reduce((s, b) => s + b.totalPenerimaan, 0);
    const totalPajak = bulanData.reduce((s, b) => s + b.pajak, 0);

    return {
      year,
      modul,
      tarifPajak: TARIF_PAJAK_FINAL,
      bulan: bulanData,
      totalJumlahPasien,
      totalPenerimaan,
      totalPajak,
    };
  });

  /** Simpan/ubah koreksi manual satu bulan (menggantikan hasil hitung otomatis). */
  app.patch<{
    Body: {
      year: number;
      bulan: number;
      modul?: string;
      jumlahPasien: number;
      harga: number;
    };
  }>('/api/laporan/pajak/override', async (req, reply) => {
    const b = req.body;
    if (
      !Number.isInteger(b.year) ||
      !Number.isInteger(b.bulan) ||
      b.bulan < 1 ||
      b.bulan > 12 ||
      b.jumlahPasien === undefined ||
      b.harga === undefined
    ) {
      return badRequest(reply, 'year, bulan (1-12), jumlahPasien, harga wajib diisi');
    }
    const modul = b.modul === 'LABORATORIUM' ? 'LABORATORIUM' : 'RADIOLOGI';
    // Total Penerimaan selalu diturunkan dari Jumlah Pasien x Harga, bukan input terpisah.
    const totalPenerimaan = b.jumlahPasien * b.harga;
    const item = await prisma.laporanPajakOverride.upsert({
      where: { year_bulan_modul: { year: b.year, bulan: b.bulan, modul } },
      create: {
        year: b.year,
        bulan: b.bulan,
        modul,
        jumlahPasien: b.jumlahPasien,
        harga: b.harga,
        totalPenerimaan,
      },
      update: {
        jumlahPasien: b.jumlahPasien,
        harga: b.harga,
        totalPenerimaan,
      },
    });
    return reply.status(200).send({ item });
  });

  /** Hapus koreksi manual satu bulan (kembali ke hasil hitung otomatis). */
  app.delete<{ Querystring: { year?: string; bulan?: string; modul?: string } }>(
    '/api/laporan/pajak/override',
    async (req, reply) => {
      const year = parseInt(req.query.year ?? '', 10);
      const bulan = parseInt(req.query.bulan ?? '', 10);
      if (isNaN(year) || isNaN(bulan)) {
        return badRequest(reply, 'year dan bulan wajib diisi');
      }
      const modul = req.query.modul === 'LABORATORIUM' ? 'LABORATORIUM' : 'RADIOLOGI';
      await prisma.laporanPajakOverride.deleteMany({ where: { year, bulan, modul } });
      return { ok: true };
    },
  );

  interface NeracaSerialized {
    id: string;
    year: number;
    namaPerusahaan: string;
    kas: number; bank: number; piutang: number; persediaan: number; totalAktivaLancar: number;
    tanah: number; gedung: number; peralatan: number; kendaraan: number; totalAktivaTetap: number;
    totalAktiva: number;
    utangUsaha: number; utangPajak: number; utangLainnya: number; totalUtangJangkaPendek: number;
    utangJangkaPanjang: number;
    modalUsaha: number; labaRugi: number; totalModal: number;
    totalPasiva: number;
    pendapatan: number; biayaGaji: number; biayaAtkBahan: number; biayaListrik: number;
    biayaTelpon: number; biayaTransport: number; biayaSewa: number; biayaLainLain: number;
    totalBiaya: number;
    tempatTandaTangan: string; tanggalTandaTangan: string; namaPenandatangan: string;
    logoPerusahaanId: string | null;
  }

  function serializeNeraca(n: {
    id: string;
    year: number;
    namaPerusahaan: string;
    kas: Decimal; bank: Decimal; piutang: Decimal; persediaan: Decimal;
    tanah: Decimal; gedung: Decimal; peralatan: Decimal; kendaraan: Decimal;
    utangUsaha: Decimal; utangPajak: Decimal; utangLainnya: Decimal;
    utangJangkaPanjang: Decimal; modalUsaha: Decimal;
    pendapatan: Decimal; biayaGaji: Decimal; biayaAtkBahan: Decimal;
    biayaListrik: Decimal; biayaTelpon: Decimal; biayaTransport: Decimal;
    biayaSewa: Decimal; biayaLainLain: Decimal;
    tempatTandaTangan: string; tanggalTandaTangan: Date; namaPenandatangan: string;
    logoPerusahaanId: string | null;
  }): NeracaSerialized {
    const kas = toNumber(n.kas);
    const bank = toNumber(n.bank);
    const piutang = toNumber(n.piutang);
    const persediaan = toNumber(n.persediaan);
    const tanah = toNumber(n.tanah);
    const gedung = toNumber(n.gedung);
    const peralatan = toNumber(n.peralatan);
    const kendaraan = toNumber(n.kendaraan);
    const utangUsaha = toNumber(n.utangUsaha);
    const utangPajak = toNumber(n.utangPajak);
    const utangLainnya = toNumber(n.utangLainnya);
    const utangJangkaPanjang = toNumber(n.utangJangkaPanjang);
    const modalUsaha = toNumber(n.modalUsaha);
    const pendapatan = toNumber(n.pendapatan);
    const biayaGaji = toNumber(n.biayaGaji);
    const biayaAtkBahan = toNumber(n.biayaAtkBahan);
    const biayaListrik = toNumber(n.biayaListrik);
    const biayaTelpon = toNumber(n.biayaTelpon);
    const biayaTransport = toNumber(n.biayaTransport);
    const biayaSewa = toNumber(n.biayaSewa);
    const biayaLainLain = toNumber(n.biayaLainLain);

    const totalAktivaLancar = kas + bank + piutang + persediaan;
    const totalAktivaTetap = tanah + gedung + peralatan + kendaraan;
    const totalAktiva = totalAktivaLancar + totalAktivaTetap;
    const totalUtangJangkaPendek = utangUsaha + utangPajak + utangLainnya;
    const totalBiaya =
      biayaGaji + biayaAtkBahan + biayaListrik + biayaTelpon + biayaTransport + biayaSewa + biayaLainLain;
    const labaRugi = pendapatan - totalBiaya;
    const totalModal = modalUsaha + labaRugi;
    const totalPasiva = totalUtangJangkaPendek + utangJangkaPanjang + totalModal;

    return {
      id: n.id,
      year: n.year,
      namaPerusahaan: n.namaPerusahaan,
      kas, bank, piutang, persediaan, totalAktivaLancar,
      tanah, gedung, peralatan, kendaraan, totalAktivaTetap,
      totalAktiva,
      utangUsaha, utangPajak, utangLainnya, totalUtangJangkaPendek,
      utangJangkaPanjang,
      modalUsaha, labaRugi, totalModal,
      totalPasiva,
      pendapatan, biayaGaji, biayaAtkBahan, biayaListrik, biayaTelpon,
      biayaTransport, biayaSewa, biayaLainLain, totalBiaya,
      tempatTandaTangan: n.tempatTandaTangan,
      tanggalTandaTangan: n.tanggalTandaTangan.toISOString().slice(0, 10),
      namaPenandatangan: n.namaPenandatangan,
      logoPerusahaanId: n.logoPerusahaanId,
    };
  }

  const NERACA_DEFAULTS = {
    id: '',
    year: 0,
    namaPerusahaan: 'CV. PRIMA MANDIRI NUSANTARA',
    kas: 0, bank: 0, piutang: 0, persediaan: 0,
    tanah: 0, gedung: 0, peralatan: 0, kendaraan: 0,
    utangUsaha: 0, utangPajak: 0, utangLainnya: 0,
    utangJangkaPanjang: 0, modalUsaha: 0,
    pendapatan: 0, biayaGaji: 0, biayaAtkBahan: 0, biayaListrik: 0,
    biayaTelpon: 0, biayaTransport: 0, biayaSewa: 0, biayaLainLain: 0,
    tempatTandaTangan: 'Sukabumi',
    tanggalTandaTangan: new Date().toISOString().slice(0, 10),
    namaPenandatangan: '',
    logoPerusahaanId: null as string | null,
    totalAktivaLancar: 0, totalAktivaTetap: 0, totalAktiva: 0,
    totalUtangJangkaPendek: 0, labaRugi: 0, totalModal: 0, totalPasiva: 0,
    totalBiaya: 0,
  };

  app.get<{ Querystring: { year?: string } }>('/api/laporan/neraca', async (req) => {
    const yearStr = req.query.year || new Date().getFullYear().toString();
    const year = parseInt(yearStr, 10);
    if (isNaN(year)) {
      return { error: 'Tahun tidak valid' };
    }
    const record = await prisma.laporanNeraca.findUnique({ where: { year } });
    if (!record) {
      return { item: { ...NERACA_DEFAULTS, year } };
    }
    return { item: serializeNeraca(record) };
  });

  app.put<{
    Body: {
      year: number;
      namaPerusahaan?: string;
      kas?: number; bank?: number; piutang?: number; persediaan?: number;
      tanah?: number; gedung?: number; peralatan?: number; kendaraan?: number;
      utangUsaha?: number; utangPajak?: number; utangLainnya?: number;
      utangJangkaPanjang?: number; modalUsaha?: number;
      pendapatan?: number; biayaGaji?: number; biayaAtkBahan?: number;
      biayaListrik?: number; biayaTelpon?: number; biayaTransport?: number;
      biayaSewa?: number; biayaLainLain?: number;
      tempatTandaTangan?: string; tanggalTandaTangan?: string; namaPenandatangan?: string;
      logoPerusahaanId?: string | null;
    };
  }>('/api/laporan/neraca', async (req, reply) => {
    const b = req.body;
    if (!Number.isInteger(b.year)) {
      return badRequest(reply, 'year wajib diisi');
    }
    const data = {
      namaPerusahaan: b.namaPerusahaan?.trim() || 'CV. PRIMA MANDIRI NUSANTARA',
      kas: b.kas ?? 0, bank: b.bank ?? 0, piutang: b.piutang ?? 0, persediaan: b.persediaan ?? 0,
      tanah: b.tanah ?? 0, gedung: b.gedung ?? 0, peralatan: b.peralatan ?? 0, kendaraan: b.kendaraan ?? 0,
      utangUsaha: b.utangUsaha ?? 0, utangPajak: b.utangPajak ?? 0, utangLainnya: b.utangLainnya ?? 0,
      utangJangkaPanjang: b.utangJangkaPanjang ?? 0, modalUsaha: b.modalUsaha ?? 0,
      pendapatan: b.pendapatan ?? 0, biayaGaji: b.biayaGaji ?? 0, biayaAtkBahan: b.biayaAtkBahan ?? 0,
      biayaListrik: b.biayaListrik ?? 0, biayaTelpon: b.biayaTelpon ?? 0,
      biayaTransport: b.biayaTransport ?? 0, biayaSewa: b.biayaSewa ?? 0, biayaLainLain: b.biayaLainLain ?? 0,
      tempatTandaTangan: b.tempatTandaTangan?.trim() || 'Sukabumi',
      tanggalTandaTangan: b.tanggalTandaTangan ? new Date(b.tanggalTandaTangan) : new Date(),
      namaPenandatangan: b.namaPenandatangan?.trim() || '',
      logoPerusahaanId: b.logoPerusahaanId ?? null,
    };
    const record = await prisma.laporanNeraca.upsert({
      where: { year: b.year },
      create: { year: b.year, ...data },
      update: data,
    });
    return reply.status(200).send({ item: serializeNeraca(record) });
  });

  const PAJAK_BULANAN_FIELDS = [
    'harga',
    'biayaSewaTempat', 'biayaListrikAir',
    'gajiFernanda', 'gajiChalimatusadiah', 'gajiRiki', 'gajiAgung', 'gajiKaryawan1', 'gajiKaryawan2',
    'bahanRoentgen', 'peralatanRoentgen', 'penyusutanManual', 'perbaikanAlat',
    'hargaPeralatan', 'tarifPenyusutanTahunanPersen',
    'piutangUsaha', 'perlengkapan', 'utangUsaha',
    'modalAwalTahun', 'kasAwalTahun', 'akumulasiPenyusutanAwalTahun',
  ] as const;
  type PajakBulananField = (typeof PAJAK_BULANAN_FIELDS)[number];

  app.get<{ Querystring: { year?: string; modul?: string } }>('/api/laporan/pajak-bulanan', async (req) => {
    const yearStr = req.query.year || new Date().getFullYear().toString();
    const year = parseInt(yearStr, 10);
    if (isNaN(year)) {
      return { error: 'Tahun tidak valid' };
    }
    const modul = req.query.modul === 'LABORATORIUM' ? 'LABORATORIUM' : 'RADIOLOGI';

    const startOfYear = new Date(year, 0, 1);
    const endOfYear = new Date(year, 11, 31, 23, 59, 59, 999);

    const [pasienRecords, rows] = await Promise.all([
      prisma.pasienDuplikat.findMany({
        where: { asalModul: modul, registeredAt: { gte: startOfYear, lte: endOfYear } },
        select: { registeredAt: true },
      }),
      prisma.laporanPajakBulanan.findMany({ where: { year, modul } }),
    ]);

    const jumlahPasienPerBulan = Array.from({ length: 12 }, () => 0);
    for (const r of pasienRecords) {
      jumlahPasienPerBulan[r.registeredAt.getMonth()] += 1;
    }

    const rowByBulan = new Map(rows.map((r) => [r.bulan, r]));

    let prevModalAkhir = 0;
    let prevKasAkhir = 0;
    let prevAkumulasiPenyusutan = 0;

    const bulanData = [];
    for (let bulanKe = 1; bulanKe <= 12; bulanKe++) {
      const row = rowByBulan.get(bulanKe);
      const jumlahPasien = jumlahPasienPerBulan[bulanKe - 1]!;

      const harga = toNumber(row?.harga ?? new Decimal(0));
      const biayaSewaTempat = toNumber(row?.biayaSewaTempat ?? new Decimal(0));
      const biayaListrikAir = toNumber(row?.biayaListrikAir ?? new Decimal(0));
      const gajiFernanda = toNumber(row?.gajiFernanda ?? new Decimal(0));
      const gajiChalimatusadiah = toNumber(row?.gajiChalimatusadiah ?? new Decimal(0));
      const gajiRiki = toNumber(row?.gajiRiki ?? new Decimal(0));
      const gajiAgung = toNumber(row?.gajiAgung ?? new Decimal(0));
      const gajiKaryawan1 = toNumber(row?.gajiKaryawan1 ?? new Decimal(0));
      const gajiKaryawan2 = toNumber(row?.gajiKaryawan2 ?? new Decimal(0));
      const bahanRoentgen = toNumber(row?.bahanRoentgen ?? new Decimal(0));
      const peralatanRoentgen = toNumber(row?.peralatanRoentgen ?? new Decimal(0));
      const penyusutanManual = toNumber(row?.penyusutanManual ?? new Decimal(0));
      const perbaikanAlat = toNumber(row?.perbaikanAlat ?? new Decimal(0));
      const hargaPeralatan = toNumber(row?.hargaPeralatan ?? new Decimal(0));
      const tarifPenyusutanTahunanPersen = toNumber(row?.tarifPenyusutanTahunanPersen ?? new Decimal(10));
      const piutangUsaha = toNumber(row?.piutangUsaha ?? new Decimal(0));
      const perlengkapan = toNumber(row?.perlengkapan ?? new Decimal(0));
      const utangUsaha = toNumber(row?.utangUsaha ?? new Decimal(0));
      const modalAwalTahun = toNumber(row?.modalAwalTahun ?? new Decimal(0));
      const kasAwalTahun = toNumber(row?.kasAwalTahun ?? new Decimal(0));
      const akumulasiPenyusutanAwalTahun = toNumber(row?.akumulasiPenyusutanAwalTahun ?? new Decimal(0));

      const pendapatan = harga * jumlahPasien;
      const totalBebanUsaha =
        biayaSewaTempat + biayaListrikAir + gajiFernanda + gajiChalimatusadiah + gajiRiki + gajiAgung +
        gajiKaryawan1 + gajiKaryawan2 + bahanRoentgen + peralatanRoentgen + penyusutanManual + perbaikanAlat;
      const labaBersih = pendapatan - totalBebanUsaha;

      const penyusutanPeralatanBulan = (hargaPeralatan * (tarifPenyusutanTahunanPersen / 100)) / 12;

      const modalAwal = bulanKe === 1 ? modalAwalTahun : prevModalAkhir;
      const modalAkhir = modalAwal + labaBersih;
      const kasAwal = bulanKe === 1 ? kasAwalTahun : prevKasAkhir;
      const kasAkhir = kasAwal + labaBersih;
      const akumulasiPenyusutanAwal = bulanKe === 1 ? akumulasiPenyusutanAwalTahun : prevAkumulasiPenyusutan;
      const akumulasiPenyusutanAkhir = akumulasiPenyusutanAwal + penyusutanPeralatanBulan;

      const peralatanNet = hargaPeralatan - akumulasiPenyusutanAkhir;
      const jumlahAktiva = kasAkhir + piutangUsaha + perlengkapan + peralatanNet;
      const modalPH = jumlahAktiva - utangUsaha;

      bulanData.push({
        no: bulanKe,
        bulan: BULAN_NAMA[bulanKe - 1],
        jumlahPasien, harga, pendapatan,
        biayaSewaTempat, biayaListrikAir,
        gajiFernanda, gajiChalimatusadiah, gajiRiki, gajiAgung, gajiKaryawan1, gajiKaryawan2,
        bahanRoentgen, peralatanRoentgen, penyusutanManual, perbaikanAlat,
        totalBebanUsaha, labaBersih,
        hargaPeralatan, tarifPenyusutanTahunanPersen, penyusutanPeralatanBulan,
        akumulasiPenyusutanAwal, akumulasiPenyusutanAkhir,
        modalAwal, modalAkhir,
        kasAwal, kasAkhir,
        piutangUsaha, perlengkapan, utangUsaha, peralatanNet,
        jumlahAktiva, modalPH,
        modalAwalTahun, kasAwalTahun, akumulasiPenyusutanAwalTahun,
      });

      prevModalAkhir = modalAkhir;
      prevKasAkhir = kasAkhir;
      prevAkumulasiPenyusutan = akumulasiPenyusutanAkhir;
    }

    return {
      year,
      modul,
      bulan: bulanData,
      totalJumlahPasien: bulanData.reduce((s, b) => s + b.jumlahPasien, 0),
      totalPendapatan: bulanData.reduce((s, b) => s + b.pendapatan, 0),
      totalBebanUsaha: bulanData.reduce((s, b) => s + b.totalBebanUsaha, 0),
      totalLabaBersih: bulanData.reduce((s, b) => s + b.labaBersih, 0),
    };
  });

  app.patch<{
    Body: {
      year: number;
      bulan: number;
      modul?: string;
    } & Partial<Record<PajakBulananField, number>>;
  }>('/api/laporan/pajak-bulanan', async (req, reply) => {
    const b = req.body;
    if (!Number.isInteger(b.year) || !Number.isInteger(b.bulan) || b.bulan < 1 || b.bulan > 12) {
      return badRequest(reply, 'year dan bulan (1-12) wajib diisi');
    }
    const modul = b.modul === 'LABORATORIUM' ? 'LABORATORIUM' : 'RADIOLOGI';

    const data: Partial<Record<PajakBulananField, number>> = {};
    for (const field of PAJAK_BULANAN_FIELDS) {
      if (b[field] !== undefined) {
        data[field] = b[field];
      }
    }

    const item = await prisma.laporanPajakBulanan.upsert({
      where: { year_bulan_modul: { year: b.year, bulan: b.bulan, modul } },
      create: { year: b.year, bulan: b.bulan, modul, ...data },
      update: data,
    });
    return reply.status(200).send({ item });
  });
}

