-- CreateTable
CREATE TABLE "AnalisaFotoAi" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "namaPasien" TEXT NOT NULL,
    "pemeriksaan" TEXT,
    "namaPenyakit" TEXT,
    "fotoDataUrl" TEXT NOT NULL,
    "kesan" TEXT,
    "isDraftAi" BOOLEAN NOT NULL DEFAULT false,
    "radiologNama" TEXT,
    "tanggal" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
