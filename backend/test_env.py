import os
from dotenv import load_dotenv
load_dotenv()
print("KEY:", f"'{os.getenv('GEMINI_API_KEY')}'")
