import sqlite3
import os

db_path = os.path.expandvars(r"%LOCALAPPDATA%\com.praxis.app\praxis.db")
conn = sqlite3.connect(db_path)
c = conn.cursor()

c.execute("INSERT OR REPLACE INTO preferences (id, key, value) VALUES ('tmp-id', 'workspace_path', ?)", [r"C:\Users\Divyansh Sharma\Desktop\AIOS\praxis\test_workspace"])
conn.commit()
conn.close()
