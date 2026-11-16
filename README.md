# 👾 GitGotchi: The Repo-Necromancer

> **Official Entry for Kiroween 2026 Hackathon**  
> **Primary Category:** Resurrection (Menghidupkan kembali nostalgia perangkat virtual pet retro 90-an)  
> **Bonus Category:** Costume Contest (Retro-Spooky 8-Bit Interface)  
> **License:** MIT License  

![GitGotchi Badge](http://localhost:3000/api/badge/octocat/gitgotchi.svg)

---

## 📖 Overview

**GitGotchi** adalah virtual pet retro interaktif bergaya dot-matrix era 90-an yang ditenagai langsung oleh kesehatan repositori GitHub Anda. Karakter monster Anda berevolusi, lapar, atau sakit berdasarkan aktivitas commit, kelulusan CI/CD unit tests, serta kebersihan kode (linting).

Jika kode Anda membusuk dan pipeline gagal hingga HP monster menjadi 0, monster akan mati menjadi **ZOMBIE CORPSE**. Anda dapat membangkitkannya kembali dengan **The Resurrection Ritual** atau menyembuhkannya secara instan dengan menekan tombol **Auto-Heal** via **Model Context Protocol (MCP)**.

---

## 🛠️ Tech Stack (Full-Stack TypeScript)

- **Language:** TypeScript 100% End-to-End
- **Framework:** Next.js (App Router) + React 19
- **Styling:** Tailwind CSS + 4-Color Monochromatic Green Dot-Matrix LCD
- **Sound:** Web Audio API Native Synthesizer (Zero MP3 files, 100% square/triangle wave synthesis)
- **AI / MCP Integration:** `@modelcontextprotocol/sdk` (TypeScript)
- **Specs & Hooks:** Kiro Spec-Driven Development (`.kiro/`)

---

## 📂 Struktur Direktori `.kiro` (Kiroween Compliance)

Struktur ini wajib tersedia di repositori dan **tidak dimasukkan ke `.gitignore`**:

```text
├── .kiro/
│   ├── specs/
│   │   ├── gitgotchi-prd.md        # Product & Business Requirements
│   │   ├── state-machine.spec.md   # Rumus matematika HP & evolusi
│   │   └── webhook-api.spec.md     # Kontrak payload GitHub Webhook
│   ├── steering/
│   │   ├── retro-aesthetic.md      # Palet 4 hex GameBoy & Press Start 2P
│   │   └── architecture.md         # Standar modularitas Next.js & TS
│   └── hooks/
│       └── poop-detector.hook.json # Agent hook saat file disimpan (on-save)
```

---

## 🧬 Pet Evolution Stages

| Stage | Kondisi | Tampilan Visual |
|---|---|---|
| **EGG** | Repo baru (< 5 commit) | Telur hijau berbintik dengan sepasang sayap kelelawar |
| **BABY GHOST** | Repo aktif, build stabil | Hantu kecil imut bertopi penyihir melayang di atas bayangan |
| **CODE DEMON** | CI/CD stabil, HP >= 80%, Sanity tinggi | Demon hitam bertanduk tajam memegang trisula kode |
| **ZOMBIE CORPSE** | Broken build (HP = 0) | Tengkorak hantu bermata silang X X di kuburan ber-nisan |

---

## 🪝 Kiro Agent Hook: Poop Detector

Konfigurasi di `.kiro/hooks/poop-detector.hook.json`:
- **Trigger:** `onFileSave` pada berkas `**/*.{ts,tsx}`.
- **Action:** Memeriksa keberadaan `console.log` atau komentar `TODO:`. Jika ditemukan, hook mengirimkan sinyal ke endpoint `/api/local-poop` untuk memunculkan ikon kotoran/hantu kecil di layar LCD GitGotchi secara real-time.

---

## ⚡ Fitur Utama

1. **Retro Hardware Shell & LCD Screen:** Cangkang ungu transparan bergaya retro dengan 3 tombol interaktif (A: Select, B: Exec, C: Stats).
2. **Web Audio 8-Bit Synthesizer:** Efek suara arcade retro instan tanpa dependensi file eksternal.
3. **GitHub Webhooks Listener:** Menerima event `push`, `check_run`, `pull_request`, dan `issues` di `/api/webhook/github`.
4. **1-Click MCP Auto-Heal:** Menghubungkan GitGotchi ke MCP Server GitHub untuk menganalisis error dan membuka draft pull request otomatis.
5. **Embeddable README Badge:** Menghasilkan badge dynamic SVG di `/api/badge/[owner]/[repo].svg` untuk dipasang di README GitHub Anda.

---

## 🚀 Menjalankan Proyek

```bash
# Clone repositori
git clone https://github.com/your-username/gitgotchi.git
cd gitgotchi

# Install dependensi
npm install

# Jalankan server pengembangan
npm run dev
```

Buka [http://localhost:3000](http://localhost:3000) di browser Anda.

---

## 📜 Lisensi

Proyek ini dirilis di bawah lisensi [MIT License](LICENSE).
