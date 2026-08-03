-- CreateTable
CREATE TABLE "AdminPendaftaran" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "nama" TEXT NOT NULL,
    "noHp" TEXT,
    "statusHadir" TEXT,
    "statusTanggal" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
