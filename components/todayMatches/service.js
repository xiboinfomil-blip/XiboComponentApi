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
        return cachedMatches.map(m => ({ ...m, statusInfo: getMatchStatusInfo(m.date) }));
    }

    let matchesData = [];

    try {
        if (useDummyData) {
            matchesData = getDummyMatches();
        } else {
            console.log("Fetching fresh matches from API...");
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 10000);

            const response = await fetch(apiUrl, { 
                signal: controller.signal,
                headers: { 'User-Agent': 'Express-App/1.0', 'Accept': 'application/json' }
            });
            clearTimeout(timeoutId);

            if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);

            const payload = await response.json();
            const rawMatches = payload?.data || [];
            const todayStr = new Date().toISOString().split('T')[0];

            matchesData = rawMatches.filter(match => {
                if (!match.date) return false;
                return match.date.substring(0, 10) === todayStr;
            });
        }

        // Enrich matches with status info
        const enrichedMatches = matchesData.map(match => ({
            ...match,
            statusInfo: getMatchStatusInfo(match.date)
        }));

        if (enrichedMatches.length > 0 || useDummyData) {
            cachedMatches = enrichedMatches;
            cacheExpirationTime = getNextExpirationTime();
        }

        return enrichedMatches;

    } catch (error) {
        console.error("Error fetching today's matches:", error.message);
        if (cachedMatches) {
            return cachedMatches.map(m => ({ ...m, statusInfo: getMatchStatusInfo(m.date) }));
        }
        if (!useDummyData) return [];
    }

    return matchesData.map(m => ({ ...m, statusInfo: getMatchStatusInfo(m.date) }));
};