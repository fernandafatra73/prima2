import type { PrismaClient } from '../generated/prisma/client.js';

export async function syncPasienDuplikat(prisma: PrismaClient, pasienId: string): Promise<void> {
  const pasien = await prisma.pasien.findUnique({
    where: { id: pasienId },
    include: {
      pengirim: true,
      radiolog: true,
      pemeriksaan: { include: { jenisPemeriksaan: true } },
    },
  });
  if (!pasien) return;

  const pemeriksaanNama = pasien.pemeriksaan.map((x) => x.jenisPemeriksaan.nama).join(', ');
  const radiologNama = pasien.radiolog?.nama ?? null;

  await prisma.pasienDuplikat.upsert({
    where: { sourcePasienId: pasien.id },
    create: {
      sourcePasienId: pasien.id,
      regCode: pasien.regCode,
      nama: pasien.nama,
      tanggalLahir: pasien.tanggalLahir,
      noTelepon: pasien.noTelepon,
      alamat: pasien.alamat,
      pengirimNama: pasien.pengirim.nama,
      radiologNama,
      asalModul: pasien.asalModul,
      klinis: pasien.klinis,
      kesan: pasien.kesan,
      hasilStatus: pasien.hasilStatus,
      paymentStatus: pasien.paymentStatus,
      pemeriksaanNama,
      petugasKasir: pasien.petugasKasir,
      totalHarga: pasien.totalHarga,
      totalSharing: pasien.totalSharing,
      registeredAt: pasien.createdAt,
    },
    update: {
      regCode: pasien.regCode,
      nama: pasien.nama,
      tanggalLahir: pasien.tanggalLahir,
      noTelepon: pasien.noTelepon,
      alamat: pasien.alamat,
      pengirimNama: pasien.pengirim.nama,
      radiologNama,
      asalModul: pasien.asalModul,
      klinis: pasien.klinis,
      kesan: pasien.kesan,
      hasilStatus: pasien.hasilStatus,
      paymentStatus: pasien.paymentStatus,
      pemeriksaanNama,
      petugasKasir: pasien.petugasKasir,
      totalHarga: pasien.totalHarga,
      totalSharing: pasien.totalSharing,
    },
  });
}
