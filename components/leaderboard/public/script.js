// components/leaderboard/public/script.js

document.addEventListener('DOMContentLoaded', async () => {
    // Get config passed from EJS
    const config = window.LEADERBOARD_CONFIG || { scrollSpeed: 3000, showPodium: true };
    const scrollSpeed = Number(config.scrollSpeed) || 3000;
    const showPodium = config.showPodium;

    const podiumSection = document.getElementById('podium-section');
    const tableBody = document.getElementById('table-body');
    const scrollWrapper = document.getElementById('scroll-wrapper');

    try {
        // Fetch fresh data from the API
        const response = await fetch('/api/leaderboard');
        const result = await response.json();

        if (result.status === 'success' && result.data) {
            renderLeaderboard(result.data, showPodium);
            initializeAutoscroll(scrollSpeed);
        } else {
            renderEmptyState();
        }
    } catch (error) {
        console.error("Failed to fetch leaderboard data:", error);
        renderEmptyState();
    }

    // --- RENDERING LOGIC (Moved from Server to Client) ---

    function renderLeaderboard(rankingData, showPodium) {
        // 1. Process Podium
        const rankCounts = {};
        rankingData.forEach(item => {
            if (item && item.rank) rankCounts[item.rank] = (rankCounts[item.rank] || 0) + 1;
        });

        if (showPodium && rankingData.length > 0) {
            const podiumPositions = [2, 1, 3];
            let hasPodiumElements = false;
            
            const columnsHtml = podiumPositions.map(r => {
                const match = rankingData.find(item => item.rank === r);
                if (match && rankCounts[r] === 1) {
                    hasPodiumElements = true;
                    const cleanTrigramme = (match.key || '').toUpperCase();
                    const medalIcon = r === 1 ? '<div class="medal medal-gold"></div>' : r === 2 ? '<div class="medal medal-silver"></div>' : '<div class="medal medal-bronze"></div>';
                    const crownIcon = r === 1 ? '<div class="crown"><div class="crown-base"></div><div class="crown-points"></div></div>' : '';
                    
                    return `
                    <div id="podium-col-${r}" class="podium-column podium-${r}">
                        <div class="podium-avatar-wrap">
                            ${crownIcon}
                            <div class="podium-avatar">
                                ${medalIcon}
                                <div class="podium-name">${cleanTrigramme}</div>
                            </div>
                            <div class="podium-score">${match.point ?? 0}<span class="score-label"> PTS</span></div>
                        </div>
                        <div class="podium-pillar">
                            <div class="podium-step-number">${r}</div>
                            <div class="podium-rank-label">${r === 1 ? 'Champion' : r === 2 ? '2ème' : '3ème'}</div>
                        </div>
                    </div>`;
                }
                return '';
            }).join('');

            if (hasPodiumElements) {
                podiumSection.innerHTML = `
                    <div class="spotlight spotlight-1"></div>
                    <div class="spotlight spotlight-2"></div>
                    <div class="spotlight spotlight-3"></div>
                    ${columnsHtml}
                `;
                podiumSection.style.display = 'flex';
                scrollWrapper.style.maxHeight = '360px'; // Adjust height if podium is shown
            }
        }

        // 2. Process Table
        const tableData = showPodium ? rankingData.filter(row => row.rank > 3) : rankingData;

        if (!tableData || tableData.length === 0) {
            renderEmptyState();
        } else {
            tableBody.innerHTML = tableData.map(row => {
                const cleanName = (row.key || '').toUpperCase();
                return `
                    <tr data-rank="${row.rank}">
                        <td class="rank-cell"><div class="rank-badge"><span>${row.rank ?? '-'}</span></div></td>
                        <td class="name-cell"><span class="team-name">${cleanName || '---'}</span></td>
                        <td class="col-right points-cell">
                            <div class="points-badge">
                                <span class="pts-highlight">${row.point ?? 0}</span>
                                <span class="pts-label">PTS</span>
                            </div>
                        </td>
                    </tr>`;
            }).join('');
        }
    }

    function renderEmptyState() {
        tableBody.innerHTML = `
            <tr>
                <td colspan="3" class="loading-status">
                    <div class="empty-state">
                        <div class="empty-icon"><div class="empty-trophy"></div></div>
                        <div class="empty-text">Aucune donnée disponible pour le moment</div>
                    </div>
                </td>
            </tr>`;
    }

    // --- AUTOSCROLL LOGIC (Moved from Server to Client) ---

    function initializeAutoscroll(speed) {
        var rows = scrollWrapper.querySelectorAll("tbody tr");
        if (rows.length <= 1) {
            if (window.parent && typeof window.parent.postMessage === "function") {
                window.parent.postMessage("stop", "*");
            }
            return;
        }

        var currentIndex = 0;
        rows[currentIndex].classList.add("focused-row");

        var scrollInterval = setInterval(function() {
            if (!document.getElementById("scroll-wrapper")) {
                clearInterval(scrollInterval);
                return;
            }

            rows[currentIndex].classList.remove("focused-row");
            currentIndex++;

            if (currentIndex >= rows.length) {
                clearInterval(scrollInterval);
                if (window.parent && typeof window.parent.postMessage === "function") {
                    window.parent.postMessage("stop", "*");
                }
                return;
            }

            var targetRow = rows[currentIndex];
            targetRow.classList.add("focused-row");

            var wrapperRect = scrollWrapper.getBoundingClientRect();
            var rowRect = targetRow.getBoundingClientRect();
            var thElement = scrollWrapper.querySelector("thead");
            var headerHeight = thElement ? thElement.offsetHeight : 0;

            var relativeRowTop = rowRect.top - wrapperRect.top + scrollWrapper.scrollTop;
            var scrollTarget = relativeRowTop - (wrapperRect.height / 2) + (rowRect.height / 2) + (headerHeight / 2);
            
            scrollWrapper.scrollTo({ 
                top: Math.max(0, scrollTarget), 
                behavior: 'smooth' 
            });
        }, speed);
    }
});