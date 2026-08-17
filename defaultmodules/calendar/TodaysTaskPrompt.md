I am building a custom MagicMirror² module called MMM-TodaysTasks.

Build this as a production-quality MagicMirror² module using JavaScript/Node.js.

NOTE: A related concept (MMM-AroundNow) displays a 7-day view with a ±3 hour time window centered on the current time.
That module might be better suited for a time-window display if desired in the future, while this module focuses on today's full event list.

PURPOSE
-------

MMM-TodaysTasks displays all calendar events occurring today in the left_center region of my MagicMirror.

IMPORTANT ARCHITECTURAL REQUIREMENT
-----------------------------------

Do NOT implement a calendar integration inside this module.

I will have multiple calendar sources, potentially including:

- RSS calendar feeds
- iCal/ICS feeds
- Google Calendar
- Multiple calendars of the same type

MagicMirror's existing built-in "calendar" module will be responsible for retrieving and consolidating those calendar sources.

MMM-TodaysTasks must consume the events broadcast by MagicMirror's calendar module through the CALENDAR_EVENTS notification.

The module should not care where an event originated.

CALENDAR EVENT MODEL
--------------------

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

TODAY FILTERING
---------------

Display only events that occur on the current calendar day.

Use the MagicMirror/server/browser local timezone appropriately.

Sort events chronologically by start time.

Handle all-day events.

Do not attempt to calculate drive time for all-day events.

If there are no events today, display:

TODAY
No events

DISPLAY
-------

The module should display approximately:

TODAY

          Title                       EDT

---

8:00 AM Team Standup
9:30 AM Dentist Appointment 24 min
11:00 AM Work on API
1:00 PM Lunch 12 min
3:30 PM Pick up kids
6:00 PM Baseball Practice 31 min

COLUMN REQUIREMENTS
-------------------

Time:

- Fixed-width column.
- Right aligned.
- Display local event start time.
- Format like "8:00 AM".

Title:

- Flexible-width column.
- Left aligned.
- Display the calendar event title.
- DO NOT display the address/location.

EDT:

- Fixed-width column.
- Right aligned.
- EDT means "Estimated Drive Time".
- Display values such as "24 min".
- If there is no event location, leave EDT blank.
- Do not display the address.

The three columns must remain aligned across all event rows.

Example:

          Title                       EDT

8:00 AM Team Standup
9:30 AM Dentist Appointment 24 min
11:00 AM Work on API
1:00 PM Lunch 12 min
3:30 PM Pick up kids
6:00 PM Baseball Practice 31 min

Do not display an address anywhere in the event row.

CALENDAR COLORS
---------------

The calendar module may provide information identifying which calendar an event came from.

Preserve that information internally.

If practical, allow a calendar-specific color to be used as a subtle visual indicator, but do not make this a requirement for the first implementation.

TRAFFIC / ESTIMATED DRIVE TIME
------------------------------

Use Google's Google Maps Platform Routes API to calculate traffic-aware driving duration.

Do not use Waze for the initial implementation.

The origin will be configured by the user.

Example configuration:

origin: "MY HOME ADDRESS" - 6023 Wigton Dr. Houston, TX 77096

The destination should come from the event's location.

If an event does not have a location:

- Do not call the routing API.
- Leave EDT blank.

The routing request must be traffic-aware.

Use Google's current Routes API.

API SECURITY
------------

The Google Maps API key must NOT be exposed in frontend JavaScript.

Google API requests must be made from node_helper.js.

Prefer reading the API key from an environment variable rather than committing it to config.js.

For example:

GOOGLE_MAPS_API_KEY

Allow configuration to override this only if there is a compelling reason.

Never hard-code the API key.

CACHING
-------

Do not make a Google API request every time the DOM renders.

Cache drive-time results.

Default cache duration:

10 minutes

Make the cache duration configurable:

trafficRefreshMinutes: 10

Cache should be based on at least:

- origin
- destination

If multiple events have the same destination, avoid duplicate API requests.

Only calculate drive time for:

- today's events
- events with a location
- non-all-day events

Consider whether an event has already passed before requesting a new route.

The module should remain efficient because it will run continuously on a MagicMirror.

MAGICMIRROR COMMUNICATION
-------------------------

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

EVENT UPDATES
-------------

The module must respond when MagicMirror sends new CALENDAR_EVENTS notifications.

When calendar events change:

1. Replace the internal event collection.
2. Filter for today's events.
3. Sort them.
4. Determine which events require drive-time calculations.
5. Request missing/stale drive-time information.
6. Render the updated display.

Do not unnecessarily re-request drive times for events whose cached values are still valid.

TIME UPDATES
------------

The module should recognize when the calendar day changes.

For example, at midnight it should automatically switch from yesterday's events to today's events.

Do not require MagicMirror to restart for this.

A lightweight periodic check is acceptable.

ERROR HANDLING
--------------

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

CONFIGURATION
-------------

Support configuration similar to:

{
module: "MMM-TodaysTasks",
position: "left_center",

    config: {
        origin: "MY HOME ADDRESS",
        trafficRefreshMinutes: 10,
        maxEvents: 10
    }

}

The Google API key should preferably come from:

process.env.GOOGLE_MAPS_API_KEY

Allow maxEvents to be configured.

Do not make assumptions about the user's home address.

VISUAL DESIGN
-------------

Use standard MagicMirror typography and styling where possible.

The module should be compact enough for the left_center region.

Use:

TODAY

as the heading.

Column headers:

Title EDT

Time should not have a header unless needed for alignment.

Use a clean table-like CSS layout.

Time:

- right aligned
- fixed width

Title:

- left aligned
- flexible width

EDT:

- right aligned
- fixed width

Do not display addresses.

If an EDT value is unavailable, leave the cell blank.

Do not show unnecessary icons unless they materially improve readability.

FILES
-----

Create:

MMM-TodaysTasks/
MMM-TodaysTasks.js
node_helper.js
MMM-TodaysTasks.css
package.json
README.md

README
------

The README must explain:

1. What the module does.
2. That it consumes the existing MagicMirror calendar module.
3. How to configure multiple calendars using MagicMirror's calendar module.
4. How to configure MMM-TodaysTasks.
5. How to configure GOOGLE_MAPS_API_KEY.
6. Required Google APIs/services.
7. How to install the module.
8. How to restart MagicMirror.
9. Troubleshooting.

ARCHITECTURE
------------

Keep the routing provider separated from the calendar display.

Conceptually:

Calendar Module
|
| CALENDAR_EVENTS
v
MMM-TodaysTasks
|
v
TravelTimeService
|
v
Google Routes API

Structure the code so a different routing provider could eventually replace Google.

Do not over-engineer this.

IMPORTANT
---------

Before writing the code:

1. Explain the architecture.
2. Explain exactly how MMM-TodaysTasks receives CALENDAR_EVENTS.
3. Explain how today's events will be identified.
4. Explain how drive-time caching will work.
5. Explain how the Google API key will be protected.
6. Identify any assumptions about MagicMirror calendar event properties.

Then create all required files.

After creating the files, explain:

- Where the module directory should be placed.
- What to add to config.js.
- How to set GOOGLE_MAPS_API_KEY.
- How to configure the existing calendar module.
- How to start/restart MagicMirror.
- How to test the module.
