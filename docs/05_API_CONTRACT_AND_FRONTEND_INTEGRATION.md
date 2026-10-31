# DOKUMENTASI REST API CONTRACT & PANDUAN INTEGRASI FRONTEND — VERTIKAL SMA JAWARA 28

Dokumen ini memenuhi **Deliverable 6 (Dokumentasi Kontrak API Lengkap)** dan **Deliverable 18 (Panduan Integrasi untuk Tahap Frontend Berikutnya)**.

---

## 1. Standar Autentikasi & Format Respons

- **Header Autentikasi**: Seluruh endpoint terproteksi mewajibkan header:
  ```http
  Authorization: Bearer jwr28_<64-hex-token>
  Content-Type: application/json
  ```
- **Format Error Standar** ([`error-handler.ts`](../server/src/middleware/error-handler.ts)):
  ```json
  {
    "status": "error",
    "code": "VALIDATION_ERROR | UNAUTHORIZED | FORBIDDEN | NOT_FOUND | CONFLICT",
    "error": "Pesan penjelasan yang aman tanpa mengekspos stack trace atau kredensial"
  }
  ```

---

## 2. Daftar Lengkap Endpoint REST API

### A. Autentikasi & Sesi

| Method & URL | Role / Scope | Request Body / Query | Response Sukses (`200 OK`) | Status Error | Efek Database |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `POST /api/login` | Publik (Siswa / Guru) | `{ "role": "siswa" \| "guru", "username": "siswa", "password": "123" }` | `{ "status": "ok", "role": "siswa", "active_role": "SISWA", "token": "jwr28_...", "expires_at": "...", "data": { ... } }` | `400`, `401`, `403` | Verifikasi `scrypt` di `users`, insert `sessions`, insert `audit_logs` |
| `POST /api/admin/login` | Publik (`/admin`) | `{ "username": "admin", "password": "123" }` | `{ "status": "ok", "role": "admin", "active_role": "SUPER_ADMIN", "token": "jwr28_...", "data": { ... } }` | `400`, `401`, `403` | Verifikasi role `SUPER_ADMIN` / `TIM_7_KAIH`, insert `sessions` & `audit_logs` |
| `POST /api/logout` | Terautentikasi | Header `Authorization: Bearer ...` | `{ "status": "ok" }` | `200` | Update `sessions.revoked_at = now()` |
| `GET /api/auth/me` | Terautentikasi | Header `Authorization: Bearer ...` | `{ "status": "ok", "session": { "userId", "roles", "permissions", "studentId", ... } }` | `401`, `403` | Baca `sessions`, `users`, `user_roles`, `role_permissions` |

---

### B. Jurnal Harian, 7 Kebiasaan & Aktivitas Seru

| Method & URL | Role / Scope | Request Body / Query | Response Sukses (`200 OK`) | Status Error | Efek Database |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `GET /api/habits/today` | `SISWA` (`SELF`), `GURU_WALAS` (`CLASS`), `GURU_WALI` (`ROMBEL`), `TIM_7_KAIH`, `SUPER_ADMIN` | `?student_id=std-siswa&date=2026-10-27` | `{ "date", "student_id", "logs": [...], "habitsByType": {...}, "totalToday": 7, "dailyEval": {...}, "aktivitasSeru": {...} }` | `401`, `403`, `404` | Baca `habit_entries`, `event_bonuses`, evaluasi 7 kebiasaan |
| `POST /api/habits` | `SISWA` (`SELF`) / `SUPER_ADMIN` | `{ "student_id": "std-siswa", "habit_type": "bangun", "log_date": "2026-10-27", "sub_category": "", "payload": { ... } }` | `{ "status": "ok", "entry_id": 11, "base_score": 100, "bonus_score": 0, "final_score": 100, "overflow_bonus_points": 0, "student": {...} }` | `400`, `401`, `403`, `409` (Locked) | Transaksi atomik: upsert `journals`, insert/update `habit_entries`, `habit_sessions`, `habit_components`, `habit_entry_revisions`, `point_transactions`, `streak_records`, `students` |
| `DELETE /api/habits/reset` | `SISWA` (`SELF`) / `SUPER_ADMIN` | `?student_id=std-siswa&habit_type=bangun&date=2026-10-27` | `{ "status": "ok", "student_id", "habit_type", "date" }` | `401`, `403` | Hapus `habit_entries` terkait, rekalkulasi `journals` & `students`, catat `audit_logs` |
| `GET /api/habits/calendar-summary` | `SISWA` (`SELF`), Pendidik berwenang | `?student_id=std-siswa&days=14` | `{ "student_id", "hasAnyMissed": true, "dates": [ { "date", "completedCount", "overallDayStatus", "habitStatuses", "dailyScore", "scoresByHabit" } ] }` | `401`, `403` | Baca `habit_entries` 14 hari terakhir |
| `GET /api/student/:id/progress` | `SISWA` (`SELF`), Pendidik berwenang | `?days=14` | `{ "student_id", "days": 14, "series": [ { "date", "bangun", "ibadah", ..., "rataRata", "status" } ] }` | `401`, `403` | Agregasi deret waktu harian 7 kebiasaan |
| `POST /api/aktivitas-seru` | `SISWA` (`SELF`) | `{ "student_id": "std-siswa", "habit_type": "olahraga", "story": "Minimal 15 karakter...", "log_date": "2026-10-27" }` | `{ "status": "ok", "bonus_awarded": 10, "applied_to_habit_score": 5, "overflow_points": 5, "entry": {...} }` | `400`, `401`, `403` | Upsert `event_bonuses`, update `habit_entries` (cap 100), insert `point_transactions` (`POIN_HEBAT`) |

