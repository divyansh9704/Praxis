# ADR 001: TrustTier Architecture

## Status
Accepted

## Context
Praxis enables LLM agents to execute code and shell commands on the user's local machine. This presents a massive security vector. If an LLM hallucinates `rm -rf /` or attempts to exfiltrate data, the system must prevent it. Standard "always ask" confirmation dialogs cause extreme user fatigue, leading users to blindly click "Approve" (habituation). 

## Decision
We implemented **TrustTier**, a stratified permission model evaluated in Rust.
Instead of a binary allow/deny, tools are categorized into Tiers:
- **Auto**: Safe operations (read file).
- **Ask**: Mutative operations (write file, run command).

This logic is hardcoded into the Rust IPC handlers before the payload ever reaches `std::process::Command`.

## Consequences
**Positive**:
- Eliminates "Approve" fatigue for harmless actions.
- Guarantees destructive actions cannot be executed autonomously without human intervention.
- Secure because the check happens in memory-safe Rust, rather than the spoofable frontend.

**Negative**:
- Slightly slows down the execution loop when a confirmation is required, as the IPC must yield to the frontend, await a user click, and resume.
