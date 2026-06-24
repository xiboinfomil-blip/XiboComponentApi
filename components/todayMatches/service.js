const { kv } = require('@vercel/kv');

const MATCHES_CACHE_KEY = 'today_matches_v1';

/**
 * Calculates milliseconds until the next cache expiration time.
 * Expiration: 6:00 AM Mauritius Time (UTC+4), which is 02:00 UTC.
 */
function getMsUntilNextExpiration() {
    const now = new Date();
    // Target: 6 AM Mauritius = 2 AM UTC
    const targetHourUTC = 2; 
    
    const today = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
    let nextExpiration = new Date(today);
    nextExpiration.setUTCHours(targetHourUTC, 0, 0, 0);

    // If 2 AM UTC has already passed today, set it to tomorrow
    if (now.getTime() >= nextExpiration.getTime()) {
        nextExpiration.setUTCDate(nextExpiration.getUTCDate() + 1);
    }

    return nextExpiration.getTime() - now.getTime();
}

const formatDuration = (ms) => {
    const seconds = Math.floor((ms / 1000) % 60);
    const minutes = Math.floor((ms / (1000 * 60)) % 60);
    const hours = Math.floor((ms / (1000 * 60 * 60)) % 24);

    const parts = [];
    if (hours > 0) parts.push(`${hours}h`);
    if (minutes > 0 || hours > 0) parts.push(`${minutes}m`);
    parts.push(`${seconds}s`);
    
    return parts.join(' ');
};

const getMatchStatusInfo = (matchDateStr) => {
    const now = new Date();
    // Ensure date is parsed as UTC if string doesn't specify timezone
    const matchDate = new Date(matchDateStr.replace(' ', 'T') + 'Z'); 
    const diffMs = matchDate.getTime() - now.getTime();
    
    // Assume a match is "Live" for 2 hours after kickoff for this demo
    const LIVE_WINDOW_MS = 2 * 60 * 60 * 1000; 

    if (diffMs > 0) {
        return {
            status: 'upcoming',
            label: 'Commence dans',
            timeString: formatDuration(diffMs),
            isLive: false
        };
    } else if (Math.abs(diffMs) < LIVE_WINDOW_MS) {
        return {
            status: 'live',
            label: 'EN DIRECT',
            timeString: `+${formatDuration(Math.abs(diffMs))}`,
            isLive: true
        };
    } else {
        return {
            status: 'finished',
            label: 'Terminé', // Full Time
            timeString: 'Terminé',
            isLive: false
        };
    }
};

exports.getTodayMatches = async (useDummyData = false) => {
    const apiUrl = "https://euro.omediainteractive.net/imleuro/items/matches";
    
    console.log("=".repeat(80));
    console.log("[getTodayMatches] Function called");
    console.log("[getTodayMatches] useDummyData:", useDummyData);
    console.log("[getTodayMatches] Current Time:", new Date().toISOString());

    const getDummyMatches = () => {
        const todayStr = new Date().toISOString().split('T')[0];
        return [
            {
                date: `${todayStr} 18:00:00`,
                group: "Groupe A",
                stadium: "Olympiastadion",
                team_a: "Allemagne",
                team_b: "Écosse",
                fulltime: false,
                fulltime_a: null,
                fulltime_b: null
            },
            {
                date: `${todayStr} 20:45:00`,
                group: "Groupe B",
                stadium: "Allianz Arena",
                team_a: "Espagne",
                team_b: "Italie",
                fulltime: false,
                fulltime_a: null,
                fulltime_b: null
            }
        ];
    };

    // --- STEP 1: Check KV Cache ---
    if (!useDummyData) {
        try {
            const cachedMatches = await kv.get(MATCHES_CACHE_KEY);
            if (cachedMatches && Array.isArray(cachedMatches)) {
                console.log("[getTodayMatches] ✅ Serving matches from Vercel KV cache");
                // Recalculate status info dynamically because time passes even if data is cached
                return cachedMatches.map(m => ({ ...m, statusInfo: getMatchStatusInfo(m.date) }));
            }
            console.log("[getTodayMatches] ⚠️ Cache miss. Fetching from external API...");
        } catch (cacheError) {
            console.warn("[getTodayMatches] Failed to read from KV cache:", cacheError.message);
        }
    }

    let matchesData = [];

    try {
        if (useDummyData) {
            console.log("[getTodayMatches] Using dummy data");
            matchesData = getDummyMatches();
        } else {
            console.log("[getTodayMatches] 🔄 Fetching new matches from API...");
            
            const controller = new AbortController();
            const timeoutMs = 10000;
            
            const timeoutId = setTimeout(() => {
                console.log("[getTodayMatches] ⏰ Timeout reached! Aborting request...");
                controller.abort();
            }, timeoutMs);

            try {
                const response = await fetch(apiUrl, { 
                    signal: controller.signal,
                    headers: { 
                        'User-Agent': 'Express-App/1.0', 
                        'Accept': 'application/json' 
                    }
                });
                
                clearTimeout(timeoutId);

                if (!response.ok) {
                    console.error("[getTodayMatches] ❌ HTTP Error! status:", response.status);
                    throw new Error(`HTTP error! status: ${response.status}`);
                }

                const payload = await response.json();
                const rawMatches = payload?.data || [];
                const todayStr = new Date().toISOString().split('T')[0];

                matchesData = rawMatches.filter(match => {
                    if (!match.date) return false;
                    const matchDate = match.date.substring(0, 10);
                    return matchDate === todayStr;
                });

                console.log("[getTodayMatches] Filtered matches count:", matchesData.length);

            } catch (fetchError) {
                clearTimeout(timeoutId);
                console.error("[getTodayMatches] ❌ Fetch error details:", fetchError.message);
                throw fetchError;
            }
        }

        console.log("[getTodayMatches] Enriching matches with status info...");
        const enrichedMatches = matchesData.map(match => ({
            ...match,
            statusInfo: getMatchStatusInfo(match.date)
        }));

        // --- STEP 2: Save to KV Cache ---
        if (enrichedMatches.length > 0 && !useDummyData) {
            try {
                const msUntilExp = getMsUntilNextExpiration();
                const secondsUntilExp = Math.floor(msUntilExp / 1000);
                
                // Store in KV with expiration
                await kv.set(MATCHES_CACHE_KEY, enrichedMatches, { ex: secondsUntilExp });
                console.log(`[getTodayMatches] 💾 Matches cached in KV for ${secondsUntilExp} seconds.`);
            } catch (cacheWriteError) {
                console.error("[getTodayMatches] Failed to write to KV cache:", cacheWriteError.message);
            }
        }

        console.log("[getTodayMatches] ✅ Returning", enrichedMatches.length, "matches");
        console.log("=".repeat(80));
        return enrichedMatches;

    } catch (error) {
        console.error("=".repeat(80));
        console.error("[getTodayMatches] ❌ ERROR CAUGHT:");
        console.error("[getTodayMatches] Message:", error.message);
        console.error("=".repeat(80));
        
        // Fallback: Try to return cached data if API fails
        if (!useDummyData) {
            try {
                const fallbackCache = await kv.get(MATCHES_CACHE_KEY);
                if (fallbackCache && Array.isArray(fallbackCache)) {
                    console.log("[getTodayMatches] ⚠️ API failed, returning stale cache from KV");
                    return fallbackCache.map(m => ({ ...m, statusInfo: getMatchStatusInfo(m.date) }));
                }
            } catch (e) {
                // Ignore cache read error in fallback
            }
        }
        
        return [];
    }
};