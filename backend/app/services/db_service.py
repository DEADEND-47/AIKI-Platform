import sqlite3
import psycopg2
import psycopg2.pool
from psycopg2.extras import RealDictCursor
from app.config import get_settings

class DBService:
    def __init__(self):
        settings = get_settings()
        self.db_url = settings.database_url
        self.use_postgres = False
        self.pool = None
        
        if self.db_url and self.db_url.strip() != "":
            try:
                # Test connectivity and initialize connection pool
                self.pool = psycopg2.pool.ThreadedConnectionPool(
                    minconn=1,
                    maxconn=10,
                    dsn=self.db_url
                )
                self.use_postgres = True
                print("[INFO] Successfully initialized PostgreSQL connection pool.")
            except Exception as e:
                print(f"[WARNING] PostgreSQL connection pool initialization failed: {e}. Falling back to local SQLite.")
                self.use_postgres = False
        else:
            print("[INFO] DATABASE_URL is empty. Using local SQLite.")
            
        self.sqlite_path = "aiki.db"
        self.init_db()

    def get_connection(self):
        if self.use_postgres:
            return self.pool.getconn()
        else:
            return sqlite3.connect(self.sqlite_path)

    def release_connection(self, conn):
        if self.use_postgres:
            self.pool.putconn(conn)
        else:
            conn.close()

    def init_db(self):
        # Create Tables using standard SQL (identical syntax)
        queries = [
            """
            CREATE TABLE IF NOT EXISTS jobs (
                job_id VARCHAR(50) PRIMARY KEY,
                status VARCHAR(50) DEFAULT 'queued',
                file_count INTEGER,
                documents_processed INTEGER DEFAULT 0,
                entities_extracted INTEGER DEFAULT 0,
                progress INTEGER DEFAULT 0,
                error TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
            """,
            """
            CREATE TABLE IF NOT EXISTS documents (
                doc_id VARCHAR(50) PRIMARY KEY,
                filename VARCHAR(500),
                doc_type VARCHAR(50),
                upload_timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                status VARCHAR(50) DEFAULT 'queued',
                entity_count INTEGER DEFAULT 0,
                tags TEXT[], -- Note: SQLite ignores TEXT[], behaves as TEXT
                page_count INTEGER DEFAULT 0
            )
            """,
            """
            CREATE TABLE IF NOT EXISTS entities (
                entity_id VARCHAR(50) PRIMARY KEY,
                doc_id VARCHAR(50),
                type VARCHAR(50),
                value TEXT,
                context TEXT,
                page INTEGER,
                confidence FLOAT
            )
            """,
            """
            CREATE TABLE IF NOT EXISTS sessions (
                session_id VARCHAR(50) PRIMARY KEY,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
            """,
            """
            CREATE TABLE IF NOT EXISTS messages (
                message_id VARCHAR(50) PRIMARY KEY,
                session_id VARCHAR(50),
                role VARCHAR(10),
                content TEXT,
                confidence_score FLOAT,
                timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
            """,
            """
            CREATE TABLE IF NOT EXISTS compliance_scans (
                scan_id VARCHAR(50) PRIMARY KEY,
                status VARCHAR(50),
                regulations TEXT[],
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                completed_at TIMESTAMP,
                results TEXT -- Store scan results as JSON string
            )
            """,
            """
            CREATE TABLE IF NOT EXISTS plants (
                plant_id VARCHAR(50) PRIMARY KEY,
                name VARCHAR(200),
                location VARCHAR(200),
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
            """,
            """
            CREATE TABLE IF NOT EXISTS users (
                user_id VARCHAR(50) PRIMARY KEY,
                email VARCHAR(150) UNIQUE NOT NULL,
                password_hash VARCHAR(255) NOT NULL,
                role VARCHAR(20) DEFAULT 'viewer',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
            """,
            """
            CREATE TABLE IF NOT EXISTS contradictions (
                contradiction_id VARCHAR(50) PRIMARY KEY,
                doc_id VARCHAR(50),
                related_doc_id VARCHAR(50),
                equipment_tag VARCHAR(50),
                topic VARCHAR(150),
                new_doc_says TEXT,
                existing_doc_says TEXT,
                severity VARCHAR(20),
                resolution TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
            """
        ]
        
        conn = self.get_connection()
        cursor = conn.cursor()
        try:
            for query in queries:
                if not self.use_postgres:
                    query = query.replace("%s", "?")
                cursor.execute(query)
            conn.commit()
            print("[INFO] SQL tables initialized successfully.")
        except Exception as e:
            conn.rollback()
            print(f"[ERROR] Failed to initialize SQL tables: {e}")
        finally:
            cursor.close()
            self.release_connection(conn)
 
        # Apply schema alterations if not exists
        self.add_column_if_not_exists("documents", "plant_id", "VARCHAR(50)")
        self.add_column_if_not_exists("documents", "version", "INTEGER", "1")
        self.add_column_if_not_exists("documents", "parent_doc_id", "VARCHAR(50)")
        self.add_column_if_not_exists("documents", "is_latest", "BOOLEAN", "TRUE")
        self.add_column_if_not_exists("jobs", "plant_id", "VARCHAR(50)")
        self.add_column_if_not_exists("compliance_scans", "plant_id", "VARCHAR(50)")

        # Seed default plants
        try:
            plants_count = self.execute_read("SELECT COUNT(*) as count FROM plants")[0]["count"]
        except Exception:
            plants_count = 0
            
        if plants_count == 0:
            plant_ohio_id = "p1-ohio-1111-1111-111111111111"
            plant_texas_id = "p2-texas-2222-2222-222222222222"
            self.execute_write(
                "INSERT INTO plants (plant_id, name, location) VALUES (%s, %s, %s)",
                (plant_ohio_id, "Plant Alpha", "Ohio")
            )
            self.execute_write(
                "INSERT INTO plants (plant_id, name, location) VALUES (%s, %s, %s)",
                (plant_texas_id, "Plant Beta", "Texas")
            )
            print("[INFO] Seeded default plants.")
            
        # Seed default admin user
        try:
            users_count = self.execute_read("SELECT COUNT(*) as count FROM users")[0]["count"]
        except Exception:
            users_count = 0
            
        if users_count == 0:
            import bcrypt
            admin_id = "u1-admin-0000-0000-000000000000"
            admin_email = "admin@aiki.ai"
            salt = bcrypt.gensalt()
            admin_password_hash = bcrypt.hashpw("adminpassword".encode("utf-8"), salt).decode("utf-8")
            self.execute_write(
                "INSERT INTO users (user_id, email, password_hash, role) VALUES (%s, %s, %s, %s)",
                (admin_id, admin_email, admin_password_hash, "admin")
            )
            print("[INFO] Seeded default admin user.")

    def add_column_if_not_exists(self, table: str, column: str, col_type: str, default_val: str = None):
        default_clause = f" DEFAULT {default_val}" if default_val is not None else ""
        query = f"ALTER TABLE {table} ADD COLUMN {column} {col_type}{default_clause}"
        try:
            if not self.use_postgres:
                query = query.replace("%s", "?")
            self.execute_write(query)
            print(f"[INFO] Added column {column} to table {table}.")
        except Exception as e:
            err_msg = str(e).lower()
            if "duplicate column" in err_msg or "already exists" in err_msg or "operationalerror" in err_msg or "duplicate" in err_msg:
                # Column already exists
                pass
            else:
                print(f"[WARNING] Could not add column {column} to table {table}: {e}")

    def execute_write(self, query: str, params: tuple = ()) -> int:
        if not self.use_postgres:
            query = query.replace("%s", "?")
        
        conn = self.get_connection()
        cursor = conn.cursor()
        rowcount = 0
        try:
            cursor.execute(query, params)
            conn.commit()
            rowcount = cursor.rowcount
        except Exception as e:
            conn.rollback()
            print(f"[ERROR] execute_write failed: {e} for query {query} with params {params}")
            raise e
        finally:
            cursor.close()
            self.release_connection(conn)
        return rowcount

    def execute_read(self, query: str, params: tuple = ()) -> list:
        if not self.use_postgres:
            query = query.replace("%s", "?")
            
        conn = self.get_connection()
        if self.use_postgres:
            cursor = conn.cursor(cursor_factory=RealDictCursor)
        else:
            # Enable Dict-like rows for sqlite
            conn.row_factory = sqlite3.Row
            cursor = conn.cursor()
            
        results = []
        try:
            cursor.execute(query, params)
            rows = cursor.fetchall()
            if self.use_postgres:
                results = [dict(row) for row in rows]
            else:
                # Convert sqlite Rows to dicts
                results = []
                for row in rows:
                    d = dict(row)
                    # Convert SQLite array representations back to Python lists if necessary
                    if "tags" in d and isinstance(d["tags"], str):
                        tags_str = d["tags"]
                        if tags_str.startswith("{") and tags_str.endswith("}"):
                            d["tags"] = [t.strip() for t in tags_str[1:-1].split(",") if t.strip()]
                        elif tags_str.startswith("[") and tags_str.endswith("]"):
                            d["tags"] = [t.strip("'\" ") for t in tags_str[1:-1].split(",") if t.strip()]
                        else:
                            d["tags"] = [tags_str] if tags_str else []
                    results.append(d)
        except Exception as e:
            print(f"[ERROR] execute_read failed: {e} for query {query} with params {params}")
            raise e
        finally:
            cursor.close()
            self.release_connection(conn)
        return results

db_service = DBService()
