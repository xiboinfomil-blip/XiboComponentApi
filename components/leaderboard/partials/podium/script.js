function renderPodium(data) {
    const podiumSection = document.getElementById('podium-section');
    if (!podiumSection) return;

    const rankCounts = {};
    const rankMap = {};
    
    data.forEach(item => {
        if (!rankCounts[item.rank]) rankCounts[item.rank] = 0;
        rankCounts[item.rank]++;
        if (!rankMap[item.rank]) rankMap[item.rank] = item;
    });

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

    const createPodiumItem = (item, rank, positionClass, medalType) => {
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
            <div class="podium-bar ${medalType}">${trophyHtml}</div>
        </div>`;
    };

    let html = '<div class="podium-flex">';
    if (show2) html += createPodiumItem(rankMap[2], 2, 'second', 'silver');
    if (show1) html += createPodiumItem(rankMap[1], 1, 'first', 'gold');
    if (show3) html += createPodiumItem(rankMap[3], 3, 'third', 'bronze');
    
    html += '</div>';
    podiumSection.innerHTML = html;
}