// components/leaderboard/service.js

exports.getLeaderboardData = async (useDummyData = false) => {
    const apiUrl = "https://euro.omediainteractive.net/imleuro/items/pronostiques_rankings";
    let rankingData = [];

    if (useDummyData) {
        rankingData = [
            { rank: 1, key: "iml-aaa", point: 150 },
            { rank: 2, key: "iml-bbb", point: 135 },
            { rank: 3, key: "iml-ccc", point: 120 },
            { rank: 4, key: "iml-ddd", point: 95 },
            { rank: 5, key: "iml-eee", point: 80 },
            { rank: 6, key: "iml-fff", point: 75 }
        ];
    } else {
        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 5000);

            // Using native Node 18+ fetch. If on older Node, use axios instead.
            const response = await fetch(apiUrl, { signal: controller.signal });
            clearTimeout(timeoutId);

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const payload = await response.json();
            rankingData = payload?.data?.[0]?.ranking_json || [];
        } catch (error) {
            console.error("Error fetching leaderboard ranking data on server:", error.message);
            rankingData = [];
        }
    }

    // Return only the top 10 items
    return rankingData.slice(0, 10);
};