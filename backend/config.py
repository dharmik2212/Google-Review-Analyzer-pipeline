import os
from pathlib import Path
from dotenv import load_dotenv

# Explicitly load .env from project root directory
root_dir = Path(__file__).resolve().parent.parent
env_file = root_dir / ".env"

if env_file.exists():
    load_dotenv(dotenv_path=env_file)
else:
    load_dotenv()

# SerpAPI key for fast direct fetching (1.8s speed)
SERPAPI_KEY = os.getenv("SERPAPI_KEY")

# Apify Token for api-ninja/google-maps-reviews-scraper actor
APIFY_TOKEN = (
    os.getenv("APIFY_TOKEN")
    or os.getenv("APIFY_API_TOKEN")
    or os.getenv("APIFY_KEY")
    or os.getenv("APIFY_API_KEY")
)

# Hugging Face Inference API token for cardiffnlp/twitter-roberta-base-sentiment-latest
HF_API_KEY = os.getenv("HF_API_KEY")