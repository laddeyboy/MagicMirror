# MMM-TodaysTasks

A compact "what do I have to do today" view for MagicMirror². Shows today's calendar events as a
Time / Title / EDT (Estimated Drive Time) table, with relative status ("In 41 minutes", "Ends in
41 minutes"), activity icons, and calendar colors.

## How it works

MMM-TodaysTasks does **not** fetch any calendars itself. It listens for the `CALENDAR_EVENTS`
notification broadcast by MagicMirror's built-in `calendar` module, filters that list down to
today, and renders it. This means:

- You configure your calendars (iCal, RSS, Google Calendar, etc.) entirely through the built-in
  `calendar` module, exactly as you do today.
- MMM-TodaysTasks automatically picks up every calendar the `calendar` module is already
  consolidating — no separate calendar credentials or URLs to configure here.
- The `calendar` module must be present and enabled in `config.js` (it does not need to be
  visible/positioned on screen, but it does need to run so it can broadcast events).

## Configuring multiple calendars

Add/keep your calendars under the existing `calendar` module's `config.calendars` array, e.g.:

```json5
{
  module: "calendar",
  config: {
    calendars: [
      { symbol: "calendar", name: "Family", color: "#BF5700", url: "webcal://..." },
      { symbol: "volleyball-ball", name: "Volleyball", color: "#dd42f5", url: "webcal://..." }
    ]
  }
}
```

The `symbol` and `color` you set per calendar there are reused by MMM-TodaysTasks (see
"Activity icons" below) instead of inventing a second icon/color system.

## Installing

MMM-TodaysTasks lives in `modules/MMM-TodaysTasks`. If you're copying it into another MagicMirror
install, place the whole folder under that install's `modules/` directory. No `npm install` step
is required — the module has no third-party dependencies.

## Configuring MMM-TodaysTasks

Add a module entry to `config/config.js`. This MagicMirror fork's valid regions are `top_left`,
`top_center`, `top_right`, `middle_center`, `bottom_left`, `bottom_center`, `bottom_right`, plus
the bar/third/fullscreen variants — there is no vertically-centered left column, so pick whichever
open region suits your layout (e.g. `middle_center`):

```json5
{
  module: "MMM-TodaysTasks",
  position: "middle_center",
  config: {
    origin: "6023 Wigton Dr. Houston, TX 77096",
    trafficRefreshMinutes: 10,
    maxEvents: 10,
    showRelativeTime: true,
    showActivityIcons: true,
    showCalendarColors: true
  }
}
```

| Option                  | Default | Description                                                               |
| ----------------------- | ------- | ------------------------------------------------------------------------- |
| `origin`                | `""`    | Starting address for drive-time calculations. Leave blank to disable EDT. |
| `trafficRefreshMinutes` | `10`    | How long a drive-time result is cached before it's refreshed.             |
| `maxEvents`             | `10`    | Max events shown before collapsing into "+ N more events".                |
| `showRelativeTime`      | `true`  | Show "In N minutes" / "Ends in N minutes" under the title.                |
| `showActivityIcons`     | `true`  | Show a small activity icon next to the title when one is detected.        |
| `showCalendarColors`    | `true`  | Tint the icon/title with the event's calendar color.                      |
| `updateIntervalSeconds` | `30`    | How often the relative-status text is refreshed in place.                 |
| `activityIcons`         | `{}`    | Extend/override the built-in keyword → icon map (see below).              |

## Google Maps API key

Estimated Drive Time uses the Google Maps Platform **Routes API** (`computeRoutes`, traffic-aware).
The API key is read only on the server side, in `node_helper.js`, from:

```
GOOGLE_MAPS_API_KEY
```

Set it as an environment variable before starting MagicMirror, e.g. in your shell profile, a
`.env` file loaded by your process manager, or your systemd unit:

```
export GOOGLE_MAPS_API_KEY="your-key-here"
```

The key is never sent to the browser/frontend. If it's missing, calendar display still works
normally and EDT is simply left blank (a warning is logged server-side).

**Required Google Cloud service:** enable the **Routes API** on the project the key belongs to.

## How estimated drive time works

For each of today's events that has a `location` and hasn't already ended, the frontend asks
`node_helper.js` for a drive time from `origin` to that location. `node_helper.js` caches results
in memory, keyed by origin+destination, for `trafficRefreshMinutes`. Repeated renders and multiple
events sharing the same destination reuse the cached value instead of calling the API again.
Events without a `location`, all-day events, and events that have already ended never trigger an
API call — EDT is simply left blank for them.

## How activity icons are determined

Each event's title (and calendar name) is checked, case-insensitively, against a keyword → icon
map. For example, a title containing "baseball" gets a baseball icon. If nothing matches, and the
calendar module already assigned that event a specific (non-generic) symbol via its own
`calendars[].symbol` config, that symbol is reused. If neither produces a match, no icon is shown.

## Adding a new activity/icon mapping

Pass `activityIcons` in this module's config to add or override entries. Icons should be
FontAwesome class strings (the same bundled Font Awesome the `calendar` module uses):

```json5
{
  config: {
    activityIcons: {
      hockey: { keywords: ["hockey"], icon: "fas fa-fw fa-hockey-puck" }
    }
  }
}
```

Keys are just labels for your own reference; only `keywords` (array of lowercase substrings) and
`icon` (FontAwesome class string) matter.

## Adjusting the visual layout

Layout/spacing lives in `MMM-TodaysTasks.css`, scoped under `.tt-*` class names — column widths are
set via `.tt-time` / `.tt-title` / `.tt-edt`, the current-event highlight via `.tt-row.tt-current`.

## Installing / restarting MagicMirror

1. Confirm the `calendar` module is enabled in `config/config.js` with your calendars configured.
2. Add the `MMM-TodaysTasks` module entry shown above.
3. Set `GOOGLE_MAPS_API_KEY` in your environment (optional — only needed for EDT).
4. Restart MagicMirror (`node --run start`, or your usual restart method).

## Testing

- **Calendar events show up at all:** confirm the `calendar` module itself is fetching events
  (check its own display or server logs), then confirm MMM-TodaysTasks lists the same events for
  today.
- **Event with a location:** add/use a calendar event today with a `LOCATION` set in the source
  calendar. After up to `trafficRefreshMinutes`, its row should show an EDT value once
  `GOOGLE_MAPS_API_KEY` is configured.
- **Event without a location:** confirm its EDT cell stays blank and no errors appear in the
  server console.
- **Upcoming event:** create an event starting in the next hour; its row should show "In N
  minutes" under the title, counting down.
- **Currently active event:** create/use an event spanning the current time; its row should show
  "Ends in N minutes" and the current-event highlight (bold title + leading dot).

## Troubleshooting

- **No events at all:** make sure the `calendar` module is present in `config.js` (it can be
  positioned anywhere, even a region you don't display) and that it's successfully fetching — check
  server logs for `CALENDAR_ERROR`.
- **EDT always blank:** check that `origin` is set in this module's config and
  `GOOGLE_MAPS_API_KEY` is set in the environment MagicMirror's server process actually runs in;
  check server logs for `[MMM-TodaysTasks]` warnings/errors.
- **Wrong/missing icon:** the keyword list is intentionally small — add an entry to
  `activityIcons` (see above) rather than expecting every activity to be guessed automatically.
