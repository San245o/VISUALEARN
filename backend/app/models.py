"""
Pydantic request/response models used across routes.
"""

from typing import Optional
from pydantic import BaseModel


class PromptRequest(BaseModel):
    prompt: str
    model: Optional[str] = None


class NodeVideoRequest(BaseModel):
    node_id: str
    node_label: str
    node_description: str
    document_id: str
    mindmap_id: str
    model: Optional[str] = None
    force: Optional[bool] = False


class NodeDescriptionRequest(BaseModel):
    node_id: str
    node_label: str
    node_description: str
    document_id: str
    mindmap_id: str


class AskPdfRequest(BaseModel):
    document_id: str
    question: str
    model: str = "gemini-3.5-flash"
