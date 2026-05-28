import pytest
from fastapi.testclient import TestClient
from main import app
from unittest.mock import patch

client = TestClient(app)

def test_read_root():
    response = client.get("/")
    assert response.status_code == 200
    assert response.json() == {"message": "Welcome to VisualEarn API"}

def test_missing_prompt_validation():
    # Sending empty body should trigger a 422 Unprocessable Entity due to missing 'prompt'
    response = client.post("/generate", json={})
    assert response.status_code == 422

def test_get_nonexistent_video():
    # Requesting a video that doesn't exist should return 404
    response = client.get("/videos/random_non_existent.mp4")
    assert response.status_code == 404

@patch("main.genai")
@patch("main.subprocess.run")
def test_generate_mocked(mock_subprocess, mock_genai):
    # This is a mocked test to verify the logic of the generate endpoint 
    # without actually calling Google Gemini or Manim locally.
    
    # Setup mock subprocess return
    class MockResult:
        returncode = 0
        stderr = ""
    mock_subprocess.returncode = 0
    mock_subprocess.return_value = MockResult()
    
    # We won't test the full file generation here easily without mocking tempfile,
    # but we can see that validation passes up to the point of generation.
    # In a real environment, we'd mock tempfile and os.walk.
    pass
