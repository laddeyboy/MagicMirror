Claude Prompt — School Page (MMM-DashboardNavigation)

This is the build spec for the School page, one of the pages rendered inline
by MMM-DashboardNavigation (see renderPage()/renderSchoolPage() in
MMM-DashboardNavigation.js). It replaces the current bare two-row button grid
with a richer daily dashboard, following the UX layout already agreed on:

┌─────────────────────────────────────────────────────────────────┐
│ [ STHS logo ] [ STM logo ] │ ← school site buttons
├──────────────────────┬──────────────────────┬───────────────────┤
│ 🔵 LUKE │ 🟢 NOAH │ 🟣 ANNALISE │ ← avatar + kid color
├──────────────────────┼──────────────────────┼───────────────────┤
│ 8:00 Algebra │ 8:00 Biology │ St. Thomas More │
│ 9:00 English │ 9:00 History │ (no schedule │
│ 10:00 History │ 10:00 Algebra │ feed — logo + │
│ ... │ ... │ static card) │
├──────────────────────┼──────────────────────┼───────────────────┤
│ [ Grades/Coursework ]│ [ Grades/Coursework ]│ [ Coursework ] │
└──────────────────────┴──────────────────────┴───────────────────┘

Update: the announcements banner (originally deferred - see below) has since
been implemented once a calendar URL was provided. See ANNOUNCEMENTS BANNER
below for how it works.

One item from the original UX discussion is still explicitly OUT OF SCOPE
for this build and is not being implemented now:

- "Assignments due today" badges on class tiles. No data source for
  assignments exists yet (stretch goal, per the original request). Nothing
  in this build should make this harder to add later - it would be a
  per-tile addition - but it isn't being stubbed out or half-implemented now.

ANNOUNCEMENTS BANNER

A full-width row above the site buttons, only rendered when there's
something to show (no calendar entries in range = no element at all, not an
empty banner). Sourced from a single shared iCloud calendar
(school.announcementsUrl) rather than a per-child one - this is where
special one-off occasions like "Go Texan Day at STM" or "Spirit Night at Los
Tios" get published.

Unlike the per-child schedules (which need today's full picture, past
periods included), the announcements fetcher uses includePastEvents: false
with a multi-day look-ahead window (school.announcementsWindowDays, default 7) - an announcement that already happened isn't useful context, so once
it's over it should simply age out. Each item renders as "{title} —
{day label}", where the day label is "Today"/"Tomorrow" for the near term or
a short weekday name further out; no start/end time is shown since these are
day-scale occasions, not scheduled periods. Capped to
school.announcementsMaxItems (default 5) so an unusually busy week doesn't
overflow the banner.

