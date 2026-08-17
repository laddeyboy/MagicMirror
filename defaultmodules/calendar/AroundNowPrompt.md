I am building a custom MagicMirror² module called MMM-AroundNow.

Build this as a production-quality MagicMirror² module using JavaScript/Node.js.

PURPOSE
-------

MMM-AroundNow is a visual calendar module for the center portion of my MagicMirror.

It displays a 7-day calendar view centered around the current time.

The view should show:

- 3 days before today
- today
- 3 days after today

Therefore the horizontal calendar contains 7 day columns.

The vertical time window should always be:

CURRENT TIME - 3 HOURS
through
CURRENT TIME + 3 HOURS

The current time should remain approximately centered vertically.

Example:

If the current time is 8:30 PM, display approximately:

5:30 PM
6:30 PM
7:30 PM
8:30 PM <-- NOW
9:30 PM
10:30 PM
11:30 PM

As time passes, the calendar should move accordingly.

IMPORTANT CALENDAR ARCHITECTURE
--------------------------------

Do NOT implement separate calendar integrations inside this module.

I will have multiple calendar sources, potentially including:

- RSS calendar feeds
- iCal/ICS feeds
- Google Calendar
- Multiple calendars of each type

The existing MagicMirror "calendar" module will retrieve those calendars.

MMM-AroundNow must consume the normalized events broadcast by MagicMirror through:

CALENDAR_EVENTS

The module must not care whether an event came from:

- RSS
- iCal
- Google Calendar
- another calendar source

It should treat all incoming events as calendar events.

CALENDAR EVENT MODEL
--------------------

Use the properties provided by MagicMirror where available:

- title
- startDate
- endDate
- location
- geo
- calendarName
- symbol
- fullDayEvent

Do not assume every source provides every property.

VIEW
----

Display a 7-day horizontal calendar:

             SUN       MON       TUE       WED       THU       FRI       SAT

5:30 PM
6:30 PM
7:30 PM
8:30 PM NOW
9:30 PM
10:30 PM
11:30 PM

Today should be visually distinguished from the other days.

The exact visual style can be refined after the first implementation.

DAY COLUMNS
-----------

Display:

- Today - 3 days
- Today - 2 days
- Today - 1 day
- Today
- Today + 1 day
- Today + 2 days
- Today + 3 days

Each column should show:

- abbreviated day of week
- date

Example:

SUN 16
MON 17
TUE 18
WED 19
THU 20
FRI 21
SAT 22

TODAY should be visually emphasized.

CURRENT TIME
------------

The current time should be represented by a horizontal NOW line.

Example:

------------------------------------------------ NOW
●
------------------------------------------------

The line should move as time passes.

The NOW line should remain centered around the current time.

EVENT DISPLAY
-------------

Events should appear in the appropriate day/time column.

For example:

                     TUE
                     18

7 PM
┌─────────────────┐
│ Baseball Practice│
└─────────────────┘

8 PM
┌──────────────┐
│ Dinner │
└──────────────┘

Events should be positioned vertically according to their start/end times.

The event's vertical position should correspond to its actual time.

The event's height should correspond approximately to its duration.

EVENT OVERLAPS
--------------

Support overlapping events.

If two events occur at the same time:

                     ┌──────────┐
                     │ Event A  │
                     └──────────┘
                     ┌──────────┐
                     │ Event B  │
                     └──────────┘

Do not allow overlapping events to completely cover each other.

Use a reasonable column subdivision strategy.

MULTIPLE CALENDARS
------------------

Multiple calendars will be displayed in this module.

Preserve the source calendar information from the incoming event.

If calendar-specific color information is available, use it.

Otherwise provide configurable colors for different calendar sources.

For example:

Work
Family
Baseball
School
Personal

The exact colors should be configurable.

The module should not assume those are the actual calendar names.

CALENDAR CONSOLIDATION
----------------------

The same event may potentially appear in multiple calendar feeds.

Do not immediately assume every identical-looking event is a duplicate.

However, implement a reasonable duplicate-detection strategy if practical.

Potential duplicate criteria:

- same/similar title
- same start time
- same end time
- same location

If two events appear to be duplicates, avoid displaying the same event twice.

Make this behavior configurable if practical.

TIME WINDOW
-----------

The vertical display window is dynamic.

It should always represent:

now - 3 hours
through
now + 3 hours

The user should not need to manually change the time window.

For example:

8:00 AM:

5:00 AM
6:00 AM
7:00 AM
8:00 AM NOW
9:00 AM
10:00 AM
11:00 AM

At 10:00 AM:

7:00 AM
8:00 AM
9:00 AM
10:00 AM NOW
11:00 AM
12:00 PM
1:00 PM

The calendar should smoothly update as time passes.

TIME SCALE
----------

Use a configurable number of pixels per hour.

Example:

pixelsPerHour: 80

Allow this to be configured.

The module should calculate event positions rather than hard-coding individual time rows.

EVENTS OUTSIDE WINDOW
--------------------

Events outside the ±3 hour window should normally not be displayed.

However, events that overlap the window should be displayed.

