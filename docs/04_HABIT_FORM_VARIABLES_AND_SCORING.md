# PEMETAAN VARIABEL FORMULIR 7 KEBIASAAN DAN ATURAN PENILAIAN — VERTIKAL SMA JAWARA 28

Dokumen ini memenuhi **Deliverable 8 (Pemetaan Variabel Formulir 7 Kebiasaan ke Tabel Database)** dan **Deliverable 9 (Spesifikasi Perhitungan Nilai, Poin, Streak, Event, dan Leaderboard)** berdasarkan implementasi nyata pada [`scoring.service.ts`](../server/src/modules/scoring/scoring.service.ts), [`points.service.ts`](../server/src/modules/points/points.service.ts), dan [`streaks.service.ts`](../server/src/modules/streaks/streaks.service.ts).

---

## 1. Aturan Umum Penilaian (Spesifikasi Final 7 KAIH)

1. **Empat Jenis Mode Pengisian (`habit_entries.entry_mode`)**:
   - `TEPAT_HARI`: Pengisian jurnal hari berjalan pada rentang jadwal sesi.
   - `TEPAT_HARI_FLEKSIBEL`: Pengisian jurnal hari berjalan kapan saja sebelum pukul `00.00`.
   - `TEPAT_HARI_TIMESTAMP`: Sistem mencatat waktu aktual penyimpanan (`submitted_at`).
   - `FORMULIR_TERLEWAT`: Melengkapi jurnal tanggal sebelumnya melalui menu riwayat pengisian.
2. **Tanpa Penalti `-5` Poin (`no_missed_penalty = true`)**:
   - Tidak ada pengurangan nilai 5 poin karena mengisi secara fleksibel ataupun menggunakan Formulir Terlewat.
3. **Empat Status Kartu (`habit_entries.card_status` & `journals.journal_status`)**:
   - `BELUM_DIMULAI`, `SEDANG_DIISI`, `SELESAI`, `BELUM_DIISI_TERLEWAT`.
   - Kartu yang sudah berstatus `SELESAI` otomatis terkunci (`is_locked = 1`) dan menolak pengiriman ulang kecuali dikoreksi secara terkontrol oleh Admin/Tim 7 KAIH.
4. **Aturan Panjang Deskripsi**:
   - Batas minimum deskripsi adalah **10 karakter**.
   - Deskripsi **lebih dari 15 karakter** (`> 15`) memperoleh nilai komponen deskripsi maksimal; deskripsi `10–15` karakter memperoleh nilai parsial.

---

## 2. Pemetaan Variabel Formulir 7 Kebiasaan ke Tabel Relasional

### Kebiasaan 1: Bangun Pagi (`habit_code = 'bangun'`)

| Variabel Input (`payload`) | Tipe Data | Tabel & Kolom Tujuan | Komponen (`habit_components.component_key`) | Aturan Skor Otoritatif (Maks 100) |
| :--- | :--- | :--- | :--- | :--- |
| `jamBangun` / `wakeTime` | `TIME (HH:mm)` | `habit_components.component_value` | `waktu_bangun` (Maks **70**) | `03:00–05:00` = **70**, `05:01–06:00` = **50**, `06:01–07:00` = **30**, `> 07:00` = **10** |
| `merapikanTempatTidur` | `BOOLEAN` | `habit_components.component_value` | `kerapian_tempat_tidur` (Maks **15**) | `true` (Ya) = **15**, `false` (Tidak) = **0** |
| `kebugaranLevel` | `INTEGER (1..5)` | `habit_components.component_value` | `kebugaran` (Maks **15**) | `1` = **3**, `2` = **6**, `3` = **9**, `4` = **12**, `5` = **15** |
| `deskripsi` | `TEXT` | `habit_entries.description_text` | Catatan tambahan | Disimpan beserta `description_length` |

---

### Kebiasaan 2: Beribadah (`habit_code = 'ibadah'`)

#### A. Siswa/Siswi Islam — Mode Normal (5 Waktu: `subuh`, `zuhur`, `asar`, `magrib`, `isya`)

