-- CreateTable
CREATE TABLE "AplikasiTambahan" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "kodePasien" TEXT NOT NULL,
    "nama" TEXT NOT NULL,
    "umur" TEXT,
    "umurSatuan" TEXT DEFAULT 'Thn',
    "noTelp" TEXT,
    "alamat" TEXT,
    "pengirim" TEXT,
    "pemeriksaan" TEXT,
    "klinis" TEXT,
    "sharing" TEXT,
    "harga" DECIMAL NOT NULL DEFAULT 0,
    "kesan1" TEXT,
    "kesan2" TEXT,
    "kesan3" TEXT,
    "kesan4" TEXT,
    "staffTag" TEXT,
    "tanggal" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "AplikasiTambahan_kodePasien_key" ON "AplikasiTambahan"("kodePasien");
