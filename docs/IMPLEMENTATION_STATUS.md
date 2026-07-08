# Implementation Status

This document tracks the current state of Praxis features. Everything marked "Implemented" exists in the current `v1.0.0` release.

## ✅ Implemented Features

### Core Architecture
- **Tauri + React Integration**: IPC message passing between React UI and Rust backend.
- **SQLite Database Integration**: `db.rs` implementing schema for `conversations`, `messages`, `actions`, `preferences`, `trusted_sessions`.
- **System Tray Icon**: Custom native Windows system tray icon and menu.
- **Custom Titlebar**: Frameless window with custom minimize/maximize/close controls in React communicating with Rust.

### Security & Authentication
- **TrustTier Permission Engine**: Base model implemented in Rust to gate IPC commands (e.g., `execute_command`, `write_file`).
- **OS Keychain Integration**: Python/Rust bridge utilizing `keyring` (DPAPI on Windows) to store API keys (`llm_openrouter`, `search_serper`).
- **Workspace Isolation**: Canonical path resolution preventing traversal outside the currently loaded project directory.

### LLM Integration
- **LLM Router**: Routing layer in Rust supporting OpenRouter API endpoints.
- **Tool Registry**: Rust structs mapping to LLM tool calls (File Edit, View File, Run Command, Semantic Search).

## 🚧 In Progress

- **Anthropic Native Integration**: Bypassing OpenRouter to connect directly to Anthropic's Claude API.
- **Audit Log UI**: While the backend SQLite audit log is fully implemented and recording events, the dedicated frontend UI to browse these logs is still being finalized.
- **Plugin System**: Basic architecture scoped out, but dynamic `.dll`/`.so` loading is not yet exposed to users.

## 📅 Planned

- **Ollama Local Support**: Running models 100% locally with zero internet connection.
- **Docker Sandboxing**: Executing AI terminal commands in an ephemeral Docker container instead of the host machine.
- **MCP (Model Context Protocol)**: Seamless integration with third-party MCP servers.
- **Cloud Sync**: Optional end-to-end encrypted syncing of preferences and chat history across multiple machines.
