# Praxis

**Praxis** is an advanced, secure agentic UI powered by Tauri v2, React, and a robust Rust backend. Designed with a "Quiet Luxury" dark dashboard aesthetic, Praxis provides a sandboxed environment for LLM-driven actions, prioritizing user privacy, local execution safety, and robust tool confinement.

## ✨ Features

- **Tauri v2 + Rust Backend:** Native performance, robust file system access, and minimal memory footprint.
- **Secure Permission Boundary:** All LLM actions run through a strict Rust-level permission engine (`TrustTier` architecture). File operations are canonically confined to a user-defined workspace to prevent sandbox escapes.
- **"Quiet Luxury" UI:** A premium dashboard interface with deep charcoal backgrounds, muted accents, and subtle interactions designed for power users.
- **Dynamic Model Fallback Router:** Automatically gracefully degrades across multiple LLM providers (e.g., OpenRouter, Anthropic) based on rate-limiting and availability.
- **Native OS Keychain Integration:** API keys (OpenRouter, Serper) are securely stored in the native Windows Credential Manager / OS Keychain, never in plain text.
- **Comprehensive Audit Log:** Every action, reasoning step, and parameter taken by the agent is logged to a local SQLite database for full transparency and traceability.

## 🚀 Getting Started

### Prerequisites
- [Node.js](https://nodejs.org/) (v18+)
- [Rust](https://www.rust-lang.org/tools/install)
- [Tauri CLI](https://tauri.app/v1/guides/getting-started/setup/)

### Running Locally
1. Clone the repository
2. Install dependencies: `npm install`
3. Run the development server: `npm run tauri dev`

### Building from Source
To compile the standalone executable and Windows installers (MSI/NSIS):
```bash
npm run tauri build
```
The resulting binaries will be available in `src-tauri/target/release/`.

## 🛡️ Architecture
Praxis delegates heavy lifting to a local Rust backend. The `executor.ts` frontend dispatches intents to the backend, where `db.rs` logs the actions and `permission/mod.rs` evaluates them against the active `TrustTier`. 

- **Guarded Mode:** Requires explicit user approval for destructive/write actions.
- **Trusted Session:** Auto-approves actions within the canonical workspace boundary.

## 📞 Contact & Author
**Divyansh Sharma**
- **LinkedIn:** [divyansh9704](https://www.linkedin.com/in/divyansh9704/)
- **Phone:** 8081655084
