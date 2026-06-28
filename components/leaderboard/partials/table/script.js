const scrollWrapper = document.getElementById("scroll-wrapper");
let scrollInterval;
let animationFrameId;

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
            } else { break; }
        }
    }

    let html = '';
    displayData.forEach(item => {
        html += `
            <tr data-rank="${item.rank || '-'}">
                <td class="rank-cell"><span class="rank-badge">${item.rank || '-'}</span></td>
                <td class="name-cell"><span class="team-name">${item.key.toUpperCase() || "Inconnu"}</span></td>
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
                pauseTimer = setTimeout(() => {
                    pauseTimer = null; lastTime = null; isScrollingDown = false;
                }, 4000); 
            }
        } else {
            currentScroll -= step;
            if (currentScroll <= 0) {
                currentScroll = 0;
                scrollWrapper.scrollTop = currentScroll;
                pauseTimer = setTimeout(() => {
                    pauseTimer = null; lastTime = null; isScrollingDown = true;
                }, 4000); 
            }
        }

        if (!pauseTimer) scrollWrapper.scrollTop = currentScroll;
        animationFrameId = requestAnimationFrame(scrollStep);
    }

    animationFrameId = requestAnimationFrame(scrollStep);
}