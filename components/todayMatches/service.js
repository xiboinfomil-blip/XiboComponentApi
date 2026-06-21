// components/todayMatches/service.js

let cachedMatches = null;
let cacheExpirationTime = 0;

const getNextExpirationTime = () => {
    const now = new Date();
    const today = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
    // Mauritius is UTC+4, so 6 AM Mauritius is 2 AM UTC
    const targetHourUTC = 2; 
    
    let nextExpiration = new Date(today);
    nextExpiration.setUTCHours(targetHourUTC, 0, 0, 0);

    if (now.getTime() >= nextExpiration.getTime()) {
        nextExpiration.setUTCDate(nextExpiration.getUTCDate() + 1);
    }

    return nextExpiration.getTime();
};

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
    // Ensure we parse as UTC if the string doesn't specify timezone
    const matchDate = new Date(matchDateStr.replace(' ', 'T') + 'Z'); 
    const diffMs = matchDate.getTime() - now.getTime();
    
    // Assume a match is "Live" for 2 hours after kickoff for this demo
    const LIVE_WINDOW_MS = 2 * 60 * 60 * 1000; 

    if (diffMs > 0) {
        return {
            status: 'upcoming',
            label: 'Starts in',
            timeString: formatDuration(diffMs),
            isLive: false
        };
    } else if (Math.abs(diffMs) < LIVE_WINDOW_MS) {
        return {
            status: 'live',
            label: 'LIVE',
            timeString: `+${formatDuration(Math.abs(diffMs))}`,
            isLive: true
        };
    } else {
        return {
            status: 'finished',
            label: 'FT',
            timeString: 'Finished',
            isLive: false
        };
    }
};

