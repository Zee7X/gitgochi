# GitGotchi Kiro Power

Packages the GitGotchi MCP server and the `summon-healer` skill in the [Agent Plugins](https://agent-plugins.org) format that Kiro Powers use.

| File | Purpose |
|---|---|
| `plugin.json` | Manifest: name, version, keywords that activate the Power |
| `mcp.json` | Starts the bundled MCP server over stdio with `GITGOTCHI_URL=http://localhost:3000` |
| `server/gitgotchi-mcp.mjs` | Single-file bundle of `../mcp-server/index.mjs` (SDK and zod included). Generated, do not edit |
| `skills/summon-healer/SKILL.md` | The steps of `.kiro/steering/summon-healer.md` as a skill |

The server is bundled because a Power imported from a folder or from GitHub has no `node_modules`, and `mcp.json` may only use a `cwd` inside the Power folder. Rebuild it after changing `mcp-server/index.mjs`:

```bash
npm run build:power
```

`src/lib/__tests__/power.test.ts` checks the manifests and that the bundle lists the same tools as the source server, so a stale bundle fails `npm test`.

Install: Kiro, Powers panel, Add Custom Power, Import power from a folder, select `power-gitgotchi/`. Kiro namespaces the server as `power-gitgotchi-gitgotchi`; inside this repository, disable one of the two `gitgotchi` servers so the tools are not listed twice.

Hooks (`.kiro/hooks/`) are not part of the Power format and stay in the workspace.
