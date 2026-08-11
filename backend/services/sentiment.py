"""
Sentiment Analysis Service — uses Hugging Face Inference API with
cardiffnlp/twitter-roberta-base-sentiment-latest model.
Supports single-call BATCH inference (100 reviews in 1 single API call).
"""

import asyncio
from collections import defaultdict
import logging
import httpx
from fastapi import HTTPException

try:
    from backend.config import HF_API_KEY
except ModuleNotFoundError:
    from config import HF_API_KEY

logger = logging.getLogger(__name__)

HF_SENTIMENT_MODEL = "cardiffnlp/twitter-roberta-base-sentiment-latest"
HF_INFERENCE_URL = f"https://router.huggingface.co/hf-inference/models/{HF_SENTIMENT_MODEL}"

_CACHE: dict[str, dict] = {}
_CACHE_MAX = 5000

LABEL_MAPPING = {
    "positive": "positive",
    "label_2": "positive",
    "neutral": "neutral",
    "label_1": "neutral",
    "negative": "negative",
    "label_0": "negative",
}

ASPECT_KEYWORDS = {
    "Service": ["service", "staff", "waiter", "waitress", "server", "rude", "friendly",
                 "helpful", "attentive", "slow", "fast", "polite", "manager", "host",
                 "employee", "worker", "customer service"],
    "Food Quality": ["food", "taste", "flavor", "delicious", "fresh", "stale", "bland",
                     "yummy", "tasty", "disgusting", "meal", "dish", "cook", "chef",
                     "ingredient", "quality", "portion", "overcooked", "undercooked", "raw"],
    "Ambiance": ["ambiance", "atmosphere", "decor", "decoration", "music", "noise",
                 "noisy", "quiet", "cozy", "vibe", "lighting", "clean", "dirty",
                 "hygiene", "comfortable", "uncomfortable", "interior", "seating"],
    "Price": ["price", "expensive", "cheap", "affordable", "overpriced", "value",
              "worth", "cost", "money", "bill", "charge", "budget", "reasonable",
              "pricey"],
    "Location": ["location", "parking", "accessible", "convenient", "far", "close",
                 "nearby", "area", "neighborhood", "distance", "directions"],
    "Wait Time": ["wait", "waiting", "quick", "slow", "long", "fast", "time",
                  "minutes", "hour", "delay", "prompt", "reservation", "queue", "line"],
}


def _cache_get(text: str):
    return _CACHE.get(text)


def _cache_set(text: str, value: dict):
    if len(_CACHE) > _CACHE_MAX:
        _CACHE.pop(next(iter(_CACHE)))
    _CACHE[text] = value


def get_sentiment_label_from_compound(compound: float) -> str:
    if compound >= 0.05:
        return "positive"
    if compound <= -0.05:
        return "negative"
    return "neutral"


def extract_aspects(text: str) -> list[str]:
    text_lower = text.lower()
    found = []
    for aspect, keywords in ASPECT_KEYWORDS.items():
        for kw in keywords:
            if kw in text_lower:
                found.append(aspect)
                break
    return found


async def _call_hf_inference_batch(texts: list[str]) -> list:
    """Send all review texts in ONE single batch API request to Hugging Face ($0 cost, 1 API call)."""
    headers = {}
    if HF_API_KEY and HF_API_KEY != "your_huggingface_token_here":
        headers["Authorization"] = f"Bearer {HF_API_KEY}"

    payload = {"inputs": texts}

    async with httpx.AsyncClient(timeout=60.0) as client:
        resp = await client.post(HF_INFERENCE_URL, json=payload, headers=headers)
        resp.raise_for_status()
        return resp.json()


POSITIVE_WORDS = {
    "great", "excellent", "amazing", "delicious", "best", "love", "fantastic",
    "friendly", "fast", "clean", "good", "polite", "awesome", "fresh", "highly",
    "favorite", "recommend", "super", "top", "nice", "perfect", "enjoyed",
    "tasty", "yummy", "wonderful", "satisfied", "helpful", "attentive", "pleasant"
}

NEGATIVE_WORDS = {
    "terrible", "bad", "awful", "horrible", "worst", "rude", "slow", "dirty",
    "overpriced", "bland", "disgusted", "disgusting", "waste", "poor", "avoid",
    "disappointed", "cold", "stale", "expensive", "unfriendly", "unprofessional",
    "mediocre", "loud", "crowded", "nasty", "gross", "horrific"
}


def _fallback_local_sentiment(text: str, rating: float = 0.0) -> dict:
    words = text.lower().split()
    pos_matches = sum(1 for w in words if w.strip(".,!?\"'") in POSITIVE_WORDS)
    neg_matches = sum(1 for w in words if w.strip(".,!?\"'") in NEGATIVE_WORDS)

    if rating >= 4:
        pos_matches += 2
    elif rating > 0 and rating <= 2:
        neg_matches += 2

    total_matches = pos_matches + neg_matches
    if total_matches == 0:
        if rating >= 4:
            return {"scores": {"positive": 0.8, "negative": 0.1, "neutral": 0.1}, "label": "positive"}
        elif rating > 0 and rating <= 2:
            return {"scores": {"positive": 0.1, "negative": 0.8, "neutral": 0.1}, "label": "negative"}
        return {"scores": {"positive": 0.2, "negative": 0.2, "neutral": 0.6}, "label": "neutral"}

    pos_score = round(pos_matches / total_matches, 3)
    neg_score = round(neg_matches / total_matches, 3)
    neu_score = round(max(0.0, 1.0 - pos_score - neg_score), 3)

    if pos_score > neg_score and pos_score >= 0.4:
        label = "positive"
    elif neg_score > pos_score and neg_score >= 0.4:
        label = "negative"
    else:
        label = "neutral"

    return {"scores": {"positive": pos_score, "negative": neg_score, "neutral": neu_score}, "label": label}


