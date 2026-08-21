# MMM-DashboardNavigation

A persistent, touchscreen-friendly bottom navigation bar that switches between
client-side "pages" (Home / School / Chores) without reloading MagicMirror.
Home modules are shown/hidden using the core `Module.show()`/`hide()` API, so
they keep their state (timers, fetched data, etc.) instead of being destroyed
and recreated when you navigate away and back.

## Installation

- Module files are in `modules/MMM-DashboardNavigation/`
- Add module entry to `config/config.js` with `module: "MMM-DashboardNavigation"`
- Position must be `fullscreen_above` (see "Why fullscreen_above" below)

## Configuration

```json5
{
  module: "MMM-DashboardNavigation",
  position: "fullscreen_above",
  config: {
    pages: [
      { id: "home", label: "HOME", icon: "house-chimney" },
      { id: "school", label: "SCHOOL", icon: "chalkboard" },
      { id: "chores", label: "CHORES", icon: "list-check" }
    ],
    // optional, defaults to the schoolSites/children below
    school: {
      // Each school gets one logo-only button (top row) opening its
      // public site in a new tab.
      schoolSites: [
        {
          id: "sths",
          label: "STHS",
          url: "http://sths.org/",
          logo: "https://www.sths.org/wp-content/uploads/2026/07/sth-logo-full-2026-400x121.png"
        },
        {
          id: "stm",
          label: "STM",
          url: "https://stthomasmore-school.org/",
          logo: "https://files.ecatholic.com/10809/pictures/2022/7/school-logo-header.png?t=1657128195000"
        }
      ],
      // One column per child. `color` should match that child's color
      // elsewhere on the mirror (MMM-Chores' childColors, the calendar
      // module's per-child calendar color in config.js) so the same kid
      // reads the same color everywhere. `avatar` is an optional image
      // URL/path; leave it blank to fall back to the child's first
      // initial, same convention as MMM-Chores.
      //
      // A child with a `scheduleUrl` (a webcal/iCal feed for their daily
      // class schedule) gets a live, auto-refreshing class list for
      // today. A child without one (Annalise, until STM provides a
      // feed) gets a static card showing `logo` instead.
      //
      // `portalUrl` is that child's gradebook/coursework site, opened
      // in a new tab from a button at the bottom of their column;
      // `portalUrl: null` renders that button disabled.
      children: [
        {
          id: "luke",
          name: "Luke",
          color: "#03C1FF",
          avatar: "",
          scheduleUrl: "webcal://sths.myschoolapp.com/podium/feed/iCal.aspx?z=...",
          portalUrl: "https://sths.myschoolapp.com/app/parent?svcid=edu#profile/8111550/progress",
          portalLabel: "Grades & Coursework"
        },
        {
          id: "noah",
          name: "Noah",
          color: "#98FB98",
          avatar: "",
          scheduleUrl: "webcal://sths.myschoolapp.com/podium/feed/iCal.aspx?z=...",
          portalUrl: "https://sths.myschoolapp.com/app/parent?svcid=edu#profile/8745892/progress",
          portalLabel: "Grades & Coursework"
        },
        {
          id: "annalise",
          name: "Annalise",
          color: "#B19CD9",
          avatar: "",
          logo: "https://files.ecatholic.com/10809/pictures/2022/7/school-logo-header.png?t=1657128195000",
          // no schedule feed available yet; button/list are replaced
          // by a static logo card until scheduleUrl/portalUrl are set
          scheduleUrl: null,
          portalUrl: null,
          portalLabel: "Coursework Portal"
        }
      ],
      // How often (minutes) each child's schedule feed is re-fetched.
      // Independently of this, cached events are re-filtered for "is
      // this today?" every few minutes so the schedule rolls over to
      // the next day without waiting on a fresh network fetch.
      scheduleRefreshMinutes: 30,
      // Special-occasion announcements banner - one shared calendar
      // (e.g. "Go Texan Day", "Spirit Night at Los Tios"), rather than
      // a per-child one. Leave null/blank to disable the banner.
      announcementsUrl: "webcal://...",
      announcementsRefreshMinutes: 60,
      // How many days ahead to look for announcements to show.
      announcementsWindowDays: 7,
      // Caps how many announcements can show at once.
      announcementsMaxItems: 5
    }
  }
}
```

## Adding another page

Add another entry to `pages`, e.g. `{ id: "sports", label: "SPORTS", icon: "baseball" }`.
The nav button appears automatically, with the given Font Awesome icon shown
above the label (omit `icon` to render a label-only button). Until custom
content is written for that `id`, the page renders a generic
"<LABEL> — Coming soon" placeholder (see `renderPlaceholderPage` in
`MMM-DashboardNavigation.js`). To give a page real content, add a case for
its `id` in the `renderPage()` method — this is what School does, rendering
its buttons directly inline in this module.

