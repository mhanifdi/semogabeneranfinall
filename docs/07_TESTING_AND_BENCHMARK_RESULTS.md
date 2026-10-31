# LAPORAN HASIL PENGUJIAN OTOMATIS & BENCHMARK PERFORMA 750 SISWA — VERTIKAL SMA JAWARA 28

Dokumen ini memenuhi **Deliverable 12 (Hasil Pengujian Otomatis dan Benchmark Performa)** yang dieksekusi secara nyata menggunakan [`server/src/tests/run-all-tests.ts`](../server/src/tests/run-all-tests.ts) pada runtime **Node.js v24.21.0 (`win32/x64`)**.

Laporan JSON mentah hasil eksekusi tersimpan di [`database/backups/test_and_benchmark_report.json`](../database/backups/test_and_benchmark_report.json).

---

## 1. Ringkasan Eksekusi Pengujian Fungsional, Keamanan & Integritas (24/24 LULUS)

Cara menjalankan seluruh pengujian otomatis:
```powershell
$env:ELECTRON_RUN_AS_NODE="1"; & "C:\Users\PLN\AppData\Local\Programs\Microsoft VS Code\Code.exe" server/src/tests/run-all-tests.ts 2>&1 | Out-Host
```

| Suite | Kode & Nama Pengujian | Status | Waktu (`ms`) |
| :--- | :--- | :-: | --: |
| **Suite A (Database)** | **A1.** Versioned migrations applied & all 35 relational tables exist | **PASS** | `0.56 ms` |
| **Suite A (Database)** | **A2.** Foreign key constraint rejects orphan `habit_entries` & memberships | **PASS** | `0.78 ms` |
| **Suite A (Database)** | **A3.** Unique constraints reject duplicate `NISN`, `NIP`, and `username` | **PASS** | `0.45 ms` |
| **Suite B (Auth & RBAC)** | **B1.** Cryptographic `scrypt` password hashing uses unique random 16-byte salt per call | **PASS** | `161.45 ms` |
| **Suite B (Auth & RBAC)** | **B2.** Valid login succeeds across all roles (`Siswa`, `Walas`, `Wali`, `Tim 7 KAIH`, `Admin`) | **PASS** | `230.86 ms` |
| **Suite B (Auth & RBAC)** | **B3.** Invalid login rejected (`401`) & non-admin blocked from `/api/admin/login` (`403`) | **PASS** | `97.27 ms` |
| **Suite B (Auth & RBAC)** | **B4.** Expired and revoked sessions are rejected with `401 Unauthorized` | **PASS** | `30.38 ms` |
| **Suite B (Auth & RBAC)** | **B5.** IDOR Protection: Siswa A cannot read or write Siswa B journal or report (`403`) | **PASS** | `6.36 ms` |
| **Suite B (Auth & RBAC)** | **B6.** Class Scope Protection: Guru Walas `XI-MIPA-1` blocked from `XI-MIPA-2` (`403`) | **PASS** | `3.93 ms` |
| **Suite B (Auth & RBAC)** | **B7.** Rombel Scope Protection: Guru Wali `Rombel A` blocked from `Rombel B` (`403`) | **PASS** | `4.19 ms` |
| **Suite B (Auth & RBAC)** | **B8.** Unauthenticated access to sensitive endpoints rejected with `401` | **PASS** | `0.30 ms` |
| **Suite C (Business Logic)** | **C1.** Valid Bangun Pagi submission computes exact score & stores 3 components | **PASS** | `8.06 ms` |
| **Suite C (Business Logic)** | **C2.** Duplicate submission to a completed/locked habit card is rejected (`409`) | **PASS** | `1.45 ms` |
| **Suite C (Business Logic)** | **C3.** Missed (`Formulir Terlewat`) submission has NO `-5` penalty per Final Spec | **PASS** | `4.57 ms` |
| **Suite C (Business Logic)** | **C4.** Female student Islam Halangan mode calculates `75 + 25 = 100` without double counting | **PASS** | `4.30 ms` |
| **Suite C (Business Logic)** | **C5.** Aktivitas Seru (`+10` bonus) caps habit score at `100` & routes overflow to `Poin Hebat` | **PASS** | `8.60 ms` |
| **Suite C (Business Logic)** | **C6.** Controlled Admin score correction requires reason & writes audit + revision logs | **PASS** | `6.72 ms` |
| **Suite D (Data Integrity)** | **D1.** Atomic transaction rolls back completely on mid-operation failure | **PASS** | `0.68 ms` |
| **Suite D (Data Integrity)** | **D2.** Completing all 7 habits on a date updates journal status to `SELESAI` & streak | **PASS** | `29.90 ms` |
| **Suite D (Data Integrity)** | **D3.** Moving student class & rombel preserves historical journals & records membership history | **PASS** | `4.53 ms` |
| **Suite D (Data Integrity)** | **D4.** Deactivating a student account revokes active sessions & blocks login while keeping history | **PASS** | `99.05 ms` |
| **Suite E (Analytics)** | **E1.** Individual Student Report matches exact SQL average of `habit_entries` | **PASS** | `2.22 ms` |
| **Suite E (Analytics)** | **E2.** Class Analytics, Rombel Analytics & School Analytics match source student counts | **PASS** | `5.63 ms` |
| **Suite F (Scale 750)** | **F1.** All 8 performance benchmark scenarios at 750-student scale execute within target SLAs | **PASS** | `0.80 ms` |

