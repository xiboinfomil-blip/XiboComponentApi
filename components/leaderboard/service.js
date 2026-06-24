const axios = require('axios');

/**
 * Fetches the leaderboard / pronostics data from the external API using Axios.
 * @param {boolean} useDummyData - If true, immediately returns mock data without hitting the network.
 * @param {number} retries - The number of connection attempts before giving up.
 * @returns {Promise<Array>} Resolves to the array of ranking/pronostics items.
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

            const payload = response.data;
            
            // L'API renvoie un tableau d'objets dans payload.data
            const rawRows = payload?.data || [];
            
            // Transformation des données pour le frontend ({ rank, key, point })
            const structuredData = rawRows.map((item) => {
                // Si l'API utilise 'user' ou 'key', on extrait la valeur de manière sécurisée
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

            // Tri par points décroissants
            structuredData.sort((a, b) => b.point - a.point);

            // Attribution dynamique des rangs avec gestion des égalités (ex-æquo)
            rankingData = structuredData.map((item, index, arr) => {
                if (index > 0 && item.point === arr[index - 1].point) {
                    item.rank = arr[index - 1].rank;
                } else {
                    item.rank = index + 1;
                }
                return item;
            });

            console.log(`Successfully fetched and structured ${rankingData.length} items.`);
            break; // Success! Exit the retry loop.

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