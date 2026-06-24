const axios = require('axios');

/**
 * Fetches the leaderboard / pronostics data from the external API using Axios.
 * * @param {boolean} useDummyData - If true, immediately returns mock data without hitting the network.
 * @param {number} retries - The number of connection attempts before giving up.
 * @returns {Promise<Array>} Resolves to the array of ranking/pronostics items.
 */
exports.getLeaderboardData = async (useDummyData = false, retries = 3) => {
    const apiUrl = "https://euro.omediainteractive.net/imleuro/items/pronostics_rankings";
    let rankingData = [];

    const dummyData = [
        { id: 1, game_id: "1", user: "iml-aaa", winner_draw: "Mexico", fulltime_a: "0", fulltime_b: "0" },
        { id: 2, game_id: "2", user: "iml-bbb", winner_draw: "Draw", fulltime_a: "0", fulltime_b: "0" },
        { id: 3, game_id: "3", user: "iml-ccc", winner_draw: "Canada", fulltime_a: "0", fulltime_b: "0" }
    ];

    if (useDummyData) {
        console.log("Using dummy data as explicitly requested.");
        return dummyData;
    }

    for (let attempt = 1; attempt <= retries; attempt++) {
        try {
            console.log(`Attempt ${attempt}/${retries} to fetch leaderboard...`);

            const response = await axios.get(apiUrl, {
                timeout: 30000, // 30 seconds timeout to prevent Code 20 drops
                headers: {
                    'Accept': 'application/json',
                    'User-Agent': 'Node.js Axios'
                }
            });

            // Axios automatically parses JSON payloads into response.data
            const payload = response.data;
            const record = payload?.data?.[0];
            rankingData = record?.pronostiques || record?.ranking_json || [];

            console.log(`Successfully fetched ${rankingData.length} items from server.`);
            break; // Success! Exit the retry loop.

        } catch (error) {
            let errorCode = 'UNKNOWN';
            let errorMessage = error.message;

            if (error.code) {
                // Catches ENOTFOUND, ECONNREFUSED, ECONNABORTED (Axios timeout)
                errorCode = error.code; 
            } else if (error.response) {
                // The server responded with a status code outside the 2xx range
                errorCode = `HTTP_${error.response.status}`;
                errorMessage = JSON.stringify(error.response.data);
            }

            console.error(`Attempt ${attempt} failed: ${errorMessage} (Code: ${errorCode})`);

            if (attempt === retries) {
                console.error("All retry attempts exhausted. Returning fallback empty array.");
                rankingData = [];
            } else {
                // Exponential backoff: 2000ms, then 4000ms
                const waitTime = Math.pow(2, attempt) * 1000;
                console.log(`Waiting ${waitTime}ms before next attempt...`);
                await new Promise(resolve => setTimeout(resolve, waitTime));
            }
        }
    }

    return rankingData;
};