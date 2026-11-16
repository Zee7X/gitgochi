# Steering: Architecture & Code Modularity

## Technology Stack
- **Framework:** Next.js (App Router) + React 19 / TypeScript
- **Styling:** Tailwind CSS + CSS Grid Pixel Art
- **Audio:** Web Audio API Native Synthesizer (Zero MP3 assets, purely synthesized 8-bit square/triangle waves)
- **AI / MCP Integration:** `@modelcontextprotocol/sdk` (TypeScript)
- **State:** In-memory store (`pet-store.ts`); a KV backend can replace it without touching callers

## Project Structure
```
src/
├── app/
│   ├── api/
│   │   ├── auto-heal/       # "Summon Kiro": read-only diagnosis + Kiro prompt
│   │   ├── badge/[owner]/[repo]/  # Dynamic SVG badge generator
│   │   ├── local-poop/      # Kiro hook listener for code smells
│   │   ├── pet/[owner]/[repo]/    # GET pet, POST action
│   │   └── webhook/github/  # GitHub Webhook ingestion
│   ├── page.tsx             # Interactive handheld pet device interface
│   ├── layout.tsx
│   └── globals.css
├── components/              # RetroShell, LcdScreen, sprites, lcd/
└── lib/
    ├── types.ts             # Strict TypeScript definitions
    ├── state-machine.ts     # Pure engine: HP, Sanity, Fullness, Stage
    ├── pet-store.ts         # In-memory pet + event store
    ├── pet-service.ts       # getPet / act, demo fixtures
    ├── github.ts            # GitHub snapshot fetch
    ├── heal.ts              # Diagnosis for "Summon Kiro"
    ├── audio-synth.ts       # Web Audio synthesizer
    └── __tests__/           # vitest (npm test)
mcp-server/index.mjs         # stdio MCP server (npm run mcp)
scripts/poop-detector.mjs    # command run by the poop-detector hook
.kiro/                       # specs, steering, hooks, settings/mcp.json
```

## Guiding Principles
1. **Ponytail Rule:** Use the leanest, most native solution. Avoid extra abstraction when a native function is enough.
2. **Zero Audio Lag:** The Web Audio API is initialized on the user's first interaction (AudioContext).
3. **Spec Alignment:** All state calculations must always follow `.kiro/specs/pet-engine/`.
