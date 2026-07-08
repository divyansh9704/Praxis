# Frequently Asked Questions

### Is Praxis safe to run?
Praxis is as safe as you allow it to be. Every destructive command requires explicit confirmation before it is executed. Furthermore, Praxis implements rigid Workspace Isolation, preventing the AI from modifying files outside of the active project directory.

### Where are my API keys stored?
Your API keys are never stored in plain text. Praxis uses the OS-native credential manager (Windows DPAPI, macOS Keychain, Linux Secret Service).

### Why use Rust instead of Electron?
Rust + Tauri provides a minuscule memory footprint and blazing fast performance compared to Node/Electron. Furthermore, because Praxis acts as an autonomous agent executing shell commands, the memory-safety and strict typing of Rust is a crucial security barrier.

### Does it support local models?
Local model support via Ollama is currently on the roadmap and will be released in an upcoming version.

### Can I run it headless?
No, Praxis is specifically designed as a visual Desktop Environment with a "Quiet Luxury" aesthetic, providing a beautiful GUI for managing agents.