**Total**: **24 Pengujian — 24 LULUS (`100%`), 0 GAGAL.**

---

## 2. Hasil Benchmark Performa Skala Sekolah (750 Siswa Aktif & 52.220 Entri Kebiasaan)

### Parameter Beban Uji:
- **Jumlah Siswa Aktif**: **750 Siswa**
- **Jumlah Kelas**: **21 Kelas** (`X-MIPA-1..7`, `XI-MIPA-1..7`, `XII-MIPA-1..7`)
- **Jumlah Rombel Binaan**: **15 Rombel Lintas Kelas** (`Rombel Binaan 1..15`)
- **Jumlah Entri Kebiasaan (`habit_entries`)**: **52.220 baris** (10 hari × 7 kebiasaan × 746 siswa + data dasar)
- **Waktu Seeding 750 Siswa & 52.220 Entri**: **2.822 ms** (`2,82 detik`)

### Tabel Hasil Pengukuran Latensi & Throughput Nyata:

| No | Skenario Benchmark (Skala 750 Siswa) | Iterasi Uji | Rata-rata (`avg`) | Persentil 95 (`p95`) | Minimum (`min`) | Maksimum (`max`) | Throughput (`ops/sec`) |
| :-: | :--- | :-: | --: | --: | --: | --: | --: |
| 1 | **Login Autentikasi (`scrypt` KDF + Insert Sesi)** | 20 | **`36.91 ms`** | `58.26 ms` | `23.33 ms` | `58.26 ms` | `27.1 ops/sec` |
| 2 | **Pengisian Jurnal & Kebiasaan (Transaksi Relasional Penuh)** | 50 | **`3.08 ms`** | `4.04 ms` | `1.36 ms` | `52.93 ms` | `324.5 ops/sec` |
| 3 | **Pembacaan Riwayat Kalender 14 Hari Siswa** | 50 | **`0.66 ms`** | `1.06 ms` | `0.39 ms` | `5.72 ms` | `1.519.1 ops/sec` |
| 4 | **Pembacaan Dashboard Harian Siswa (`Today Journal`)** | 50 | **`0.16 ms`** | `0.24 ms` | `0.13 ms` | `0.53 ms` | `6.065.8 ops/sec` |
| 5 | **Pembacaan Analitik Kelas & Rombel (Guru Walas & Guru Wali)** | 30 | **`54.92 ms`** | `73.72 ms` | `33.97 ms` | `95.73 ms` | `18.2 ops/sec` |
| 6 | **Pembacaan Rapor Individu Siswa (Siswa vs Kelas vs Sekolah)** | 30 | **`18.90 ms`** | `28.04 ms` | `9.09 ms` | `29.76 ms` | `52.9 ops/sec` |
| 7 | **Pembacaan Leaderboard Sekolah (750 Siswa Aktif)** | 30 | **`1.12 ms`** | `3.12 ms` | `0.56 ms` | `3.17 ms` | `892.6 ops/sec` |
| 8 | **Pembacaan Analitik Sekolah & Angkatan (750 Siswa, 52.220 Entri)** | 20 | **`90.10 ms`** | `115.43 ms` | `74.33 ms` | `115.43 ms` | `11.1 ops/sec` |

### Penggunaan Memori Proses (`process.memoryUsage()`):
- **RSS (Resident Set Size)**: **`78.7 MB`**
- **Heap Used**: **`13.6 MB`** (dari `18.6 MB` Heap Total)
