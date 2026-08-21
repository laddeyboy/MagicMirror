/* global SunCalc, formatTime */

Module.register("clock", {
	// Module config defaults.
	defaults: {
		displayType: "digital", // options: digital, analog, both

		timeFormat: config.timeFormat,
		timezone: null,

		displaySeconds: true,
		showPeriod: true,
		showPeriodUpper: false,
		clockBold: false,
		showDate: true,
		showTime: true,
		showWeek: false, // options: true, false, 'short'
		dateFormat: "dddd, LL",
		sendNotifications: false,

		/* specific to the analog clock */
		analogSize: "200px",
		analogFace: "simple", // options: 'none', 'simple', 'face-###' (where ### is 001 to 012 inclusive)
		analogPlacement: "bottom", // options: 'top', 'bottom', 'left', 'right'
		analogShowDate: "top", // OBSOLETE, can be replaced with analogPlacement and showTime, options: false, 'top', or 'bottom'
		secondsColor: "#888888", // DEPRECATED, use CSS instead. Class "clock-second-digital" for digital clock, "clock-second" for analog clock.

		showSunTimes: false, // options: true, false, 'disableNextEvent'
		showMoonTimes: false, // options: false, 'times' (rise/set), 'percent' (lit percent), 'phase' (current phase), or 'both' (percent & phase)
		lat: 47.630539,
		lon: -122.344147,
		// Show a compact month calendar under the time (month + day grid with today highlighted)
		showMonthCalendar: true,
		// Highlight US holidays (New Year's, MLK Day, Presidents Day, Good Friday, Memorial Day,
		// Juneteenth, Independence Day, Labor Day, Columbus Day, Veterans Day, Thanksgiving, Christmas) in red
		highlightHolidays: true
	},
	// Define required scripts.
	getScripts () {
		return ["moment.js", "moment-timezone.js", "suncalc.js"];
	},
	// Define styles.
	getStyles () {
		return ["clock_styles.css", "font-awesome.css"];
	},
	// Define start sequence.
	start () {
		Log.info(`Starting module: ${this.name}`);

		// Schedule update interval.
		this.second = moment().second();
		this.minute = moment().minute();

		// Calculate how many ms should pass until next update depending on if seconds is displayed or not
		const delayCalculator = (reducedSeconds) => {
			const EXTRA_DELAY = 50; // Deliberate imperceptible delay to prevent off-by-one timekeeping errors

			if (this.config.displaySeconds) {
				return 1000 - moment().milliseconds() + EXTRA_DELAY;
			} else {
				return (60 - reducedSeconds) * 1000 - moment().milliseconds() + EXTRA_DELAY;
			}
		};

		// A recursive timeout function instead of interval to avoid drifting
		const notificationTimer = () => {
			this.updateDom();

			if (this.config.sendNotifications) {
				// If seconds is displayed CLOCK_SECOND-notification should be sent (but not when CLOCK_MINUTE-notification is sent)
				if (this.config.displaySeconds) {
					this.second = moment().second();
					if (this.second !== 0) {
						this.sendNotification("CLOCK_SECOND", this.second);
						setTimeout(notificationTimer, delayCalculator(0));
						return;
					}
				}

				// If minute changed or seconds isn't displayed send CLOCK_MINUTE-notification
				this.minute = moment().minute();
				this.sendNotification("CLOCK_MINUTE", this.minute);
			}

			setTimeout(notificationTimer, delayCalculator(0));
		};

		// Set the initial timeout with the amount of seconds elapsed as
		// reducedSeconds, so it will trigger when the minute changes
		setTimeout(notificationTimer, delayCalculator(this.second));

		// Set locale.
		moment.locale(config.language);
	},

	// Date of Easter Sunday for a given year (Anonymous Gregorian algorithm), used to derive Good Friday.
	getEasterDate (year) {
		const a = year % 19;
		const b = Math.floor(year / 100);
		const c = year % 100;
		const d = Math.floor(b / 4);
		const e = b % 4;
		const f = Math.floor((b + 8) / 25);
		const g = Math.floor((b - f + 1) / 3);
		const h = (19 * a + b - d - g + 15) % 30;
		const i = Math.floor(c / 4);
		const k = c % 4;
		const l = (32 + 2 * e + 2 * i - h - k) % 7;
		const m = Math.floor((a + 11 * h + 22 * l) / 451);
		const month = Math.floor((h + l - 7 * m + 114) / 31);
		const day = ((h + l - 7 * m + 114) % 31) + 1;
		return moment({ year, month: month - 1, day });
	},

	// nth (1-based) occurrence of a weekday (0=Sunday) in a given month (0-indexed).
	nthWeekdayOfMonth (year, month, weekday, n) {
		const first = moment({ year, month, day: 1 });
		const offset = (weekday - first.day() + 7) % 7;
		return first.add(offset + (n - 1) * 7, "days");
	},

	// Last occurrence of a weekday (0=Sunday) in a given month (0-indexed).
	lastWeekdayOfMonth (year, month, weekday) {
		const last = moment({ year, month }).endOf("month");
		const offset = (last.day() - weekday + 7) % 7;
		return last.subtract(offset, "days");
	},

	// Returns a Set of "YYYY-M-D" strings for the observed US holidays in the given year.
	getUSHolidays (year) {
		const goodFriday = this.getEasterDate(year).subtract(2, "days");
		const dates = [
			moment({ year, month: 0, day: 1 }), // New Year's Day
			this.nthWeekdayOfMonth(year, 0, 1, 3), // MLK Day - 3rd Monday of January
			this.nthWeekdayOfMonth(year, 1, 1, 3), // Presidents Day - 3rd Monday of February
			goodFriday,
			this.lastWeekdayOfMonth(year, 4, 1), // Memorial Day - last Monday of May
			moment({ year, month: 5, day: 19 }), // Juneteenth
			moment({ year, month: 6, day: 4 }), // Independence Day
			this.nthWeekdayOfMonth(year, 8, 1, 1), // Labor Day - 1st Monday of September
			this.nthWeekdayOfMonth(year, 9, 1, 2), // Columbus Day - 2nd Monday of October
			moment({ year, month: 10, day: 11 }), // Veterans Day
			this.nthWeekdayOfMonth(year, 10, 4, 4), // Thanksgiving - 4th Thursday of November
			moment({ year, month: 11, day: 25 }) // Christmas Day
		];
		return new Set(dates.map((d) => d.format("YYYY-M-D")));
	},

	// Override dom generator.
	getDom () {
		const wrapper = document.createElement("div");
		wrapper.classList.add("clock-grid");

		/************************************
		 * Create wrappers for analog and digital clock
		 */
		const analogWrapper = document.createElement("div");
		analogWrapper.className = "clock-circle";
		const digitalWrapper = document.createElement("div");
		digitalWrapper.className = "digital";

		/************************************
		 * Create wrappers for DIGITAL clock
		 */
		const dateWrapper = document.createElement("div");
		const timeWrapper = document.createElement("div");
		const hoursWrapper = document.createElement("span");
		const minutesWrapper = document.createElement("span");
		const secondsWrapper = document.createElement("sup");
		const periodWrapper = document.createElement("span");
		const sunWrapper = document.createElement("div");
		const moonWrapper = document.createElement("div");
		const weekWrapper = document.createElement("div");

		// Style Wrappers
		dateWrapper.className = "date normal medium";
		timeWrapper.className = "time bright large light";
		hoursWrapper.className = "clock-hour-digital";
		minutesWrapper.className = "clock-minute-digital";
		secondsWrapper.className = "clock-second-digital dimmed";
		sunWrapper.className = "sun dimmed small";
		moonWrapper.className = "moon dimmed small";
		weekWrapper.className = "week dimmed medium";

		// Set content of wrappers.
		const now = moment();
		if (this.config.timezone) {
			now.tz(this.config.timezone);
		}

		if (this.config.showDate) {
			dateWrapper.innerHTML = now.format(this.config.dateFormat);
			digitalWrapper.appendChild(dateWrapper);
		}

		if (this.config.displayType !== "analog" && this.config.showTime) {
			let hourSymbol = "HH";
			if (this.config.timeFormat !== 24) {
				hourSymbol = "h";
			}

			hoursWrapper.innerHTML = now.format(hourSymbol);
			minutesWrapper.innerHTML = now.format("mm");

			timeWrapper.appendChild(hoursWrapper);
			if (this.config.clockBold) {
				minutesWrapper.classList.add("bold");
			} else {
				timeWrapper.innerHTML += ":";
			}
			timeWrapper.appendChild(minutesWrapper);
			secondsWrapper.innerHTML = now.format("ss");
			if (this.config.showPeriodUpper) {
				periodWrapper.innerHTML = now.format("A");
			} else {
				periodWrapper.innerHTML = now.format("a");
			}
			if (this.config.displaySeconds) {
				timeWrapper.appendChild(secondsWrapper);
			}
			if (this.config.showPeriod && this.config.timeFormat !== 24) {
				timeWrapper.appendChild(periodWrapper);
			}
			digitalWrapper.appendChild(timeWrapper);
		}

		/****************************************************************
		 * Create wrappers for Sun Times, only if specified in config
		 */
		if (this.config.showSunTimes) {
			const sunTimes = SunCalc.getTimes(now, this.config.lat, this.config.lon);
			const isVisible = now.isBetween(sunTimes.sunrise, sunTimes.sunset);
			let sunWrapperInnerHTML = "";

			if (this.config.showSunTimes !== "disableNextEvent") {
				let nextEvent;
				if (now.isBefore(sunTimes.sunrise)) {
					nextEvent = sunTimes.sunrise;
				} else if (now.isBefore(sunTimes.sunset)) {
					nextEvent = sunTimes.sunset;
				} else {
					const tomorrowSunTimes = SunCalc.getTimes(now.clone().add(1, "day"), this.config.lat, this.config.lon);
					nextEvent = tomorrowSunTimes.sunrise;
				}
				const untilNextEvent = moment.duration(moment(nextEvent).diff(now));
				const untilNextEventString = `${untilNextEvent.hours()}h ${untilNextEvent.minutes()}m`;

				sunWrapperInnerHTML = `<span class="${isVisible ? "bright" : ""}"><i class="fas fa-sun" aria-hidden="true"></i> ${untilNextEventString}</span>`;
			}

			sunWrapperInnerHTML += `<span><i class="fas fa-arrow-up" aria-hidden="true"></i> ${formatTime(this.config, sunTimes.sunrise)}</span>`
			  + `<span><i class="fas fa-arrow-down" aria-hidden="true"></i> ${formatTime(this.config, sunTimes.sunset)}</span>`;

			sunWrapper.innerHTML = sunWrapperInnerHTML;
			digitalWrapper.appendChild(sunWrapper);
		}

		/****************************************************************
		 * Create wrappers for Moon Times, only if specified in config
		 */
		if (this.config.showMoonTimes) {
			const moonIllumination = SunCalc.getMoonIllumination(now.toDate());
			const moonTimes = SunCalc.getMoonTimes(now, this.config.lat, this.config.lon);
			const moonRise = moonTimes.rise;
			let moonSet;
			if (moment(moonTimes.set).isAfter(moonTimes.rise)) {
				moonSet = moonTimes.set;
			} else {
				const nextMoonTimes = SunCalc.getMoonTimes(now.clone().add(1, "day"), this.config.lat, this.config.lon);
				moonSet = nextMoonTimes.set;
			}
			const isVisible = now.isBetween(moonRise, moonSet) || moonTimes.alwaysUp === true;
			const showFraction = ["both", "percent"].includes(this.config.showMoonTimes);
			const showUnicode = ["both", "phase"].includes(this.config.showMoonTimes);
			const illuminatedFractionString = `${Math.round(moonIllumination.fraction * 100)}%`;
			const image = showUnicode ? [..."🌑🌒🌓🌔🌕🌖🌗🌘"][Math.floor(moonIllumination.phase * 8)] : "<i class=\"fas fa-moon\" aria-hidden=\"true\"></i>";

			moonWrapper.innerHTML
				= `<span class="${isVisible ? "bright" : ""}">${image} ${showFraction ? illuminatedFractionString : ""}</span>`
				  + `<span><i class="fas fa-arrow-up" aria-hidden="true"></i> ${moonRise ? formatTime(this.config, moonRise) : "..."}</span>`
				  + `<span><i class="fas fa-arrow-down" aria-hidden="true"></i> ${moonSet ? formatTime(this.config, moonSet) : "..."}</span>`;
			digitalWrapper.appendChild(moonWrapper);
		}

		if (this.config.showWeek) {
			if (this.config.showWeek === "short") {
				weekWrapper.innerHTML = this.translate("WEEK_SHORT", { weekNumber: now.week() });
			} else {
				weekWrapper.innerHTML = this.translate("WEEK", { weekNumber: now.week() });
			}

			digitalWrapper.appendChild(weekWrapper);
		}

		// Compact month calendar showing month and day grid with today highlighted
		if (this.config.showMonthCalendar) {
			const calWrapper = document.createElement("div");
			calWrapper.className = "month-calendar dimmed small";

			const monthName = document.createElement("div");
			monthName.className = "month-name";
			monthName.innerHTML = now.format("MMMM YYYY");
			calWrapper.appendChild(monthName);

			// Weekday headings (Sun, Mon, Tues, ...)
			const weekdays = document.createElement("div");
			weekdays.className = "weekdays";
			const weekdayLabels = ["Sun", "Mon", "Tues", "Wed", "Thu", "Fri", "Sat"];
			weekdayLabels.forEach((label) => {
				const el = document.createElement("span");
				el.className = "weekday";
				el.textContent = label;
				weekdays.appendChild(el);
			});
			calWrapper.appendChild(weekdays);

			const daysContainer = document.createElement("div");
			daysContainer.className = "days";

			const startOfMonth = now.clone().startOf("month");
			const endOfMonth = now.clone().endOf("month");
			const totalDays = endOfMonth.date();
			const holidays = this.config.highlightHolidays ? this.getUSHolidays(now.year()) : new Set();

			// Pad with empty cells so day 1 lines up under its weekday column
			for (let s = 0; s < startOfMonth.day(); s++) {
				const spacerEl = document.createElement("span");
				spacerEl.className = "day spacer";
				daysContainer.appendChild(spacerEl);
			}

			for (let d = 1; d <= totalDays; d++) {
				const dayEl = document.createElement("span");
				dayEl.className = "day";
				if (d === now.date()) dayEl.classList.add("today");
				if (holidays.has(`${now.year()}-${now.month() + 1}-${d}`)) dayEl.classList.add("holiday");
				dayEl.textContent = String(d);
				daysContainer.appendChild(dayEl);
			}

			calWrapper.appendChild(daysContainer);
			digitalWrapper.appendChild(calWrapper);
		}

		/****************************************************************
		 * Create wrappers for ANALOG clock, only if specified in config
		 */
		if (this.config.displayType !== "digital") {
			// If it isn't 'digital', then an 'analog' clock was also requested

			// Calculate the degree offset for each hand of the clock
			if (this.config.timezone) {
				now.tz(this.config.timezone);
			}
			const second = now.seconds() * 6,
				minute = now.minute() * 6 + second / 60,
				hour = ((now.hours() % 12) / 12) * 360 + 90 + minute / 12;

			// Create wrappers
			analogWrapper.style.width = this.config.analogSize;
			analogWrapper.style.height = this.config.analogSize;

			if (this.config.analogFace !== "" && this.config.analogFace !== "simple" && this.config.analogFace !== "none") {
				analogWrapper.style.background = `url(${this.data.path}faces/${this.config.analogFace}.svg)`;
				analogWrapper.style.backgroundSize = "100%";

				// The following line solves issue: https://github.com/MagicMirrorOrg/MagicMirror/issues/611
				// analogWrapper.style.border = "1px solid black";
				analogWrapper.style.border = "rgba(0, 0, 0, 0.1)"; //Updated fix for Issue 611 where non-black backgrounds are used
			} else if (this.config.analogFace !== "none") {
				analogWrapper.style.border = "2px solid white";
			}
			const clockFace = document.createElement("div");
			clockFace.className = "clock-face";

			const clockHour = document.createElement("div");
			clockHour.id = "clock-hour";
			clockHour.style.transform = `rotate(${hour}deg)`;
			clockHour.className = "clock-hour";
			const clockMinute = document.createElement("div");
			clockMinute.id = "clock-minute";
			clockMinute.style.transform = `rotate(${minute}deg)`;
			clockMinute.className = "clock-minute";

			// Combine analog wrappers
			clockFace.appendChild(clockHour);
			clockFace.appendChild(clockMinute);

			if (this.config.displaySeconds) {
				const clockSecond = document.createElement("div");
				clockSecond.id = "clock-second";
				clockSecond.style.transform = `rotate(${second}deg)`;
				clockSecond.className = "clock-second";
				clockSecond.style.backgroundColor = this.config.secondsColor; /* DEPRECATED, to be removed in a future version , use CSS instead */
				clockFace.appendChild(clockSecond);
			}
			analogWrapper.appendChild(clockFace);
		}

		/*******************************************
		 * Update placement, respect old analogShowDate even if it's not needed anymore
		 */
		if (this.config.displayType === "analog") {
			// Display only an analog clock
			if (this.config.showDate) {
				// Add date to the analog clock
				dateWrapper.innerHTML = now.format(this.config.dateFormat);
				wrapper.appendChild(dateWrapper);
			}
			if (this.config.analogShowDate === "bottom") {
				wrapper.classList.add("clock-grid-bottom");
			} else if (this.config.analogShowDate === "top") {
				wrapper.classList.add("clock-grid-top");
			}
			wrapper.appendChild(analogWrapper);
		} else if (this.config.displayType === "digital") {
			wrapper.appendChild(digitalWrapper);
		} else if (this.config.displayType === "both") {
			wrapper.classList.add(`clock-grid-${this.config.analogPlacement}`);
			wrapper.appendChild(analogWrapper);
			wrapper.appendChild(digitalWrapper);
		}

		// Return the wrapper to the dom.
		return wrapper;
	}
});
