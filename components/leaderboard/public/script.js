// components/leaderboard/public/script.js

const scrollWrapper = document.getElementById("scroll-wrapper");
let scrollInterval;
let animationFrameId;

/**
 * Main function to fetch and render leaderboard data
 */
async function initLeaderboard() {
    try {
        // 1. Fetch data from the local API route
        const response = await fetch('/api/leaderboard');
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const result = await response.json();
        
        // CORRECTED EXTRACTION: Match backend payload layout -> result.data[0].pronostiques
        const record = result?.data?.[0];
        const data = record?.pronostiques || record?.ranking_json || [];

        // 2. Remove loading state
        const loadingRow = document.getElementById('loading-row');
        if (loadingRow) {
            loadingRow.remove();
        }

        // 3. Render Data
        if (data.length > 0) {
            renderPodium(data);
            renderTable(data);
            
            // 4. Start Autoscroll after rendering
            if (scrollWrapper) {
                initializeAutoscroll(window.LEADERBOARD_CONFIG.scrollSpeed);
            }
        } else {
            showEmptyState("Aucune donnée disponible");
        }

    } catch (error) {
        console.error('Error fetching leaderboard:', error);
        showEmptyState("Erreur de chargement des données");
    }
}

/**
 * Renders the Top 3 Podium
 */
function renderPodium(data) {
    const podiumSection = document.getElementById('podium-section');
    if (!podiumSection || !window.LEADERBOARD_CONFIG.showPodium) return;

    // Count occurrences of each rank
    const rankCounts = {};
    const rankMap = {};
    
    data.forEach(item => {
        if (!rankCounts[item.rank]) {
            rankCounts[item.rank] = 0;
        }
        rankCounts[item.rank]++;
        
        // Store the first occurrence of each rank
        if (!rankMap[item.rank]) {
            rankMap[item.rank] = item;
        }
    });

    // Check if each rank has exactly 1 person
    const hasExactlyOneRank1 = rankCounts[1] === 1;
    const hasExactlyOneRank2 = rankCounts[2] === 1;
    const hasExactlyOneRank3 = rankCounts[3] === 1;

    // Determine which ranks to display based on hierarchy
    const shouldShowRank1 = hasExactlyOneRank1;
    const shouldShowRank2 = shouldShowRank1 && hasExactlyOneRank2;
    const shouldShowRank3 = shouldShowRank2 && hasExactlyOneRank3;

    // If nothing to show, hide the podium container
    if (!shouldShowRank1 && !shouldShowRank2 && !shouldShowRank3) {
        podiumSection.style.display = 'none';
        return;
    }

    // Show the podium container
    podiumSection.style.display = 'flex';

    let html = '<div class="podium-flex">';
    
    // Display in order: 1, 2, 3 (only if conditions are met)
    if (shouldShowRank1) {
        const item = rankMap[1];
        html += `
        <div class="podium-item first">
            <div class="trophy-container">
                <div class="trophy">
                    <div class="trophy-cup"></div>
                    <div class="trophy-handle-left"></div>
                    <div class="trophy-handle-right"></div>
                    <div class="trophy-stem"></div>
                    <div class="trophy-base"></div>
                    <div class="trophy-sparkle"></div>
                </div>
            </div>
            <div class="podium-rank">1</div>
            <div class="podium-name">${item.key || item.user}</div>
            <div class="podium-points">${item.point || 0} pts</div>
            <div class="podium-bar gold"></div>
        </div>`;
    }
    
    if (shouldShowRank2) {
        const item = rankMap[2];
        html += `
            <div class="podium-item second">
                <div class="trophy-container">
                    <div class="trophy silver-trophy">
                        <div class="trophy-cup"></div>
                        <div class="trophy-handle-left"></div>
                        <div class="trophy-handle-right"></div>
                        <div class="trophy-stem"></div>
                        <div class="trophy-base"></div>
                        <div class="trophy-sparkle"></div>
                    </div>
                </div>
                <div class="podium-rank">#2</div>
                <div class="podium-name">${item.key || item.user}</div>
                <div class="podium-points">${item.point || 0} pts</div>
                <div class="podium-bar silver"></div>
            </div>
        `;
    }
    
    if (shouldShowRank3) {
        const item = rankMap[3];
        html += `
            <div class="podium-item third">
                <div class="trophy-container">
                    <div class="trophy bronze-trophy">
                        <div class="trophy-cup"></div>
                        <div class="trophy-handle-left"></div>
                        <div class="trophy-handle-right"></div>
                        <div class="trophy-stem"></div>
                        <div class="trophy-base"></div>
                        <div class="trophy-sparkle"></div>
                    </div>
                </div>
                <div class="podium-rank">#3</div>
                <div class="podium-name">${item.key || item.user}</div>
                <div class="podium-points">${item.point || 0} pts</div>
                <div class="podium-bar bronze"></div>
            </div>
        `;
    }
    
    html += '</div>';
    podiumSection.innerHTML = html;
}

/**
 * Renders the Table Rows (Top 10 + ties at position 10, excluding podium members)
 */
