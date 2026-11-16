# Steering: Architecture & Code Modularity

## Technology Stack
- **Framework:** Next.js (App Router) + React 19 / TypeScript
- **Styling:** Tailwind CSS + CSS Grid Pixel Art
- **Audio:** Web Audio API Native Synthesizer (Zero MP3 assets, purely synthesized 8-bit square/triangle waves)
- **AI / MCP Integration:** `@modelcontextprotocol/sdk` (TypeScript)
- **Database / Realtime:** Supabase Client (PostgreSQL + Realtime Channel) / In-Memory State Cache fallback

## Project Structure
```
src/
├── app/
│   ├── api/
│   │   ├── auto-heal/       # MCP-triggered auto remediation
│   │   ├── badge/[repo]/    # Dynamic SVG badge generator
│   │   ├── local-poop/      # Agent Hook listener for editor errors
│   │   └── webhook/github/  # GitHub Webhook ingestion
│   ├── page.tsx             # Interactive handheld pet device interface
│   ├── layout.tsx
│   └── globals.css
├── components/
│   ├── RetroShell.tsx       # Translucent purple hardware casing & buttons
│   ├── LcdScreen.tsx        # 4-shade green dot-matrix screen & HUD
│   ├── PixelPet.tsx         # SVG/Canvas pixel sprite renderer
│   └── AudioController.ts   # 8-bit sound chip via Web Audio API
├── lib/
│   ├── state-machine.ts     # Core HP, Sanity, Fullness, Stage logic
│   ├── mcp-client.ts        # Model Context Protocol tool calling
│   └── types.ts             # Strict TypeScript definitions
```

## Guiding Principles
1. **Ponytail Rule:** Gunakan solusi paling ramping dan native. Hindari abstraksi berlebihan jika fungsi native sudah mencukupi.
2. **Zero Audio Lag:** Web Audio API diinisialisasi saat interaksi pengguna pertama (AudioContext).
3. **Spec Alignment:** Semua kalkulasi state harus selalu merujuk pada `state-machine.spec.md`.