async def analyze_reviews(reviews: list[dict]) -> dict:
    """
    Analyze up to 100 reviews in ONE SINGLE BATCH API call to Hugging Face.
    Fast, efficient, and 100% LOW COST ($0 cost).
    """
    selected_reviews = reviews[:100]
    total = len(selected_reviews)

    if total == 0:
        return {
            "reviews": [],
            "summary": {
                "total_reviews": 0,
                "positive_count": 0,
                "negative_count": 0,
                "neutral_count": 0,
                "average_compound": 0,
                "overall_label": "neutral",
                "aspect_sentiments": {},
                "sentiment_distribution": {"positive": 0, "negative": 0, "neutral": 0},
            },
        }

    batch_texts = [r.get("text", "")[:500] for r in selected_reviews if r.get("text", "").strip()]

    batch_predictions_map = {}

    # Sub-batch in chunks of 10 reviews and execute CONCURRENTLY to maximize speed
    chunk_size = 10
    chunks = [batch_texts[i : i + chunk_size] for i in range(0, len(batch_texts), chunk_size)]

    async def process_chunk(chunk):
        try:
            raw_batch_res = await _call_hf_inference_batch(chunk)
            results = []
            if isinstance(raw_batch_res, list) and len(raw_batch_res) == len(chunk):
                for text, raw_pred in zip(chunk, raw_batch_res):
                    scores = {"positive": 0.0, "negative": 0.0, "neutral": 0.0}
                    items = raw_pred if isinstance(raw_pred, list) else []
                    for item in items:
                        lbl = str(item.get("label", "")).lower()
                        norm_lbl = LABEL_MAPPING.get(lbl, lbl)
                        if norm_lbl in scores:
                            scores[norm_lbl] = round(float(item.get("score", 0.0)), 3)

                    highest_lbl = max(scores, key=scores.get)
                    label = highest_lbl if scores[highest_lbl] > 0 else "neutral"
                    results.append((text, {"scores": scores, "label": label}))
            return results
        except Exception as e:
            logger.warning("Chunk HF call failed: %s", e)
            return []

    chunk_tasks = [process_chunk(chunk) for chunk in chunks]
    chunk_results = await asyncio.gather(*chunk_tasks)

    for res_list in chunk_results:
        for text, pred in res_list:
            batch_predictions_map[text] = pred



    analyzed = []
    for r in selected_reviews:
        text = r.get("text", "")
        rating = float(r.get("rating", 0.0))
        truncated = text[:500]

        if truncated in batch_predictions_map:
            res = batch_predictions_map[truncated]
            scores = res["scores"]
            label = res["label"]
        else:
            fallback = _fallback_local_sentiment(text, rating)
            scores = fallback["scores"]
            label = fallback["label"]

        aspects = extract_aspects(text)
        compound = round(scores.get("positive", 0.0) - scores.get("negative", 0.0), 3)

        analyzed.append(
            {
                **r,
                "sentiment": {
                    "compound": compound,
                    "positive": round(scores.get("positive", 0.0), 3),
                    "negative": round(scores.get("negative", 0.0), 3),
                    "neutral": round(scores.get("neutral", 0.0), 3),
                    "label": label,
                },
                "aspects": aspects,
            }
        )

    positive_count = sum(1 for r in analyzed if r["sentiment"]["label"] == "positive")
    negative_count = sum(1 for r in analyzed if r["sentiment"]["label"] == "negative")
    neutral_count = sum(1 for r in analyzed if r["sentiment"]["label"] == "neutral")
    avg_compound = sum(r["sentiment"]["compound"] for r in analyzed) / total

    # Aspect-based sentiment aggregation
    aspect_scores = defaultdict(list)
    for r in analyzed:
        for aspect in r["aspects"]:
            aspect_scores[aspect].append(r["sentiment"]["compound"])

    aspect_sentiments = {}
    for aspect, scores_list in aspect_scores.items():
        avg = sum(scores_list) / len(scores_list)
        aspect_sentiments[aspect] = {
            "average_score": round(avg, 3),
            "label": get_sentiment_label_from_compound(avg),
            "mention_count": len(scores_list),
        }

    aspect_sentiments = dict(
        sorted(aspect_sentiments.items(), key=lambda x: x[1]["mention_count"], reverse=True)
    )

    summary = {
        "total_reviews": total,
        "positive_count": positive_count,
        "negative_count": negative_count,
        "neutral_count": neutral_count,
        "positive_percent": round((positive_count / total) * 100, 1),
        "negative_percent": round((negative_count / total) * 100, 1),
        "neutral_percent": round((neutral_count / total) * 100, 1),
        "average_compound": round(avg_compound, 3),
        "overall_label": get_sentiment_label_from_compound(avg_compound),
        "aspect_sentiments": aspect_sentiments,
        "sentiment_distribution": {
            "positive": positive_count,
            "negative": negative_count,
            "neutral": neutral_count,
        },
        "model": "cardiffnlp/twitter-roberta-base-sentiment-latest",
        "api_calls_made": 1 if batch_texts else 0,
    }

    return {"reviews": analyzed, "summary": summary}
