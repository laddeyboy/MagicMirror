I am building a custom MagicMirror² module called MMM-TodaysTasks.

Build this as a production-quality MagicMirror² module using JavaScript/Node.js.

NOTE: A related concept (MMM-AroundNow) displays a 7-day view with a ±3 hour time window centered on the current time. That module might be better suited for a time-window display if desired in the future, while this module focuses on today's full event list.

I have also attached a screenshot of my current MagicMirror calendar functionality. Use it as a visual reference for some of the calendar event behaviors described below.

IMPORTANT: Do not simply copy the existing calendar module's layout. The new module should use the cleaner Title / EDT table layout described below while incorporating useful visual/status features from the existing calendar.

---

## PURPOSE

MMM-TodaysTasks displays all calendar events occurring today in the left_center region of my MagicMirror.

It should provide a concise "What do I have to do today?" view.

The module should combine:

- Event time
- Event title
- Estimated Drive Time (EDT)
- Event/activity icon
- Event status such as "In 41 minutes" or "Ends in 41 minutes"

The display should remain compact and readable from several feet away.

---

## IMPORTANT ARCHITECTURAL REQUIREMENT

Do NOT implement a calendar integration inside this module.

I will have multiple calendar sources, potentially including:

- RSS calendar feeds
- iCal/ICS feeds
- Google Calendar
- Multiple calendars of the same type

MagicMirror's existing built-in "calendar" module will be responsible for retrieving and consolidating those calendar sources.

MMM-TodaysTasks must consume the events broadcast by MagicMirror's calendar module through the CALENDAR_EVENTS notification.

The module should not care where an event originated.

Do not create separate Google Calendar, iCal, RSS, or other calendar integrations.

---

## CALENDAR EVENT MODEL

Treat incoming calendar events as normalized calendar events.

Use the properties provided by MagicMirror where available, including:

- title
- startDate
- endDate
- location
- geo
- calendarName
- symbol
- fullDayEvent

Do not assume that every calendar source provides every property.

Preserve the calendar/source information internally because it may be useful for:

- calendar colors
- activity identification
- icons
- future filtering

---

## TODAY FILTERING

Display only events occurring on the current calendar day.

Use the MagicMirror/server/browser local timezone appropriately.

Sort events chronologically by start time.

Handle:

- normal events
- events currently in progress
- events that have not started
- all-day events

Do not calculate drive time for all-day events.

If there are no events today, display:

TODAY

No events

---

## PRIMARY DISPLAY

The module should use a clean table-like layout, with NO header row above the events
(no literal "Title" / "EDT" column labels).

Conceptually:

TODAY

---

8:00 AM Team Standup
9:30 AM Dentist Appointment 🚗 24 min
11:00 AM Work on API
1:00 PM Lunch 🚗 12 min
3:30 PM Baseball Practice 🚗 31 min
6:00 PM Team Meeting
All Day Company Holiday

The exact spacing should be handled with CSS rather than literal spaces.

---

## COLUMN REQUIREMENTS

## TIME

- Fixed-width column.
- Right aligned.
- Display local event start time.
- Format like:
  8:00 AM
  9:30 AM
  11:00 AM
- All-day events display the literal text "All Day" instead of a time.

## TITLE

- Flexible-width column.
- Left aligned.
- Display the calendar event title.
- DO NOT display the address/location.
- Allow enough room for the title to remain readable.

## EDT

- Fixed-width column.
- Right aligned.
- EDT means "Estimated Drive Time".
- Display values such as:
  24 min
  12 min
  31 min

If there is no event location:

- Do not call the routing API.
- Leave EDT blank.

If there is a location AND a drive time has been computed:

- Prefix the drive-time text with a Font Awesome car-side icon (`fa-car-side`), e.g.:
  🚗 24 min

If there is a location but a drive time has NOT yet been computed (loading, no API key, or the request failed):

- Leave EDT blank. Do not show the car icon without a value next to it.

