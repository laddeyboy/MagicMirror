const NodeHelper = require("node_helper");
const Log = require("logger");
const moment = require("moment-timezone");
// Reused rather than re-implemented: handles RRULE recurring-event expansion
// (class periods recur Mon/Wed/Fri etc.), HTTP retry/backoff, and 304 handling.
const CalendarFetcher = require("../../defaultmodules/calendar/calendarfetcher");

const REFILTER_INTERVAL_MS = 5 * 60 * 1000;

module.exports = NodeHelper.create({
	start () {
		this.fetchers = {};
		this.announcementsFetcher = null;
		this.refilterTimer = setInterval(() => this.refilterAll(), REFILTER_INTERVAL_MS);
	},

	stop () {
		clearInterval(this.refilterTimer);
	},

	socketNotificationReceived (notification, payload) {
		if (notification === "SCHOOL_SUBSCRIBE_SCHEDULES") {
			this.subscribe(payload.children || []);
		} else if (notification === "SCHOOL_SUBSCRIBE_ANNOUNCEMENTS") {
			this.subscribeAnnouncements(payload);
		}
	},

	/**
	 * Creates one CalendarFetcher per child that has a scheduleUrl and doesn't
	 * already have one running. Safe to call more than once (e.g. a future
	 * config reload) since existing fetchers are left alone.
	 * @param {object[]} children [{ id, scheduleUrl, refreshMinutes }]
	 */
	subscribe (children) {
		for (const child of children) {
			if (!child.scheduleUrl || this.fetchers[child.id]) {
				continue;
			}

			// Same "webcal://" -> "http://" swap calendar.js does; the schedule
			// host redirects/serves over plain HTTP fine, same as the family's
			// existing iCloud/sportsyou calendars.
			const url = child.scheduleUrl.replace("webcal://", "http://");
			const reloadInterval = (child.refreshMinutes || 30) * 60 * 1000;

			// maximumNumberOfDays: 1 keeps the fetch/expansion window tight
			// (today +/- a day is plenty for a daily schedule). includePastEvents:
			// true is required here even though this is a "today" view - the
			// generic CalendarFetcher treats "past" as "already over, not
			// interesting," but a class that already met earlier today is exactly
			// what this page needs to keep showing.
			const fetcher = new CalendarFetcher(url, reloadInterval, [], 50, 1, null, true, false);

			fetcher.onReceive((f) => this.broadcastToday(child.id, f));
			fetcher.onError((f, error) => {
				Log.error(`[MMM-DashboardNavigation] Schedule fetch failed for ${child.id}: ${error.message}`);
				this.sendSocketNotification("SCHOOL_SCHEDULE_ERROR", { childId: child.id, message: error.message });
			});

			this.fetchers[child.id] = fetcher;
			fetcher.fetchCalendar();
		}
	},

	/**
	 * Creates the single announcements CalendarFetcher (special/spirit days
	 * etc.), if one isn't already running. Unlike the per-child schedules,
	 * this is one shared feed with a multi-day look-ahead window rather than
	 * a "today only" one.
	 * @param {object} payload { url, refreshMinutes, windowDays, maxItems }
	 */
	subscribeAnnouncements (payload) {
		const { url: rawUrl, refreshMinutes, windowDays, maxItems } = payload || {};
		if (!rawUrl || this.announcementsFetcher) {
			return;
		}

		const url = rawUrl.replace("webcal://", "http://");
		const reloadInterval = (refreshMinutes || 60) * 60 * 1000;
		this.announcementsMaxItems = maxItems || 5;

		// includePastEvents: false (unlike the per-child schedules) - an
		// announcement that's already over isn't "today's context," it's just
		// stale, so there's no reason to keep showing it.
		const fetcher = new CalendarFetcher(url, reloadInterval, [], 20, windowDays || 7, null, false, false);

		fetcher.onReceive((f) => this.broadcastAnnouncements(f));
		fetcher.onError((f, error) => {
			Log.error(`[MMM-DashboardNavigation] Announcements fetch failed: ${error.message}`);
		});

		this.announcementsFetcher = fetcher;
		fetcher.fetchCalendar();
	},

	/**
	 * Re-derives "today's events" from each schedule fetcher's already-cached
	 * events and re-broadcasts. Runs independently of the HTTP reload interval
	 * so the schedule rolls over to the next day shortly after midnight
	 * without waiting on a fresh network fetch.
	 */
	refilterAll () {
		for (const [childId, fetcher] of Object.entries(this.fetchers)) {
			if (fetcher.lastFetch) {
				this.broadcastToday(childId, fetcher);
			}
		}

		if (this.announcementsFetcher?.lastFetch) {
			this.broadcastAnnouncements(this.announcementsFetcher);
		}
	},

	/**
	 * Sends the announcements fetcher's cached events (soonest first, capped
	 * to announcementsMaxItems) to the frontend.
	 * @param {CalendarFetcher} fetcher the announcements fetcher
	 */
	broadcastAnnouncements (fetcher) {
		const events = fetcher.events
			.map((event) => ({
				title: event.title,
				start: Number(event.startDate),
				fullDayEvent: event.fullDayEvent
			}))
			.sort((a, b) => a.start - b.start)
			.slice(0, this.announcementsMaxItems);

		this.sendSocketNotification("SCHOOL_ANNOUNCEMENTS_DATA", { events });
	},

	/**
	 * Filters a fetcher's events down to just today's instances (sorted by
	 * start time) and sends them to the frontend.
	 * @param {string} childId the child this fetcher belongs to
	 * @param {CalendarFetcher} fetcher the fetcher holding cached events
	 */
	broadcastToday (childId, fetcher) {
		const today = moment().startOf("day");

		const events = fetcher.events
			.filter((event) => moment(Number(event.startDate)).isSame(today, "day"))
			.map((event) => ({
				title: event.title,
				start: Number(event.startDate),
				end: Number(event.endDate),
				location: event.location || null,
				fullDayEvent: event.fullDayEvent
			}))
			.sort((a, b) => a.start - b.start);

		this.sendSocketNotification("SCHOOL_SCHEDULE_DATA", { childId, events });
	}
});
