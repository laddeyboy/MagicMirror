Module.register("MMM-WeeklyCalendar", {
    defaults: {
        updateInterval: 60000,
        showTime: true,
        showLocation: false,
        weekStartsOnSunday: true,
        maxEventsPerDay: 10
    },

    start() {
        this.events = [];
        this.eventsBySender = {}; // Latest full event list per broadcasting module
        this.loaded = false;
        this.scheduleTimer();
    },

    scheduleTimer() {
        if (this._timer) clearInterval(this._timer);
        this._timer = setInterval(() => {
            this.updateDom();
        }, this.config.updateInterval);
    },

    notificationReceived(notification, payload, sender) {
        if (notification === "CALENDAR_EVENTS") {
            let eventList = [];
            if (payload && payload.events) {
                eventList = payload.events;
            } else if (Array.isArray(payload)) {
                eventList = payload;
            }

            // Each broadcast is that sender's FULL current list, so replace
            // (not accumulate) its entry to avoid duplicating events.
            const senderKey = sender && sender.identifier ? sender.identifier : "default";
            this.eventsBySender[senderKey] = eventList;

            this.events = Object.values(this.eventsBySender).flat();

            this.loaded = true;
            this.updateDom(500);
        }
    },

    getStyles() {
        return [this.file("MMM-WeeklyCalendar.css")];
    },

    getDom() {
        const wrapper = document.createElement("div");
        wrapper.className = "weekly-calendar-wrapper";

        const now = new Date();
        const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

        // Calculate start of week
        let weekStart = new Date(today);
        if (this.config.weekStartsOnSunday) {
            const day = weekStart.getDay();
            weekStart.setDate(weekStart.getDate() - day);
        } else {
            const day = weekStart.getDay();
            weekStart.setDate(weekStart.getDate() - (day === 0 ? 6 : day - 1));
        }

        // Container for week view
        const weekContainer = document.createElement("div");
        weekContainer.className = "week-container";

        // Create day columns
        for (let i = 0; i < 7; i++) {
            const dayDate = new Date(weekStart);
            dayDate.setDate(dayDate.getDate() + i);

            const dayCol = document.createElement("div");
            dayCol.className = "day-column";

            // Check if this is today
            if (dayDate.toDateString() === today.toDateString()) {
                dayCol.classList.add("today");
            }

            // Day header
            const dayHeader = document.createElement("div");
            dayHeader.className = "day-header";
            const dayName = dayDate.toLocaleDateString(this.config.language || "en-US", { weekday: "short" });
            const dayNum = dayDate.getDate();
            dayHeader.innerHTML = `<div class="day-name">${dayName}</div><div class="day-num">${dayNum}</div>`;
            dayCol.appendChild(dayHeader);

            // Events container
            const eventsContainer = document.createElement("div");
            eventsContainer.className = "events-container";

            // Filter events for this day
            const dayEvents = this.events.filter(e => {
                if (!e.startDate) return false;
                // startDate comes as timestamp (string or number), convert to number for Date constructor
                const timestamp = typeof e.startDate === 'string' ? parseInt(e.startDate) : e.startDate;
                const eventDate = new Date(timestamp);
                return eventDate.toDateString() === dayDate.toDateString();
            });

            // Sort by start time
            dayEvents.sort((a, b) => {
                const aTimestamp = typeof a.startDate === 'string' ? parseInt(a.startDate) : a.startDate;
                const bTimestamp = typeof b.startDate === 'string' ? parseInt(b.startDate) : b.startDate;
                return aTimestamp - bTimestamp;
            });

            // Limit events displayed
            const visibleEvents = dayEvents.slice(0, this.config.maxEventsPerDay);

            if (visibleEvents.length === 0) {
                const noEvents = document.createElement("div");
                noEvents.className = "no-events";
                noEvents.textContent = "—";
                eventsContainer.appendChild(noEvents);
            } else {
                for (const event of visibleEvents) {
                    const eventEl = document.createElement("div");
                    eventEl.className = "event";

                    // Color events using the calendar's configured color, broadcast
                    // directly on the event by the calendar module.
                    if (event.color) {
                        eventEl.style.setProperty("--event-color", event.color);
                    }

                    // Event time
                    if (this.config.showTime && !event.fullDayEvent && !event.fullDay && !event.allDay) {
                        const eventTime = document.createElement("div");
                        eventTime.className = "event-time";
                        const timestamp = typeof event.startDate === 'string' ? parseInt(event.startDate) : event.startDate;
                        const startTime = new Date(timestamp);
                        eventTime.textContent = startTime.toLocaleTimeString(this.config.language || "en-US", {
                            hour: "numeric",
                            minute: "2-digit",
                            hour12: true
                        });
                        eventEl.appendChild(eventTime);
                    }

                    // Event title
                    const eventTitle = document.createElement("div");
                    eventTitle.className = "event-title";
                    eventTitle.textContent = event.title || "(untitled)";
                    eventEl.appendChild(eventTitle);

                    eventsContainer.appendChild(eventEl);
                }
            }

            dayCol.appendChild(eventsContainer);
            weekContainer.appendChild(dayCol);
        }

        wrapper.appendChild(weekContainer);

        if (!this.loaded) {
            const loading = document.createElement("div");
            loading.className = "loading";
            loading.textContent = "Loading calendar...";
            wrapper.appendChild(loading);
        }

        return wrapper;
    },

    stop() {
        if (this._timer) clearInterval(this._timer);
        this._timer = null;
    }
});
