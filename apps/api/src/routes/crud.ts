import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { Decimal, PrismaClientKnownRequestError } from '../generated/prisma/internal/prismaNamespace.js';
import { prisma } from '../lib/prisma.js';
import { calcTotalSharing, sumHarga } from '../lib/pasienFinance.js';
import { hashPassword } from '../lib/password.js';
import { nextPendaftaranUmumCode, nextRegCode } from '../lib/regCode.js';
import { buildPaginationMeta, parsePagination } from '../lib/pagination.js';
import {
  adminPendaftaranListWhere,
  dokterListWhere,
  hargaListWhere,
  jenisListWhere,
  karyawanKlinikListWhere,
  kesanListWhere,
  logoPerusahaanListWhere,
  pasienAntreanWhere,
  pasienDuplikatListWhere,
  pasienListWhere,
  pendaftaranUmumListWhere,
  petugasAdminKlinikListWhere,
  petugasKasirListWhere,
  daftarTelponListWhere,
  petugasLabListWhere,
  radiograferListWhere,
  radiologListWhere,
  staffListWhere,
  suratKeteranganRujukanListWhere,
  suratKeteranganSehatListWhere,
  tandaTanganElektronikListWhere,
} from '../lib/searchWhere.js';
import { syncPasienDuplikat } from '../lib/pasienDuplikat.js';
import { computeUmur, serializeDecimal } from '../lib/serialize.js';

type ListQuery = { page?: string; limit?: string; q?: string };
type StaffListQuery = ListQuery & { role?: string };
type StaffRoleInput = 'ADMIN' | 'KARYAWAN';
type PasienListQuery = ListQuery & {
  hasilStatus?: string;
  paymentStatus?: string;
  pengirimId?: string;
  startDate?: string;
  endDate?: string;
  modul?: string;
};
type PendaftaranUmumListQuery = ListQuery & {
  startDate?: string;
  endDate?: string;
};

const pasienInclude = {
  pengirim: true,
  radiolog: true,
  pemeriksaan: { include: { jenisPemeriksaan: true } },
  paketLab: { include: { paketLab: true } },
} as const;

const staffPublicSelect = {
  id: true,
  nama: true,
  email: true,
  role: true,
} as const;

function badRequest(reply: FastifyReply, message: string) {
  return reply.status(400).send({ error: message });
}

