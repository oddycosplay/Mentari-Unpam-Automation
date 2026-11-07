# Script Mentari harian

Cek Forum Diskusi tiap matkul pada Pertemuan berikutnya (mulai 9). Kalau forum sudah terbuka: unduh Buku ISBN,
Power Point, Artikel Riset, Materi Lainnya, catat link Video Ajar dan LINK VCON, screenshot, lalu tulis laporan.
Kalau terkunci: matkul dilewati. Progres disimpan di `..\_progress.json`.

Script ini TIDAK mengerjakan Pretest, Posttest, Kuesioner, Penugasan, atau Forum Diskusi. Itu kamu kerjakan sendiri.

## Pemasangan (sekali)
1. Pasang Node.js 20+.
2. Di folder ini: `npm install`
3. `node mentari.mjs --login`  (Chrome terbuka, login ke Mentari manual, tekan Enter di terminal)

## Pemakaian
- `node mentari.mjs`        jalan normal, laporan ke `..\laporan_YYYY-MM-DD.md`
- `node mentari.mjs --debug` sama, plus simpan HTML ke `debug\` untuk kalibrasi selector

## Penting
Script ditulis tanpa bisa menguji langsung ke Mentari. Selector (kartu matkul, header "Pertemuan N", deteksi
forum terkunci, tombol unduh) memakai teks yang terlihat di layar. Jalankan dengan `--debug` dulu, perhatikan
hasil laporan, lalu sesuaikan fungsi `forumLocked` dan `grab` di `mentari.mjs` bila ada yang meleset.
Cek juga `dashboardUrl` di `config.json` (alamat Mentari yang kamu pakai).

## Jadwal harian (opsional, Windows Task Scheduler)
`schtasks /Create /SC DAILY /ST 08:00 /TN MentariHarian /TR "cmd /c cd /d \"D:\unpam\semester 7\_scripts\" && node mentari.mjs"`
Jangan jalankan bersamaan dengan scheduled task Claude supaya progres tidak ganda.
