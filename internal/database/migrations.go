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
}
