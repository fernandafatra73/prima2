-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_JenisPemeriksaan" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "nama" TEXT NOT NULL,
    "jumlahFilm" INTEGER NOT NULL DEFAULT 1,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_JenisPemeriksaan" ("createdAt", "id", "nama", "updatedAt") SELECT "createdAt", "id", "nama", "updatedAt" FROM "JenisPemeriksaan";
DROP TABLE "JenisPemeriksaan";
ALTER TABLE "new_JenisPemeriksaan" RENAME TO "JenisPemeriksaan";
CREATE UNIQUE INDEX "JenisPemeriksaan_nama_key" ON "JenisPemeriksaan"("nama");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
