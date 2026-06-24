const axios = require('axios');
const { kv } = require('@vercel/kv');

/**
 * Calculates seconds until the next cache expiration time.
 * Expiration hours: 12pm, 3pm (15h), 5pm (17h), 6pm (18h), 8pm (20h), 9pm (21h), 10pm (22h)
 */
function getSecondsUntilNextExpiration(timeZone = 'Europe/Paris') {
    const now = new Date();
    // Unique expiration hours in 24h format
    const expirationHours = [12, 15, 17, 18, 20, 21, 22]; 
    
    const formatter = new Intl.DateTimeFormat('en-US', {
        timeZone,
        hour12: false,
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
    });
    
    const parts = formatter.formatToParts(now);
    const currentHour = parseInt(parts.find(p => p.type === 'hour').value, 10);
    const currentMinute = parseInt(parts.find(p => p.type === 'minute').value, 10);
    const currentSecond = parseInt(parts.find(p => p.type === 'second').value, 10);
    
    const currentTotalMinutes = currentHour * 60 + currentMinute;
    
    for (let hour of expirationHours) {
        const expTotalMinutes = hour * 60;
        if (currentTotalMinutes < expTotalMinutes) {
            const diffInMinutes = expTotalMinutes - currentTotalMinutes;
            return (diffInMinutes * 60) - currentSecond;
        }
    }
    
    // If all times have passed today, calculate time until tomorrow's first slot (12:00)
    const minutesInDay = 24 * 60;
    const tomorrowFirstSlotMinutes = 12 * 60; 
    const remainingToday = minutesInDay - currentTotalMinutes;
    const totalDiffMinutes = remainingToday + tomorrowFirstSlotMinutes;
    
    return (totalDiffMinutes * 60) - currentSecond;
}

/**
 * Fetches the leaderboard / pronostics data from the external API using Axios.
 * Uses Vercel KV to cache the result until the next specific expiration hour.
 */
exports.getLeaderboardData = async (useDummyData = false, retries = 3) => {
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

    // --- STEP 1: Check Cache ---
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
            
            // --- STEP 3: Save to Cache ---
            if (rankingData.length > 0) {
                try {
                    const maxAge = getSecondsUntilNextExpiration();
                    // 'ex' sets the expiration time in seconds
                    await kv.set(cacheKey, rankingData, { ex: maxAge });
                    console.log(`💾 Data cached in Vercel KV for ${maxAge} seconds.`);
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