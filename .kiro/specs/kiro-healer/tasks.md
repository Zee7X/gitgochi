# Kiro Healer: Tasks

- [x] 1. Poop detector hook (`.kiro/hooks/poop-detector.json`) and script (`scripts/poop-detector.mjs`) (R1)
- [x] 2. `POST /api/local-poop`: localhost or bearer gate, dedupe, clean (R2)
- [x] 3. `spec-sync` agent hook (`.kiro/hooks/spec-sync.json`) (R3)
- [x] 4. MCP server with six tools (`mcp-server/index.mjs`) and `.kiro/settings/mcp.json` (R4)
- [x] 5. Read-only diagnosis `src/lib/heal.ts` and `POST /api/auto-heal` (R5)
- [x] 6. `/summon-healer` manual steering file and `kiro-integration.md` always-on steering (R6)
- [x] 7. Tests: `heal.test.ts`, `local-poop.test.ts`
- [ ] 8. Fix `adopt_pet` in `mcp-server/index.mjs`: it prints `${BASE}/?repo=owner/repo`, but the page is `${BASE}/pet/owner/repo`
- [ ] 9. Open the project in the Kiro IDE and confirm the hooks load, `{{filePath}}` is substituted and the poop appears (R1)
- [ ] 10. Confirm `gitgotchi` shows as connected in Kiro's MCP panel and the tools run (R4)
- [ ] 11. Run `/summon-healer` on a broken repo inside Kiro and record the real outcome in `docs/KIRO_USAGE.md` (R6, R7)
- [ ] 12. Evaluate packaging hooks, steering and the MCP server as a Kiro Power
- [ ] 13. Optional: per-file poop removal instead of wiping all poop on a clean save
