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

/**
 * Helper to map the specific API response to the format expected by renderMatchup
 */
function mapApiToMatch(apiMatch) {
    if (!apiMatch) return null;

    const now = new Date();
    // Handle date parsing with timezone offset
    const matchDate = new Date(apiMatch.date.replace(' ', 'T') + '+04:00');
    const isFinished = apiMatch.current_status === 'finished';
    
    // Determine simple status label for UI
    let statusLabel = 'À venir';
    let statusKey = 'upcoming';
    let isLive = false;
    let timeString = '';

    // Format time as HH:mm
    const timeOptions = { hour: '2-digit', minute: '2-digit' };
    const formattedTime = !isNaN(matchDate.getTime()) 
        ? matchDate.toLocaleTimeString('fr-FR', timeOptions) 
        : apiMatch.date.split(' ')[1]?.substring(0, 5);

    if (isFinished) {
        statusLabel = 'Terminé';
        statusKey = 'finished';
        timeString = formattedTime;
    } else {
        // Simple check for live: if date is in past but not finished
        if (now > matchDate && !isFinished) {
            statusLabel = 'En direct';
            statusKey = 'live';
            isLive = true;
            timeString = 'LIVE';
        } else {
            statusLabel = 'À venir';
            statusKey = 'upcoming';
            timeString = formattedTime;
        }
    }

    return {
        team_a: apiMatch.team_a,
        team_b: apiMatch.team_b,
        fulltime_a: apiMatch.fulltime_a,
        fulltime_b: apiMatch.fulltime_b,
        date: apiMatch.date,
        // Constructing a statusInfo object to keep applyStatus/updateTimerDisplay compatible
        statusInfo: {
            status: statusKey,
            timeString: timeString,
            isLive: isLive,
            label: statusLabel
        },
        // Keep original data for other uses if needed
        raw: apiMatch
    };
}

function renderMatchup(match) {
    // Check if we're in loading state
    if (matchupEls.card && matchupEls.card.classList.contains('is-loading')) {
        return;
    }

    // Normalize the API data first
    const normalizedMatch = mapApiToMatch(match);
    if (!normalizedMatch) return;

    // Text
    const teamAName = normalizedMatch.team_a || 'Équipe A';
    const teamBName = normalizedMatch.team_b || 'Équipe B';
    
    if (matchupEls.teamA.name) matchupEls.teamA.name.textContent = teamAName;
    if (matchupEls.teamB.name) matchupEls.teamB.name.textContent = teamBName;
    
    if (matchupEls.teamA.score) matchupEls.teamA.score.textContent = (normalizedMatch.fulltime_a !== null && normalizedMatch.fulltime_a !== undefined) ? normalizedMatch.fulltime_a : '-';
    if (matchupEls.teamB.score) matchupEls.teamB.score.textContent = (normalizedMatch.fulltime_b !== null && normalizedMatch.fulltime_b !== undefined) ? normalizedMatch.fulltime_b : '-';

    // Flags - Reset animations before setting new flags
    resetFlagAnimations();
    setFlag(matchupEls.teamA, flagUrl(normalizedMatch.team_a), normalizedMatch.team_a);
    setFlag(matchupEls.teamB, flagUrl(normalizedMatch.team_b), normalizedMatch.team_b);

    // Ensure VS badge is visible
    if (matchupEls.vsBadge) matchupEls.vsBadge.style.display = 'flex'; 

    // Status & Timer
    applyStatus(normalizedMatch.statusInfo, normalizedMatch);
    updateTimerDisplay(normalizedMatch);

    // Winner / Draw highlight
    applyResult(normalizedMatch);
    
    // Trigger entrance animations after content is set
    triggerEntranceAnimations();
}

function resetFlagAnimations() {
    // Reset flag containers to allow re-animation
    const flagContainers = document.querySelectorAll('.tm-flag-container');
    flagContainers.forEach(container => {
        container.style.animation = 'none';
        container.offsetHeight; // Trigger reflow
        container.style.animation = null;
    });
}

function triggerEntranceAnimations() {
    // Force re-trigger of CSS animations by removing and re-adding elements
    const teams = [matchupEls.teamA, matchupEls.teamB];
    
    teams.forEach((team, index) => {
        if (team.container) {
            // Remove animation classes
            team.container.classList.remove('tm-team-a', 'tm-team-b');
            
            // Trigger reflow
            void team.container.offsetWidth;
            
            // Re-add appropriate class with delay
            setTimeout(() => {
                team.container.classList.add(index === 0 ? 'tm-team-a' : 'tm-team-b');
            }, 50);
        }
    });
}

