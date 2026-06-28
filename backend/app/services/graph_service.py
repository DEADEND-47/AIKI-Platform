import sqlite3
import os
from typing import List, Dict, Any
from neo4j import GraphDatabase
from app.config import get_settings

class GraphService:
    def __init__(self):
        settings = get_settings()
        self.neo4j_uri = settings.neo4j_uri
        self.neo4j_user = settings.neo4j_user
        self.neo4j_password = settings.neo4j_password
        self.use_neo4j = False
        
        # Test Neo4j connection
        if self.neo4j_uri and self.neo4j_password:
            try:
                self.driver = GraphDatabase.driver(
                    self.neo4j_uri, 
                    auth=(self.neo4j_user, self.neo4j_password),
                    max_connection_pool_size=5
                )
                # Verify connectivity
                self.driver.verify_connectivity()
                self.use_neo4j = True
                print("[INFO] Connected to Neo4j AuraDB successfully.")
            except Exception as e:
                print(f"[WARNING] Could not connect to Neo4j: {e}. Falling back to SQLite for graph operations.")
                self.use_neo4j = False
        else:
            print("[INFO] Neo4j configuration missing. Using SQLite for graph operations.")
            
        # Initialize SQLite fallback tables
        self.sqlite_path = "aiki.db"
        self._init_sqlite_db()

    def _init_sqlite_db(self):
        conn = sqlite3.connect(self.sqlite_path)
        cursor = conn.cursor()
        # Nodes table
        cursor.execute("""
        CREATE TABLE IF NOT EXISTS graph_nodes (
            node_id TEXT PRIMARY KEY,
            label TEXT, -- Document or Entity
            type TEXT,  -- e.g. equipment_tag, personnel or 'document'
            value TEXT,
            doc_type TEXT,
            upload_timestamp TEXT
        )
        """)
        # Edges table
        cursor.execute("""
        CREATE TABLE IF NOT EXISTS graph_edges (
            edge_id TEXT PRIMARY KEY,
            source_id TEXT,
            target_id TEXT,
            type TEXT, -- CONTAINS, CO_OCCURS_IN, MAINTAINS, OPERATES_AT, SUBJECT_TO, HAS_FAILURE
            doc_id TEXT,
            doc_filename TEXT,
            FOREIGN KEY(source_id) REFERENCES graph_nodes(node_id),
            FOREIGN KEY(target_id) REFERENCES graph_nodes(node_id)
        )
        """)
        conn.commit()
        conn.close()

    def close(self):
        if self.use_neo4j:
            self.driver.close()

    def init_constraints(self):
        if self.use_neo4j:
            try:
                with self.driver.session() as session:
                    session.run("CREATE CONSTRAINT FOR (d:Document) REQUIRE d.doc_id IS UNIQUE;")
                    session.run("CREATE CONSTRAINT FOR (e:Entity) REQUIRE e.entity_id IS UNIQUE;")
                    session.run("CREATE INDEX FOR (e:Entity) ON (e.value);")
                    session.run("CREATE INDEX FOR (e:Entity) ON (e.type);")
                    print("[INFO] Neo4j constraints and indices initialized.")
            except Exception as e:
                print(f"[WARNING] Error creating Neo4j constraints: {e}")

    def add_document(self, doc_id: str, filename: str, doc_type: str, upload_timestamp: str):
        if self.use_neo4j:
            query = """
            MERGE (d:Document {doc_id: $doc_id})
            ON CREATE SET d.filename = $filename, d.doc_type = $doc_type, d.upload_timestamp = $upload_timestamp
            ON MATCH SET d.filename = $filename, d.doc_type = $doc_type
            RETURN d
            """
            try:
                with self.driver.session() as session:
                    session.run(query, doc_id=doc_id, filename=filename, doc_type=doc_type, upload_timestamp=upload_timestamp)
            except Exception as e:
                print(f"[ERROR] Neo4j add_document error: {e}")
                
        # SQLite
        conn = sqlite3.connect(self.sqlite_path)
        cursor = conn.cursor()
        cursor.execute("""
        INSERT INTO graph_nodes (node_id, label, type, value, doc_type, upload_timestamp)
        VALUES (?, ?, ?, ?, ?, ?)
        ON CONFLICT(node_id) DO UPDATE SET value=excluded.value, doc_type=excluded.doc_type
        """, (doc_id, "Document", "document", filename, doc_type, upload_timestamp))
        conn.commit()
        conn.close()

    def add_entity(self, entity_id: str, type: str, value: str):
        if self.use_neo4j:
            query = """
            MERGE (e:Entity {value: $value, type: $type})
            ON CREATE SET e.entity_id = $entity_id
            RETURN e
            """
            try:
                with self.driver.session() as session:
                    # Merge on value and type, but set entity_id if new
                    session.run(query, entity_id=entity_id, type=type, value=value)
            except Exception as e:
                print(f"[ERROR] Neo4j add_entity error: {e}")
                
        # SQLite
        conn = sqlite3.connect(self.sqlite_path)
        cursor = conn.cursor()
        # Find if entity with same value & type already exists
        cursor.execute("SELECT node_id FROM graph_nodes WHERE type=? AND value=?", (type, value))
        row = cursor.fetchone()
        if row:
            # Re-use existing node_id to prevent duplicates in local graph
            entity_id = row[0]
        else:
            cursor.execute("""
            INSERT INTO graph_nodes (node_id, label, type, value)
            VALUES (?, ?, ?, ?)
            ON CONFLICT(node_id) DO NOTHING
            """, (entity_id, "Entity", type, value))
            conn.commit()
        conn.close()
        return entity_id

    def add_contains(self, doc_id: str, entity_id: str):
        if self.use_neo4j:
            query = """
            MATCH (d:Document {doc_id: $doc_id})
            MATCH (e:Entity {entity_id: $entity_id})
            MERGE (d)-[:CONTAINS]->(e)
            """
            try:
                with self.driver.session() as session:
                    session.run(query, doc_id=doc_id, entity_id=entity_id)
            except Exception as e:
                # Fallback to match by value if merge failed due to ID mismatch
                pass
                
        # SQLite
        conn = sqlite3.connect(self.sqlite_path)
        cursor = conn.cursor()
        edge_id = f"{doc_id}_contains_{entity_id}"
        cursor.execute("""
        INSERT INTO graph_edges (edge_id, source_id, target_id, type, doc_id, doc_filename)
        VALUES (?, ?, ?, ?, ?, ?)
        ON CONFLICT(edge_id) DO NOTHING
        """, (edge_id, doc_id, entity_id, "CONTAINS", doc_id, ""))
        conn.commit()
        conn.close()

    def add_relationship(self, source_id: str, target_id: str, rel_type: str, doc_id: str, doc_filename: str):
        if self.use_neo4j:
            query = f"""
            MATCH (e1:Entity {{entity_id: $source_id}})
            MATCH (e2:Entity {{entity_id: $target_id}})
            MERGE (e1)-[r:{rel_type}]->(e2)
            SET r.doc_id = $doc_id, r.doc_filename = $doc_filename
            """
            try:
                with self.driver.session() as session:
                    session.run(query, source_id=source_id, target_id=target_id, doc_id=doc_id, doc_filename=doc_filename)
            except Exception as e:
                pass
                
        # SQLite
        conn = sqlite3.connect(self.sqlite_path)
        cursor = conn.cursor()
        edge_id = f"{source_id}_{rel_type}_{target_id}_{doc_id}"
        cursor.execute("""
        INSERT INTO graph_edges (edge_id, source_id, target_id, type, doc_id, doc_filename)
        VALUES (?, ?, ?, ?, ?, ?)
        ON CONFLICT(edge_id) DO NOTHING
        """, (edge_id, source_id, target_id, rel_type, doc_id, doc_filename))
        conn.commit()
        conn.close()

    def build_page_relationships(self, doc_id: str, filename: str, entities: List[Dict[str, Any]]):
        # Build node relationships
        # First, ensure all entity nodes are added and fetch their unique ID
        saved_entities = []
        for ent in entities:
            # We merge entities on value/type and get the mapped node_id
            mapped_id = self.add_entity(ent["entity_id"], ent["type"], ent["value"])
            saved_entities.append({**ent, "mapped_id": mapped_id})
            # Add CONTAINS
            self.add_contains(doc_id, mapped_id)
            
        # Group by page
        pages = {}
        for ent in saved_entities:
            p = ent["page"]
            if p not in pages:
                pages[p] = []
            pages[p].append(ent)
            
        # Create co-occurrence and semantic relationships
        for p, page_ents in pages.items():
            for i in range(len(page_ents)):
                for j in range(i + 1, len(page_ents)):
                    e1 = page_ents[i]
                    e2 = page_ents[j]
                    
                    id1, id2 = e1["mapped_id"], e2["mapped_id"]
                    if id1 == id2:
                        continue
                        
                    # 1. CO_OCCURS_IN
                    self.add_relationship(id1, id2, "CO_OCCURS_IN", doc_id, filename)
                    
                    # 2. Semantic mapping
                    # equipment_tag + personnel -> (personnel)-[:MAINTAINS]->(equipment)
                    # equipment_tag + process_parameter -> (equipment)-[:OPERATES_AT]->(parameter)
                    # equipment_tag + regulatory_ref -> (equipment)-[:SUBJECT_TO]->(regulation)
                    # equipment_tag + failure_mode -> (equipment)-[:HAS_FAILURE]->(failure_mode)
                    
                    self._check_and_add_semantic(e1, e2, doc_id, filename)
                    self._check_and_add_semantic(e2, e1, doc_id, filename)

    def _check_and_add_semantic(self, e1: Dict[str, Any], e2: Dict[str, Any], doc_id: str, doc_filename: str):
        id1, id2 = e1["mapped_id"], e2["mapped_id"]
        t1, t2 = e1["type"], e2["type"]
        
        if t1 == "equipment_tag" and t2 == "personnel":
            # (personnel)-[:MAINTAINS]->(equipment)
            self.add_relationship(id2, id1, "MAINTAINS", doc_id, doc_filename)
        elif t1 == "equipment_tag" and t2 == "process_parameter":
            # (equipment)-[:OPERATES_AT]->(parameter)
            self.add_relationship(id1, id2, "OPERATES_AT", doc_id, doc_filename)
        elif t1 == "equipment_tag" and t2 == "regulatory_ref":
            # (equipment)-[:SUBJECT_TO]->(regulation)
            self.add_relationship(id1, id2, "SUBJECT_TO", doc_id, doc_filename)
        elif t1 == "equipment_tag" and t2 == "failure_mode":
            # (equipment)-[:HAS_FAILURE]->(failure_mode)
            self.add_relationship(id1, id2, "HAS_FAILURE", doc_id, doc_filename)

    def search_entities(self, ent_type: str = None, search: str = None, limit: int = 50) -> List[Dict[str, Any]]:
        if self.use_neo4j:
            try:
                queries = []
                params = {}
                
                # Match query
                match_clause = "MATCH (e:Entity)"
                where_clauses = []
                
                if ent_type:
                    where_clauses.append("e.type = $ent_type")
                    params["ent_type"] = ent_type
                if search:
                    where_clauses.append("e.value CONTAINS $search")
                    params["search"] = search
                    
                where_clause = " WHERE " + " AND ".join(where_clauses) if where_clauses else ""
                
                # We need count of documents appearing in
                # and related entity values
                query = f"""
                {match_clause} {where_clause}
                OPTIONAL MATCH (d:Document)-[:CONTAINS]->(e)
                OPTIONAL MATCH (e)-[r:CO_OCCURS_IN]-(other:Entity)
                WITH e, count(distinct d) as doc_count, collect(distinct other.value)[0..5] as related
                RETURN e.entity_id as entity_id, e.type as type, e.value as value, doc_count, related
                LIMIT $limit
                """
                params["limit"] = limit
                
                with self.driver.session() as session:
                    result = session.run(query, **params)
                    return [
                        {
                            "entity_id": record["entity_id"] or str(hash(record["value"])),
                            "type": record["type"],
                            "value": record["value"],
                            "document_count": record["doc_count"],
                            "related_entities": record["related"]
                        } for record in result
                    ]
            except Exception as e:
                print(f"[ERROR] Neo4j search_entities error: {e}. Falling back to SQLite.")

        # SQLite Fallback
        conn = sqlite3.connect(self.sqlite_path)
        conn.row_factory = sqlite3.Row
        cursor = conn.cursor()
        
        where_clauses = ["label = 'Entity'"]
        params = []
        if ent_type:
            where_clauses.append("type = ?")
            params.append(ent_type)
        if search:
            where_clauses.append("value LIKE ?")
            params.append(f"%{search}%")
            
        where_str = " AND ".join(where_clauses)
        query = f"SELECT node_id, type, value FROM graph_nodes WHERE {where_str} LIMIT ?"
        params.append(limit)
        
        cursor.execute(query, tuple(params))
        rows = cursor.fetchall()
        
        enriched = []
        for row in rows:
            node_id = row["node_id"]
            
            # Count distinct documents
            cursor.execute("""
            SELECT COUNT(distinct doc_id) FROM graph_edges 
            WHERE target_id = ? AND type = 'CONTAINS'
            """, (node_id,))
            doc_count = cursor.fetchone()[0]
            
            # Get related entities (co-occurring)
            cursor.execute("""
            SELECT distinct gn.value FROM graph_edges ge
            JOIN graph_nodes gn ON (gn.node_id = ge.target_id OR gn.node_id = ge.source_id)
            WHERE (ge.source_id = ? OR ge.target_id = ?) AND ge.type = 'CO_OCCURS_IN' AND gn.node_id != ?
            LIMIT 5
            """, (node_id, node_id, node_id))
            related = [r[0] for r in cursor.fetchall()]
            
            enriched.append({
                "entity_id": node_id,
                "type": row["type"],
                "value": row["value"],
                "document_count": doc_count,
                "related_entities": related
            })
            
        conn.close()
        return enriched

    def get_entity_relationships(self, entity_id: str) -> Dict[str, Any]:
        if self.use_neo4j:
            try:
                # Retrieve entity
                q_entity = "MATCH (e:Entity {entity_id: $entity_id}) RETURN e.value as value, e.type as type"
                # Retrieve relationships
                q_rels = """
                MATCH (e1:Entity {entity_id: $entity_id})-[r]->(e2:Entity)
                RETURN type(r) as rel_type, e2.entity_id as target_id, e2.value as target_value, e2.type as target_type, r.doc_filename as doc_filename, r.doc_id as doc_id
                """
                with self.driver.session() as session:
                    ent_res = session.run(q_entity, entity_id=entity_id).single()
                    if ent_res:
                        rels_res = session.run(q_rels, entity_id=entity_id)
                        rels = [
                            {
                                "relationship_type": record["rel_type"],
                                "target_id": record["target_id"],
                                "target_value": record["target_value"],
                                "target_type": record["target_type"],
                                "doc_filename": record["doc_filename"] or "unknown",
                                "doc_id": record["doc_id"] or ""
                            } for record in rels_res
                        ]
                        return {
                            "entity_id": entity_id,
                            "value": ent_res["value"],
                            "type": ent_res["type"],
                            "relationships": rels
                        }
            except Exception as e:
                print(f"[ERROR] Neo4j get_entity_relationships error: {e}. Falling back to SQLite.")

        # SQLite Fallback
        conn = sqlite3.connect(self.sqlite_path)
        conn.row_factory = sqlite3.Row
        cursor = conn.cursor()
        
        cursor.execute("SELECT type, value FROM graph_nodes WHERE node_id = ?", (entity_id,))
        ent_row = cursor.fetchone()
        if not ent_row:
            conn.close()
            return {"entity_id": entity_id, "value": "Unknown", "type": "unknown", "relationships": []}
            
        # Get edges
        cursor.execute("""
        SELECT ge.type as rel_type, gn.node_id as target_id, gn.value as target_value, gn.type as target_type, ge.doc_filename, ge.doc_id
        FROM graph_edges ge
        JOIN graph_nodes gn ON gn.node_id = ge.target_id
        WHERE ge.source_id = ? AND ge.type != 'CONTAINS'
        """, (entity_id,))
        rows = cursor.fetchall()
        
        rels = [
            {
                "relationship_type": r["rel_type"],
                "target_id": r["target_id"],
                "target_value": r["target_value"],
                "target_type": r["target_type"],
                "doc_filename": r["doc_filename"] or "unknown",
                "doc_id": r["doc_id"] or ""
            } for r in rows
        ]
        
        result = {
            "entity_id": entity_id,
            "value": ent_row["value"],
            "type": ent_row["type"],
            "relationships": rels
        }
        conn.close()
        return result

    def get_full_graph(self, limit: int = 200) -> Dict[str, Any]:
        nodes_dict = {}
        links = []
        
        if self.use_neo4j:
            try:
                # Query docs and their relationships
                q_docs = """
                MATCH (d:Document)
                RETURN d.doc_id as id, d.filename as label, "document" as type
                LIMIT $limit
                """
                # Query entities
                q_ents = """
                MATCH (e:Entity)
                RETURN e.entity_id as id, e.value as label, e.type as type
                LIMIT $limit
                """
                # Query relationships
                q_rels = """
                MATCH (n)-[r]->(m)
                WHERE (n:Document OR n:Entity) AND (m:Document OR m:Entity)
                RETURN coalesce(n.entity_id, n.doc_id) as source, 
                       coalesce(m.entity_id, m.doc_id) as target, 
                       type(r) as type
                LIMIT $limit
                """
                with self.driver.session() as session:
                    docs_res = session.run(q_docs, limit=limit)
                    for rec in docs_res:
                        nodes_dict[rec["id"]] = {"id": rec["id"], "value": rec["label"], "type": rec["type"]}
                        
                    ents_res = session.run(q_ents, limit=limit)
                    for rec in ents_res:
                        nodes_dict[rec["id"]] = {"id": rec["id"], "value": rec["label"], "type": rec["type"]}
                        
                    rels_res = session.run(q_rels, limit=limit)
                    for rec in rels_res:
                        links.append({"source": rec["source"], "target": rec["target"], "type": rec["type"]})
                        
                return {"nodes": list(nodes_dict.values()), "links": links}
            except Exception as e:
                print(f"[ERROR] Neo4j get_full_graph error: {e}. Falling back to SQLite.")
                
        # SQLite fallback
        conn = sqlite3.connect(self.sqlite_path)
        conn.row_factory = sqlite3.Row
        cursor = conn.cursor()
        
        cursor.execute("SELECT node_id, label, type, value FROM graph_nodes LIMIT ?", (limit,))
        nodes_rows = cursor.fetchall()
        
        nodes = []
        for row in nodes_rows:
            nodes.append({
                "id": row["node_id"],
                "value": row["value"],
                "type": row["type"]
            })
            
        cursor.execute("SELECT source_id, target_id, type FROM graph_edges LIMIT ?", (limit,))
        edges_rows = cursor.fetchall()
        
        links = []
        for row in edges_rows:
            links.append({
                "source": row["source_id"],
                "target": row["target_id"],
                "type": row["type"]
            })
            
        conn.close()
        return {"nodes": nodes, "links": links}

# Singleton instance
graph_service = GraphService()
