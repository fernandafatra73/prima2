-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_AnalisaFotoRontgen" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "namaPasien" TEXT NOT NULL,
    "regCode" TEXT,
    "jenisPemeriksaan" TEXT,
    "tanggal" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "fotoDataUrl" TEXT NOT NULL,
    "ukuranFoto" TEXT NOT NULL DEFAULT '3 x 4 cm',
    "kesan" TEXT,
    "diagnosa" TEXT,
    "radiologNama" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_AnalisaFotoRontgen" ("createdAt", "diagnosa", "fotoDataUrl", "id", "jenisPemeriksaan", "kesan", "namaPasien", "radiologNama", "regCode", "tanggal", "updatedAt") SELECT "createdAt", "diagnosa", "fotoDataUrl", "id", "jenisPemeriksaan", "kesan", "namaPasien", "radiologNama", "regCode", "tanggal", "updatedAt" FROM "AnalisaFotoRontgen";
DROP TABLE "AnalisaFotoRontgen";
ALTER TABLE "new_AnalisaFotoRontgen" RENAME TO "AnalisaFotoRontgen";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
