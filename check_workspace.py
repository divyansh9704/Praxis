import sqlite3
import os

db_path = os.path.expandvars(r"%LOCALAPPDATA%\com.praxis.app\praxis.db")
if not os.path.exists(db_path):
    print("DB not found at", db_path)
    exit(1)

conn = sqlite3.connect(db_path)
c = conn.cursor()

c.execute("SELECT key, value FROM preferences WHERE key='workspace_path'")
row = c.fetchone()
if row:
    print("WORKSPACE_PATH:", row[1])
else:
    print("WORKSPACE_PATH NOT SET IN DB")

conn.close()
