# LLM Routing Engine

Praxis acts as a meta-client, meaning it does not rely on a single LLM provider. The routing engine in Rust abstracts the differences between OpenRouter, native Anthropic, and local models.

## OpenRouter Integration
Currently, the primary provider is OpenRouter, which grants access to Claude 3.5 Sonnet, GPT-4o, and hundreds of other models via a unified API.

- **Endpoint**: `https://openrouter.ai/api/v1/chat/completions`
- **Tool Mapping**: Praxis's internal Rust tool schemas (e.g., `execute_command`) are serialized to JSON Schema and injected into the payload.
- **Header Parsing**: The router explicitly parses OpenRouter-specific headers for rate limits and errors to present clean UI toasts instead of raw JSON errors.

## Fallback Chains (Planned)
In a future update, if an API call fails (e.g., Anthropic is down), the router will seamlessly fall back to an equivalent model (e.g., GPT-4o) without dropping the user's prompt.
