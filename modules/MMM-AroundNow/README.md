# MMM-AroundNow

Visual 7-day calendar centered on the current time.

Installation

- Copy this folder to your `modules` directory (already placed in `modules` for this repo).
- Add a module entry to your `config/config.js` with `module: "MMM-AroundNow"`.

Configuration

- `pixelsPerHour` (default 80)
- `updateInterval` (ms, default 30000)
- `hoursBefore` / `hoursAfter` (default 3)

The module listens for `CALENDAR_EVENTS` notifications from MagicMirror's calendar system.