---

### C. Rapor Individu, Analitik Kelas, Analitik Rombel, Analitik Sekolah & Leaderboard

| Method & URL | Role / Scope | Request Body / Query | Response Sukses (`200 OK`) | Status Error | Efek Database |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `GET /api/student/:id/report` | `SISWA` (`SELF`), `GURU_WALAS` (`CLASS`), `GURU_WALI` (`ROMBEL`), `TIM_7_KAIH`, `SUPER_ADMIN` | Path `:id` | `{ "student", "habitMetrics": [ { "habit", "studentScore", "classAvg", "schoolAvg", "count" } ], "overallScore", "poinHebat", "streak", "activeDays", "verification_score", "recentLogs" }` | `401`, `403`, `404` | Agregasi perbandingan nilai siswa vs rata-rata kelas vs rata-rata sekolah |
| `GET /api/class/:className/analytics` | `GURU_WALAS` (`CLASS` miliknya), `TIM_7_KAIH`, `SUPER_ADMIN` | `?date=2026-10-27` | `{ "className", "totalStudents", "participatingToday", "participationRate", "statusSummary", "habitAverages", "students": [...] }` | `401`, `403` | Bulk SQL agregasi siswa per kelas |
| `POST /api/teacher/notes` | `GURU_WALAS` (`CLASS` miliknya), `SUPER_ADMIN` | `{ "student_id": "std-siswa", "walas_notes": "...", "walas_recommendation": "..." }` | `{ "status": "ok", "student_id": "std-siswa" }` | `401`, `403` | Update `students.walas_notes` & `walas_recommendation`, insert `audit_logs` |
| `GET /api/rombel/:rombelName/analytics` | `GURU_WALI` (`ROMBEL` miliknya), `TIM_7_KAIH`, `SUPER_ADMIN` | `?days=14` | `{ "rombelName", "totalStudents", "participatingToday", "participationRate", "habitAverages", "dailyTrend": [...], "students": [...] }` | `401`, `403` | Bulk SQL agregasi lintas kelas per rombel + tren 14 hari |
| `GET /api/school/analytics` | Publik / Pendidik | - | `{ "totalStudents", "participatingStudents", "schoolParticipationRate", "totalEntries", "habitAverages", "predicateDistribution", "leaderboard", "classes", "rombels", "cohorts" }` | `200` | Index-only scan agregasi seluruh sekolah & per angkatan (`X`, `XI`, `XII`) |
| `GET /api/leaderboard` | Publik / Terautentikasi | `?period=ALL_TIME\|MONTHLY\|WEEKLY\|DAILY&scope=SCHOOL\|CLASS\|ROMBEL&limit=50` | `[ { "rank", "id", "name", "class_name", "rombel_name", "xp", "poin_hebat", "streak", "period_avg_score" } ]` | `200` | Peringkat siswa berdasarkan periode & cakupan |

