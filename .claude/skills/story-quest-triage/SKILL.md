---
name: story-quest-triage
description: 'Find missing or hidden Story quests from a Miku Battle save. Use when a player reports a missing/bugged quest, asks how many quests remain in an act or novel, or has cleared secrets/stars but cannot find a side quest.'
---

# Triage missing Story quests

Use the player's exported save and the current game quest graph to distinguish a completed quest, an unlocked quest they have not played, a quest gated behind another quest, and one hidden by content mode. Do not infer missing quests from star or secret progress.

## Procedure

1. Locate the save export. Check the `save.quests` IDs (or legacy `save.progress`) rather than relying on a screenshot or the player's remembered total.
2. Run the inspector from the repository root:

   ```sh
   node .claude/skills/story-quest-triage/scripts/inspect-save.js "<path-to-save.json>" "New Haven"
   ```

   Replace the act name with the requested act. The default compares standard mode (NSFW off) and NSFW mode because an export does not reliably tell you which mode the player uses. Use `--mode sfw` or `--mode nsfw` if their mode is known.
3. Read the report:
   - **Done** means the quest ID is in the save.
   - **Ready** means its prerequisite(s) are done, so it should appear on the map. Give the player its title and exact map/location.
   - **Locked** means list the prerequisite quest(s) they still need to complete. Side quests stay hidden until unlocked.
   - **Hidden by mode** means the quest's chapter is unavailable in that content mode. Do not call it a bug.
4. If the reported total differs from the player's number, show both mode totals and explain the difference. Quest totals are not the same as remaining quests.
5. Stars and secrets are separate progress systems. Three-starring a fight or finding every secret does not unlock side quests unless the quest definition explicitly says so. Verify each claim against `game/js/story.js` and the unlock rules in `game/js/story.js` / `game/js/storymap.js` before diagnosing a bug.
6. If a quest is reported ready but its marker is absent, verify its current act/location, mode visibility, `from`/`needs` chain, and save data; only then consider a map or progression bug. Reply with concise steps a player can follow.

## Manual fallback

If Node is unavailable, inspect the act's `quests` in `game/js/story.js`, compare side-quest IDs against the save's `quests` array, and follow each side quest's `from` field (or `needs`) through its prerequisites. Check content-mode hiding in `game/js/content.js` and `hidden`/`isOpen` in `game/js/story.js`. In `game/js/storymap.js`, locked side quests are intentionally not drawn.
