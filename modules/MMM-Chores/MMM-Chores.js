/*
 * Touchscreen daily chore board. Chores belong to one of three rotating sets
 * (setA/setB/setC) or to "extras" (which never rotates); the persisted
 * `rotation` map is what currently assigns each set to a child. Rotating the
 * week only changes that mapping, never the chores themselves. Completion
 * state lives only in frontend memory and is never persisted.
 */

const GROUP_LABELS = { setA: "Set A", setB: "Set B", setC: "Set C", extras: "Extras" };
const ASSIGNABLE_GROUPS = ["setA", "setB", "setC", "extras"];
const DEFAULT_EXTRAS_COLOR = "#2ecc71";

Module.register("MMM-Chores", {
	defaults: {
		title: "Chores",
		showManagementControls: true,
		fullscreenOverlay: false,
		// Static left-to-right column order; the rotation still decides which
		// set each of these children currently holds.
		childOrder: ["Luke", "Noah", "Annalise"],
		// Optional child name -> image URL/path for the small avatar circle
		// next to each column's name. Falls back to the child's first initial.
		avatars: {},
		// Optional child name -> color (e.g. matching their calendar's color
		// in config.js) used to tint that column's background/border.
		childColors: {},
		// Background/border tint color for the Extras column.
		extrasColor: DEFAULT_EXTRAS_COLOR
	},

	getStyles () {
		return ["font-awesome.css", this.file("MMM-Chores.css")];
	},

	start () {
		this.loaded = false;
		this.rotation = {};
		this.chores = [];
		this.completedChores = new Set();
		this.parentCompleted = new Set();
		this.activeDialog = null;
		this.flashMessage = null;
		this.sendSocketNotification("GET_CHORES_DATA");
	},

	socketNotificationReceived (notification, payload) {
		if (notification === "CHORES_DATA") {
			this.rotation = payload.rotation;
			this.chores = payload.chores;
			this.loaded = true;
			this.updateDom(200);
		}
	},

	getDom () {
		const wrapper = document.createElement("div");
		wrapper.className = this.config.fullscreenOverlay ? "mc-wrapper mc-overlay" : "mc-wrapper";

		const heading = document.createElement("div");
		heading.className = "mc-heading bright";
		heading.textContent = this.config.title.toUpperCase();
		wrapper.appendChild(heading);

		if (!this.loaded) {
			const loading = document.createElement("div");
			loading.className = "mc-empty dimmed small";
			loading.textContent = this.translate ? this.translate("LOADING") : "Loading...";
			wrapper.appendChild(loading);
			return wrapper;
		}

		wrapper.appendChild(this.buildBoard());
		wrapper.appendChild(this.buildControls());

		if (this.flashMessage) {
			const flash = document.createElement("div");
			flash.className = "mc-flash dimmed small";
			flash.textContent = this.flashMessage;
			wrapper.appendChild(flash);
		}

		if (this.activeDialog) {
			wrapper.appendChild(this.buildDialogOverlay());
		}

		return wrapper;
	},

	/**
	 * The children currently in the rotation, in the static configured
	 * column order (falling back to the persisted key order if a configured
	 * name isn't actually in the rotation).
	 * @returns {string[]} child names
	 */
	children () {
		const order = this.config.childOrder && this.config.childOrder.length
			? this.config.childOrder
			: Object.keys(this.rotation);
		return order.filter((name) => Object.prototype.hasOwnProperty.call(this.rotation, name));
	},

	/**
	 * Builds the Luke/Noah/Annalise/Extras column layout. Each child column
	 * shows whichever set the current rotation assigns them; Extras is a
	 * fixed, non-rotating fifth-wheel column.
	 * @returns {HTMLDivElement} the board grid
	 */
	buildBoard () {
		const board = document.createElement("div");
		board.className = "mc-board";
		board.style.setProperty("--mc-columns", this.children().length + 1);

		this.children().forEach((child) => {
			board.appendChild(this.buildColumn(child, this.rotation[child], false));
		});
		board.appendChild(this.buildColumn("Extras", "extras", true));

		return board;
	},

	buildColumn (name, group, isExtras) {
		const column = document.createElement("div");
		column.className = "mc-column";

		const tintColor = isExtras ? (this.config.extrasColor || DEFAULT_EXTRAS_COLOR) : this.config.childColors && this.config.childColors[name];
		if (tintColor) {
			column.style.backgroundColor = this.hexToRgba(tintColor, 0.16);
			column.style.borderColor = this.hexToRgba(tintColor, 0.55);
		}

		const header = document.createElement("div");
		header.className = "mc-column-header";

		const nameRow = document.createElement("div");
		nameRow.className = "mc-column-name-row";
		nameRow.appendChild(this.buildAvatar(name, isExtras));

		const headerLabel = document.createElement("div");
		headerLabel.className = "mc-column-label bright";
		headerLabel.textContent = name.toUpperCase();
		nameRow.appendChild(headerLabel);

		header.appendChild(nameRow);

		// Extras has no rotating set, but it still gets a subtitle line (kept
		// empty/invisible) so its header is the same height as the other
		// columns' and their chore lists start at the same vertical position.
		const headerSubtitle = document.createElement("div");
		headerSubtitle.className = "mc-column-subtitle dimmed xsmall";
		if (isExtras) {
			headerSubtitle.classList.add("mc-column-subtitle-hidden");
			headerSubtitle.textContent = " ";
		} else {
			headerSubtitle.textContent = GROUP_LABELS[group];
		}
		header.appendChild(headerSubtitle);

		column.appendChild(header);

		const list = document.createElement("div");
		list.className = "mc-column-list";

		const choresInGroup = this.chores.filter((chore) => chore.group === group);
		if (choresInGroup.length === 0) {
			const empty = document.createElement("div");
			empty.className = "mc-column-empty dimmed xsmall";
			empty.textContent = "No chores";
			list.appendChild(empty);
		} else {
			choresInGroup.forEach((chore) => list.appendChild(this.buildTile(chore, tintColor)));
		}

		column.appendChild(list);
		return column;
	},

	/**
	 * The small circle shown next to a column's name: a user-supplied image
	 * for a child (falling back to their first initial), or a fixed green $
	 * for Extras since those chores are typically worth extra money.
	 * @returns {HTMLDivElement} the avatar element
	 */
	buildAvatar (name, isExtras) {
		const avatar = document.createElement("div");
		avatar.className = "mc-avatar";

		if (isExtras) {
			avatar.classList.add("mc-avatar-extras");
			avatar.textContent = "$";
			return avatar;
		}

		const url = this.config.avatars && this.config.avatars[name];
		if (url) {
			avatar.classList.add("mc-avatar-image");
			avatar.style.backgroundImage = `url("${url}")`;
		} else {
			avatar.textContent = name.charAt(0).toUpperCase();
			const color = this.config.childColors && this.config.childColors[name];
			if (color) {
				avatar.style.backgroundColor = color;
			}
		}

		return avatar;
	},

	/**
	 * Parses a "#rrggbb"/"#rgb" hex color into [r, g, b] components.
	 * @returns {number[]} the [r, g, b] components
	 */
	hexToRgb (hex) {
		const clean = hex.replace("#", "");
		const full = clean.length === 3 ? clean.split("").map((c) => c + c).join("") : clean;
		const value = parseInt(full, 16);
		return [(value >> 16) & 255, (value >> 8) & 255, value & 255];
	},

	/**
	 * Converts a hex color to an rgba() string, for tinting column
	 * backgrounds/borders from configured hex colors at a given opacity
	 * rather than hard-coding pre-mixed colors.
	 * @returns {string} an rgba(...) color string
	 */
	hexToRgba (hex, alpha) {
		const [r, g, b] = this.hexToRgb(hex);
		return `rgba(${r}, ${g}, ${b}, ${alpha})`;
	},

	/**
	 * Converts a hex color to a darkened rgba() string, so a chore tile can
	 * use a deeper shade of its column's color and visually stand out from
	 * the column's own (much lighter) tinted background.
	 * @returns {string} an rgba(...) color string
	 */
	darkenToRgba (hex, darkenAmount, alpha) {
		const [r, g, b] = this.hexToRgb(hex);
		const scale = 1 - darkenAmount;
		return `rgba(${Math.round(r * scale)}, ${Math.round(g * scale)}, ${Math.round(b * scale)}, ${alpha})`;
	},

	buildTile (chore, tintColor) {
		const tile = document.createElement("div");
		tile.className = "mc-tile";
		tile.setAttribute("role", "button");
		tile.tabIndex = 0;

		// A darker shade of the column's own color, so the tile reads as a
		// distinct surface sitting on top of the column's much lighter tint.
		// The indicator circle and ⋮ menu icon reuse this same darkened shade
		// so they read as part of the tile rather than a generic gray.
		if (tintColor) {
			tile.style.setProperty("--mc-tile-bg", this.darkenToRgba(tintColor, 0.45, 0.55));
			const accent = this.darkenToRgba(tintColor, 0.15, 0.9);
			tile.style.setProperty("--mc-tile-border", accent);
			tile.style.setProperty("--mc-tile-accent", accent);
		}

		const indicator = document.createElement("div");
		indicator.className = "mc-tile-indicator";

		// Parent-completed is a stronger, red-flagged state layered on top of
		// plain completion: it means the chore got done, but not by the kid
		// it was assigned to.
		const refreshState = () => {
			const parentDone = this.parentCompleted.has(chore.id);
			const complete = parentDone || this.completedChores.has(chore.id);
			tile.classList.toggle("mc-tile-complete", complete && !parentDone);
			tile.classList.toggle("mc-tile-parent-completed", parentDone);
			indicator.textContent = complete ? "✓" : "○";
		};
		refreshState();

		const name = document.createElement("div");
		name.className = "mc-tile-name";
		name.textContent = chore.name;

		tile.appendChild(indicator);
		tile.appendChild(name);

		const toggle = () => {
			if (this.parentCompleted.has(chore.id)) {
				this.parentCompleted.delete(chore.id);
				this.completedChores.delete(chore.id);
			} else if (this.completedChores.has(chore.id)) {
				this.completedChores.delete(chore.id);
			} else {
				this.completedChores.add(chore.id);
			}
			refreshState();
		};

		tile.addEventListener("click", toggle);
		tile.addEventListener("keydown", (event) => {
			if (event.key === "Enter" || event.key === " ") {
				event.preventDefault();
				toggle();
			}
		});

		if (this.config.showManagementControls) {
			const manageButton = document.createElement("button");
			manageButton.type = "button";
			manageButton.className = "mc-tile-manage";
			manageButton.setAttribute("aria-label", `Assign ${chore.name}`);
			const manageIcon = document.createElement("i");
			manageIcon.className = "fas fa-fw fa-ellipsis-vertical";
			manageButton.appendChild(manageIcon);
			manageButton.addEventListener("click", (event) => {
				event.stopPropagation();
				this.openAssignDialog(chore);
			});
			tile.appendChild(manageButton);
		}

		return tile;
	},

	buildControls () {
		const controls = document.createElement("div");
		controls.className = "mc-controls";

		controls.appendChild(this.buildControlButton("plus", "New Chore", () => this.openNewChoreDialog()));
		controls.appendChild(this.buildControlButton("arrow-rotate-left", "Reset Today", () => this.openResetDialog()));
		controls.appendChild(this.buildControlButton("arrows-rotate", "Rotate Week", () => this.rotateWeek()));

		return controls;
	},

	buildControlButton (icon, label, onClick) {
		const button = document.createElement("button");
		button.type = "button";
		button.className = "mc-control-button";

		const iconEl = document.createElement("i");
		iconEl.className = `fas fa-fw fa-${icon} mc-control-icon`;
		button.appendChild(iconEl);

		const labelEl = document.createElement("span");
		labelEl.className = "mc-control-label";
		labelEl.textContent = label;
		button.appendChild(labelEl);

		button.addEventListener("click", onClick);
		return button;
	},

	rotateWeek () {
		this.sendSocketNotification("ROTATE_WEEK");
		this.showFlash("Week rotated");
	},

	showFlash (message) {
		this.flashMessage = message;
		this.updateDom(0);
		clearTimeout(this._flashTimer);
		this._flashTimer = setTimeout(() => {
			this.flashMessage = null;
			this.updateDom(300);
		}, 2500);
	},

	openNewChoreDialog () {
		this.activeDialog = { type: "newChore" };
		this.updateDom(0);
	},

	openResetDialog () {
		this.activeDialog = { type: "confirmReset" };
		this.updateDom(0);
	},

	openAssignDialog (chore) {
		this.activeDialog = { type: "assign", choreId: chore.id, choreName: chore.name, group: chore.group };
		this.updateDom(0);
	},

	closeDialog () {
		this.activeDialog = null;
		this.updateDom(0);
	},

	buildDialogOverlay () {
		const overlay = document.createElement("div");
		overlay.className = "mc-dialog-overlay";
		overlay.addEventListener("click", (event) => {
			if (event.target === overlay) {
				this.closeDialog();
			}
		});

		const builders = {
			newChore: () => this.buildNewChoreDialog(),
			confirmReset: () => this.buildConfirmResetDialog(),
			assign: () => this.buildAssignDialog()
		};

		overlay.appendChild(builders[this.activeDialog.type]());
		return overlay;
	},

	buildDialogShell (title) {
		const dialog = document.createElement("div");
		dialog.className = "mc-dialog";

		const titleEl = document.createElement("div");
		titleEl.className = "mc-dialog-title bright";
		titleEl.textContent = title;
		dialog.appendChild(titleEl);

		return dialog;
	},

	buildDialogButtons (dialog, { cancelLabel = "Cancel", confirmLabel, onConfirm, confirmClass = "" }) {
		const buttonRow = document.createElement("div");
		buttonRow.className = "mc-dialog-buttons";

		const cancelButton = document.createElement("button");
		cancelButton.type = "button";
		cancelButton.className = "mc-dialog-button mc-dialog-button-cancel";
		cancelButton.textContent = cancelLabel;
		cancelButton.addEventListener("click", () => this.closeDialog());
		buttonRow.appendChild(cancelButton);

		const confirmButton = document.createElement("button");
		confirmButton.type = "button";
		confirmButton.className = `mc-dialog-button mc-dialog-button-confirm ${confirmClass}`;
		confirmButton.textContent = confirmLabel;
		confirmButton.addEventListener("click", onConfirm);
		buttonRow.appendChild(confirmButton);

		dialog.appendChild(buttonRow);
	},

	buildNewChoreDialog () {
		const dialog = this.buildDialogShell("New Chore");

		const input = document.createElement("input");
		input.type = "text";
		input.className = "mc-dialog-input";
		input.placeholder = "Chore name";
		dialog.appendChild(input);

		const submit = () => {
			const name = input.value.trim();
			if (!name) {
				return;
			}
			this.sendSocketNotification("ADD_CHORE", { name });
			this.closeDialog();
		};

		input.addEventListener("keydown", (event) => {
			if (event.key === "Enter") {
				submit();
			} else if (event.key === "Escape") {
				this.closeDialog();
			}
		});

		this.buildDialogButtons(dialog, { confirmLabel: "Add", onConfirm: submit });

		setTimeout(() => input.focus(), 0);
		return dialog;
	},

	buildConfirmResetDialog () {
		const dialog = this.buildDialogShell("Reset all chores?");

		const message = document.createElement("div");
		message.className = "mc-dialog-message dimmed small";
		message.textContent = "All completed chores will become incomplete.";
		dialog.appendChild(message);

		this.buildDialogButtons(dialog, {
			confirmLabel: "Reset",
			confirmClass: "mc-dialog-button-danger",
			onConfirm: () => {
				this.completedChores.clear();
				this.parentCompleted.clear();
				this.closeDialog();
			}
		});

		return dialog;
	},

	buildAssignDialog () {
		const { choreId, choreName, group } = this.activeDialog;
		const dialog = this.buildDialogShell(choreName);

		const sections = document.createElement("div");
		sections.className = "mc-dialog-sections";

		// Section 1: assign/reassign to a chore set
		const assignSection = document.createElement("div");
		assignSection.className = "mc-dialog-section";

		const label = document.createElement("div");
		label.className = "mc-dialog-message dimmed small";
		label.textContent = "Assign to:";
		assignSection.appendChild(label);

		const select = document.createElement("select");
		select.className = "mc-dialog-select";
		ASSIGNABLE_GROUPS.forEach((groupId) => {
			const option = document.createElement("option");
			option.value = groupId;
			option.textContent = GROUP_LABELS[groupId];
			if (groupId === group) {
				option.selected = true;
			}
			select.appendChild(option);
		});
		assignSection.appendChild(select);

		this.buildDialogButtons(assignSection, {
			confirmLabel: "Save",
			onConfirm: () => {
				this.sendSocketNotification("ASSIGN_CHORE", { id: choreId, group: select.value });
				this.closeDialog();
			}
		});

		sections.appendChild(assignSection);

		// Section 2: mark as completed by a parent instead of the assigned kid
		const parentSection = document.createElement("div");
		parentSection.className = "mc-dialog-section";

		const parentButton = document.createElement("button");
		parentButton.type = "button";
		parentButton.className = "mc-dialog-button mc-dialog-button-parent";
		parentButton.textContent = this.parentCompleted.has(choreId) ? "Unmark Mom/Dad Completed" : "Mom/Dad Completed";
		parentButton.addEventListener("click", () => {
			if (this.parentCompleted.has(choreId)) {
				this.parentCompleted.delete(choreId);
				this.completedChores.delete(choreId);
			} else {
				this.parentCompleted.add(choreId);
				this.completedChores.add(choreId);
			}
			this.closeDialog();
		});
		parentSection.appendChild(parentButton);

		sections.appendChild(parentSection);

		// Section 3: permanently delete the chore
		const deleteSection = document.createElement("div");
		deleteSection.className = "mc-dialog-section";

		const deleteButton = document.createElement("button");
		deleteButton.type = "button";
		deleteButton.className = "mc-dialog-button mc-dialog-button-delete";
		deleteButton.textContent = "Delete Chore";
		deleteButton.addEventListener("click", () => {
			this.sendSocketNotification("DELETE_CHORE", { id: choreId });
			this.completedChores.delete(choreId);
			this.parentCompleted.delete(choreId);
			this.closeDialog();
		});
		deleteSection.appendChild(deleteButton);

		sections.appendChild(deleteSection);

		dialog.appendChild(sections);

		return dialog;
	}
});
