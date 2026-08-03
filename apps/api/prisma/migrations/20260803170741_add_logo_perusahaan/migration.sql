-- CreateTable
CREATE TABLE "LogoPerusahaan" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "namaKlinik" TEXT NOT NULL,
    "logoTandaTangan" TEXT,
    "logoPerusahaan" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
