-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_LaporanNeraca" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "year" INTEGER NOT NULL,
    "modul" TEXT NOT NULL DEFAULT 'RADIOLOGI',
    "namaPerusahaan" TEXT NOT NULL DEFAULT 'CV. PRIMA MANDIRI NUSANTARA',
    "kas" DECIMAL NOT NULL DEFAULT 0,
    "bank" DECIMAL NOT NULL DEFAULT 0,
    "piutang" DECIMAL NOT NULL DEFAULT 0,
    "persediaan" DECIMAL NOT NULL DEFAULT 0,
    "tanah" DECIMAL NOT NULL DEFAULT 0,
    "gedung" DECIMAL NOT NULL DEFAULT 0,
    "peralatan" DECIMAL NOT NULL DEFAULT 0,
    "kendaraan" DECIMAL NOT NULL DEFAULT 0,
    "utangUsaha" DECIMAL NOT NULL DEFAULT 0,
    "utangPajak" DECIMAL NOT NULL DEFAULT 0,
    "utangLainnya" DECIMAL NOT NULL DEFAULT 0,
    "utangJangkaPanjang" DECIMAL NOT NULL DEFAULT 0,
    "modalUsaha" DECIMAL NOT NULL DEFAULT 0,
    "pendapatan" DECIMAL NOT NULL DEFAULT 0,
    "biayaGaji" DECIMAL NOT NULL DEFAULT 0,
    "biayaAtkBahan" DECIMAL NOT NULL DEFAULT 0,
    "biayaListrik" DECIMAL NOT NULL DEFAULT 0,
    "biayaTelpon" DECIMAL NOT NULL DEFAULT 0,
    "biayaTransport" DECIMAL NOT NULL DEFAULT 0,
    "biayaSewa" DECIMAL NOT NULL DEFAULT 0,
    "biayaLainLain" DECIMAL NOT NULL DEFAULT 0,
    "tempatTandaTangan" TEXT NOT NULL DEFAULT 'Sukabumi',
    "tanggalTandaTangan" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "namaPenandatangan" TEXT NOT NULL DEFAULT '',
    "logoPerusahaanId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_LaporanNeraca" ("bank", "biayaAtkBahan", "biayaGaji", "biayaLainLain", "biayaListrik", "biayaSewa", "biayaTelpon", "biayaTransport", "createdAt", "gedung", "id", "kas", "kendaraan", "logoPerusahaanId", "modalUsaha", "namaPenandatangan", "namaPerusahaan", "pendapatan", "peralatan", "persediaan", "piutang", "tanah", "tanggalTandaTangan", "tempatTandaTangan", "updatedAt", "utangJangkaPanjang", "utangLainnya", "utangPajak", "utangUsaha", "year") SELECT "bank", "biayaAtkBahan", "biayaGaji", "biayaLainLain", "biayaListrik", "biayaSewa", "biayaTelpon", "biayaTransport", "createdAt", "gedung", "id", "kas", "kendaraan", "logoPerusahaanId", "modalUsaha", "namaPenandatangan", "namaPerusahaan", "pendapatan", "peralatan", "persediaan", "piutang", "tanah", "tanggalTandaTangan", "tempatTandaTangan", "updatedAt", "utangJangkaPanjang", "utangLainnya", "utangPajak", "utangUsaha", "year" FROM "LaporanNeraca";
DROP TABLE "LaporanNeraca";
ALTER TABLE "new_LaporanNeraca" RENAME TO "LaporanNeraca";
CREATE UNIQUE INDEX "LaporanNeraca_year_modul_key" ON "LaporanNeraca"("year", "modul");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
