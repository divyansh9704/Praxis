import sqlite3
import os

db_path = os.path.expandvars(r"%LOCALAPPDATA%\com.praxis.app\praxis.db")
if not os.path.exists(db_path):
    print("DB not found at", db_path)
    exit(1)

conn = sqlite3.connect(db_path)
c = conn.cursor()

print("--- CONVERSATIONS ---")
for row in c.execute("SELECT id, title FROM conversations"):
    print(row)

print("--- MESSAGES ---")
for row in c.execute("SELECT id, conversation_id, role FROM messages"):
    print(row)

print("--- ACTIONS ---")
for row in c.execute("SELECT id, conversation_id, tool_name FROM actions"):
    print(row)

conn.close()