function renderTable(data) {
    const tableBody = document.getElementById('table-body');
    if (!tableBody) return;

    // Get the ranks that are displayed in the podium
    const podiumRanks = new Set();
    const rankCounts = {};
    const rankMap = {};
    
    data.forEach(item => {
        if (!rankCounts[item.rank]) {
            rankCounts[item.rank] = 0;
        }
        rankCounts[item.rank]++;
        
        if (!rankMap[item.rank]) {
            rankMap[item.rank] = item;
        }
    });

    const hasExactlyOneRank1 = rankCounts[1] === 1;
    const hasExactlyOneRank2 = rankCounts[2] === 1;
    const hasExactlyOneRank3 = rankCounts[3] === 1;

    const shouldShowRank1 = hasExactlyOneRank1;
    const shouldShowRank2 = shouldShowRank1 && hasExactlyOneRank2;
    const shouldShowRank3 = shouldShowRank2 && hasExactlyOneRank3;

    // Add ranks to exclusion set only if they're displayed in podium
    if (shouldShowRank1) podiumRanks.add(1);
    if (shouldShowRank2) podiumRanks.add(2);
    if (shouldShowRank3) podiumRanks.add(3);

    // Filter out podium members from the data for table display
    const tableData = data.filter(item => !podiumRanks.has(item.rank));

    // Get top 10 entries from remaining data
    const top10 = tableData.slice(0, 10);
    
    // Check if we need to include ties at position 10
    let displayData = [...top10];
    
    if (top10.length === 10) {
        const tenthPlacePoints = top10[9].point || 0;
        
        // Find all entries after position 10 with the same points as position 10
        for (let i = 10; i < tableData.length; i++) {
            if ((tableData[i].point || 0) === tenthPlacePoints) {
                displayData.push(tableData[i]);
            } else {
                break; // Stop when points change
            }
        }
    }

    let html = '';
    displayData.forEach(item => {
        html += `
            <tr data-rank="${item.rank || '-'}">
                <td class="rank-cell"><span class="rank-badge">${item.rank || '-'}</span></td>
                <td class="name-cell"><span class="team-name">${item.key || item.user}</span></td>
                <td class="points-cell col-right">
                    <span class="points-badge">
                        <span class="pts-highlight">${item.point || 0}</span>
                        <span class="pts-label">PTS</span>
                    </span>
                </td>
            </tr>
        `;
    });
    
    tableBody.innerHTML = html;
}

/**
 * Shows an empty/error state in the table
 */
function showEmptyState(message) {
    const tableBody = document.getElementById('table-body');
    if (tableBody) {
        tableBody.innerHTML = `
            <tr>
                <td colspan="3" class="loading-status">
                    <div class="empty-state">
                        <div class="empty-text">${message}</div>
                    </div>
                </td>
            </tr>
        `;
    }
}

// --- AUTOSCROLL LOGIC ---

function initializeAutoscroll(speed) {
    const rows = scrollWrapper.querySelectorAll("tbody tr");
    
    if (rows.length <= 1) {
        if (window.parent && typeof window.parent.postMessage === "function") {
            window.parent.postMessage("stop", "*");
        }
        return;
    }

    if (scrollInterval) clearInterval(scrollInterval);
    if (animationFrameId) cancelAnimationFrame(animationFrameId);

    const speedFactor = (typeof speed === 'number' && speed > 0) ? speed : 0.5;
    const pixelsPerSecond = speedFactor * 15; 

    let currentScroll = scrollWrapper.scrollTop;
    let isScrollingDown = true;
    let pauseTimer = null;
    let lastTime = null;
    
    const scrollHeight = scrollWrapper.scrollHeight;
    const clientHeight = scrollWrapper.clientHeight;
    const maxScroll = scrollHeight - clientHeight;
    
    if (maxScroll <= 0) {
        if (window.parent && typeof window.parent.postMessage === "function") {
            window.parent.postMessage("stop", "*");
        }
        return;
    }

    function scrollStep(timestamp) {
        if (!document.getElementById("scroll-wrapper")) return;

        if (!lastTime) lastTime = timestamp;
        const deltaTime = timestamp - lastTime;
        lastTime = timestamp;

        if (pauseTimer) {
            animationFrameId = requestAnimationFrame(scrollStep);
            return;
        }

        const step = (pixelsPerSecond * deltaTime) / 1000;

        if (isScrollingDown) {
            currentScroll += step;
            if (currentScroll >= maxScroll) {
                currentScroll = maxScroll;
                pauseTimer = setTimeout(() => {
                    pauseTimer = null;
                    lastTime = null; 
                    isScrollingDown = false;
                }, 2000); 
            }
        } else {
            currentScroll -= step;
            if (currentScroll <= 0) {
                currentScroll = 0;
                pauseTimer = setTimeout(() => {
                    pauseTimer = null;
                    lastTime = null; 
                    isScrollingDown = true;
                }, 2000);
            }
        }

        scrollWrapper.scrollTop = currentScroll;
        animationFrameId = requestAnimationFrame(scrollStep);
    }

    animationFrameId = requestAnimationFrame(scrollStep);
}

// Start the process when the DOM is ready
document.addEventListener('DOMContentLoaded', initLeaderboard);