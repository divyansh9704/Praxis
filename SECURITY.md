# Security Policy

Praxis is designed from the ground up to securely execute AI-generated code and commands on your local machine. Because Praxis grants autonomous agents the ability to read files, write code, and execute terminal commands, security is our primary architectural pillar.

## Threat Model

### Security Goals
- **Prevent unauthorized filesystem access**: AI agents must not be able to read or modify files outside of the explicitly designated active workspace.
- **Prevent unapproved command execution**: All shell commands and scripts must require explicit user approval (or fall within a predefined TrustTier threshold).
- **Secure credential storage**: API keys must be protected at rest using the operating system's native secure enclave, not stored in plain text.
- **Auditability**: Every action taken by the AI must be permanently logged and queryable.

### Non-Goals
- Protection against physical access to the host machine.
- Protection against malicious users deliberately bypassing their own machine's security controls to grant Praxis root access.

### Attack Surface
The primary attack surface is the Tauri IPC (Inter-Process Communication) bridge between the React frontend (where the LLM output is parsed) and the Rust backend (where system operations are executed).

## Security Mechanisms

### 1. Workspace Isolation
Praxis operates strictly within a "Workspace". 
- Every file operation requested by the AI is passed through a canonicalization engine in Rust (`std::fs::canonicalize`).
- The engine verifies that the resolved absolute path begins with the absolute path of the current active workspace.
- Any attempt to use `../` for directory traversal to escape the workspace results in an immediate IPC rejection and an alert in the Audit Log.

### 2. Credential Storage
We do not store API keys in `localStorage`, `praxis.db`, or environment variables.
- Praxis uses the Rust `keyring` crate.
- On Windows, this hooks directly into the **Windows Credential Manager (DPAPI)**.
- On macOS, it uses the **Keychain**.
- On Linux, it uses **Secret Service API / libsecret**.

### 3. Permission Confirmation (TrustTier)
Before a command is executed, it passes through the `TrustTier` model.
- Destructive commands (`rm`, `del`, network requests) require explicit User Confirmation.
- Safe commands (e.g., `git status`) may be auto-approved based on user preferences.

### 4. Audit Logging
Every IPC command executed by the Rust backend is recorded in `praxis.db` (SQLite). This includes the command string, timestamp, execution result, and the exact LLM prompt that generated the request.

## Known Limitations
- **Sandboxing**: Praxis does not currently run commands in an isolated Docker container or VM by default. Commands are executed directly on the host OS under the user's current privileges. We strongly recommend *not* running Praxis as Administrator/root.

## Reporting a Vulnerability

If you discover a security vulnerability in Praxis, please practice responsible disclosure.

**Do NOT open a public GitHub issue.**

Instead, please email **divyansh9704@github.com** (placeholder). 
We will acknowledge receipt within 48 hours and work with you to patch the issue before public disclosure.
