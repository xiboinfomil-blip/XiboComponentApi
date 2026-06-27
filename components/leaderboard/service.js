const axios = require('axios');
const { kv } = require('@vercel/kv');

const LEADERBOARD_CACHE_KEY = 'leaderboard_rankings_v1';
const LEADERBOARD_STALE_CACHE_KEY = 'leaderboard_rankings_stale_v1';

/**
 * Helper function to calculate seconds until the next specific expiration hour.
 * Default is set to the top of the next hour, but you can adjust this logic 
 * to target specific hours (e.g., midnight, every 6 hours, etc.).
 * 
 * @returns {number} Seconds remaining until expiration
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
 * Circuit Breaker to prevent repeated API calls when service is down
 */
const circuitBreaker = {
    failures: 0,
    lastFailureTime: null,
    threshold: 3,
    resetTimeout: 60000, // 1 minute
    
    isOpen() {
        if (this.failures >= this.threshold) {
            const timeSinceLastFailure = Date.now() - this.lastFailureTime;
            if (timeSinceLastFailure < this.resetTimeout) {
                console.log(`[CircuitBreaker] 🚫 Circuit OPEN (${this.failures} failures in last ${this.resetTimeout/1000}s)`);
                return true; // Circuit is open, don't call API
            } else {
                // Reset after timeout
                console.log('[CircuitBreaker] 🔄 Circuit resetting...');
                this.failures = 0;
                this.lastFailureTime = null;
                return false;
            }
        }
        return false;
    },
    
    recordSuccess() {
        if (this.failures > 0) {
            console.log(`[CircuitBreaker] ✅ Success recorded. Resetting failure count from ${this.failures}`);
        }
        this.failures = 0;
        this.lastFailureTime = null;
    },
    
    recordFailure() {
        this.failures++;
        this.lastFailureTime = Date.now();
        console.log(`[CircuitBreaker] ❌ Failure recorded. Count: ${this.failures}/${this.threshold}`);
    }
};

/**
 * Fetches data with exponential backoff retry logic using Axios
 * @param {string} url - The URL to fetch
 * @param {object} options - Axios options
 * @param {number} maxRetries - Maximum number of retry attempts
 * @returns {Promise<object>} - Axios response data
 */
const fetchWithRetry = async (url, options = {}, maxRetries = 3) => {
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
            console.log(`[fetchWithRetry] Attempt ${attempt}/${maxRetries} for ${url}`);
            
            const response = await axios.get(url, {
                ...options,
                timeout: 30000
            });

            console.log(`[fetchWithRetry] ✅ Success on attempt ${attempt}`);
            return response.data;

        } catch (error) {
            let errorMessage = error.message;
            if (error.response) {
                errorMessage = `HTTP ${error.response.status}: ${JSON.stringify(error.response.data)}`;
            }
            
            console.warn(`[fetchWithRetry] ⚠️ Attempt ${attempt} failed:`, errorMessage);
            
            // If this was the last attempt, rethrow the error
            if (attempt === maxRetries) {
                console.error(`[fetchWithRetry] ❌ All ${maxRetries} attempts failed`);
                throw error;
            }
            
            // Exponential backoff: wait 2^attempt seconds (2s, 4s, 8s...)
            const waitTime = Math.pow(2, attempt) * 1000;
            console.log(`[fetchWithRetry] ⏳ Waiting ${waitTime}ms before next retry...`);
            await new Promise(resolve => setTimeout(resolve, waitTime));
        }
    }
};

/**
 * Fetches the leaderboard / pronostics data from the external API using Axios.
 * Uses Vercel KV to cache the result until the next specific expiration hour.
 * 
 * @param {boolean} useDummyData - Force dummy data
 * @param {boolean} forceRefetch - Force bypass cache and pull fresh data
 */
module.exports.getLeaderboardData = async (useDummyData = false, forceRefetch = false) => {
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
        // Check circuit breaker before making API call
        if (circuitBreaker.isOpen()) {
            console.log("[getLeaderboardData] ⚡ Circuit breaker is OPEN. Skipping API call.");
            throw new Error('Circuit breaker open - API temporarily unavailable');
        }

        console.log("[getLeaderboardData] 🔄 Fetching leaderboard with retry logic...");
        
        const payload = await fetchWithRetry(apiUrl, {
            headers: {
                'Accept': 'application/json',
                'User-Agent': 'Node.js Axios'
            }
        }, 3); // 3 retries with exponential backoff

        // Record success in circuit breaker
        circuitBreaker.recordSuccess();

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
        
        // Record failure in circuit breaker (only for API errors, not dummy data)
        if (error.message !== 'Circuit breaker open - API temporarily unavailable') {
            circuitBreaker.recordFailure();
        }
        
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