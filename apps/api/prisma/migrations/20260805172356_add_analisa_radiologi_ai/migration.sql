-- CreateTable
CREATE TABLE "AnalisaRadiologiAi" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "namaPasien" TEXT NOT NULL,
    "namaPemeriksaan" TEXT,
    "fotoDataUrl" TEXT NOT NULL,
    "bacaan" TEXT,
    "kesan" TEXT,
    "isDraftAi" BOOLEAN NOT NULL DEFAULT false,
    "radiologNama" TEXT,
    "tanggal" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
