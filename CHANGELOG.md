# Changelog

All notable changes to Praxis will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.0] - 2026-07-08

### Added
- **Core Engine**: Initial release of the Praxis AI Desktop environment.
- **TrustTier Permission Model**: Strict authorization layers for IPC commands.
- **Keychain Integration**: Native OS DPAPI integration for secure API key storage.
- **Workspace Isolation**: Directory sandboxing to prevent path traversal outside designated project roots.
- **Audit Logging**: Comprehensive SQLite-backed logging of all AI-initiated file and command operations.
- **LLM Routing Engine**: Fallback chains and provider orchestration (OpenRouter, Anthropic, local via Ollama).
- **Tauri Architecture**: Blazing fast Rust backend with a React + Vite frontend.
- **"Quiet Luxury" UI**: Dark mode dashboard with fluid animations and premium typography.
