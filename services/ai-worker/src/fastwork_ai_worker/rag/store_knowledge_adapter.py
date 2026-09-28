"""Store Knowledge Adapter for RAG Index Building

Adapts store_knowledge table to the format expected by IndexBuilder.
Converts store_knowledge entries to knowledge_entries format for unified indexing.
"""
from typing import List, Dict, Any, Optional
import json


class StoreKnowledgeAdapter:
    """Adapts store_knowledge to knowledge_entries format for RAG indexing"""
    
    def __init__(self, conn):
        """
        Args:
            conn: SQLite database connection
        """
        self.conn = conn
    
    def fetch_store_knowledge(self, merchant_id: Optional[str] = None) -> List[Dict[str, Any]]:
        """Fetch store_knowledge entries and convert to knowledge_entries format
        
        Args:
            merchant_id: Optional merchant filter
            
        Returns:
            List of entries in knowledge_entries format
        """
        query = """
            SELECT 
                id,
                merchant_id,
                store_id,
                knowledge_type,
                title,
                content,
                tags,
                source,
                status,
                created_at,
                updated_at
            FROM store_knowledge
            WHERE status = 'ACTIVE'
        """
        params = []
        
        if merchant_id:
            query += " AND merchant_id = ?"
            params.append(merchant_id)
        
        query += " ORDER BY updated_at DESC"
        
        cursor = self.conn.execute(query, params)
        rows = cursor.fetchall()
        
        # Convert to knowledge_entries format
        entries = []
        for row in rows:
            entry = self._convert_to_knowledge_entry(row)
            entries.append(entry)
        
        return entries
    
    def _convert_to_knowledge_entry(self, row) -> Dict[str, Any]:
        """Convert a store_knowledge row to knowledge_entries format
        
        Mapping:
        - question = title + "：" + content (for embedding)
        - answer = content (for retrieval display)
        - product_id = "STORE_RULE" (special marker)
        - knowledge_type = "STORE_RULE"
        - store_knowledge_type = original knowledge_type (SHIPPING_TIME, etc.)
        """
        row_dict = dict(row)
        
        # Build embedding text: title + content
        title = row_dict.get('title', '')
        content = row_dict.get('content', '')
        question = f"{title}：{content}" if title else content
        
        # Parse tags JSON
        tags_json = row_dict.get('tags', '[]')
        try:
            tags = json.loads(tags_json) if isinstance(tags_json, str) else tags_json
        except json.JSONDecodeError:
            tags = []
        
        return {
            'id': row_dict['id'],
            'question': question,  # For embedding
            'answer': content,      # For display
            'product_id': 'STORE_RULE',  # Special marker
            'knowledge_type': 'STORE_RULE',
            'store_knowledge_type': row_dict.get('knowledge_type'),
            'merchant_id': row_dict.get('merchant_id'),
            'store_id': row_dict.get('store_id'),
            'tags': tags,
            'source': row_dict.get('source', 'merchant'),
            'trust_level': 'HUMAN_CONFIRMED',  # Store knowledge is merchant-confirmed
            'created_at': row_dict.get('created_at'),
            'updated_at': row_dict.get('updated_at'),
        }
