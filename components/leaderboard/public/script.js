const scrollWrapper = document.getElementById("scroll-wrapper");
let scrollInterval;
let animationFrameId;

/**
 * Main function to fetch and render leaderboard data
 */
async function initLeaderboard() {
    try {
        const response = await fetch('/api/leaderboard');
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const result = await response.json();
        const data = result.data || [];

        const loadingRow = document.getElementById('loading-row');
        if (loadingRow) {
            loadingRow.remove();
        }

        if (data.length > 0) {
            renderPodium(data);
            renderTable(data);
            
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

    // 1. Analyze Ranks
    const rankCounts = {};
    const rankMap = {};
    
    data.forEach(item => {
        if (!rankCounts[item.rank]) rankCounts[item.rank] = 0;
        rankCounts[item.rank]++;
        if (!rankMap[item.rank]) rankMap[item.rank] = item;
    });

    // 2. Check Uniqueness
    const isRank1Unique = rankCounts[1] === 1;
    const isRank2Unique = rankCounts[2] === 1;
    const isRank3Unique = rankCounts[3] === 1;

    const show1 = isRank1Unique;
    const show2 = show1 && isRank2Unique;
    const show3 = show2 && isRank3Unique;

    if (!show1 && !show2 && !show3) {
        podiumSection.style.display = 'none';
        return;
    }

    podiumSection.style.display = 'flex';

    // Helper to create HTML for a podium spot
    const createPodiumItem = (item, rank, positionClass, medalType) => {
        // Trophy SVG - Only for 1st place, rendered INSIDE the bar
        const trophyHtml = rank === 1 ? `
            <div class="trophy-wrapper">
                <div class="trophy">
                    <div class="trophy-cup"></div>
                    <div class="trophy-handle-left"></div>
                    <div class="trophy-handle-right"></div>
                    <div class="trophy-stem"></div>
                    <div class="trophy-base"></div>
                    <div class="trophy-sparkle"></div>
                </div>
            </div>` : '';

        return `
        <div class="podium-item ${positionClass}">
            <div class="podium-rank">${'#' + rank}</div>
            <div class="podium-name">${item.key || "Inconnu"}</div>
            <div class="podium-points">${item.point || 0} pts</div>
            <div class="podium-bar ${medalType}">
                ${trophyHtml}
            </div>
        </div>`;
    };

    let html = '<div class="podium-flex">';
    
    // ORDER: 2nd (Left) -> 1st (Center) -> 3rd (Right)
    if (show2) html += createPodiumItem(rankMap[2], 2, 'second', 'silver');
    if (show1) html += createPodiumItem(rankMap[1], 1, 'first', 'gold');
    if (show3) html += createPodiumItem(rankMap[3], 3, 'third', 'bronze');
    
    html += '</div>';
    podiumSection.innerHTML = html;
}

/**
 * Renders the Table Rows
 */
function renderTable(data) {
    const tableBody = document.getElementById('table-body');
    if (!tableBody) return;

    const podiumRanks = new Set();
    const rankCounts = {};
    
    data.forEach(item => {
        if (!rankCounts[item.rank]) rankCounts[item.rank] = 0;
        rankCounts[item.rank]++;
    });

    const isRank1Unique = rankCounts[1] === 1;
    const isRank2Unique = rankCounts[2] === 1;
    const isRank3Unique = rankCounts[3] === 1;

    if (isRank1Unique) podiumRanks.add(1);
    if (isRank1Unique && isRank2Unique) podiumRanks.add(2);
    if (isRank1Unique && isRank2Unique && isRank3Unique) podiumRanks.add(3);

    const tableData = data.filter(item => !podiumRanks.has(item.rank));
    const top10 = tableData.slice(0, 10);
    let displayData = [...top10];
    
    if (top10.length === 10) {
        const tenthPlacePoints = top10[9].point;
        for (let i = 10; i < tableData.length; i++) {
            if (tableData[i].point === tenthPlacePoints) {
                displayData.push(tableData[i]);
            } else {
                break;
            }
        }
    }

    let html = '';
    displayData.forEach(item => {
        html += `
            <tr data-rank="${item.rank || '-'}">
                <td class="rank-cell"><span class="rank-badge">${item.rank || '-'}</span></td>
                <td class="name-cell"><span class="team-name">${item.key || "Inconnu"}</span></td>
                <td class="points-cell col-right">
                    <span class="points-badge">
                        <span class="pts-highlight">${item.point ?? 0}</span>
                        <span class="pts-label">PTS</span>
                    </span>
                </td>
            </tr>
        `;
    });
    
    tableBody.innerHTML = html;
}

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

document.addEventListener('DOMContentLoaded', initLeaderboard);