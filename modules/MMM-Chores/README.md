# MMM-Chores

A touchscreen daily chore board for three children (Luke, Noah, Annalise) plus an Extras column,
with a one-button three-week rotation so chores never have to be manually reassigned.

## How it works

Chores never belong to a child directly. Each chore belongs to one of three **sets** — `setA`,
`setB`, `setC` — or to `extras`, which is completely independent of the sets. A separate
**rotation** map says which child currently holds which set:

```
Chore -> Set A / Set B / Set C / Extras -> Rotation -> Luke / Noah / Annalise
```

Pressing **ROTATE WEEK** only changes the rotation map (each set moves to the next child); no
chore's `group` is ever touched. This is what makes weekly rotation a single button press instead
of moving 15-20 chores by hand.

Both the chore list and the rotation are persisted server-side in `chores.json`, written by
`node_helper.js`. Today's completion state ("done"/"not done") lives only in the browser's memory
— it's intentionally **not** persisted, and resets whenever MagicMirror restarts or you press
**RESET TODAY**.

## Installing

MMM-Chores lives in `modules/MMM-Chores`. If you're copying it into another MagicMirror install,
place the whole folder under that install's `modules/` directory. No `npm install` step is
required — the module has no third-party dependencies (it only uses Node's built-in `fs`/`path`/
`crypto`).

## Configuring MMM-Chores

This MagicMirror is already wired up: `config/config.js` embeds MMM-Chores as the content behind
`MMM-DashboardNavigation`'s "Chores" nav tab (see "Embedding in MMM-DashboardNavigation" below) —

```json5
{
  module: "MMM-Chores",
  position: "fullscreen_above",
  hiddenOnStartup: true,
  config: {
    title: "Chores",
    showManagementControls: true,
    fullscreenOverlay: true
  }
}
```

It can also be run as a normal, always-visible module in any region instead, e.g.:

```json5
{
  module: "MMM-Chores",
  position: "middle_center",
  config: {
    title: "Chores",
    showManagementControls: true
  }
}
```

| Option                   | Default    | Description                                                                             |
| ------------------------ | ---------- | --------------------------------------------------------------------------------------- |
| `title`                  | `"Chores"` | Heading text shown above the board.                                                     |
| `showManagementControls` | `true`     | Show the small ⋮ button on each tile for reassigning it to a set/Extras.                |
| `fullscreenOverlay`      | `false`    | Render as a fixed full-viewport overlay instead of normal in-region content. See below. |

## Embedding in MMM-DashboardNavigation

`fullscreenOverlay: true`, combined with `position: "fullscreen_above"` and `hiddenOnStartup: true`,
is what makes MMM-Chores work as the content behind a dashboard nav tab rather than an always-on
module: it renders `.mc-wrapper` as `position: fixed`, filling the viewport down to
`MMM-DashboardNavigation.css`'s `--dashboard-nav-height` custom property (so it never covers the
nav bar), at `z-index: 95` — above `MMM-DashboardNavigation`'s own content layer (`z-index: 90`)
but below its nav bar (`z-index: 100`). This is a deliberate cross-module CSS coupling, which is
normal here since MagicMirror doesn't scope module stylesheets (see `.mc-wrapper.mc-overlay` in
`MMM-Chores.css`); it falls back to a `0` nav height if `MMM-DashboardNavigation` isn't installed,
so it degrades to a plain full-screen overlay rather than breaking.

`MMM-DashboardNavigation.js` finds the running MMM-Chores instance via
`MM.getModules().withClass("MMM-Chores")` and calls its `show()`/`hide()` directly (under a
dedicated `MMM-DASHBOARD-NAV-CHORES` lock string) whenever its "Chores" tab is entered/left — see
`syncChoresVisibility()` there. Its own `renderChoresPage()` now just renders an empty placeholder,
since the real board is this separate module's own fixed overlay rendered on top of it.

If you'd rather run MMM-Chores as a normal, always-visible module instead (not gated behind a nav
tab), just omit `fullscreenOverlay`/`hiddenOnStartup` and give it a normal region like
`middle_center`, as shown above.

## The four-column layout

