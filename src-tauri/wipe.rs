fn main() {
    let entry = keyring::Entry::new("praxis", "llm_openrouter").unwrap();
    if let Ok(pw) = entry.get_password() {
        println!("Found password: {}", pw);
        entry.delete_password().unwrap();
        println!("Deleted!");
    } else {
        println!("No password found.");
    }
}
