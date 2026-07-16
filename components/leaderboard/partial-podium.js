function renderPodium(data) {
    const podiumSection = document.getElementById('podium-section');
    if (!podiumSection) return;

    const rankMap = {};
    const rankCounts = {};
    
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

    // --- BEAUTIFUL TROPHY SVG ---
    const trophySvg = `
        <svg viewBox="0 0 100 120" class="podium-trophy-icon" xmlns="http://www.w3.org/2000/svg">
            <defs>
                <linearGradient id="goldMain" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" style="stop-color:#FFF6D5" />
                    <stop offset="20%" style="stop-color:#F9E076" />
                    <stop offset="50%" style="stop-color:#D4AF37" />
                    <stop offset="80%" style="stop-color:#997B26" />
                    <stop offset="100%" style="stop-color:#755818" />
                </linearGradient>
                <linearGradient id="goldShadow" x1="0%" y1="0%" x2="100%" y2="0%">
                    <stop offset="0%" style="stop-color:#8B6914" />
                    <stop offset="50%" style="stop-color:#5C450E" />
                    <stop offset="100%" style="stop-color:#8B6914" />
                </linearGradient>
                <linearGradient id="shine" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" style="stop-color:#FFFFFF;stop-opacity:0.8" />
                    <stop offset="100%" style="stop-color:#FFFFFF;stop-opacity:0" />
                </linearGradient>
                <linearGradient id="baseMat" x1="0%" y1="0%" x2="0%" y2="100%">
                    <stop offset="0%" style="stop-color:#4A3B2A" />
                    <stop offset="100%" style="stop-color:#2C2216" />
                </linearGradient>
            </defs>
            <g class="trophy-body">
                <path d="M15 35 C 5 35, 5 65, 25 70" fill="none" stroke="url(#goldShadow)" stroke-width="6" stroke-linecap="round"/>
                <path d="M85 35 C 95 35, 95 65, 75 70" fill="none" stroke="url(#goldShadow)" stroke-width="6" stroke-linecap="round"/>
                <rect x="35" y="95" width="30" height="8" rx="2" fill="url(#baseMat)" stroke="#1a120b" stroke-width="1"/>
                <rect x="30" y="103" width="40" height="6" rx="2" fill="url(#baseMat)" stroke="#1a120b" stroke-width="1"/>
                <rect x="42" y="75" width="16" height="20" fill="url(#goldMain)" stroke="#755818" stroke-width="0.5"/>
                <path d="M25 30 Q 25 80, 50 80 Q 75 80, 75 30 L 70 30 Q 70 70, 50 70 Q 30 70, 30 30 Z" fill="url(#goldMain)" stroke="#755818" stroke-width="1"/>
                <ellipse cx="50" cy="30" rx="25" ry="6" fill="none" stroke="#FFF6D5" stroke-width="2"/>
                <ellipse cx="50" cy="30" rx="25" ry="6" fill="url(#goldShadow)" opacity="0.3"/>
                <path d="M25 35 C 10 35, 10 60, 28 65" fill="none" stroke="url(#goldMain)" stroke-width="5" stroke-linecap="round"/>
                <path d="M75 35 C 90 35, 90 60, 72 65" fill="none" stroke="url(#goldMain)" stroke-width="5" stroke-linecap="round"/>
                <path d="M35 35 Q 35 60, 45 70" fill="none" stroke="url(#shine)" stroke-width="3" opacity="0.6" stroke-linecap="round"/>
                <circle cx="30" cy="40" r="2" fill="white" opacity="0.4"/>
            </g>
        </svg>`;

    const createPodiumItem = (item, rank, positionClass, delay) => {
        return `
        <div class="podium-item ${positionClass}" style="--item-delay: ${delay}s">
            <div class="podium-content">
                <div class="trophy-glow">
                    ${trophySvg}
                </div>
                <div class="podium-meta">
                    <div class="podium-rank">#${rank}</div>
                    <div class="podium-name" title="${item.key || "INCONNU"}">
                        ${(item.key || "INCONNU").toUpperCase()}
                    </div>
                </div>
            </div>
            
            <div class="podium-bar ${positionClass}">
                <div class="podium-bar-points burning-points">${item.point ?? 0} PTS</div>
            </div>
        </div>`;
    };

    let html = '<div class="podium-flex">';
    if (show2) html += createPodiumItem(rankMap[2], 2, 'second', 0.1);
    if (show1) html += createPodiumItem(rankMap[1], 1, 'first', 0.25);
    if (show3) html += createPodiumItem(rankMap[3], 3, 'third', 0.4);
    html += '</div>';
    
    podiumSection.innerHTML = html;
}