| Variabel Input (`payload`) | Tipe Data | Tabel & Kolom Tujuan | Komponen (`habit_components.component_key`) | Aturan Skor Otoritatif (Maks 35/sesi -> Normalisasi 100) |
| :--- | :--- | :--- | :--- | :--- |
| `waktuSholat` / `sub_category` | `ENUM` | `habit_sessions.session_code` | Sesi: `subuh`, `zuhur`, `asar`, `magrib`, `isya` | 5 sesi harian (`175` poin mentah total = `100` nilai capaian) |
| `caraPelaksanaan` | `ENUM` | `habit_components.component_value` | `<sesi>_cara` (Maks **25**) | `jamaah` / `Berjamaah` = **25**, `munfarid` / `Sendiri` = **15**, Tidak salat = **0** |
| `waktuPelaksanaan` | `ENUM` | `habit_components.component_value` | `<sesi>_waktu` (Maks **10**) | `awal` / `Tepat Waktu` = **10**, `akhir` = **5**, `qadha` = **2.5** |

#### B. Siswi Muslimah — Mode "Sedang Berhalangan" (`isHalangan = true`, `session_code = 'halangan'`)

| Variabel Input (`payload`) | Tipe Data | Tabel & Kolom Tujuan | Komponen (`habit_components.component_key`) | Aturan Skor Otoritatif (Maks 100) |
| :--- | :--- | :--- | :--- | :--- |
| `isHalangan` | `BOOLEAN` | `habit_sessions.session_status = 'HALANGAN'` | Penanda sesi khusus halangan | Menggantikan 5 sesi salat tanpa duplikasi skor |
| `aktivitasPengganti` | `ARRAY<STRING>` | `habit_components.component_value` | `ibadah_halangan_aktivitas` (Maks **75**) | Checkbox aktivitas tetap (Zikir, Kajian, Selawat, Sedekah, Tafsir): `@ 25` poin (maks 3 dihitung = **75**) |
| `refleksi` / `deskripsi` | `TEXT` | `habit_entries.description_text` | `ibadah_halangan_refleksi` (Maks **25**) | `> 15` karakter = **25**, `10–15` karakter = **15** |

#### C. Siswa Kristen, Katolik, Hindu, Buddha, Konghucu

| Variabel Input (`payload`) | Tipe Data | Tabel & Kolom Tujuan | Komponen (`habit_components.component_key`) | Aturan Skor Otoritatif (Maks 100) |
| :--- | :--- | :--- | :--- | :--- |
| `activities` / `kegiatanIbadah` | `ARRAY<STRING>` | `habit_components.component_value` | `ibadah_pokok` (Maks **75**) | Saat Teduh / Baca Alkitab / Tri Sandhya Pagi-Siang-Sore / Puja Bakti = **75** |
| `refleksi` / `sandhyaNote` | `TEXT` | `habit_entries.description_text` | `ibadah_refleksi` (Maks **25**) | `> 15` karakter = **25**, `10–15` karakter = **15** |

---

### Kebiasaan 3: Berolahraga (`habit_code = 'olahraga'`)

| Variabel Input (`payload`) | Tipe Data | Tabel & Kolom Tujuan | Komponen (`habit_components.component_key`) | Aturan Skor Otoritatif (Maks 100) |
| :--- | :--- | :--- | :--- | :--- |
| `durasi` / `duration` | `INTEGER` (menit) | `habit_components.component_value` | `durasi_olahraga` (Maks **60**) | `>= 30` mnt = **60**, `20–29` mnt = **45**, `15–19` mnt = **30**, `1–14` mnt = **15** |
| `intensitas` / `intensity` | `ENUM` | `habit_components.component_value` | `intensitas_olahraga` (Maks **20**) | `berat` / `sedang` = **20**, `ringan` = **15** |
| `catatanOlahraga` / `deskripsi` | `TEXT` | `habit_entries.description_text` | `deskripsi_olahraga` (Maks **20**) | `> 15` karakter = **20**, `10–15` karakter = **15** |

---

### Kebiasaan 4: Makan Sehat & Bergizi (`habit_code = 'makan'`)

| Variabel Input (`payload`) | Tipe Data | Tabel & Kolom Tujuan | Komponen (`habit_components.component_key`) | Aturan Skor Otoritatif (Maks 100 per sesi; 3 sesi/hari) |
| :--- | :--- | :--- | :--- | :--- |
| `waktuMakan` / `sub_category` | `ENUM` | `habit_sessions.session_code` | Sesi: `pagi`, `siang`, `malam` | Rata-rata 3 sesi membentuk skor harian `makan` |
| `isPuasa` | `BOOLEAN` | `habit_sessions.session_status = 'PUASA'` | `makan_puasa` (Maks **100**) | Jika `isPuasa = true`, sesi bernilai **100** |
| `karbohidrat`, `protein`, `sayur`, `buah`, `gelasAir` | `OBJECT / STRING` | `habit_components.component_value` | `karbohidrat` (**25**), `protein` (**25**), `sayur` (**20**), `buah` (**15**), `minum_air` (**15**) | Komposisi lengkap 4 sehat 5 sempurna + air putih = **100** |