export async function registerCrudRoutes(app: FastifyInstance) {
  app.get<{ Querystring: ListQuery }>('/api/dokter', async (req) => {
    const { page, limit, skip } = parsePagination(req.query);
    const where = dokterListWhere(req.query.q);
    const [total, items] = await Promise.all([
      prisma.dokter.count({ where }),
      prisma.dokter.findMany({ where, orderBy: { nama: 'asc' }, skip, take: limit }),
    ]);
    return {
      items: items.map((d) => ({
        ...d,
        defaultSharingAmount: serializeDecimal(d.defaultSharingAmount),
      })),
      pagination: buildPaginationMeta(total, page, limit),
    };
  });

  app.post<{
    Body: {
      nama: string;
      spesialisasi?: string;
      noTelepon?: string;
      namaBank?: string;
      noRekening?: string;
      defaultSharingAmount?: number;
    };
  }>('/api/dokter', async (req, reply) => {
    if (!req.body.nama?.trim()) return badRequest(reply, 'nama wajib diisi');
    const item = await prisma.dokter.create({
      data: {
        nama: req.body.nama.trim(),
        spesialisasi: req.body.spesialisasi?.trim() || null,
        noTelepon: req.body.noTelepon?.trim() || null,
        namaBank: req.body.namaBank?.trim() || null,
        noRekening: req.body.noRekening?.trim() || null,
        defaultSharingAmount: req.body.defaultSharingAmount ?? 0,
      },
    });
    return reply.status(201).send({
      item: { ...item, defaultSharingAmount: serializeDecimal(item.defaultSharingAmount) },
    });
  });

  app.delete<{ Params: { id: string } }>('/api/dokter/:id', async (req, reply) => {
    try {
      await prisma.dokter.delete({ where: { id: req.params.id } });
      return { ok: true };
    } catch {
      return reply.status(409).send({ error: 'Dokter masih dipakai pasien' });
    }
  });

  app.patch<{
    Params: { id: string };
    Body: {
      nama?: string;
      spesialisasi?: string;
      noTelepon?: string;
      namaBank?: string;
      noRekening?: string;
      defaultSharingAmount?: number;
    };
  }>('/api/dokter/:id', async (req, reply) => {
    const existing = await prisma.dokter.findUnique({ where: { id: req.params.id } });
    if (!existing) return reply.status(404).send({ error: 'Dokter tidak ditemukan' });
    const item = await prisma.dokter.update({
      where: { id: req.params.id },
      data: {
        nama: req.body.nama?.trim() ?? existing.nama,
        spesialisasi: req.body.spesialisasi !== undefined ? req.body.spesialisasi?.trim() || null : existing.spesialisasi,
        noTelepon: req.body.noTelepon !== undefined ? req.body.noTelepon?.trim() || null : existing.noTelepon,
        namaBank: req.body.namaBank !== undefined ? req.body.namaBank?.trim() || null : existing.namaBank,
        noRekening: req.body.noRekening !== undefined ? req.body.noRekening?.trim() || null : existing.noRekening,
        defaultSharingAmount: req.body.defaultSharingAmount ?? existing.defaultSharingAmount,
      },
    });
    return {
      item: { ...item, defaultSharingAmount: serializeDecimal(item.defaultSharingAmount) },
    };
  });

  app.get<{ Querystring: ListQuery }>('/api/karyawan-klinik', async (req) => {
    const { page, limit, skip } = parsePagination(req.query);
    const where = karyawanKlinikListWhere(req.query.q);
    const [total, items] = await Promise.all([
      prisma.karyawanKlinik.count({ where }),
      prisma.karyawanKlinik.findMany({ where, orderBy: { nama: 'asc' }, skip, take: limit }),
    ]);
    return { items, pagination: buildPaginationMeta(total, page, limit) };
  });

  app.post<{
    Body: { nama: string; spesialisasi?: string; noTelepon?: string; namaBank?: string; noRekening?: string };
  }>('/api/karyawan-klinik', async (req, reply) => {
    if (!req.body.nama?.trim()) return badRequest(reply, 'nama wajib diisi');
    const item = await prisma.karyawanKlinik.create({
      data: {
        nama: req.body.nama.trim(),
        spesialisasi: req.body.spesialisasi?.trim() || null,
        noTelepon: req.body.noTelepon?.trim() || null,
        namaBank: req.body.namaBank?.trim() || null,
        noRekening: req.body.noRekening?.trim() || null,
      },
    });
    return reply.status(201).send({ item });
  });

  app.delete<{ Params: { id: string } }>('/api/karyawan-klinik/:id', async (req) => {
    await prisma.karyawanKlinik.delete({ where: { id: req.params.id } });
    return { ok: true };
  });

  app.patch<{
    Params: { id: string };
    Body: { nama?: string; spesialisasi?: string; noTelepon?: string; namaBank?: string; noRekening?: string };
  }>('/api/karyawan-klinik/:id', async (req, reply) => {
    const existing = await prisma.karyawanKlinik.findUnique({ where: { id: req.params.id } });
    if (!existing) return reply.status(404).send({ error: 'Karyawan tidak ditemukan' });
    const item = await prisma.karyawanKlinik.update({
      where: { id: req.params.id },
      data: {
        nama: req.body.nama?.trim() ?? existing.nama,
        spesialisasi: req.body.spesialisasi !== undefined ? req.body.spesialisasi?.trim() || null : existing.spesialisasi,
        noTelepon: req.body.noTelepon !== undefined ? req.body.noTelepon?.trim() || null : existing.noTelepon,
        namaBank: req.body.namaBank !== undefined ? req.body.namaBank?.trim() || null : existing.namaBank,
        noRekening: req.body.noRekening !== undefined ? req.body.noRekening?.trim() || null : existing.noRekening,
      },
    });
    return { item };
  });

  app.get<{ Querystring: ListQuery }>('/api/radiolog', async (req) => {
    const { page, limit, skip } = parsePagination(req.query);
    const where = radiologListWhere(req.query.q);
    const [total, items] = await Promise.all([
      prisma.radiolog.count({ where }),
      prisma.radiolog.findMany({ where, orderBy: { nama: 'asc' }, skip, take: limit }),
    ]);
    return { items, pagination: buildPaginationMeta(total, page, limit) };
  });

  app.post<{ Body: { nama: string; noTelepon?: string } }>(
    '/api/radiolog',
    async (req, reply) => {
      if (!req.body.nama?.trim()) return badRequest(reply, 'nama wajib diisi');
      const item = await prisma.radiolog.create({
        data: {
          nama: req.body.nama.trim(),
          noTelepon: req.body.noTelepon?.trim() || null,
        },
      });
      return reply.status(201).send({ item });
    },
  );

  app.delete<{ Params: { id: string } }>('/api/radiolog/:id', async (req) => {
    await prisma.radiolog.delete({ where: { id: req.params.id } });
    return { ok: true };
  });

  app.patch<{ Params: { id: string }; Body: { nama?: string; noTelepon?: string } }>(
    '/api/radiolog/:id',
    async (req, reply) => {
      const existing = await prisma.radiolog.findUnique({ where: { id: req.params.id } });
      if (!existing) return reply.status(404).send({ error: 'Radiolog tidak ditemukan' });
      const item = await prisma.radiolog.update({
        where: { id: req.params.id },
        data: {
          nama: req.body.nama?.trim() ?? existing.nama,
          noTelepon: req.body.noTelepon !== undefined ? req.body.noTelepon?.trim() || null : existing.noTelepon,
        },
      });
      return { item };
    },
  );

  app.get<{ Querystring: ListQuery }>('/api/petugas-lab', async (req) => {
    const { page, limit, skip } = parsePagination(req.query);
    const where = petugasLabListWhere(req.query.q);
    const [total, items] = await Promise.all([
      prisma.petugasLab.count({ where }),
      prisma.petugasLab.findMany({
        where,
        orderBy: { nama: 'asc' },
        skip,
        take: limit,
      }),
    ]);
    return { items, pagination: buildPaginationMeta(total, page, limit) };
  });

  app.get<{ Params: { id: string } }>('/api/petugas-lab/:id', async (req, reply) => {
    const item = await prisma.petugasLab.findUnique({ where: { id: req.params.id } });
    if (!item) return reply.status(404).send({ error: 'Petugas lab tidak ditemukan' });
    return { item };
  });

  app.post<{ Body: { nama: string; nip?: string; noTelepon?: string } }>(
    '/api/petugas-lab',
    async (req, reply) => {
      if (!req.body.nama?.trim()) return badRequest(reply, 'nama wajib diisi');
      const item = await prisma.petugasLab.create({
        data: {
          nama: req.body.nama.trim(),
          nip: req.body.nip?.trim() || null,
          noTelepon: req.body.noTelepon?.trim() || null,
        },
      });
      return reply.status(201).send({ item });
    },
  );

  app.delete<{ Params: { id: string } }>('/api/petugas-lab/:id', async (req) => {
    await prisma.petugasLab.delete({ where: { id: req.params.id } });
    return { ok: true };
  });

  app.patch<{ Params: { id: string }; Body: { nama?: string; nip?: string; noTelepon?: string } }>(
    '/api/petugas-lab/:id',
    async (req, reply) => {
      const existing = await prisma.petugasLab.findUnique({ where: { id: req.params.id } });
      if (!existing) return reply.status(404).send({ error: 'Petugas lab tidak ditemukan' });
      const item = await prisma.petugasLab.update({
        where: { id: req.params.id },
        data: {
          nama: req.body.nama?.trim() ?? existing.nama,
          nip: req.body.nip !== undefined ? req.body.nip?.trim() || null : existing.nip,
          noTelepon: req.body.noTelepon !== undefined ? req.body.noTelepon?.trim() || null : existing.noTelepon,
        },
      });
      return { item };
    },
  );

  app.get<{ Querystring: ListQuery }>('/api/radiografer', async (req) => {
    const { page, limit, skip } = parsePagination(req.query);
    const where = radiograferListWhere(req.query.q);
    const [total, items] = await Promise.all([
      prisma.radiografer.count({ where }),
      prisma.radiografer.findMany({
        where,
        orderBy: { nama: 'asc' },
        skip,
        take: limit,
      }),
    ]);
    return { items, pagination: buildPaginationMeta(total, page, limit) };
  });

  app.post<{ Body: { nama: string; noHp?: string } }>('/api/radiografer', async (req, reply) => {
    if (!req.body.nama?.trim()) return badRequest(reply, 'nama wajib diisi');
    const item = await prisma.radiografer.create({
      data: {
        nama: req.body.nama.trim(),
        noHp: req.body.noHp?.trim() || null,
      },
    });
    return reply.status(201).send({ item });
  });

  app.patch<{ Params: { id: string }; Body: { nama?: string; noHp?: string } }>(
    '/api/radiografer/:id',
    async (req, reply) => {
      const existing = await prisma.radiografer.findUnique({ where: { id: req.params.id } });
      if (!existing) return reply.status(404).send({ error: 'Radiografer tidak ditemukan' });
      const item = await prisma.radiografer.update({
        where: { id: req.params.id },
        data: {
          nama: req.body.nama?.trim() ?? existing.nama,
          noHp: req.body.noHp !== undefined ? req.body.noHp?.trim() || null : existing.noHp,
        },
      });
      return { item };
    },
  );

  app.delete<{ Params: { id: string } }>('/api/radiografer/:id', async (req) => {
    await prisma.radiografer.delete({ where: { id: req.params.id } });
    return { ok: true };
  });

  app.get<{ Querystring: ListQuery }>('/api/petugas-kasir', async (req) => {
    const { page, limit, skip } = parsePagination(req.query);
    const where = petugasKasirListWhere(req.query.q);
    const [total, items] = await Promise.all([
      prisma.petugasKasir.count({ where }),
      prisma.petugasKasir.findMany({
        where,
        orderBy: { nama: 'asc' },
        skip,
        take: limit,
      }),
    ]);
    return { items, pagination: buildPaginationMeta(total, page, limit) };
  });

  app.post<{ Body: { nama: string; noHp?: string } }>('/api/petugas-kasir', async (req, reply) => {
    if (!req.body.nama?.trim()) return badRequest(reply, 'nama wajib diisi');
    const item = await prisma.petugasKasir.create({
      data: {
        nama: req.body.nama.trim(),
        noHp: req.body.noHp?.trim() || null,
      },
    });
    return reply.status(201).send({ item });
  });

  app.patch<{ Params: { id: string }; Body: { nama?: string; noHp?: string } }>(
    '/api/petugas-kasir/:id',
    async (req, reply) => {
      const existing = await prisma.petugasKasir.findUnique({ where: { id: req.params.id } });
      if (!existing) return reply.status(404).send({ error: 'Petugas kasir tidak ditemukan' });
      const item = await prisma.petugasKasir.update({
        where: { id: req.params.id },
        data: {
          nama: req.body.nama?.trim() ?? existing.nama,
          noHp: req.body.noHp !== undefined ? req.body.noHp?.trim() || null : existing.noHp,
        },
      });
      return { item };
    },
  );

  app.delete<{ Params: { id: string } }>('/api/petugas-kasir/:id', async (req) => {
    await prisma.petugasKasir.delete({ where: { id: req.params.id } });
    return { ok: true };
  });

  app.get<{ Querystring: ListQuery }>('/api/petugas-admin-klinik', async (req) => {
    const { page, limit, skip } = parsePagination(req.query);
    const where = petugasAdminKlinikListWhere(req.query.q);
    const [total, items] = await Promise.all([
      prisma.petugasAdminKlinik.count({ where }),
      prisma.petugasAdminKlinik.findMany({
        where,
        orderBy: { nama: 'asc' },
        skip,
        take: limit,
      }),
    ]);
    return { items, pagination: buildPaginationMeta(total, page, limit) };
  });

  app.post<{ Body: { nama: string; noHp?: string } }>('/api/petugas-admin-klinik', async (req, reply) => {
    if (!req.body.nama?.trim()) return badRequest(reply, 'nama wajib diisi');
    const item = await prisma.petugasAdminKlinik.create({
      data: {
        nama: req.body.nama.trim(),
        noHp: req.body.noHp?.trim() || null,
      },
    });
    return reply.status(201).send({ item });
  });

  app.patch<{ Params: { id: string }; Body: { nama?: string; noHp?: string } }>(
    '/api/petugas-admin-klinik/:id',
    async (req, reply) => {
      const existing = await prisma.petugasAdminKlinik.findUnique({ where: { id: req.params.id } });
      if (!existing) return reply.status(404).send({ error: 'Petugas admin klinik tidak ditemukan' });
      const item = await prisma.petugasAdminKlinik.update({
        where: { id: req.params.id },
        data: {
          nama: req.body.nama?.trim() ?? existing.nama,
          noHp: req.body.noHp !== undefined ? req.body.noHp?.trim() || null : existing.noHp,
        },
      });
      return { item };
    },
  );

  app.delete<{ Params: { id: string } }>('/api/petugas-admin-klinik/:id', async (req) => {
    await prisma.petugasAdminKlinik.delete({ where: { id: req.params.id } });
    return { ok: true };
  });

  app.get<{ Querystring: ListQuery }>('/api/admin-pendaftaran', async (req) => {
    const { page, limit, skip } = parsePagination(req.query);
    const where = adminPendaftaranListWhere(req.query.q);
    const [total, items] = await Promise.all([
      prisma.adminPendaftaran.count({ where }),
      prisma.adminPendaftaran.findMany({
        where,
        orderBy: { nama: 'asc' },
        skip,
        take: limit,
      }),
    ]);
    return { items, pagination: buildPaginationMeta(total, page, limit) };
  });

  app.post<{ Body: { nama: string; noHp?: string } }>('/api/admin-pendaftaran', async (req, reply) => {
    if (!req.body.nama?.trim()) return badRequest(reply, 'nama wajib diisi');
    const item = await prisma.adminPendaftaran.create({
      data: {
        nama: req.body.nama.trim(),
        noHp: req.body.noHp?.trim() || null,
      },
    });
    return reply.status(201).send({ item });
  });

  app.patch<{
    Params: { id: string };
    Body: { nama?: string; noHp?: string; statusHadir?: string | null; statusTanggal?: string | null };
  }>('/api/admin-pendaftaran/:id', async (req, reply) => {
    const existing = await prisma.adminPendaftaran.findUnique({ where: { id: req.params.id } });
    if (!existing) return reply.status(404).send({ error: 'Admin pendaftaran tidak ditemukan' });
    const item = await prisma.adminPendaftaran.update({
      where: { id: req.params.id },
      data: {
        nama: req.body.nama?.trim() ?? existing.nama,
        noHp: req.body.noHp !== undefined ? req.body.noHp?.trim() || null : existing.noHp,
        statusHadir: req.body.statusHadir !== undefined ? req.body.statusHadir : existing.statusHadir,
        statusTanggal: req.body.statusTanggal !== undefined ? req.body.statusTanggal : existing.statusTanggal,
      },
    });
    return { item };
  });

  app.delete<{ Params: { id: string } }>('/api/admin-pendaftaran/:id', async (req) => {
    await prisma.adminPendaftaran.delete({ where: { id: req.params.id } });
    return { ok: true };
  });

  app.get<{ Querystring: ListQuery }>('/api/hitungan-led', async (req) => {
    const { page, limit, skip } = parsePagination(req.query);
    const q = req.query.q?.trim();
    const where = q ? { namaPasien: { contains: q } } : {};
    const [total, items] = await Promise.all([
      prisma.hitunganLed.count({ where }),
      prisma.hitunganLed.findMany({
        where,
        orderBy: { tanggal: 'desc' },
        skip,
        take: limit,
      }),
    ]);
    return {
      items: items.map((h) => ({
        id: h.id,
        namaPasien: h.namaPasien,
        jenisKelamin: h.jenisKelamin,
        jamPertama: serializeDecimal(h.jamPertama),
        jamKedua: serializeDecimal(h.jamKedua),
        tanggal: h.tanggal.toISOString(),
      })),
      pagination: buildPaginationMeta(total, page, limit),
    };
  });

  app.post<{
    Body: {
      namaPasien: string;
      jenisKelamin: 'L' | 'P';
      jamPertama: number;
      jamKedua: number;
      tanggal?: string;
    };
  }>('/api/hitungan-led', async (req, reply) => {
    const b = req.body;
    if (!b.namaPasien?.trim() || !b.jenisKelamin || b.jamPertama === undefined || b.jamKedua === undefined) {
      return badRequest(reply, 'namaPasien, jenisKelamin, jamPertama, jamKedua wajib diisi');
    }
    const item = await prisma.hitunganLed.create({
      data: {
        namaPasien: b.namaPasien.trim(),
        jenisKelamin: b.jenisKelamin,
        jamPertama: b.jamPertama,
        jamKedua: b.jamKedua,
        tanggal: b.tanggal ? new Date(b.tanggal) : new Date(),
      },
    });
    return reply.status(201).send({
      item: {
        id: item.id,
        namaPasien: item.namaPasien,
        jenisKelamin: item.jenisKelamin,
        jamPertama: serializeDecimal(item.jamPertama),
        jamKedua: serializeDecimal(item.jamKedua),
        tanggal: item.tanggal.toISOString(),
      },
    });
  });

  app.patch<{
    Params: { id: string };
    Body: {
      namaPasien?: string;
      jenisKelamin?: 'L' | 'P';
      jamPertama?: number;
      jamKedua?: number;
      tanggal?: string;
    };
  }>('/api/hitungan-led/:id', async (req, reply) => {
    const existing = await prisma.hitunganLed.findUnique({ where: { id: req.params.id } });
    if (!existing) return reply.status(404).send({ error: 'Data hitungan LED tidak ditemukan' });
    const item = await prisma.hitunganLed.update({
      where: { id: req.params.id },
      data: {
        namaPasien: req.body.namaPasien?.trim() ?? existing.namaPasien,
        jenisKelamin: req.body.jenisKelamin ?? existing.jenisKelamin,
        jamPertama: req.body.jamPertama !== undefined ? req.body.jamPertama : existing.jamPertama,
        jamKedua: req.body.jamKedua !== undefined ? req.body.jamKedua : existing.jamKedua,
        tanggal: req.body.tanggal ? new Date(req.body.tanggal) : existing.tanggal,
      },
    });
    return {
      item: {
        id: item.id,
        namaPasien: item.namaPasien,
        jenisKelamin: item.jenisKelamin,
        jamPertama: serializeDecimal(item.jamPertama),
        jamKedua: serializeDecimal(item.jamKedua),
        tanggal: item.tanggal.toISOString(),
      },
    };
  });

  app.delete<{ Params: { id: string } }>('/api/hitungan-led/:id', async (req) => {
    await prisma.hitunganLed.delete({ where: { id: req.params.id } });
    return { ok: true };
  });

  app.get<{ Querystring: ListQuery }>('/api/kondisi-alat', async (req) => {
    const { page, limit, skip } = parsePagination(req.query);
    const q = req.query.q?.trim();
    const where = q ? { namaPasien: { contains: q } } : {};
    const [total, items] = await Promise.all([
      prisma.kondisiAlat.count({ where }),
      prisma.kondisiAlat.findMany({
        where,
        orderBy: { tanggal: 'desc' },
        skip,
        take: limit,
      }),
    ]);
    return {
      items: items.map((k) => ({
        id: k.id,
        namaPasien: k.namaPasien,
        kv: serializeDecimal(k.kv),
        sekon: serializeDecimal(k.sekon),
        mAs: serializeDecimal(k.mAs),
        beratBadan: k.beratBadan !== null ? serializeDecimal(k.beratBadan) : null,
        tanggal: k.tanggal.toISOString(),
      })),
      pagination: buildPaginationMeta(total, page, limit),
    };
  });

  app.post<{
    Body: {
      namaPasien: string;
      kv: number;
      sekon: number;
      mAs: number;
      beratBadan?: number;
      tanggal?: string;
    };
  }>('/api/kondisi-alat', async (req, reply) => {
    const b = req.body;
    if (!b.namaPasien?.trim() || b.kv === undefined || b.sekon === undefined || b.mAs === undefined) {
      return badRequest(reply, 'namaPasien, kv, sekon, mAs wajib diisi');
    }
    const item = await prisma.kondisiAlat.create({
      data: {
        namaPasien: b.namaPasien.trim(),
        kv: b.kv,
        sekon: b.sekon,
        mAs: b.mAs,
        beratBadan: b.beratBadan ?? null,
        tanggal: b.tanggal ? new Date(b.tanggal) : new Date(),
      },
    });
    return reply.status(201).send({
      item: {
        id: item.id,
        namaPasien: item.namaPasien,
        kv: serializeDecimal(item.kv),
        sekon: serializeDecimal(item.sekon),
        mAs: serializeDecimal(item.mAs),
        beratBadan: item.beratBadan !== null ? serializeDecimal(item.beratBadan) : null,
        tanggal: item.tanggal.toISOString(),
      },
    });
  });

  app.patch<{
    Params: { id: string };
    Body: {
      namaPasien?: string;
      kv?: number;
      sekon?: number;
      mAs?: number;
      beratBadan?: number;
      tanggal?: string;
    };
  }>('/api/kondisi-alat/:id', async (req, reply) => {
    const existing = await prisma.kondisiAlat.findUnique({ where: { id: req.params.id } });
    if (!existing) return reply.status(404).send({ error: 'Data kondisi alat tidak ditemukan' });
    const item = await prisma.kondisiAlat.update({
      where: { id: req.params.id },
      data: {
        namaPasien: req.body.namaPasien?.trim() ?? existing.namaPasien,
        kv: req.body.kv !== undefined ? req.body.kv : existing.kv,
        sekon: req.body.sekon !== undefined ? req.body.sekon : existing.sekon,
        mAs: req.body.mAs !== undefined ? req.body.mAs : existing.mAs,
        beratBadan: req.body.beratBadan !== undefined ? req.body.beratBadan : existing.beratBadan,
        tanggal: req.body.tanggal ? new Date(req.body.tanggal) : existing.tanggal,
      },
    });
    return {
      item: {
        id: item.id,
        namaPasien: item.namaPasien,
        kv: serializeDecimal(item.kv),
        sekon: serializeDecimal(item.sekon),
        mAs: serializeDecimal(item.mAs),
        beratBadan: item.beratBadan !== null ? serializeDecimal(item.beratBadan) : null,
        tanggal: item.tanggal.toISOString(),
      },
    };
  });

  app.delete<{ Params: { id: string } }>('/api/kondisi-alat/:id', async (req) => {
    await prisma.kondisiAlat.delete({ where: { id: req.params.id } });
    return { ok: true };
  });

  app.get<{ Querystring: ListQuery & { bulan?: string } }>('/api/gaji-karyawan', async (req) => {
    const { page, limit, skip } = parsePagination(req.query);
    const q = req.query.q?.trim();
    const where = {
      ...(q ? { namaKaryawan: { contains: q } } : {}),
      ...(req.query.bulan ? { bulan: req.query.bulan } : {}),
    };
    const [total, items] = await Promise.all([
      prisma.gajiKaryawan.count({ where }),
      prisma.gajiKaryawan.findMany({
        where,
        orderBy: [{ bulan: 'desc' }, { namaKaryawan: 'asc' }],
        skip,
        take: limit,
      }),
    ]);
    return {
      items: items.map((g) => ({
        id: g.id,
        namaKaryawan: g.namaKaryawan,
        jabatan: g.jabatan,
        bulan: g.bulan,
        tanggal: g.tanggal.toISOString(),
        gajiPokok: serializeDecimal(g.gajiPokok),
        tunjangan: serializeDecimal(g.tunjangan),
        potongan: serializeDecimal(g.potongan),
        gajiBersih: serializeDecimal(g.gajiBersih),
      })),
      pagination: buildPaginationMeta(total, page, limit),
    };
  });

  app.post<{
    Body: {
      namaKaryawan: string;
      jabatan?: string;
      bulan: string;
      tanggal?: string;
      gajiPokok: number;
      tunjangan?: number;
      potongan?: number;
    };
  }>('/api/gaji-karyawan', async (req, reply) => {
    const b = req.body;
    if (!b.namaKaryawan?.trim() || !b.bulan?.trim() || b.gajiPokok === undefined) {
      return badRequest(reply, 'namaKaryawan, bulan, gajiPokok wajib diisi');
    }
    const gajiPokok = b.gajiPokok;
    const tunjangan = b.tunjangan ?? 0;
    const potongan = b.potongan ?? 0;
    const item = await prisma.gajiKaryawan.create({
      data: {
        namaKaryawan: b.namaKaryawan.trim(),
        jabatan: b.jabatan?.trim() || null,
        bulan: b.bulan.trim(),
        tanggal: b.tanggal ? new Date(b.tanggal) : new Date(),
        gajiPokok,
        tunjangan,
        potongan,
        gajiBersih: gajiPokok + tunjangan - potongan,
      },
    });
    return reply.status(201).send({
      item: {
        id: item.id,
        namaKaryawan: item.namaKaryawan,
        jabatan: item.jabatan,
        bulan: item.bulan,
        tanggal: item.tanggal.toISOString(),
        gajiPokok: serializeDecimal(item.gajiPokok),
        tunjangan: serializeDecimal(item.tunjangan),
        potongan: serializeDecimal(item.potongan),
        gajiBersih: serializeDecimal(item.gajiBersih),
      },
    });
  });

  app.patch<{
    Params: { id: string };
    Body: {
      namaKaryawan?: string;
      jabatan?: string;
      bulan?: string;
      tanggal?: string;
      gajiPokok?: number;
      tunjangan?: number;
      potongan?: number;
    };
  }>('/api/gaji-karyawan/:id', async (req, reply) => {
    const existing = await prisma.gajiKaryawan.findUnique({ where: { id: req.params.id } });
    if (!existing) return reply.status(404).send({ error: 'Data gaji karyawan tidak ditemukan' });
    const gajiPokok = req.body.gajiPokok ?? Number(existing.gajiPokok);
    const tunjangan = req.body.tunjangan ?? Number(existing.tunjangan);
    const potongan = req.body.potongan ?? Number(existing.potongan);
    const item = await prisma.gajiKaryawan.update({
      where: { id: req.params.id },
      data: {
        namaKaryawan: req.body.namaKaryawan?.trim() ?? existing.namaKaryawan,
        jabatan: req.body.jabatan !== undefined ? req.body.jabatan?.trim() || null : existing.jabatan,
        bulan: req.body.bulan?.trim() ?? existing.bulan,
        tanggal: req.body.tanggal ? new Date(req.body.tanggal) : existing.tanggal,
        gajiPokok,
        tunjangan,
        potongan,
        gajiBersih: gajiPokok + tunjangan - potongan,
      },
    });
    return {
      item: {
        id: item.id,
        namaKaryawan: item.namaKaryawan,
        jabatan: item.jabatan,
        bulan: item.bulan,
        tanggal: item.tanggal.toISOString(),
        gajiPokok: serializeDecimal(item.gajiPokok),
        tunjangan: serializeDecimal(item.tunjangan),
        potongan: serializeDecimal(item.potongan),
        gajiBersih: serializeDecimal(item.gajiBersih),
      },
    };
  });

  app.delete<{ Params: { id: string } }>('/api/gaji-karyawan/:id', async (req) => {
    await prisma.gajiKaryawan.delete({ where: { id: req.params.id } });
    return { ok: true };
  });

  app.get<{ Querystring: ListQuery & { departemen?: string } }>('/api/karyawan', async (req) => {
    const { page, limit, skip } = parsePagination(req.query);
    const q = req.query.q?.trim();
    const where = {
      ...(req.query.departemen ? { departemen: req.query.departemen } : {}),
      ...(q ? { nama: { contains: q } } : {}),
    };
    const [total, items] = await Promise.all([
      prisma.karyawan.count({ where }),
      prisma.karyawan.findMany({
        where,
        orderBy: { nama: 'asc' },
        skip,
        take: limit,
      }),
    ]);
    return { items, pagination: buildPaginationMeta(total, page, limit) };
  });

  app.post<{
    Body: {
      nama: string;
      jabatan?: string;
      noTelepon?: string;
      alamat?: string;
      departemen: string;
    };
  }>('/api/karyawan', async (req, reply) => {
    const b = req.body;
    if (!b.nama?.trim() || !b.departemen?.trim()) {
      return badRequest(reply, 'nama, departemen wajib diisi');
    }
    const item = await prisma.karyawan.create({
      data: {
        nama: b.nama.trim(),
        jabatan: b.jabatan?.trim() || null,
        noTelepon: b.noTelepon?.trim() || null,
        alamat: b.alamat?.trim() || null,
        departemen: b.departemen.trim(),
      },
    });
    return reply.status(201).send({ item });
  });

  app.patch<{
    Params: { id: string };
    Body: {
      nama?: string;
      jabatan?: string;
      noTelepon?: string;
      alamat?: string;
    };
  }>('/api/karyawan/:id', async (req, reply) => {
    const existing = await prisma.karyawan.findUnique({ where: { id: req.params.id } });
    if (!existing) return reply.status(404).send({ error: 'Karyawan tidak ditemukan' });
    const item = await prisma.karyawan.update({
      where: { id: req.params.id },
      data: {
        nama: req.body.nama?.trim() ?? existing.nama,
        jabatan: req.body.jabatan !== undefined ? req.body.jabatan?.trim() || null : existing.jabatan,
        noTelepon:
          req.body.noTelepon !== undefined ? req.body.noTelepon?.trim() || null : existing.noTelepon,
        alamat: req.body.alamat !== undefined ? req.body.alamat?.trim() || null : existing.alamat,
      },
    });
    return { item };
  });

  app.delete<{ Params: { id: string } }>('/api/karyawan/:id', async (req) => {
    await prisma.karyawan.delete({ where: { id: req.params.id } });
    return { ok: true };
  });

  app.get<{ Querystring: ListQuery & { startDate?: string; endDate?: string } }>(
    '/api/bhp-radiologi',
    async (req) => {
      const { page, limit, skip } = parsePagination(req.query);
      const q = req.query.q?.trim();
      const { startDate, endDate } = req.query;
      const where = {
        ...(q ? { pemakaian: { contains: q } } : {}),
        ...(startDate || endDate
          ? {
              tanggal: {
                ...(startDate ? { gte: new Date(startDate) } : {}),
                ...(endDate ? { lte: new Date(endDate) } : {}),
              },
            }
          : {}),
      };
      const [total, items] = await Promise.all([
        prisma.bhpRadiologi.count({ where }),
        prisma.bhpRadiologi.findMany({
          where,
          orderBy: { tanggal: 'desc' },
          skip,
          take: limit,
        }),
      ]);
      return {
        items: items.map((b) => ({
          id: b.id,
          tanggal: b.tanggal.toISOString(),
          pemakaian: b.pemakaian,
          harga: serializeDecimal(b.harga),
          dev: serializeDecimal(b.dev),
          fixer: serializeDecimal(b.fixer),
          film: serializeDecimal(b.film),
          amplopKertas: serializeDecimal(b.amplopKertas),
          listrik: serializeDecimal(b.listrik),
          gajiKaryawan: serializeDecimal(b.gajiKaryawan),
          kertasCetak: serializeDecimal(b.kertasCetak),
          amplop: serializeDecimal(b.amplop),
        })),
        pagination: buildPaginationMeta(total, page, limit),
      };
    },
  );

  app.post<{
    Body: {
      tanggal?: string;
      pemakaian: string;
      harga?: number;
      dev?: number;
      fixer?: number;
      film?: number;
      amplopKertas?: number;
      listrik?: number;
      gajiKaryawan?: number;
      kertasCetak?: number;
      amplop?: number;
    };
  }>('/api/bhp-radiologi', async (req, reply) => {
    const b = req.body;
    if (!b.pemakaian?.trim()) {
      return badRequest(reply, 'pemakaian wajib diisi');
    }
    const item = await prisma.bhpRadiologi.create({
      data: {
        tanggal: b.tanggal ? new Date(b.tanggal) : new Date(),
        pemakaian: b.pemakaian.trim(),
        harga: b.harga ?? 0,
        dev: b.dev ?? 0,
        fixer: b.fixer ?? 0,
        film: b.film ?? 0,
        amplopKertas: b.amplopKertas ?? 0,
        listrik: b.listrik ?? 0,
        gajiKaryawan: b.gajiKaryawan ?? 0,
        kertasCetak: b.kertasCetak ?? 0,
        amplop: b.amplop ?? 0,
      },
    });
    return reply.status(201).send({
      item: {
        id: item.id,
        tanggal: item.tanggal.toISOString(),
        pemakaian: item.pemakaian,
        harga: serializeDecimal(item.harga),
        dev: serializeDecimal(item.dev),
        fixer: serializeDecimal(item.fixer),
        film: serializeDecimal(item.film),
        amplopKertas: serializeDecimal(item.amplopKertas),
        listrik: serializeDecimal(item.listrik),
        gajiKaryawan: serializeDecimal(item.gajiKaryawan),
        kertasCetak: serializeDecimal(item.kertasCetak),
        amplop: serializeDecimal(item.amplop),
      },
    });
  });

  app.patch<{
    Params: { id: string };
    Body: {
      tanggal?: string;
      pemakaian?: string;
      harga?: number;
      dev?: number;
      fixer?: number;
      film?: number;
      amplopKertas?: number;
      listrik?: number;
      gajiKaryawan?: number;
      kertasCetak?: number;
      amplop?: number;
    };
  }>('/api/bhp-radiologi/:id', async (req, reply) => {
    const existing = await prisma.bhpRadiologi.findUnique({ where: { id: req.params.id } });
    if (!existing) return reply.status(404).send({ error: 'Data BHP radiologi tidak ditemukan' });
    const item = await prisma.bhpRadiologi.update({
      where: { id: req.params.id },
      data: {
        tanggal: req.body.tanggal ? new Date(req.body.tanggal) : existing.tanggal,
        pemakaian: req.body.pemakaian?.trim() ?? existing.pemakaian,
        harga: req.body.harga !== undefined ? req.body.harga : existing.harga,
        dev: req.body.dev !== undefined ? req.body.dev : existing.dev,
        fixer: req.body.fixer !== undefined ? req.body.fixer : existing.fixer,
        film: req.body.film !== undefined ? req.body.film : existing.film,
        amplopKertas:
          req.body.amplopKertas !== undefined ? req.body.amplopKertas : existing.amplopKertas,
        listrik: req.body.listrik !== undefined ? req.body.listrik : existing.listrik,
        gajiKaryawan:
          req.body.gajiKaryawan !== undefined ? req.body.gajiKaryawan : existing.gajiKaryawan,
        kertasCetak: req.body.kertasCetak !== undefined ? req.body.kertasCetak : existing.kertasCetak,
        amplop: req.body.amplop !== undefined ? req.body.amplop : existing.amplop,
      },
    });
    return {
      item: {
        id: item.id,
        tanggal: item.tanggal.toISOString(),
        pemakaian: item.pemakaian,
        harga: serializeDecimal(item.harga),
        dev: serializeDecimal(item.dev),
        fixer: serializeDecimal(item.fixer),
        film: serializeDecimal(item.film),
        amplopKertas: serializeDecimal(item.amplopKertas),
        listrik: serializeDecimal(item.listrik),
        gajiKaryawan: serializeDecimal(item.gajiKaryawan),
        kertasCetak: serializeDecimal(item.kertasCetak),
        amplop: serializeDecimal(item.amplop),
      },
    };
  });

  app.delete<{ Params: { id: string } }>('/api/bhp-radiologi/:id', async (req) => {
    await prisma.bhpRadiologi.delete({ where: { id: req.params.id } });
    return { ok: true };
  });

  app.get<{ Querystring: ListQuery }>(
    '/api/jenis-pemeriksaan',
    async (req) => {
      const { page, limit, skip } = parsePagination(req.query);
      const where = jenisListWhere(req.query.q);
      const [total, items] = await Promise.all([
        prisma.jenisPemeriksaan.count({ where }),
        prisma.jenisPemeriksaan.findMany({
          where,
          orderBy: { nama: 'asc' },
          include: { harga: true },
          skip,
          take: limit,
        }),
      ]);
      return {
        items: items.map((j) => ({
          id: j.id,
          nama: j.nama,
          jumlahFilm: j.jumlahFilm,
          harga: j.harga ? serializeDecimal(j.harga.harga) : null,
          detailLayanan: j.harga?.detailLayanan ?? null,
        })),
        pagination: buildPaginationMeta(total, page, limit),
      };
    },
  );

  app.post<{ Body: { nama: string; jumlahFilm?: number; harga?: number; detailLayanan?: string } }>(
    '/api/jenis-pemeriksaan',
    async (req, reply) => {
      if (!req.body.nama?.trim()) return badRequest(reply, 'nama wajib diisi');
      const { harga, detailLayanan, jumlahFilm } = req.body;
      try {
        const item = await prisma.jenisPemeriksaan.create({
          data: {
            nama: req.body.nama.trim(),
            ...(jumlahFilm !== undefined ? { jumlahFilm } : {}),
            ...(harga !== undefined
              ? {
                  harga: {
                    create: {
                      harga,
                      detailLayanan: detailLayanan?.trim() || null,
                    },
                  },
                }
              : {}),
          },
          include: { harga: true },
        });
        return reply.status(201).send({
          item: {
            id: item.id,
            nama: item.nama,
            jumlahFilm: item.jumlahFilm,
            harga: item.harga ? serializeDecimal(item.harga.harga) : null,
            detailLayanan: item.harga?.detailLayanan ?? null,
          },
        });
      } catch (err: unknown) {
        if (err instanceof PrismaClientKnownRequestError && err.code === 'P2002') {
          return badRequest(reply, `Jenis pemeriksaan "${req.body.nama.trim()}" sudah ada`);
        }
        throw err;
      }
    },
  );

  app.delete<{ Params: { id: string } }>(
    '/api/jenis-pemeriksaan/:id',
    async (req, reply) => {
      try {
        await prisma.jenisPemeriksaan.delete({ where: { id: req.params.id } });
        return { ok: true };
      } catch {
        return reply.status(409).send({ error: 'Jenis pemeriksaan masih dipakai pasien' });
      }
    },
  );

  app.patch<{ Params: { id: string }; Body: { nama?: string; jumlahFilm?: number; harga?: number; detailLayanan?: string } }>(
    '/api/jenis-pemeriksaan/:id',
    async (req, reply) => {
      const existing = await prisma.jenisPemeriksaan.findUnique({
        where: { id: req.params.id },
        include: { harga: true },
      });
      if (!existing) return reply.status(404).send({ error: 'Jenis tidak ditemukan' });
      if (!req.body.nama?.trim()) return badRequest(reply, 'nama wajib diisi');

      try {
        const item = await prisma.$transaction(async (tx) => {
          const jenis = await tx.jenisPemeriksaan.update({
            where: { id: req.params.id },
            data: {
              nama: req.body.nama!.trim(),
              ...(req.body.jumlahFilm !== undefined ? { jumlahFilm: req.body.jumlahFilm } : {}),
            },
          });
          if (req.body.harga !== undefined) {
            await tx.hargaLayanan.upsert({
              where: { jenisPemeriksaanId: req.params.id },
              create: {
                jenisPemeriksaanId: req.params.id,
                harga: req.body.harga,
                detailLayanan: req.body.detailLayanan?.trim() || null,
              },
              update: {
                harga: req.body.harga,
                detailLayanan:
                  req.body.detailLayanan !== undefined
                    ? req.body.detailLayanan?.trim() || null
                    : undefined,
              },
            });
          } else if (req.body.detailLayanan !== undefined && existing.harga) {
            await tx.hargaLayanan.update({
              where: { jenisPemeriksaanId: req.params.id },
              data: { detailLayanan: req.body.detailLayanan?.trim() || null },
            });
          }
          const withHarga = await tx.jenisPemeriksaan.findUnique({
            where: { id: jenis.id },
            include: { harga: true },
          });
          return withHarga!;
        });

        return {
          item: {
            id: item.id,
            nama: item.nama,
            jumlahFilm: item.jumlahFilm,
            harga: item.harga ? serializeDecimal(item.harga.harga) : null,
            detailLayanan: item.harga?.detailLayanan ?? null,
          },
        };
      } catch (err: unknown) {
        if (err instanceof PrismaClientKnownRequestError && err.code === 'P2002') {
          return badRequest(reply, `Jenis pemeriksaan "${req.body.nama!.trim()}" sudah ada`);
        }
        throw err;
      }
    },
  );

  app.get<{ Querystring: ListQuery }>(
    '/api/harga-layanan',
    async (req) => {
      const { page, limit, skip } = parsePagination(req.query);
      const where = hargaListWhere(req.query.q);
      const [total, items] = await Promise.all([
        prisma.hargaLayanan.count({ where }),
        prisma.hargaLayanan.findMany({
          where,
          include: { jenisPemeriksaan: true },
          orderBy: { jenisPemeriksaan: { nama: 'asc' } },
          skip,
          take: limit,
        }),
      ]);
      return {
        items: items.map((h) => ({
          id: h.id,
          jenisPemeriksaanId: h.jenisPemeriksaanId,
          jenisNama: h.jenisPemeriksaan.nama,
          harga: serializeDecimal(h.harga),
          detailLayanan: h.detailLayanan,
        })),
        pagination: buildPaginationMeta(total, page, limit),
      };
    },
  );

  app.post<{
    Body: { jenisPemeriksaanId: string; harga: number; detailLayanan?: string };
  }>('/api/harga-layanan', async (req, reply) => {
    const { jenisPemeriksaanId, harga, detailLayanan } = req.body;
    if (!jenisPemeriksaanId || harga === undefined) {
      return badRequest(reply, 'jenisPemeriksaanId dan harga wajib');
    }
    const item = await prisma.hargaLayanan.upsert({
      where: { jenisPemeriksaanId },
      create: {
        jenisPemeriksaanId,
        harga,
        detailLayanan: detailLayanan?.trim() || null,
      },
      update: {
        harga,
        detailLayanan: detailLayanan?.trim() || null,
      },
    });
    return reply.status(201).send({
      item: { ...item, harga: serializeDecimal(item.harga) },
    });
  });

  app.delete<{ Params: { id: string } }>('/api/harga-layanan/:id', async (req) => {
    await prisma.hargaLayanan.delete({ where: { id: req.params.id } });
    return { ok: true };
  });

  app.patch<{ Params: { id: string }; Body: { harga?: number; detailLayanan?: string } }>(
    '/api/harga-layanan/:id',
    async (req, reply) => {
      const existing = await prisma.hargaLayanan.findUnique({ where: { id: req.params.id } });
      if (!existing) return reply.status(404).send({ error: 'Harga tidak ditemukan' });
      const item = await prisma.hargaLayanan.update({
        where: { id: req.params.id },
        data: {
          harga: req.body.harga ?? existing.harga,
          detailLayanan:
            req.body.detailLayanan !== undefined
              ? req.body.detailLayanan?.trim() || null
              : existing.detailLayanan,
        },
      });
      return { item: { ...item, harga: serializeDecimal(item.harga) } };
    },
  );

  app.get<{ Querystring: ListQuery }>(
    '/api/kesan-template',
    async (req) => {
      const { page, limit, skip } = parsePagination(req.query);
      const where = kesanListWhere(req.query.q);
      const [total, items] = await Promise.all([
        prisma.kesanTemplate.count({ where }),
        prisma.kesanTemplate.findMany({ where, orderBy: { judul: 'asc' }, skip, take: limit }),
      ]);
      return { items, pagination: buildPaginationMeta(total, page, limit) };
    },
  );

  app.post<{ Body: { judul: string; isi: string; gambar?: string } }>(
    '/api/kesan-template',
    async (req, reply) => {
      if (!req.body.judul?.trim() || !req.body.isi?.trim()) {
        return badRequest(reply, 'judul dan isi wajib');
      }
      const item = await prisma.kesanTemplate.create({
        data: {
          judul: req.body.judul.trim(),
          isi: req.body.isi.trim(),
          gambar: req.body.gambar || null,
        },
      });
      return reply.status(201).send({ item });
    },
  );

  app.delete<{ Params: { id: string } }>('/api/kesan-template/:id', async (req) => {
    await prisma.kesanTemplate.delete({ where: { id: req.params.id } });
    return { ok: true };
  });

  app.patch<{ Params: { id: string }; Body: { judul?: string; isi?: string; gambar?: string } }>(
    '/api/kesan-template/:id',
    async (req, reply) => {
      const existing = await prisma.kesanTemplate.findUnique({ where: { id: req.params.id } });
      if (!existing) return reply.status(404).send({ error: 'Template tidak ditemukan' });
      const item = await prisma.kesanTemplate.update({
        where: { id: req.params.id },
        data: {
          judul: req.body.judul?.trim() ?? existing.judul,
          isi: req.body.isi?.trim() ?? existing.isi,
          gambar: req.body.gambar !== undefined ? req.body.gambar || null : existing.gambar,
        },
      });
      return { item };
    },
  );

  // ─── Anatomi (galeri gambar referensi per regio) ───────────────────────────

  app.get<{ Querystring: { regio?: string } }>('/api/anatomi-gambar', async (req) => {
    if (!req.query.regio) return { items: [] };
    const items = await prisma.anatomiGambar.findMany({
      where: { regio: req.query.regio },
      orderBy: { createdAt: 'asc' },
      select: {
        id: true,
        regio: true,
        keterangan: true,
        createdAt: true,
        thumbnail: true,
        // Fallback untuk data lama yang diunggah sebelum ada kolom thumbnail.
        gambar: true,
      },
    });
    // Daftar galeri memuat versi kecil (thumbnail) supaya cepat; versi ukuran
    // penuh dipanggil terpisah lewat GET /api/anatomi-gambar/:id saat di-zoom.
    return {
      items: items.map(({ gambar, thumbnail, ...rest }) => ({
        ...rest,
        gambar: thumbnail ?? gambar,
      })),
    };
  });

  app.get<{ Params: { id: string } }>('/api/anatomi-gambar/:id', async (req, reply) => {
    const item = await prisma.anatomiGambar.findUnique({ where: { id: req.params.id } });
    if (!item) return reply.status(404).send({ error: 'Gambar tidak ditemukan' });
    return { item };
  });

  app.post<{ Body: { regio: string; gambar: string; thumbnail?: string; keterangan?: string } }>(
    '/api/anatomi-gambar',
    async (req, reply) => {
      if (!req.body.regio?.trim() || !req.body.gambar?.trim()) {
        return badRequest(reply, 'regio dan gambar wajib');
      }
      const item = await prisma.anatomiGambar.create({
        data: {
          regio: req.body.regio.trim(),
          gambar: req.body.gambar,
          thumbnail: req.body.thumbnail || req.body.gambar,
          keterangan: req.body.keterangan?.trim() || null,
        },
      });
      return reply.status(201).send({ item });
    },
  );

  app.patch<{ Params: { id: string }; Body: { keterangan?: string } }>(
    '/api/anatomi-gambar/:id',
    async (req, reply) => {
      const existing = await prisma.anatomiGambar.findUnique({ where: { id: req.params.id } });
      if (!existing) return reply.status(404).send({ error: 'Gambar tidak ditemukan' });
      const item = await prisma.anatomiGambar.update({
        where: { id: req.params.id },
        data: {
          keterangan: req.body.keterangan !== undefined ? req.body.keterangan.trim() || null : existing.keterangan,
        },
      });
      return { item };
    },
  );

  app.delete<{ Params: { id: string } }>('/api/anatomi-gambar/:id', async (req) => {
    await prisma.anatomiGambar.delete({ where: { id: req.params.id } });
    return { ok: true };
  });

  // ─── Kesan Bacaan (grup > kategori > bacaan, menu cepat isi Kesan) ─────────

  app.get('/api/kesan-bacaan-grup', async () => {
    const items = await prisma.kesanBacaanGrup.findMany({
      orderBy: { createdAt: 'asc' },
      include: {
        kategori: {
          orderBy: [{ urutan: 'asc' }, { createdAt: 'asc' }],
          include: { bacaan: { orderBy: { createdAt: 'asc' } } },
        },
      },
    });
    return { items };
  });

  app.post<{ Body: { nama: string } }>('/api/kesan-bacaan-grup', async (req, reply) => {
    if (!req.body.nama?.trim()) return badRequest(reply, 'nama grup wajib');
    const item = await prisma.kesanBacaanGrup.create({ data: { nama: req.body.nama.trim() } });
    return reply.status(201).send({ item });
  });

  app.patch<{ Params: { id: string }; Body: { nama?: string } }>(
    '/api/kesan-bacaan-grup/:id',
    async (req, reply) => {
      const existing = await prisma.kesanBacaanGrup.findUnique({ where: { id: req.params.id } });
      if (!existing) return reply.status(404).send({ error: 'Grup tidak ditemukan' });
      const item = await prisma.kesanBacaanGrup.update({
        where: { id: req.params.id },
        data: { nama: req.body.nama?.trim() || existing.nama },
      });
      return { item };
    },
  );

  app.delete<{ Params: { id: string } }>('/api/kesan-bacaan-grup/:id', async (req) => {
    await prisma.kesanBacaanGrup.delete({ where: { id: req.params.id } });
    return { ok: true };
  });

  app.post<{ Body: { grupId: string; nama: string; urutan?: number } }>(
    '/api/kesan-bacaan-kategori',
    async (req, reply) => {
      if (!req.body.grupId || !req.body.nama?.trim()) {
        return badRequest(reply, 'grupId dan nama kategori wajib');
      }
      const grup = await prisma.kesanBacaanGrup.findUnique({ where: { id: req.body.grupId } });
      if (!grup) return badRequest(reply, 'Grup tidak valid');
      const item = await prisma.kesanBacaanKategori.create({
        data: {
          grupId: req.body.grupId,
          nama: req.body.nama.trim(),
          urutan: req.body.urutan ?? 0,
        },
      });
      return reply.status(201).send({ item });
    },
  );

  app.patch<{ Params: { id: string }; Body: { nama?: string } }>(
    '/api/kesan-bacaan-kategori/:id',
    async (req, reply) => {
      const existing = await prisma.kesanBacaanKategori.findUnique({ where: { id: req.params.id } });
      if (!existing) return reply.status(404).send({ error: 'Kategori tidak ditemukan' });
      const item = await prisma.kesanBacaanKategori.update({
        where: { id: req.params.id },
        data: { nama: req.body.nama?.trim() || existing.nama },
      });
      return { item };
    },
  );

  app.delete<{ Params: { id: string } }>('/api/kesan-bacaan-kategori/:id', async (req) => {
    await prisma.kesanBacaanKategori.delete({ where: { id: req.params.id } });
    return { ok: true };
  });

  app.post<{ Body: { kategoriId: string; teks: string } }>(
    '/api/kesan-bacaan',
    async (req, reply) => {
      if (!req.body.kategoriId || !req.body.teks?.trim()) {
        return badRequest(reply, 'kategoriId dan teks wajib');
      }
      const kategori = await prisma.kesanBacaanKategori.findUnique({
        where: { id: req.body.kategoriId },
      });
      if (!kategori) return badRequest(reply, 'Kategori tidak valid');
      const item = await prisma.kesanBacaan.create({
        data: { kategoriId: req.body.kategoriId, teks: req.body.teks.trim() },
      });
      return reply.status(201).send({ item });
    },
  );

  app.patch<{ Params: { id: string }; Body: { teks?: string } }>(
    '/api/kesan-bacaan/:id',
    async (req, reply) => {
      const existing = await prisma.kesanBacaan.findUnique({ where: { id: req.params.id } });
      if (!existing) return reply.status(404).send({ error: 'Bacaan tidak ditemukan' });
      const item = await prisma.kesanBacaan.update({
        where: { id: req.params.id },
        data: { teks: req.body.teks?.trim() || existing.teks },
      });
      return { item };
    },
  );

  app.delete<{ Params: { id: string } }>('/api/kesan-bacaan/:id', async (req) => {
    await prisma.kesanBacaan.delete({ where: { id: req.params.id } });
    return { ok: true };
  });

  // ─── Playlist Lagu (Musik-PH) ───────────────────────────────────────────────

  app.get('/api/playlist-lagu', async () => {
    const items = await prisma.playlistLagu.findMany({
      orderBy: { createdAt: 'asc' },
      select: { id: true, judul: true, lirik: true, createdAt: true },
    });
    return { items };
  });

  app.get<{ Params: { id: string } }>('/api/playlist-lagu/:id/audio', async (req, reply) => {
    const item = await prisma.playlistLagu.findUnique({
      where: { id: req.params.id },
      select: { audioData: true },
    });
    if (!item) return reply.status(404).send({ error: 'Lagu tidak ditemukan' });
    const match = item.audioData.match(/^data:([^;]+);base64,(.+)$/s);
    if (!match) return reply.status(500).send({ error: 'Format audio tidak valid' });
    const [, mime, base64] = match;
    const buffer = Buffer.from(base64!, 'base64');
    reply.header('Content-Type', mime);
    reply.header('Content-Length', String(buffer.length));
    reply.header('Cache-Control', 'private, max-age=3600');
    return reply.send(buffer);
  });

  app.post<{ Body: { judul: string; audioData: string; lirik?: string } }>(
    '/api/playlist-lagu',
    async (req, reply) => {
      if (!req.body.judul?.trim() || !req.body.audioData?.trim()) {
        return badRequest(reply, 'judul dan audioData wajib');
      }
      const item = await prisma.playlistLagu.create({
        data: {
          judul: req.body.judul.trim(),
          audioData: req.body.audioData,
          lirik: req.body.lirik?.trim() || null,
        },
      });
      return reply.status(201).send({ item });
    },
  );

  app.patch<{ Params: { id: string }; Body: { judul?: string; lirik?: string } }>(
    '/api/playlist-lagu/:id',
    async (req, reply) => {
      const existing = await prisma.playlistLagu.findUnique({ where: { id: req.params.id } });
      if (!existing) return reply.status(404).send({ error: 'Lagu tidak ditemukan' });
      const item = await prisma.playlistLagu.update({
        where: { id: req.params.id },
        data: {
          judul: req.body.judul?.trim() || existing.judul,
          lirik: req.body.lirik !== undefined ? req.body.lirik.trim() || null : existing.lirik,
        },
      });
      return { item };
    },
  );

  app.delete<{ Params: { id: string } }>('/api/playlist-lagu/:id', async (req) => {
    await prisma.playlistLagu.delete({ where: { id: req.params.id } });
    return { ok: true };
  });

  // ─── Paket Laboratorium ─────────────────────────────────────────────────────

  app.get('/api/paket-lab', async () => {
    const items = await prisma.paketLab.findMany({
      orderBy: { urutan: 'asc' },
      include: { items: { orderBy: { urutan: 'asc' } } },
    });
    return {
      items: items.map((p) => ({
        ...p,
        harga: serializeDecimal(p.harga),
        items: p.items.map((it) => ({
          ...it,
          harga: serializeDecimal(it.harga),
        })),
      })),
    };
  });

  app.post('/api/paket-lab/init-defaults', async () => {
    const defaultSeed = [
      {
        nama: 'Hematologi',
        urutan: 1,
        harga: 150000,
        items: [
          { pemeriksaan: 'Hemoglobin (Hb)', nilaiRujukan: '12 - 16 g/dL', satuan: 'g/dL', harga: 30000, urutan: 1 },
          { pemeriksaan: 'Leukosit (WBC)', nilaiRujukan: '4.000 - 10.000 /µL', satuan: '/µL', harga: 25000, urutan: 2 },
          { pemeriksaan: 'Trombosit (PLT)', nilaiRujukan: '150.000 - 400.000 /µL', satuan: '/µL', harga: 30000, urutan: 3 },
          { pemeriksaan: 'Erytrosit (RBC)', nilaiRujukan: '4,0 - 5,5 juta/µL', satuan: 'juta/µL', harga: 25000, urutan: 4 },
          { pemeriksaan: 'Hematokrit (Ht)', nilaiRujukan: '37 - 48 %', satuan: '%', harga: 25000, urutan: 5 },
          { pemeriksaan: 'MCV', nilaiRujukan: '80 - 100 fL', satuan: 'fL', harga: 20000, urutan: 6 },
          { pemeriksaan: 'MCH', nilaiRujukan: '27 - 34 pg', satuan: 'pg', harga: 20000, urutan: 7 },
          { pemeriksaan: 'MCHC', nilaiRujukan: '32 - 36 g/dL', satuan: 'g/dL', harga: 20000, urutan: 8 },
        ],
      },
      {
        nama: 'Kimia darah',
        urutan: 2,
        harga: 250000,
        items: [
          { pemeriksaan: 'SGOT (AST)', nilaiRujukan: '< 35 U/L', satuan: 'U/L', harga: 35000, urutan: 1 },
          { pemeriksaan: 'SGPT (ALT)', nilaiRujukan: '< 40 U/L', satuan: 'U/L', harga: 35000, urutan: 2 },
          { pemeriksaan: 'Ureum', nilaiRujukan: '15 - 45 mg/dL', satuan: 'mg/dL', harga: 35000, urutan: 3 },
          { pemeriksaan: 'Kreatinin', nilaiRujukan: '0,6 - 1,2 mg/dL', satuan: 'mg/dL', harga: 40000, urutan: 4 },
          { pemeriksaan: 'Asam Urat', nilaiRujukan: '2,4 - 7,0 mg/dL', satuan: 'mg/dL', harga: 35000, urutan: 5 },
          { pemeriksaan: 'Kolesterol Total', nilaiRujukan: '< 200 mg/dL', satuan: 'mg/dL', harga: 35000, urutan: 6 },
          { pemeriksaan: 'Trigliserida', nilaiRujukan: '< 150 mg/dL', satuan: 'mg/dL', harga: 35000, urutan: 7 },
          { pemeriksaan: 'HDL Kolesterol', nilaiRujukan: '> 40 mg/dL', satuan: 'mg/dL', harga: 40000, urutan: 8 },
          { pemeriksaan: 'LDL Kolesterol', nilaiRujukan: '< 100 mg/dL', satuan: 'mg/dL', harga: 40000, urutan: 9 },
          { pemeriksaan: 'Bilirubin Total', nilaiRujukan: '0,2 - 1,2 mg/dL', satuan: 'mg/dL', harga: 35000, urutan: 10 },
        ],
      },
      {
        nama: 'Diabetes',
        urutan: 3,
        harga: 120000,
        items: [
          { pemeriksaan: 'Gula Darah Sewaktu (GDS)', nilaiRujukan: '< 200 mg/dL', satuan: 'mg/dL', harga: 25000, urutan: 1 },
          { pemeriksaan: 'Gula Darah Puasa (GDP)', nilaiRujukan: '70 - 110 mg/dL', satuan: 'mg/dL', harga: 25000, urutan: 2 },
          { pemeriksaan: 'Gula Darah 2 Jam PP', nilaiRujukan: '< 140 mg/dL', satuan: 'mg/dL', harga: 25000, urutan: 3 },
          { pemeriksaan: 'HbA1c', nilaiRujukan: '< 5,7 %', satuan: '%', harga: 80000, urutan: 4 },
        ],
      },
      {
        nama: 'Urinalisa',
        urutan: 4,
        harga: 75000,
        items: [
          { pemeriksaan: 'Warna Urine', nilaiRujukan: 'Kuning Muda', satuan: '-', harga: 10000, urutan: 1 },
          { pemeriksaan: 'Kejernihan Urine', nilaiRujukan: 'Jernih', satuan: '-', harga: 10000, urutan: 2 },
          { pemeriksaan: 'pH Urine', nilaiRujukan: '4,6 - 8,0', satuan: '-', harga: 10000, urutan: 3 },
          { pemeriksaan: 'Berat Jenis (BJ)', nilaiRujukan: '1,010 - 1,025', satuan: '-', harga: 10000, urutan: 4 },
          { pemeriksaan: 'Protein / Albumin Urine', nilaiRujukan: 'Negatif', satuan: '-', harga: 15000, urutan: 5 },
          { pemeriksaan: 'Glukosa Urine', nilaiRujukan: 'Negatif', satuan: '-', harga: 15000, urutan: 6 },
          { pemeriksaan: 'Bilirubin Urine', nilaiRujukan: 'Negatif', satuan: '-', harga: 15000, urutan: 7 },
          { pemeriksaan: 'Urobilinogen Urine', nilaiRujukan: 'Normal', satuan: '-', harga: 15000, urutan: 8 },
          { pemeriksaan: 'Keton Urine', nilaiRujukan: 'Negatif', satuan: '-', harga: 15000, urutan: 9 },
          { pemeriksaan: 'Nitrit Urine', nilaiRujukan: 'Negatif', satuan: '-', harga: 15000, urutan: 10 },
        ],
      },
      {
        nama: 'Urin rutin',
        urutan: 5,
        harga: 65000,
        items: [
          { pemeriksaan: 'Makroskopis Urine (Warna/BJ/pH)', nilaiRujukan: 'Normal / Jernih', satuan: '-', harga: 25000, urutan: 1 },
          { pemeriksaan: 'Sedimen Eritrosit', nilaiRujukan: '0 - 2 /LPB', satuan: '/LPB', harga: 15000, urutan: 2 },
          { pemeriksaan: 'Sedimen Leukosit', nilaiRujukan: '0 - 5 /LPB', satuan: '/LPB', harga: 15000, urutan: 3 },
          { pemeriksaan: 'Sedimen Sel Epitel', nilaiRujukan: '1 - 5 /LPK', satuan: '/LPK', harga: 10000, urutan: 4 },
          { pemeriksaan: 'Sedimen Silinder & Kristal', nilaiRujukan: 'Negatif', satuan: '-', harga: 10000, urutan: 5 },
        ],
      },
      {
        nama: 'Imunologi',
        urutan: 6,
        harga: 200000,
        items: [
          { pemeriksaan: 'HBsAg', nilaiRujukan: 'Non-Reaktif', satuan: '-', harga: 60000, urutan: 1 },
          { pemeriksaan: 'Anti-HBs', nilaiRujukan: '> 10 mIU/mL', satuan: 'mIU/mL', harga: 70000, urutan: 2 },
          { pemeriksaan: 'Dengue IgG / IgM', nilaiRujukan: 'Negatif', satuan: '-', harga: 120000, urutan: 3 },
          { pemeriksaan: 'Anti-HIV', nilaiRujukan: 'Non-Reaktif', satuan: '-', harga: 90000, urutan: 4 },
          { pemeriksaan: 'TPHA / VDRL', nilaiRujukan: 'Non-Reaktif', satuan: '-', harga: 70000, urutan: 5 },
        ],
      },
      {
        nama: 'Diffcount',
        urutan: 7,
        harga: 50000,
        items: [
          { pemeriksaan: 'Eosinofil', nilaiRujukan: '1 - 3 %', satuan: '%', harga: 10000, urutan: 1 },
          { pemeriksaan: 'Basofil', nilaiRujukan: '0 - 1 %', satuan: '%', harga: 10000, urutan: 2 },
          { pemeriksaan: 'Staff', nilaiRujukan: '2 - 6 %', satuan: '%', harga: 10000, urutan: 3 },
          { pemeriksaan: 'Netrofil Segmen', nilaiRujukan: '50 - 70 %', satuan: '%', harga: 10000, urutan: 4 },
          { pemeriksaan: 'Limposit', nilaiRujukan: '20 - 40 %', satuan: '%', harga: 10000, urutan: 5 },
          { pemeriksaan: 'Monosit', nilaiRujukan: '2 - 8 %', satuan: '%', harga: 10000, urutan: 6 },
        ],
      },
      {
        nama: 'Laju Endap Darah',
        urutan: 8,
        harga: 30000,
        items: [
          { pemeriksaan: 'LED', nilaiRujukan: '< 20 mm/jam', satuan: 'mm/jam', harga: 30000, urutan: 1 },
        ],
      },
      {
        nama: 'Widal',
        urutan: 9,
        harga: 50000,
        items: [
          { pemeriksaan: 'Widal S. Typhi O & H', nilaiRujukan: '< 1/80', satuan: 'Titer', harga: 50000, urutan: 1 },
        ],
      },
    ];

    for (const pkg of defaultSeed) {
      let existing = await prisma.paketLab.findUnique({ where: { nama: pkg.nama } });
      if (!existing) {
        existing = await prisma.paketLab.create({
          data: {
            nama: pkg.nama,
            urutan: pkg.urutan,
            harga: new Decimal(pkg.harga),
          },
        });
      }
      const itemCount = await prisma.paketLabItem.count({ where: { paketId: existing.id } });
      if (itemCount === 0) {
        await prisma.paketLabItem.createMany({
          data: pkg.items.map((it) => ({
            paketId: existing.id,
            pemeriksaan: it.pemeriksaan,
            nilaiRujukan: it.nilaiRujukan,
            satuan: it.satuan,
            harga: new Decimal(it.harga),
            urutan: it.urutan,
          })),
        });
      }
    }
    return { ok: true };
  });

  app.post<{
    Body: { nama: string; urutan?: number; harga?: string | number };
  }>('/api/paket-lab', async (req, reply) => {
    if (!req.body.nama?.trim()) return badRequest(reply, 'nama wajib diisi');
    const existing = await prisma.paketLab.findUnique({ where: { nama: req.body.nama.trim() } });
    if (existing) return badRequest(reply, 'Nama paket sudah ada');
    const item = await prisma.paketLab.create({
      data: {
        nama: req.body.nama.trim(),
        urutan: req.body.urutan ?? 0,
        harga: req.body.harga ? new Decimal(req.body.harga) : new Decimal(0),
      },
      include: { items: true },
    });
    return reply.status(201).send({
      item: {
        ...item,
        harga: serializeDecimal(item.harga),
        items: item.items.map((it) => ({ ...it, harga: serializeDecimal(it.harga) })),
      },
    });
  });

  app.patch<{
    Params: { id: string };
    Body: { nama?: string; urutan?: number; harga?: string | number };
  }>('/api/paket-lab/:id', async (req, reply) => {
    const existing = await prisma.paketLab.findUnique({ where: { id: req.params.id } });
    if (!existing) return reply.status(404).send({ error: 'Paket tidak ditemukan' });
    const item = await prisma.paketLab.update({
      where: { id: req.params.id },
      data: {
        nama: req.body.nama?.trim() ?? existing.nama,
        urutan: req.body.urutan ?? existing.urutan,
        harga: req.body.harga !== undefined ? new Decimal(req.body.harga) : existing.harga,
      },
      include: { items: { orderBy: { urutan: 'asc' } } },
    });
    return {
      item: {
        ...item,
        harga: serializeDecimal(item.harga),
        items: item.items.map((it) => ({ ...it, harga: serializeDecimal(it.harga) })),
      },
    };
  });

  app.delete<{ Params: { id: string } }>('/api/paket-lab/:id', async (req, reply) => {
    try {
      await prisma.paketLab.delete({ where: { id: req.params.id } });
      return { ok: true };
    } catch {
      return reply.status(404).send({ error: 'Paket tidak ditemukan' });
    }
  });

  // Replace all items in a paket (PUT or PATCH = full replace)
  const replaceItemsHandler = async (
    req: FastifyRequest<{
      Params: { id: string };
      Body: {
        items: {
          grup?: string;
          pemeriksaan: string;
          nilaiRujukan?: string;
          satuan?: string;
          harga?: string | number;
          urutan?: number;
        }[];
      };
    }>,
    reply: FastifyReply,
  ) => {
    const existing = await prisma.paketLab.findUnique({ where: { id: req.params.id } });
    if (!existing) return reply.status(404).send({ error: 'Paket tidak ditemukan' });
    if (!Array.isArray(req.body.items)) return badRequest(reply, 'items harus berupa array');

    await prisma.$transaction(async (tx) => {
      await tx.paketLabItem.deleteMany({ where: { paketId: req.params.id } });
      if (req.body.items.length > 0) {
        await tx.paketLabItem.createMany({
          data: req.body.items.map((it, i) => ({
            paketId: req.params.id,
            grup: it.grup?.trim() || null,
            pemeriksaan: it.pemeriksaan.trim(),
            nilaiRujukan: it.nilaiRujukan?.trim() ?? '',
            satuan: it.satuan?.trim() ?? '',
            harga: it.harga ? new Decimal(it.harga) : new Decimal(0),
            urutan: it.urutan ?? i,
          })),
        });
      }
    });

    const item = await prisma.paketLab.findUnique({
      where: { id: req.params.id },
      include: { items: { orderBy: { urutan: 'asc' } } },
    });
    return {
      item: item
        ? {
            ...item,
            harga: serializeDecimal(item.harga),
            items: item.items.map((it) => ({ ...it, harga: serializeDecimal(it.harga) })),
          }
        : null,
    };
  };

  app.put('/api/paket-lab/:id/items', replaceItemsHandler);
  app.patch('/api/paket-lab/:id/items', replaceItemsHandler);

  // ────────────────────────────────────────────────────────────────────────────

  app.get<{ Querystring: StaffListQuery }>('/api/staff', async (req) => {

    const { page, limit, skip } = parsePagination(req.query);
    const where = staffListWhere(req.query.q, req.query.role);
    const [total, items] = await Promise.all([
      prisma.staff.count({ where }),
      prisma.staff.findMany({
        where,
        orderBy: { nama: 'asc' },
        skip,
        take: limit,
        select: staffPublicSelect,
      }),
    ]);
    return { items, pagination: buildPaginationMeta(total, page, limit) };
  });

  app.post<{ Body: { nama: string; email: string; password: string; role: StaffRoleInput } }>(
    '/api/staff',
    async (req, reply) => {
      const { nama, email, password, role } = req.body;
      if (!nama?.trim() || !email?.trim() || !role || !password?.trim()) {
        return badRequest(reply, 'nama, email, password, role wajib');
      }
      if (password.length < 6) {
        return badRequest(reply, 'password minimal 6 karakter');
      }
      const item = await prisma.staff.create({
        data: {
          nama: nama.trim(),
          email: email.trim().toLowerCase(),
          passwordHash: await hashPassword(password),
          role,
        },
        select: staffPublicSelect,
      });
      return reply.status(201).send({ item });
    },
  );

  app.delete<{ Params: { id: string } }>('/api/staff/:id', async (req) => {
    await prisma.staff.delete({ where: { id: req.params.id } });
    return { ok: true };
  });

  app.patch<{
    Params: { id: string };
    Body: { nama?: string; email?: string; password?: string; role?: StaffRoleInput };
  }>('/api/staff/:id', async (req, reply) => {
    const existing = await prisma.staff.findUnique({ where: { id: req.params.id } });
    if (!existing) return reply.status(404).send({ error: 'Staff tidak ditemukan' });
    if (req.body.password !== undefined && req.body.password.length > 0 && req.body.password.length < 6) {
      return badRequest(reply, 'password minimal 6 karakter');
    }
    const item = await prisma.staff.update({
      where: { id: req.params.id },
      data: {
        nama: req.body.nama?.trim() ?? existing.nama,
        email: req.body.email?.trim().toLowerCase() ?? existing.email,
        ...(req.body.password?.trim()
          ? { passwordHash: await hashPassword(req.body.password) }
          : {}),
        role: req.body.role ?? existing.role,
      },
      select: staffPublicSelect,
    });
    return { item };
  });

  // ─── Pendaftaran Umum ─────────────────────────────────────────────────────

  app.get<{ Querystring: PendaftaranUmumListQuery }>('/api/pendaftaran-umum', async (req) => {
    const { page, limit, skip } = parsePagination(req.query);
    const where = pendaftaranUmumListWhere(req.query);
    const [total, items] = await Promise.all([
      prisma.pendaftaranUmum.count({ where }),
      prisma.pendaftaranUmum.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
    ]);
    return { items, pagination: buildPaginationMeta(total, page, limit) };
  });

  app.post<{
    Body: {
      noRegistrasi?: string;
      namaPasien: string;
      umur?: string;
      alamat?: string;
      telpon?: string;
      tanggalMasuk: string;
      dokterPengirim?: string;
      klinis?: string;
      admin?: string;
    };
  }>('/api/pendaftaran-umum', async (req, reply) => {
    if (!req.body.namaPasien?.trim() || !req.body.tanggalMasuk) {
      return badRequest(reply, 'namaPasien dan tanggalMasuk wajib diisi');
    }
    const noRegistrasi = req.body.noRegistrasi?.trim() || await nextPendaftaranUmumCode(prisma);
    const item = await prisma.pendaftaranUmum.create({
      data: {
        noRegistrasi,
        namaPasien: req.body.namaPasien.trim(),
        umur: req.body.umur?.trim() || null,
        alamat: req.body.alamat?.trim() || null,
        telpon: req.body.telpon?.trim() || null,
        tanggalMasuk: new Date(req.body.tanggalMasuk),
        dokterPengirim: req.body.dokterPengirim?.trim() || null,
        klinis: req.body.klinis?.trim() || null,
        admin: req.body.admin?.trim() || null,
      },
    });
    return reply.status(201).send({ item });
  });

  app.patch<{
    Params: { id: string };
    Body: {
      noRegistrasi?: string;
      namaPasien?: string;
      umur?: string;
      alamat?: string;
      telpon?: string;
      tanggalMasuk?: string;
      dokterPengirim?: string;
      klinis?: string;
      admin?: string;
    };
  }>('/api/pendaftaran-umum/:id', async (req, reply) => {
    const existing = await prisma.pendaftaranUmum.findUnique({ where: { id: req.params.id } });
    if (!existing) return reply.status(404).send({ error: 'Pendaftaran tidak ditemukan' });

    const item = await prisma.pendaftaranUmum.update({
      where: { id: req.params.id },
      data: {
        noRegistrasi: req.body.noRegistrasi?.trim() ?? existing.noRegistrasi,
        namaPasien: req.body.namaPasien?.trim() ?? existing.namaPasien,
        umur: req.body.umur !== undefined ? req.body.umur?.trim() || null : existing.umur,
        alamat: req.body.alamat !== undefined ? req.body.alamat?.trim() || null : existing.alamat,
        telpon: req.body.telpon !== undefined ? req.body.telpon?.trim() || null : existing.telpon,
        tanggalMasuk: req.body.tanggalMasuk ? new Date(req.body.tanggalMasuk) : existing.tanggalMasuk,
        dokterPengirim: req.body.dokterPengirim !== undefined ? req.body.dokterPengirim?.trim() || null : existing.dokterPengirim,
        klinis: req.body.klinis !== undefined ? req.body.klinis?.trim() || null : existing.klinis,
        admin: req.body.admin !== undefined ? req.body.admin?.trim() || null : existing.admin,
      },
    });
    return { item };
  });

  app.delete<{ Params: { id: string } }>('/api/pendaftaran-umum/:id', async (req) => {
    await prisma.pendaftaranUmum.delete({ where: { id: req.params.id } });
    return { ok: true };
  });

  app.get<{ Querystring: PasienListQuery }>('/api/pasien/summary', async (req) => {
    const where = pasienListWhere(req.query);
    const [totalPasien, menungguHasil, selesai, agg, groups, dokters] = await Promise.all([
      prisma.pasien.count({ where }),
      prisma.pasien.count({ where: { ...where, hasilStatus: 'MENUNGGU_HASIL' } }),
      prisma.pasien.count({ where: { ...where, hasilStatus: 'SELESAI' } }),
      prisma.pasien.aggregate({
        where,
        _sum: { totalHarga: true, totalSharing: true },
      }),
      prisma.pasien.groupBy({
        by: ['pengirimId'],
        where,
        _count: { _all: true },
        _sum: { totalHarga: true, totalSharing: true },
      }),
      prisma.dokter.findMany({ select: { id: true, nama: true } }),
    ]);

    const dokterMap = new Map(dokters.map((d) => [d.id, d.nama]));
    const byDokter = groups
      .map((g) => ({
        id: g.pengirimId,
        nama: dokterMap.get(g.pengirimId) ?? 'Dokter Tidak Dikenal',
        jumlahPasien: g._count._all,
        totalOmset: serializeDecimal(g._sum.totalHarga ?? new Decimal(0)),
        totalSharing: serializeDecimal(g._sum.totalSharing ?? new Decimal(0)),
      }))
      .sort((a, b) => b.jumlahPasien - a.jumlahPasien);

    return {
      totalPasien,
      menungguHasil,
      selesai,
      totalOmzet: serializeDecimal(agg._sum.totalHarga ?? new Decimal(0)),
      totalSharing: serializeDecimal(agg._sum.totalSharing ?? new Decimal(0)),
      byDokter,
    };
  });

  app.get<{ Querystring: PasienListQuery }>('/api/pasien', async (req) => {
    const { page, limit, skip } = parsePagination(req.query);
    const where = pasienListWhere(req.query);
    const [total, items] = await Promise.all([
      prisma.pasien.count({ where }),
      prisma.pasien.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        include: pasienInclude,
        skip,
        take: limit,
      }),
    ]);
    return {
      items: items.map(mapPasien),
      pagination: buildPaginationMeta(total, page, limit),
    };
  });

  app.get<{ Params: { id: string } }>('/api/pasien/:id', async (req, reply) => {
    const item = await prisma.pasien.findUnique({
      where: { id: req.params.id },
      include: {
        pengirim: true,
        radiolog: true,
        pemeriksaan: { include: { jenisPemeriksaan: true } },
        paketLab: { include: { paketLab: true } },
      },
    });
    if (!item) return reply.status(404).send({ error: 'Pasien tidak ditemukan' });
    return { item: mapPasien(item) };
  });

  app.post<{
    Body: {
      nama: string;
      tanggalLahir: string;
      noTelepon?: string;
      alamat?: string;
      pengirimId: string;
      klinis?: string;
      jenisPemeriksaanIds: string[];
      sharingAmount?: number;
      radiologId?: string;
      admin?: string;
      petugasKasir?: string;
      asalModul?: 'RADIOLOGI' | 'LABORATORIUM';
    };
  }>('/api/pasien', async (req, reply) => {
    const body = req.body;
    if (!body.nama?.trim() || !body.tanggalLahir || !body.pengirimId) {
      return badRequest(reply, 'nama, tanggalLahir, pengirimId wajib');
    }

    const dokter = await prisma.dokter.findUnique({ where: { id: body.pengirimId } });
    if (!dokter) return badRequest(reply, 'Dokter pengirim tidak valid');

    // Registrasi Laboratorium memilih Paket Lab (model PaketLab), bukan Jenis
    // Pemeriksaan Radiologi (model JenisPemeriksaan) — keduanya punya id yang
    // tidak saling terkait, jadi harga & validasinya harus dicari dari tabel
    // yang sesuai modul asalnya.
    const isLab = body.asalModul === 'LABORATORIUM';

    let totalHarga: Decimal;
    let pemeriksaanData: { jenisPemeriksaanId: string; hargaSnapshot: Decimal }[] = [];
    let paketLabData: { paketLabId: string; hargaSnapshot: Decimal }[] = [];

    if (isLab) {
      const paketRows = body.jenisPemeriksaanIds?.length
        ? await prisma.paketLab.findMany({ where: { id: { in: body.jenisPemeriksaanIds } } })
        : [];
      if (body.jenisPemeriksaanIds?.length && paketRows.length !== body.jenisPemeriksaanIds.length) {
        return badRequest(reply, 'Beberapa paket pemeriksaan lab tidak ditemukan');
      }
      paketLabData = paketRows.map((p) => ({ paketLabId: p.id, hargaSnapshot: p.harga }));
      totalHarga = paketRows.reduce((sum, p) => sum.add(p.harga), new Decimal(0));
    } else {
      const hargaRows = body.jenisPemeriksaanIds?.length ? await prisma.hargaLayanan.findMany({
        where: { jenisPemeriksaanId: { in: body.jenisPemeriksaanIds } },
      }) : [];

      if (body.jenisPemeriksaanIds?.length && hargaRows.length !== body.jenisPemeriksaanIds.length) {
        return badRequest(reply, 'Beberapa jenis pemeriksaan belum punya harga');
      }

      pemeriksaanData = hargaRows.map((h) => ({
        jenisPemeriksaanId: h.jenisPemeriksaanId,
        hargaSnapshot: h.harga,
      }));
      totalHarga = sumHarga(pemeriksaanData);
    }

    const sharingAmount = new Decimal(body.sharingAmount ?? dokter.defaultSharingAmount);
    const totalSharing = calcTotalSharing(totalHarga, 'FIXED', new Decimal(0), sharingAmount);

    const regCode = await nextRegCode(prisma);
    const item = await prisma.pasien.create({
      data: {
        regCode,
        nama: body.nama.trim(),
        tanggalLahir: new Date(body.tanggalLahir),
        noTelepon: body.noTelepon?.trim() || null,
        alamat: body.alamat?.trim() || null,
        pengirimId: body.pengirimId,
        asalModul: body.asalModul === 'LABORATORIUM' ? 'LABORATORIUM' : 'RADIOLOGI',
        klinis: body.klinis?.trim() || null,
        sharingType: 'FIXED',
        sharingPercent: new Decimal(0),
        totalHarga,
        totalSharing,
        radiologId: body.radiologId || null,
        admin: body.admin?.trim() || null,
        petugasKasir: body.petugasKasir?.trim() || null,
        pemeriksaan: { create: pemeriksaanData },
        paketLab: { create: paketLabData },
      },
      include: {
        pengirim: true,
        radiolog: true,
        pemeriksaan: { include: { jenisPemeriksaan: true } },
        paketLab: { include: { paketLab: true } },
      },
    });

    await syncPasienDuplikat(prisma, item.id);
    return reply.status(201).send({ item: mapPasien(item) });
  });

  app.patch<{
    Params: { id: string };
    Body: {
      nama?: string;
      tanggalLahir?: string;
      noTelepon?: string;
      alamat?: string;
      pengirimId?: string;
      klinis?: string;
      hasilStatus?: 'MENUNGGU_HASIL' | 'SELESAI';
      paymentStatus?: 'BELUM_LUNAS' | 'LUNAS';
      radiologId?: string | null;
      sharingAmount?: number;
      jenisPemeriksaanIds?: string[];
      admin?: string;
      petugasKasir?: string;
      kesan?: string;
      sharingLocked?: boolean;
    };
  }>('/api/pasien/:id', async (req, reply) => {
    const existing = await prisma.pasien.findUnique({
      where: { id: req.params.id },
      include: { pemeriksaan: true },
    });
    if (!existing) return reply.status(404).send({ error: 'Pasien tidak ditemukan' });

    const hasilStatus = req.body.hasilStatus ?? existing.hasilStatus;
    const pengirimId = req.body.pengirimId ?? existing.pengirimId;

    const dokter = await prisma.dokter.findUnique({ where: { id: pengirimId } });
    if (!dokter) return badRequest(reply, 'Dokter pengirim tidak valid');

    let sharingAmount =
      existing.sharingAmount ?? existing.totalSharing;
    if (req.body.sharingAmount !== undefined) {
      sharingAmount = new Decimal(req.body.sharingAmount);
    } else if (req.body.pengirimId && req.body.pengirimId !== existing.pengirimId) {
      sharingAmount = dokter.defaultSharingAmount;
    }

    let totalHarga = existing.totalHarga;
    let newPemeriksaanRows: { jenisPemeriksaanId: string; hargaSnapshot: Decimal }[] | undefined;
    let newPaketLabRows: { paketLabId: string; hargaSnapshot: Decimal }[] | undefined;
    const isLab = existing.asalModul === 'LABORATORIUM';

    if (req.body.jenisPemeriksaanIds !== undefined) {
      if (!req.body.jenisPemeriksaanIds.length) {
        return badRequest(reply, isLab ? 'Pilih minimal satu paket pemeriksaan lab' : 'Pilih minimal satu jenis pemeriksaan');
      }
      if (isLab) {
        const paketRows = await prisma.paketLab.findMany({
          where: { id: { in: req.body.jenisPemeriksaanIds } },
        });
        if (paketRows.length !== req.body.jenisPemeriksaanIds.length) {
          return badRequest(reply, 'Beberapa paket pemeriksaan lab tidak ditemukan');
        }
        newPaketLabRows = paketRows.map((p) => ({ paketLabId: p.id, hargaSnapshot: p.harga }));
        totalHarga = newPaketLabRows.reduce((sum, r) => sum.add(r.hargaSnapshot), new Decimal(0));
      } else {
        const hargaRows = await prisma.hargaLayanan.findMany({
          where: { jenisPemeriksaanId: { in: req.body.jenisPemeriksaanIds } },
        });
        if (hargaRows.length !== req.body.jenisPemeriksaanIds.length) {
          return badRequest(reply, 'Beberapa jenis pemeriksaan belum punya harga');
        }
        newPemeriksaanRows = hargaRows.map((h) => ({
          jenisPemeriksaanId: h.jenisPemeriksaanId,
          hargaSnapshot: h.harga,
        }));
        totalHarga = sumHarga(newPemeriksaanRows);
      }
    }

    const totalSharing = calcTotalSharing(totalHarga, 'FIXED', new Decimal(0), sharingAmount);
    const sharingLocked = hasilStatus === 'SELESAI';

    const item = await prisma.$transaction(async (tx) => {
      if (newPemeriksaanRows) {
        await tx.pasienPemeriksaan.deleteMany({ where: { pasienId: existing.id } });
        await tx.pasienPemeriksaan.createMany({
          data: newPemeriksaanRows.map((row) => ({
            pasienId: existing.id,
            jenisPemeriksaanId: row.jenisPemeriksaanId,
            hargaSnapshot: row.hargaSnapshot,
          })),
        });
      }
      if (newPaketLabRows) {
        await tx.pasienPaketLab.deleteMany({ where: { pasienId: existing.id } });
        await tx.pasienPaketLab.createMany({
          data: newPaketLabRows.map((row) => ({
            pasienId: existing.id,
            paketLabId: row.paketLabId,
            hargaSnapshot: row.hargaSnapshot,
          })),
        });
      }
      return tx.pasien.update({
        where: { id: req.params.id },
        data: {
          nama: req.body.nama?.trim() ?? existing.nama,
          tanggalLahir: req.body.tanggalLahir ? new Date(req.body.tanggalLahir) : existing.tanggalLahir,
          noTelepon:
            req.body.noTelepon !== undefined ? req.body.noTelepon?.trim() || null : existing.noTelepon,
          alamat: req.body.alamat !== undefined ? req.body.alamat?.trim() || null : existing.alamat,
          pengirimId,
          klinis: req.body.klinis !== undefined ? req.body.klinis?.trim() || null : existing.klinis,
          kesan: req.body.kesan !== undefined ? req.body.kesan?.trim() || null : existing.kesan,
          hasilStatus,
          paymentStatus: req.body.paymentStatus ?? existing.paymentStatus,
          radiologId:
            req.body.radiologId !== undefined ? req.body.radiologId || null : existing.radiologId,
          admin: req.body.admin !== undefined ? req.body.admin?.trim() || null : existing.admin,
          petugasKasir:
            req.body.petugasKasir !== undefined ? req.body.petugasKasir?.trim() || null : existing.petugasKasir,
          sharingLocked,
          sharingType: 'FIXED',
          sharingPercent: new Decimal(0),
          sharingAmount,
          totalHarga,
          totalSharing,
        },
        include: {
          pengirim: true,
          radiolog: true,
          pemeriksaan: { include: { jenisPemeriksaan: true } },
          paketLab: { include: { paketLab: true } },
        },
      });
    });

    await syncPasienDuplikat(prisma, item.id);

    const autoDelete =
      existing.asalModul === 'RADIOLOGI' &&
      item.hasilStatus === 'SELESAI' &&
      item.paymentStatus === 'LUNAS';
    if (autoDelete) {
      await prisma.pasien.delete({ where: { id: item.id } });
      return { item: mapPasien(item), autoDeleted: true };
    }

    return { item: mapPasien(item) };
  });

  app.delete<{ Params: { id: string } }>('/api/pasien/:id', async (req, reply) => {
    const existing = await prisma.pasien.findUnique({ where: { id: req.params.id } });
    if (!existing) return reply.status(404).send({ error: 'Pasien tidak ditemukan' });

    if (existing.asalModul === 'RADIOLOGI' && existing.hasilStatus === 'MENUNGGU_HASIL') {
      return badRequest(
        reply,
        'Tidak bisa menghapus: pasien ini masih menunggu hasil di Pekerjaan Radiolog',
      );
    }

    await syncPasienDuplikat(prisma, existing.id);
    await prisma.pasien.delete({ where: { id: req.params.id } });
    return { ok: true };
  });

  /**
   * Hapus semua pasien radiologi yang masih tampil di antrean Pekerjaan Radiolog
   * (asalModul RADIOLOGI, hasilStatus MENUNGGU_HASIL) — menerobos proteksi
   * penghapusan satu-per-satu di atas atas permintaan eksplisit pengguna.
   * Setiap baris tetap diarsipkan ke PasienDuplikat sebelum dihapus.
   */
  app.delete('/api/pasien/bulk-radiolog-antrean', async () => {
    const targets = await prisma.pasien.findMany({
      where: { asalModul: 'RADIOLOGI', hasilStatus: 'MENUNGGU_HASIL' },
      select: { id: true },
    });
    const ids = targets.map((t) => t.id);
    for (const id of ids) {
      await syncPasienDuplikat(prisma, id);
    }
    await prisma.pasien.deleteMany({ where: { id: { in: ids } } });
    // Arsip tidak ikut terhapus, tapi statusnya disamakan jadi SELESAI supaya
    // tidak nyangkut selamanya di antrean Pekerjaan Radiolog (yang memfilter
    // hasilStatus MENUNGGU_HASIL) padahal sumber datanya sudah tidak ada.
    await prisma.pasienDuplikat.updateMany({
      where: { sourcePasienId: { in: ids } },
      data: { hasilStatus: 'SELESAI' },
    });
    return { ok: true, deleted: ids.length };
  });

  app.get<{
    Querystring: ListQuery & {
      modul?: string;
      hasilStatus?: string;
      paymentStatus?: string;
      pengirimNama?: string;
      startDate?: string;
      endDate?: string;
    };
  }>('/api/pasien-duplikat', async (req) => {
    const { page, limit, skip } = parsePagination(req.query);
    const where = pasienDuplikatListWhere(req.query);
    const [total, items] = await Promise.all([
      prisma.pasienDuplikat.count({ where }),
      prisma.pasienDuplikat.findMany({
        where,
        orderBy: { registeredAt: 'desc' },
        skip,
        take: limit,
      }),
    ]);
    return {
      items: items.map((d) => ({
        id: d.id,
        sourcePasienId: d.sourcePasienId,
        regCode: d.regCode,
        nama: d.nama,
        umur: computeUmur(d.tanggalLahir),
        tanggalLahir: d.tanggalLahir.toISOString().slice(0, 10),
        noTelepon: d.noTelepon,
        alamat: d.alamat,
        pengirimNama: d.pengirimNama,
        radiologNama: d.radiologNama,
        klinis: d.klinis,
        kesan: d.kesan,
        hasilStatus: d.hasilStatus,
        paymentStatus: d.paymentStatus,
        pemeriksaanNama: d.pemeriksaanNama,
        petugasKasir: d.petugasKasir,
        totalHarga: serializeDecimal(d.totalHarga),
        totalSharing: serializeDecimal(d.totalSharing),
        createdAt: d.registeredAt.toISOString(),
      })),
      pagination: buildPaginationMeta(total, page, limit),
    };
  });

  /** Ubah data satu baris arsip Duplikat (nama, alamat, dokter pengirim, pemeriksaan, harga, status). */
  app.patch<{
    Params: { id: string };
    Body: {
      nama?: string;
      alamat?: string;
      noTelepon?: string;
      pengirimNama?: string;
      pemeriksaanNama?: string;
      petugasKasir?: string;
      kesan?: string;
      totalHarga?: number;
      totalSharing?: number;
      paymentStatus?: 'BELUM_LUNAS' | 'LUNAS';
      hasilStatus?: 'MENUNGGU_HASIL' | 'SELESAI';
    };
  }>('/api/pasien-duplikat/:id', async (req, reply) => {
    const existing = await prisma.pasienDuplikat.findUnique({ where: { id: req.params.id } });
    if (!existing) return reply.status(404).send({ error: 'Arsip tidak ditemukan' });
    const b = req.body;
    const item = await prisma.pasienDuplikat.update({
      where: { id: req.params.id },
      data: {
        nama: b.nama?.trim() ?? existing.nama,
        alamat: b.alamat !== undefined ? b.alamat?.trim() || null : existing.alamat,
        noTelepon: b.noTelepon !== undefined ? b.noTelepon?.trim() || null : existing.noTelepon,
        pengirimNama: b.pengirimNama?.trim() ?? existing.pengirimNama,
        pemeriksaanNama: b.pemeriksaanNama?.trim() ?? existing.pemeriksaanNama,
        petugasKasir: b.petugasKasir !== undefined ? b.petugasKasir?.trim() || null : existing.petugasKasir,
        kesan: b.kesan !== undefined ? b.kesan?.trim() || null : existing.kesan,
        totalHarga: b.totalHarga !== undefined ? b.totalHarga : existing.totalHarga,
        totalSharing: b.totalSharing !== undefined ? b.totalSharing : existing.totalSharing,
        paymentStatus: b.paymentStatus ?? existing.paymentStatus,
        hasilStatus: b.hasilStatus ?? existing.hasilStatus,
      },
    });
    return {
      item: {
        id: item.id,
        sourcePasienId: item.sourcePasienId,
        regCode: item.regCode,
        nama: item.nama,
        umur: computeUmur(item.tanggalLahir),
        tanggalLahir: item.tanggalLahir.toISOString().slice(0, 10),
        noTelepon: item.noTelepon,
        alamat: item.alamat,
        pengirimNama: item.pengirimNama,
        radiologNama: item.radiologNama,
        klinis: item.klinis,
        kesan: item.kesan,
        hasilStatus: item.hasilStatus,
        paymentStatus: item.paymentStatus,
        pemeriksaanNama: item.pemeriksaanNama,
        petugasKasir: item.petugasKasir,
        totalHarga: serializeDecimal(item.totalHarga),
        totalSharing: serializeDecimal(item.totalSharing),
        createdAt: item.registeredAt.toISOString(),
      },
    };
  });

  /** Hapus permanen satu baris arsip Duplikat. */
  app.delete<{ Params: { id: string } }>('/api/pasien-duplikat/:id', async (req, reply) => {
    try {
      await prisma.pasienDuplikat.delete({ where: { id: req.params.id } });
      return { ok: true };
    } catch {
      return reply.status(404).send({ error: 'Arsip tidak ditemukan' });
    }
  });

  /** Hapus permanen semua arsip Duplikat (mis. seluruh arsip Duplikat Radiologi). */
  app.delete<{ Querystring: { modul?: string } }>('/api/pasien-duplikat', async (req, reply) => {
    if (req.query.modul !== 'RADIOLOGI' && req.query.modul !== 'LABORATORIUM') {
      return badRequest(reply, 'Parameter modul (RADIOLOGI/LABORATORIUM) wajib diisi');
    }
    const result = await prisma.pasienDuplikat.deleteMany({
      where: { asalModul: req.query.modul },
    });
    return { ok: true, deleted: result.count };
  });

  app.get<{ Querystring: ListQuery }>(
    '/api/radiolog/antrean',
    async (req) => {
      const { page, limit, skip } = parsePagination(req.query);
      const where = pasienAntreanWhere(req.query.q);
      const [total, items] = await Promise.all([
        prisma.pasien.count({ where }),
        prisma.pasien.findMany({
          where,
          orderBy: { createdAt: 'asc' },
          include: pasienInclude,
          skip,
          take: limit,
        }),
      ]);
      return {
        items: items.map(mapPasien),
        pagination: buildPaginationMeta(total, page, limit),
      };
    },
  );

  app.get<{ Querystring: ListQuery }>('/api/analisa-foto-rontgen', async (req) => {
    const { page, limit, skip } = parsePagination(req.query);
    const q = req.query.q?.trim();
    const where = q ? { namaPasien: { contains: q } } : {};
    const [total, items] = await Promise.all([
      prisma.analisaFotoRontgen.count({ where }),
      prisma.analisaFotoRontgen.findMany({
        where,
        orderBy: { tanggal: 'desc' },
        skip,
        take: limit,
        select: {
          id: true,
          namaPasien: true,
          regCode: true,
          jenisPemeriksaan: true,
          tanggal: true,
          fotoDataUrl: true,
          ukuranFoto: true,
          kesan: true,
          diagnosa: true,
          radiologNama: true,
        },
      }),
    ]);
    return {
      items: items.map((a) => ({
        id: a.id,
        namaPasien: a.namaPasien,
        regCode: a.regCode,
        jenisPemeriksaan: a.jenisPemeriksaan,
        tanggal: a.tanggal.toISOString(),
        fotoDataUrl: a.fotoDataUrl,
        ukuranFoto: a.ukuranFoto,
        kesan: a.kesan,
        diagnosa: a.diagnosa,
        radiologNama: a.radiologNama,
      })),
      pagination: buildPaginationMeta(total, page, limit),
    };
  });

  app.post<{
    Body: {
      namaPasien: string;
      regCode?: string;
      jenisPemeriksaan?: string;
      tanggal?: string;
      fotoDataUrl: string;
      ukuranFoto?: string;
      kesan?: string;
      diagnosa?: string;
      radiologNama?: string;
    };
  }>('/api/analisa-foto-rontgen', async (req, reply) => {
    const b = req.body;
    if (!b.namaPasien?.trim() || !b.fotoDataUrl?.trim()) {
      return badRequest(reply, 'namaPasien dan fotoDataUrl wajib diisi');
    }
    const item = await prisma.analisaFotoRontgen.create({
      data: {
        namaPasien: b.namaPasien.trim(),
        regCode: b.regCode?.trim() || null,
        jenisPemeriksaan: b.jenisPemeriksaan?.trim() || null,
        tanggal: b.tanggal ? new Date(b.tanggal) : new Date(),
        fotoDataUrl: b.fotoDataUrl,
        ukuranFoto: b.ukuranFoto?.trim() || '3 x 4 cm',
        kesan: b.kesan?.trim() || null,
        diagnosa: b.diagnosa?.trim() || null,
        radiologNama: b.radiologNama?.trim() || null,
      },
    });
    return reply.status(201).send({
      item: {
        id: item.id,
        namaPasien: item.namaPasien,
        regCode: item.regCode,
        jenisPemeriksaan: item.jenisPemeriksaan,
        tanggal: item.tanggal.toISOString(),
        fotoDataUrl: item.fotoDataUrl,
        ukuranFoto: item.ukuranFoto,
        kesan: item.kesan,
        diagnosa: item.diagnosa,
        radiologNama: item.radiologNama,
      },
    });
  });

  app.patch<{
    Params: { id: string };
    Body: {
      namaPasien?: string;
      regCode?: string;
      jenisPemeriksaan?: string;
      tanggal?: string;
      fotoDataUrl?: string;
      kesan?: string;
      diagnosa?: string;
      radiologNama?: string;
    };
  }>('/api/analisa-foto-rontgen/:id', async (req, reply) => {
    const existing = await prisma.analisaFotoRontgen.findUnique({ where: { id: req.params.id } });
    if (!existing) return reply.status(404).send({ error: 'Data analisa foto rontgen tidak ditemukan' });
    const item = await prisma.analisaFotoRontgen.update({
      where: { id: req.params.id },
      data: {
        namaPasien: req.body.namaPasien?.trim() ?? existing.namaPasien,
        regCode: req.body.regCode !== undefined ? req.body.regCode?.trim() || null : existing.regCode,
        jenisPemeriksaan:
          req.body.jenisPemeriksaan !== undefined
            ? req.body.jenisPemeriksaan?.trim() || null
            : existing.jenisPemeriksaan,
        tanggal: req.body.tanggal ? new Date(req.body.tanggal) : existing.tanggal,
        fotoDataUrl: req.body.fotoDataUrl ?? existing.fotoDataUrl,
        kesan: req.body.kesan !== undefined ? req.body.kesan?.trim() || null : existing.kesan,
        diagnosa: req.body.diagnosa !== undefined ? req.body.diagnosa?.trim() || null : existing.diagnosa,
        radiologNama:
          req.body.radiologNama !== undefined ? req.body.radiologNama?.trim() || null : existing.radiologNama,
      },
    });
    return {
      item: {
        id: item.id,
        namaPasien: item.namaPasien,
        regCode: item.regCode,
        jenisPemeriksaan: item.jenisPemeriksaan,
        tanggal: item.tanggal.toISOString(),
        fotoDataUrl: item.fotoDataUrl,
        kesan: item.kesan,
        diagnosa: item.diagnosa,
        radiologNama: item.radiologNama,
      },
    };
  });

  app.delete<{ Params: { id: string } }>('/api/analisa-foto-rontgen/:id', async (req) => {
    await prisma.analisaFotoRontgen.delete({ where: { id: req.params.id } });
    return { ok: true };
  });

  app.get('/api/kop-surat', async () => {
    const item = await prisma.kopSurat.findUnique({ where: { id: 'default' } });
    if (!item) {
      return {
        item: {
          namaKlinik: 'KLINIK PRIMA HUSADA',
          alamat: 'Jl. Siliwangi Ruko Palapa No 2 Parung Kuda',
          telepon: '0857-1932-5557',
          logoDataUrl: null,
        },
      };
    }
    return {
      item: {
        namaKlinik: item.namaKlinik,
        alamat: item.alamat,
        telepon: item.telepon,
        logoDataUrl: item.logoDataUrl,
      },
    };
  });

  app.put<{
    Body: { namaKlinik?: string; alamat?: string; telepon?: string; logoDataUrl?: string | null };
  }>('/api/kop-surat', async (req, reply) => {
    const b = req.body;
    const data = {
      namaKlinik: b.namaKlinik?.trim() || 'KLINIK PRIMA HUSADA',
      alamat: b.alamat?.trim() || '',
      telepon: b.telepon?.trim() || '',
      logoDataUrl: b.logoDataUrl ?? null,
    };
    const item = await prisma.kopSurat.upsert({
      where: { id: 'default' },
      create: { id: 'default', ...data },
      update: data,
    });
    return reply.status(200).send({
      item: {
        namaKlinik: item.namaKlinik,
        alamat: item.alamat,
        telepon: item.telepon,
        logoDataUrl: item.logoDataUrl,
      },
    });
  });

  app.get<{ Querystring: ListQuery }>('/api/tanda-tangan-elektronik', async (req) => {
    const { page, limit, skip } = parsePagination(req.query);
    const where = tandaTanganElektronikListWhere(req.query.q);
    const [total, items] = await Promise.all([
      prisma.tandaTanganElektronik.count({ where }),
      prisma.tandaTanganElektronik.findMany({
        where,
        orderBy: { nama: 'asc' },
        skip,
        take: limit,
      }),
    ]);
    return { items, pagination: buildPaginationMeta(total, page, limit) };
  });

  app.post<{
    Body: { nama: string; alamat?: string; logoTandaTangan?: string | null };
  }>('/api/tanda-tangan-elektronik', async (req, reply) => {
    if (!req.body.nama?.trim()) return badRequest(reply, 'nama wajib diisi');
    const item = await prisma.tandaTanganElektronik.create({
      data: {
        nama: req.body.nama.trim(),
        alamat: req.body.alamat?.trim() || null,
        logoTandaTangan: req.body.logoTandaTangan ?? null,
      },
    });
    return reply.status(201).send({ item });
  });

  app.patch<{
    Params: { id: string };
    Body: { nama?: string; alamat?: string; logoTandaTangan?: string | null };
  }>('/api/tanda-tangan-elektronik/:id', async (req, reply) => {
    const existing = await prisma.tandaTanganElektronik.findUnique({ where: { id: req.params.id } });
    if (!existing) return reply.status(404).send({ error: 'Tanda tangan elektronik tidak ditemukan' });
    const item = await prisma.tandaTanganElektronik.update({
      where: { id: req.params.id },
      data: {
        nama: req.body.nama?.trim() ?? existing.nama,
        alamat: req.body.alamat !== undefined ? req.body.alamat?.trim() || null : existing.alamat,
        logoTandaTangan:
          req.body.logoTandaTangan !== undefined ? req.body.logoTandaTangan : existing.logoTandaTangan,
      },
    });
    return { item };
  });

  app.delete<{ Params: { id: string } }>('/api/tanda-tangan-elektronik/:id', async (req) => {
    await prisma.tandaTanganElektronik.delete({ where: { id: req.params.id } });
    return { ok: true };
  });

  app.get<{ Querystring: ListQuery }>('/api/logo-perusahaan', async (req) => {
    const { page, limit, skip } = parsePagination(req.query);
    const where = logoPerusahaanListWhere(req.query.q);
    const [total, items] = await Promise.all([
      prisma.logoPerusahaan.count({ where }),
      prisma.logoPerusahaan.findMany({
        where,
        orderBy: { namaKlinik: 'asc' },
        skip,
        take: limit,
      }),
    ]);
    return { items, pagination: buildPaginationMeta(total, page, limit) };
  });

  app.post<{
    Body: { namaKlinik: string; logoTandaTangan?: string | null; logoPerusahaan?: string | null };
  }>('/api/logo-perusahaan', async (req, reply) => {
    if (!req.body.namaKlinik?.trim()) return badRequest(reply, 'namaKlinik wajib diisi');
    const item = await prisma.logoPerusahaan.create({
      data: {
        namaKlinik: req.body.namaKlinik.trim(),
        logoTandaTangan: req.body.logoTandaTangan ?? null,
        logoPerusahaan: req.body.logoPerusahaan ?? null,
      },
    });
    return reply.status(201).send({ item });
  });

  app.patch<{
    Params: { id: string };
    Body: { namaKlinik?: string; logoTandaTangan?: string | null; logoPerusahaan?: string | null };
  }>('/api/logo-perusahaan/:id', async (req, reply) => {
    const existing = await prisma.logoPerusahaan.findUnique({ where: { id: req.params.id } });
    if (!existing) return reply.status(404).send({ error: 'Logo perusahaan tidak ditemukan' });
    const item = await prisma.logoPerusahaan.update({
      where: { id: req.params.id },
      data: {
        namaKlinik: req.body.namaKlinik?.trim() ?? existing.namaKlinik,
        logoTandaTangan:
          req.body.logoTandaTangan !== undefined ? req.body.logoTandaTangan : existing.logoTandaTangan,
        logoPerusahaan:
          req.body.logoPerusahaan !== undefined ? req.body.logoPerusahaan : existing.logoPerusahaan,
      },
    });
    return { item };
  });

  app.delete<{ Params: { id: string } }>('/api/logo-perusahaan/:id', async (req) => {
    await prisma.logoPerusahaan.delete({ where: { id: req.params.id } });
    return { ok: true };
  });

  app.get<{ Querystring: ListQuery }>('/api/daftar-telpon', async (req) => {
    const { page, limit, skip } = parsePagination(req.query);
    const where = daftarTelponListWhere(req.query.q);
    const [total, items] = await Promise.all([
      prisma.daftarTelpon.count({ where }),
      prisma.daftarTelpon.findMany({
        where,
        orderBy: { nama: 'asc' },
        skip,
        take: limit,
      }),
    ]);
    return { items, pagination: buildPaginationMeta(total, page, limit) };
  });

  app.post<{
    Body: {
      nama: string;
      telpon?: string;
      admin?: string;
      password?: string;
      noKontrak?: string;
      namaInstansi?: string;
    };
  }>('/api/daftar-telpon', async (req, reply) => {
    if (!req.body.nama?.trim()) return badRequest(reply, 'nama wajib diisi');
    const item = await prisma.daftarTelpon.create({
      data: {
        nama: req.body.nama.trim(),
        telpon: req.body.telpon?.trim() || null,
        admin: req.body.admin?.trim() || null,
        password: req.body.password?.trim() || null,
        noKontrak: req.body.noKontrak?.trim() || null,
        namaInstansi: req.body.namaInstansi?.trim() || null,
      },
    });
    return reply.status(201).send({ item });
  });

  app.patch<{
    Params: { id: string };
    Body: {
      nama?: string;
      telpon?: string;
      admin?: string;
      password?: string;
      noKontrak?: string;
      namaInstansi?: string;
    };
  }>('/api/daftar-telpon/:id', async (req, reply) => {
    const existing = await prisma.daftarTelpon.findUnique({ where: { id: req.params.id } });
    if (!existing) return reply.status(404).send({ error: 'Data tidak ditemukan' });
    const item = await prisma.daftarTelpon.update({
      where: { id: req.params.id },
      data: {
        nama: req.body.nama?.trim() ?? existing.nama,
        telpon: req.body.telpon !== undefined ? req.body.telpon?.trim() || null : existing.telpon,
        admin: req.body.admin !== undefined ? req.body.admin?.trim() || null : existing.admin,
        password: req.body.password !== undefined ? req.body.password?.trim() || null : existing.password,
        noKontrak: req.body.noKontrak !== undefined ? req.body.noKontrak?.trim() || null : existing.noKontrak,
        namaInstansi:
          req.body.namaInstansi !== undefined ? req.body.namaInstansi?.trim() || null : existing.namaInstansi,
      },
    });
    return { item };
  });

  app.delete<{ Params: { id: string } }>('/api/daftar-telpon/:id', async (req) => {
    await prisma.daftarTelpon.delete({ where: { id: req.params.id } });
    return { ok: true };
  });

  // ─── Hari Libur (Kalender) ──────────────────────────────────────────────────

  app.get<{ Querystring: { year?: string } }>('/api/hari-libur', async (req) => {
    const yearStr = req.query.year || new Date().getFullYear().toString();
    const year = parseInt(yearStr, 10);
    if (isNaN(year)) return { items: [] };
    const items = await prisma.hariLibur.findMany({
      where: { tanggal: { gte: new Date(year, 0, 1), lte: new Date(year, 11, 31, 23, 59, 59, 999) } },
      orderBy: { tanggal: 'asc' },
    });
    return {
      items: items.map((h) => ({
        id: h.id,
        tanggal: h.tanggal.toISOString().slice(0, 10),
        keterangan: h.keterangan,
      })),
    };
  });

  app.post<{ Body: { tanggal: string; keterangan: string } }>(
    '/api/hari-libur',
    async (req, reply) => {
      if (!req.body.tanggal || !req.body.keterangan?.trim()) {
        return badRequest(reply, 'tanggal dan keterangan wajib diisi');
      }
      try {
        const item = await prisma.hariLibur.create({
          data: { tanggal: new Date(req.body.tanggal), keterangan: req.body.keterangan.trim() },
        });
        return reply.status(201).send({
          item: { id: item.id, tanggal: item.tanggal.toISOString().slice(0, 10), keterangan: item.keterangan },
        });
      } catch (err: unknown) {
        if (err instanceof PrismaClientKnownRequestError && err.code === 'P2002') {
          return badRequest(reply, 'Sudah ada hari libur untuk tanggal tersebut');
        }
        throw err;
      }
    },
  );

  app.patch<{ Params: { id: string }; Body: { tanggal?: string; keterangan?: string } }>(
    '/api/hari-libur/:id',
    async (req, reply) => {
      const existing = await prisma.hariLibur.findUnique({ where: { id: req.params.id } });
      if (!existing) return reply.status(404).send({ error: 'Hari libur tidak ditemukan' });
      try {
        const item = await prisma.hariLibur.update({
          where: { id: req.params.id },
          data: {
            tanggal: req.body.tanggal ? new Date(req.body.tanggal) : existing.tanggal,
            keterangan: req.body.keterangan?.trim() ?? existing.keterangan,
          },
        });
        return { item: { id: item.id, tanggal: item.tanggal.toISOString().slice(0, 10), keterangan: item.keterangan } };
      } catch (err: unknown) {
        if (err instanceof PrismaClientKnownRequestError && err.code === 'P2002') {
          return badRequest(reply, 'Sudah ada hari libur untuk tanggal tersebut');
        }
        throw err;
      }
    },
  );

  app.delete<{ Params: { id: string } }>('/api/hari-libur/:id', async (req) => {
    await prisma.hariLibur.delete({ where: { id: req.params.id } });
    return { ok: true };
  });

  // ─── Surat Keterangan Sehat ─────────────────────────────────────────────────

  app.get<{ Querystring: ListQuery }>('/api/surat-keterangan-sehat', async (req) => {
    const { page, limit, skip } = parsePagination(req.query);
    const where = suratKeteranganSehatListWhere(req.query.q);
    const [total, items] = await Promise.all([
      prisma.suratKeteranganSehat.count({ where }),
      prisma.suratKeteranganSehat.findMany({ where, orderBy: { createdAt: 'desc' }, skip, take: limit }),
    ]);
    return {
      items: items.map((it) => ({ ...it, tanggalSurat: it.tanggalSurat.toISOString().slice(0, 10) })),
      pagination: buildPaginationMeta(total, page, limit),
    };
  });

  app.post<{
    Body: {
      nomorSurat?: string;
      namaPasien: string;
      tempatTanggalLahir?: string;
      jenisKelamin?: string;
      pekerjaan?: string;
      alamatPasien?: string;
      hasilPemeriksaan?: string;
      keperluan?: string;
      tempatSurat?: string;
      tanggalSurat?: string;
      namaDokter?: string;
      jabatanDokter?: string;
    };
  }>('/api/surat-keterangan-sehat', async (req, reply) => {
    if (!req.body.namaPasien?.trim()) return badRequest(reply, 'namaPasien wajib diisi');
    const item = await prisma.suratKeteranganSehat.create({
      data: {
        nomorSurat: req.body.nomorSurat?.trim() || null,
        namaPasien: req.body.namaPasien.trim(),
        tempatTanggalLahir: req.body.tempatTanggalLahir?.trim() || null,
        jenisKelamin: req.body.jenisKelamin?.trim() || 'Laki-laki',
        pekerjaan: req.body.pekerjaan?.trim() || null,
        alamatPasien: req.body.alamatPasien?.trim() || null,
        hasilPemeriksaan: req.body.hasilPemeriksaan?.trim() || null,
        keperluan: req.body.keperluan?.trim() || null,
        tempatSurat: req.body.tempatSurat?.trim() || null,
        tanggalSurat: req.body.tanggalSurat ? new Date(req.body.tanggalSurat) : new Date(),
        namaDokter: req.body.namaDokter?.trim() || null,
        jabatanDokter: req.body.jabatanDokter?.trim() || null,
      },
    });
    return reply.status(201).send({ item: { ...item, tanggalSurat: item.tanggalSurat.toISOString().slice(0, 10) } });
  });

  app.patch<{
    Params: { id: string };
    Body: {
      nomorSurat?: string;
      namaPasien?: string;
      tempatTanggalLahir?: string;
      jenisKelamin?: string;
      pekerjaan?: string;
      alamatPasien?: string;
      hasilPemeriksaan?: string;
      keperluan?: string;
      tempatSurat?: string;
      tanggalSurat?: string;
      namaDokter?: string;
      jabatanDokter?: string;
    };
  }>('/api/surat-keterangan-sehat/:id', async (req, reply) => {
    const existing = await prisma.suratKeteranganSehat.findUnique({ where: { id: req.params.id } });
    if (!existing) return reply.status(404).send({ error: 'Surat tidak ditemukan' });
    const item = await prisma.suratKeteranganSehat.update({
      where: { id: req.params.id },
      data: {
        nomorSurat: req.body.nomorSurat !== undefined ? req.body.nomorSurat?.trim() || null : existing.nomorSurat,
        namaPasien: req.body.namaPasien?.trim() ?? existing.namaPasien,
        tempatTanggalLahir:
          req.body.tempatTanggalLahir !== undefined ? req.body.tempatTanggalLahir?.trim() || null : existing.tempatTanggalLahir,
        jenisKelamin: req.body.jenisKelamin?.trim() ?? existing.jenisKelamin,
        pekerjaan: req.body.pekerjaan !== undefined ? req.body.pekerjaan?.trim() || null : existing.pekerjaan,
        alamatPasien: req.body.alamatPasien !== undefined ? req.body.alamatPasien?.trim() || null : existing.alamatPasien,
        hasilPemeriksaan:
          req.body.hasilPemeriksaan !== undefined ? req.body.hasilPemeriksaan?.trim() || null : existing.hasilPemeriksaan,
        keperluan: req.body.keperluan !== undefined ? req.body.keperluan?.trim() || null : existing.keperluan,
        tempatSurat: req.body.tempatSurat !== undefined ? req.body.tempatSurat?.trim() || null : existing.tempatSurat,
        tanggalSurat: req.body.tanggalSurat ? new Date(req.body.tanggalSurat) : existing.tanggalSurat,
        namaDokter: req.body.namaDokter !== undefined ? req.body.namaDokter?.trim() || null : existing.namaDokter,
        jabatanDokter: req.body.jabatanDokter !== undefined ? req.body.jabatanDokter?.trim() || null : existing.jabatanDokter,
      },
    });
    return { item: { ...item, tanggalSurat: item.tanggalSurat.toISOString().slice(0, 10) } };
  });

  app.delete<{ Params: { id: string } }>('/api/surat-keterangan-sehat/:id', async (req) => {
    await prisma.suratKeteranganSehat.delete({ where: { id: req.params.id } });
    return { ok: true };
  });

  // ─── Surat Keterangan Rujukan ───────────────────────────────────────────────

  app.get<{ Querystring: ListQuery }>('/api/surat-keterangan-rujukan', async (req) => {
    const { page, limit, skip } = parsePagination(req.query);
    const where = suratKeteranganRujukanListWhere(req.query.q);
    const [total, items] = await Promise.all([
      prisma.suratKeteranganRujukan.count({ where }),
      prisma.suratKeteranganRujukan.findMany({ where, orderBy: { createdAt: 'desc' }, skip, take: limit }),
    ]);
    return {
      items: items.map((it) => ({ ...it, tanggalSurat: it.tanggalSurat.toISOString().slice(0, 10) })),
      pagination: buildPaginationMeta(total, page, limit),
    };
  });

  app.post<{
    Body: {
      nomorSurat?: string;
      namaPasien: string;
      tempatTanggalLahir?: string;
      jenisKelamin?: string;
      alamatPasien?: string;
      dirujukKe?: string;
      diagnosaKeluhan?: string;
      alasanRujukan?: string;
      tempatSurat?: string;
      tanggalSurat?: string;
      namaDokter?: string;
      jabatanDokter?: string;
    };
  }>('/api/surat-keterangan-rujukan', async (req, reply) => {
    if (!req.body.namaPasien?.trim()) return badRequest(reply, 'namaPasien wajib diisi');
    const item = await prisma.suratKeteranganRujukan.create({
      data: {
        nomorSurat: req.body.nomorSurat?.trim() || null,
        namaPasien: req.body.namaPasien.trim(),
        tempatTanggalLahir: req.body.tempatTanggalLahir?.trim() || null,
        jenisKelamin: req.body.jenisKelamin?.trim() || 'Laki-laki',
        alamatPasien: req.body.alamatPasien?.trim() || null,
        dirujukKe: req.body.dirujukKe?.trim() || null,
        diagnosaKeluhan: req.body.diagnosaKeluhan?.trim() || null,
        alasanRujukan: req.body.alasanRujukan?.trim() || null,
        tempatSurat: req.body.tempatSurat?.trim() || null,
        tanggalSurat: req.body.tanggalSurat ? new Date(req.body.tanggalSurat) : new Date(),
        namaDokter: req.body.namaDokter?.trim() || null,
        jabatanDokter: req.body.jabatanDokter?.trim() || null,
      },
    });
    return reply.status(201).send({ item: { ...item, tanggalSurat: item.tanggalSurat.toISOString().slice(0, 10) } });
  });

  app.patch<{
    Params: { id: string };
    Body: {
      nomorSurat?: string;
      namaPasien?: string;
      tempatTanggalLahir?: string;
      jenisKelamin?: string;
      alamatPasien?: string;
      dirujukKe?: string;
      diagnosaKeluhan?: string;
      alasanRujukan?: string;
      tempatSurat?: string;
      tanggalSurat?: string;
      namaDokter?: string;
      jabatanDokter?: string;
    };
  }>('/api/surat-keterangan-rujukan/:id', async (req, reply) => {
    const existing = await prisma.suratKeteranganRujukan.findUnique({ where: { id: req.params.id } });
    if (!existing) return reply.status(404).send({ error: 'Surat tidak ditemukan' });
    const item = await prisma.suratKeteranganRujukan.update({
      where: { id: req.params.id },
      data: {
        nomorSurat: req.body.nomorSurat !== undefined ? req.body.nomorSurat?.trim() || null : existing.nomorSurat,
        namaPasien: req.body.namaPasien?.trim() ?? existing.namaPasien,
        tempatTanggalLahir:
          req.body.tempatTanggalLahir !== undefined ? req.body.tempatTanggalLahir?.trim() || null : existing.tempatTanggalLahir,
        jenisKelamin: req.body.jenisKelamin?.trim() ?? existing.jenisKelamin,
        alamatPasien: req.body.alamatPasien !== undefined ? req.body.alamatPasien?.trim() || null : existing.alamatPasien,
        dirujukKe: req.body.dirujukKe !== undefined ? req.body.dirujukKe?.trim() || null : existing.dirujukKe,
        diagnosaKeluhan:
          req.body.diagnosaKeluhan !== undefined ? req.body.diagnosaKeluhan?.trim() || null : existing.diagnosaKeluhan,
        alasanRujukan: req.body.alasanRujukan !== undefined ? req.body.alasanRujukan?.trim() || null : existing.alasanRujukan,
        tempatSurat: req.body.tempatSurat !== undefined ? req.body.tempatSurat?.trim() || null : existing.tempatSurat,
        tanggalSurat: req.body.tanggalSurat ? new Date(req.body.tanggalSurat) : existing.tanggalSurat,
        namaDokter: req.body.namaDokter !== undefined ? req.body.namaDokter?.trim() || null : existing.namaDokter,
        jabatanDokter: req.body.jabatanDokter !== undefined ? req.body.jabatanDokter?.trim() || null : existing.jabatanDokter,
      },
    });
    return { item: { ...item, tanggalSurat: item.tanggalSurat.toISOString().slice(0, 10) } };
  });

  app.delete<{ Params: { id: string } }>('/api/surat-keterangan-rujukan/:id', async (req) => {
    await prisma.suratKeteranganRujukan.delete({ where: { id: req.params.id } });
    return { ok: true };
  });
}

