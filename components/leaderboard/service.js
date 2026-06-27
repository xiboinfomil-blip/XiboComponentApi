const axios = require('axios');
const { kv } = require('@vercel/kv');

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
 * Fetches the leaderboard / pronostics data from the external API using Axios.
 * Uses Vercel KV to cache the result until the next specific expiration hour.
 * 
 * @param {boolean} useDummyData - Force dummy data
 * @param {boolean} forceRefetch - Force bypass cache and pull fresh data
 * @param {number} retries - Number of retry attempts on API failure
 */
module.exports.getLeaderboardData = async (useDummyData = false, forceRefetch = false, retries = 3) => {
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

    const cacheKey = 'leaderboard_rankings_v1';

    // --- STEP 1: Check Cache (Skip if refetch=true) ---
    if (forceRefetch) {
        console.log("🔄 ?refetch=true detected. Bypassing cache to fetch fresh data...");
    } else {
        try {
            const cachedData = await kv.get(cacheKey);
            if (cachedData) {
                console.log("✅ Serving data from Vercel KV cache.");
                return cachedData;
            }
            console.log("⚠️ Cache miss. Fetching from external API...");
        } catch (cacheError) {
            console.warn("Failed to read from KV cache, proceeding to fetch:", cacheError.message);
        }
    }

    // --- STEP 2: Fetch from External API ---
    for (let attempt = 1; attempt <= retries; attempt++) {
        try {
            console.log(`Attempt ${attempt}/${retries} to fetch leaderboard...`);

            const response = await axios.get(apiUrl, {
                timeout: 30000,
                headers: {
                    'Accept': 'application/json',
                    'User-Agent': 'Node.js Axios'
                }
            });

            const payload = response.data;
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
                    // 'ex' sets the expiration time in seconds
                    await kv.set(cacheKey, rankingData, { ex: maxAge });
                    console.log(`💾 Cache updated in Vercel KV for ${maxAge} seconds.`);
                } catch (cacheWriteError) {
                    console.error("Failed to write to KV cache:", cacheWriteError.message);
                }
            }
            
            break; 

        } catch (error) {
            let errorCode = 'UNKNOWN';
            let errorMessage = error.message;

            if (error.code) {
                errorCode = error.code; 
            } else if (error.response) {
                errorCode = `HTTP_${error.response.status}`;
                errorMessage = JSON.stringify(error.response.data);
            }

            console.error(`Attempt ${attempt} failed: ${errorMessage} (Code: ${errorCode})`);

            if (attempt === retries) {
                console.error("All retry attempts exhausted. Returning fallback empty array.");
                rankingData = [];
            } else {
                const waitTime = Math.pow(2, attempt) * 1000;
                console.log(`Waiting ${waitTime}ms before next attempt...`);
                await new Promise(resolve => setTimeout(resolve, waitTime));
            }
        }
    }

    return rankingData;
};