Chores works differently: rather than rendering inline, `renderChoresPage()`
returns an empty placeholder, and the real board is a separate module,
[MMM-Chores](../MMM-Chores/README.md), configured with `fullscreenOverlay:
true` so it renders itself as a fixed overlay on top of that placeholder.
`selectPage()` calls `syncChoresVisibility()`, which finds the running
MMM-Chores instance via `MM.getModules().withClass("MMM-Chores")` and calls
its `show()`/`hide()` directly (under a dedicated `MMM-DASHBOARD-NAV-CHORES`
lock string) as the Chores tab is entered/left — see MMM-Chores' README for
the full mechanics. This pattern (a separate module driven by this one,
rather than content built inline here) is the better fit whenever a page
needs its own persistence/node_helper, as Chores does.

Icon names are free Font Awesome 6 icon names (without the `fa-` prefix),
e.g. `house-chimney`, `chalkboard`, `list-check` — see
<https://fontawesome.com/search?o=r&m=free> for the full free set.

## How it works

- `getDom()` renders two fixed overlays: the bottom nav bar and (when the
  active page isn't Home) a full-screen content panel above it.
- Tapping a nav button calls `selectPage(id)`, which re-renders this module
  and, only when crossing the Home <-> non-Home boundary, calls `hide()`/
  `show()` on every other configured module via `MM.getModules().exceptModule(this)`.
  A lock string (`MMM-DASHBOARD-NAV`) is used so this module's show/hide calls
  don't fight with any other visibility control on the same modules.
- `DASHBOARD_PAGE_CHANGED` is broadcast via `sendNotification()` on every page
  change (payload: the new page id) so other modules can react without this
  module needing to know about them.

## Why `fullscreen_above`

`bottom_bar` (the natural-sounding position) is already used by
`MMM-WeeklyCalendar`. `fullscreen_above` is MagicMirror's overlay region — it
renders above all other regions and spans the full viewport, which is what a
persistent nav bar needs. Because it sits on top of everything, its CSS
(`MMM-DashboardNavigation.css`) also shrinks `.region.bottom.bar`'s height by
the nav bar's height (`--dashboard-nav-height`, default 100px) so the weekly
calendar never renders underneath the bar.

## School page

The School page (see `SchoolPrompt.md` in this directory for the full build
spec) has four parts:

- An announcements banner (see below), shown above everything else only when
  there's something to announce.
- `school.schoolSites` — one logo-only button per school (top row), each
  opening its `url` in a new tab via `window.open()`. A button whose `url` is
  falsy renders disabled.
- `school.children` — one column per child: an avatar next to their name
  (same row layout as MMM-Chores' column header), then either their live
  daily class schedule (if `scheduleUrl` is set) or a static `logo` card (if
  it isn't, e.g. Annalise until STM provides a feed). Column backgrounds,
  the avatar fill, and class-tile colors are all tinted from that child's
  `color` using the exact same `hexToRgba`/`darkenToRgba` technique
  MMM-Chores.js uses for its own board, so the same kid reads as the same
  color family on both pages.
- A `portalUrl` button at the bottom of each column, opening that child's
  gradebook/coursework site in a new tab (disabled when `portalUrl` is null).

Unlike the rest of this module, the School page's class schedules need a
`node_helper.js` — browsers can't fetch cross-origin `webcal://`/iCal feeds
directly. The node helper reuses `defaultmodules/calendar/calendarfetcher.js`
(one `CalendarFetcher` per child with a `scheduleUrl`) rather than
re-implementing iCal parsing, HTTP retry/backoff, or `RRULE` recurring-event
expansion — a class schedule is fundamentally a recurring event (periods
repeat Mon/Wed/Fri etc.). On every fetch, and again every few minutes
independent of the fetch interval (so the schedule rolls over to the next
day without waiting on a network round-trip), it filters the fetcher's
cached events down to just today's instances and sends them to the frontend
as a `SCHOOL_SCHEDULE_DATA` socket notification. The frontend subscribes once
in `start()`, not only when the School page is opened, so a child's schedule
is usually already cached by the time someone taps into School.

The class currently in progress (now between its start/end time) is
highlighted, refreshed by the same per-minute `updateDom()` tick this module
already runs for the status bar clock while a non-Home page is showing — no
second timer needed on the frontend.

The announcements banner (`school.announcementsUrl`) works the same way but
with one shared feed instead of one per child, and different filtering: it
looks `announcementsWindowDays` ahead (default 7) rather than just today, and
excludes past events entirely instead of keeping them, since an
already-over announcement isn't useful context the way an already-met class
period still is. Each item renders as "`{title} — {day label}`" ("Today",
"Tomorrow", or a short weekday name) with no time shown. Capped at
`announcementsMaxItems` (default 5). A fetch error here is only logged
server-side — the banner just keeps showing its last known-good list (or
nothing) rather than surfacing an error state.

Assignments-due badges on class tiles were also discussed but are
intentionally not built yet — no data source exists for them; see
`SchoolPrompt.md` for details.
