---
inclusion: manual
---

# Summon Kiro (healer)

Run in chat with `/summon-healer`. v1 hooks have no manual trigger, so this manually included steering file is the on-demand entry point.

1. Call the `diagnose_pet` tool of the `gitgotchi` MCP server for this repository (`owner/repo`; ask me if you cannot tell which).
2. Take the top finding. Check the matching spec in `.kiro/specs/` and update it first if the behaviour is wrong.
3. Fix it in this repository, run `npm test`, and report what changed.
4. Report only what you actually ran. If a finding cannot be reproduced, say so.