Do not display the address anywhere in the event row.

The three primary columns must remain aligned across every row.

There is no header row above the event rows. Column meaning should be obvious from
the data itself (times, titles, and the car icon marking EDT) rather than from column
labels. This also avoids a real layout bug: with `table-layout: fixed`, a short header
row ("TITLE" / "EDT") can be used by the browser to compute the table's intrinsic width
when the containing region has no definite width of its own, shrinking the whole table
down to fit the header instead of the actual event content.

Do NOT "fix" this by giving `.tt-wrapper` a hard-coded fixed `width` in px. That was
tried and caused a second, worse bug: this module can be positioned in a region like
`top_center` that has no fixed width of its own (it's shrink-to-fit/centered), and
`.region.top .module` also has `overflow: hidden`. A hard-coded width wider than the
region's actual available space gets silently clipped — in practice this clipped off
the entire EDT column (the rightmost one), even though it was rendering correctly in
the DOM with the right content the whole time. The correct, responsive fix is:
`.tt-wrapper { width: 100%; min-width: 300px; max-width: 480px; box-sizing:
border-box; }`. `width: 100%` lets it fill an actually-determinate container (e.g.
`left_center`, which flex-stretches modules to a real pixel width) instead of
overflowing it; `min-width` is the part that avoids reintroducing the original
intrinsic-sizing bug — without it, a shrink-to-fit container (like `top_center`) could
still under-size the table based on whichever row's content the browser happens to use
for its intrinsic-width guess (e.g. a short all-day title like "PICU", which sorts
first since all-day events come before timed ones). `max-width` is just a sensible
visual cap, not required for correctness.

IMPORTANT: MagicMirror does NOT scope/sandbox module CSS. Every installed module's
stylesheet is loaded globally into the same document, so a broad selector in some other
module's CSS (e.g. a `table, tr, td { display: block; }` reset used for its own
responsive design) can silently break MMM-TodaysTasks's table layout, even though
MMM-TodaysTasks.css itself is unchanged. The observed symptom of this is each event's
Time/Title/EDT cells stacking vertically instead of sitting side-by-side in one row
(e.g. "All Day" rendering above the event title instead of to its left). Guard against
this by explicitly declaring `display: table` / `display: table-row` / `display:
table-cell` on `.tt-table`, `.tt-row`, and `.tt-table td` respectively, rather than
relying on the browser's default table rendering, since defaults can be overridden by
any other module's unrelated global CSS.

CONFIRMED REAL-WORLD CASE OF THIS: MMM-WeeklyCalendar.css (another installed module in
this MagicMirror setup) defines its own generic `.event { display: flex; flex-direction:
column; ...card styling... }` class for its own event cards. MMM-TodaysTasks originally
gave its row elements the class `"tt-row event"`, reusing the generic `event` name. Both
`.tt-row` and `.event` are single-class selectors of equal specificity, so the one whose
stylesheet loads later in the document wins — and since MMM-WeeklyCalendar is configured
after MMM-TodaysTasks in config.js, its `.event` rule won, turning every row into a
column flexbox and stacking the Time/Title/EDT cells vertically. The `display: table-row`
hardening above was necessary but not sufficient; the real fix was to stop using the
unprefixed, generic class name `event` at all. Every CSS class name introduced by this
module must use the `tt-` prefix (as all the other classes already do) so it can never
collide with another module's class names — never add a bare/generic class like `event`,
`title`, `time`, or `icon` to any element this module creates.

---

## EVENT STATUS

I particularly like the existing MagicMirror calendar module's ability to show relative event status.

In the screenshot, upcoming events can display information such as:

"In 41 minutes"

and events currently in progress can display:

"Ends in 41 minutes"

Incorporate this behavior into MMM-TodaysTasks.

For an upcoming event:

```text
3:30 PM   Baseball Practice
          In 41 minutes
```

For an event currently happening:

```text
5:00 PM   Baseball Practice
          Ends in 41 minutes
```