A fetch error here is only logged server-side, not surfaced in the UI - the
banner is decorative, so on failure it simply keeps showing its last known
good list (or nothing, if it hasn't loaded yet) rather than displaying an
error state.

SCOPE

Three children, two schools:

- Luke — St. Thomas High School (STHS)
- Noah — St. Thomas High School (STHS)
- Annalise — St. Thomas More Middle School (STM)

Each child gets one column. Luke and Noah have a daily class-schedule feed
(webcal/iCal, one URL per child, provided below). Annalise does not have a
feed yet, so her column is a static card (STM logo + a short note) instead
of a class list.

Provided data:

- STM logo (used both for the STM site button and for Annalise's static
  card, since she doesn't have a personal photo either):
  https://files.ecatholic.com/10809/pictures/2022/7/school-logo-header.png?t=1657128195000
- Luke's schedule feed:
  webcal://sths.myschoolapp.com/podium/feed/iCal.aspx?z=%2bWnDUoj%2bQbg0jm8qFAD8CUOeRtfzXFBq2Bltsozl3agJ3TOKd6uTjQBIE%2f0NuvpW68QAmHxL2hBWbvx8MZ3VOQ%3d%3d
- Noah's schedule feed:
  webcal://sths.myschoolapp.com/podium/feed/iCal.aspx?z=%2bWnDUoj%2bQbg0jm8qFAD8CUOeRtfzXFBq2Bltsozl3aiUM8J4sHFN5FvsTJijtf%2b1Mf6YMfUmdYfxqO4rHTNrzQ%3d%3d

Kid colors (matching the existing calendar/Chores config so the whole
mirror stays visually consistent for the same child): Luke #03C1FF, Noah
#98FB98, Annalise #B19CD9. Avatars: none configured yet — fall back to the
child's first initial in a circle tinted with their color, same convention
as MMM-Chores' mc-avatar.

SCHOOL SITE BUTTONS

Top row, two buttons, one per school. Each button shows ONLY the school's
logo, centered, no text label underneath — this is a change from the
current implementation, which also renders a label. STHS already has a
logo configured; add the STM logo above to its button. Clicking opens the
school's public website (sths.org / stthomasmore-school.org) in a new tab,
same as today.

CLASS SCHEDULE COLUMNS (Luke, Noah)

Each column shows every one of that child's classes for TODAY, in a
vertical list, ordered by start time, including classes that already
happened earlier today (not just what's upcoming) — the point is "what
does today look like," not just "what's next." Each tile shows:

- Time range (e.g. "8:00 – 8:50am")
- Class name
- Location, if the feed provides one

The class currently in progress (now between its start and end time) is
visually highlighted (colored border/background using the child's color)
so it's glanceable from across the room which period is happening right
now. This highlight needs to update on its own as time passes without a
new fetch — reuse the existing per-minute updateDom() tick that
MMM-DashboardNavigation already runs while a non-Home page is showing
(scheduleStatusBarTick()) rather than adding a second timer.

An all-day feed entry (e.g. "No School — Teacher Workday") is shown as its
own distinct tile (no time range, styled differently) rather than being
dropped, since that's exactly the kind of thing that matters more than a
regular period.

Loading/empty/error states per column:

- Before the first fetch completes: "Loading today's schedule…"
- Feed reachable but nothing scheduled today: "No classes scheduled today"
- Feed unreachable / parse failure: "Schedule unavailable" (log the real
  error server-side; don't put error details in the UI)

ANNALISE'S COLUMN (no feed)

Static card: STM logo, plus a short note that no schedule feed is
available yet. Same footer button pattern as her brothers (see below),
pointed at her coursework portal once that URL exists — for now it stays
disabled the same way the current annalise-renweb button does when its
url is null.

COURSEWORK/GRADES BUTTON (per child)

Each column keeps a footer button opening that child's gradebook/
coursework site in a new tab — this is exactly the luke-profile/
noah-profile/annalise-renweb links that exist in the current config,
relocated from their own button row into the bottom of each child's
column. Behavior is unchanged: disabled when the url is null (Annalise,
today).

DATA FETCHING ARCHITECTURE

Browsers can't fetch cross-origin iCal feeds directly (no CORS, and
webcal:// isn't a fetchable scheme), so this needs a node_helper.js for
MMM-DashboardNavigation (it doesn't have one today).

Reuse defaultmodules/calendar/calendarfetcher.js (CalendarFetcher) rather
than writing a second iCal fetch/parse/retry/backoff implementation. It
already handles: webcal-style URLs (after the same "webcal://" ->
"http://" replace calendar.js does before constructing it), HTTP retry/
backoff via HTTPFetcher, and — importantly — RRULE recurring-event
expansion via CalendarFetcherUtils.expandRecurringEvent, which a class
schedule absolutely needs (periods recur Mon/Wed/Fri etc., they aren't
one-off events).

Per child with a scheduleUrl, node_helper.js creates one CalendarFetcher
with maximumNumberOfDays: 1 and includePastEvents: true (so earlier
periods aren't dropped just because they already ended — the generic
CalendarFetcher assumes "past" means "not interesting," which is wrong
here). On each onReceive callback, filter fetcher.events down to just the
instances whose start falls on today's calendar date, sort by start time,
and send them to the frontend as a SCHOOL_SCHEDULE_DATA socket
notification: { childId, events: [{ title, start, end, location,
fullDayEvent }] }. On onError, send SCHOOL_SCHEDULE_ERROR: { childId,
message } and log the real error via Log.error server-side.

Also re-run that same "filter fetcher.events down to today" step on a
periodic timer (every few minutes) independent of the HTTP refetch
interval, so the schedule rolls over to the next day shortly after
midnight even if the feed itself doesn't happen to refetch right then —
re-filtering cached data is cheap; there's no reason to wait for a network
round-trip just to notice the calendar date changed.

Frontend subscribes once in start() (not only when the School page is
opened) by sending SCHOOL_SUBSCRIBE_SCHEDULES with the configured children
who have a scheduleUrl, so data is very likely already cached by the time
someone actually taps into School. Cache the last received state per
child in the module instance; re-render only calls updateDom() again, no
new subscribe.

CONFIGURATION SHAPE

Replace the current school.rows (array of button rows) with:

{
school: {
schoolSites: [
{ id: "sths", label: "STHS", url: "http://sths.org/", logo: "..." },
{ id: "stm", label: "STM", url: "https://stthomasmore-school.org/", logo: "..." }
],
children: [
{
id: "luke", name: "Luke", color: "#03C1FF", avatar: "",
scheduleUrl: "webcal://...", portalUrl: "https://...",
portalLabel: "Grades & Coursework"
},
{
id: "noah", name: "Noah", color: "#98FB98", avatar: "",
scheduleUrl: "webcal://...", portalUrl: "https://...",
portalLabel: "Grades & Coursework"
},
{
id: "annalise", name: "Annalise", color: "#B19CD9", avatar: "",
logo: "... STM logo ...", scheduleUrl: null, portalUrl: null,
portalLabel: "Coursework Portal"
}
],
scheduleRefreshMinutes: 30,
announcementsUrl: "webcal://...",
announcementsRefreshMinutes: 60,
announcementsWindowDays: 7,
announcementsMaxItems: 5
}
}

VISUAL DESIGN

Match the existing dashboard aesthetic (dark background, thin borders,
rounded corners, uppercase letter-spaced labels) and specifically mirror
MMM-Chores' board/column/avatar/tile conventions (mc-board, mc-column,
mc-avatar, mc-tile) so the School and Chores pages read as the same
system. Reuse the same three kid colors already used by MMM-Chores'
childColors and the calendar module's per-child calendar colors in
config.js — do not invent new colors for the same kids.

FILES TOUCHED

modules/MMM-DashboardNavigation/
MMM-DashboardNavigation.js — renderSchoolPage() rewrite, socket
notification handling, subscribe-on-start,
announcements banner, Chores-matching
hexToRgba/darkenToRgba color helpers
MMM-DashboardNavigation.css — school-page styles, matching MMM-Chores'
column/tile color treatment
node_helper.js — new file: per-child CalendarFetcher for
schedules (today-filtering, periodic
re-filter) plus one shared CalendarFetcher
for announcements (multi-day window,
past events excluded)
README.md — update to describe the new page

config/config.js — schoolSites/children shape plus announcementsUrl, using
the real logo/schedule/portal/announcements URLs already on file.

NOT IN SCOPE (see top of this document)

- Assignments-due badges (stretch goal, no data source yet)
- Automatic day-boundary edge cases beyond "re-filter every few minutes" —
  no need for a precise midnight-triggered timer
