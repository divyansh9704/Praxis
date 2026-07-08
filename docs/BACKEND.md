# Backend Architecture

The backend of Praxis is written entirely in **Rust**. It utilizes the Tauri framework not just for window management, but as a high-performance, memory-safe execution kernel for the AI environment.

## Core Modules

### 1. `main.rs`
The entry point. Initializes the Tauri application, registers the IPC command handlers (using the `tauri::generate_handler!` macro), and starts the SQLite connection pool.

### 2. `db.rs`
Handles all SQLite interactions using the `rusqlite` crate.
It wraps database calls in `Result` types mapped to custom `PraxisError` enums for graceful error handling in the React frontend.

### 3. `keychain.rs`
Interfaces with the `keyring` crate. This file abstracts away the OS-specific complexities of DPAPI (Windows), Keychain (macOS), and Secret Service (Linux) to provide simple `get_api_key` and `set_api_key` functions.

### 4. LLM Handlers (`commands.rs`)
Contains the asynchronous Tokio tasks that format the conversation history, assemble the system prompts and available tool JSON schemas, and make the HTTP POST requests to the LLM providers (e.g., OpenRouter) using the `reqwest` crate.

### 5. File System Sandbox (`fs.rs`)
Implements the canonicalization and path-validation logic necessary to enforce Workspace Isolation. All file reads and writes requested by the LLM pass through this module before hitting `std::fs`.
