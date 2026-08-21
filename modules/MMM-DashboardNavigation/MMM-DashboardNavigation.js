/*
 * Renders a persistent bottom navigation bar and swaps between client-side
 * "pages" without reloading MagicMirror. Home modules are shown/hidden using
 * the core Module.show()/hide() API (not destroyed/recreated) whenever the
 * user crosses the home <-> non-home boundary. School/Chores content is
 * rendered by this same module as a full-screen overlay above the nav bar.
 */
Module.register("MMM-DashboardNavigation", {
    defaults: {
        pages: [
            { id: "home", label: "HOME", icon: "house-chimney" },
            { id: "school", label: "SCHOOL", icon: "chalkboard" },
            { id: "chores", label: "CHORES", icon: "list-check" }
        ],
        school: {
            schoolSites: [
                {
                    id: "sths",
                    label: "STHS",
                    url: "http://sths.org/",
                    logo: "https://www.sths.org/wp-content/uploads/2026/07/sth-logo-full-2026-400x121.png"
                },
                {
                    id: "stm",
                    label: "STM",
                    url: "https://stthomasmore-school.org/",
                    logo: "https://files.ecatholic.com/10809/pictures/2022/7/school-logo-header.png?t=1657128195000"
                }
            ],
            children: [
                {
                    id: "luke",
                    name: "Luke",
                    color: "#03C1FF",
                    avatar: "",
                    scheduleUrl: "webcal://sths.myschoolapp.com/podium/feed/iCal.aspx?z=%2bWnDUoj%2bQbg0jm8qFAD8CUOeRtfzXFBq2Bltsozl3agJ3TOKd6uTjQBIE%2f0NuvpW68QAmHxL2hBWbvx8MZ3VOQ%3d%3d",
                    portalUrl: "https://sths.myschoolapp.com/app/parent?svcid=edu#profile/8111550/progress",
                    portalLabel: "Grades & Coursework"
                },
                {
                    id: "noah",
                    name: "Noah",
                    color: "#98FB98",
                    avatar: "",
                    scheduleUrl: "webcal://sths.myschoolapp.com/podium/feed/iCal.aspx?z=%2bWnDUoj%2bQbg0jm8qFAD8CUOeRtfzXFBq2Bltsozl3aiUM8J4sHFN5FvsTJijtf%2b1Mf6YMfUmdYfxqO4rHTNrzQ%3d%3d",
                    portalUrl: "https://sths.myschoolapp.com/app/parent?svcid=edu#profile/8745892/progress",
                    portalLabel: "Grades & Coursework"
                },
                {
                    id: "annalise",
                    name: "Annalise",
                    color: "#B19CD9",
                    avatar: "",
                    logo: "https://files.ecatholic.com/10809/pictures/2022/7/school-logo-header.png?t=1657128195000",
                    scheduleUrl: null,
                    portalUrl: null,
                    portalLabel: "Coursework Portal"
                }
            ],
            scheduleRefreshMinutes: 30,
            // Special-occasion announcements (e.g. "Go Texan Day", "Spirit
            // Night at Los Tios"), sourced from a single shared calendar
            // rather than a per-child one. null/blank disables the banner
            // entirely rather than showing it empty.
            announcementsUrl: null,
            announcementsRefreshMinutes: 60,
            announcementsWindowDays: 7,
            announcementsMaxItems: 5
        }
    },

    LOCK_STRING: "MMM-DASHBOARD-NAV",
    CHORES_LOCK_STRING: "MMM-DASHBOARD-NAV-CHORES",

    start() {
        this.currentPage = "home";
        this.currentWeather = null;
        this.schoolSchedules = {};
        this.announcements = { loaded: false, events: [] };
        this.scheduleStatusBarTick();
        this.subscribeSchoolSchedules();
        this.subscribeAnnouncements();
    },

    getStyles() {
        return ["font-awesome.css", "weather-icons.css", this.file("MMM-DashboardNavigation.css")];
    },

    // Subscribed once at startup (not only when the School page is opened) so
    // a child's schedule is very likely already cached by the time someone
    // actually taps into School, rather than showing a loading state every time.
    subscribeSchoolSchedules() {
        const children = this.config.school.children
            .filter((child) => child.scheduleUrl)
            .map((child) => ({
                id: child.id,
                scheduleUrl: child.scheduleUrl,
                refreshMinutes: this.config.school.scheduleRefreshMinutes
            }));

        if (children.length) {
            this.sendSocketNotification("SCHOOL_SUBSCRIBE_SCHEDULES", { children });
        }
    },

    subscribeAnnouncements() {
        if (!this.config.school.announcementsUrl) {
            return;
        }

        this.sendSocketNotification("SCHOOL_SUBSCRIBE_ANNOUNCEMENTS", {
            url: this.config.school.announcementsUrl,
            refreshMinutes: this.config.school.announcementsRefreshMinutes,
            windowDays: this.config.school.announcementsWindowDays,
            maxItems: this.config.school.announcementsMaxItems
        });
    },

    socketNotificationReceived(notification, payload) {
        if (notification === "SCHOOL_SCHEDULE_DATA") {
            this.schoolSchedules[payload.childId] = { loaded: true, error: null, events: payload.events };
        } else if (notification === "SCHOOL_SCHEDULE_ERROR") {
            this.schoolSchedules[payload.childId] = { loaded: true, error: payload.message, events: [] };
        } else if (notification === "SCHOOL_ANNOUNCEMENTS_DATA") {
            this.announcements = { loaded: true, events: payload.events };
        } else {
            return;
        }

        if (this.currentPage === "school") {
            this.updateDom();
        }
    },

    // The weather module broadcasts this on every refresh; grab the current
    // conditions for the status bar without configuring/duplicating a weather
    // provider of our own. Config has two weather instances (current and
    // forecast); the forecast one never populates its own current conditions
    // and broadcasts currentWeather: null, so a null payload here is that
    // instance's data, not "the weather went away" - ignore it rather than
    // clobbering the real value from the current-type instance.
    notificationReceived(notification, payload) {
        if (notification !== "WEATHER_UPDATED" || !payload.currentWeather) {
            return;
        }

        this.currentWeather = payload.currentWeather;
        if (this.currentPage !== "home") {
            this.updateDom();
        }
    },

    // Keeps the status bar clock ticking once a minute while a non-Home page
    // is showing, aligned to the minute boundary rather than a plain interval.
    scheduleStatusBarTick() {
        const now = new Date();
        const msUntilNextMinute = (60 - now.getSeconds()) * 1000 - now.getMilliseconds() + 50;
        setTimeout(() => {
            if (this.currentPage !== "home") {
                this.updateDom();
            }
            this.scheduleStatusBarTick();
        }, msUntilNextMinute);
    },

    getDom() {
        const wrapper = document.createElement("div");
        wrapper.className = "dashboard-nav-wrapper";

        wrapper.appendChild(this.buildStatusBar());
        wrapper.appendChild(this.buildPageContent());
        wrapper.appendChild(this.buildNavBar());

        return wrapper;
    },

    // Top status bar shown on every non-Home page: date/time on the left,
    // weather on the right. Rendered as its own fixed element (rather than
    // nested inside dashboard-nav-content) so it also sits above MMM-Chores'
    // fullscreen overlay - see --dashboard-status-height in the CSS.
    buildStatusBar() {
        const bar = document.createElement("div");
        bar.className = "dashboard-status-bar";

        if (this.currentPage === "home") {
            bar.classList.add("hidden");
            return bar;
        }

        const time = document.createElement("div");
        time.className = "dashboard-status-time";
        time.textContent = this.formatStatusBarTime(new Date());
        bar.appendChild(time);

        const weather = document.createElement("div");
        weather.className = "dashboard-status-weather";

        if (this.currentWeather?.weatherType) {
            const icon = document.createElement("i");
            icon.className = `wi wi-${this.currentWeather.weatherType} dashboard-status-weather-icon`;
            icon.setAttribute("aria-hidden", "true");
            weather.appendChild(icon);
        }

        if (this.currentWeather?.temperature !== null && this.currentWeather?.temperature !== undefined) {
            const temp = document.createElement("span");
            temp.className = "dashboard-status-weather-temp";
            temp.textContent = `${Math.round(this.currentWeather.temperature)}°F`;
            weather.appendChild(temp);
        }

        bar.appendChild(weather);
        return bar;
    },

    // e.g. "Friday, August 21, 2026 7:19am" (or "...19:19" when the global
    // config uses 24-hour time). Seconds are intentionally omitted.
    formatStatusBarTime(date) {
        const weekday = date.toLocaleDateString("en-US", { weekday: "long" });
        const monthDay = date.toLocaleDateString("en-US", { month: "long", day: "numeric" });
        const year = date.getFullYear();
        const minutes = String(date.getMinutes()).padStart(2, "0");

        if (config.timeFormat === 24) {
            const hours = String(date.getHours()).padStart(2, "0");
            return `${weekday}, ${monthDay}, ${year} ${hours}:${minutes}`;
        }

        const hours = date.getHours() % 12 || 12;
        const period = date.getHours() >= 12 ? "pm" : "am";
        return `${weekday}, ${monthDay}, ${year} ${hours}:${minutes}${period}`;
    },

    buildNavBar() {
        const nav = document.createElement("nav");
        nav.className = "dashboard-nav-bar";

        for (const page of this.config.pages) {
            const button = document.createElement("button");
            button.type = "button";
            button.className = "dashboard-nav-button";
            if (page.id === this.currentPage) {
                button.classList.add("active");
            }

            if (page.icon) {
                const icon = document.createElement("i");
                icon.className = `fas fa-fw fa-${page.icon} dashboard-nav-icon`;
                icon.setAttribute("aria-hidden", "true");
                button.appendChild(icon);
            }

            const label = document.createElement("span");
            label.className = "dashboard-nav-label";
            label.textContent = page.label;
            button.appendChild(label);

            button.addEventListener("click", () => this.selectPage(page.id));
            nav.appendChild(button);
        }

        return nav;
    },

    buildPageContent() {
        const content = document.createElement("div");
        content.className = "dashboard-nav-content";

        if (this.currentPage === "home") {
            content.classList.add("hidden");
            return content;
        }

        content.appendChild(this.renderPage(this.currentPage));
        return content;
    },

    renderPage(pageId) {
        if (pageId === "school") {
            return this.renderSchoolPage();
        }
        if (pageId === "chores") {
            return this.renderChoresPage();
        }
        return this.renderPlaceholderPage(pageId);
    },

    renderSchoolPage() {
        const container = document.createElement("div");
        container.className = "dashboard-page dashboard-page-school";

        // Collapses to nothing (no element at all) when there's nothing to
        // announce, rather than reserving space for an empty banner every day.
        const banner = this.buildAnnouncementsBanner();
        if (banner) {
            container.appendChild(banner);
        }

        const siteRow = document.createElement("div");
        siteRow.className = "dashboard-school-sites";
        for (const site of this.config.school.schoolSites) {
            siteRow.appendChild(this.buildSchoolSiteButton(site));
        }
        container.appendChild(siteRow);

        const board = document.createElement("div");
        board.className = "dashboard-school-board";
        for (const child of this.config.school.children) {
            board.appendChild(this.buildChildColumn(child));
        }
        container.appendChild(board);

        return container;
    },

    buildAnnouncementsBanner() {
        if (!this.announcements.loaded || !this.announcements.events.length) {
            return null;
        }

        const banner = document.createElement("div");
        banner.className = "dashboard-school-announcements";

        for (const event of this.announcements.events) {
            const item = document.createElement("div");
            item.className = "dashboard-school-announcement";

            const icon = document.createElement("i");
            icon.className = "fas fa-fw fa-bullhorn dashboard-school-announcement-icon";
            icon.setAttribute("aria-hidden", "true");
            item.appendChild(icon);

            const text = document.createElement("span");
            text.textContent = `${event.title} — ${this.formatAnnouncementDay(event.start)}`;
            item.appendChild(text);

            banner.appendChild(item);
        }

        return banner;
    },

    // "Today"/"Tomorrow" for the near term, otherwise a short weekday name -
    // announcements are day-scale ("Go Texan Day"), so a specific time isn't
    // useful here even for events that do carry one.
    formatAnnouncementDay(ms) {
        const date = new Date(ms);
        const today = new Date();
        if (date.toDateString() === today.toDateString()) {
            return "Today";
        }

        const tomorrow = new Date(today);
        tomorrow.setDate(today.getDate() + 1);
        if (date.toDateString() === tomorrow.toDateString()) {
            return "Tomorrow";
        }

        return date.toLocaleDateString("en-US", { weekday: "short" });
    },

    // School site buttons render logo-only (no text label) - the schools are
    // identified visually by their logo, same as tapping an app icon.
    buildSchoolSiteButton(site) {
        const button = document.createElement("button");
        button.type = "button";
        button.className = "dashboard-school-site-button";

        if (!site.url) {
            button.classList.add("disabled");
            button.disabled = true;
        }

        if (site.logo) {
            const logo = document.createElement("img");
            logo.className = "dashboard-school-site-logo";
            logo.src = site.logo;
            logo.alt = site.label;
            button.appendChild(logo);
        } else {
            const label = document.createElement("span");
            label.className = "dashboard-school-site-label";
            label.textContent = site.label;
            button.appendChild(label);
        }

        button.addEventListener("click", () => this.openLink(site.url));
        return button;
    },

    buildChildColumn(child) {
        const column = document.createElement("div");
        column.className = "dashboard-school-column";

        // Same tinting technique as MMM-Chores' buildColumn(): a translucent
        // wash of the child's own color for the column, so School and Chores
        // read as the same color system for the same kid.
        if (child.color) {
            column.style.backgroundColor = this.hexToRgba(child.color, 0.16);
            column.style.borderColor = this.hexToRgba(child.color, 0.55);
        }

        const header = document.createElement("div");
        header.className = "dashboard-school-column-header";

        const nameRow = document.createElement("div");
        nameRow.className = "dashboard-school-column-name-row";
        nameRow.appendChild(this.buildChildAvatar(child));

        const name = document.createElement("div");
        name.className = "dashboard-school-column-name bright";
        name.textContent = child.name.toUpperCase();
        nameRow.appendChild(name);

        header.appendChild(nameRow);
        column.appendChild(header);
        column.appendChild(this.buildChildScheduleBody(child));
        column.appendChild(this.buildPortalButton(child));

        return column;
    },

    buildChildAvatar(child) {
        const avatar = document.createElement("div");
        avatar.className = "dashboard-school-avatar";

        if (child.avatar) {
            avatar.classList.add("dashboard-school-avatar-image");
            avatar.style.backgroundImage = `url("${child.avatar}")`;
        } else {
            avatar.textContent = child.name.charAt(0).toUpperCase();
            if (child.color) {
                avatar.style.backgroundColor = child.color;
            }
        }

        return avatar;
    },

    // Children without a scheduleUrl (Annalise, today) get a static logo card
    // instead of a class list. Children with one get their live schedule,
    // or a loading/empty/error message until data arrives.
    buildChildScheduleBody(child) {
        const body = document.createElement("div");
        body.className = "dashboard-school-column-body";

        if (!child.scheduleUrl) {
            body.classList.add("dashboard-school-column-static");

            if (child.logo) {
                const logo = document.createElement("img");
                logo.className = "dashboard-school-column-logo";
                logo.src = child.logo;
                logo.alt = "";
                body.appendChild(logo);
            }

            body.appendChild(this.buildScheduleMessage("No class schedule feed available yet"));
            return body;
        }

        const schedule = this.schoolSchedules[child.id];

        if (!schedule || !schedule.loaded) {
            body.appendChild(this.buildScheduleMessage("Loading today's schedule…"));
            return body;
        }

        if (schedule.error) {
            body.appendChild(this.buildScheduleMessage("Schedule unavailable"));
            return body;
        }

        if (!schedule.events.length) {
            body.appendChild(this.buildScheduleMessage("No classes scheduled today"));
            return body;
        }

        const list = document.createElement("div");
        list.className = "dashboard-school-class-list";
        for (const event of schedule.events) {
            list.appendChild(this.buildClassTile(event, child.color));
        }
        body.appendChild(list);
        return body;
    },

    buildScheduleMessage(text) {
        const message = document.createElement("div");
        message.className = "dashboard-school-column-message";
        message.textContent = text;
        return message;
    },

    buildClassTile(event, tintColor) {
        const tile = document.createElement("div");
        tile.className = "dashboard-school-class-tile";

        // A darker shade of the column's own color, same as MMM-Chores'
        // buildTile() - the tile reads as a distinct surface sitting on top
        // of the column's much lighter tint, in the same color family.
        if (tintColor) {
            tile.style.setProperty("--school-tile-bg", this.darkenToRgba(tintColor, 0.45, 0.55));
            const accent = this.darkenToRgba(tintColor, 0.15, 0.9);
            tile.style.setProperty("--school-tile-border", accent);
            tile.style.setProperty("--school-tile-accent", accent);
            // The current-period highlight stays in the same color family
            // (just lighter/more saturated) rather than switching to an
            // unrelated highlight color.
            tile.style.setProperty("--school-tile-current-bg", this.darkenToRgba(tintColor, 0.2, 0.7));
            tile.style.setProperty("--school-tile-current-border", this.hexToRgba(tintColor, 0.9));
        }

        if (event.fullDayEvent) {
            tile.classList.add("dashboard-school-class-tile-allday");
        } else {
            const now = Date.now();
            if (now >= event.start && now < event.end) {
                tile.classList.add("dashboard-school-class-tile-current");
            }

            const time = document.createElement("div");
            time.className = "dashboard-school-class-time";
            time.textContent = this.formatClassTimeRange(event.start, event.end);
            tile.appendChild(time);
        }

        const title = document.createElement("div");
        title.className = "dashboard-school-class-title";
        title.textContent = event.title;
        tile.appendChild(title);

        if (event.location) {
            const location = document.createElement("div");
            location.className = "dashboard-school-class-location";
            location.textContent = event.location;
            tile.appendChild(location);
        }

        return tile;
    },

    /**
     * Parses a "#rrggbb"/"#rgb" hex color into [r, g, b] components.
     * @returns {number[]} the [r, g, b] components
     */
    hexToRgb(hex) {
        const clean = hex.replace("#", "");
        const full = clean.length === 3 ? clean.split("").map((c) => c + c).join("") : clean;
        const value = parseInt(full, 16);
        return [(value >> 16) & 255, (value >> 8) & 255, value & 255];
    },

    // Same technique MMM-Chores.js uses for its own column/tile tinting -
    // kept as a matching but independent copy since School and Chores are
    // separate modules.
    hexToRgba(hex, alpha) {
        const [r, g, b] = this.hexToRgb(hex);
        return `rgba(${r}, ${g}, ${b}, ${alpha})`;
    },

    darkenToRgba(hex, darkenAmount, alpha) {
        const [r, g, b] = this.hexToRgb(hex);
        const scale = 1 - darkenAmount;
        return `rgba(${Math.round(r * scale)}, ${Math.round(g * scale)}, ${Math.round(b * scale)}, ${alpha})`;
    },

    formatClassTime(ms) {
        const date = new Date(ms);
        const minutes = String(date.getMinutes()).padStart(2, "0");

        if (config.timeFormat === 24) {
            return `${String(date.getHours()).padStart(2, "0")}:${minutes}`;
        }

        const hours = date.getHours() % 12 || 12;
        const period = date.getHours() >= 12 ? "pm" : "am";
        return minutes === "00" ? `${hours}${period}` : `${hours}:${minutes}${period}`;
    },

    formatClassTimeRange(start, end) {
        return `${this.formatClassTime(start)} – ${this.formatClassTime(end)}`;
    },

    buildPortalButton(child) {
        const button = document.createElement("button");
        button.type = "button";
        button.className = "dashboard-school-portal-button";

        if (!child.portalUrl) {
            button.classList.add("disabled");
            button.disabled = true;
        }

        button.textContent = child.portalLabel || "Coursework Portal";
        button.addEventListener("click", () => this.openLink(child.portalUrl));
        return button;
    },

    renderChoresPage() {
        // Real content is rendered by the MMM-Chores module itself, as a fixed
        // overlay (see syncChoresVisibility()/CHORES_LOCK_STRING below) that sits
        // above this now-empty placeholder. Keeping an empty container here (rather
        // than none at all) preserves dashboard-nav-content's background so there's
        // no flash-through to the home modules while MMM-Chores fades in.
        const container = document.createElement("div");
        container.className = "dashboard-page dashboard-page-chores";
        return container;
    },

    renderPlaceholderPage(pageId) {
        const page = this.config.pages.find((p) => p.id === pageId);
        const container = document.createElement("div");
        container.className = "dashboard-page dashboard-page-placeholder";
        container.appendChild(this.buildPageHeading(page ? page.label : pageId.toUpperCase(), "Coming soon"));
        return container;
    },

    buildPageHeading(title, subtitle) {
        const heading = document.createElement("div");
        heading.className = "dashboard-page-heading";

        const titleEl = document.createElement("div");
        titleEl.className = "dashboard-page-title";
        titleEl.textContent = title;
        heading.appendChild(titleEl);

        const subtitleEl = document.createElement("div");
        subtitleEl.className = "dashboard-page-subtitle";
        subtitleEl.textContent = subtitle;
        heading.appendChild(subtitleEl);

        return heading;
    },

    selectPage(pageId) {
        if (pageId === this.currentPage) {
            return;
        }

        const wasHome = this.currentPage === "home";
        const isHome = pageId === "home";

        this.currentPage = pageId;

        // Only touch other modules' visibility when crossing the home/non-home
        // boundary, so switching directly between School and Chores doesn't
        // re-trigger show/hide animations on every other module.
        if (wasHome !== isHome) {
            this.setHomeModulesVisible(isHome);
        }

        this.syncChoresVisibility(pageId);

        this.sendNotification("DASHBOARD_PAGE_CHANGED", pageId);
        this.updateDom(200);
    },

    setHomeModulesVisible(visible) {
        // MMM-Chores is excluded here: its visibility is managed exclusively by
        // syncChoresVisibility()/CHORES_LOCK_STRING below, tied to the Chores page
        // specifically rather than the Home/non-Home boundary. If it were included
        // in this generic loop, the hiddenOnStartup skip in the "visible" branch
        // would let this loop's hide() add LOCK_STRING here without ever removing
        // it again, permanently blocking syncChoresVisibility()'s later show() calls.
        const otherModules = MM.getModules().exceptModule(this).exceptWithClass("MMM-Chores");
        for (const otherModule of otherModules) {
            if (visible) {
                // Modules configured with hiddenOnStartup are meant to stay
                // hidden until something explicitly shows them again; they
                // never registered our lock string, so re-showing them here
                // would incorrectly pop them back up.
                if (otherModule.data.hiddenOnStartup) {
                    continue;
                }
                otherModule.show(300, () => {}, { lockString: this.LOCK_STRING });
            } else {
                otherModule.hide(300, () => {}, { lockString: this.LOCK_STRING });
            }
        }
    },

    getChoresModule() {
        return MM.getModules().withClass("MMM-Chores")[0] || null;
    },

    // MMM-Chores renders itself as a fixed full-screen overlay (see its
    // `fullscreenOverlay` config option) positioned above this module's own
    // (now-empty) Chores page content, so all we need to do is show/hide the
    // MMM-Chores module instance itself as the Chores page is entered/left.
    syncChoresVisibility(pageId) {
        const choresModule = this.getChoresModule();
        if (!choresModule) {
            return;
        }

        if (pageId === "chores") {
            choresModule.show(300, () => {}, { lockString: this.CHORES_LOCK_STRING });
        } else {
            choresModule.hide(300, () => {}, { lockString: this.CHORES_LOCK_STRING });
        }
    },

    openLink(url) {
        if (!url) {
            return;
        }
        window.open(url, "_blank");
    }
});
