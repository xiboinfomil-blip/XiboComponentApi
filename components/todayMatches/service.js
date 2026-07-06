const { kv } = require('@vercel/kv');
const { fetchWithCircuitBreaker, circuitBreaker } = require('../../helpers/fetchWithCircuitBreaker');

const MATCHES_CACHE_KEY = 'today_matches_v1';
const STALE_CACHE_KEY = 'today_matches_stale_v1';

/**
 * Calculates milliseconds until the next cache expiration time.
 * Expiration: 6:00 AM Mauritius Time (UTC+4), which is 02:00 UTC.
 */
function getMsUntilNextExpiration() {
    const now = new Date();
    const targetHourUTC = 2; 
    
    const today = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
    let nextExpiration = new Date(today);
    nextExpiration.setUTCHours(targetHourUTC, 0, 0, 0);

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

const getMatchStatusInfo = (match) => {
    const now = new Date();
    const matchDate = new Date(match.date.replace(' ', 'T') + '+04:00'); 
    const diffMs = matchDate.getTime() - now.getTime();
    
    const LIVE_WINDOW_MS = 2 * 60 * 60 * 1000;
    const currentStatus = (match.current_status || '').toLowerCase();
    
    // Use API's current_status if available
    if (currentStatus === 'finished') {
        return {
            status: 'finished',
            label: 'Terminé',
            timeString: 'Terminé',
            isLive: false,
            isFinished: true
        };
    }
    
    if (['inprogress', 'playing', '1st_half', '2nd_half', 'halftime', 'extra_time', 'penalty', 'live'].includes(currentStatus)) {
        return {
            status: 'live',
            label: 'EN DIRECT',
            timeString: 'LIVE',
            isLive: true,
            isFinished: false
        };
    }
    
    // Fallback to time-based calculation
    if (diffMs > 0) {
        return {
            status: 'upcoming',
            label: 'À venir',
            timeString: formatDuration(diffMs),
            isLive: false,
            isFinished: false
        };
    } else if (Math.abs(diffMs) < LIVE_WINDOW_MS) {
        return {
            status: 'live',
            label: 'EN DIRECT',
            timeString: `+${formatDuration(Math.abs(diffMs))}`,
            isLive: true,
            isFinished: false
        };
    } else {
        return {
            status: 'finished',
            label: 'Terminé', 
            timeString: 'Terminé',
            isLive: false,
            isFinished: true
        };
    }
};

/**
 * Maps raw API match data to the new structured object format.
 * Handles the flat API structure with team_a, fulltime_a, scorers array, etc.
 */
const mapMatchData = (match) => {
    const statusInfo = getMatchStatusInfo(match);
    
    // Get scores from flat structure
    const scoreA = match.fulltime_a ?? null;
    const scoreB = match.fulltime_b ?? null;
    
    // Determine actual finished state (overrides buggy fulltime field)
    const isFinished = statusInfo.isFinished === true;
    
    // Parse scorers from flat array - split by team name
    const rawScorers = Array.isArray(match.scorers) ? match.scorers : [];
    
    const scorersA = rawScorers
        .filter(s => s.team?.name === match.team_a)
        .map(s => ({
            name: s.player?.name || 'Inconnu',
            minute: s.time?.elapsed || 0,
            extra_time: s.time?.extra || null,
            detail: s.detail || ''
        }))
        .sort((a, b) => a.minute - b.minute);
    
    const scorersB = rawScorers
        .filter(s => s.team?.name === match.team_b)
        .map(s => ({
            name: s.player?.name || 'Inconnu',
            minute: s.time?.elapsed || 0,
            extra_time: s.time?.extra || null,
            detail: s.detail || ''
        }))
        .sort((a, b) => a.minute - b.minute);
    
    // Determine winner based on winner_draw field (contains winning team name or null)
    let winnerA = false;
    let winnerB = false;
    let isDraw = false;
    
    if (isFinished) {
        if (match.winner_draw === match.team_a) {
            winnerA = true;
        } else if (match.winner_draw === match.team_b) {
            winnerB = true;
        } else if (match.winner_draw === null || match.winner_draw === 'draw') {
            isDraw = true;
        }
    }
    
    // Check for penalties
    const hasPenalties = match.penalty_shootout === true && 
                        match.penalty_a !== null && 
                        match.penalty_b !== null;

    return {
        id: match.id || null,
        date: match.date,
        
        // --- Competition & Context ---
        competition: {
            name: match.competition_name || match.tournament || "Euro 2024",
            logo: match.competition_logo || null,
            stage: match.phase || match.round || match.group || null
        },
        
        // --- Venue Details ---
        venue: {
            name: match.stadium || null,
            city: match.city || null,
            capacity: match.capacity || null,
            image: match.stadium_image || null
        },

        // --- Actual Match Minute & Period ---
        matchTime: {
            minute: match.minute || null,
            period: match.period || null,
            display: match.minute ? `${match.minute}'` : statusInfo.timeString
        },

        status: {
            state: statusInfo.status,
            label: statusInfo.label,
            timeString: statusInfo.timeString,
            isLive: statusInfo.isLive,
            isFinished: isFinished
        },

        teamA: {
            name: match.team_a,
            id: match.team_a_id || null,
            logo: match.logo_a || match.flag_a || null,
            score: scoreA,
            htScore: match.halftime_a ?? null,
            scorers: scorersA,
            cards: match.cards_a || match.events_cards_a || [],
            substitutions: match.subs_a || match.events_subs_a || [],
            winner: winnerA,
            isDraw: isDraw
        },
        teamB: {
            name: match.team_b,
            id: match.team_b_id || null,
            logo: match.logo_b || match.flag_b || null,
            score: scoreB,
            htScore: match.halftime_b ?? null,
            scorers: scorersB,
            cards: match.cards_b || match.events_cards_b || [],
            substitutions: match.subs_b || match.events_subs_b || [],
            winner: winnerB,
            isDraw: isDraw
        },
        
        // Penalty info
        penalty: hasPenalties ? {
            teamA: match.penalty_a,
            teamB: match.penalty_b
        } : null
    };
};

/**
 * Fetches today's matches.
 * @param {object} config - Centralized request configuration
 * @param {boolean} config.useDummyData - Force dummy data
 * @param {boolean} config.forceRefetch - Force bypass cache and pull fresh data
 */
module.exports.getTodayMatches = async (config = {}) => {
    const { useDummyData = false, forceRefetch = false } = config;
    
    const apiUrl = "https://euro.omediainteractive.net/imleuro/items/matches";
    
    console.log("=".repeat(80));
    console.log("[getTodayMatches] Function called");
    console.log("[getTodayMatches] forceRefetch:", forceRefetch);
    console.log("[getTodayMatches] useDummyData:", useDummyData);
    console.log("[getTodayMatches] Current Time:", new Date().toISOString());

    const getDummyMatches = () => {
        const todayStr = new Date().toISOString().split('T')[0];
        return [
            {
                id: 1,
                date: `${todayStr} 18:00:00`,
                competition_name: "UEFA Euro 2024",
                phase: "Groupe A",
                stadium: "Olympiastadion",
                city: "Berlin",
                capacity: 74475,
                team_a: "Allemagne", team_a_id: "ger", logo_a: "/images/flags/ger.png",
                team_b: "Écosse", team_b_id: "sco", logo_b: "/images/flags/sco.png",
                fulltime_a: 5, fulltime_b: 1,
                halftime_a: 3, halftime_b: 0,
                current_status: "finished",
                winner_draw: "Allemagne",
                scorers: [
                    { time: { elapsed: 10 }, team: { name: "Allemagne" }, player: { name: "Florian Wirtz" }, detail: "Normal Goal" },
                    { time: { elapsed: 45 }, team: { name: "Allemagne" }, player: { name: "Jamal Musiala" }, detail: "Normal Goal" },
                    { time: { elapsed: 68 }, team: { name: "Allemagne" }, player: { name: "Kai Havertz" }, detail: "Normal Goal" },
                    { time: { elapsed: 87 }, team: { name: "Écosse" }, player: { name: "Antonio Rüdiger" }, detail: "Own Goal" }
                ],
                penalty_shootout: false,
                penalty_a: null,
                penalty_b: null
            },
            {
                id: 2,
                date: `${todayStr} 20:45:00`,
                competition_name: "UEFA Euro 2024",
                phase: "Groupe B",
                stadium: "Allianz Arena",
                city: "Munich",
                team_a: "Espagne", team_a_id: "esp", logo_a: "/images/flags/esp.png",
                team_b: "Italie", team_b_id: "ita", logo_b: "/images/flags/ita.png",
                fulltime_a: null, fulltime_b: null,
                halftime_a: null, halftime_b: null,
                current_status: "pending",
                winner_draw: null,
                scorers: [],
                penalty_shootout: false,
                penalty_a: null,
                penalty_b: null
            }
        ];
    };

    // --- STEP 1: Check KV Cache (Bypassed if refetch is true) ---
    if (!useDummyData) {
        if (forceRefetch) {
            console.log("[getTodayMatches] 🔄 ?refetch=true detected. Bypassing cache to fetch fresh data...");
        } else {
            try {
                const cachedMatches = await kv.get(MATCHES_CACHE_KEY);
                if (cachedMatches && Array.isArray(cachedMatches)) {
                    console.log("[getTodayMatches] ✅ Serving matches from Vercel KV cache");
                    return cachedMatches.map(mapMatchData);
                }
                console.log("[getTodayMatches] ⚠️ Cache miss. Fetching from external API...");
            } catch (cacheError) {
                console.warn("[getTodayMatches] Failed to read from KV cache:", cacheError.message);
            }
        }
    }

    let matchesData = [];

    try {
        if (useDummyData) {
            console.log("[getTodayMatches] Using dummy data");
            matchesData = getDummyMatches();
        } else {
            console.log("[getTodayMatches] 🔄 Fetching new matches from API with circuit breaker and retry logic...");
            
            const payload = await fetchWithCircuitBreaker(apiUrl, {
                headers: { 
                    'User-Agent': 'Express-App/1.0', 
                    'Accept': 'application/json' 
                }
            }, 3);

            const rawMatches = payload?.data || [];
            const todayStr = new Date().toISOString().split('T')[0];

            matchesData = rawMatches.filter(match => {
                if (!match.date) return false;
                const matchDate = match.date.substring(0, 10);
                return matchDate === todayStr;
            });

            console.log("[getTodayMatches] Filtered matches count:", matchesData.length);
        }

        // --- STEP 2: Save / Update KV Cache ---
        if (matchesData.length > 0 && !useDummyData) {
            try {
                const msUntilExp = getMsUntilNextExpiration();
                const secondsUntilExp = Math.floor(msUntilExp / 1000);
                
                await kv.set(MATCHES_CACHE_KEY, matchesData, { ex: secondsUntilExp });
                await kv.set(STALE_CACHE_KEY, matchesData, { ex: 86400 });
                
                console.log(`[getTodayMatches] 💾 Raw matches updated in KV for ${secondsUntilExp}s and stale cache for 24h.`);
            } catch (cacheWriteError) {
                console.error("[getTodayMatches] Failed to write to KV cache:", cacheWriteError.message);
            }
        }

        console.log("[getTodayMatches] ✅ Returning", matchesData.length, "matches");
        console.log("=".repeat(80));
        
        return matchesData.map(mapMatchData);

    } catch (error) {
        console.error("=".repeat(80));
        console.error("[getTodayMatches] ❌ ERROR CAUGHT:");
        console.error("[getTodayMatches] Message:", error.message);
        console.error("[getTodayMatches] Stack:", error.stack);
        console.error("=".repeat(80));
        
        if (!useDummyData) {
            try {
                const fallbackCache = await kv.get(MATCHES_CACHE_KEY);
                if (fallbackCache && Array.isArray(fallbackCache)) {
                    console.log("[getTodayMatches] ⚠️ API failed, returning fresh cache from KV");
                    return fallbackCache.map(mapMatchData);
                }
                
                const staleCache = await kv.get(STALE_CACHE_KEY);
                if (staleCache && Array.isArray(staleCache)) {
                    console.log("[getTodayMatches] ⚠️⚠️ API failed, returning OLD stale cache from KV");
                    return staleCache.map(mapMatchData);
                }
                
                console.log("[getTodayMatches] ⚠️⚠️⚠️ No cache available, returning empty array");
            } catch (e) {
                console.error("[getTodayMatches] Failed to read fallback cache:", e.message);
            }
        }
        
        return [];
    }
};

module.exports.circuitBreaker = circuitBreaker;