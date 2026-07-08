// ─────────────────────────────────────────────────────────────
// TEST 5: End-to-End Smoke Test
//
// Chains: create conversation → add message → log action (read_file, auto-
// approve) → log action (write_file, requires confirmation) → approve →
// write file → verify file exists on disk in a temp workspace.
//
// This tests the SAME Rust functions that the Tauri commands delegate to,
// without needing a Tauri runtime.
// ─────────────────────────────────────────────────────────────

#[cfg(test)]
mod e2e_tests {
    use crate::db;
    use crate::permission::{self, PermissionVerdict, TrustTier};
    use rusqlite::Connection;
    use std::path::PathBuf;

    fn test_db() -> Connection {
        let conn = Connection::open_in_memory().unwrap();
        conn.execute_batch("PRAGMA foreign_keys = ON;").unwrap();
        db::run_migrations(&conn).unwrap();
        conn
    }

    #[test]
    fn test_e2e_read_then_write_with_approval() {
        let conn = test_db();

        // ── Step 1: Create a temp workspace ──
        let workspace = std::env::temp_dir().join("praxis_e2e_smoke");
        std::fs::create_dir_all(&workspace).unwrap();

        // Create a file to read
        let read_target = workspace.join("input.txt");
        std::fs::write(&read_target, "Hello from input").unwrap();

        // ── Step 2: Create a conversation ──
        let conv_id = db::create_conversation(&conn, "E2E Smoke Test").unwrap();
        assert!(!conv_id.is_empty());

        // ── Step 3: Add a user message ──
        let msg_id = db::add_message(
            &conn,
            &conv_id,
            "user",
            "Read input.txt and write output.txt",
        )
        .unwrap();
        assert!(!msg_id.is_empty());

        // ── Step 4: Simulate Executor — read_file (should auto-approve) ──
        let read_verdict = permission::check_permission(
            "read_file",
            &TrustTier::Guarded,
            &workspace,
            Some(&read_target),
        );
        assert!(
            matches!(read_verdict, PermissionVerdict::AutoApproved),
            "read_file should be AutoApproved, got: {:?}",
            read_verdict
        );

        // Actually read the file (simulating tool_read_file)
        let file_content = std::fs::read_to_string(&read_target).unwrap();
        assert_eq!(file_content, "Hello from input");

        // Log the completed read action
        let read_action_id = db::log_action(
            &conn,
            &conv_id,
            "read_file",
            r#"{"path":"input.txt"}"#,
            "guarded",
            "completed",
            "Read the input file",
        )
        .unwrap();
        assert!(!read_action_id.is_empty());

        // ── Step 5: Simulate Executor — write_file (should require confirmation) ──
        let write_target = workspace.join("output.txt");
        let write_verdict = permission::check_permission(
            "write_file",
            &TrustTier::Guarded,
            &workspace,
            Some(&write_target),
        );
        assert!(
            matches!(write_verdict, PermissionVerdict::RequiresConfirmation),
            "write_file in Guarded should require confirmation, got: {:?}",
            write_verdict
        );

        // Log a pending action (Executor does this before showing confirmation card)
        let write_action_id = db::log_action(
            &conn,
            &conv_id,
            "write_file",
            r#"{"path":"output.txt","content":"Processed output"}"#,
            "guarded",
            "pending",
            "Write the output file",
        )
        .unwrap();

        // ── Step 6: Simulate user clicking "Approve" ──
        db::update_action_status(&conn, &write_action_id, "approved").unwrap();

        // Verify the action is now approved (same check that tool_write_file does)
        let actions = db::get_actions(&conn, &conv_id).unwrap();
        let write_action = actions.iter().find(|a| a.id == write_action_id).unwrap();
        assert_eq!(write_action.status, "approved");

        // ── Step 7: Actually write the file ──
        std::fs::write(&write_target, "Processed output").unwrap();

        // ── Step 8: Verify the file exists on disk ──
        assert!(write_target.exists(), "output.txt should exist on disk");
        let written_content = std::fs::read_to_string(&write_target).unwrap();
        assert_eq!(written_content, "Processed output");

        // ── Step 9: Verify path traversal STILL blocked even after approval ──
        let escape_path = workspace.join("../../evil.txt");
        let escape_verdict = permission::check_permission(
            "write_file",
            &TrustTier::Guarded,
            &workspace,
            Some(&escape_path),
        );
        assert!(
            matches!(escape_verdict, PermissionVerdict::Denied(_)),
            "Path traversal must be Denied even with a valid conversation, got: {:?}",
            escape_verdict
        );

        // ── Step 10: Save assistant response ──
        let reply_id = db::add_message(
            &conn,
            &conv_id,
            "assistant",
            "I read input.txt and wrote the processed result to output.txt.",
        )
        .unwrap();
        assert!(!reply_id.is_empty());

        // Final verification: conversation has 2 messages
        let all_msgs = db::get_messages(&conn, &conv_id).unwrap();
        assert_eq!(all_msgs.len(), 2);
        assert_eq!(all_msgs[0].role, "user");
        assert_eq!(all_msgs[1].role, "assistant");

        // Final verification: 2 actions logged
        let all_actions = db::get_actions(&conn, &conv_id).unwrap();
        assert_eq!(all_actions.len(), 2);

        // ── Cleanup ──
        let _ = std::fs::remove_dir_all(&workspace);

        println!("E2E smoke test: all 10 steps passed.");
    }
}
