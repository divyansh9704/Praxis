# Frontend Architecture

The frontend is built for extreme performance, aesthetic excellence ("Quiet Luxury"), and direct IPC integration with the Rust backend.

## Tech Stack
- **Framework**: React 18 + TypeScript
- **Bundler**: Vite (lightning fast HMR)
- **Styling**: Pure CSS (No Tailwind). We enforce custom CSS variables (`--color-surface`, `--color-accent`) to maintain absolute control over the dark-mode "Quiet Luxury" aesthetic and fluid micro-animations.
- **Icons**: Lucide React

## State Management
We minimize reliance on heavy global state stores like Redux. Instead:
- Rapidly mutating states (like streaming LLM tokens) are handled via local React component state to prevent full-tree re-renders.
- Global app state (Active View, Current Workspace, Theme) is managed via minimal React Contexts.

## Tauri IPC Wrapper
All communication with the Rust backend goes through the `@tauri-apps/api/core` module.

```typescript
// Example: Sending a prompt
import { invoke } from "@tauri-apps/api/core";

export async function sendPrompt(text: string) {
    try {
        const response = await invoke("send_prompt", { text });
        return response;
    } catch (error) {
        console.error("IPC Error:", error);
        throw error;
    }
}
```

## Window Controls
Because Praxis uses a frameless, transparent window for modern OS integration (like macOS vibrancy or Windows Mica), the standard OS titlebar is removed. The frontend explicitly provides `data-tauri-drag-region` attributes on the header to allow window dragging, and implements custom Minimize, Maximize, and Close buttons that invoke Rust functions to control the native window manager.
