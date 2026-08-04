import type { PrismaClient } from '../generated/prisma/client.js';

function maxSequenceSuffix(codes: readonly string[], prefix: string): number {
  let max = 0;
  for (const code of codes) {
    const suffix = code.slice(prefix.length).replace(/^-/, '');
    const seq = Number(suffix);
    if (Number.isInteger(seq) && seq > max) {
      max = seq;
    }
  }
  return max;
}

export async function nextRegCode(prisma: PrismaClient): Promise<string> {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  const prefix = `REG-${y}${m}${d}`;

  // Dihitung dari nomor urut TERBESAR (bukan jumlah baris) supaya tidak bentrok
  // ketika ada pasien hari ini yang sudah terhapus (mis. auto-hapus selesai & lunas).
  const existing = await prisma.pasien.findMany({
    where: { regCode: { startsWith: prefix } },
    select: { regCode: true },
  });

  const maxSeq = maxSequenceSuffix(
    existing.map((p) => p.regCode),
    prefix,
  );

  return `${prefix}-${String(maxSeq + 1).padStart(3, '0')}`;
}

export async function nextPendaftaranUmumCode(prisma: PrismaClient): Promise<string> {
  const now = new Date();
  const y = String(now.getFullYear()).slice(-2); // e.g. 26
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  const prefix = `PH${y}${m}${d}`; // PH260727

  const existing = await prisma.pendaftaranUmum.findMany({
    where: { noRegistrasi: { startsWith: prefix } },
    select: { noRegistrasi: true },
  });

  const maxSeq = maxSequenceSuffix(
    existing.map((p) => p.noRegistrasi),
    prefix,
  );

  return `${prefix}${String(maxSeq + 1).padStart(3, '0')}`;
}
