/**
 * Main function to fetch and render leaderboard data
 */
async function initLeaderboard() {
    try {
        const config = getConfig();
        const params = new URLSearchParams();
        if (config.refetch) params.append('refetch', 'true');
        if (config.dummy) params.append('dummy', 'true');

        const queryString = params.toString();
        const apiUrl = queryString ? `/api/leaderboard?${queryString}` : '/api/leaderboard';
        
        const response = await fetch(apiUrl);
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);

        const result = await response.json();
        const data = result.data || [];

        // Remove loading state from table if needed
        const loadingRow = document.getElementById('loading-row');
        if (loadingRow) loadingRow.remove();

        if (data.length > 0) {
            // Call sub-component functions
            if (typeof renderPodium === 'function') renderPodium(data);
            if (typeof renderTable === 'function') renderTable(data);
            
            // Initialize autoscroll if table component loaded it
            if (typeof initializeAutoscroll === 'function') {
                initializeAutoscroll(config.speed);
            }
        } else {
            if (typeof showEmptyState === 'function') showEmptyState("Aucune donnée disponible");
        }

    } catch (error) {
        console.error('Error fetching leaderboard:', error);
        if (typeof showEmptyState === 'function') showEmptyState("Erreur de chargement");
    }
}

document.addEventListener('DOMContentLoaded', initLeaderboard);