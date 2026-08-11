"""
Reviews Endpoint — fetches 50 latest Google Maps reviews via Apify Actor
kaix/google-maps-reviews-scraper and performs sentiment analysis using
cardiffnlp/twitter-roberta-base-sentiment-latest model.
"""

from urllib.parse import quote_plus
import time
from fastapi import APIRouter, HTTPException, Path, Query
import httpx
import logging

try:
    from backend.config import SERPAPI_KEY, APIFY_TOKEN
    from backend.services.sentiment import analyze_reviews
except ModuleNotFoundError:
    from config import SERPAPI_KEY, APIFY_TOKEN
    from services.sentiment import analyze_reviews

logger = logging.getLogger(__name__)

router = APIRouter()

# Actor kaix/google-maps-reviews-scraper
APIFY_KAIX_ACTOR_URL = "https://api.apify.com/v2/acts/kaix~google-maps-reviews-scraper/run-sync-get-dataset-items"
SERPAPI_BASE = "https://serpapi.com/search.json"

_REVIEWS_CACHE = {}
_CACHE_TTL_SECONDS = 3600  # 1 hour cache


async def _fetch_and_analyze_reviews(data_id: str, limit: int = 50, sort_by: str = "newest"):
    if not data_id or not str(data_id).strip():
        raise HTTPException(status_code=400, detail="Invalid data_id provided")

    data_id = str(data_id).strip()
    max_target = min(limit, 50)
    cache_key = f"{data_id}|{max_target}|{sort_by}"
    now = time.time()
    if cache_key in _REVIEWS_CACHE:
        cached_item, timestamp = _REVIEWS_CACHE[cache_key]
        if now - timestamp < _CACHE_TTL_SECONDS:
            logger.info("Returning cached reviews for: %s (0.01s speed)", data_id)
            return cached_item

    raw_reviews = []
    place_name = data_id
    place_address = "Google Maps Location"
    place_rating = 0.0
    place_total_reviews = 0
    # Strategy 1: Ultra-Fast Direct Fetching via SerpAPI (1-2s speed)
    if SERPAPI_KEY and SERPAPI_KEY != "your_serpapi_key_here":
        try:
            fetch_engine = "SerpAPI Direct Fetch"
            logger.info("Fetching reviews via SerpAPI for: %s", data_id)
            seen_ids = set()
            next_page_token = None
            page = 0

            async with httpx.AsyncClient(timeout=15.0) as client:
                while page < 5 and len(raw_reviews) < max_target:
                    params = {
                        "engine": "google_maps_reviews",
                        "api_key": SERPAPI_KEY,
                        "sort_by": "newestFirst",
                    }
                    if data_id.startswith("0x") or ":" in data_id:
                        params["data_id"] = data_id
                    else:
                        params["q"] = data_id

                    if next_page_token:
                        params["next_page_token"] = next_page_token

                    resp = await client.get(SERPAPI_BASE, params=params)
                    if resp.status_code != 200:
                        break

                    data = resp.json()
                    if page == 0:
                        pinfo = data.get("place_info", {})
                        place_name = pinfo.get("title") or place_name
                        place_address = pinfo.get("address") or place_address
                        place_rating = float(pinfo.get("rating") or 0.0)
                        place_total_reviews = int(pinfo.get("reviews") or 0)

                    page_revs = data.get("reviews", [])
                    if not page_revs:
                        break

                    for r in page_revs:
                        author = r.get("user", {}).get("name", "Anonymous")
                        snippet = r.get("snippet", r.get("extracted_snippet", {}).get("original", ""))
                        date_str = r.get("date", "")
                        fp = f"{author}|{snippet[:40]}|{date_str}"
                        if fp not in seen_ids:
                            seen_ids.add(fp)
                            raw_reviews.append(
                                {
                                    "author": author,
                                    "author_image": r.get("user", {}).get("thumbnail", ""),
                                    "rating": float(r.get("rating", 0.0)),
                                    "text": snippet,
                                    "date": date_str,
                                    "likes": int(r.get("likes", 0)),
                                }
                            )
                            if len(raw_reviews) >= max_target:
                                break

                    serp_pag = data.get("serpapi_pagination", {})
                    next_page_token = serp_pag.get("next_page_token")
                    if not next_page_token:
                        break
                    page += 1
        except Exception as e:
            logger.warning("SerpAPI fetch error, falling back to Apify: %s", e)

    # Strategy 2: Apify Actor kaix/google-maps-reviews-scraper if SerpAPI returned no reviews
    if not raw_reviews and APIFY_TOKEN and APIFY_TOKEN != "your_apify_token_here":
        fetch_engine = "Apify Actor (kaix/google-maps-reviews-scraper)"
        url = f"{APIFY_KAIX_ACTOR_URL}?token={APIFY_TOKEN}"

        if data_id.startswith("http://") or data_id.startswith("https://"):
            query_url = data_id
        else:
            query_url = f"https://www.google.com/maps/search/?api=1&query={quote_plus(data_id)}"

        payload = {
            "startUrls": [{"url": query_url}],
            "searchStringsArray": [data_id],
            "maxReviews": max_target,
            "reviewsSort": "newest",
            "sort": "newest",
        }

        try:
            logger.info("Fetching reviews via kaix/google-maps-reviews-scraper for: %s", data_id)
            # Use 25s timeout to stay within Render's 30s connection limit
            async with httpx.AsyncClient(timeout=25.0) as client:
                response = await client.post(url, json=payload)
                if response.status_code == 200:
                    items = response.json()
                    if isinstance(items, list):
                        seen_texts = set()
                        for item in items:
                            if not place_address or place_address == "Google Maps Location":
                                place_name = item.get("placeTitle") or item.get("title") or item.get("name") or place_name
                                place_address = item.get("placeAddress") or item.get("address") or place_address
                                place_rating = float(item.get("placeRating") or item.get("totalScore") or item.get("rating") or 0.0)
                                place_total_reviews = int(item.get("reviewsCount") or item.get("totalReviews") or 50)

                            review_text = (
                                item.get("reviewText")
                                or item.get("text")
                                or item.get("snippet")
                                or item.get("comment")
                                or ""
                            ).strip()

                            fp = review_text[:60] if review_text else item.get("reviewerName", "Anon")
                            if fp in seen_texts:
                                continue
                            seen_texts.add(fp)

                            raw_reviews.append(
                                {
                                    "author": item.get("reviewerName") or item.get("name") or "Anonymous",
                                    "author_image": item.get("reviewerPhoto") or "",
                                    "rating": float(item.get("stars") or item.get("rating") or 0.0),
                                    "text": review_text,
                                    "date": item.get("publishedAtDate") or item.get("date") or "Recent",
                                    "likes": int(item.get("likesCount") or 0),
                                }
                            )
                            if len(raw_reviews) >= max_target:
                                break
        except Exception as e:
            logger.warning("Apify Actor kaix/google-maps-reviews-scraper error: %s", e)

    if not raw_reviews:
        if not APIFY_TOKEN or APIFY_TOKEN == "your_apify_token_here":
            raise HTTPException(
                status_code=500,
                detail="Apify API Token not configured. Please add APIFY_TOKEN=your_token to your .env file.",
            )

    # Run sentiment analysis on the 50 latest reviews using cardiffnlp/twitter-roberta-base-sentiment-latest
    analysis = await analyze_reviews(raw_reviews[:50])

    result_payload = {
        "place_info": {
            "name": place_name,
            "address": place_address,
            "rating": place_rating,
            "total_reviews": max(place_total_reviews, len(raw_reviews)),
        },
        "reviews": analysis["reviews"],
        "summary": analysis["summary"],
        "pagination": {
            "analyzed_reviews": len(raw_reviews),
            "total_google_reviews": max(place_total_reviews, len(raw_reviews)),
            "strategy": fetch_engine,
            "model": "cardiffnlp/twitter-roberta-base-sentiment-latest",
        },
    }

    _REVIEWS_CACHE[cache_key] = (result_payload, now)
    return result_payload


@router.get("/reviews")
async def get_reviews_query(
    data_id: str = Query(None, description="Place name, ID, or Google Maps URL"),
    q: str = Query(None, description="Alternative query param for place name"),
    limit: int = Query(50, ge=1, le=100, description="Max reviews to fetch (default: 50 latest)"),
    sort_by: str = Query("newest", description="Sort order: newest"),
):
    """Fetch 50 latest Google Maps reviews via query parameter (/reviews?data_id=...)."""
    target = data_id or q
    if not target:
        raise HTTPException(status_code=400, detail="Invalid data_id provided")
    return await _fetch_and_analyze_reviews(target, limit, sort_by)


@router.get("/reviews/{data_id:path}")
async def get_reviews_path(
    data_id: str,
    limit: int = Query(50, ge=1, le=100, description="Max reviews to fetch (default: 50 latest)"),
    sort_by: str = Query("newest", description="Sort order: newest"),
):
    """Fetch 50 latest Google Maps reviews via path parameter (/reviews/{data_id})."""
    if not data_id:
        raise HTTPException(status_code=400, detail="Invalid data_id provided")
    return await _fetch_and_analyze_reviews(data_id, limit, sort_by)
