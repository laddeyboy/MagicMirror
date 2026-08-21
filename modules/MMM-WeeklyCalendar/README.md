# MMM-WeeklyCalendar

A weekly calendar view that displays all events for the current week, organized by day.

## Installation

- Module files are in `modules/MMM-WeeklyCalendar/`
- Add module entry to `config/config.js` with `module: "MMM-WeeklyCalendar"`

## Configuration

```json5
{
  module: "MMM-WeeklyCalendar",
  position: "bottom_center",
  config: {
    updateInterval: 60000, // Update every minute
    showTime: true, // Display event start times
    showLocation: false, // Hide location/address
    weekStartsOnSunday: true, // Week starts on Sunday
    maxEventsPerDay: 10 // Max events to display per day
  }
}
```

## Features

- Displays 7-day week view
- Organizes events by day with time display
- Highlights today's column
- Responsive grid layout
- Consumes CALENDAR_EVENTS from MagicMirror's calendar system
- Supports multiple calendar sources (RSS, iCal, Google Calendar, etc.)

## Event Properties

The module uses these properties from MagicMirror's calendar events:

- `title` - Event name
- `startDate` - Event start time
- `endDate` - Event end time
- `fullDayEvent` / `fullDay` / `allDay` - All-day event flag
- `location` - Event location (currently not displayed)
- `calendarName` - Source calendar name
