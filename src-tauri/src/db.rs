use std::path::Path;

use chrono::Utc;
use rusqlite::{params, Connection};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

use crate::error::PraxisError;

// ---------------------------------------------------------------------------
// Database initialisation
// ---------------------------------------------------------------------------

/// Opens (or creates) the SQLite database at `{app_data_dir}/praxis.db`.
pub fn init_db(app_data_dir: &Path) -> Result<Connection, PraxisError> {
    std::fs::create_dir_all(app_data_dir)?;
    let db_path = app_data_dir.join("praxis.db");
    let conn = Connection::open(&db_path)?;
    // Enable WAL mode for better concurrent-read performance.
    conn.execute_batch("PRAGMA journal_mode=WAL;")?;
    run_migrations(&conn)?;
    log::info!("Database initialised at {}", db_path.display());
    Ok(conn)
}

/// Creates every table that the application relies on.
pub fn run_migrations(conn: &Connection) -> Result<(), PraxisError> {
    conn.execute_batch(
        "
        CREATE TABLE IF NOT EXISTS conversations (
            id         TEXT PRIMARY KEY,
            title      TEXT NOT NULL,
            created_at TEXT DEFAULT (datetime('now'))
        );

        CREATE TABLE IF NOT EXISTS messages (
            id              TEXT PRIMARY KEY,
            conversation_id TEXT NOT NULL,
            role            TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'system', 'tool')),
            content         TEXT NOT NULL,
            created_at      TEXT,
            FOREIGN KEY (conversation_id) REFERENCES conversations(id)
        );

        CREATE TABLE IF NOT EXISTS actions (
            id               TEXT PRIMARY KEY,
            conversation_id  TEXT NOT NULL,
            tool_name        TEXT NOT NULL,
            input_params_json TEXT NOT NULL,
            trust_tier       TEXT CHECK (trust_tier IN ('guarded', 'trusted', 'always_deny')),
            status           TEXT CHECK (status IN ('pending', 'approved', 'rejected', 'completed', 'failed')),
            result_json      TEXT,
            reasoning        TEXT,
            created_at       TEXT,
            resolved_at      TEXT,
            FOREIGN KEY (conversation_id) REFERENCES conversations(id)
        );

        CREATE TABLE IF NOT EXISTS preferences (
            id             TEXT PRIMARY KEY,
            key            TEXT NOT NULL,
            value          TEXT NOT NULL,
            embedding_blob BLOB,
            memory_type    TEXT CHECK (memory_type IN ('semantic', 'procedural')),
            created_at     TEXT
        );

        CREATE TABLE IF NOT EXISTS trusted_sessions (
            id                TEXT PRIMARY KEY,
            scope_description TEXT NOT NULL,
            granted_at        TEXT,
            expires_at        TEXT NOT NULL,
            revoked_at        TEXT
        );

        CREATE TABLE IF NOT EXISTS mcp_servers (
            id                    TEXT PRIMARY KEY,
            name                  TEXT NOT NULL,
            endpoint              TEXT NOT NULL,
            auth_config_encrypted TEXT,
            enabled               INTEGER DEFAULT 1
        );
        ",
    )?;
    Ok(())
}

