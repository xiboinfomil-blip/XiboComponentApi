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

    // FIFA World Cup Trophy SVG
    const trophySvg = `
        <svg viewBox="0 0 80 100" fill="none" class="podium-trophy-icon">
            <defs>
                <!-- Gold gradient for trophy body -->
                <linearGradient id="fifaGold" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" style="stop-color:#FFE5A0;stop-opacity:1" />
                    <stop offset="20%" style="stop-color:#F5D76E;stop-opacity:1" />
                    <stop offset="40%" style="stop-color:#E8C547;stop-opacity:1" />
                    <stop offset="60%" style="stop-color:#C6A558;stop-opacity:1" />
                    <stop offset="80%" style="stop-color:#B8944F;stop-opacity:1" />
                    <stop offset="100%" style="stop-color:#9A7B3D;stop-opacity:1" />
                </linearGradient>
                
                <!-- Darker gold for shadows -->
                <linearGradient id="fifaGoldDark" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" style="stop-color:#A67C3D;stop-opacity:1" />
                    <stop offset="100%" style="stop-color:#7A5C2A;stop-opacity:1" />
                </linearGradient>
                
                <!-- Highlight gradient -->
                <linearGradient id="fifaHighlight" x1="0%" y1="0%" x2="100%" y2="0%">
                    <stop offset="0%" style="stop-color:#FFF8DC;stop-opacity:0.9" />
                    <stop offset="50%" style="stop-color:#FFE5A0;stop-opacity:0.5" />
                    <stop offset="100%" style="stop-color:#E8C547;stop-opacity:0" />
                </linearGradient>
                
                <!-- Malachite base gradient (green stone) -->
                <linearGradient id="malachite" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" style="stop-color:#2D5016;stop-opacity:1" />
                    <stop offset="50%" style="stop-color:#1E3A0F;stop-opacity:1" />
                    <stop offset="100%" style="stop-color:#15290A;stop-opacity:1" />
                </linearGradient>
            </defs>
            
            <!-- Base Platform (Malachite) -->
            <rect x="15" y="82" width="50" height="10" 
                  fill="url(#malachite)" 
                  stroke="#0F1F08" 
                  stroke-width="0.5" 
                  rx="2"/>
            
            <!-- Base ring detail -->
            <rect x="18" y="84" width="44" height="2" 
                  fill="#3D6B1F" 
                  opacity="0.6"/>
            
            <!-- Lower stem/base connection -->
            <path d="M30 72 L32 82 L48 82 L50 72 Z" 
                  fill="url(#fifaGold)" 
                  stroke="#8B6914" 
                  stroke-width="0.5"/>
            
            <!-- Main trophy body - spiral/helix shape -->
            <!-- Left figure/arm rising -->
            <path d="M25 72 C22 65, 20 55, 22 45 C24 35, 28 28, 32 22 C34 19, 36 16, 38 14" 
                  fill="url(#fifaGold)" 
                  stroke="#8B6914" 
                  stroke-width="0.5" 
                  stroke-linecap="round"/>
            
            <!-- Right figure/arm rising -->
            <path d="M55 72 C58 65, 60 55, 58 45 C56 35, 52 28, 48 22 C46 19, 44 16, 42 14" 
                  fill="url(#fifaGold)" 
                  stroke="#8B6914" 
                  stroke-width="0.5" 
                  stroke-linecap="round"/>
            
            <!-- Central globe/Earth sphere -->
            <circle cx="40" cy="28" r="14" 
                    fill="url(#fifaGold)" 
                    stroke="#8B6914" 
                    stroke-width="0.5"/>
            
            <!-- Globe highlight -->
            <ellipse cx="36" cy="24" rx="6" ry="8" 
                     fill="url(#fifaHighlight)" 
                     opacity="0.5"
                     transform="rotate(-20 36 24)"/>
            
            <!-- Latitude lines on globe -->
            <ellipse cx="40" cy="28" rx="12" ry="4" 
                     fill="none" 
                     stroke="#9A7B3D" 
                     stroke-width="0.8" 
                     opacity="0.6"/>
            
            <ellipse cx="40" cy="28" rx="10" ry="7" 
                     fill="none" 
                     stroke="#9A7B3D" 
                     stroke-width="0.8" 
                     opacity="0.5"/>
            
            <!-- Longitude line -->
            <ellipse cx="40" cy="28" rx="5" ry="13" 
                     fill="none" 
                     stroke="#9A7B3D" 
                     stroke-width="0.8" 
                     opacity="0.5"/>
            
            <!-- Left arm detail - muscle definition -->
            <path d="M28 50 C30 48, 32 46, 34 44" 
                  fill="none" 
                  stroke="#9A7B3D" 
                  stroke-width="1" 
                  opacity="0.4"/>
            
            <!-- Right arm detail - muscle definition -->
            <path d="M52 50 C50 48, 48 46, 46 44" 
                  fill="none" 
                  stroke="#9A7B3D" 
                  stroke-width="1" 
                  opacity="0.4"/>
            
            <!-- Top of trophy - where hands meet globe -->
            <path d="M34 18 C36 16, 38 15, 40 15 C42 15, 44 16, 46 18" 
                  fill="url(#fifaGoldDark)" 
                  stroke="#7A5C2A" 
                  stroke-width="0.5"/>
            
            <!-- Shine effect on left side -->
            <path d="M26 60 C24 50, 25 40, 28 32" 
                  fill="none" 
                  stroke="#FFF8DC" 
                  stroke-width="2" 
                  opacity="0.3" 
                  stroke-linecap="round"/>
            
            <!-- Shine effect on right side -->
            <path d="M54 60 C56 50, 55 40, 52 32" 
                  fill="none" 
                  stroke="#FFF8DC" 
                  stroke-width="2" 
                  opacity="0.2" 
                  stroke-linecap="round"/>
            
            <!-- Decorative bands on stem -->
            <rect x="32" y="74" width="16" height="1.5" 
                  fill="#9A7B3D" 
                  opacity="0.5" 
                  rx="0.5"/>
            
            <rect x="33" y="77" width="14" height="1.5" 
                  fill="#9A7B3D" 
                  opacity="0.4" 
                  rx="0.5"/>
        </svg>`;

    const createPodiumItem = (item, rank, positionClass, delay) => {
        const isGold = rank === 1;
        
        return `
        <div class="podium-item ${positionClass}" style="--item-delay: ${delay}s">
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
    if (show2) html += createPodiumItem(rankMap[2], 2, 'second', 0.1);
    if (show1) html += createPodiumItem(rankMap[1], 1, 'first', 0.25);
    if (show3) html += createPodiumItem(rankMap[3], 3, 'third', 0.4);
    html += '</div>';
    
    podiumSection.innerHTML = html;
}