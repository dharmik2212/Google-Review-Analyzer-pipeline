"""
Google Review Analyzer — FastAPI Backend
Proxies SerpAPI for Google Maps search/reviews and runs Hugging Face sentiment analysis.
"""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

try:
    # Works when started from project root: backend.main:app
    from backend.api.search import router as search_router
    from backend.api.reviews import router as reviews_router
except ModuleNotFoundError:
    # Works when started from backend folder: main:app
    from api.search import router as search_router
    from api.reviews import router as reviews_router

app = FastAPI(
    title="Google Review Analyzer",
    description="Search businesses, fetch Google reviews, and analyze sentiment",
    version="1.0.0",
)

# CORS — allow frontend dev server and production deployments (e.g. Netlify)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(search_router, prefix="/api")
app.include_router(reviews_router, prefix="/api")

@app.get("/")
async def root():
    return {"message": "Google Review Analyzer API is running"}