Module.register("MMM-AroundNow", {
    defaults: {
        pixelsPerHour: 80,
        updateInterval: 30000,
        hoursBefore: 3,
        hoursAfter: 3,
        showAllDay: true,
        colors: {},
    },

    start() {
        this.events = [];
        this.loaded = true;
        this._timer = null;
        this.scheduleTimer();
    },

    scheduleTimer() {
        if (this._timer) clearInterval(this._timer);
        this._timer = setInterval(() => {
            this.updateDom();
        }, this.config.updateInterval);
    },

    notificationReceived(notification, payload) {
        if (notification === "CALENDAR_EVENTS") {
            // payload may be {events: [...] } or an array depending on sender
            if (payload && payload.events) {
                this.events = payload.events;
            } else if (Array.isArray(payload)) {
                this.events = payload;
            } else {
                this.events = [];
            }
            this.updateDom(500);
        }
    },

    getStyles() {
        return [this.file("MMM-AroundNow.css")];
    },

    getDom() {
        const wrapper = document.createElement("div");
        wrapper.className = "aroundnow-wrapper";

        const now = new Date();
        const windowStart = new Date(now.getTime() - this.config.hoursBefore * 3600000);
        const windowEnd = new Date(now.getTime() + this.config.hoursAfter * 3600000);
        const totalHours = this.config.hoursBefore + this.config.hoursAfter;
        const windowPixels = totalHours * this.config.pixelsPerHour;

        const daysRow = document.createElement("div");
        daysRow.className = "aroundnow-daysrow";
        const middleIndex = 3;
        for (let i = -3; i <= 3; i++) {
            const dayDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() + i);
            const col = document.createElement("div");
            col.className = "aroundnow-daycol";
            if (i === 0) col.classList.add("today");

            const dayName = dayDate.toLocaleDateString(this.config.language || "en-US", { weekday: "short" }).toUpperCase();
            const dayNum = dayDate.getDate();

            const headerInner = document.createElement("div");
            headerInner.className = "day-header";
            headerInner.innerHTML = `<div class=day-name>${dayName}</div><div class=day-num>${dayNum}</div>`;
            col.appendChild(headerInner);

            // all-day container
            if (this.config.showAllDay) {
                const allday = document.createElement("div");
                allday.className = "allday-row";
                col.appendChild(allday);
            }

            // timeline container (relative)
            const timeline = document.createElement("div");
            timeline.className = "timeline";
            timeline.style.height = windowPixels + "px";
            timeline.dataset.dayOffset = i;

            col.appendChild(timeline);
            daysRow.appendChild(col);
        }

        wrapper.appendChild(daysRow);

        // Now line - positioned absolutely within wrapper to span all columns
        const nowLine = document.createElement("div");
        nowLine.className = "now-line";
        // Calculate position: header (day names + allday section ~96px) + position within time window
        const headerHeight = 70; // approximate header + allday height
        const nowPosition = headerHeight + (this.config.hoursBefore * this.config.pixelsPerHour);
        nowLine.style.top = nowPosition + "px";
        wrapper.appendChild(nowLine);

        // Place events
        const eventsByDay = {};
        for (const e of this.events || []) {
            if (!e.startDate) continue;
            const start = new Date(e.startDate);
            const end = e.endDate ? new Date(e.endDate) : new Date(start.getTime() + 30 * 60000);

            // all-day
            if (e.fullDayEvent || e.fullDay || e.allDay) {
                const dayIdx = Math.floor((start - new Date(now.getFullYear(), now.getMonth(), now.getDate())) / 86400000);
                eventsByDay[dayIdx] = eventsByDay[dayIdx] || [];
                eventsByDay[dayIdx].push(Object.assign({}, e, { allDay: true }));
                continue;
            }

            // skip if outside -3..+3 days
            const dayIdx = Math.floor((start - new Date(now.getFullYear(), now.getMonth(), now.getDate())) / 86400000);
            if (dayIdx < -3 || dayIdx > 3) continue;

            eventsByDay[dayIdx] = eventsByDay[dayIdx] || [];
            eventsByDay[dayIdx].push({ start, end, title: e.title || "(no title)", original: e });
        }

        // Render events into columns
        const cols = daysRow.children;
        for (let i = 0; i < cols.length; i++) {
            const offset = i - 3; // -3..+3
            const timeline = cols[i].querySelector('.timeline');
            const allday = cols[i].querySelector('.allday-row');

            // render all-day
            const alldayEvents = eventsByDay[offset] ? eventsByDay[offset].filter(ev=>ev.allDay) : [];
            for (const ev of alldayEvents) {
                const el = document.createElement('div');
                el.className = 'allday-event';
                el.textContent = ev.title || ev.title;
                allday.appendChild(el);
            }

            const dayEvents = eventsByDay[offset] ? eventsByDay[offset].filter(ev=>!ev.allDay) : [];
            // simple overlap layout: give each event a left offset based on index
            for (let j = 0; j < dayEvents.length; j++) {
                const ev = dayEvents[j];
                const evStart = ev.start;
                const evEnd = ev.end;
                const clipStart = Math.max(evStart, windowStart);
                const clipEnd = Math.min(evEnd, windowEnd);
                if (clipEnd <= clipStart) continue;

                const top = ((clipStart - windowStart) / 3600000) * this.config.pixelsPerHour;
                const height = ((clipEnd - clipStart) / 3600000) * this.config.pixelsPerHour;

                const evEl = document.createElement('div');
                evEl.className = 'aroundnow-event';
                evEl.style.top = top + 'px';
                evEl.style.height = Math.max(20, height) + 'px';
                evEl.style.left = (j * 6) + '%';
                evEl.style.width = (100 - j * 6) + '%';
                evEl.textContent = ev.title;
                timeline.appendChild(evEl);
            }
        }

        return wrapper;
    },

    updateDom() {
        // rely on framework's updateDom to re-render
        this.loaded = true;
        if (this._timer == null) this.scheduleTimer();
        this.sendSocketNotification && this.sendSocketNotification('AAROUNDNOW_UPDATE');
        Module.prototype.updateDom.call(this, 0);
    },

    stop() {
        if (this._timer) clearInterval(this._timer);
        this._timer = null;
    }
});
