import type { FastifyInstance, FastifyReply } from 'fastify';
import { Decimal } from '../generated/prisma/internal/prismaNamespace.js';
import { prisma } from '../lib/prisma.js';
import { serializeDecimal } from '../lib/serialize.js';
import { buildPaginationMeta, parsePagination } from '../lib/pagination.js';
import { nextFarmasiKwitansiCode } from '../lib/regCode.js';

function badRequest(reply: FastifyReply, message: string): FastifyReply {
  return reply.status(400).send({ error: message });
}

export async function registerKlinikRoutes(app: FastifyInstance): Promise<void> {
  // ─── Farmasi & Bahan Habis Pakai (BHP) ────────────────────────────────────────

  app.get<{
    Querystring: { q?: string; kategori?: string };
  }>('/api/farmasi-bhp', async (req) => {
    const q = req.query.q?.trim().toLowerCase();
    const kategori = req.query.kategori?.trim();

    const where: {
      kategori?: string;
      OR?: Array<{ nama?: { contains: string }; kode?: { contains: string } }>;
    } = {};

    if (kategori) {
      where.kategori = kategori;
    }
    if (q) {
      where.OR = [{ nama: { contains: q } }, { kode: { contains: q } }];
    }

    const items = await prisma.farmasiBhp.findMany({
      where,
      orderBy: { nama: 'asc' },
    });

    return {
      items: items.map((it) => ({
        ...it,
        hargaBeli: serializeDecimal(it.hargaBeli),
        hargaJual: serializeDecimal(it.hargaJual),
      })),
    };
  });

  app.post('/api/farmasi-bhp/init-defaults', async () => {
    const seedItems = [
      // Obat-obatan (Farmasi)
      { kode: 'OBT-001', nama: 'Paracetamol 500mg Tablet', kategori: 'OBAT', satuan: 'Strip', stok: 150, stokMin: 20, hargaBeli: 4000, hargaJual: 8000, keterangan: 'Analgesik & antipiretik' },
      { kode: 'OBT-002', nama: 'Amoxicillin 500mg Kapsul', kategori: 'OBAT', satuan: 'Strip', stok: 80, stokMin: 15, hargaBeli: 7500, hargaJual: 14000, keterangan: 'Antibiotik spektrum luas' },
      { kode: 'OBT-003', nama: 'CTM 4mg Tablet', kategori: 'OBAT', satuan: 'Strip', stok: 120, stokMin: 15, hargaBeli: 2500, hargaJual: 5000, keterangan: 'Antihistamin' },
      { kode: 'OBT-004', nama: 'Antasida Doen Tablet', kategori: 'OBAT', satuan: 'Strip', stok: 90, stokMin: 15, hargaBeli: 3500, hargaJual: 7000, keterangan: 'Obat lambung' },
      { kode: 'OBT-005', nama: 'Ibuprofen 400mg Tablet', kategori: 'OBAT', satuan: 'Strip', stok: 75, stokMin: 10, hargaBeli: 6000, hargaJual: 12000, keterangan: 'Anti inflamasi' },
      { kode: 'OBT-006', nama: 'Omeprazole 20mg Kapsul', kategori: 'OBAT', satuan: 'Strip', stok: 60, stokMin: 10, hargaBeli: 11000, hargaJual: 22000, keterangan: 'Obat lambung PPI' },
      { kode: 'OBT-007', nama: 'Metformin 500mg Tablet', kategori: 'OBAT', satuan: 'Strip', stok: 100, stokMin: 20, hargaBeli: 5000, hargaJual: 10000, keterangan: 'Antidiabetik oral' },
      { kode: 'OBT-008', nama: 'Amlodipine 5mg Tablet', kategori: 'OBAT', satuan: 'Strip', stok: 110, stokMin: 20, hargaBeli: 4500, hargaJual: 9000, keterangan: 'Antihipertensi' },
      { kode: 'OBT-009', nama: 'Simvastatin 10mg Tablet', kategori: 'OBAT', satuan: 'Strip', stok: 85, stokMin: 15, hargaBeli: 6500, hargaJual: 13000, keterangan: 'Kolesterol' },
      { kode: 'OBT-010', nama: 'Vitamin C 500mg Tablet', kategori: 'OBAT', satuan: 'Strip', stok: 200, stokMin: 30, hargaBeli: 3000, hargaJual: 6000, keterangan: 'Suplemen daya tahan tubuh' },

      // Bahan Habis Pakai (BHP)
      { kode: 'BHP-001', nama: 'Spuit 3cc Terumo', kategori: 'BHP', satuan: 'Pcs', stok: 350, stokMin: 50, hargaBeli: 2000, hargaJual: 4000, keterangan: 'Jarum suntik 3ml' },
      { kode: 'BHP-002', nama: 'Spuit 5cc Terumo', kategori: 'BHP', satuan: 'Pcs', stok: 250, stokMin: 40, hargaBeli: 2500, hargaJual: 5000, keterangan: 'Jarum suntik 5ml' },
      { kode: 'BHP-003', nama: 'Alcohol Swab 70% (100s)', kategori: 'BHP', satuan: 'Box', stok: 45, stokMin: 10, hargaBeli: 18000, hargaJual: 30000, keterangan: 'Kapas alkohol steril' },
      { kode: 'BHP-004', nama: 'Tabung EDTA 3ml (Ungu)', kategori: 'BHP', satuan: 'Pcs', stok: 500, stokMin: 100, hargaBeli: 1500, hargaJual: 3500, keterangan: 'Tabung sampel hematologi' },
      { kode: 'BHP-005', nama: 'Tabung Clot Activator 5ml', kategori: 'BHP', satuan: 'Pcs', stok: 400, stokMin: 80, hargaBeli: 1800, hargaJual: 4000, keterangan: 'Tabung sampel kimia darah' },
      { kode: 'BHP-006', nama: 'Film Rontgen AGFA 35x43 cm', kategori: 'BHP', satuan: 'Lembar', stok: 120, stokMin: 25, hargaBeli: 35000, hargaJual: 75000, keterangan: 'Film rontgen besar Thorax' },
      { kode: 'BHP-007', nama: 'Film Rontgen AGFA 24x30 cm', kategori: 'BHP', satuan: 'Lembar', stok: 150, stokMin: 30, hargaBeli: 25000, hargaJual: 55000, keterangan: 'Film rontgen sedang' },
      { kode: 'BHP-008', nama: 'Reagen Glukosa Darah (Kit)', kategori: 'BHP', satuan: 'Kit', stok: 12, stokMin: 3, hargaBeli: 450000, hargaJual: 900000, keterangan: 'Reagen kimia darah glukosa' },
      { kode: 'BHP-009', nama: 'Reagen SGOT / SGPT (Kit)', kategori: 'BHP', satuan: 'Kit', stok: 10, stokMin: 2, hargaBeli: 550000, hargaJual: 1100000, keterangan: 'Reagen faal hati' },
      { kode: 'BHP-010', nama: 'Urine Strip 10 Parameter', kategori: 'BHP', satuan: 'Botol', stok: 25, stokMin: 5, hargaBeli: 125000, hargaJual: 250000, keterangan: 'Strip urine rutin & urinalisa' },
    ];

    for (const it of seedItems) {
      const existing = await prisma.farmasiBhp.findUnique({ where: { kode: it.kode } });
      if (!existing) {
        await prisma.farmasiBhp.create({
          data: {
            kode: it.kode,
            nama: it.nama,
            kategori: it.kategori,
            satuan: it.satuan,
            stok: it.stok,
            stokMin: it.stokMin,
            hargaBeli: new Decimal(it.hargaBeli),
            hargaJual: new Decimal(it.hargaJual),
            keterangan: it.keterangan,
          },
        });
      }
    }

    return { ok: true };
  });

  app.post<{
    Body: {
      kode: string;
      nama: string;
      kategori: string;
      satuan?: string;
      stok?: number;
      stokMin?: number;
      hargaBeli?: string | number;
      hargaJual?: string | number;
      keterangan?: string;
      tanggalBeli?: string;
      tanggalExpire?: string;
      penyedia?: string;
      telponPenyedia?: string;
    };
  }>('/api/farmasi-bhp', async (req, reply) => {
    if (!req.body.kode?.trim()) return badRequest(reply, 'Kode wajib diisi');
    if (!req.body.nama?.trim()) return badRequest(reply, 'Nama wajib diisi');

    const existing = await prisma.farmasiBhp.findUnique({ where: { kode: req.body.kode.trim() } });
    if (existing) return badRequest(reply, 'Kode barang sudah ada');

    const item = await prisma.farmasiBhp.create({
      data: {
        kode: req.body.kode.trim(),
        nama: req.body.nama.trim(),
        kategori: req.body.kategori?.trim() || 'OBAT',
        satuan: req.body.satuan?.trim() || 'Pcs',
        stok: Number(req.body.stok) || 0,
        stokMin: Number(req.body.stokMin) || 10,
        hargaBeli: req.body.hargaBeli ? new Decimal(req.body.hargaBeli) : new Decimal(0),
        hargaJual: req.body.hargaJual ? new Decimal(req.body.hargaJual) : new Decimal(0),
        keterangan: req.body.keterangan?.trim() ?? '',
        tanggalBeli: req.body.tanggalBeli ? new Date(req.body.tanggalBeli) : null,
        tanggalExpire: req.body.tanggalExpire ? new Date(req.body.tanggalExpire) : null,
        penyedia: req.body.penyedia?.trim() || null,
        telponPenyedia: req.body.telponPenyedia?.trim() || null,
      },
    });

    return reply.status(201).send({
      item: {
        ...item,
        hargaBeli: serializeDecimal(item.hargaBeli),
        hargaJual: serializeDecimal(item.hargaJual),
      },
    });
  });

  app.patch<{
    Params: { id: string };
    Body: {
      kode?: string;
      nama?: string;
      kategori?: string;
      satuan?: string;
      stok?: number;
      stokMin?: number;
      hargaBeli?: string | number;
      hargaJual?: string | number;
      keterangan?: string;
      tanggalBeli?: string | null;
      tanggalExpire?: string | null;
      penyedia?: string;
      telponPenyedia?: string;
    };
  }>('/api/farmasi-bhp/:id', async (req, reply) => {
    const existing = await prisma.farmasiBhp.findUnique({ where: { id: req.params.id } });
    if (!existing) return reply.status(404).send({ error: 'Data tidak ditemukan' });

    const item = await prisma.farmasiBhp.update({
      where: { id: req.params.id },
      data: {
        kode: req.body.kode?.trim() ?? existing.kode,
        nama: req.body.nama?.trim() ?? existing.nama,
        kategori: req.body.kategori?.trim() ?? existing.kategori,
        satuan: req.body.satuan?.trim() ?? existing.satuan,
        stok: req.body.stok !== undefined ? Number(req.body.stok) : existing.stok,
        stokMin: req.body.stokMin !== undefined ? Number(req.body.stokMin) : existing.stokMin,
        hargaBeli: req.body.hargaBeli !== undefined ? new Decimal(req.body.hargaBeli) : existing.hargaBeli,
        hargaJual: req.body.hargaJual !== undefined ? new Decimal(req.body.hargaJual) : existing.hargaJual,
        keterangan: req.body.keterangan !== undefined ? req.body.keterangan.trim() : existing.keterangan,
        tanggalBeli:
          req.body.tanggalBeli !== undefined
            ? req.body.tanggalBeli
              ? new Date(req.body.tanggalBeli)
              : null
            : existing.tanggalBeli,
        tanggalExpire:
          req.body.tanggalExpire !== undefined
            ? req.body.tanggalExpire
              ? new Date(req.body.tanggalExpire)
              : null
            : existing.tanggalExpire,
        penyedia: req.body.penyedia !== undefined ? req.body.penyedia?.trim() || null : existing.penyedia,
        telponPenyedia:
          req.body.telponPenyedia !== undefined ? req.body.telponPenyedia?.trim() || null : existing.telponPenyedia,
      },
    });

    return {
      item: {
        ...item,
        hargaBeli: serializeDecimal(item.hargaBeli),
        hargaJual: serializeDecimal(item.hargaJual),
      },
    };
  });

  app.delete<{ Params: { id: string } }>('/api/farmasi-bhp/:id', async (req, reply) => {
    try {
      await prisma.farmasiBhp.delete({ where: { id: req.params.id } });
      return { ok: true };
    } catch {
      return reply.status(404).send({ error: 'Data tidak ditemukan' });
    }
  });

  // ─── Kwitansi Farmasi (penjualan obat/BHP ke pasien) ────────────────────────

  interface FarmasiKwitansiSerialized {
    id: string;
    noKwitansi: string;
    namaPasien: string;
    tanggal: string;
    paymentStatus: string;
    petugasKasir: string | null;
    totalHarga: string | null;
    items: {
      id: string;
      farmasiBhpId: string;
      nama: string;
      qty: number;
      hargaSatuan: string | null;
      subtotal: string | null;
    }[];
  }

  function serializeKwitansi(k: {
    id: string;
    noKwitansi: string;
    namaPasien: string;
    tanggal: Date;
    paymentStatus: string;
    petugasKasir: string | null;
    totalHarga: unknown;
    items: {
      id: string;
      farmasiBhpId: string;
      namaSnapshot: string;
      qty: number;
      hargaSatuan: unknown;
      subtotal: unknown;
    }[];
  }): FarmasiKwitansiSerialized {
    return {
      id: k.id,
      noKwitansi: k.noKwitansi,
      namaPasien: k.namaPasien,
      tanggal: k.tanggal.toISOString(),
      paymentStatus: k.paymentStatus,
      petugasKasir: k.petugasKasir,
      totalHarga: serializeDecimal(k.totalHarga as never),
      items: k.items.map((it) => ({
        id: it.id,
        farmasiBhpId: it.farmasiBhpId,
        nama: it.namaSnapshot,
        qty: it.qty,
        hargaSatuan: serializeDecimal(it.hargaSatuan as never),
        subtotal: serializeDecimal(it.subtotal as never),
      })),
    };
  }

  app.get<{ Querystring: { q?: string; page?: string; limit?: string } }>(
    '/api/farmasi-kwitansi',
    async (req) => {
      const { page, limit, skip } = parsePagination(req.query);
      const q = req.query.q?.trim();
      const where = q
        ? { OR: [{ namaPasien: { contains: q } }, { noKwitansi: { contains: q } }] }
        : {};
      const [total, items] = await Promise.all([
        prisma.farmasiKwitansi.count({ where }),
        prisma.farmasiKwitansi.findMany({
          where,
          include: { items: true },
          orderBy: { tanggal: 'desc' },
          skip,
          take: limit,
        }),
      ]);
      return {
        items: items.map(serializeKwitansi),
        pagination: buildPaginationMeta(total, page, limit),
      };
    },
  );

  app.post<{
    Body: {
      namaPasien: string;
      paymentStatus?: 'BELUM_LUNAS' | 'LUNAS';
      petugasKasir?: string;
      items: { farmasiBhpId: string; qty: number }[];
    };
  }>('/api/farmasi-kwitansi', async (req, reply) => {
    const b = req.body;
    if (!b.namaPasien?.trim()) return badRequest(reply, 'Nama pasien wajib diisi');
    if (!Array.isArray(b.items) || b.items.length === 0) {
      return badRequest(reply, 'Pilih minimal satu obat/BHP');
    }
    for (const it of b.items) {
      if (!it.farmasiBhpId || !Number.isInteger(it.qty) || it.qty < 1) {
        return badRequest(reply, 'Jumlah tiap item wajib diisi dengan angka bulat minimal 1');
      }
    }

    try {
      const kwitansi = await prisma.$transaction(async (tx) => {
        const noKwitansi = await nextFarmasiKwitansiCode(tx as never);
        let totalHarga = new Decimal(0);
        const itemsData: {
          farmasiBhpId: string;
          namaSnapshot: string;
          qty: number;
          hargaSatuan: InstanceType<typeof Decimal>;
          subtotal: InstanceType<typeof Decimal>;
        }[] = [];

        for (const it of b.items) {
          const stok = await tx.farmasiBhp.findUnique({ where: { id: it.farmasiBhpId } });
          if (!stok) throw new Error(`Item obat/BHP tidak ditemukan`);
          if (stok.stok < it.qty) {
            throw new Error(`Stok "${stok.nama}" tidak cukup (tersisa ${stok.stok})`);
          }
          const hargaSatuan = stok.hargaJual;
          const subtotal = hargaSatuan.mul(it.qty);
          totalHarga = totalHarga.add(subtotal);
          itemsData.push({
            farmasiBhpId: stok.id,
            namaSnapshot: stok.nama,
            qty: it.qty,
            hargaSatuan,
            subtotal,
          });
          await tx.farmasiBhp.update({
            where: { id: stok.id },
            data: { stok: { decrement: it.qty } },
          });
        }

        return tx.farmasiKwitansi.create({
          data: {
            noKwitansi,
            namaPasien: b.namaPasien.trim(),
            paymentStatus: b.paymentStatus === 'BELUM_LUNAS' ? 'BELUM_LUNAS' : 'LUNAS',
            petugasKasir: b.petugasKasir?.trim() || null,
            totalHarga,
            items: { create: itemsData },
          },
          include: { items: true },
        });
      });

      return reply.status(201).send({ item: serializeKwitansi(kwitansi) });
    } catch (err: unknown) {
      return badRequest(reply, err instanceof Error ? err.message : 'Gagal membuat kwitansi farmasi');
    }
  });

  app.patch<{
    Params: { id: string };
    Body: { namaPasien?: string; paymentStatus?: 'BELUM_LUNAS' | 'LUNAS'; petugasKasir?: string };
  }>('/api/farmasi-kwitansi/:id', async (req, reply) => {
    const existing = await prisma.farmasiKwitansi.findUnique({
      where: { id: req.params.id },
      include: { items: true },
    });
    if (!existing) return reply.status(404).send({ error: 'Kwitansi tidak ditemukan' });

    const item = await prisma.farmasiKwitansi.update({
      where: { id: req.params.id },
      data: {
        namaPasien: req.body.namaPasien?.trim() || existing.namaPasien,
        paymentStatus: req.body.paymentStatus ?? existing.paymentStatus,
        petugasKasir:
          req.body.petugasKasir !== undefined ? req.body.petugasKasir?.trim() || null : existing.petugasKasir,
      },
      include: { items: true },
    });

    return { item: serializeKwitansi(item) };
  });

  app.delete<{ Params: { id: string } }>('/api/farmasi-kwitansi/:id', async (req, reply) => {
    const existing = await prisma.farmasiKwitansi.findUnique({
      where: { id: req.params.id },
      include: { items: true },
    });
    if (!existing) return reply.status(404).send({ error: 'Kwitansi tidak ditemukan' });

    await prisma.$transaction(async (tx) => {
      for (const it of existing.items) {
        await tx.farmasiBhp.update({
          where: { id: it.farmasiBhpId },
          data: { stok: { increment: it.qty } },
        });
      }
      await tx.farmasiKwitansi.delete({ where: { id: req.params.id } });
    });

    return { ok: true };
  });

  // ─── Daftar Hadir Karyawan (Absensi / Presensi) ─────────────────────────────

  app.get<{
    Querystring: { tanggal?: string; q?: string };
  }>('/api/absensi', async (req) => {
    const q = req.query.q?.trim().toLowerCase();
    const tanggal = req.query.tanggal?.trim();

    const where: {
      tanggal?: string;
      namaKaryawan?: { contains: string };
    } = {};

    if (tanggal) {
      where.tanggal = tanggal;
    }
    if (q) {
      where.namaKaryawan = { contains: q };
    }

    const items = await prisma.absensiKaryawan.findMany({
      where,
      orderBy: [{ tanggal: 'desc' }, { namaKaryawan: 'asc' }],
    });

    return { items };
  });

  app.post('/api/absensi/init-defaults', async () => {
    const today = new Date().toISOString().split('T')[0] ?? '2026-07-28';
    const sampleStaff = [
      { namaKaryawan: 'dr. Hendra Kusumah, Sp.Rad', role: 'DOKTER RADIOLOGI', tanggal: today, jamMasuk: '07:50', jamPulang: '16:00', status: 'HADIR', keterangan: 'Praktik Pagi' },
      { namaKaryawan: 'dr. Siti Rahmawati, Sp.PK', role: 'DOKTER LAB', tanggal: today, jamMasuk: '08:00', jamPulang: '16:00', status: 'HADIR', keterangan: 'Praktik Pagi' },
      { namaKaryawan: 'Ahmad Fauzi, A.Md.AK', role: 'ANALIS LAB', tanggal: today, jamMasuk: '07:45', jamPulang: '16:05', status: 'HADIR', keterangan: 'Shift 1' },
      { namaKaryawan: 'Rina Kartika, A.Md.Rad', role: 'RADIOGRAFER', tanggal: today, jamMasuk: '07:55', jamPulang: '16:00', status: 'HADIR', keterangan: 'Shift 1' },
      { namaKaryawan: 'Linda Permata, S.Farm', role: 'APOTEKER', tanggal: today, jamMasuk: '08:10', jamPulang: '16:00', status: 'HADIR', keterangan: 'Shift 1' },
      { namaKaryawan: 'Budi Santoso, S.E.', role: 'ADMIN KASIR', tanggal: today, jamMasuk: '08:00', jamPulang: '16:00', status: 'HADIR', keterangan: 'Front Office' },
    ];

    for (const staff of sampleStaff) {
      const existing = await prisma.absensiKaryawan.findFirst({
        where: { namaKaryawan: staff.namaKaryawan, tanggal: staff.tanggal },
      });
      if (!existing) {
        await prisma.absensiKaryawan.create({ data: staff });
      }
    }

    return { ok: true };
  });

  app.post<{
    Body: {
      namaKaryawan: string;
      role?: string;
      tanggal?: string;
      jamMasuk?: string;
      jamPulang?: string;
      status?: string;
      keterangan?: string;
    };
  }>('/api/absensi', async (req, reply) => {
    if (!req.body.namaKaryawan?.trim()) {
      return badRequest(reply, 'Nama karyawan wajib diisi');
    }

    const today = new Date().toISOString().split('T')[0] ?? '2026-07-28';
    const item = await prisma.absensiKaryawan.create({
      data: {
        namaKaryawan: req.body.namaKaryawan.trim(),
        role: req.body.role?.trim() || 'KARYAWAN',
        tanggal: req.body.tanggal?.trim() || today,
        jamMasuk: req.body.jamMasuk?.trim() || '08:00',
        jamPulang: req.body.jamPulang?.trim() || '16:00',
        status: req.body.status?.trim() || 'HADIR',
        keterangan: req.body.keterangan?.trim() || '',
      },
    });

    return reply.status(201).send({ item });
  });

  app.delete<{ Params: { id: string } }>('/api/absensi/:id', async (req, reply) => {
    try {
      await prisma.absensiKaryawan.delete({ where: { id: req.params.id } });
      return { ok: true };
    } catch {
      return reply.status(404).send({ error: 'Data absensi tidak ditemukan' });
    }
  });

  // ─── Manajemen Keuangan & Pembukuan Klinik ──────────────────────────────────

  app.get('/api/keuangan/summary', async () => {
    // 1. Total dari Pasien (Laboratorium & Radiologi)
    const pasienList = await prisma.pasien.findMany({
      select: { totalHarga: true, totalSharing: true, paymentStatus: true },
    });

    let totalPendapatanPasien = 0;
    let totalSharingDokter = 0;

    for (const p of pasienList) {
      const nominalBayar = p.totalHarga ? Number(p.totalHarga) : 0;
      const sharing = p.totalSharing ? Number(p.totalSharing) : 0;
      totalPendapatanPasien += nominalBayar;
      totalSharingDokter += sharing;
    }

    // 2. Transaksi Kas Umum
    const kasList = await prisma.keuanganTransaksi.findMany();
    let totalKasMasuk = 0;
    let totalKasKeluar = 0;

    for (const t of kasList) {
      const nom = t.nominal ? Number(t.nominal) : 0;
      if (t.jenis === 'MASUK') {
        totalKasMasuk += nom;
      } else {
        totalKasKeluar += nom;
      }
    }

    const totalPendapatanBruto = totalPendapatanPasien + totalKasMasuk;
    const totalPengeluaran = totalKasKeluar + totalSharingDokter;
    const nettoKas = totalPendapatanBruto - totalPengeluaran;

    return {
      totalPendapatanPasien: serializeDecimal(new Decimal(totalPendapatanPasien)),
      totalSharingDokter: serializeDecimal(new Decimal(totalSharingDokter)),
      totalKasMasuk: serializeDecimal(new Decimal(totalKasMasuk)),
      totalKasKeluar: serializeDecimal(new Decimal(totalKasKeluar)),
      totalPendapatanBruto: serializeDecimal(new Decimal(totalPendapatanBruto)),
      totalPengeluaran: serializeDecimal(new Decimal(totalPengeluaran)),
      nettoKas: serializeDecimal(new Decimal(nettoKas)),
    };
  });

  app.get<{
    Querystring: { jenis?: string; kategori?: string };
  }>('/api/keuangan/transaksi', async (req) => {
    const where: { jenis?: string; kategori?: string } = {};
    if (req.query.jenis) {
      where.jenis = req.query.jenis;
    }
    if (req.query.kategori) {
      where.kategori = req.query.kategori;
    }

    const items = await prisma.keuanganTransaksi.findMany({
      where,
      orderBy: { tanggal: 'desc' },
    });

    return {
      items: items.map((it) => ({
        ...it,
        nominal: serializeDecimal(it.nominal),
      })),
    };
  });

  app.post('/api/keuangan/init-defaults', async () => {
    const today = new Date().toISOString().split('T')[0] ?? '2026-07-28';
    const defaultTx = [
      { tanggal: today, jenis: 'MASUK', kategori: 'LAYANAN_PASIEN', keterangan: 'Penerimaan Kas Layanan Laboratorium & Radiologi (Shift 1)', nominal: 4500000, referensi: 'KAS-IN-001' },
      { tanggal: today, jenis: 'MASUK', kategori: 'FARMASI', keterangan: 'Penjualan Obat Resep Rawat Jalan & Apotek', nominal: 1850000, referensi: 'KAS-IN-002' },
      { tanggal: today, jenis: 'KELUAR', kategori: 'PEMBELIAN_BHP', keterangan: 'Pembelian Reagen Hematologi & Kimia Darah', nominal: 1200000, referensi: 'KAS-OUT-001' },
      { tanggal: today, jenis: 'KELUAR', kategori: 'OPERASIONAL', keterangan: 'Pembayaran Tagihan Listrik & Internet Klinik Bulanan', nominal: 850000, referensi: 'KAS-OUT-002' },
      { tanggal: today, jenis: 'KELUAR', kategori: 'FARMASI_BHP', keterangan: 'Pengadaan Stok Obat Paracetamol, Amoxicillin & Spuit', nominal: 950000, referensi: 'KAS-OUT-003' },
    ];

    const count = await prisma.keuanganTransaksi.count();
    if (count === 0) {
      for (const tx of defaultTx) {
        await prisma.keuanganTransaksi.create({
          data: {
            ...tx,
            nominal: new Decimal(tx.nominal),
          },
        });
      }
    }

    return { ok: true };
  });

  app.post<{
    Body: {
      tanggal?: string;
      jenis: string;
      kategori: string;
      keterangan: string;
      nominal: string | number;
      referensi?: string;
    };
  }>('/api/keuangan/transaksi', async (req, reply) => {
    if (!req.body.keterangan?.trim()) {
      return badRequest(reply, 'Keterangan transaksi wajib diisi');
    }
    const today = new Date().toISOString().split('T')[0] ?? '2026-07-28';
    const item = await prisma.keuanganTransaksi.create({
      data: {
        tanggal: req.body.tanggal?.trim() || today,
        jenis: req.body.jenis?.trim() || 'MASUK',
        kategori: req.body.kategori?.trim() || 'LAYANAN_PASIEN',
        keterangan: req.body.keterangan.trim(),
        nominal: req.body.nominal ? new Decimal(req.body.nominal) : new Decimal(0),
        referensi: req.body.referensi?.trim() || '',
      },
    });

    return reply.status(201).send({
      item: {
        ...item,
        nominal: serializeDecimal(item.nominal),
      },
    });
  });

  app.delete<{ Params: { id: string } }>('/api/keuangan/transaksi/:id', async (req, reply) => {
    try {
      await prisma.keuanganTransaksi.delete({ where: { id: req.params.id } });
      return { ok: true };
    } catch {
      return reply.status(404).send({ error: 'Transaksi tidak ditemukan' });
    }
  });
}
