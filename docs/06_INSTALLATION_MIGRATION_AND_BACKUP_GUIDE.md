# PANDUAN INSTALASI, MIGRASI DATABASE, ADMIN AWAL, SEEDING & BACKUP/RESTORE — VERTIKAL SMA JAWARA 28

Dokumen ini memenuhi **Deliverable 3, 10, 11, 13, dan 14** dari Master Prompt Reengineering Database & Backend.

---

## 1. Konfigurasi Environment (`server/src/config/env.ts`)

Sistem memisahkan konfigurasi `development`, `test`, dan `production` melalui variabel environment berikut:

| Variabel Environment | Nilai Default | Keterangan |
| :--- | :--- | :--- |
| `NODE_ENV` | `development` | Mode environment: `development` \| `test` \| `production` |
| `PORT` | `3000` | Port HTTP server |
| `DATABASE_URL` | *(kosong)* | Jika diisi `postgresql://user:pass@host:5432/jawara28`, sistem mengaktifkan dialek `postgresql` |
| `SQLITE_DB_PATH` | `database/jawara28_relational.db` | Lokasi file database relasional lokal (otomatis `database/test_jawara28.db` saat `NODE_ENV=test`) |
| `SESSION_TTL_HOURS` | `24` | Masa berlaku token sesi login (jam) |
| `SCRYPT_COST` | `4096` | Parameter beban memori/CPU `crypto.scryptSync` (`N`) |
| `ALLOW_DEMO_SEED` | `true` (dev) / `false` (prod) | Mengizinkan seeding data contoh pengembangan |
| `INITIAL_ADMIN_PASSWORD` | `123` (dev) | Password awal pembuatan akun Super Admin pada bootstrap pertama |

---

## 2. Cara Menjalankan Migrasi Database

### A. Migrasi pada PostgreSQL Produksi
Jalankan dua file migrasi SQL berurutan terhadap database PostgreSQL 15+:
```bash
psql "$DATABASE_URL" -f server/src/database/migrations/001_initial_postgresql_schema.sql
psql "$DATABASE_URL" -f server/src/database/migrations/002_views_and_analytics_indexes.sql
```

### B. Migrasi & Upgrade Data Lama (`database/local_habit.db` -> `database/jawara28_relational.db`)
Jalankan skrip migrasi otomatis yang sekaligus membuat salinan backup biner dan JSON:
```powershell
$env:ELECTRON_RUN_AS_NODE="1"; & "C:\Users\PLN\AppData\Local\Programs\Microsoft VS Code\Code.exe" server/src/database/backup-and-migrate-legacy.ts 2>&1 | Out-Host
```

---

## 3. Cara Membuat Akun Super Admin Awal & Menjalankan Seeding (`seed.ts`)

Skrip [`server/src/database/seed.ts`](../server/src/database/seed.ts) memisahkan antara **Bootstrap Produksi** dan **Seeding Pengembangan**:

1. **Mode Produksi (Hanya Membuat Katalog Referensi & Super Admin Awal)**:
   ```powershell
   $env:NODE_ENV="production"; $env:ALLOW_DEMO_SEED="false"; $env:INITIAL_ADMIN_PASSWORD="PasswordKuatAdmin28!"; $env:ELECTRON_RUN_AS_NODE="1"; & "C:\Users\PLN\AppData\Local\Programs\Microsoft VS Code\Code.exe" server/src/database/seed.ts 2>&1 | Out-Host
   ```
2. **Mode Pengembangan / Uji (Membuat Super Admin, Guru Walas, Guru Wali, Tim 7 KAIH, Kelas, Rombel & Siswa Uji)**:
   ```powershell
   $env:NODE_ENV="development"; $env:ELECTRON_RUN_AS_NODE="1"; & "C:\Users\PLN\AppData\Local\Programs\Microsoft VS Code\Code.exe" server/src/database/seed.ts 2>&1 | Out-Host
   ```

### Daftar Akun Hasil Migrasi & Seeding Pengembangan
Seluruh akun di bawah ini menggunakan password hash kriptografis **`scrypt`** dengan salt acak 16-byte:
- **Super Admin (`/admin`)**: username `admin` | password `123` (`Drs. H. Ubaidillah, M.M.`)
- **Guru Wali Kelas (`XI-MIPA-1`)**: username `guru` | password `123` (`Dra. Hj. Nurhidayah, M.Pd.`)
- **Guru Wali (`Rombel Sains & Riset A`)**: username `wali` | password `123` (`Bpk. Hendra Wijaya, S.Pd.`)
- **Koordinator Tim 7 KAIH**: username `tim7kaih` | password `123` (`Ibu Dra. Ratna Sari, M.Pd.`)
- **Siswa**:
  - `siswa` | password `123` (`Ahmad Fauzi` — Putra Islam, `XI-MIPA-1`, `Rombel Sains & Riset A`)
  - `siswai` | password `123` (`Siti Aisyah` — Putri Islam, mendukung mode *Sedang Berhalangan*)
  - `siswak` | password `123` (`Yohanes Christian` — Kristen, `Rombel Sosial & Humaniora B`)
  - `siswah` | password `123` (`Ni Putu Ayu Saraswati` — Hindu, `Rombel Teknologi & Inovasi C`)

---

## 4. Prosedur Backup & Restore Database (Deliverable 14)

### Lokasi File Backup yang Telah Diverifikasi
1. **Backup Biner Database Lama**: [`database/backups/local_habit_pre_reengineering_backup.db`](../database/backups/local_habit_pre_reengineering_backup.db)
   - **SHA-256 Checksum**: `e541eac4e50536b9683398211e4e81a4f3dd7bf7624698cc42f52c69d0ecf9ba`
2. **Dump JSON Lengkap Database Lama**: [`database/backups/local_habit_pre_reengineering_dump.json`](../database/backups/local_habit_pre_reengineering_dump.json)
3. **Laporan Hasil Migrasi & Penanganan Anomali**: [`database/backups/migration_report.json`](../database/backups/migration_report.json)

### Prosedur Restore Database
- **PostgreSQL**:
  ```bash
  pg_dump "$DATABASE_URL" --format=custom --file="database/backups/jawara28_pg_$(date +%Y%m%d).dump"
  pg_restore --clean --if-exists --dbname="$DATABASE_URL" "database/backups/jawara28_pg_YYYYMMDD.dump"
  ```
- **Mesin Relasional Lokal**:
  Salin kembali file backup ke lokasi target (`database/jawara28_relational.db`) atau jalankan ulang `backup-and-migrate-legacy.ts` untuk membangun ulang struktur relasional dari backup sumber.
