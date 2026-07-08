# Workspace Isolation

Workspace Isolation ensures that the Praxis AI cannot arbitrarily traverse your entire hard drive. When you open a folder in Praxis, you are strictly confining the AI's autonomous capabilities to that specific root directory.

## How it works

When a tool call is executed (e.g., `write_to_file` with the path `../secret.txt`), the Rust backend applies the following security checks:

1. **Path Resolution**: The requested path is merged with the current active workspace path.
2. **Canonicalization**: The Rust standard library (`std::fs::canonicalize`) resolves all symlinks, `../`, and `./` segments to determine the absolute, true physical path on the disk.
3. **Prefix Matching**: The backend checks if the canonicalized path starts with the exact canonicalized path of the active workspace.
4. **Execution or Rejection**: 
   - If the path is a child of the workspace, the operation proceeds.
   - If the path escapes the workspace (e.g., resolving to `C:\Users\Name\Desktop\secret.txt` when the workspace is `C:\Users\Name\Desktop\project`), the operation is instantly aborted with a security violation error sent back to the LLM.

```mermaid
graph LR
    A[LLM Tool Call] --> B[Requested Path: ../system32/cmd.exe]
    B --> C[Rust canonicalize()]
    C --> D{Starts with Workspace Path?}
    D -- Yes --> E[Execute Operation]
    D -- No --> F[Security Exception Thrown]
    F --> G[Alert written to Audit Log]
```

## Exceptions
The only exceptions to this rule are absolute paths returned by explicit native OS File Dialogs triggered by the user (e.g., specifically selecting an external image file to upload as context). The LLM itself can never spontaneously generate an out-of-bounds path that circumvents this check.
