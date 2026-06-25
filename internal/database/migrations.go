package database

// DefaultMigrations returns the built-in schema migrations.
// Add new migrations to the end of this slice. Never modify existing ones.
var DefaultMigrations = []Migration{
	{
		Version: 1,
		Name:    "create_users_table",
		Up: `
			CREATE TABLE IF NOT EXISTS users (
				id         INTEGER PRIMARY KEY AUTOINCREMENT,
				email      TEXT    NOT NULL UNIQUE,
				name       TEXT    NOT NULL DEFAULT '',
				created_at TEXT    NOT NULL DEFAULT (datetime('now')),
				updated_at TEXT    NOT NULL DEFAULT (datetime('now'))
			);

			CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
		`,
	},
	{
		Version: 2,
		Name:    "create_sessions_table",
		Up: `
			CREATE TABLE IF NOT EXISTS sessions (
				id         TEXT    PRIMARY KEY,
				user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
				data       TEXT    NOT NULL DEFAULT '{}',
				expires_at TEXT    NOT NULL,
				created_at TEXT    NOT NULL DEFAULT (datetime('now'))
			);

			CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions(user_id);
			CREATE INDEX IF NOT EXISTS idx_sessions_expires ON sessions(expires_at);
		`,
	},
	{
		Version: 3,
		Name:    "create_settings_table",
		Up: `
			CREATE TABLE IF NOT EXISTS settings (
				key   TEXT PRIMARY KEY,
				value TEXT NOT NULL DEFAULT '',
				updated_at TEXT NOT NULL DEFAULT (datetime('now'))
			);
		`,
	},
	{
		Version: 4,
		Name:    "add_password_hash_to_users",
		Up: `
			ALTER TABLE users ADD COLUMN password_hash TEXT NOT NULL DEFAULT '';
		`,
	},
	{
		Version: 5,
		Name:    "create_projects_table",
		Up: `
			CREATE TABLE IF NOT EXISTS projects (
				id         INTEGER PRIMARY KEY AUTOINCREMENT,
				name       TEXT    NOT NULL,
				api_key    TEXT    NOT NULL UNIQUE,
				created_at TEXT    NOT NULL DEFAULT (datetime('now'))
			);
			CREATE INDEX IF NOT EXISTS idx_projects_api_key ON projects(api_key);
		`,
	},
	{
		Version: 6,
		Name:    "create_streams_table",
		Up: `
			CREATE TABLE IF NOT EXISTS streams (
				id         INTEGER PRIMARY KEY AUTOINCREMENT,
				project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
				name       TEXT    NOT NULL,
				stream_key TEXT    NOT NULL UNIQUE,
				created_at TEXT    NOT NULL DEFAULT (datetime('now'))
			);
			CREATE INDEX IF NOT EXISTS idx_streams_project_id ON streams(project_id);
			CREATE INDEX IF NOT EXISTS idx_streams_key ON streams(stream_key);
		`,
	},
	{
		Version: 7,
		Name:    "create_events_table",
		Up: `
			CREATE TABLE IF NOT EXISTS events (
				id          INTEGER PRIMARY KEY AUTOINCREMENT,
				project_id  INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
				stream_id   INTEGER REFERENCES streams(id) ON DELETE SET NULL,
				type        TEXT    NOT NULL,
				timestamp   TEXT    NOT NULL,
				level       TEXT    NOT NULL DEFAULT 'info',
				message     TEXT    NOT NULL DEFAULT '',
				payload     TEXT    NOT NULL DEFAULT '{}',
				error_group TEXT    NOT NULL DEFAULT ''
			);
			CREATE INDEX IF NOT EXISTS idx_events_project_timestamp ON events(project_id, timestamp DESC);
			CREATE INDEX IF NOT EXISTS idx_events_stream_timestamp ON events(stream_id, timestamp DESC);
			CREATE INDEX IF NOT EXISTS idx_events_type ON events(type);
			CREATE INDEX IF NOT EXISTS idx_events_level ON events(level);
			CREATE INDEX IF NOT EXISTS idx_events_error_group ON events(error_group);
		`,
	},
	{
		Version: 8,
		Name:    "create_observability_tables",
		Up: `
			CREATE INDEX IF NOT EXISTS idx_events_project_type_timestamp ON events(project_id, type, timestamp DESC);
			CREATE INDEX IF NOT EXISTS idx_events_stream_type_timestamp ON events(stream_id, type, timestamp DESC);

			CREATE TABLE IF NOT EXISTS dashboards (
				id         INTEGER PRIMARY KEY AUTOINCREMENT,
				project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
				name       TEXT    NOT NULL,
				layout     TEXT    NOT NULL DEFAULT '[]',
				created_at TEXT    NOT NULL DEFAULT (datetime('now'))
			);
			CREATE INDEX IF NOT EXISTS idx_dashboards_project_id ON dashboards(project_id);

			CREATE TABLE IF NOT EXISTS alert_rules (
				id               INTEGER PRIMARY KEY AUTOINCREMENT,
				project_id       INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
				name             TEXT    NOT NULL,
				metric_type      TEXT    NOT NULL,
				threshold        REAL    NOT NULL,
				comparison       TEXT    NOT NULL,
				time_window_mins INTEGER NOT NULL DEFAULT 5,
				channel          TEXT    NOT NULL DEFAULT 'email',
				target           TEXT    NOT NULL,
				active           INTEGER NOT NULL DEFAULT 1,
				created_at       TEXT    NOT NULL DEFAULT (datetime('now'))
			);
			CREATE INDEX IF NOT EXISTS idx_alert_rules_project_id ON alert_rules(project_id);

			CREATE TABLE IF NOT EXISTS alerts_history (
				id               INTEGER PRIMARY KEY AUTOINCREMENT,
				rule_id          INTEGER NOT NULL REFERENCES alert_rules(id) ON DELETE CASCADE,
				project_id       INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
				triggered_value  REAL    NOT NULL,
				triggered_at     TEXT    NOT NULL DEFAULT (datetime('now'))
			);
			CREATE INDEX IF NOT EXISTS idx_alerts_history_project_id ON alerts_history(project_id);
			CREATE INDEX IF NOT EXISTS idx_alerts_history_rule_id ON alerts_history(rule_id);

			CREATE TABLE IF NOT EXISTS audit_logs (
				id         INTEGER PRIMARY KEY AUTOINCREMENT,
				user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
				action     TEXT    NOT NULL,
				details    TEXT    NOT NULL DEFAULT '',
				created_at TEXT    NOT NULL DEFAULT (datetime('now'))
			);
			CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id ON audit_logs(user_id);

			CREATE TABLE IF NOT EXISTS incidents (
				id          INTEGER PRIMARY KEY AUTOINCREMENT,
				project_id  INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
				title       TEXT    NOT NULL,
				status      TEXT    NOT NULL DEFAULT 'open',
				severity    TEXT    NOT NULL DEFAULT 'info',
				description TEXT    NOT NULL DEFAULT '',
				created_at  TEXT    NOT NULL DEFAULT (datetime('now')),
				resolved_at TEXT
			);
			CREATE INDEX IF NOT EXISTS idx_incidents_project_id ON incidents(project_id);

			CREATE TABLE IF NOT EXISTS incident_updates (
				id          INTEGER PRIMARY KEY AUTOINCREMENT,
				incident_id INTEGER NOT NULL REFERENCES incidents(id) ON DELETE CASCADE,
				message     TEXT    NOT NULL,
				status      TEXT    NOT NULL,
				created_at  TEXT    NOT NULL DEFAULT (datetime('now'))
			);
			CREATE INDEX IF NOT EXISTS idx_incident_updates_incident_id ON incident_updates(incident_id);
		`,
	},
}
