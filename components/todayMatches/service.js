// components/todayMatches/service.js

exports.getTodayMatches = async (useDummyData = false) => {
    const apiUrl = "https://euro.omediainteractive.net/imleuro/items/matches";
    let matchesData = [];

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

    try {
        if (useDummyData) {
            matchesData = getDummyMatches();
        } else {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 5000);

            const response = await fetch(apiUrl, { signal: controller.signal });
            clearTimeout(timeoutId);

            if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);

            const payload = await response.json();
            const rawMatches = payload?.data || [];
            const todayStr = new Date().toISOString().split('T')[0];

            // Filter for today's matches only
            matchesData = rawMatches.filter(match => {
                if (!match.date) return false;
                return match.date.substring(0, 10) === todayStr;
            });
        }
    } catch (error) {
        console.error("Error fetching today's matches:", error.message);
        if (!useDummyData) matchesData = [];
    }

    return matchesData;
};