---

### D. Control Panel Admin (`/admin`) & Tim 7 KAIH

| Method & URL | Role / Scope | Fungsi & Efek Database |
| :--- | :--- | :--- |
| `GET /api/admin/overview` | `SUPER_ADMIN`, `TIM_7_KAIH` | Ringkasan jumlah siswa aktif/arsip, guru, kelas, rombel, entri jurnal, dan koreksi data. |
| `POST /api/admin/students` | `SUPER_ADMIN` | Buat/update akun siswa (`users` dengan hash `scrypt`, `user_roles`, `students`, `student_class_memberships`, `student_rombel_memberships`, `audit_logs`). |
| `DELETE /api/admin/students/:id` | `SUPER_ADMIN` | Mode `ARCHIVE` / `INACTIVE` / `DELETE`; mencabut sesi aktif otomatis saat dinonaktifkan dan mencatat `audit_logs`. |
| `POST /api/admin/import-students` | `SUPER_ADMIN` | Impor massal daftar siswa beserta pembuatan keanggotaan kelas & rombel. |
| `POST /api/admin/teachers` | `SUPER_ADMIN` | Buat/update akun guru (`WALAS`, `GURU_WALI`, `BOTH`, `TIM_7_KAIH`, `ADMIN`) beserta `user_roles` & `teacher_assignments`. |
| `POST /api/admin/move-student-group` | `SUPER_ADMIN` | Mutasi kelas/rombel siswa secara non-destruktif (menutup membership lama `is_current=0` dan membuat membership baru `is_current=1` tanpa menghapus histori jurnal). |
| `GET /api/admin/journals` | `SUPER_ADMIN`, `TIM_7_KAIH` | Filter entri jurnal berdasarkan siswa, kelas, rombel, kebiasaan, dan rentang tanggal beserta daftar `data_corrections`. |
| `POST /api/admin/journals/correct` | `SUPER_ADMIN`, `TIM_7_KAIH` | Koreksi nilai jurnal terkontrol (wajib `reason` >= 5 karakter), mencatat ke `data_corrections`, `habit_entry_revisions`, dan `audit_logs`. |
| `POST /api/admin/validate` | `SUPER_ADMIN`, `TIM_7_KAIH` | Menyimpan skor verifikasi rapor (`1..5`) ke `admin_validations` & `audit_logs`. |
| `POST /api/admin/settings` | `SUPER_ADMIN`, `TIM_7_KAIH` | Menyimpan pengaturan global & jadwal waktu salat (`app_settings`). |
| `GET /api/admin/audit-logs` | `SUPER_ADMIN` | Membaca jejak audit sistem (`audit_logs`). |

---

## 3. Panduan Integrasi untuk Tahap Frontend Berikutnya (Deliverable 18)

1. **Pengelolaan Token Sesi**:
   - [`src/utils/api.ts`](../src/utils/api.ts) sudah menyediakan `api.setAuthToken(token)` dan `api.clearAuthToken()`.
   - Setiap metode pada `api.*` secara otomatis menyertakan header `Authorization: Bearer <token>` dari `localStorage` (`jawara28_auth_token`).
2. **Kontrak Data Kompatibel 100%**:
   - Seluruh nama properti JSON yang dikonsumsi oleh komponen React yang ada (`StudentDashboard.tsx`, `TeacherDashboard.tsx`, `AdminDashboard.tsx`, `PublicDashboard.tsx`, `StudentReportModal.tsx`) dipertahankan sepenuhnya sekaligus diperkaya dengan metadata relasional baru (`entry_uuid`, `journal_id`, `card_status`, `entry_mode`, `base_score`, `bonus_score`, `final_score`, `overflow_bonus_points`).
3. **Penanganan Error Otorisasi & Kartu Terkunci di UI**:
   - Jika backend mengembalikan `401 Unauthorized`, arahkan pengguna kembali ke halaman Login dan panggil `api.clearAuthToken()`.
   - Jika backend mengembalikan `409 Conflict` saat pengiriman kebiasaan, tampilkan pesan bahwa kartu kebiasaan tersebut sudah berstatus **SELESAI dan terkunci**.