exports.getTodayMatches = async (useDummyData = false) => {
    const apiUrl = "https://euro.omediainteractive.net/imleuro/items/matches";
    
    console.log("=".repeat(80));
    console.log("[getTodayMatches] Function called");
    console.log("[getTodayMatches] useDummyData:", useDummyData);
    console.log("[getTodayMatches] Current time:", new Date().toISOString());
    console.log("[getTodayMatches] Cache exists:", !!cachedMatches);
    console.log("[getTodayMatches] Cache expiration:", cacheExpirationTime ? new Date(cacheExpirationTime).toISOString() : 'N/A');
    console.log("[getTodayMatches] Cache valid:", cachedMatches && Date.now() < cacheExpirationTime);
    console.log("=".repeat(80));

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

    const now = Date.now();

    // Return cached data with fresh time calculations if still valid
    if (!useDummyData && cachedMatches && now < cacheExpirationTime) {
        console.log("[getTodayMatches] ✅ Returning cached matches");
        return cachedMatches.map(m => ({ ...m, statusInfo: getMatchStatusInfo(m.date) }));
    }

    let matchesData = [];

    try {
        if (useDummyData) {
            console.log("[getTodayMatches] Using dummy data");
            matchesData = getDummyMatches();
        } else {
            console.log("[getTodayMatches] 🔄 Fetching fresh matches from API...");
            console.log("[getTodayMatches] API URL:", apiUrl);
            
            // Check if fetch is available
            console.log("[getTodayMatches] typeof fetch:", typeof fetch);
            console.log("[getTodayMatches] global.fetch available:", typeof global.fetch !== 'undefined');
            
            const controller = new AbortController();
            const timeoutMs = 10000;
            console.log(`[getTodayMatches] Setting timeout to ${timeoutMs}ms`);
            
            const timeoutId = setTimeout(() => {
                console.log("[getTodayMatches] ⏰ Timeout reached! Aborting request...");
                controller.abort();
            }, timeoutMs);

            const startTime = Date.now();
            console.log("[getTodayMatches] Request started at:", new Date(startTime).toISOString());

            try {
                // Note: In Node.js, ensure you are using Node 18+ for native fetch, 
                // or use node-fetch library if on older versions.
                const response = await fetch(apiUrl, { 
                    signal: controller.signal,
                    headers: { 
                        'User-Agent': 'Express-App/1.0', 
                        'Accept': 'application/json' 
                    }
                });
                
                const endTime = Date.now();
                const duration = endTime - startTime;
                console.log("[getTodayMatches] Response received in", duration, "ms");
                console.log("[getTodayMatches] Response status:", response.status);
                console.log("[getTodayMatches] Response ok:", response.ok);
                console.log("[getTodayMatches] Response headers:", Object.fromEntries(response.headers.entries()));

                clearTimeout(timeoutId);

                if (!response.ok) {
                    console.error("[getTodayMatches] ❌ HTTP error! status:", response.status);
                    throw new Error(`HTTP error! status: ${response.status}`);
                }

                console.log("[getTodayMatches] Parsing JSON...");
                const payload = await response.json();
                console.log("[getTodayMatches] JSON parsed successfully");
                console.log("[getTodayMatches] Payload keys:", Object.keys(payload || {}));
                console.log("[getTodayMatches] Payload.data exists:", !!payload?.data);
                console.log("[getTodayMatches] Payload.data length:", payload?.data?.length || 0);
                
                // Debugging: Log the raw payload to see structure
                console.log("[getTodayMatches] First item sample:", JSON.stringify(payload?.data?.[0], null, 2));

                const rawMatches = payload?.data || [];
                const todayStr = new Date().toISOString().split('T')[0];
                console.log("[getTodayMatches] Today's date string:", todayStr);

                matchesData = rawMatches.filter(match => {
                    if (!match.date) {
                        console.log("[getTodayMatches] Skipping match without date:", match);
                        return false;
                    }
                    const matchDate = match.date.substring(0, 10);
                    const isToday = matchDate === todayStr;
                    if (!isToday) {
                        console.log("[getTodayMatches] Skipping non-today match:", matchDate, "!==", todayStr);
                    }
                    return isToday;
                });

                console.log("[getTodayMatches] Filtered matches count:", matchesData.length);

            } catch (fetchError) {
                clearTimeout(timeoutId);
                console.error("[getTodayMatches] ❌ Fetch error details:");
                console.error("[getTodayMatches] Error name:", fetchError.name);
                console.error("[getTodayMatches] Error message:", fetchError.message);
                console.error("[getTodayMatches] Error stack:", fetchError.stack);
                throw fetchError; // Re-throw to be caught by outer try-catch
            }
        }

        console.log("[getTodayMatches] Enriching matches with status info...");
        // Enrich matches with status info
        const enrichedMatches = matchesData.map(match => ({
            ...match,
            statusInfo: getMatchStatusInfo(match.date)
        }));

        console.log("[getTodayMatches] Enriched matches count:", enrichedMatches.length);

        if (enrichedMatches.length > 0 || useDummyData) {
            console.log("[getTodayMatches] 💾 Caching matches");
            cachedMatches = enrichedMatches;
            cacheExpirationTime = getNextExpirationTime();
            console.log("[getTodayMatches] Cache expiration set to:", new Date(cacheExpirationTime).toISOString());
        }

        console.log("[getTodayMatches] ✅ Returning", enrichedMatches.length, "matches");
        console.log("=".repeat(80));
        return enrichedMatches;

    } catch (error) {
        console.error("=".repeat(80));
        console.error("[getTodayMatches] ❌ ERROR CAUGHT:");
        console.error("[getTodayMatches] Error name:", error.name);
        console.error("[getTodayMatches] Error message:", error.message);
        console.error("[getTodayMatches] Error stack:", error.stack);
        console.error("=".repeat(80));
        
        if (cachedMatches) {
            console.log("[getTodayMatches] ⚠️ Falling back to cached matches");
            return cachedMatches.map(m => ({ ...m, statusInfo: getMatchStatusInfo(m.date) }));
        }
        if (!useDummyData) {
            console.log("[getTodayMatches] ⚠️ No cache, returning empty array");
            return [];
        }
    }

    console.log("[getTodayMatches] Final return with", matchesData.length, "matches");
    return matchesData.map(m => ({ ...m, statusInfo: getMatchStatusInfo(m.date) }));
};