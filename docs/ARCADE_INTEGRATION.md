# Little Joy Arcade integration

Gear Garden is its own static app. It never embeds the portal, and the portal
links to it.

## What is wired

- `public/arcade-client.js` is the arcade's drop-in client, loaded with
  `data-game-id="gear-garden"`.
- It provides shared sign-in, guest play and cloud saves by mirroring the game's
  Web Storage keys into one `game_progress` row per player.
- Account state and sync status are shown in **Settings → Little Joy Arcade**.
- The main menu links back to <https://littlejoyarcade.site>.
- Achievements are stored in the save (and therefore mirrored); they do not
  invent any SDK method.

## Failure behaviour

| Failure | Result |
| --- | --- |
| No network | Local save loads and writes; client retries later |
| Not signed in | Guest play, save stays on the device |
| Client blocked | `window.LittleJoyArcade` is absent; saves still work |
| Backend rejects a write | The local copy is untouched |

## Entitlements

No ads, purchases or entitlements are active. The save and platform layer are
ready for `arcade.ad_free` / `gear-garden.ad_free` checks, but nothing is gated,
and no payment or advertising code ships. `littlejoyarcade.site` and
`busjambonanza.littlejoyarcade.site`-style hosting are unchanged by this game.

## Catalogue

The portal entry is `gear-garden` in `src/data/games.ts` and a Supabase row
(see `littlejoyarcade/supabase/migrations`). The canonical playable URL is the
GitHub Pages build; `preferredPlayUrl` is only a probe.