function mapPasien(
  p: {
    id: string;
    regCode: string;
    nama: string;
    tanggalLahir: Date;
    noTelepon: string | null;
    alamat: string | null;
    klinis: string | null;
    hasilStatus: string;
    paymentStatus: string;
    sharingAmount: Decimal | null;
    totalHarga: Decimal;
    totalSharing: Decimal;
    sharingLocked: boolean;
    kesan: string | null;
    admin: string | null;
    petugasKasir: string | null;
    createdAt: Date;
    pengirim: { id: string; nama: string };
    radiolog?: { id: string; nama: string } | null;
    pemeriksaan: {
      id: string;
      jenisPemeriksaanId: string;
      hargaSnapshot: Decimal;
      jenisPemeriksaan: { nama: string };
    }[];
    paketLab: {
      id: string;
      paketLabId: string;
      hargaSnapshot: Decimal;
      paketLab: { nama: string };
    }[];
  },
) {
  return {
    id: p.id,
    regCode: p.regCode,
    nama: p.nama,
    umur: computeUmur(p.tanggalLahir),
    tanggalLahir: p.tanggalLahir.toISOString().slice(0, 10),
    noTelepon: p.noTelepon,
    alamat: p.alamat,
    pengirim: p.pengirim,
    klinis: p.klinis,
    hasilStatus: p.hasilStatus,
    paymentStatus: p.paymentStatus,
    sharingAmount: serializeDecimal(p.sharingAmount ?? p.totalSharing),
    totalHarga: serializeDecimal(p.totalHarga),
    totalSharing: serializeDecimal(p.totalSharing),
    sharingLocked: p.sharingLocked,
    kesan: p.kesan,
    admin: p.admin,
    petugasKasir: p.petugasKasir,
    radiolog: p.radiolog ?? null,
    // Radiologi pakai PasienPemeriksaan (relasi ke JenisPemeriksaan), Laboratorium
    // pakai PasienPaketLab (relasi ke PaketLab) — keduanya digabung jadi satu
    // array `pemeriksaan` yang seragam supaya frontend tidak perlu tahu bedanya.
    pemeriksaan: [
      ...p.pemeriksaan.map((x) => ({
        id: x.id,
        jenisPemeriksaanId: x.jenisPemeriksaanId,
        nama: x.jenisPemeriksaan.nama,
        harga: serializeDecimal(x.hargaSnapshot),
      })),
      ...p.paketLab.map((x) => ({
        id: x.id,
        jenisPemeriksaanId: x.paketLabId,
        nama: x.paketLab.nama,
        harga: serializeDecimal(x.hargaSnapshot),
      })),
    ],
    createdAt: p.createdAt.toISOString(),
  };
}