// ---------------------------------------------------------------------------
// Serializable structs
// ---------------------------------------------------------------------------

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Conversation {
    pub id: String,
    pub title: String,
    pub created_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Message {
    pub id: String,
    pub conversation_id: String,
    pub role: String,
    pub content: String,
    pub created_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Action {
    pub id: String,
    pub conversation_id: String,
    pub tool_name: String,
    pub input_params_json: String,
    pub trust_tier: String,
    pub status: String,
    pub result_json: Option<String>,
    pub reasoning: Option<String>,
    pub created_at: String,
    pub resolved_at: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Preference {
    pub id: String,
    pub key: String,
    pub value: String,
    pub memory_type: Option<String>,
    pub created_at: String,
}

// ---------------------------------------------------------------------------
// CRUD helpers
// ---------------------------------------------------------------------------

/// Create a new conversation and return its ID.
pub fn create_conversation(conn: &Connection, title: &str) -> Result<String, PraxisError> {
    let id = Uuid::new_v4().to_string();
    let now = Utc::now().to_rfc3339();
    conn.execute(
        "INSERT INTO conversations (id, title, created_at) VALUES (?1, ?2, ?3)",
        params![id, title, now],
    )?;
    Ok(id)
}

/// Add a message to a conversation and return its ID.
pub fn add_message(
    conn: &Connection,
    conversation_id: &str,
    role: &str,
    content: &str,
) -> Result<String, PraxisError> {
    let id = Uuid::new_v4().to_string();
    let now = Utc::now().to_rfc3339();
    conn.execute(
        "INSERT INTO messages (id, conversation_id, role, content, created_at) VALUES (?1, ?2, ?3, ?4, ?5)",
        params![id, conversation_id, role, content, now],
    )?;
    Ok(id)
}

/// Retrieve all messages for a conversation, ordered by creation time.
pub fn get_messages(conn: &Connection, conversation_id: &str) -> Result<Vec<Message>, PraxisError> {
    let mut stmt = conn.prepare(
        "SELECT id, conversation_id, role, content, created_at FROM messages WHERE conversation_id = ?1 ORDER BY created_at ASC",
    )?;
    let rows = stmt.query_map(params![conversation_id], |row| {
        Ok(Message {
            id: row.get(0)?,
            conversation_id: row.get(1)?,
            role: row.get(2)?,
            content: row.get(3)?,
            created_at: row.get(4)?,
        })
    })?;
    let mut messages = Vec::new();
    for row in rows {
        messages.push(row?);
    }
    Ok(messages)
}

/// Retrieve all conversations, most recent first.
pub fn get_conversations(conn: &Connection) -> Result<Vec<Conversation>, PraxisError> {
    let mut stmt =
        conn.prepare("SELECT id, title, created_at FROM conversations ORDER BY created_at DESC")?;
    let rows = stmt.query_map([], |row| {
        Ok(Conversation {
            id: row.get(0)?,
            title: row.get(1)?,
            created_at: row.get(2)?,
        })
    })?;
    let mut convos = Vec::new();
    for row in rows {
        convos.push(row?);
    }
    Ok(convos)
}

/// Log an action (tool invocation) and return its ID.
pub fn log_action(
    conn: &Connection,
    conversation_id: &str,
    tool_name: &str,
    input_params_json: &str,
    trust_tier: &str,
    status: &str,
    reasoning: &str,
) -> Result<String, PraxisError> {
    let id = Uuid::new_v4().to_string();
    let now = Utc::now().to_rfc3339();
    conn.execute(
        "INSERT INTO actions (id, conversation_id, tool_name, input_params_json, trust_tier, status, reasoning, created_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)",
        params![id, conversation_id, tool_name, input_params_json, trust_tier, status, reasoning, now],
    )?;
    Ok(id)
}

/// Update the status of an existing action.
pub fn update_action_status(
    conn: &Connection,
    action_id: &str,
    new_status: &str,
) -> Result<(), PraxisError> {
    let now = Utc::now().to_rfc3339();
    conn.execute(
        "UPDATE actions SET status = ?1, resolved_at = ?2 WHERE id = ?3",
        params![new_status, now, action_id],
    )?;
    Ok(())
}

/// Retrieve all actions for a conversation, most recent first.
pub fn get_actions(conn: &Connection, conversation_id: &str) -> Result<Vec<Action>, PraxisError> {
    let mut stmt = conn.prepare(
        "SELECT id, conversation_id, tool_name, input_params_json, trust_tier, status, result_json, reasoning, created_at, resolved_at FROM actions WHERE conversation_id = ?1 ORDER BY created_at DESC",
    )?;
    let rows = stmt.query_map(params![conversation_id], |row| {
        Ok(Action {
            id: row.get(0)?,
            conversation_id: row.get(1)?,
            tool_name: row.get(2)?,
            input_params_json: row.get(3)?,
            trust_tier: row.get(4)?,
            status: row.get(5)?,
            result_json: row.get(6)?,
            reasoning: row.get(7)?,
            created_at: row.get(8)?,
            resolved_at: row.get(9)?,
        })
    })?;
    let mut actions = Vec::new();
    for row in rows {
        actions.push(row?);
    }
    Ok(actions)
}

/// Retrieve preferences filtered by memory type.
pub fn get_preferences(
    conn: &Connection,
    memory_type: &str,
) -> Result<Vec<Preference>, PraxisError> {
    let mut stmt = conn.prepare(
        "SELECT id, key, value, memory_type, created_at FROM preferences WHERE memory_type = ?1 ORDER BY created_at DESC",
    )?;
    let rows = stmt.query_map(params![memory_type], |row| {
        Ok(Preference {
            id: row.get(0)?,
            key: row.get(1)?,
            value: row.get(2)?,
            memory_type: row.get(3)?,
            created_at: row.get(4)?,
        })
    })?;
    let mut prefs = Vec::new();
    for row in rows {
        prefs.push(row?);
    }
    Ok(prefs)
}

/// Upsert a preference (insert or replace).
pub fn save_preference(
    conn: &Connection,
    key: &str,
    value: &str,
    memory_type: &str,
) -> Result<String, PraxisError> {
    let id = Uuid::new_v4().to_string();
    let now = Utc::now().to_rfc3339();
    conn.execute(
        "INSERT INTO preferences (id, key, value, memory_type, created_at) VALUES (?1, ?2, ?3, ?4, ?5)",
        params![id, key, value, memory_type, now],
    )?;
    Ok(id)
}

#[cfg(test)]
mod tests {
    use super::*;

    /// Helper: create an in-memory DB with FK enforcement and migrations.
    fn test_db() -> Connection {
        let conn = Connection::open_in_memory().unwrap();
        conn.execute_batch("PRAGMA foreign_keys = ON;").unwrap();
        run_migrations(&conn).unwrap();
        conn
    }

    // ── TEST 2a: Foreign Key constraint — message without conversation ──
    #[test]
    fn test_foreign_key_constraint_missing_conversation() {
        let conn = test_db();

        let result = add_message(&conn, "non_existent_conv_id", "user", "Hello");
        assert!(result.is_err());

        let err = result.unwrap_err();
        match err {
            PraxisError::Database(rusqlite::Error::SqliteFailure(err_ext, _)) => {
                assert_eq!(err_ext.code, rusqlite::ErrorCode::ConstraintViolation);
            }
            _ => panic!(
                "Expected a foreign key constraint violation error, got {:?}",
                err
            ),
        }
    }

    // ── TEST 2b: Foreign Key constraint — action without conversation ──
    #[test]
    fn test_foreign_key_constraint_action_without_conversation() {
        let conn = test_db();

        let result = log_action(
            &conn,
            "ghost_conv_id",
            "search_web",
            r#"{"q":"test"}"#,
            "guarded",
            "pending",
            "User asked to search",
        );
        assert!(result.is_err());

        let err = result.unwrap_err();
        match err {
            PraxisError::Database(rusqlite::Error::SqliteFailure(err_ext, _)) => {
                assert_eq!(err_ext.code, rusqlite::ErrorCode::ConstraintViolation);
            }
            _ => panic!("Expected FK violation for action, got {:?}", err),
        }
    }

    // ── TEST 2c: Correct flow — create conversation FIRST, then message ──
    #[test]
    fn test_conversation_then_message_succeeds() {
        let conn = test_db();

        let conv_id = create_conversation(&conn, "Test Conversation").unwrap();
        assert!(
            !conv_id.is_empty(),
            "Conversation ID should be a non-empty UUID"
        );

        // Now adding a message with the real conv_id should succeed.
        let msg_id = add_message(&conn, &conv_id, "user", "Hello Praxis").unwrap();
        assert!(!msg_id.is_empty(), "Message ID should be a non-empty UUID");

        // Verify it was stored correctly.
        let messages = get_messages(&conn, &conv_id).unwrap();
        assert_eq!(messages.len(), 1);
        assert_eq!(messages[0].role, "user");
        assert_eq!(messages[0].content, "Hello Praxis");
        assert_eq!(messages[0].conversation_id, conv_id);
    }

    // ── TEST 2d: Correct flow — conversation then action succeeds ──
    #[test]
    fn test_conversation_then_action_succeeds() {
        let conn = test_db();

        let conv_id = create_conversation(&conn, "Search Session").unwrap();

        let action_id = log_action(
            &conn,
            &conv_id,
            "search_web",
            r#"{"q":"lenovo laptops under 80000"}"#,
            "guarded",
            "pending",
            "User asked for a search",
        )
        .unwrap();
        assert!(!action_id.is_empty());

        let actions = get_actions(&conn, &conv_id).unwrap();
        assert_eq!(actions.len(), 1);
        assert_eq!(actions[0].tool_name, "search_web");
        assert_eq!(actions[0].status, "pending");
    }

    // ── TEST 4: Audit Log Data Integrity ────────────────────────
    #[test]
    fn test_audit_log_data_integrity() {
        let conn = test_db();

        let conv_id = create_conversation(&conn, "Audit Test").unwrap();

        // Insert 4 actions with different statuses.
        let id1 = log_action(
            &conn,
            &conv_id,
            "read_file",
            r#"{"path":"a.txt"}"#,
            "guarded",
            "completed",
            "Read a file",
        )
        .unwrap();
        let id2 = log_action(
            &conn,
            &conv_id,
            "write_file",
            r#"{"path":"b.txt","content":"hi"}"#,
            "guarded",
            "pending",
            "Write a file",
        )
        .unwrap();
        let id3 = log_action(
            &conn,
            &conv_id,
            "delete_file",
            r#"{"path":"c.txt"}"#,
            "trusted",
            "failed",
            "Delete a file",
        )
        .unwrap();

        // Approve action 2
        update_action_status(&conn, &id2, "approved").unwrap();

        // Now get_actions returns them ordered by created_at DESC.
        let actions = get_actions(&conn, &conv_id).unwrap();
        assert_eq!(actions.len(), 3, "Expected exactly 3 actions");

        // Verify correct data for each action.
        // get_actions orders by created_at DESC, so id3 is first.
        let a3 = actions.iter().find(|a| a.id == id3).unwrap();
        assert_eq!(a3.tool_name, "delete_file");
        assert_eq!(a3.status, "failed");
        assert_eq!(a3.trust_tier, "trusted");
        assert_eq!(a3.reasoning.as_deref(), Some("Delete a file"));

        let a2 = actions.iter().find(|a| a.id == id2).unwrap();
        assert_eq!(a2.tool_name, "write_file");
        assert_eq!(a2.status, "approved"); // We updated it
        assert_eq!(a2.trust_tier, "guarded");
        assert!(
            a2.resolved_at.is_some(),
            "resolved_at should be set after status update"
        );

        let a1 = actions.iter().find(|a| a.id == id1).unwrap();
        assert_eq!(a1.tool_name, "read_file");
        assert_eq!(a1.status, "completed");
        assert_eq!(a1.input_params_json, r#"{"path":"a.txt"}"#);

        // Verify timestamps are parseable and in order.
        let t1 = chrono::DateTime::parse_from_rfc3339(&a1.created_at).unwrap();
        let t2 = chrono::DateTime::parse_from_rfc3339(&a2.created_at).unwrap();
        let t3 = chrono::DateTime::parse_from_rfc3339(&a3.created_at).unwrap();
        assert!(
            t1 <= t2,
            "Action 1 created_at should be <= Action 2 created_at"
        );
        assert!(
            t2 <= t3,
            "Action 2 created_at should be <= Action 3 created_at"
        );
    }

    // ── TEST: Multiple conversations are isolated ──
    #[test]
    fn test_conversation_isolation() {
        let conn = test_db();

        let conv_a = create_conversation(&conn, "Conv A").unwrap();
        let conv_b = create_conversation(&conn, "Conv B").unwrap();

        add_message(&conn, &conv_a, "user", "Message for A").unwrap();
        add_message(&conn, &conv_b, "user", "Message for B").unwrap();
        add_message(&conn, &conv_a, "assistant", "Reply for A").unwrap();

        let msgs_a = get_messages(&conn, &conv_a).unwrap();
        let msgs_b = get_messages(&conn, &conv_b).unwrap();

        assert_eq!(msgs_a.len(), 2, "Conv A should have 2 messages");
        assert_eq!(msgs_b.len(), 1, "Conv B should have 1 message");
        assert_eq!(msgs_a[0].content, "Message for A");
        assert_eq!(msgs_a[1].content, "Reply for A");
        assert_eq!(msgs_b[0].content, "Message for B");
    }
}
