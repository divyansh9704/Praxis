# Database Architecture

Praxis uses **SQLite** for robust, high-performance, and entirely local data persistence. The database file (`praxis.db`) is stored in the application's native `AppData` directory (e.g., `%APPDATA%\com.praxis.app` on Windows).

## Entity Relationship Diagram

```mermaid
erDiagram
    CONVERSATIONS ||--o{ MESSAGES : "contains"
    CONVERSATIONS {
        TEXT id PK
        TEXT title
        TEXT created_at
        TEXT updated_at
    }
    MESSAGES ||--o{ ACTIONS : "triggers"
    MESSAGES {
        TEXT id PK
        TEXT conversation_id FK
        TEXT role
        TEXT content
        TEXT created_at
    }
    ACTIONS {
        INTEGER id PK
        TEXT message_id FK
        TEXT action_type
        TEXT payload
        TEXT status
        TEXT timestamp
    }
    PREFERENCES {
        TEXT key PK
        TEXT value
    }
    TRUSTED_SESSIONS {
        TEXT id PK
        TEXT session_token
        TEXT expires_at
    }
```

## Audit Logging (`actions` table)
One of the most critical tables in `praxis.db` is the `actions` table.
Because the LLM operates semi-autonomously, every tool call it makes is logged here.
- **`action_type`**: e.g., `execute_command`, `write_file`
- **`payload`**: The raw JSON payload (e.g., the exact bash command string)
- **`status`**: `pending`, `approved`, `rejected`, `failed`, `success`

This ensures that even if you walk away from your computer, you have a permanent, queryable ledger of exactly what commands the AI ran, when it ran them, and what the outcome was.
