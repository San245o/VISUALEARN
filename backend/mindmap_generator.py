"""Mindmap generation: uses Gemini to create structured mindmaps from document chunks."""
import os
import json
from typing import Dict, Any, Optional, List
from supabase import create_client
from google import genai
from dotenv import load_dotenv

load_dotenv()

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_ANON_KEY")
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")

supabase = create_client(SUPABASE_URL, SUPABASE_KEY)
gemini_client = genai.Client(api_key=GEMINI_API_KEY)

MINDMAP_SYSTEM_PROMPT = """You are an expert knowledge organizer and engineering professor. Given text content from a document, create an EXHAUSTIVE, deeply-nested mind map that serves as a complete study guide for a final-year engineering undergraduate.

CRITICAL DEPTH RULES — YOUR MAP MUST NOT BE SHALLOW:
1. Identify the MAIN TOPIC as the root node.
2. Create 6-12 major branches representing ALL key themes, chapters, sections, and distinct concept areas found in the document. Never merge unrelated topics.
3. THE MAP MUST HAVE GENUINE DEPTH. This is the most important rule:
   - Level 1: Major themes/chapters (6-12 branches)
   - Level 2: Core subtopics within each theme (3-6 per branch)
   - Level 3: Specific concepts, techniques, definitions (2-5 per subtopic)
   - Level 4: Individual formulas, algorithms, properties, constraints, or methods (1-4 per concept)
   - Level 5+: Concrete examples, worked problems, edge cases, real-world applications, numerical values (where the document provides them)
   - Most major branches MUST reach at least level 4. Complex branches should reach level 5 or 6.
4. EXHAUSTIVE COVERAGE — capture EVERYTHING the document discusses:
   - Every named definition, term, or concept → its own node
   - Every formula or equation → its own node with the formula in the description
   - Every algorithm or procedure → its own node with steps
   - Every diagram, table, or figure reference → its own node
   - Every example or case study → its own node
   - Every comparison (A vs B) → its own node
   - Every list of properties/characteristics → each property gets its own child node
   - Every caveat, limitation, or assumption → its own node
5. Do NOT create generic placeholder nodes. Every node must contain SPECIFIC information from the document.
6. Each node MUST have:
   - "id": A unique string identifier (e.g., "root", "b1", "b1_1", "b1_1_1", "b1_1_1_1", etc.).
   - "label": A concise name (2-5 words, noun phrases preferred). Be specific, not generic.
   - "description": A clear, informative 2-4 sentence explanation targeted at an engineering undergrad. Include specific facts, simple equations (where relevant), definitions, examples, or constraints directly from the document. Write as if explaining to a smart student, not a researcher.
   - "children": An array of nested child nodes (empty array [] ONLY for leaf nodes).
7. QUALITY CHECK: Before finalizing, verify that:
   - At least 3 branches reach depth level 4+
   - Total node count is at least 40 for a medium document, 80+ for a large one
   - No section of the document is left unrepresented
   - Descriptions are specific (contain actual content, not "this topic covers...")
8. Return ONLY valid JSON, with no markdown code blocks or backticks.

OUTPUT FORMAT SCHEMA:
{
  "title": "Document Main Topic",
  "root": {
    "id": "root",
    "label": "Main Topic",
    "description": "Overview description of the entire document.",
    "children": [
      {
        "id": "b1",
        "label": "Major Theme 1",
        "description": "Description of this major theme...",
        "children": [
          {
            "id": "b1_1",
            "label": "Subtopic A",
            "description": "Description of subtopic A...",
            "children": [
              {
                "id": "b1_1_1",
                "label": "Specific Concept X",
                "description": "Detailed explanation...",
                "children": [
                  {
                    "id": "b1_1_1_1",
                    "label": "Formula / Property",
                    "description": "The specific formula or property...",
                    "children": [
                      {
                        "id": "b1_1_1_1_1",
                        "label": "Example / Application",
                        "description": "A concrete example demonstrating this...",
                        "children": []
                      }
                    ]
                  }
                ]
              }
            ]
          },
          {
            "id": "b1_2",
            "label": "Subtopic B",
            "description": "Description of subtopic B...",
            "children": []
          }
        ]
      }
    ]
  }
}"""


