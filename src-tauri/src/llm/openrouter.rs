use futures_util::StreamExt;
use reqwest::Client;
use serde_json::{json, Value};
use std::time::Duration;
use tauri::Emitter;

use crate::error::PraxisError;
use crate::llm::LlmMessage;

const MODELS: &[&str] = &[
    "qwen/qwen3-coder:free",
    "meta-llama/llama-3.3-70b-instruct:free",
    "google/gemma-4-31b-it:free",
    "nousresearch/hermes-3-llama-3.1-405b:free",
    "meta-llama/llama-3.2-3b-instruct:free",
];

/// OpenRouter API provider.
pub struct OpenRouterProvider {
    api_key: String,
    endpoint_url: String,
}

impl OpenRouterProvider {
    pub fn new(api_key: String) -> Self {
        Self {
            api_key,
            endpoint_url: "https://openrouter.ai/api/v1/chat/completions".to_string(),
        }
    }

    /// Test-only constructor that lets us point at a mock server.
    #[cfg(test)]
    pub(crate) fn with_endpoint(api_key: String, endpoint_url: String) -> Self {
        Self {
            api_key,
            endpoint_url,
        }
    }

    /// Core fallback loop — tries each model in MODELS until one returns
    /// HTTP 200. Returns the successful `Response` and the model slug that
    /// worked. This is the ACTUAL production fallback logic; both
    /// `complete_streaming` and tests call it.
    async fn request_with_fallback(
        &self,
        combined_messages: &[Value],
        stream: bool,
        preferred_model: Option<String>,
    ) -> Result<(reqwest::Response, String), PraxisError> {
        let mut last_error = String::new();

        let mut try_models: Vec<String> = Vec::new();
        if let Some(m) = preferred_model {
            if !m.trim().is_empty() {
                try_models.push(m);
            }
        }
        for &m in MODELS {
            let m_str = m.to_string();
            if !try_models.contains(&m_str) {
                try_models.push(m_str);
            }
        }

        for (i, model) in try_models.iter().enumerate() {
            println!(
                "🤖 OpenRouter: Attempting model '{}' (slot {}/{})",
                model,
                i + 1,
                try_models.len()
            );

            let body = json!({
                "model": model,
                "stream": stream,
                "messages": combined_messages,
            });

            let client = Client::builder()
                .timeout(Duration::from_secs(20))
                .build()
                .map_err(|e| PraxisError::LlmError(e.to_string()))?;

            let resp_result = client
                .post(&self.endpoint_url)
                .header("Authorization", format!("Bearer {}", self.api_key))
                .header("Content-Type", "application/json")
                .header("HTTP-Referer", "http://localhost:1420")
                .header("X-Title", "Praxis")
                .json(&body)
                .send()
                .await;

            let resp = match resp_result {
                Ok(r) => r,
                Err(e) => {
                    eprintln!(
                        "⚠️ OpenRouter model '{}' failed with network error: {}",
                        model, e
                    );
                    if e.is_timeout() {
                        if i < try_models.len() - 1 {
                            continue;
                        } else {
                            return Err(PraxisError::LlmError(
                                "all fallback models exhausted due to provider load".into(),
                            ));
                        }
                    }
                    return Err(PraxisError::LlmError(e.to_string()));
                }
            };

            let status = resp.status();
            if !status.is_success() {
                let text = resp.text().await.unwrap_or_default();
                let text_lower = text.to_lowercase();
                eprintln!(
                    "⚠️ OpenRouter model '{}' returned HTTP {}: {}",
                    model, status, text
                );

                match status.as_u16() {
                    429 => {
                        if text_lower.contains("quota")
                            || text_lower.contains("balance")
                            || text_lower.contains("credit")
                            || text_lower.contains("limit exceeded")
                        {
                            return Err(PraxisError::LlmError(
                                "OpenRouter daily quota exceeded".into(),
                            ));
                        }
                        if i < try_models.len() - 1 {
                            continue;
                        } else {
                            return Err(PraxisError::LlmError(
                                "all fallback models exhausted due to provider load".into(),
                            ));
                        }
                    }
                    408 | 404 | 500..=599 => {
                        last_error = format!("OpenRouter API {} — {}", status, text);
                        if i < try_models.len() - 1 {
                            continue;
                        } else {
                            return Err(PraxisError::LlmError(last_error));
                        }
                    }
                    400 => {
                        if text_lower.contains("not a valid model") {
                            last_error =
                                format!("OpenRouter API {} — invalid model: {}", status, model);
                            if i < try_models.len() - 1 {
                                continue;
                            } else {
                                return Err(PraxisError::LlmError(last_error));
                            }
                        }
                        return Err(PraxisError::LlmError(format!(
                            "OpenRouter API {} — {}",
                            status, text
                        )));
                    }
                    402 => {
                        return Err(PraxisError::LlmError(
                            "OpenRouter daily quota exceeded".into(),
                        ));
                    }
                    _ => {
                        return Err(PraxisError::LlmError(format!(
                            "OpenRouter API {} — {}",
                            status, text
                        )));
                    }
                }
            }

            // HTTP 200 — this model worked.
            println!("✅ OpenRouter: Model '{}' succeeded", model);
            return Ok((resp, model.to_string()));
        }

        Err(PraxisError::LlmError(format!(
            "All fallback models failed. Last error: {}",
            last_error
        )))
    }

