# Steering: Retro Aesthetic & Display Guidelines

## Palette: 4-Shade Monochromatic Green Dot-Matrix
Area layar LCD virtual pet menggunakan 4 kode warna hex berikut:
- **`#0f380f`** (Darkest Green): Garis tepi piksel, detail mata, bayangan tajam.
- **`#306230`** (Medium Green): Shading karakter, tekstur aksen sekunder.
- **`#8bac0f`** (Light Green): Highlight, motif ornamen terang, aksen tubuh.
- **`#9bbc0f`** (LCD Background): Warna dasar latar dot-matrix.

## Typography
- **Primary Font:** `"Press Start 2P"`, cursive / monospace pixel font.
- Skala teks harus menggunakan rendering piksel tanpa blur (`image-rendering: pixelated`).

## Hardware Shell
- Tampilan casing cangkang luar mengadopsi plastik ungu transparan (translucent purple / atomic shell) khas konsol portabel era akhir 90-an.
- 3 Tombol fisik di bawah layar:
  - **Button A (Kiri):** Select / Menu Navigation.
  - **Button B (Tengah):** Execute / Confirm Action.
  - **Button C (Kanan):** Cancel / Check Stats.

## Pixel Grid & Scanning Lines
- Rasio piksel layar 1:1 atau kelipatan integer (`transform: scale(2)` atau `scale(3)`).
- Terdapat overlay subtle grid dot-matrix untuk mereplikasi sensasi layar monokrom fisik.
