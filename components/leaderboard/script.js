/**
 * Main function to fetch and render leaderboard data
 */
async function initLeaderboard() {
    try {
        // DEFENSIVE CHECK: Fallback safely if configHelper.js isn't fully loaded yet
        let config = {};
        if (typeof getConfig === 'function') {
            config = getConfig() || {};
        } else {
            console.warn('Xibo warning: getConfig is not available yet. Proceeding with defaults.');
        }

        const params = new URLSearchParams();
        if (config.refetch) params.append('refetch', 'true');
        if (config.dummy) params.append('dummy', 'true');

        const queryString = params.toString();
        const REAL_BACKEND_URL = 'https://xibo-component-api.vercel.app';
        const apiUrl = queryString 
            ? `${REAL_BACKEND_URL}/api/leaderboard?${queryString}` 
            : `${REAL_BACKEND_URL}/api/leaderboard`;
        
        // This will now always execute because the code above won't crash
        const response = await fetch(apiUrl);
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);

        const result = await response.json();
        const data = result.data || result;

        // Remove loading state from table safely
        const loadingRow = document.getElementById('loading-row');
        if (loadingRow) loadingRow.remove();

        if (Array.isArray(data) && data.length > 0) {
            // DEFENSIVE UI CHECKS: Exactly like your working matches component
            if (typeof renderPodium === 'function') renderPodium(data);
            if (typeof renderTable === 'function') renderTable(data);
            
            if (typeof initializeAutoscroll === 'function') {
                initializeAutoscroll(config.speed || 5);
            }
        } else {
            if (typeof showEmptyState === 'function') showEmptyState("Aucune donnée disponible");
        }

    } catch (error) {
        console.error('Error fetching leaderboard:', error);
        if (typeof showEmptyState === 'function') showEmptyState("Erreur de chargement");
    }
}

// Initialization check: Fires the API call immediately on load
if (document.readyState === "loading") {
    document.addEventListener('DOMContentLoaded', initLeaderboard);
} else {
    initLeaderboard();
}