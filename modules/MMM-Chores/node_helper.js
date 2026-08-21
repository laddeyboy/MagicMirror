const fs = require("fs/promises");
const path = require("path");
const crypto = require("crypto");
const NodeHelper = require("node_helper");
const Log = require("logger");

const GROUPS = ["setA", "setB", "setC", "extras"];

const DEFAULT_DATA = {
	rotation: { Luke: "setA", Noah: "setB", Annalise: "setC" },
	chores: []
};

module.exports = NodeHelper.create({
	start () {
		this.dataFile = path.join(this.path, "chores.json");
	},

	socketNotificationReceived (notification, payload) {
		if (notification === "GET_CHORES_DATA") {
			this.loadAndSend();
		} else if (notification === "ADD_CHORE") {
			this.handleAddChore(payload);
		} else if (notification === "ASSIGN_CHORE") {
			this.handleAssignChore(payload);
		} else if (notification === "DELETE_CHORE") {
			this.handleDeleteChore(payload);
		} else if (notification === "ROTATE_WEEK") {
			this.handleRotateWeek();
		}
	},

	/**
	 * Reads chores.json (creating it with the default dataset if missing) and
	 * sends the current state to the frontend.
	 */
	async loadAndSend () {
		const data = await this.readData();
		this.sendSocketNotification("CHORES_DATA", data);
	},

	/**
	 * Loads chores.json from disk. Creates it with the default dataset if it
	 * doesn't exist yet, and falls back to an in-memory default (without
	 * touching the file) if it exists but can't be parsed, so a corrupted file
	 * isn't silently overwritten.
	 * @returns {Promise<object>} the persisted { rotation, chores } data
	 */
	async readData () {
		try {
			const raw = await fs.readFile(this.dataFile, "utf8");
			return this.normalizeData(JSON.parse(raw));
		} catch (error) {
			if (error.code === "ENOENT") {
				Log.info(`[MMM-Chores] No chores.json found, creating default at ${this.dataFile}`);
				await this.writeData(DEFAULT_DATA);
				return DEFAULT_DATA;
			}
			Log.error(`[MMM-Chores] Failed to read/parse chores.json, using in-memory defaults: ${error.message}`);
			return DEFAULT_DATA;
		}
	},

	/**
	 * Writes { rotation, chores } to chores.json via a temp file + rename so a
	 * mid-write interruption can't leave a truncated/corrupt file behind.
	 * @param {object} data the { rotation, chores } data to persist
	 */
	async writeData (data) {
		const tmpFile = `${this.dataFile}.tmp`;
		await fs.writeFile(tmpFile, JSON.stringify(data, null, 2));
		await fs.rename(tmpFile, this.dataFile);
	},

	normalizeData (data) {
		const rotation = data && typeof data.rotation === "object" && data.rotation ? data.rotation : DEFAULT_DATA.rotation;
		const chores = Array.isArray(data && data.chores) ? data.chores : DEFAULT_DATA.chores;
		return { rotation, chores };
	},

	/**
	 * Adds a new chore to Extras and persists it. Never auto-assigns a new
	 * chore to a set, per the "extras is the landing zone" requirement.
	 * @param {object} payload { name }
	 */
	async handleAddChore (payload) {
		const name = payload && typeof payload.name === "string" ? payload.name.trim() : "";
		if (!name) {
			return;
		}

		const data = await this.readData();
		data.chores.push({ id: crypto.randomUUID(), name, group: "extras" });
		await this.writeData(data);
		this.sendSocketNotification("CHORES_DATA", data);
	},

	/**
	 * Moves an existing chore to a different set (or back to Extras).
	 * @param {object} payload { id, group }
	 */
	async handleAssignChore (payload) {
		const { id, group } = payload || {};
		if (!id || !GROUPS.includes(group)) {
			Log.warn(`[MMM-Chores] Ignoring ASSIGN_CHORE with invalid payload: ${JSON.stringify(payload)}`);
			return;
		}

		const data = await this.readData();
		const chore = data.chores.find((c) => c.id === id);
		if (!chore) {
			Log.warn(`[MMM-Chores] Ignoring ASSIGN_CHORE for unknown chore id: ${id}`);
			return;
		}

		chore.group = group;
		await this.writeData(data);
		this.sendSocketNotification("CHORES_DATA", data);
	},

	/**
	 * Permanently removes a chore from the library.
	 * @param {object} payload { id }
	 */
	async handleDeleteChore (payload) {
		const { id } = payload || {};
		if (!id) {
			Log.warn(`[MMM-Chores] Ignoring DELETE_CHORE with invalid payload: ${JSON.stringify(payload)}`);
			return;
		}

		const data = await this.readData();
		const beforeCount = data.chores.length;
		data.chores = data.chores.filter((c) => c.id !== id);
		if (data.chores.length === beforeCount) {
			Log.warn(`[MMM-Chores] Ignoring DELETE_CHORE for unknown chore id: ${id}`);
			return;
		}

		await this.writeData(data);
		this.sendSocketNotification("CHORES_DATA", data);
	},

	/**
	 * Rotates the three chore sets one step: each child's current set moves to
	 * the next child (in the persisted rotation's key order), wrapping around.
	 * Extras is untouched since it isn't part of the rotation map.
	 */
	async handleRotateWeek () {
		const data = await this.readData();
		const children = Object.keys(data.rotation);
		const newRotation = {};

		children.forEach((child, i) => {
			const nextChild = children[(i + 1) % children.length];
			newRotation[nextChild] = data.rotation[child];
		});

		data.rotation = newRotation;
		await this.writeData(data);
		this.sendSocketNotification("CHORES_DATA", data);
	}
});
