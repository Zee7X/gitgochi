# GitGotchi: Product & Business Requirements Document

## 1. Business Requirements Document (BRD)

- **Project Name:** GitGotchi (The Repo-Necromancer)
- **Target Hackathon:** Kiroween 2026 (Deadline: 4 Desember 2026)
- **Primary Category:** Resurrection (Menghidupkan kembali nostalgia perangkat virtual pet retro 90-an)
- **Bonus Category:** Costume Contest (Antarmuka Retro-Spooky 8-bit)

### 1.1 Problem Statement
1. **Developer Alert Fatigue:** Developer sering mengabaikan notifikasi linter error, stale pull requests, dan technical debt karena representasi log teks atau email yang monoton.
2. **Abandoned Repositories:** Banyak repositori open-source maupun internal yang kualitas kodenya menurun tanpa disadari oleh tim pengembang.

### 1.2 Business Objectives
1. **DevOps Gamification:** Mengubah pemeliharaan kode (code maintenance) menjadi pengalaman interaktif merawat monster virtual berbasis status repositori.
2. **AI Actionability:** Menurunkan Mean Time To Resolution (MTTR) dengan tombol 1-Click AI Auto-Heal terintegrasi Model Context Protocol (MCP).
3. **Viral Adoption:** Mendorong visibilitas melalui dynamic README SVG badge yang menampilkan status monster secara langsung di GitHub.

### 1.3 Key Performance Indicators (KPIs)
- Latensi pembaruan status pet dari event commit/push < 2 detik.
- Eksekusi minimal 1 automated PR perbaikan lint/bug melalui integrasi MCP.
- Kepatuhan 100% persyaratan Kiroween 2026 (Open Source MIT, struktur `/.kiro`, video demo < 3 menit).

---

## 2. Product Requirements Document (PRD)

### 2.1 Pet State Machine
Monster memiliki 4 atribut utama ($0 - 100$):
- **HP (Health Points):** Dipengaruhi oleh status CI/CD pipeline dan test suite.
- **Fullness:** Dipengaruhi oleh frekuensi commit dan merge PR.
- **Sanity / Cleanliness:** Dipengaruhi oleh linter warnings, code smells, dan issue lama.
- **Stage (Evolusi):**
  - `EGG`: Tahap awal / inkubasi repositori.
  - `BABY_GHOST`: Repositori aktif dengan build stabil.
  - `CODE_DEMON`: Repositori produktif dengan build hijau dan test passing konsisten.
  - `ZOMBIE_CORPSE`: Repositori terbengkalai atau build broken ($\text{HP} = 0$).

### 2.2 Mathematical Formulas
$$\text{HP}_{\text{baru}} = \text{clamp}(\text{HP}_{\text{lama}} + (15 \times \text{Pass}_{\text{CI}}) - (25 \times \text{Fail}_{\text{CI}}), 0, 100)$$

$$\text{Sanity}_{\text{baru}} = \text{clamp}(100 - (5 \times \text{LintErrors}) - (10 \times \text{StaleIssues}), 0, 100)$$

### 2.3 Functional Requirements
- **FR-01: Retro Hardware Shell & LCD UI (P0)**
  Cangkang plastik ungu transparan bergaya retro 90-an dengan layar dot-matrix 4-warna dan 3 tombol fisik interaktif (A: Select, B: Execute, C: Cancel).
- **FR-02: GitHub Webhook Listener (P0)**
  Endpoint API `/api/webhook/github` menangani push, pull_request, issues, dan check_run.
- **FR-03: The "Auto-Heal" Medicine via MCP (P0)**
  Pemicu automated fix yang membaca log kegagalan dan mengajukan draft pull request perbaikan.
- **FR-04: The Resurrection Ritual (P1)**
  Ketika HP mencapai 0, pet memasuki mode kuburan (Graveyard). Pet dapat dibangkitkan saat broken build diperbaiki atau issue ditutup.
- **FR-05: Dynamic SVG Badge (P1)**
  Endpoint `/api/badge/[owner]/[repo].svg` yang merender status monster hidup untuk dipasang di README GitHub.
