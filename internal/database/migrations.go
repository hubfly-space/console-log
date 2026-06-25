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
}
