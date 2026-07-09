use crate::error::PraxisError;

const SERVICE_NAME: &str = "praxis";

/// Supported keychain usernames mapped from provider identifiers.
/// Provider strings accepted: "claude", "gemini", "serper".
fn provider_to_username(provider: &str) -> Result<&'static str, PraxisError> {
    match provider {
        "openrouter" => Ok("llm_openrouter"),
        "claude" => Ok("llm_claude"),
        "gemini" => Ok("llm_gemini"),
        "serper" => Ok("search_serper"),
        other => Err(PraxisError::Keychain(format!(
            "Unknown provider: {}",
            other
        ))),
    }
}

/// Store an API key in the OS keychain.
pub fn store_api_key(provider: &str, key: &str) -> Result<(), PraxisError> {
    let username = provider_to_username(provider)?;
    let entry = keyring::Entry::new(SERVICE_NAME, username)
        .map_err(|e| PraxisError::Keychain(e.to_string()))?;
    entry
        .set_password(key)
        .map_err(|e| PraxisError::Keychain(e.to_string()))?;
    Ok(())
}

/// Retrieve an API key from the OS keychain.
pub fn get_api_key(provider: &str) -> Result<String, PraxisError> {
    let username = provider_to_username(provider)?;
    let entry = keyring::Entry::new(SERVICE_NAME, username)
        .map_err(|e| PraxisError::Keychain(e.to_string()))?;
    entry
        .get_password()
        .map_err(|e| PraxisError::Keychain(e.to_string()))
}

/// Delete an API key from the OS keychain.
#[allow(dead_code)]
pub fn delete_api_key(provider: &str) -> Result<(), PraxisError> {
    let username = provider_to_username(provider)?;
    let entry = keyring::Entry::new(SERVICE_NAME, username)
        .map_err(|e| PraxisError::Keychain(e.to_string()))?;
    entry
        .delete_credential()
        .map_err(|e| PraxisError::Keychain(e.to_string()))?;
    Ok(())
}

/// Check whether a key exists in the keychain for the given provider.
pub fn has_api_key(provider: &str) -> Result<bool, PraxisError> {
    match get_api_key(provider) {
        Ok(_) => Ok(true),
        Err(PraxisError::Keychain(msg))
            if msg.contains("No matching entry")
                || msg.contains("not found")
                || msg.contains("NoEntry") =>
        {
            Ok(false)
        }
        Err(e) => Err(e),
    }
}
