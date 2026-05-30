"""PDF processing: extract text, chunk, generate embeddings, store in Supabase."""
import os
import uuid
import io
import re
from typing import List, Dict, Any
from PyPDF2 import PdfReader
from supabase import create_client
from google import genai
from dotenv import load_dotenv

load_dotenv()

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_ANON_KEY")
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")

supabase = create_client(SUPABASE_URL, SUPABASE_KEY)
gemini_client = genai.Client(api_key=GEMINI_API_KEY)

CHUNK_SIZE = 1500  # characters per chunk
CHUNK_OVERLAP = 200


def extract_text_from_pdf(pdf_bytes: bytes) -> str:
    """Extract all text from a PDF file."""
    reader = PdfReader(io.BytesIO(pdf_bytes))
    text = ""
    for page in reader.pages:
        page_text = page.extract_text()
        if page_text:
            text += page_text + "\n\n"
    return text.strip()


def get_page_count(pdf_bytes: bytes) -> int:
    reader = PdfReader(io.BytesIO(pdf_bytes))
    return len(reader.pages)


from langchain_text_splitters import RecursiveCharacterTextSplitter

def chunk_text(text: str, chunk_size: int = CHUNK_SIZE, overlap: int = CHUNK_OVERLAP) -> List[str]:
    """Split text into overlapping chunks using LangChain's RecursiveCharacterTextSplitter."""
    # Clean up whitespace
    text = re.sub(r'\n{3,}', '\n\n', text)
    
    splitter = RecursiveCharacterTextSplitter(
        chunk_size=chunk_size,
        chunk_overlap=overlap,
        length_function=len,
        separators=["\n\n", "\n", " ", ""]
    )
    
    return splitter.split_text(text)


from google.genai import types


def get_embeddings_batch(texts: List[str]) -> List[List[float]]:
    """Generate embeddings in batch using Gemini gemini-embedding-001."""
    if not texts:
        return []
    try:
        result = gemini_client.models.embed_content(
            model="gemini-embedding-001",
            contents=texts,
            config=types.EmbedContentConfig(output_dimensionality=768)
        )
        return [emb.values[:768] for emb in result.embeddings]
    except Exception as e:
        print(f"Batch embedding generation failed: {e}")
        # Return empty lists as fallbacks
        return [[] for _ in texts]


async def process_pdf(filename: str, pdf_bytes: bytes) -> Dict[str, Any]:
    """Full pipeline: upload PDF, extract text, chunk, embed, store."""
    # 1. Upload PDF to Supabase Storage
    storage_path = f"uploads/{uuid.uuid4().hex}_{filename}"
    supabase.storage.from_("pdfs").upload(
        storage_path, pdf_bytes, {"content-type": "application/pdf"}
    )
    
    # 2. Extract text and page count
    text = extract_text_from_pdf(pdf_bytes)
    page_count = get_page_count(pdf_bytes)
    
    if not text.strip():
        raise ValueError("No text could be extracted from this PDF.")
    
    # 3. Create document record
    doc_result = supabase.table("documents").insert({
        "filename": filename,
        "storage_path": storage_path,
        "page_count": page_count,
    }).execute()
    
    doc_id = doc_result.data[0]["id"]
    
    # 4. Chunk text
    chunks = chunk_text(text)
    
    # 5. Generate embeddings in batch and store chunks
    batch_size = 100
    all_embeddings = []
    
    for start_idx in range(0, len(chunks), batch_size):
        chunk_batch = chunks[start_idx:start_idx + batch_size]
        batch_embeddings = get_embeddings_batch(chunk_batch)
        all_embeddings.extend(batch_embeddings)
        
    chunk_records = []
    for i, chunk in enumerate(chunks):
        embedding = all_embeddings[i] if i < len(all_embeddings) else None
        record = {
            "document_id": doc_id,
            "content": chunk,
            "chunk_index": i,
        }
        if embedding:
            record["embedding"] = embedding
        chunk_records.append(record)
    
    # Batch insert chunks
    if chunk_records:
        supabase.table("document_chunks").insert(chunk_records).execute()
    
    # Update document with chunk count
    supabase.table("documents").update(
        {"total_chunks": len(chunk_records)}
    ).eq("id", doc_id).execute()
    
    return {
        "document_id": doc_id,
        "filename": filename,
        "page_count": page_count,
        "total_chunks": len(chunk_records),
        "storage_path": storage_path,
    }
