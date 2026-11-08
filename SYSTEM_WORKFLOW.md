# Alur Kerja Sistem

Dokumen ini menjelaskan alur kerja `mentari.mjs` saat dijalankan. Script membantu memeriksa dan mengarsipkan informasi; aktivitas akademik seperti Pretest, Posttest, Kuesioner, Penugasan, dan Forum Diskusi tetap dilakukan secara manual.

## Diagram alur

```mermaid
flowchart TD
    A[Mulai] --> B[Muat config.json dan progres _progress.json]
    B --> C{Mode login?}
    C -- Ya --> D[Buka Mentari di Chrome]
    D --> E[Pengguna login secara manual]
    E --> F[Tutup browser dan selesai]
    C -- Tidak --> G[Buka Chrome dengan profil tersimpan]
    G --> H{Masih login?}
    H -- Tidak --> I[Tulis instruksi login ulang ke laporan]
    I --> Z[Simpan laporan harian dan tutup browser]
    H -- Ya --> J[Pilih mata kuliah dan pertemuan berikutnya]
    J --> K[Buka kursus dan halaman pertemuan]
    K --> L{Mode debug?}
    L -- Ya --> M[Simpan HTML halaman untuk pemeriksaan selector]
    L -- Tidak --> N[Periksa keberadaan dan status aktivitas]
    M --> N
    N --> O{Forum Diskusi terbuka?}
    O -- Tidak --> P[Catat status dan lewati pertemuan]
    P --> Q{Masih ada mata kuliah?}
    O -- Ya --> R[Buat folder pertemuan]
    R --> S[Unduh materi yang dikonfigurasi]
    S --> T[Catat tautan materi dan tautan penting]
    T --> U[Ambil screenshot]
    U --> V[Perbarui progres pertemuan]
    V --> Q
    Q -- Ya --> J
    Q -- Tidak --> W[Tulis laporan harian]
    W --> X[Tutup browser]
    X --> Y[Selesai]
```

## Urutan proses

1. Script membaca `config.json` dan `_progress.json`. Jika berkas progres belum ada, pertemuan berikutnya dimulai dari `firstMeeting`.
2. Untuk login awal, jalankan `npm run login`, lalu masuk ke Mentari secara manual di jendela Chrome. Sesi disimpan di profil Chrome yang dikonfigurasi.
3. Saat berjalan normal, script membuka dashboard Mentari. Jika sesi sudah logout, script mencatat instruksi untuk menjalankan kembali mode login dan menghentikan pemrosesan kursus.
4. Untuk setiap mata kuliah, script memilih pertemuan setelah progres terakhir, membuka halaman kursus dan pertemuan, lalu mencatat keberadaan Pretest, Posttest, Kuesioner, Penugasan, dan Forum Diskusi.
5. Jika mode debug aktif (`npm run debug`), HTML halaman disimpan ke folder `debug/` untuk membantu pemeriksaan selector.
6. Jika Forum Diskusi terdeteksi terkunci atau tidak tersedia, pertemuan dicatat sebagai dilewati. Progres pertemuan tersebut tidak dimajukan, sehingga akan diperiksa kembali pada proses berikutnya.
7. Jika Forum Diskusi terdeteksi terbuka, script mengunduh item dari `materialItems`, mencatat tautan dari `linkItems`, mengambil screenshot, lalu memperbarui progres.
8. Script menyimpan ringkasan hasil ke `laporan_YYYY-MM-DD.md` dan menutup browser.

## Batasan dan pemeriksaan

- Script hanya memeriksa status aktivitas dan mengumpulkan materi/tautan yang dikonfigurasi. Script tidak menjawab, mengirim, atau mengerjakan aktivitas akademik.
- Deteksi status Forum Diskusi menggunakan heuristik terhadap elemen halaman. Periksa laporan dan gunakan mode debug jika hasilnya tidak sesuai.
- Jika terjadi error pada suatu mata kuliah, error dicatat dan pemrosesan dilanjutkan ke mata kuliah berikutnya; progres hanya diperbarui setelah alur pertemuan terbuka berhasil mencapai penyimpanan progres.
- Jangan menjalankan proses otomatis bersamaan agar berkas progres dan hasil tidak bertabrakan.
