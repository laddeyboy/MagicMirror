/* global moment */

/*
 * Keyword -> icon map used for activity detection. Matching is case-insensitive
 * and checks the event title first, then the calendar name. Extend/override via
 * config.activityIcons, e.g. { hockey: { keywords: ["hockey"], icon: "fas fa-fw fa-hockey-puck" } }
 */
const DEFAULT_ACTIVITY_ICONS = {
	baseball: { keywords: ["baseball"], icon: "fas fa-fw fa-baseball" },
	softball: { keywords: ["softball"], icon: "fas fa-fw fa-baseball-bat-ball" },
	basketball: { keywords: ["basketball"], icon: "fas fa-fw fa-basketball" },
	football: { keywords: ["football"], icon: "fas fa-fw fa-football" },
	soccer: { keywords: ["soccer"], icon: "fas fa-fw fa-futbol" },
	volleyball: { keywords: ["volleyball"], icon: "fas fa-fw fa-volleyball" },
	tennis: { keywords: ["tennis"], icon: "fas fa-fw fa-table-tennis-paddle-ball" },
	swimming: { keywords: ["swim"], icon: "fas fa-fw fa-person-swimming" },
	golf: { keywords: ["golf"], icon: "fas fa-fw fa-golf-ball-tee" },
	running: { keywords: ["track", "running", "5k", "marathon", "cross country"], icon: "fas fa-fw fa-person-running" },
	cycling: { keywords: ["cycling", "bike ride", "bicycle"], icon: "fas fa-fw fa-bicycle" },
	school: { keywords: ["school", "homework", "class"], icon: "fas fa-fw fa-graduation-cap" },
	medical: { keywords: ["doctor", "dentist", "appointment", "checkup"], icon: "fas fa-fw fa-user-doctor" },
	meeting: { keywords: ["meeting", "standup", "sync"], icon: "fas fa-fw fa-users" },
	work: { keywords: ["deadline", "project"], icon: "fas fa-fw fa-briefcase" },
	birthday: { keywords: ["birthday"], icon: "fas fa-fw fa-cake-candles" },
	travel: { keywords: ["flight", "airport"], icon: "fas fa-fw fa-plane" },
	food: { keywords: ["lunch", "dinner", "breakfast"], icon: "fas fa-fw fa-utensils" }
};

// Generic calendar symbols that don't represent a real detected activity.
const GENERIC_SYMBOLS = ["fa-calendar-days", "fa-calendar-alt", "fa-calendar-check", "fa-calendar"];

