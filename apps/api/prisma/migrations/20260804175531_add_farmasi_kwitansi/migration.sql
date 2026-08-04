-- CreateTable
CREATE TABLE "FarmasiKwitansi" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "noKwitansi" TEXT NOT NULL,
    "namaPasien" TEXT NOT NULL,
    "tanggal" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "paymentStatus" TEXT NOT NULL DEFAULT 'LUNAS',
    "petugasKasir" TEXT,
    "totalHarga" DECIMAL NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "FarmasiKwitansiItem" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "kwitansiId" TEXT NOT NULL,
    "farmasiBhpId" TEXT NOT NULL,
    "namaSnapshot" TEXT NOT NULL,
    "qty" INTEGER NOT NULL,
    "hargaSatuan" DECIMAL NOT NULL,
    "subtotal" DECIMAL NOT NULL,
    CONSTRAINT "FarmasiKwitansiItem_kwitansiId_fkey" FOREIGN KEY ("kwitansiId") REFERENCES "FarmasiKwitansi" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "FarmasiKwitansiItem_farmasiBhpId_fkey" FOREIGN KEY ("farmasiBhpId") REFERENCES "FarmasiBhp" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "FarmasiKwitansi_noKwitansi_key" ON "FarmasiKwitansi"("noKwitansi");