    /// Streaming completion — sends incremental text chunks to the Tauri
    /// IPC channel and returns the fully-accumulated response.
    pub async fn complete_streaming(
        &self,
        messages: &[LlmMessage],
        system: &str,
        preferred_model: Option<String>,
        channel: tauri::ipc::Channel<String>,
        app_handle: tauri::AppHandle,
    ) -> Result<String, PraxisError> {
        let mut combined_messages = vec![json!({
            "role": "system",
            "content": system
        })];

        for m in messages {
            combined_messages.push(json!({
                "role": m.role,
                "content": m.content
            }));
        }

        // Use the shared fallback loop with streaming enabled.
        let (resp, model_used) = self.request_with_fallback(&combined_messages, true, preferred_model).await?;

        // Broadcast the model used to the frontend for the ModelStatus panel.
        let _ = app_handle.emit("llm_model_used", &model_used);

        // ── SSE stream parsing ──────────────────────────────────
        let mut accumulated = String::new();
        let mut byte_stream = resp.bytes_stream();
        let mut buffer = String::new();

        while let Some(chunk_result) = byte_stream.next().await {
            let chunk = chunk_result.map_err(|e| PraxisError::LlmError(e.to_string()))?;
            buffer.push_str(&String::from_utf8_lossy(&chunk));

            while let Some(newline_pos) = buffer.find('\n') {
                let line = buffer[..newline_pos].trim_end_matches('\r').to_string();
                buffer = buffer[newline_pos + 1..].to_string();

                if line.is_empty() || line.starts_with(':') {
                    continue;
                }

                if let Some(data) = line.strip_prefix("data: ") {
                    if data == "[DONE]" {
                        let _ = channel.send("[DONE]".into());
                        return Ok(accumulated);
                    }

                    if let Ok(event) = serde_json::from_str::<Value>(data) {
                        if let Some(choices) = event.get("choices").and_then(|c| c.as_array()) {
                            if let Some(first_choice) = choices.first() {
                                if let Some(content) = first_choice
                                    .get("delta")
                                    .and_then(|d| d.get("content"))
                                    .and_then(|c| c.as_str())
                                {
                                    accumulated.push_str(content);
                                    let _ = channel.send(content.to_string());
                                }
                            }
                        }
                        if let Some(error) = event.get("error") {
                            let msg = error
                                .get("message")
                                .and_then(|m| m.as_str())
                                .unwrap_or("Unknown OpenRouter streaming error");
                            return Err(PraxisError::LlmError(msg.to_string()));
                        }
                    }
                }
            }
        }

        let _ = channel.send("[DONE]".into());
        Ok(accumulated)
    }

    /// Validates an API key by checking the OpenRouter auth endpoint.
    pub async fn validate_key(api_key: &str) -> Result<bool, PraxisError> {
        let client = Client::builder()
            .timeout(Duration::from_secs(10))
            .build()
            .map_err(|e| PraxisError::LlmError(e.to_string()))?;

        let resp = client
            .get("https://openrouter.ai/api/v1/auth/key")
            .header("Authorization", format!("Bearer {}", api_key))
            .send()
            .await
            .map_err(|e| PraxisError::LlmError(e.to_string()))?;

        Ok(resp.status().is_success())
    }
}

// ─────────────────────────────────────────────────────────────
// Tests — wiremock-based HTTP mock for the 404 fallback
// ─────────────────────────────────────────────────────────────
#[cfg(test)]
mod tests {
    use super::*;
    use wiremock::matchers::{body_partial_json, method};
    use wiremock::{Mock, MockServer, ResponseTemplate};