For example:

An event from 4:00 PM to 6:00 PM should appear partially in the window if the window starts at 5:00 PM.

Clip the visible event to the calendar viewport.

ALL-DAY EVENTS
-------------

Handle all-day events separately.

Do not attempt to position all-day events on the hourly timeline.

Provide a small all-day section above the hourly timeline if practical.

Example:

ALL DAY
MON TUE WED
School Holiday Baseball Camp

If implementing this makes the first version unnecessarily complex, make it a clearly separated second phase.

EVENT DETAILS
-------------

Display the event title.

Do not display the event location/address.

Do not display drive time.

This module is purely a calendar visualization.

HORIZONTAL SCROLLING
--------------------

The first version should display all 7 days simultaneously.

Do not require horizontal scrolling.

The module should be designed so the 7 columns fit within its configured width.

RESPONSIVENESS
--------------

The module should calculate column widths based on the available width.

Do not hard-code the entire calendar to a single screen resolution.

MAGICMIRROR COMMUNICATION
-------------------------

Use standard MagicMirror module architecture:

- Module.register()
- start()
- getDom()
- notificationReceived()
- socketNotificationReceived()

Listen for:

CALENDAR_EVENTS

Do not create a second calendar retrieval system.

TIME UPDATES
------------

The module needs a timer that updates the current time.

It should update often enough that the NOW line and event positioning remain accurate.

Do not update the entire DOM unnecessarily every second if that is not required.

A reasonable approach is:

- update the current time/position every 30-60 seconds
- re-render calendar events only when necessary

The module should automatically handle the transition to a new day.

When midnight passes:

- recalculate the seven displayed dates
- update the event window
- request/use the latest CALENDAR_EVENTS data

PERFORMANCE
-----------

This module will run continuously.

Avoid:

- unnecessary DOM recreation
- excessive timers
- excessive event processing
- memory leaks

Use one controlled timer and clean it up when appropriate.

VISUAL DESIGN
-------------

Use MagicMirror's existing typography.

The calendar should be visually clean and readable from several feet away.

Recommended structure:

---

                     THIS WEEK

---

       SUN       MON       TUE       WED       THU       FRI       SAT
       16        17        18        19        20        21        22

---

5 PM
------------------------------------------------------------

6 PM
┌───────────────┐
│ Baseball │
│ Practice │
└───────────────┘
------------------------------------------------------------

7 PM
------------------------------------------------------------

8 PM ----------------------------- NOW ----------------------
------------------------------------------------------------

9 PM
┌───────────────┐
│ Dinner │
└───────────────┘
------------------------------------------------------------

10 PM
------------------------------------------------------------

11 PM
------------------------------------------------------------

This is an approximate concept, not a requirement to reproduce the ASCII layout exactly.

CONFIGURATION
-------------

Support configuration similar to:

{
module: "MMM-AroundNow",
position: "middle_center",

    config: {
        hoursBefore: 3,
        hoursAfter: 3,
        pixelsPerHour: 80,
        updateInterval: 30000,
        showAllDayEvents: true,
        showCalendarColors: true
    }

}

Make these values configurable.

CALENDAR MODULE
---------------

The existing MagicMirror calendar module should be responsible for calendar feeds.

Example conceptually:

{
module: "calendar",
config: {
calendars: [
{
symbol: "calendar",
url: "ICAL_FEED_1"
},
{
symbol: "calendar",
url: "ICAL_FEED_2"
},
{
symbol: "calendar",
url: "GOOGLE_CALENDAR_FEED"
}
]
}
}

Do not hard-code these calendars into MMM-AroundNow.

ARCHITECTURE
------------

Keep responsibilities separated.

Conceptually:

Calendar Sources
|
v
MagicMirror Calendar Module
|
| CALENDAR_EVENTS
v
MMM-AroundNow
|
+--> Normalize/filter events
|
+--> Calculate 7-day range
|
+--> Calculate visible time range
|
+--> Calculate event positions
|
+--> Render calendar

Do not create a backend node_helper unless it is actually necessary.

This module does not need a routing API.

FILES
-----

Create:

MMM-AroundNow/
MMM-AroundNow.js
MMM-AroundNow.css
package.json
README.md

README
------

Explain:

1. What the module does.
2. That it consumes the existing MagicMirror calendar module.
3. How multiple calendars are configured.
4. How CALENDAR_EVENTS are consumed.
5. Configuration options.
6. Installation.
7. Troubleshooting.

IMPORTANT
---------

Before writing code:

1. Explain how MagicMirror's CALENDAR_EVENTS notification will be consumed.
2. Explain the internal normalized event representation.
3. Explain how the ±3 hour time window will be calculated.
4. Explain how event vertical positioning will be calculated.
5. Explain how overlapping events will be handled.
6. Explain how the NOW line will move.
7. Explain how the seven-day range will be calculated.
8. Explain how multiple calendars and calendar colors will be handled.

Then create all required files.

After creating the files, explain:

- Where to install the module.
- What to add to config.js.
- How it works with the existing calendar module.
- How to test it.
- How to customize the appearance.
