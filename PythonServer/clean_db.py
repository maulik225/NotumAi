
import sqlite3
import os

DB_PATH = "project_data.db"

def clean_database():
    if not os.path.exists(DB_PATH):
        print("Database not found.")
        return

    try:
        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()
        
        # We assume tables exist since app creates them on startup
        tables = ["projects", "project_state", "annotations_v2"]
        
        for table in tables:
            try:
                cursor.execute(f"DELETE FROM {table}")
                print(f"Cleared table: {table}")
            except sqlite3.OperationalError:
                print(f"Table {table} might not exist yet, skipping.")
                
        # Reset AUTOINCREMENT counters if desired? Not strictly necessary but clean
        try:
            cursor.execute("DELETE FROM sqlite_sequence")
            print("Reset auto-increment counters")
        except:
            pass
            
        conn.commit()
        conn.close()
        print("Database successfully wiped.")
        
    except Exception as e:
        print(f"Error cleaning database: {e}")

if __name__ == "__main__":
    clean_database()
