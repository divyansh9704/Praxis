# Roadmap

> **Praxis development roadmap — from MVP to production-grade AI agent.**

This document tracks the phased development plan for Praxis. Each phase builds on the previous one, and no phase is started until the prior phase is stable.

---

## Phase 1 — Foundation (Current)

> **Goal:** A working desktop AI agent that can chat, plan, read/write files, run commands, and enforce permissions.

### Completed

- [x] Project scaffolding (Tauri 2 + React 19 + TypeScript + Vite 7)
- [x] Tauri configuration (window settings, bundle config, security CSP)
- [x] Rust backend skeleton with `invoke()` IPC bridge
- [x] Frontend entry point and root component
- [x] Development workflow (`npm run tauri dev` for hot-reload)
- [x] Build pipeline (`npm run tauri build` for production binary)
- [x] Project documentation (README, Architecture, Safety Rationale, Roadmap)

### Remaining

- [ ] **Chat UI** — Conversation interface with message history, input field, and streaming response display
- [ ] **Claude Integration** — LLM gateway in Rust that proxies requests to the Anthropic API with proper error handling and rate limiting
- [ ] **API Key Onboarding** — First-launch flow that prompts for a Claude API key and stores it in the OS keychain
- [ ] **OS Keychain Integration** — Rust module for reading/writing secrets to Windows Credential Manager, macOS Keychain, and Linux Secret Service
- [ ] **Permission Engine** — Core Rust module that checks proposed actions against trust rules before execution
- [ ] **Permission Modal** — Frontend component that displays action details and captures approve/deny decisions
- [ ] **Trust Tier System** — Guarded, Trusted Session, and Always-Deny modes with SQLite-backed rule storage
- [ ] **SQLite Integration** — Embedded database for conversation history, trust rules, action logs, and memory
- [ ] **File Operations** — Gated file read/write/list/search commands routed through the permission engine
- [ ] **Shell Executor** — Gated command execution with stdout/stderr capture, timeout handling, and working directory support
- [ ] **HTTP Client** — Gated HTTP request capability for web searches and API calls
- [ ] **Planner** — Frontend module that sends user requests to Claude and parses tool-use responses into executable plans
- [ ] **Executor** — Frontend module that iterates through plan steps, invokes Tauri commands, and handles results
- [ ] **Plan Viewer** — UI component that shows the current plan with step status (pending/running/completed/failed)
- [ ] **Settings Panel** — UI for managing trust rules, viewing action logs, and configuring preferences
- [ ] **Working Memory** — In-session conversation and plan state management
- [ ] **Episodic Memory** — Action log stored in SQLite, queryable by time/type/keyword
- [ ] **Semantic Memory** — User preferences and learned facts stored in SQLite
- [ ] **Procedural Memory** — Learned workflows and patterns stored in SQLite
- [ ] **Replanning & Retry** — 3-step escalation policy: retry with correction → replan → escalate to user
- [ ] **Error Handling** — Graceful error display for LLM failures, network errors, permission denials, and OS errors
- [ ] **Action Logging** — Every action (approved, denied, failed) logged with timestamps and context

### Exit Criteria

Phase 1 is complete when a user can:
1. Launch Praxis by double-clicking the executable
2. Enter a Claude API key on first launch
3. Type a natural language request ("Create a new folder called 'reports' and move all PDFs from Downloads into it")
4. See a plan with concrete steps
5. Approve or deny each step
6. Watch the steps execute with real results
7. Review the action log in Settings

---

## Phase 2 — Desktop Automation & Integrations

> **Goal:** Expand Praxis from file/shell operations to full desktop automation, multiple LLM providers, and an extensible plugin system.

- [ ] **Host + Sandbox Architecture** — Separate "host" process (privileged, gated) and "sandbox" process (unprivileged, for analysis and planning) to reduce attack surface
- [ ] **Model Context Protocol (MCP)** — Implement the MCP standard for tool definitions, allowing Praxis to consume and expose tools via a standardized protocol
- [ ] **Plugin System** — User-installable plugins that register new tools, trust rules, and UI components. Plugins are sandboxed and go through the permission engine like any other action
- [ ] **Playwright Integration** — Browser automation for web-based tasks: filling forms, scraping pages, navigating workflows. Runs in a visible browser window so the user can observe actions
- [ ] **Gemini Support** — Add Google's Gemini as an alternative LLM provider. User selects their preferred model in Settings. Tool-use interface abstracted to support multiple providers
- [ ] **Auto-Update** — In-app update mechanism that checks for new releases, downloads them, and applies updates with user confirmation. Signed update payloads to prevent tampering
- [ ] **System Tray Integration** — Minimize to system tray, global hotkey to activate, notification badges for completed background tasks
- [ ] **Background Task Queue** — Long-running tasks continue executing while the user works in other applications. Status visible in the system tray icon
- [ ] **Clipboard Integration** — Read from and write to the system clipboard (gated by permission engine)
- [ ] **Screenshot Capture** — Capture screenshots for visual context (gated, with clear user notification)
- [ ] **Multi-Conversation** — Support multiple concurrent conversations with separate memory contexts
- [ ] **Export & Import** — Export conversation history, trust rules, and memory as portable JSON files

