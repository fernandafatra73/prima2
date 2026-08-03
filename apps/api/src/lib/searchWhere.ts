import type { Prisma } from '../generated/prisma/client.js';

export function searchTerm(q?: string): string | undefined {
  const t = q?.trim();
  return t && t.length > 0 ? t : undefined;
}

export function dokterListWhere(q?: string): Prisma.DokterWhereInput {
  const term = searchTerm(q);
  if (!term) return {};
  return {
    OR: [
      { nama: { contains: term } },
      { spesialisasi: { contains: term } },
      { noTelepon: { contains: term } },
    ],
  };
}

export function karyawanKlinikListWhere(q?: string): Prisma.KaryawanKlinikWhereInput {
  const term = searchTerm(q);
  if (!term) return {};
  return {
    OR: [
      { nama: { contains: term } },
      { spesialisasi: { contains: term } },
      { noTelepon: { contains: term } },
    ],
  };
}

export function radiologListWhere(q?: string): Prisma.RadiologWhereInput {
  const term = searchTerm(q);
  if (!term) return {};
  return {
    OR: [
      { nama: { contains: term } },
      { noTelepon: { contains: term } },
    ],
  };
}

export function petugasLabListWhere(q?: string): Prisma.PetugasLabWhereInput {
  const term = searchTerm(q);
  if (!term) return {};
  return {
    OR: [
      { nama: { contains: term } },
      { nip: { contains: term } },
      { noTelepon: { contains: term } },
    ],
  };
}

export function radiograferListWhere(q?: string): Prisma.RadiograferWhereInput {
  const term = searchTerm(q);
  if (!term) return {};
  return {
    OR: [
      { nama: { contains: term } },
      { noHp: { contains: term } },
    ],
  };
}

export function petugasKasirListWhere(q?: string): Prisma.PetugasKasirWhereInput {
  const term = searchTerm(q);
  if (!term) return {};
  return {
    OR: [
      { nama: { contains: term } },
      { noHp: { contains: term } },
    ],
  };
}

export function petugasAdminKlinikListWhere(q?: string): Prisma.PetugasAdminKlinikWhereInput {
  const term = searchTerm(q);
  if (!term) return {};
  return {
    OR: [
      { nama: { contains: term } },
      { noHp: { contains: term } },
    ],
  };
}

export function adminPendaftaranListWhere(q?: string): Prisma.AdminPendaftaranWhereInput {
  const term = searchTerm(q);
  if (!term) return {};
  return {
    OR: [
      { nama: { contains: term } },
      { noHp: { contains: term } },
    ],
  };
}

export function tandaTanganElektronikListWhere(q?: string): Prisma.TandaTanganElektronikWhereInput {
  const term = searchTerm(q);
  if (!term) return {};
  return {
    OR: [
      { nama: { contains: term } },
      { alamat: { contains: term } },
    ],
  };
}

export function suratKeteranganSehatListWhere(q?: string): Prisma.SuratKeteranganSehatWhereInput {
  const term = searchTerm(q);
  if (!term) return {};
  return {
    OR: [
      { namaPasien: { contains: term } },
      { nomorSurat: { contains: term } },
    ],
  };
}

export function suratKeteranganRujukanListWhere(q?: string): Prisma.SuratKeteranganRujukanWhereInput {
  const term = searchTerm(q);
  if (!term) return {};
  return {
    OR: [
      { namaPasien: { contains: term } },
      { nomorSurat: { contains: term } },
    ],
  };
}

export function daftarTelponListWhere(q?: string): Prisma.DaftarTelponWhereInput {
  const term = searchTerm(q);
  if (!term) return {};
  return {
    OR: [
      { nama: { contains: term } },
      { telpon: { contains: term } },
      { namaInstansi: { contains: term } },
      { noKontrak: { contains: term } },
    ],
  };
}

export function jenisListWhere(q?: string): Prisma.JenisPemeriksaanWhereInput {
  const term = searchTerm(q);
  if (!term) return {};
  return { nama: { contains: term } };
}

export function kesanListWhere(q?: string): Prisma.KesanTemplateWhereInput {
  const term = searchTerm(q);
  if (!term) return {};
  return {
    OR: [
      { judul: { contains: term } },
      { isi: { contains: term } },
    ],
  };
}

export function staffListWhere(q?: string, role?: string): Prisma.StaffWhereInput {
  const parts: Prisma.StaffWhereInput[] = [];
  if (role === 'ADMIN' || role === 'KARYAWAN') {
    parts.push({ role });
  }
  const term = searchTerm(q);
  if (term) {
    parts.push({
      OR: [
        { nama: { contains: term } },
        { email: { contains: term } },
      ],
    });
  }
  if (parts.length === 0) return {};
  if (parts.length === 1) return parts[0]!;
  return { AND: parts };
}

