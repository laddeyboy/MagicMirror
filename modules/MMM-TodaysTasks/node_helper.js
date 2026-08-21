const NodeHelper = require("node_helper");
const Log = require("logger");

const ROUTES_ENDPOINT = "https://routes.googleapis.com/directions/v2:computeRoutes";

module.exports = NodeHelper.create({
	start () {
		this.cache = new Map(); // `${origin}||${destination}` -> { minutesText, timestamp }
		this.apiKey = process.env.GOOGLE_MAPS_API_KEY || "";

		if (!this.apiKey) {
			Log.warn("[MMM-TodaysTasks] GOOGLE_MAPS_API_KEY is not set. Estimated drive times will be left blank.");
		}
	},

	socketNotificationReceived (notification, payload) {
		if (notification === "REQUEST_DRIVE_TIMES") {
			this.handleDriveTimesRequest(payload);
		} else if (notification === "DEBUG_TASK_LOCATIONS") {
			Log.debug(`[MMM-TodaysTasks] Today's tasks as seen by the module:\n${JSON.stringify(payload, null, 2)}`);
		} else if (notification === "DEBUG_EDT_UPDATE") {
			Log.debug(`[MMM-TodaysTasks] updateEdtCells() ran:\n${JSON.stringify(payload, null, 2)}`);
		}
	},

	/**
	 * Resolves drive times for the requested destinations, using the cache
	 * where possible and only calling Google's Routes API for stale/missing ones.
	 * @param {object} payload { origin, destinations, maxAgeMs }
	 */
	async handleDriveTimesRequest ({ origin, destinations, maxAgeMs }) {
		Log.debug(`[MMM-TodaysTasks] REQUEST_DRIVE_TIMES received. origin=${JSON.stringify(origin)} destinations=${JSON.stringify(destinations)}`);

		const results = {};
		const toFetch = [];

		for (const destination of destinations) {
			const cached = this.cache.get(this.cacheKey(origin, destination));
			if (cached && Date.now() - cached.timestamp < maxAgeMs) {
				results[destination] = { minutesText: cached.minutesText };
			} else {
				toFetch.push(destination);
			}
		}

		if (toFetch.length === 0) {
			this.sendSocketNotification("DRIVE_TIMES_RESULT", { results });
			return;
		}

		if (!this.apiKey) {
			toFetch.forEach((destination) => {
				results[destination] = { minutesText: null, error: "missing_api_key" };
			});
			this.sendSocketNotification("DRIVE_TIMES_RESULT", { results });
			return;
		}

		await Promise.all(toFetch.map(async (destination) => {
			try {
				const minutesText = await this.fetchDriveTime(origin, destination);
				this.cache.set(this.cacheKey(origin, destination), { minutesText, timestamp: Date.now() });
				results[destination] = { minutesText };
			} catch (error) {
				Log.error(`[MMM-TodaysTasks] Failed to fetch drive time to "${destination}": ${error.message}`);
				results[destination] = { minutesText: null, error: "request_failed" };
			}
		}));

		Log.debug(`[MMM-TodaysTasks] Sending DRIVE_TIMES_RESULT: ${JSON.stringify(results)}`);
		this.sendSocketNotification("DRIVE_TIMES_RESULT", { results });
	},

	cacheKey (origin, destination) {
		return `${origin}||${destination}`;
	},

	/**
	 * Calls the Google Maps Routes API for a traffic-aware driving duration.
	 * @param {string} origin configured home/start address
	 * @param {string} destination event location
	 * @returns {Promise<string>} formatted minutes text, e.g. "24 min"
	 */
	async fetchDriveTime (origin, destination) {
		const response = await fetch(ROUTES_ENDPOINT, {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
				"X-Goog-Api-Key": this.apiKey,
				"X-Goog-FieldMask": "routes.duration"
			},
			body: JSON.stringify({
				origin: { address: origin },
				destination: { address: destination },
				travelMode: "DRIVE",
				routingPreference: "TRAFFIC_AWARE"
			})
		});

		if (!response.ok) {
			throw new Error(`HTTP ${response.status}`);
		}

		const data = await response.json();
		const route = data.routes && data.routes[0];
		if (!route || !route.duration) {
			throw new Error("No route found");
		}

		const seconds = parseInt(route.duration.replace("s", ""), 10);
		const minutes = Math.round(seconds / 60);
		return `${minutes} min`;
	}
});
