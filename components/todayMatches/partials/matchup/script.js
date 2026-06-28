const matchupEls = {
    statusBadge: document.getElementById('match-status-badge'),
    statusLabel: document.getElementById('status-label'),
    liveDot: document.getElementById('live-indicator'),
    timer: document.getElementById('match-timer'),
    vsBadge: document.getElementById('vs-badge'),
    drawRibbon: document.getElementById('draw-ribbon'),
    card: document.getElementById('main-card'),
    teamA: {
        container: document.getElementById('team-a-container'),
        name: document.getElementById('name-a'),
        score: document.getElementById('score-a'),
        flag: document.getElementById('flag-a'),
        fallback: document.querySelector('#team-a-container .tm-flag-fallback'),
        badge: document.getElementById('badge-a'),
        crown: document.getElementById('crown-a')
    },
    teamB: {
        container: document.getElementById('team-b-container'),
        name: document.getElementById('name-b'),
        score: document.getElementById('score-b'),
        flag: document.getElementById('flag-b'),
        fallback: document.querySelector('#team-b-container .tm-flag-fallback'),
        badge: document.getElementById('badge-b'),
        crown: document.getElementById('crown-b')
    }
};

function renderMatchup(match) {
    if (!match) return;

    // Text
    const teamAName = match.team_a || 'Équipe A';
    const teamBName = match.team_b || 'Équipe B';
    
    if (matchupEls.teamA.name) matchupEls.teamA.name.textContent = teamAName;
    if (matchupEls.teamB.name) matchupEls.teamB.name.textContent = teamBName;
    
    if (matchupEls.teamA.score) matchupEls.teamA.score.textContent = (match.fulltime_a !== null && match.fulltime_a !== undefined) ? match.fulltime_a : '-';
    if (matchupEls.teamB.score) matchupEls.teamB.score.textContent = (match.fulltime_b !== null && match.fulltime_b !== undefined) ? match.fulltime_b : '-';

    // Flags
    setFlag(matchupEls.teamA, match.team_a_flag || flagUrl(match.team_a), match.team_a);
    setFlag(matchupEls.teamB, match.team_b_flag || flagUrl(match.team_b), match.team_b);

    // Ensure VS badge is visible
    if (matchupEls.vsBadge) matchupEls.vsBadge.style.display = 'flex'; 

    // Winner / Draw highlight
    applyResult(match);
}

function setFlag(teamObj, url, fallbackText) {
    if (!teamObj || !teamObj.flag || !teamObj.fallback) return;
    
    teamObj.flag.style.display = 'none';
    teamObj.fallback.style.display = 'flex';
    teamObj.fallback.textContent = fallbackText ? fallbackText.charAt(0).toUpperCase() : '?';
    
    if (url) {
        teamObj.flag.src = url;
        teamObj.flag.onload = () => { 
            teamObj.flag.style.display = 'block'; 
            teamObj.fallback.style.display = 'none'; 
        };
        teamObj.flag.onerror = () => { 
            teamObj.flag.style.display = 'none';  
            teamObj.fallback.style.display = 'flex'; 
        };
    }
}

function applyStatus(info, match) {
    if (!info) return;

    const displayStatus = info.status || 'upcoming';
    const displayLabel = info.label || 'À venir';
    const isLive = info.isLive || false;

    if (matchupEls.statusBadge) matchupEls.statusBadge.className = `tm-status-badge tm-status-${displayStatus}`;
    if (matchupEls.statusLabel) matchupEls.statusLabel.textContent = displayLabel;
    if (matchupEls.liveDot) matchupEls.liveDot.style.display = isLive ? 'block' : 'none';
}

function updateTimerDisplay(match) {
    if (!matchupEls.timer) return;

    // If scores exist, it's finished
    if (match.fulltime_a !== null && match.fulltime_a !== undefined && 
        match.fulltime_b !== null && match.fulltime_b !== undefined) {
        matchupEls.timer.textContent = '';
        return; 
    }

    // Use statusInfo from API
    if (match.statusInfo) {
        if (match.statusInfo.status === 'finished') {
            matchupEls.timer.textContent = '';
        } else {
            matchupEls.timer.textContent = match.statusInfo.timeString || '';
            matchupEls.timer.classList.toggle('is-live', match.statusInfo.isLive || false);
        }
    }
}

function applyResult(match) {
    if (!match || !matchupEls.card) return;

    const card = matchupEls.card;
    card.classList.remove('is-winner', 'is-draw');
    
    if (matchupEls.teamA.container) matchupEls.teamA.container.classList.remove('is-winner', 'is-loser');
    if (matchupEls.teamB.container) matchupEls.teamB.container.classList.remove('is-winner', 'is-loser');
    
    if (matchupEls.teamA.badge) { matchupEls.teamA.badge.style.opacity = '0'; matchupEls.teamA.badge.innerHTML = ''; }
    if (matchupEls.teamB.badge) { matchupEls.teamB.badge.style.opacity = '0'; matchupEls.teamB.badge.innerHTML = ''; }

    const a = match.fulltime_a;
    const b = match.fulltime_b;

    if (a === null || a === undefined || b === null || b === undefined) return;

    const sa = parseInt(a);
    const sb = parseInt(b);

    if (sa === sb) {
        card.classList.add('is-draw');
    } else {
        card.classList.add('is-winner');
        const winner = sa > sb ? matchupEls.teamA : matchupEls.teamB;
        const loser = sa > sb ? matchupEls.teamB : matchupEls.teamA;

        if (winner.container) winner.container.classList.add('is-winner');
        if (loser.container) loser.container.classList.add('is-loser');

        if (winner.badge) {
            winner.badge.innerHTML = `
                <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M7 3v2H3v4c0 1.65 1.35 3 3 3h.72c.75 2.48 2.82 4.34 5.28 4.82V19h-3v2h8v-2h-3v-2.18c2.46-.48 4.53-2.34 5.28-4.82H18c1.65 0 3-1.35 3-3V5h-4V3H7zm0 7c-1.1 0-2-.9-2-2V6h2v4zm12-2c0 1.1-.9 2-2 2V6h2v4z"/>
                </svg>
                <span>Vainqueur</span>`;
            winner.badge.style.opacity = '1';
        }
    }
}

function flagUrl(name) {
    if (!name) return null;
    return `assets/flags/${name.replace(/ /g, '_')}.png`;
}