The board always renders one column per child currently in the rotation, in the order they appear
in `chores.json`'s `rotation` object, plus a fixed Extras column at the end. Each column header
shows the child's name; the set they currently hold (`Set A`, `Set B`, etc.) is shown as a small
subtitle underneath, so it's easy to see the rotation reflected on screen.

## How chore sets and weekly rotation work

`chores.json` stores `rotation: { "Luke": "setA", "Noah": "setB", "Annalise": "setC" }`. Pressing
**ROTATE WEEK** shifts every child's assigned set to the next child (in `rotation`'s key order,
wrapping around), e.g.:

```
Before: Luke -> Set A, Noah -> Set B, Annalise -> Set C
After:  Luke -> Set C, Noah -> Set A, Annalise -> Set B
```

Three presses return to the original mapping. The new rotation is written to `chores.json`
immediately and the board updates without a MagicMirror restart.

## How Extras work

Extras is a fourth column that is never part of the rotation. Chores in `extras` always stay in
the Extras column no matter how many times you rotate. A chore can be moved between Extras and any
set (see below), but that move only happens when you explicitly reassign it.

## Adding a new chore

Tap **+ NEW CHORE**, type a name, and tap **Add** (or press Enter). New chores are always created
in **Extras** — they're never auto-assigned to a set or a child — and are immediately persisted to
`chores.json`.

## Assigning a chore to a set

Tap the ⋮ button in a tile's corner (hidden if `showManagementControls: false`) to open its assign
dialog, pick `Set A` / `Set B` / `Set C` / `Extras` from the dropdown, and tap **Save**. This
updates the chore's `group` in `chores.json` and the tile moves to the corresponding column
immediately. Tapping the rest of the tile (not the ⋮ button) toggles completion instead.

## Modifying the initial chore data

Edit `modules/MMM-Chores/chores.json` directly before first run to seed your own chores/rotation.
Once MagicMirror is running, use **+ NEW CHORE** and the assign dialog instead of hand-editing the
file, since node_helper.js owns writes to it while the server is up.

## How persistence works

`node_helper.js` reads/writes `chores.json` in the module's own folder. Writes go through a
`chores.json.tmp` file followed by an atomic rename, so an interrupted write can't leave a
truncated/corrupt file behind. If `chores.json` is missing, it's created with the sample dataset
below. If it exists but fails to parse, the server logs an error and falls back to in-memory
defaults for that session, without overwriting the file.

Example `chores.json`:

```json
{
  "rotation": { "Luke": "setA", "Noah": "setB", "Annalise": "setC" },
  "chores": [
    { "id": "1", "name": "Wash dishes", "group": "setA" },
    { "id": "4", "name": "Empty dishwasher", "group": "setB" },
    { "id": "7", "name": "Make beds", "group": "setC" },
    { "id": "10", "name": "Wash car", "group": "extras" }
  ]
}
```

## Resetting daily completion

Tap **RESET TODAY**, then confirm in the dialog. This only clears which tiles are marked complete
— it never changes chore assignments, the rotation, or the chore list itself.

## Rotating the week

Tap **ROTATE WEEK**. The rotation updates immediately (see above) and a brief "Week rotated"
message appears under the controls.

## Testing the touchscreen interactions

- **Toggle a chore:** tap anywhere on a tile (not the ⋮ button) — it should flip between ○ and a
  green ✓ instantly, with no server round-trip.
- **Add a chore:** tap + NEW CHORE, enter a name, tap Add — it should appear in Extras.
- **Assign a chore:** tap a tile's ⋮ button, pick a different set, tap Save — it should move to
  that column.
- **Reset today:** complete a few tiles, tap RESET TODAY, confirm — all tiles should return to ○.
- **Rotate week:** tap ROTATE WEEK three times in a row — the board should cycle through three
  distinct layouts and return to the original on the third press.

## Troubleshooting chores.json

- **Changes aren't saving:** check the server console for `[MMM-Chores]` errors — the process
  needs write permission to `modules/MMM-Chores/`.
- **Board shows the sample data unexpectedly:** `chores.json` was missing or failed to parse; check
  server logs for `[MMM-Chores] Failed to read/parse chores.json`, fix or delete the file, and
  restart.
- **A chore won't move:** the assign dialog only accepts `setA`/`setB`/`setC`/`extras` — malformed
  requests are logged server-side and ignored rather than corrupting the data.