def build_coverage_context(chunks: List[Dict[str, Any]], max_chars: int = 300000) -> str:
    """Preserve coverage across the whole PDF instead of truncating from the front."""
    indexed = [
        f"[Chunk {idx + 1}/{len(chunks)}]\n{chunk['content'].strip()}"
        for idx, chunk in enumerate(chunks)
        if chunk.get("content")
    ]
    full_text = "\n\n".join(indexed)
    if len(full_text) <= max_chars:
        return full_text

    per_chunk_budget = max(600, max_chars // max(1, len(indexed)))
    sampled = []
    for item in indexed:
        if len(item) <= per_chunk_budget:
            sampled.append(item)
        else:
            head_budget = int(per_chunk_budget * 0.68)
            tail_budget = per_chunk_budget - head_budget
            sampled.append(item[:head_budget] + "\n[... middle omitted for context budget ...]\n" + item[-tail_budget:])

    return "\n\n".join(sampled)[:max_chars] + "\n\n[Context sampled across all chunks to preserve topic coverage.]"

async def generate_mindmap(document_id: str) -> Dict[str, Any]:
    """Generate a mindmap from document chunks using Gemini."""
    # Check for existing mindmap
    existing = supabase.table("mindmaps") \
        .select("*") \
        .eq("document_id", document_id) \
        .execute()
    
    if existing.data:
        return existing.data[0]
    
    # Get document chunks
    chunks_result = supabase.table("document_chunks") \
        .select("content") \
        .eq("document_id", document_id) \
        .order("chunk_index") \
        .execute()
    
    if not chunks_result.data:
        raise ValueError("No chunks found for this document.")
    
    all_text = build_coverage_context(chunks_result.data)
    total_chars = sum(len(c["content"]) for c in chunks_result.data)
    
    # ── Tailor prompts dynamically based on document size ──────────────────
    if total_chars < 6000:
        # Micro/Short document (e.g. 1-2 pages)
        size_label = "Short Document (Micro)"
        size_guidelines = (
            "CRITICAL: The source document is very short (under 2 pages). "
            "To prevent hallucination, the mind map MUST be strictly limited to the text. "
            "DO NOT invent extra sub-topics, chapters, or details not directly present. "
            "Keep the mind map simple and relatively shallow (limit to 2 or 3 levels maximum: root -> main point -> specific detail). "
            "Target a concise and highly accurate map of 8 to 20 total nodes. Focus on zero-hallucination."
        )
        sys_depth_rule = (
            "The source text is short. Keep depth to 2-3 levels maximum. "
            "DO NOT extrapolate or hallucinate topics outside the text."
        )
    elif total_chars < 25000:
        # Medium document (e.g. 3-10 pages)
        size_label = "Medium Document"
        size_guidelines = (
            "Create a well-balanced, high-coverage mind map of this medium document. "
            "Go into moderate detail (3 to 4 levels of nesting: root -> theme -> subtopic -> detail). "
            "Cover all major definitions, formulas, and concepts present in the text. "
            "Target around 25 to 45 total nodes. Stay strictly faithful to the source material."
        )
        sys_depth_rule = (
            "The source text is medium. Branch to 3-4 levels of nesting where logical. "
            "Cover all main themes and their primary components."
        )
    else:
        # Large/Comprehensive document (e.g. 10+ pages)
        size_label = "Large/Comprehensive Document"
        size_guidelines = (
            "Create an EXHAUSTIVE, highly granular mind map covering all sections of this comprehensive document. "
            "Go DEEP — most branches must reach 4+ levels of nesting (root -> theme -> subtopic -> concept -> formula/example). "
            "Aim for a rich syllabus containing at least 50 to 100 total nodes. "
            "Do not collapse unrelated sections; map every formula, algorithm, and comparison."
        )
        sys_depth_rule = (
            "The source text is large. Go DEEP (4-6 levels of nesting). "
            "Aim for exhaustive, syllabus-grade coverage with 50-100+ nodes."
        )

    # Ingest the dynamic instruction into system prompt
    custom_system_prompt = MINDMAP_SYSTEM_PROMPT.replace(
        "CRITICAL DEPTH RULES — YOUR MAP MUST NOT BE SHALLOW:",
        f"CRITICAL DEPTH RULES (TAILORED FOR {size_label.upper()}):\n1. {sys_depth_rule}"
    )

    # Generate mindmap with Gemini
    response = gemini_client.models.generate_content(
        model="gemma-4-31b-it",
        contents=(
            f"Create a structured mind map from this {size_label}.\n\n"
            f"SIZE GUIDELINES:\n{size_guidelines}\n\n"
            "Use the chunk markers to cover the text content from start to finish:\n\n"
            f"{all_text}"
        ),
        config={
            'system_instruction': custom_system_prompt,
            'response_mime_type': 'application/json',
        }
    )
    
    # Parse the response
    mindmap_json = json.loads(response.text)
    
    # Store in database
    result = supabase.table("mindmaps").insert({
        "document_id": document_id,
        "mindmap_data": mindmap_json,
    }).execute()
    
    return result.data[0]


async def generate_node_description(node_label: str, node_description: str, document_id: str) -> str:
    """Generate a detailed description for a mindmap node using relevant chunks."""
    # Get relevant chunks via simple text matching (since we have embeddings too)
    chunks_result = supabase.table("document_chunks") \
        .select("content") \
        .eq("document_id", document_id) \
        .execute()
    
    # Find most relevant chunks by simple keyword matching
    relevant = []
    keywords = node_label.lower().split()
    for chunk in chunks_result.data:
        score = sum(1 for kw in keywords if kw in chunk["content"].lower())
        if score > 0:
            relevant.append((score, chunk["content"]))
    
    relevant.sort(key=lambda x: x[0], reverse=True)
    context = "\n\n".join([c[1] for c in relevant[:5]])
    
    if not context:
        context = "\n\n".join([c["content"] for c in chunks_result.data[:3]])
    
    response = gemini_client.models.generate_content(
        model="gemma-4-31b-it",
        contents=f"Topic: {node_label}\nBrief: {node_description}\n\nRelevant context from source:\n{context}",
        config={
            'system_instruction': (
                "You are an expert engineering professor writing clear explanations for final-year undergraduate students. "
                "Your explanations should be at TEXTBOOK level — clear, practical, and visual in thinking.\n\n"
                "CONTENT GUIDELINES:\n"
                "- Write as if explaining to a smart engineering student, not a PhD researcher.\n"
                "- Start with a clear, intuitive definition in plain English.\n"
                "- Explain WHY this concept matters and WHERE it is used in practice.\n"
                "- Include only the KEY formula(s) — at most 1-2 essential equations. Do NOT include lengthy derivations or proofs.\n"
                "- For each formula, explain what each variable means in simple terms.\n"
                "- Use a simple numerical example to make the concept concrete (plug in easy numbers).\n"
                "- Describe how you would VISUALIZE this concept: what diagram, flowchart, or block diagram would help? Describe the visual layout.\n"
                "- Mention real-world applications or engineering use cases.\n\n"
                "FORMATTING:\n"
                "- Use markdown with short, scannable sections and headers.\n"
                "- Use LaTeX sparingly: `$F=ma$` for inline, `$$E=mc^2$$` for display.\n"
                "- Use bullet points for lists of properties or steps.\n"
                "- Keep the total length moderate — roughly 200-400 words. Don't write an essay.\n"
                "- Stay faithful to the source context."
            ),
        }
    )
    
    return response.text
