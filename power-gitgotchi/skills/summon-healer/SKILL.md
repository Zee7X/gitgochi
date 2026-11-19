---
name: summon-healer
description: Diagnose a sick or dead GitGotchi repo pet with the gitgotchi MCP tools, fix the top finding spec-first, run the tests and report only what actually ran.
---

# Summon Kiro (healer)

Needs the GitGotchi app running at `GITGOTCHI_URL` (default `http://localhost:3000`).

## Step 1: Diagnose

Call the `diagnose_pet` tool of the `gitgotchi` MCP server for this repository (`owner/repo`). If you cannot tell which repository, ask. `get_pet_status` shows the pet's current stats if you need them.

## Step 2: Check the spec

Take the top finding. Check the matching spec in `.kiro/specs/` and update it first if the behaviour is wrong.

## Step 3: Fix and test

Fix the finding in this repository and run `npm test` (or the project's test command). For a code smell, removing it and saving the file lets the poop-detector hook clean that file's poop. `clean_pet` and `feed_pet` are the manual CLEAN and FEED buttons.

## Step 4: Report

Report what changed and the test result. Report only what you actually ran. If a finding cannot be reproduced, say so.