### Exit Criteria

Phase 2 is complete when:
1. Praxis can automate browser-based workflows via Playwright
2. At least two LLM providers are supported (Claude + Gemini)
3. The plugin system allows third-party tool registration
4. Auto-update works reliably on Windows

---

## Phase 3 — Production Hardening

> **Goal:** Ship a production-grade, signed, tested, and optimized binary that can be distributed through official channels.

- [ ] **Pure Rust Rewrite Evaluation** — Evaluate replacing the React frontend with a Rust-native UI (egui, Dioxus, or Slint) to eliminate the webview dependency and further reduce attack surface. Decision: proceed only if UX quality can be maintained
- [ ] **Code Signing** — Sign Windows executables with an EV code signing certificate to eliminate SmartScreen warnings. Sign macOS binaries for notarization. Automated signing in CI/CD pipeline
- [ ] **Database Encryption** — Encrypt the SQLite database at rest using SQLCipher or a similar transparent encryption layer. Key derived from OS keychain
- [ ] **Comprehensive Test Suite**
  - [ ] Unit tests for the Rust permission engine (every action type, every trust tier)
  - [ ] Integration tests for the Tauri IPC bridge
  - [ ] End-to-end tests using Playwright (or WebDriver) against the actual application
  - [ ] Fuzzing for the permission engine with adversarial inputs
  - [ ] Prompt injection test suite — known injection payloads processed through the full pipeline to verify the permission gate catches them
- [ ] **Performance Optimization**
  - [ ] Startup time profiling and optimization (target: < 2 seconds to interactive)
  - [ ] Memory usage profiling (target: < 150MB baseline)
  - [ ] SQLite query optimization with proper indexing
  - [ ] LLM response streaming performance
  - [ ] Bundle size optimization (tree-shaking, asset compression)
- [ ] **Accessibility**
  - [ ] Full keyboard navigation for all UI components
  - [ ] Screen reader support (ARIA labels, roles, and descriptions)
  - [ ] High contrast mode
  - [ ] Reduced motion mode (respect `prefers-reduced-motion`)
  - [ ] Font scaling support
- [ ] **Internationalization (i18n)** — Externalize all user-facing strings. Initial support for English, with infrastructure for community translations
- [ ] **CI/CD Pipeline**
  - [ ] Automated builds for Windows, macOS, and Linux on every push
  - [ ] Automated test execution
  - [ ] Automated code signing
  - [ ] Automated release creation with changelogs
- [ ] **Security Audit** — Engage a third-party security firm to audit the permission engine, IPC boundary, and LLM integration
- [ ] **Documentation** — User guide, developer guide, plugin authoring guide, and API reference

### Exit Criteria

Phase 3 is complete when:
1. The binary is code-signed and passes SmartScreen / Gatekeeper without warnings
2. Test coverage exceeds 80% for the Rust backend
3. The application meets WCAG 2.1 AA accessibility standards
4. A third-party security audit has been completed with all critical findings resolved
5. The application can be submitted to the Microsoft Store and/or Homebrew

---

## Timeline

| Phase | Status | Estimated Duration |
|---|---|---|
| **Phase 1** | 🟡 In Progress | 4–6 weeks |
| **Phase 2** | ⬜ Not Started | 6–8 weeks |
| **Phase 3** | ⬜ Not Started | 8–12 weeks |

> **Note:** These estimates assume a single developer working part-time. Timelines will be revised as the project evolves and priorities become clearer.

---

## Principles

These principles guide roadmap decisions:

1. **Ship something that works, then improve it.** Phase 1 is deliberately minimal — a working agent with a solid permission system. Features are added only after the foundation is stable.

2. **Security is never deferred.** The permission engine is in Phase 1, not Phase 3. Security is not a feature to be added later — it is the foundation everything else is built on.

3. **UX quality is not optional.** A permission system that annoys users into disabling it is worse than no permission system. Every phase includes UX considerations.

4. **Each phase has clear exit criteria.** No phase is "done" until its exit criteria are met. No phase starts until the previous phase's criteria are satisfied.

---

<p align="center">
  <em>The roadmap is a living document. It will change. The principles won't.</em>
</p>