    /// Reproduces the exact production bug: the first model in the
    /// fallback chain returns HTTP 404 ("model unavailable for free"),
    /// and the provider must silently fall back to the second model.
    #[tokio::test]
    async fn test_fallback_on_404_dead_model() {
        let mock_server = MockServer::start().await;

        // Mock for model[0]: return 404 (dead free-tier model).
        Mock::given(method("POST"))
            .and(body_partial_json(json!({"model": MODELS[0]})))
            .respond_with(
                ResponseTemplate::new(404).set_body_json(json!({
                    "error": {
                        "message": "This model is unavailable for free. The paid version is available now - use this slug instead: qwen/qwen-2.5-72b-instruct",
                        "code": 404
                    }
                })),
            )
            .mount(&mock_server)
            .await;

        // Mock for model[1]: return 200 with a valid response.
        Mock::given(method("POST"))
            .and(body_partial_json(json!({"model": MODELS[1]})))
            .respond_with(ResponseTemplate::new(200).set_body_json(json!({
                "choices": [{
                    "message": {
                        "role": "assistant",
                        "content": "Hello from the fallback model!"
                    }
                }]
            })))
            .mount(&mock_server)
            .await;

        // Create provider pointing at the mock server.
        let provider = OpenRouterProvider::with_endpoint(
            "test-key-123".into(),
            format!("{}/v1/chat/completions", mock_server.uri()),
        );

        // Call the ACTUAL fallback logic.
        let messages = vec![json!({"role": "user", "content": "test prompt"})];
        let result = provider.request_with_fallback(&messages, false, None).await;

        // ── Assertions ──
        assert!(
            result.is_ok(),
            "Fallback should have succeeded, got error: {:?}",
            result.err()
        );

        let (response, model_used) = result.unwrap();

        // The response came from the 200 mock (second model).
        assert_eq!(response.status().as_u16(), 200);

        // It fell back PAST the first (dead) model.
        assert_ne!(
            model_used, MODELS[0],
            "Should NOT have returned the first (dead) model as successful"
        );
        assert_eq!(
            model_used, MODELS[1],
            "Should have fallen back to the second model"
        );

        // The response body is the one we mocked.
        let body: Value = response.json().await.unwrap();
        let content = body["choices"][0]["message"]["content"].as_str().unwrap();
        assert_eq!(content, "Hello from the fallback model!");

        // The mock server received exactly 2 requests:
        // request 1 → model[0] → 404, request 2 → model[1] → 200.
        let received = mock_server.received_requests().await.unwrap();
        assert_eq!(
            received.len(),
            2,
            "Expected exactly 2 HTTP requests (404 + 200), got {}",
            received.len()
        );
    }

    /// Verifies that a 402 (quota exhausted) is a hard stop — no fallback.
    #[tokio::test]
    async fn test_402_quota_is_hard_stop() {
        let mock_server = MockServer::start().await;

        // Every model returns 402.
        Mock::given(method("POST"))
            .respond_with(ResponseTemplate::new(402).set_body_json(json!({
                "error": {"message": "Insufficient credits", "code": 402}
            })))
            .mount(&mock_server)
            .await;

        let provider = OpenRouterProvider::with_endpoint(
            "test-key".into(),
            format!("{}/v1/chat/completions", mock_server.uri()),
        );

        let messages = vec![json!({"role": "user", "content": "test"})];
        let result = provider.request_with_fallback(&messages, false, None).await;

        assert!(result.is_err());
        let err_msg = result.unwrap_err().to_string();
        assert!(
            err_msg.contains("quota exceeded"),
            "Expected quota error, got: {}",
            err_msg
        );

        // Should have stopped after 1 request — no fallback attempted.
        let received = mock_server.received_requests().await.unwrap();
        assert_eq!(
            received.len(),
            1,
            "402 should be a hard stop — no fallback, but got {} requests",
            received.len()
        );
    }

    /// Verifies that a 400 with "not a valid model" triggers the fallback loop,
    /// just like a 404.
    #[tokio::test]
    async fn test_fallback_on_400_invalid_model() {
        let mock_server = MockServer::start().await;

        // Mock for model[0]: return 400 (invalid model).
        Mock::given(method("POST"))
            .and(body_partial_json(json!({"model": MODELS[0]})))
            .respond_with(ResponseTemplate::new(400).set_body_json(json!({
                "error": {
                    "message": "not a valid model: 'qwen/qwen3-coder:free'",
                    "code": 400
                }
            })))
            .mount(&mock_server)
            .await;

        // Mock for model[1]: return 200 with a valid response.
        Mock::given(method("POST"))
            .and(body_partial_json(json!({"model": MODELS[1]})))
            .respond_with(ResponseTemplate::new(200).set_body_json(json!({
                "choices": [{
                    "message": {
                        "role": "assistant",
                        "content": "Hello from the fallback model!"
                    }
                }]
            })))
            .mount(&mock_server)
            .await;

        let provider = OpenRouterProvider::with_endpoint(
            "test-key".into(),
            format!("{}/v1/chat/completions", mock_server.uri()),
        );

        let messages = vec![json!({"role": "user", "content": "test"})];
        let result = provider.request_with_fallback(&messages, false, None).await;

        assert!(result.is_ok());
        let (response, model_used) = result.unwrap();

        assert_eq!(response.status().as_u16(), 200);
        assert_eq!(model_used, MODELS[1]);

        let received = mock_server.received_requests().await.unwrap();
        assert_eq!(received.len(), 2);
    }
}