---

### Kebiasaan 5: Gemar Belajar (`habit_code = 'belajar'`)

| Variabel Input (`payload`) | Tipe Data | Tabel & Kolom Tujuan | Komponen (`habit_components.component_key`) | Aturan Skor Otoritatif (Maks 100) |
| :--- | :--- | :--- | :--- | :--- |
| `durasi` / `duration` | `INTEGER` (menit) | `habit_components.component_value` | `durasi_belajar` (Maks **50**) | `>= 60` mnt = **50**, `45–59` = **40**, `30–44` = **30**, `15–29` = **20**, `< 15` = **10** |
| `materi` / `mataPelajaran` | `STRING` | `habit_components.component_value` | `materi_belajar` (Maks **25**) | Topik/buku/mata pelajaran terisi = **25** |
| `ringkasanMateri` / `deskripsi` | `TEXT` | `habit_entries.description_text` | `ringkasan_belajar` (Maks **25**) | `> 15` karakter = **25**, `10–15` karakter = **15** |

---

### Kebiasaan 6: Bermasyarakat (`habit_code = 'masyarakat'`)

| Variabel Input (`payload`) | Tipe Data | Tabel & Kolom Tujuan | Komponen (`habit_components.component_key`) | Aturan Skor Otoritatif (Maks 100) |
| :--- | :--- | :--- | :--- | :--- |
| `peran` / `role` | `ENUM` | `habit_components.component_value` | `peran_sosial` (Maks **50**) | `Inisiator` / `Penggerak` = **50**, `Peserta Aktif` = **40**, `Pendukung` = **30** |
| `jenisKegiatan` | `STRING` | `habit_components.component_value` | `jenis_kegiatan_sosial` (Maks **25**) | Pilihan kegiatan sosial tetap = **25** |
| `dampakSosial` / `deskripsi` | `TEXT` | `habit_entries.description_text` | `deskripsi_sosial` (Maks **25**) | `> 15` karakter = **25**, `10–15` karakter = **15** |

---

### Kebiasaan 7: Tidur Cepat (`habit_code = 'tidur'`)

| Variabel Input (`payload`) | Tipe Data | Tabel & Kolom Tujuan | Komponen (`habit_components.component_key`) | Aturan Skor Otoritatif (Maks 100) |
| :--- | :--- | :--- | :--- | :--- |
| `jamTidur` / `sleepTime` | `TIME (HH:mm)` | `habit_components.component_value` | `waktu_tidur` (Maks **75**) | `20:00–22:00` = **75**, `22:01–23:00` = **50**, `> 23:00` = **25** |
| `matikanGawai` & `berdoaSebelumTidur` | `BOOLEAN` | `habit_components.component_value` | `persiapan_tidur` (Maks **25**) | Keduanya `true` = **25**, salah satu `true` = **15**, keduanya `false` = **0** |

---

## 3. Spesifikasi Rumus Bonus Aktivitas Seru (+10 Poin), Cap 100 & Overflow Poin Hebat

Ketika siswa mengirimkan cerita **Aktivitas Seru** (`POST /api/aktivitas-seru`, minimal 15 karakter) untuk suatu kebiasaan pada tanggal $d$:
1. Sistem memberikan `bonus_awarded = 10` poin.
2. Nilai gabungan dihitung:
   $$\text{TotalRaw} = \text{base\_score} + 10$$
3. **Nilai Capaian Kebiasaan (`final_score`)** dibatasi maksimal **100**:
   $$\text{final\_score} = \min(100, \text{TotalRaw})$$
4. **Kelebihan Poin (`overflow_bonus_points`)** di atas 100 dialihkan ke **Poin Hebat**:
   $$\text{overflow\_bonus\_points} = \max(0, \text{TotalRaw} - 100)$$
5. Sistem mencatat mutasi ke tabel `point_transactions` (`point_bucket = 'POIN_HEBAT'`, `source_type = 'EVENT_OVERFLOW'`) secara idempoten dengan constraint `UNIQUE(student_id, point_bucket, source_type, source_id)`.
