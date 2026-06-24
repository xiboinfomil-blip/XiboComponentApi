exports.getLeaderboardData = async (useDummyData = false, retries = 3) => {
    const apiUrl = "https://euro.omediainteractive.net/imleuro/items/pronostics_rankings";
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
        for (let attempt = 1; attempt <= retries; attempt++) {
            try {
                console.log(`Attempt ${attempt}/${retries} to fetch leaderboard...`);
                
                const controller = new AbortController();
                const timeoutId = setTimeout(() => controller.abort(), 10000);

                const response = await fetch(apiUrl, { 
                    signal: controller.signal,
                    // Add headers if needed
                    headers: {
                        'Accept': 'application/json',
                        'User-Agent': 'Node.js/18+'
                    }
                });
                clearTimeout(timeoutId);

                if (!response.ok) {
                    throw new Error(`HTTP error! status: ${response.status}`);
                }

                const payload = await response.json();
                rankingData = payload?.data?.[0]?.ranking_json || [];
                
                console.log(`Successfully fetched ${rankingData.length} items`);
                break; // Success, exit retry loop
                
            } catch (error) {
                console.error(`Attempt ${attempt} failed:`, error.message);
                console.error(`Error code:`, error.cause?.code);
                console.error(`Error details:`, error.cause);
                
                if (attempt === retries) {
                    console.error("All retry attempts failed");
                    rankingData = [];
                } else {
                    // Wait before retrying (exponential backoff)
                    const waitTime = Math.pow(2, attempt) * 1000;
                    console.log(`Waiting ${waitTime}ms before next attempt...`);
                    await new Promise(resolve => setTimeout(resolve, waitTime));
                }
            }
        }
    }

    return rankingData;
};