Module.register("MMM-TodaysTasks", {
	defaults: {
		origin: "",
		trafficRefreshMinutes: 10,
		maxEvents: 10,
		showRelativeTime: true,
		showActivityIcons: true,
		showCalendarColors: true,
		updateIntervalSeconds: 30,
		activityIcons: {}
	},

	getStyles () {
		return ["MMM-TodaysTasks.css", "font-awesome.css"];
	},

	getScripts () {
		return ["moment.js"];
	},

	start () {
		this.allEvents = [];
		this.todayTasks = [];
		this.driveTimes = {};
		this.rowRefs = {};
		this.loaded = false;
		this.currentDayKey = moment().format("YYYY-MM-DD");
		this.activityIconMap = Object.assign({}, DEFAULT_ACTIVITY_ICONS, this.config.activityIcons);
		this.scheduleTick();
	},

	stop () {
		if (this._timer) {
			clearInterval(this._timer);
			this._timer = null;
		}
	},

	scheduleTick () {
		const seconds = Math.max(5, this.config.updateIntervalSeconds);
		this._timer = setInterval(() => this.tick(), seconds * 1000);
	},

	notificationReceived (notification, payload) {
		if (notification === "CALENDAR_EVENTS") {
			if (Array.isArray(payload)) {
				this.allEvents = payload;
			} else if (payload && Array.isArray(payload.events)) {
				this.allEvents = payload.events;
			} else {
				this.allEvents = [];
			}
			this.loaded = true;
			this.processEvents();
		}
	},

	socketNotificationReceived (notification, payload) {
		if (notification === "DRIVE_TIMES_RESULT") {
			Object.entries(payload.results).forEach(([destination, result]) => {
				this.driveTimes[destination] = Object.assign({ timestamp: Date.now() }, result);
			});
			this.updateEdtCells();
		}
	},

	/**
	 * Rebuilds today's task list from the raw calendar events and re-renders.
	 */
	processEvents () {
		this.todayTasks = this.buildTodayTasks(this.allEvents);
		this.sendSocketNotification("DEBUG_TASK_LOCATIONS", this.todayTasks.map((t) => ({ title: t.title, location: t.location })));
		this.requestDriveTimes();
		this.updateDom(300);
	},

	/**
	 * Filters/sorts raw calendar events down to today's tasks with derived display fields.
	 * @param {object[]} events raw CALENDAR_EVENTS payload
	 * @returns {object[]} today's tasks, sorted chronologically
	 */
	buildTodayTasks (events) {
		const startOfDay = moment().startOf("day");
		const endOfDay = moment().endOf("day");

		return events
			.filter((event) => event && event.startDate !== undefined && event.endDate !== undefined)
			.map((event) => ({
				key: `${event.title || ""}|${event.startDate}|${event.endDate}`,
				title: event.title || "(untitled event)",
				start: moment(Number(event.startDate), "x"),
				end: moment(Number(event.endDate), "x"),
				fullDayEvent: !!event.fullDayEvent,
				location: event.location && event.location !== false ? event.location : null,
				calendarName: event.calendarName || "",
				color: event.color || null,
				symbol: Array.isArray(event.symbol) ? event.symbol : []
			}))
			.filter((task) => task.start.isBefore(endOfDay) && task.end.isAfter(startOfDay))
			.sort((a, b) => a.start.valueOf() - b.start.valueOf())
			.map((task) => Object.assign(task, { icon: this.config.showActivityIcons ? this.detectActivityIcon(task) : null }));
	},

	/**
	 * Determines an activity icon class for a task, preferring keyword matches
	 * over the calendar module's own (already-resolved) symbol.
	 * @param {object} task normalized task
	 * @returns {string|null} FontAwesome class string, or null if none applies
	 */
	detectActivityIcon (task) {
		const haystacks = [task.title, task.calendarName].filter(Boolean).map((s) => s.toLowerCase());

		for (const activity of Object.values(this.activityIconMap)) {
			if (activity.keywords.some((keyword) => haystacks.some((h) => h.includes(keyword)))) {
				return activity.icon;
			}
		}

		const symbol = task.symbol[0];
		if (symbol && !GENERIC_SYMBOLS.some((generic) => symbol.includes(generic))) {
			return symbol;
		}

		return null;
	},

	/**
	 * Whether a (non-all-day) task is currently in progress.
	 * @param {object} task normalized task
	 * @param {moment.Moment} now current time
	 * @returns {boolean} true when the task is a timed event happening right now
	 */
	isCurrentlyHappening (task, now) {
		return !task.fullDayEvent && now.isSameOrAfter(task.start) && now.isBefore(task.end);
	},

	/**
	 * Computes the "In N minutes" / "Ends in N minutes" status for a task.
	 * @param {object} task normalized task
	 * @param {moment.Moment} now current time
	 * @returns {string|null} status text, or null when nothing should be shown
	 */
	relativeStatusFor (task, now) {
		if (!this.config.showRelativeTime || task.fullDayEvent) {
			return null;
		}

		if (now.isBefore(task.start)) {
			const seconds = task.start.diff(now, "seconds");
			if (seconds < 60) return "Starting now";
			const minutes = Math.round(seconds / 60);
			if (minutes < 60) return `In ${minutes} minute${minutes === 1 ? "" : "s"}`;
			const hours = Math.round(minutes / 60);
			return `In ${hours} hour${hours === 1 ? "" : "s"}`;
		}

		if (now.isBefore(task.end)) {
			const seconds = task.end.diff(now, "seconds");
			if (seconds < 60) return "Ending now";
			const minutes = Math.round(seconds / 60);
			if (minutes < 60) return `Ends in ${minutes} minute${minutes === 1 ? "" : "s"}`;
			const hours = Math.round(minutes / 60);
			return `Ends in ${hours} hour${hours === 1 ? "" : "s"}`;
		}

		return null;
	},

	/**
	 * Asks node_helper for drive times to any today-task destination whose
	 * cached value is missing or stale. Already-fresh/no-location/past/all-day
	 * events are skipped so we never spam the routing API.
	 */
	requestDriveTimes () {
		if (!this.config.origin) {
			return;
		}

		const now = moment();
		const maxAgeMs = this.config.trafficRefreshMinutes * 60 * 1000;
		const destinations = new Set();

		this.todayTasks.slice(0, this.config.maxEvents).forEach((task) => {
			if (task.fullDayEvent || !task.location || task.end.isBefore(now)) {
				return;
			}
			const cached = this.driveTimes[task.location];
			if (cached && Date.now() - cached.timestamp < maxAgeMs) {
				return;
			}
			destinations.add(task.location);
		});

		if (destinations.size === 0) {
			return;
		}

		this.sendSocketNotification("REQUEST_DRIVE_TIMES", {
			origin: this.config.origin,
			destinations: Array.from(destinations),
			maxAgeMs
		});
	},

	tick () {
		const dayKey = moment().format("YYYY-MM-DD");
		if (dayKey !== this.currentDayKey) {
			this.currentDayKey = dayKey;
			this.processEvents();
			return;
		}
		this.updateStatusCells();
		this.requestDriveTimes();
	},

	/**
	 * Patches only the relative-status text nodes in place, without a full
	 * updateDom(), so the display doesn't fade/flicker every tick.
	 */
	updateStatusCells () {
		const now = moment();
		this.todayTasks.forEach((task) => {
			const ref = this.rowRefs[task.key];
			if (!ref || !ref.statusEl) {
				return;
			}
			const status = this.relativeStatusFor(task, now);
			ref.statusEl.textContent = status || "";
			ref.statusEl.style.display = status ? "" : "none";
			ref.rowEl.classList.toggle("tt-current", this.isCurrentlyHappening(task, now));
		});
	},

	/**
	 * Patches the EDT cells in place once drive-time results arrive.
	 */
	updateEdtCells () {
		const debug = [];
		this.todayTasks.forEach((task) => {
			const ref = this.rowRefs[task.key];
			const cached = this.driveTimes[task.location];
			debug.push({
				title: task.title,
				location: task.location,
				hasRef: !!(ref && ref.edtEl),
				cached
			});
			if (!ref || !ref.edtEl) {
				return;
			}
			this.renderEdtCell(ref.edtEl, task);
		});
		this.sendSocketNotification("DEBUG_EDT_UPDATE", debug);
	},

	/**
	 * Fills an EDT cell with the cached drive-time text, prefixed with a
	 * car-side icon, when a location and a computed drive time are available.
	 * @param {HTMLTableCellElement} edtCell the cell to fill
	 * @param {object} task normalized task
	 */
	renderEdtCell (edtCell, task) {
		edtCell.textContent = "";

		if (!task.location) {
			return;
		}

		const cached = this.driveTimes[task.location];
		const minutesText = cached && cached.minutesText ? cached.minutesText : "";
		if (!minutesText) {
			return;
		}

		const icon = document.createElement("span");
		icon.className = "tt-edt-icon fas fa-fw fa-car-side";
		edtCell.appendChild(icon);

		const text = document.createElement("span");
		text.className = "tt-edt-text";
		text.textContent = minutesText;
		edtCell.appendChild(text);
	},

	getDom () {
		const wrapper = document.createElement("div");
		wrapper.className = "tt-wrapper";

		const heading = document.createElement("div");
		heading.className = "tt-heading bright";
		heading.textContent = "TODAY";
		wrapper.appendChild(heading);

		if (!this.loaded) {
			const loading = document.createElement("div");
			loading.className = "tt-empty dimmed small";
			loading.textContent = this.translate ? this.translate("LOADING") : "Loading...";
			wrapper.appendChild(loading);
			return wrapper;
		}

		if (this.todayTasks.length === 0) {
			const empty = document.createElement("div");
			empty.className = "tt-empty dimmed small";
			empty.textContent = "No events";
			wrapper.appendChild(empty);
			return wrapper;
		}

		this.rowRefs = {};

		const table = document.createElement("table");
		table.className = "tt-table small";

		const now = moment();
		const visibleTasks = this.todayTasks.slice(0, this.config.maxEvents);

		visibleTasks.forEach((task) => {
			const row = this.buildRow(task, now);
			table.appendChild(row);
		});

		wrapper.appendChild(table);

		const overflow = this.todayTasks.length - visibleTasks.length;
		if (overflow > 0) {
			const more = document.createElement("div");
			more.className = "tt-more dimmed xsmall";
			more.textContent = `+ ${overflow} more event${overflow === 1 ? "" : "s"}`;
			wrapper.appendChild(more);
		}

		return wrapper;
	},

	/**
	 * Builds a single event row and registers refs for the lightweight timer to patch.
	 * @param {object} task normalized task
	 * @param {moment.Moment} now current time
	 * @returns {HTMLTableRowElement} the row element
	 */
	buildRow (task, now) {
		const row = document.createElement("tr");
		row.className = "tt-row";
		if (this.isCurrentlyHappening(task, now)) {
			row.classList.add("tt-current");
		}

		const timeCell = document.createElement("td");
		timeCell.className = "tt-time light";
		timeCell.textContent = task.fullDayEvent ? "All Day" : task.start.format("h:mm A");
		row.appendChild(timeCell);

		const titleCell = document.createElement("td");
		titleCell.className = "tt-title";

		if (task.icon) {
			const icon = document.createElement("span");
			icon.className = `tt-icon ${task.icon}`;
			if (this.config.showCalendarColors && task.color) {
				icon.style.color = task.color;
			}
			titleCell.appendChild(icon);
		}

		const titleText = document.createElement("span");
		titleText.className = "tt-title-text bright";
		titleText.textContent = task.title;
		if (this.config.showCalendarColors && task.color) {
			titleText.style.color = task.color;
		}
		titleCell.appendChild(titleText);

		const statusEl = document.createElement("div");
		statusEl.className = "tt-status dimmed xsmall";
		const status = this.relativeStatusFor(task, now);
		statusEl.textContent = status || "";
		statusEl.style.display = status ? "" : "none";
		titleCell.appendChild(statusEl);

		row.appendChild(titleCell);

		const edtCell = document.createElement("td");
		edtCell.className = "tt-edt light";
		this.renderEdtCell(edtCell, task);
		row.appendChild(edtCell);

		this.rowRefs[task.key] = { rowEl: row, statusEl, edtEl: edtCell };

		return row;
	}
});
