# MATRIKS PERAN DAN HAK AKSES (RBAC) — VERTIKAL SMA JAWARA 28

Dokumen ini memenuhi **Deliverable 7 (Matriks Role dan Permission)** dan merinci mekanisme otorisasi *Least-Privilege* yang ditegakkan secara wajib di sisi backend oleh [`authentication.ts`](../server/src/middleware/authentication.ts) dan [`authorization.ts`](../server/src/middleware/authorization.ts).

---

## 1. Definisi Peran & Cakupan Data (Scope)

| Kode Peran (`roles.code`) | Nama Peran | Cakupan Data (`scope_type`) | Aturan Pembatasan Backend (`authorization.ts`) |
| :--- | :--- | :--- | :--- |
| **`SISWA`** | Siswa SMAN 28 Jakarta | `SELF` (`scope_id = student.id`) | Hanya boleh membaca dan menulis jurnal, riwayat 14 hari, cerita Aktivitas Seru, dan rapor milik `student_id` dirinya sendiri. Mengubah parameter URL/body ke `student_id` siswa lain otomatis ditolak dengan **`403 Forbidden` (IDOR Protection)**. |
| **`GURU_WALAS`** | Guru Wali Kelas | `CLASS` (`scope_id = class.name`) | Hanya boleh mengakses analitik kelas, daftar siswa, rapor siswa, serta menulis catatan & rekomendasi wali kelas untuk siswa di kelas binaannya (`assignedClassNames`). Mengakses kelas lain otomatis ditolak dengan **`403 Forbidden`**. |
| **`GURU_WALI`** | Guru Wali (Pendamping Rombel) | `ROMBEL` (`scope_id = rombel.name`) | Hanya boleh mengakses analitik rombel lintas kelas dan memantau perkembangan siswa yang terdaftar pada rombel binaannya (`assignedRombelNames`). Mengakses rombel lain otomatis ditolak dengan **`403 Forbidden`**. |
| **`TIM_7_KAIH`** | Koordinator / Tim 7 KAIH | `SCHOOL` | Memiliki akses pemantauan tingkat sekolah & angkatan, validasi skor verifikasi rapor (`1..5` bintang), pengelolaan jadwal kebiasaan, dan koreksi nilai jurnal terkontrol dengan alasan wajib. |
| **`SUPER_ADMIN`** | Super Admin / Tata Usaha | `GLOBAL` | Memiliki otorisasi penuh atas Control Panel Admin (`/admin`): manajemen akun siswa & guru, impor CSV, tahun ajaran, kelas, rombel, mutasi penempatan, koreksi data ber-audit, dan pengaturan sistem. |

> **Dukungan Multi-Role**: Tabel `user_roles` mendukung satu akun guru memegang beberapa peran sekaligus (misalnya `GURU_WALAS` pada `XI-MIPA-1` sekaligus `GURU_WALI` pada `Rombel Sains & Riset A` melalui `assignment_type = 'BOTH'`).

---

## 2. Matriks Permission terhadap Fitur & Endpoint

| Kode Permission (`permissions.code`) | Deskripsi | `SISWA` | `GURU_WALAS` | `GURU_WALI` | `TIM_7_KAIH` | `SUPER_ADMIN` |
| :--- | :--- | :-: | :-: | :-: | :-: | :-: |
| `journal:read:self` | Membaca jurnal & kalender 14 hari milik sendiri | **YA** (`SELF`) | **YA** (`CLASS`) | **YA** (`ROMBEL`) | **YA** (`SCHOOL`) | **YA** (`GLOBAL`) |
| `journal:write:self` | Mengisi formulir 7 kebiasaan & Aktivitas Seru | **YA** (`SELF`) | TIDAK | TIDAK | TIDAK | **YA** |
| `report:read:self` | Membaca Rapor Karakter 7 KAIH individu | **YA** (`SELF`) | **YA** (`CLASS`) | **YA** (`ROMBEL`) | **YA** (`SCHOOL`) | **YA** (`GLOBAL`) |
| `analytics:read:class` | Membaca analitik & monitoring kelas | TIDAK | **YA** (`CLASS`) | TIDAK | **YA** (`SCHOOL`) | **YA** (`GLOBAL`) |
| `report:write:walas_notes` | Menulis catatan & rekomendasi Wali Kelas di rapor | TIDAK | **YA** (`CLASS`) | TIDAK | **YA** | **YA** |
| `analytics:read:rombel` | Membaca analitik & tren 14 hari rombel binaan | TIDAK | TIDAK | **YA** (`ROMBEL`) | **YA** (`SCHOOL`) | **YA** (`GLOBAL`) |
| `analytics:read:school` | Membaca analitik tingkat sekolah & angkatan | Publik | **YA** | **YA** | **YA** | **YA** |
| `validation:write:school` | Memberikan skor verifikasi rapor (`1..5`) | TIDAK | TIDAK | TIDAK | **YA** | **YA** |
| `journal:correct:audit` | Mengoreksi nilai jurnal terkunci dengan alasan wajib | TIDAK | TIDAK | TIDAK | **YA** | **YA** |
| `admin:manage:users` | Membuat, mengubah, menonaktifkan, mengarsipkan & impor akun | TIDAK | TIDAK | TIDAK | TIDAK | **YA** |
| `admin:manage:structure` | Mengelola kelas, rombel & mutasi penempatan siswa | TIDAK | TIDAK | TIDAK | TIDAK | **YA** |
| `admin:manage:settings` | Mengubah jadwal ibadah, widget dashboard & pengaturan | TIDAK | TIDAK | TIDAK | **YA** | **YA** |