export function pasienListWhere(query: {
  q?: string;
  hasilStatus?: string;
  paymentStatus?: string;
  pengirimId?: string;
  startDate?: string;
  endDate?: string;
  modul?: string;
}): Prisma.PasienWhereInput {
  const where: Prisma.PasienWhereInput = {};

  if (query.pengirimId) {
    where.pengirimId = query.pengirimId;
  }
  if (query.modul === 'RADIOLOGI' || query.modul === 'LABORATORIUM') {
    where.asalModul = query.modul;
  }
  if (query.hasilStatus === 'MENUNGGU_HASIL' || query.hasilStatus === 'SELESAI') {
    where.hasilStatus = query.hasilStatus;
  }
  if (query.paymentStatus === 'BELUM_LUNAS' || query.paymentStatus === 'LUNAS') {
    where.paymentStatus = query.paymentStatus;
  }

  if (query.startDate || query.endDate) {
    const createdAt: Prisma.DateTimeFilter = {};
    if (query.startDate) {
      createdAt.gte = new Date(query.startDate);
    }
    if (query.endDate) {
      const end = new Date(query.endDate);
      end.setHours(23, 59, 59, 999);
      createdAt.lte = end;
    }
    where.createdAt = createdAt;
  }

  const term = searchTerm(query.q);
  if (term) {
    where.OR = [
      { nama: { contains: term } },
      { regCode: { contains: term } },
      { noTelepon: { contains: term } },
      { alamat: { contains: term } },
      { pengirim: { nama: { contains: term } } },
    ];
  }

  return where;
}

export function pendaftaranUmumListWhere(query: {
  q?: string;
  startDate?: string;
  endDate?: string;
}): Prisma.PendaftaranUmumWhereInput {
  const where: Prisma.PendaftaranUmumWhereInput = {};

  if (query.startDate || query.endDate) {
    const tanggalMasuk: Prisma.DateTimeFilter = {};
    if (query.startDate) {
      tanggalMasuk.gte = new Date(query.startDate);
    }
    if (query.endDate) {
      const end = new Date(query.endDate);
      end.setHours(23, 59, 59, 999);
      tanggalMasuk.lte = end;
    }
    where.tanggalMasuk = tanggalMasuk;
  }

  const term = searchTerm(query.q);
  if (term) {
    where.OR = [
      { namaPasien: { contains: term } },
      { noRegistrasi: { contains: term } },
    ];
  }

  return where;
}

export function pasienAntreanWhere(q?: string): Prisma.PasienWhereInput {
  const where: Prisma.PasienWhereInput = { hasilStatus: 'MENUNGGU_HASIL' };
  const term = searchTerm(q);
  if (term) {
    where.OR = [
      { nama: { contains: term } },
      { regCode: { contains: term } },
    ];
  }
  return where;
}

export function pasienDuplikatListWhere(query: {
  q?: string;
  modul?: string;
  hasilStatus?: string;
  paymentStatus?: string;
  pengirimNama?: string;
  startDate?: string;
  endDate?: string;
}): Prisma.PasienDuplikatWhereInput {
  const where: Prisma.PasienDuplikatWhereInput = {};
  if (query.modul === 'RADIOLOGI' || query.modul === 'LABORATORIUM') {
    where.asalModul = query.modul;
  }
  if (query.hasilStatus === 'MENUNGGU_HASIL' || query.hasilStatus === 'SELESAI') {
    where.hasilStatus = query.hasilStatus;
  }
  if (query.paymentStatus === 'BELUM_LUNAS' || query.paymentStatus === 'LUNAS') {
    where.paymentStatus = query.paymentStatus;
  }
  if (query.pengirimNama) {
    where.pengirimNama = query.pengirimNama;
  }
  if (query.startDate || query.endDate) {
    const registeredAt: Prisma.DateTimeFilter = {};
    if (query.startDate) {
      registeredAt.gte = new Date(query.startDate);
    }
    if (query.endDate) {
      const end = new Date(query.endDate);
      end.setHours(23, 59, 59, 999);
      registeredAt.lte = end;
    }
    where.registeredAt = registeredAt;
  }
  const term = searchTerm(query.q);
  if (term) {
    where.OR = [
      { nama: { contains: term } },
      { regCode: { contains: term } },
      { noTelepon: { contains: term } },
      { alamat: { contains: term } },
      { pengirimNama: { contains: term } },
    ];
  }
  return where;
}

export function hargaListWhere(q?: string): Prisma.HargaLayananWhereInput {
  const term = searchTerm(q);
  if (!term) return {};
  return {
    OR: [
      { jenisPemeriksaan: { nama: { contains: term } } },
      { detailLayanan: { contains: term } },
    ],
  };
}

export function sharingListWhere(query: {
  q?: string;
  dokterId?: string;
}): Prisma.PasienWhereInput {
  const base = pasienListWhere({ q: query.q, pengirimId: query.dokterId });
  return base;
}
