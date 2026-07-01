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
        
        // ⚠️ CRITICAL XIBO FIX: Use an absolute URL here, just like your web setup
        const SERVER_URL = 'https://your-actual-api-domain.com'; 
        const apiUrl = queryString ? `${SERVER_URL}/api/leaderboard?${queryString}` : `${SERVER_URL}/api/leaderboard`;
        
        const response = await fetch(apiUrl);
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);

        const result = await response.json();
        const data = result.data || [];

        const loadingRow = document.getElementById('loading-row');
        if (loadingRow) loadingRow.remove();

        if (data.length > 0) {
            
            // 🔄 XIBO RESILIENCE PATTERN (Wait for sub-components if they are late)
            if (typeof renderPodium !== 'function' || typeof renderTable !== 'function') {
                console.warn('Leaderboard partials not parsed yet by Xibo. Retrying in 100ms...');
                setTimeout(() => initLeaderboard(), 100);
                return; // Stop execution here and wait for the timeout retry
            }

            // Safe to run now because we verified they exist!
            renderPodium(data);
            renderTable(data);
            
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

// Safer wrapper execution block for Xibo player environments
if (document.readyState === 'complete' || document.readyState === 'interactive') {
    initLeaderboard();
} else {
    document.addEventListener('DOMContentLoaded', initLeaderboard);
}

document.addEventListener('DOMContentLoaded', initLeaderboard);