import keyring
try:
    keyring.delete_password("praxis", "llm_openrouter")
except:
    pass
try:
    keyring.delete_password("praxis", "search_serper")
except:
    pass
print("Wiped keyring.")
