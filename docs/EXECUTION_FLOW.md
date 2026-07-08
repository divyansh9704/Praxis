# Execution Flow

This document details the exact lifecycle of a user prompt inside Praxis, demonstrating the round-trip from the React frontend to the LLM via the Rust backend, and back.

```mermaid
sequenceDiagram
    participant User
    participant React (Frontend)
    participant Rust (Backend)
    participant LLM (OpenRouter)
    participant OS (File System/Shell)
    
    User->>React (Frontend): Enters Prompt
    React (Frontend)->>Rust (Backend): IPC `invoke("send_prompt", {text})`
    Rust (Backend)->>Rust (Backend): Load API Key from Keychain
    Rust (Backend)->>LLM (OpenRouter): HTTP POST Request
    LLM (OpenRouter)-->>Rust (Backend): JSON Response (Tool Call `write_file`)
    Rust (Backend)->>Rust (Backend): Evaluate TrustTier
    alt Explicit Confirmation Required
        Rust (Backend)-->>React (Frontend): Yield `Confirmation_Required` Event
        User->>React (Frontend): Approves action
        React (Frontend)->>Rust (Backend): IPC `invoke("approve_tool")`
    end
    Rust (Backend)->>Rust (Backend): Canonicalize Path
    Rust (Backend)->>OS (File System/Shell): Execute Action
    OS (File System/Shell)-->>Rust (Backend): Result Status
    Rust (Backend)->>Rust (Backend): Log to SQLite `actions` table
    Rust (Backend)-->>React (Frontend): Yield `Tool_Result` Event
```

## Step-by-Step Breakdown

1. **User Input**: The user types a message in the React UI.
2. **IPC Dispatch**: The frontend calls `invoke("send_prompt", { text: ... })`.
3. **Rust Threading**: Tauri spawns an asynchronous Tokio task so the main thread isn't blocked.
4. **Credential Fetch**: Rust queries the OS DPAPI for the necessary API keys.
5. **Network Request**: Rust makes a `reqwest` HTTP call to the OpenRouter/LLM provider.
6. **Tool Processing**: If the LLM requests a tool call (e.g., executing a terminal command), Rust parses the JSON.
7. **Trust Validation**: Rust evaluates the command against the user's `TrustTier`. If confirmation is required, it yields to the frontend and halts execution until the user approves.
8. **Execution**: The command is run safely within the canonicalized workspace bounds.
9. **Audit**: The operation is permanently recorded in `praxis.db`.
10. **Feedback Loop**: The result is sent back to the LLM to continue the loop or return a final text response to the user.
