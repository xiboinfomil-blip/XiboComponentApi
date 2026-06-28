const { kv } = require('@vercel/kv');
const { fetchWithCircuitBreaker, circuitBreaker } = require('../../helpers/fetchWithCircuitBreaker');

const LEADERBOARD_CACHE_KEY = 'leaderboard_rankings_v1';
const LEADERBOARD_STALE_CACHE_KEY = 'leaderboard_rankings_stale_v1';

/**
 * Helper function to calculate seconds until the next specific expiration hour.
 */
function getSecondsUntilNextExpiration() {
    const now = new Date();
    
    // Example: Expire at the top of the very next hour
    const nextHour = new Date(now);
    nextHour.setHours(now.getHours() + 1, 0, 0, 0);
    
    const differenceInMs = nextHour.getTime() - now.getTime();
    const seconds = Math.ceil(differenceInMs / 1000);
    
    // Return a safety minimum of 60 seconds if something goes weird
    return seconds > 0 ? seconds : 60; 
}

/**
 * Fetches the leaderboard / pronostics data from the external API using Axios.
 * Uses Vercel KV to cache the result.
 * 
 * @param {object} config - Centralized request configuration
 * @param {boolean} config.useDummyData - Force dummy data
 * @param {boolean} config.forceRefetch - Force bypass cache and pull fresh data
 */
module.exports.getLeaderboardData = async (config = {}) => {
    // Destructure with defaults for safety
    const { useDummyData = false, forceRefetch = false } = config;

    const apiUrl = "https://euro.omediainteractive.net/imleuro/items/pronostics_rankings";
    let rankingData = [];

    const dummyData = [
        { rank: 1, key: "iml-aaa", point: 50 },
        { rank: 2, key: "iml-bbb", point: 45 },
        { rank: 3, key: "iml-ccc", point: 42 },
        { rank: 4, key: "iml-ddd", point: 39 },
        { rank: 5, key: "iml-eee", point: 31 }
    ];

    if (useDummyData) {
        console.log("Using dummy data as explicitly requested.");
        return dummyData;
    }

    // --- STEP 1: Check Cache (Skip if refetch=true) ---
    if (forceRefetch) {
        console.log("🔄 ?refetch=true detected. Bypassing cache to fetch fresh data...");
    } else {
        try {
            const cachedData = await kv.get(LEADERBOARD_CACHE_KEY);
            if (cachedData && Array.isArray(cachedData)) {
                console.log("✅ Serving data from Vercel KV cache.");
                return cachedData;
            }
            console.log("⚠️ Cache miss. Fetching from external API...");
        } catch (cacheError) {
            console.warn("Failed to read from KV cache, proceeding to fetch:", cacheError.message);
        }
    }

    // --- STEP 2: Fetch from External API ---
    try {
        console.log("[getLeaderboardData] 🔄 Fetching leaderboard with circuit breaker and retry logic...");
        
        const payload = await fetchWithCircuitBreaker(apiUrl, {
            headers: {
                'Accept': 'application/json',
                'User-Agent': 'Node.js Axios'
            }
        }, 3); // 3 retries with exponential backoff

        const rawRows = payload?.data || [];
        
        const structuredData = rawRows.map((item) => {
            let username = "Inconnu";
            if (item.pronostiques && item.pronostiques[0]) {
                username = item.pronostiques[0].user || "Inconnu";
            } else if (item.user) {
                username = item.user;
            } else if (item.key) {
                username = item.key;
            }

            return {
                key: username,
                point: typeof item.point !== 'undefined' ? Number(item.point) : 0
            };
        });

        structuredData.sort((a, b) => b.point - a.point);

        rankingData = structuredData.map((item, index, arr) => {
            if (index > 0 && item.point === arr[index - 1].point) {
                item.rank = arr[index - 1].rank;
            } else {
                item.rank = index + 1;
            }
            return item;
        });

        console.log(`Successfully fetched and structured ${rankingData.length} items.`);
        
        // --- STEP 3: Save / Update Cache ---
        if (rankingData.length > 0) {
            try {
                const maxAge = getSecondsUntilNextExpiration();
                
                // Store in KV with expiration
                await kv.set(LEADERBOARD_CACHE_KEY, rankingData, { ex: maxAge });
                
                // Also store in stale cache for longer retention (24 hours)
                await kv.set(LEADERBOARD_STALE_CACHE_KEY, rankingData, { ex: 86400 });
                
                console.log(`💾 Cache updated in Vercel KV for ${maxAge}s and stale cache for 24h.`);
            } catch (cacheWriteError) {
                console.error("Failed to write to KV cache:", cacheWriteError.message);
            }
        }

    } catch (error) {
        console.error("=".repeat(80));
        console.error("[getLeaderboardData] ❌ ERROR CAUGHT:");
        console.error("[getLeaderboardData] Message:", error.message);
        console.error("[getLeaderboardData] Stack:", error.stack);
        console.error("=".repeat(80));
        
        // Fallback: Try to return cached data if API fails
        try {
            // First try fresh cache
            const fallbackCache = await kv.get(LEADERBOARD_CACHE_KEY);
            if (fallbackCache && Array.isArray(fallbackCache)) {
                console.log("[getLeaderboardData] ⚠️ API failed, returning fresh cache from KV");
                return fallbackCache;
            }
            
            // Then try stale cache (older but better than nothing)
            const staleCache = await kv.get(LEADERBOARD_STALE_CACHE_KEY);
            if (staleCache && Array.isArray(staleCache)) {
                console.log("[getLeaderboardData] ⚠️⚠️ API failed, returning OLD stale cache from KV");
                return staleCache;
            }
            
            console.log("[getLeaderboardData] ⚠️⚠️⚠️ No cache available, returning empty array");
        } catch (e) {
            console.error("[getLeaderboardData] Failed to read fallback cache:", e.message);
        }
        
        rankingData = [];
    }

    return rankingData;
};

// Export circuit breaker for monitoring/debugging
module.exports.circuitBreaker = circuitBreaker;