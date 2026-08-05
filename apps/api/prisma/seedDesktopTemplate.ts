import 'dotenv/config';
import { PrismaLibSql } from '@prisma/adapter-libsql';
import { PrismaClient, StaffRole } from '../src/generated/prisma/client.js';
import { hashPassword } from '../src/lib/password.js';

const url = process.env.DATABASE_URL ?? 'file:dev.db';
const adapter = new PrismaLibSql({ url });
const prisma = new PrismaClient({ adapter });

/** Seed minimal untuk template database aplikasi desktop — hanya akun login, tanpa data contoh. */
async function main() {
  const adminPasswordHash = await hashPassword('admin123');
  const karyawanPasswordHash = await hashPassword('karyawan123');

  await prisma.staff.createMany({
    data: [
      {
        nama: 'Admin LabPrima',
        email: 'admin@labprima.local',
        passwordHash: adminPasswordHash,
        role: StaffRole.ADMIN,
      },
      {
        nama: 'Karyawan Demo',
        email: 'karyawan@labprima.local',
        passwordHash: karyawanPasswordHash,
        role: StaffRole.KARYAWAN,
      },
    ],
  });

  console.log('Template database desktop siap (akun admin & karyawan dibuat).');
}

main()
  .catch((err: unknown) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => void prisma.$disconnect());
