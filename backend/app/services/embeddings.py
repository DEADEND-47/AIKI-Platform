import httpx
import hashlib
import random
import numpy as np
from typing import List

def generate_mock_embedding(text: str, dimension: int = 768) -> List[float]:
    """Generates a deterministic mock embedding for offline testing."""
    # Use MD5 hash of text as seed
    hasher = hashlib.md5(text.encode('utf-8'))
    seed = int(hasher.hexdigest(), 16) % (2**32)
    
    # Seed local random generator for determinism
    rng = np.random.default_rng(seed)
    vector = rng.standard_normal(dimension)
    
    # Normalize to unit length (Cosine similarity)
    norm = np.linalg.norm(vector)
    if norm > 0:
        vector = vector / norm
        
    return vector.tolist()

async def embed_texts(texts: List[str], api_key: str, batch_size: int = 50) -> List[List[float]]:
    if not api_key or api_key.strip() == "":
        print("[WARNING] JINA_API_KEY is not set. Using local mock embeddings.")
        return [generate_mock_embedding(text) for text in texts]
        
    all_embeddings = []
    import asyncio
    
    try:
        for i in range(0, len(texts), batch_size):
            batch = texts[i:i + batch_size]
            
            async with httpx.AsyncClient(timeout=30.0) as client:
                response = await client.post(
                    "https://api.jina.ai/v1/embeddings",
                    headers={
                        "Authorization": f"Bearer {api_key}",
                        "Content-Type": "application/json"
                    },
                    json={
                        "model": "jina-embeddings-v2-base-en",
                        "input": batch
                    }
                )
                
                if response.status_code == 429:
                    print("[WARNING] Jina AI API rate limited (429). Retrying after 2s...")
                    await asyncio.sleep(2.0)
                    response = await client.post(
                        "https://api.jina.ai/v1/embeddings",
                        headers={
                            "Authorization": f"Bearer {api_key}",
                            "Content-Type": "application/json"
                        },
                        json={
                            "model": "jina-embeddings-v2-base-en",
                            "input": batch
                        }
                    )
                
                if response.status_code == 200:
                    data = response.json()
                    batch_embeddings = [item["embedding"] for item in data["data"]]
                    all_embeddings.extend(batch_embeddings)
                else:
                    print(f"[WARNING] Jina AI Embeddings API returned status {response.status_code}. Using local mock embeddings for this batch.")
                    all_embeddings.extend([generate_mock_embedding(text) for text in batch])
                    
            # Small delay between batches to be rate-limit friendly
            if i + batch_size < len(texts):
                await asyncio.sleep(0.5)
                
        return all_embeddings
    except Exception as e:
        print(f"[WARNING] Exception during Jina AI Embeddings API call: {e}. Using local mock embeddings.")
        remaining_count = len(texts) - len(all_embeddings)
        if remaining_count > 0:
            remaining_texts = texts[len(all_embeddings):]
            all_embeddings.extend([generate_mock_embedding(text) for text in remaining_texts])
        return all_embeddings
