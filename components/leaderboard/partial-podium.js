// podium.js
function renderPodium(data) {
    const podiumSection = document.getElementById('podium-section');
    if (!podiumSection) return;

    // Aggregate data by rank
    const rankMap = {};
    const rankCounts = {};
    
    data.forEach(item => {
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

    const createPodiumItem = (item, rank, positionClass) => {
        const isGold = rank === 1;
        
        return `
        <div class="podium-item ${positionClass}">
            <div class="podium-content">
                <div class="podium-rank">#${rank}</div>
                <div class="podium-name">${(item.key || "INCONNU").toUpperCase()}</div>
                <div class="podium-points">${item.point ?? 0} PTS</div>
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