The relative status should update automatically as time passes.

Use the event's actual startDate and endDate.

Rules:

1. If the event has not started:

   - Show "In X minutes".

2. If the event is currently happening:

   - Show "Ends in X minutes".

3. If the event has already ended:

   - Do not display a relative status.

4. If the event is an all-day event:

   - Do not display a relative status.

5. If the event starts in less than one minute:

   - Display something appropriate such as "Starting now".

6. Avoid awkward values such as "In 0 minutes".

The relative status should be subtle and secondary to the event title.

Do not make the relative status another table column.

It should appear visually associated with the event title/status area.

---

## EVENT ICONS

The existing MagicMirror calendar display uses useful activity icons.

For example, the current display uses a volleyball icon for volleyball-related events.

I want MMM-TodaysTasks to incorporate this concept.

Display a small activity icon associated with the event when one can reasonably be determined.

Examples:

- Baseball → baseball icon
- Volleyball → volleyball icon
- Basketball → basketball icon
- Soccer → soccer icon
- Football → football icon
- Swimming → swimming icon
- Tennis → tennis icon
- School → school icon
- Meeting → meeting/calendar icon
- Appointment → calendar/appointment icon

The icon should be small and visually secondary to the title.

Do not display an icon if the activity cannot reasonably be determined.

Do not use random icons simply to fill space.

---

## ICON DETECTION

Create a configurable activity/icon mapping.

Activity detection can consider:

- event title
- calendar name
- symbol
- other available calendar metadata

For example:

"Baseball Practice"
"Baseball Game"
"Baseball Lesson"

should reasonably identify as baseball.

Likewise:

"Volleyball Practice"
"Volleyball Game"

should identify as volleyball.

The matching should be case-insensitive.

Use keyword-based matching initially.

For example, conceptually:

baseball:
baseball
baseball practice
baseball game

volleyball:
volleyball
volleyball practice
volleyball game

basketball:
basketball

etc.

Keep this mapping easy to extend.

Do not require an external icon service.

Prefer a locally available icon/font/library if the existing MagicMirror environment provides one.

If the existing calendar module already uses an icon system that can safely be reused, investigate that before introducing another icon dependency.

---

## ICON POSITION

The icon should NOT interfere with the EDT column.

The conceptual row should be:

## Time Title / Status EDT

8:00 AM ⚾ Baseball Practice 31 min
In 41 minutes

or:

9:30 AM 🏐 Volleyball Practice
Ends in 20 minutes 18 min

Use actual CSS positioning/layout rather than emoji if a better existing MagicMirror icon system is available.

The icon should have a consistent width so event titles remain aligned.

---

## CALENDAR COLORS

The existing calendar module uses different colors for different calendars/activity types.

Preserve calendar/source information internally.

If practical, allow a calendar-specific color to be used as a subtle visual indicator.

For example, the event title or icon could inherit the calendar's color.

Do not make the entire row brightly colored.

The design should remain clean and readable.

If the existing calendar module already provides a color associated with the event, reuse it rather than inventing a second color system.

---

## CURRENT EVENT VISUAL STATE

Events that are currently in progress should be visually distinguishable from future events.

For example:

Upcoming:

3:30 PM ⚾ Baseball Practice
In 41 minutes

Currently happening:

5:00 PM ⚾ Baseball Practice
Ends in 41 minutes

The current event could use:

- slightly brighter text
- subtle emphasis
- a small indicator
- calendar color emphasis

Do not make the design excessively flashy.

---

## TRAFFIC / ESTIMATED DRIVE TIME

Use Google's Google Maps Platform Routes API to calculate traffic-aware driving duration.

Do not use Waze for the initial implementation.

The origin will be configured by the user.

Example:

origin: "6023 Wigton Dr. Houston, TX 77096"

The destination should come from the event's location.

If an event does not have a location:

- Do not call the routing API.
- Leave EDT blank.

The routing request must be traffic-aware.

Use Google's current Routes API.

---

