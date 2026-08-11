// Automatically normalize API_BASE (handles missing /api, trailing slashes, etc.)
let rawBase = (import.meta.env.VITE_API_BASE_URL || "http://localhost:8000/api").trim().replace(/\/+$/, "");
if (!rawBase.endsWith("/api")) {
  rawBase += "/api";
}
const API_BASE = rawBase;


/**
 * Search for businesses on Google Maps
 * @param {string} query - Search query like "pizza near NYC"
 * @returns {Promise<{places: Array, query: string, count: number}>}
 */
export async function searchPlaces(query) {
  const res = await fetch(`${API_BASE}/search?q=${encodeURIComponent(query)}`);
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: "Network error" }));
    throw new Error(err.detail || "Search failed");
  }
  return res.json();
}

/**
 * Fetch reviews for a place and get sentiment analysis
 * @param {string} dataId - SerpAPI data_id or Google Maps URL/place name
 * @param {number} limit - Maximum number of reviews to fetch (default: 50)
 * @param {string} sortBy - Sort order for reviews (default: 'newest')
 * @returns {Promise<{place_info: Object, reviews: Array, summary: Object, pagination: Object}>}
 */
export async function getReviewsWithSentiment(dataId, limit = 50, sortBy = 'newest') {
  const url = `${API_BASE}/reviews?data_id=${encodeURIComponent(dataId)}&limit=${limit}&sort_by=${encodeURIComponent(sortBy)}`;
  const res = await fetch(url);
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: "Network error" }));
    throw new Error(err.detail || "Failed to fetch reviews");
  }
  return res.json();
}



