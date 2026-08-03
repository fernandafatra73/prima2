-- CreateTable
CREATE TABLE "LaporanPajakBulanan" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "year" INTEGER NOT NULL,
    "bulan" INTEGER NOT NULL,
    "modul" TEXT NOT NULL DEFAULT 'RADIOLOGI',
    "harga" DECIMAL NOT NULL DEFAULT 0,
    "biayaSewaTempat" DECIMAL NOT NULL DEFAULT 0,
    "biayaListrikAir" DECIMAL NOT NULL DEFAULT 0,
    "gajiFernanda" DECIMAL NOT NULL DEFAULT 0,
    "gajiChalimatusadiah" DECIMAL NOT NULL DEFAULT 0,
    "gajiRiki" DECIMAL NOT NULL DEFAULT 0,
    "gajiAgung" DECIMAL NOT NULL DEFAULT 0,
    "gajiKaryawan1" DECIMAL NOT NULL DEFAULT 0,
    "gajiKaryawan2" DECIMAL NOT NULL DEFAULT 0,
    "bahanRoentgen" DECIMAL NOT NULL DEFAULT 0,
    "peralatanRoentgen" DECIMAL NOT NULL DEFAULT 0,
    "penyusutanManual" DECIMAL NOT NULL DEFAULT 0,
    "perbaikanAlat" DECIMAL NOT NULL DEFAULT 0,
    "hargaPeralatan" DECIMAL NOT NULL DEFAULT 0,
    "tarifPenyusutanTahunanPersen" DECIMAL NOT NULL DEFAULT 10,
    "piutangUsaha" DECIMAL NOT NULL DEFAULT 0,
    "perlengkapan" DECIMAL NOT NULL DEFAULT 0,
    "utangUsaha" DECIMAL NOT NULL DEFAULT 0,
    "modalAwalTahun" DECIMAL NOT NULL DEFAULT 0,
    "kasAwalTahun" DECIMAL NOT NULL DEFAULT 0,
    "akumulasiPenyusutanAwalTahun" DECIMAL NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "LaporanPajakBulanan_year_bulan_modul_key" ON "LaporanPajakBulanan"("year", "bulan", "modul");