## API SECURITY

The Google Maps API key must NOT be exposed in frontend JavaScript.

Google API requests must be made from node_helper.js.

Prefer reading the API key from an environment variable rather than committing it to config.js.

For example:

GOOGLE_MAPS_API_KEY

Allow configuration to override this only if there is a compelling reason.

Never hard-code the API key.

---

## CACHING

Do not make a Google API request every time the DOM renders.

Cache drive-time results.

Default cache duration:

10 minutes

Make the cache duration configurable:

trafficRefreshMinutes: 10

Cache should be based on at least:

- origin
- destination

If multiple events have the same destination, avoid duplicate API calls.

Only calculate drive time for:

- today's events
- events with a location
- non-all-day events

Consider whether an event has already passed before requesting a new route.

The module should remain efficient because it will run continuously on a MagicMirror.

---

## MAGICMIRROR COMMUNICATION

Use standard MagicMirror module architecture.

MMM-TodaysTasks.js should use:

- Module.register()
- start()
- getDom()
- notificationReceived()
- socketNotificationReceived()

node_helper.js should handle:

- Google Routes API requests
- caching
- traffic calculations
- error handling

Use socket notifications between the frontend module and node_helper.

Do not use React, Vue, TypeScript, or another frontend framework.

Keep dependencies minimal.

---

## EVENT UPDATES

The module must respond when MagicMirror sends new CALENDAR_EVENTS notifications.

When calendar events change:

1. Replace the internal event collection.
2. Filter for today's events.
3. Sort them chronologically.
4. Determine activity/icon information.
5. Determine current/upcoming status.
6. Determine which events require drive-time calculations.
7. Request missing/stale drive-time information.
8. Render the updated display.

Do not unnecessarily re-request drive times for events whose cached values are still valid.

---

## TIME UPDATES

The relative event status needs to update without requiring new calendar data.

For example:

"In 41 minutes"

should eventually become:

"In 40 minutes"

and eventually:

"Starting now"

Likewise:

"Ends in 41 minutes"

should count down.

Use a lightweight timer.

Do not reload the entire calendar data every minute.

The timer should update only the information that needs to change.

The module should also recognize when the calendar day changes.

At midnight:

- switch to the new day's events
- clear stale event data
- process the new day's events

Do not require MagicMirror to restart.

---

## ERROR HANDLING

If Google Maps cannot be reached:

- Do not crash.
- Continue displaying calendar events.
- Leave EDT blank or display "--".
- Log a useful server-side error.

If a destination cannot be resolved:

- Leave EDT blank.
- Continue displaying the event.

If the API key is missing:

- Calendar functionality must still work.
- EDT remains blank.
- Log a clear configuration warning.

If the calendar module sends malformed/incomplete data:

- Handle it gracefully.
- Do not crash MagicMirror.

If an event has no title:

- Handle it gracefully rather than crashing.

---

## CONFIGURATION

Support configuration similar to:

```json5
{
  module: "MMM-TodaysTasks",
  position: "left_center",
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

The Google API key should preferably come from:

process.env.GOOGLE_MAPS_API_KEY

Allow maxEvents to be configured.

Allow the icon/status features to be independently enabled or disabled.

Do not make assumptions about the user's home address beyond the configured origin.

---

## VISUAL DESIGN

Use standard MagicMirror typography and styling where possible.

The module should be compact enough for the left_center region.

Use:

TODAY

as the heading.

There is no header row (no literal "Title" / "EDT" labels) between the heading and the
events — the events start immediately below the heading.

The design should be inspired by the existing MagicMirror calendar module shown in the attached screenshot, but should NOT simply reproduce its layout.

The new layout should remain a structured table/list.

Example:

TODAY

---

8:00 AM 📅 Team Standup
In 41 minutes

9:30 AM 🏥 Dentist Appointment 🚗 24 min
In 2 hours

11:00 AM 💻 Work on API

1:00 PM 🍴 Lunch 🚗 12 min

3:30 PM ⚾ Baseball Practice 🚗 31 min
Ends in 41 minutes

All Day 🎉 Company Holiday

The actual icons should use the chosen icon implementation rather than necessarily using emoji. The 🚗 above represents the Font Awesome car-side icon (`fa-car-side`), shown only when a location is set AND a drive time has been successfully computed.

Keep the visual hierarchy:

1. Event title
2. Time
3. EDT
4. Relative status
5. Activity icon

Do not display addresses.

If an EDT value is unavailable, leave the cell blank.

---

## RESPONSIVE / LONG TITLES

Calendar events can have long titles.

Do not allow long titles to destroy the column alignment.

Use CSS to handle long titles gracefully.

Possible approaches:

- truncate with ellipsis
- wrap to a second line

Prefer wrapping when there is sufficient vertical space.

The EDT column must remain aligned.

---

## MAX EVENTS

Support:

maxEvents: 10

If more than maxEvents occur today:

- Display the first maxEvents chronologically.
- Make it obvious that additional events exist.

For example:

- 3 more events

If practical, make maxEvents configurable.

Do not silently discard events without indication.

---

## FILES

Create:

MMM-TodaysTasks/
MMM-TodaysTasks.js
node_helper.js
MMM-TodaysTasks.css
package.json
README.md

---

## README

The README must explain:

1. What the module does.
2. That it consumes the existing MagicMirror calendar module.
3. How to configure multiple calendars using MagicMirror's calendar module.
4. How to configure MMM-TodaysTasks.
5. How to configure GOOGLE_MAPS_API_KEY.
6. Required Google APIs/services.
7. How estimated drive time works.
8. How activity icons are determined.
9. How to add a new activity/icon mapping.
10. How to install the module.
11. How to restart MagicMirror.
12. Troubleshooting.

---

## ARCHITECTURE

Keep the routing provider separated from the calendar display.

Conceptually:

Calendar Module
|
| CALENDAR_EVENTS
v
MMM-TodaysTasks
|
+---- Event Processor
| |
| +---- Today filtering
| +---- Sorting
| +---- Relative status
| +---- Activity detection
| +---- Calendar colors
|
+---- TravelTimeService
|
v
Google Routes API

Structure the code so a different routing provider could eventually replace Google.

Do not over-engineer this.

---

## IMPORTANT: INSPECT EXISTING MAGICMIRROR FUNCTIONALITY

Before implementing the module, inspect how the existing MagicMirror calendar module works.

Specifically determine:

1. What properties are actually included in CALENDAR_EVENTS.
2. How calendar colors are provided.
3. How the existing calendar module determines event symbols/icons.
4. Whether its icon implementation can safely be reused.
5. How event start/end times are represented.
6. How all-day events are represented.

The screenshot I provided is a visual reference for the current calendar functionality.

Do not blindly assume the screenshot represents the underlying data structure.

Reuse existing MagicMirror functionality where appropriate instead of duplicating it.

---

## IMPORTANT

Before writing the code:

1. Explain the architecture.
2. Explain exactly how MMM-TodaysTasks receives CALENDAR_EVENTS.
3. Explain how today's events will be identified.
4. Explain how relative event status will be calculated.
5. Explain how activity icons will be determined.
6. Explain how calendar colors will be preserved.
7. Explain how drive-time caching will work.
8. Explain how the Google API key will be protected.
9. Identify any assumptions about MagicMirror calendar event properties.
10. Explain how the existing calendar module's icon functionality can or cannot be reused.

Then create all required files.

After creating the files, explain:

- Where the module directory should be placed.
- What to add to config.js.
- How to set GOOGLE_MAPS_API_KEY.
- How to configure the existing calendar module.
- How to start/restart MagicMirror.
- How to test calendar events.
- How to test an event with a location.
- How to test an event without a location.
- How to test an upcoming event.
- How to test a currently active event.
- How to add a new activity/icon mapping.
- How to adjust the visual layout.
