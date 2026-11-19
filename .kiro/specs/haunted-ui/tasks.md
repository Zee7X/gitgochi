# Haunted UI: Tasks

- [x] 1. Retro shell, LCD screen and pixel sprites for all four stages (R1)
- [x] 2. Web Audio synthesizer (R1)
- [x] 3. `usePet` hook and `PetConsole` with menus, animations, sounds (R2)
- [x] 4. Landing page with live demo pet, adopt form, demo chips (R3)
- [x] 5. Pet page `/pet/[owner]/[repo]` with stats, event log, simulator, badge embed, webhook setup (R2, R3)
- [x] 6. SUMMON KIRO modal with real findings and COPY PROMPT (R2)
- [x] 7. Loading, error and offline-cache states (R2)
- [x] 8. Live badge: `src/lib/badge-svg.ts` and `/api/badge/{owner}/{repo}` with ETag and cache headers (R5)
- [x] 9. Tests: `badge.test.ts`, `parse-repo.test.ts`
- [x] 10. Verify the badge renders in a real GitHub README (camo proxy), including the CSS bob
- [x] 11. Browser pass on `/` and `/pet/demo/haunted` at 390 px and desktop: no horizontal overflow, keyboard-only use, console clean
- [x] 12. Measure LCD and text contrast with a tool (R4)
- [x] 13. Capture `docs/media/*.png` (hero, dead pet, badge, heal modal) for the README
- [x] 14. Costume Contest polish: review the handheld against the Kiroween theme and tune sprites if needed

Notes:
- Task 10: checked 2026-11-19. GitHub's markdown renderer rewrote the badge to a `camo.githubusercontent.com` URL; camo answers 200 `image/svg+xml` with CSP `style-src 'unsafe-inline'`, so the inline `@keyframes` survive. In Chromium the live badge's `<g>` alternates between `translateY(0)` and `translateY(-3px)` (animation `b`, 1.2 s); the dead pet badge is static as designed.