function setFlag(teamObj, url, fallbackText) {
    if (!teamObj || !teamObj.flag || !teamObj.fallback) return;
    
    // Reset display
    teamObj.flag.style.display = 'none';
    teamObj.fallback.style.display = 'flex';
    teamObj.fallback.textContent = fallbackText ? fallbackText.charAt(0).toUpperCase() : '?';
    
    if (url) {
        // Create new image to avoid caching issues
        const img = new Image();
        img.onload = () => { 
            teamObj.flag.src = url;
            teamObj.flag.style.display = 'block'; 
            teamObj.fallback.style.display = 'none'; 
            
            // Trigger flag animation
            const flagContainer = teamObj.flag.closest('.tm-flag-container');
            if (flagContainer) {
                flagContainer.style.animation = 'none';
                void flagContainer.offsetWidth; // Trigger reflow
                flagContainer.style.animation = 'flagPopIn 0.7s cubic-bezier(0.34, 1.56, 0.64, 1) forwards';
            }
        };
        img.onerror = () => { 
            teamObj.flag.style.display = 'none';  
            teamObj.fallback.style.display = 'flex'; 
        };
        img.src = url;
    }
}

function applyStatus(info, match) {
    if (!info) return;

    const displayStatus = info.status || 'upcoming';
    const displayLabel = info.label || (displayStatus === 'finished' ? 'Terminé' : 'À venir');
    const isLive = info.isLive || false;

    if (matchupEls.statusBadge) {
        // Remove old status classes
        matchupEls.statusBadge.classList.remove('tm-status-upcoming', 'tm-status-live', 'tm-status-finished');
        // Add new status class
        matchupEls.statusBadge.classList.add(`tm-status-${displayStatus}`);
    }
    
    if (matchupEls.statusLabel) matchupEls.statusLabel.textContent = displayLabel;
    if (matchupEls.liveDot) matchupEls.liveDot.style.display = isLive ? 'block' : 'none';
}

function updateTimerDisplay(match) {
    if (!matchupEls.timer) return;

    // If scores exist and status is finished, clear timer
    if (match.statusInfo && match.statusInfo.status === 'finished') {
        matchupEls.timer.textContent = '';
        matchupEls.timer.classList.remove('is-live');
        return; 
    }

    // Use statusInfo from mapped data
    if (match.statusInfo) {
        matchupEls.timer.textContent = match.statusInfo.timeString || '';
        matchupEls.timer.classList.toggle('is-live', match.statusInfo.isLive || false);
    }
}

function applyResult(match) {
    if (!match || !matchupEls.card) return;

    const card = matchupEls.card;
    card.classList.remove('is-winner', 'is-draw');
    
    if (matchupEls.teamA.container) matchupEls.teamA.container.classList.remove('is-winner', 'is-loser');
    if (matchupEls.teamB.container) matchupEls.teamB.container.classList.remove('is-winner', 'is-loser');
    
    if (matchupEls.teamA.badge) { 
        matchupEls.teamA.badge.style.opacity = '0'; 
        matchupEls.teamA.badge.innerHTML = ''; 
    }
    if (matchupEls.teamB.badge) { 
        matchupEls.teamB.badge.style.opacity = '0'; 
        matchupEls.teamB.badge.innerHTML = ''; 
    }

    const a = match.fulltime_a;
    const b = match.fulltime_b;

    // Only apply result if both scores are present
    if (a === null || a === undefined || b === null || b === undefined) {
        // Hide draw ribbon if no scores
        if (matchupEls.drawRibbon) matchupEls.drawRibbon.style.display = 'none';
        return;
    }

    const sa = parseInt(a);
    const sb = parseInt(b);

    if (sa === sb) {
        card.classList.add('is-draw');
        if (matchupEls.drawRibbon) {
            matchupEls.drawRibbon.style.display = 'flex';
            // Animate draw ribbon
            matchupEls.drawRibbon.style.animation = 'none';
            void matchupEls.drawRibbon.offsetWidth;
            matchupEls.drawRibbon.style.animation = 'drawRibbonExpand 0.6s cubic-bezier(0.34, 1.56, 0.64, 1) forwards';
        }
    } else {
        if (matchupEls.drawRibbon) matchupEls.drawRibbon.style.display = 'none';
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
            
            // Animate badge appearance
            winner.badge.style.animation = 'none';
            void winner.badge.offsetWidth;
            winner.badge.style.animation = 'badgeSlideUp 0.5s cubic-bezier(0.34, 1.56, 0.64, 1) forwards';
        }
    }
}

function flagUrl(name) {
    if (!name) return null;
    // Ensure the filename matches the API team names (e.g., "Korea Republic" -> "Korea_Republic.png")
    return `/assets/flags/${name.replace(/ /g, '_')}.png`;
}

// Add CSS animation keyframes dynamically
const style = document.createElement('style');
style.textContent = `
    @keyframes drawRibbonExpand {
        0% {
            opacity: 0;
            transform: translate(-50%, -50%) scaleX(0.5);
        }
        100% {
            opacity: 1;
            transform: translate(-50%, -50%) scaleX(1);
        }
    }
    
    @keyframes badgeSlideUp {
        0% {
            opacity: 0;
            transform: translateY(10px);
        }
        100% {
            opacity: 1;
            transform: translateY(0);
        }
    }
`;
document.head.appendChild(style);