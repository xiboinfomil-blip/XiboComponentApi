// --- Global Scroll Variables ---
const scrollWrapper = document.getElementById("scroll-wrapper");
let scrollInterval;
let animationFrameId;

// ==========================================
// 1. TABLE RENDERING (Xibo Compatible)
// ==========================================
function renderTable(data) {
    const tableBody = document.getElementById('table-body');
    if (!tableBody) return;

    // Safety fallback if data is missing or empty
    if (!data || data.length === 0) {
        showEmptyState("Aucune donnée disponible");
        return;
    }

    // XIBO FIX: Use a standard Array instead of 'new Set()'
    const podiumRanks = [];
    const rankCounts = {};
    
    data.forEach(function(item) {
        if (!rankCounts[item.rank]) rankCounts[item.rank] = 0;
        rankCounts[item.rank]++;
    });

    const isRank1Unique = rankCounts[1] === 1;
    const isRank2Unique = rankCounts[2] === 1;
    const isRank3Unique = rankCounts[3] === 1;

    // XIBO FIX: Standard array pushing instead of .add()
    if (isRank1Unique) podiumRanks.push(1);
    if (isRank1Unique && isRank2Unique) podiumRanks.push(2);
    if (isRank1Unique && isRank2Unique && isRank3Unique) podiumRanks.push(3);

    // XIBO FIX: Filter using standard array .indexOf() instead of .has()
    let tableData = data.filter(function(item) {
        return podiumRanks.indexOf(item.rank) === -1;
    });
    
    // Safety check: If filtering accidentally hid everything, default to full data
    if (tableData.length === 0) {
        tableData = data;
    }

    const top10 = tableData.slice(0, 10);
    // XIBO FIX: Standard array merging instead of modern spread [...top10]
    let displayData = [].concat(top10);
    
    if (top10.length === 10) {
        const tenthPlacePoints = top10[9].point;
        for (let i = 10; i < tableData.length; i++) {
            if (tableData[i].point === tenthPlacePoints) {
                displayData.push(tableData[i]);
            } else { break; }
        }
    }

    let html = '';
    displayData.forEach(function(item) {
        // XIBO FIX: Safe string fallback to prevent crash if 'key' is undefined
        const teamName = item.key ? String(item.key).toUpperCase() : "INCONNU";
        
        // XIBO FIX: Replaced modern '??' with standard ternary operator
        const pointsDisplay = (item.point !== undefined && item.point !== null) ? item.point : 0;
        const rankDisplay = item.rank || '-';

        html += `
            <tr data-rank="${rankDisplay}">
                <td class="col-rank"><span class="rank-badge">${rankDisplay}</span></td>
                <td class="col-name"><span class="team-name">${teamName}</span></td>
                <td class="col-pts">
                    <span class="points-badge">
                        <span class="pts-highlight">${pointsDisplay}</span>
                        <span class="pts-label">PTS</span>
                    </span>
                </td>
            </tr>
        `;
    });
    
    tableBody.innerHTML = html;

    // Trigger scrolling safely if rows were added
    if (displayData.length > 0) {
        setTimeout(function() { 
            initializeAutoscroll(0.5); 
        }, 150); // Small delay to allow Xibo's renderer to calculate the layout heights properly
    }
}

// ==========================================
// 2. PODIUM RENDERING (Xibo Compatible)
// ==========================================
function renderPodium(data) {
    const podiumSection = document.getElementById('podium-section');
    if (!podiumSection) return;

    if (!data || data.length === 0) {
        podiumSection.style.display = 'none';
        return;
    }

    // Aggregate data by rank
    const rankMap = {};
    const rankCounts = {};
    
    data.forEach(function(item) {
        if (!rankCounts[item.rank]) rankCounts[item.rank] = 0;
        rankCounts[item.rank]++;
        // Only keep the first item found for each rank
        if (!rankMap[item.rank]) rankMap[item.rank] = item;
    });

    // Check uniqueness for podium eligibility
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

    // SVG Trophy Icon for #1
    const trophySvg = `
        <svg viewBox="0 0 24 24" fill="currentColor" class="podium-trophy-icon">
            <path d="M5 2h14a1 1 0 0 1 1 1v3c0 2.5-1.5 4.5-4 5.5V13h2a1 1 0 0 1 1 1v2a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1v-2a1 1 0 0 1 1-1h2v-1.5C5.5 11.5 4 9.5 4 7V3a1 1 0 0 1 1-1zm1 2v3c0 1.5 1 2.5 2.5 3h7c1.5-.5 2.5-1.5 2.5-3V4H6zm4 11v2h4v-2h-4z"/>
        </svg>`;

    const createPodiumItem = function(item, rank, positionClass) {
        const isGold = rank === 1;
        // XIBO FIX: Replaced modern '??' with standard ternary operator
        const pointsDisplay = (item.point !== undefined && item.point !== null) ? item.point : 0;
        const teamName = item.key ? String(item.key).toUpperCase() : "INCONNU";
        
        return `
        <div class="podium-item ${positionClass}">
            <div class="podium-content">
                <div class="podium-rank">#${rank}</div>
                <div class="podium-name">${teamName}</div>
                <div class="podium-points">${pointsDisplay} PTS</div>
            </div>
            
            <div class="podium-bar ${positionClass}">
                ${isGold ? `<div class="trophy-glow">${trophySvg}</div>` : ''}
            </div>
        </div>`;
    };

    let html = '<div class="podium-flex">';
    // Order: 2nd -> 1st -> 3rd for visual centering
    if (show2) html += createPodiumItem(rankMap[2], 2, 'second');
    if (show1) html += createPodiumItem(rankMap[1], 1, 'first');
    if (show3) html += createPodiumItem(rankMap[3], 3, 'third');
    html += '</div>';
    
    podiumSection.innerHTML = html;
}

// ==========================================
// 3. AUTOSCROLL ENGINE
// ==========================================
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
    const pixelsPerSecond = speedFactor * 8; 

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
                scrollWrapper.scrollTop = currentScroll; 
                pauseTimer = setTimeout(function() {
                    pauseTimer = null; 
                    lastTime = null; 
                    isScrollingDown = false;
                }, 4000); 
            }
        } else {
            currentScroll -= step;
            if (currentScroll <= 0) {
                currentScroll = 0;
                scrollWrapper.scrollTop = currentScroll;
                pauseTimer = setTimeout(function() {
                    pauseTimer = null; 
                    lastTime = null; 
                    isScrollingDown = true;
                }, 4000); 
            }
        }

        if (!pauseTimer) scrollWrapper.scrollTop = currentScroll;
        animationFrameId = requestAnimationFrame(scrollStep);
    }

    animationFrameId = requestAnimationFrame(scrollStep);
}

// ==========================================
// 4. UTILITIES
// ==========================================
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