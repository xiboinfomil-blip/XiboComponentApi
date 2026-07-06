const matchupEls = {
    statusBadge: document.getElementById('match-status-badge-matchup'),
    statusLabel: document.getElementById('status-label-matchup'),
    liveDot: document.getElementById('live-indicator-matchup'),
    timer: document.getElementById('match-timer-matchup'),
    vsBadge: document.getElementById('vs-badge-matchup'),
    drawRibbon: document.getElementById('draw-ribbon-matchup'),
    card: document.getElementById('main-card-matchup') || document.querySelector('.tm-matchup-matchup')?.parentElement,
    teamA: {
        container: document.getElementById('team-a-container-matchup'),
        name: document.getElementById('name-a-matchup'),
        score: document.getElementById('score-a-matchup'),
        flag: document.getElementById('flag-a-matchup'),
        fallback: document.querySelector('#team-a-container-matchup .tm-flag-fallback-matchup'),
        badge: document.getElementById('badge-a-matchup'),
        crown: document.getElementById('crown-a-matchup')
    },
    teamB: {
        container: document.getElementById('team-b-container-matchup'),
        name: document.getElementById('name-b-matchup'),
        score: document.getElementById('score-b-matchup'),
        flag: document.getElementById('flag-b-matchup'),
        fallback: document.querySelector('#team-b-container-matchup .tm-flag-fallback-matchup'),
        badge: document.getElementById('badge-b-matchup'),
        crown: document.getElementById('crown-b-matchup')
    }
};

// =========================================
// STATE TRACKING (Prevents Animation Spam)
// =========================================
let currentMatchId = null;
let prevFlags = { a: null, b: null };
let prevResultState = null; // 'draw', 'a', 'b', or null
let prevScores = { a: null, b: null };

function renderMatchup(match) {
    if (matchupEls.card && matchupEls.card.classList.contains('is-loading')) return;

    const normalizedMatch = match; 
    if (!normalizedMatch) return;

    // Check if this is a new match to trigger entrance animations ONLY ONCE
    const matchId = normalizedMatch.id || normalizedMatch.matchId || normalizedMatch.fixture?.id;
    const isNewMatch = matchId && matchId !== currentMatchId;
    
    if (isNewMatch) {
        currentMatchId = matchId;
        triggerEntranceAnimations();
        resetFlagAnimations();
        
        // Reset state trackers for the new match
        prevFlags = { a: null, b: null };
        prevResultState = null;
        prevScores = { a: null, b: null };
    }

    // --- TEXT UPDATES ---
    const teamAName = normalizedMatch.homeTeam || normalizedMatch.team_a || normalizedMatch.teamA?.name || 'Équipe A';
    const teamBName = normalizedMatch.awayTeam || normalizedMatch.team_b || normalizedMatch.teamB?.name || 'Équipe B';
    
    if (matchupEls.teamA.name && matchupEls.teamA.name.textContent !== teamAName) {
        matchupEls.teamA.name.textContent = teamAName;
    }
    if (matchupEls.teamB.name && matchupEls.teamB.name.textContent !== teamBName) {
        matchupEls.teamB.name.textContent = teamBName;
    }
    
    // --- SCORE UPDATES ---
    const scoreA = normalizedMatch.scoreInfo?.fulltime?.home ?? normalizedMatch.teamA?.score;
    const scoreB = normalizedMatch.scoreInfo?.fulltime?.away ?? normalizedMatch.teamB?.score;

    updateScoreWithAnimation(matchupEls.teamA.score, scoreA, 'a');
    updateScoreWithAnimation(matchupEls.teamB.score, scoreB, 'b');

    // --- FLAGS (Only update if URL changed) ---
    const flagUrlA = flagUrl(teamAName);
    const flagUrlB = flagUrl(teamBName);
    
    if (isNewMatch || prevFlags.a !== flagUrlA) {
        setFlag(matchupEls.teamA, flagUrlA, teamAName, 'a');
    }
    if (isNewMatch || prevFlags.b !== flagUrlB) {
        setFlag(matchupEls.teamB, flagUrlB, teamBName, 'b');
    }

    // --- VS BADGE FORCE SHOW ---
    if (matchupEls.vsBadge) matchupEls.vsBadge.style.display = 'flex';

    // --- STATUS & LIVE EFFECTS ---
    applyStatus(normalizedMatch.statusInfo || normalizedMatch.status, normalizedMatch);
    
    // --- TIMER DISPLAY ---
    updateTimerDisplay(normalizedMatch);

    // --- RESULT LOGIC ---
    applyResult(normalizedMatch);

    // --- EVENTS & PENALTIES (Delegated to partial-events.js) ---
    if (typeof renderEventsPartial === 'function') {
        renderEventsPartial(normalizedMatch);
    }
}

function updateScoreWithAnimation(el, newScore, teamKey) {
    if (!el) return;
    
    const displayScore = (newScore !== null && newScore !== undefined) ? newScore : '-';
    
    // Only trigger pop animation if score actually changed
    if (prevScores[teamKey] !== null && String(prevScores[teamKey]) !== String(displayScore)) {
        el.classList.remove('score-update-pop');
        void el.offsetWidth; 
        el.classList.add('score-update-pop');
        setTimeout(() => el.classList.remove('score-update-pop'), 500);
    }
    
    // Only update DOM if text actually changed
    if (el.textContent !== String(displayScore)) {
        el.textContent = displayScore;
    }
    prevScores[teamKey] = displayScore;
}

function resetFlagAnimations() {
    const flagContainers = document.querySelectorAll('.tm-flag-container-matchup');
    flagContainers.forEach(container => {
        container.style.animation = 'none';
        container.offsetHeight; 
        container.style.animation = null;
    });
}

function triggerEntranceAnimations() {
    const teams = [matchupEls.teamA, matchupEls.teamB];
    teams.forEach((team, index) => {
        if (team.container) {
            team.container.classList.remove('tm-team-a-matchup', 'tm-team-b-matchup');
            void team.container.offsetWidth;
            setTimeout(() => {
                team.container.classList.add(index === 0 ? 'tm-team-a-matchup' : 'tm-team-b-matchup');
            }, 50);
        }
    });
}

function setFlag(teamObj, url, fallbackText, teamKey) {
    if (!teamObj || !teamObj.flag || !teamObj.fallback) return;
    
    prevFlags[teamKey] = url; // Update tracker
    
    teamObj.flag.style.display = 'none';
    teamObj.fallback.style.display = 'flex';
    teamObj.fallback.textContent = fallbackText ? fallbackText.charAt(0).toUpperCase() : '?';
    
    if (url) {
        const img = new Image();
        
        img.onload = () => { 
            if (prevFlags[teamKey] !== url) return; // Prevent race conditions
            
            teamObj.flag.src = url;
            teamObj.flag.style.display = 'block'; 
            teamObj.fallback.style.display = 'none'; 
            
            const flagContainer = teamObj.flag.closest('.tm-flag-container-matchup');
            if (flagContainer) {
                flagContainer.style.animation = 'none';
                void flagContainer.offsetWidth;
                flagContainer.style.animation = 'flagPopIn 0.7s cubic-bezier(0.34, 1.56, 0.64, 1) forwards';
            }
        };
        
        img.onerror = () => { 
            if (prevFlags[teamKey] !== url) return;
            teamObj.flag.style.display = 'none';  
            teamObj.fallback.style.display = 'flex'; 
        };
        
        img.src = url;
    }
}

function applyStatus(info, match) {
    if (!info) return;

    const displayStatus = info.status || info.state || 'upcoming';
    const isLive = info.isLive || false;

    if (matchupEls.statusBadge) {
        matchupEls.statusBadge.classList.remove('tm-status-upcoming', 'tm-status-live', 'tm-status-finished');
        matchupEls.statusBadge.classList.add(`tm-status-${displayStatus}`);
    }
    
    if (matchupEls.statusLabel && matchupEls.statusLabel.textContent !== info.label) {
        matchupEls.statusLabel.textContent = info.label;
    }
    
    const vsBadge = matchupEls.vsBadge;
    const timer = matchupEls.timer;
    
    if (isLive) {
        if (vsBadge && !vsBadge.classList.contains('is-live-pulse')) vsBadge.classList.add('is-live-pulse');
        if (timer && !timer.classList.contains('is-live-pulse')) timer.classList.add('is-live-pulse');
    } else {
        if (vsBadge) vsBadge.classList.remove('is-live-pulse');
        if (timer) timer.classList.remove('is-live-pulse');
    }
}

function updateTimerDisplay(match) {
    if (!matchupEls.timer) return;

    const statusInfo = match.statusInfo || match.status;
    
    if (statusInfo) {
        const time = statusInfo.timeString || 
                     statusInfo.time || 
                     statusInfo.clock || 
                     match.matchTime?.display ||
                     match.time || 
                     '--:--';
        
        if (matchupEls.timer.textContent !== time) {
            matchupEls.timer.textContent = time;
        }
        
        if (statusInfo.isLive) {
            if (!matchupEls.timer.classList.contains('is-live-pulse')) {
                matchupEls.timer.classList.add('is-live-pulse');
            }
        } else {
            matchupEls.timer.classList.remove('is-live-pulse');
        }
    } else {
        if (matchupEls.timer.textContent !== '--:--') {
            matchupEls.timer.textContent = '--:--';
        }
        matchupEls.timer.classList.remove('is-live-pulse');
    }
}

function applyResult(match) {
    if (!match || !matchupEls.card) return;

    const card = matchupEls.card;
    
    const isFinished = match.statusInfo?.isFinished === true || 
                       match.statusInfo?.status === 'finished';
    
    // IF MATCH IS NOT FINISHED
    if (!isFinished) {
        prevResultState = null;
        card.classList.remove('is-winner', 'is-draw');
        
        if (matchupEls.teamA.container) matchupEls.teamA.container.classList.remove('is-winner', 'is-loser');
        if (matchupEls.teamB.container) matchupEls.teamB.container.classList.remove('is-winner', 'is-loser');
        
        if (matchupEls.teamA.badge) { matchupEls.teamA.badge.style.opacity = '0'; matchupEls.teamA.badge.innerHTML = ''; }
        if (matchupEls.teamB.badge) { matchupEls.teamB.badge.style.opacity = '0'; matchupEls.teamB.badge.innerHTML = ''; }
        
        if (matchupEls.teamA.crown) matchupEls.teamA.crown.style.animation = '';
        if (matchupEls.teamB.crown) matchupEls.teamB.crown.style.animation = '';
        
        if (matchupEls.drawRibbon) {
            matchupEls.drawRibbon.style.display = 'none';
            matchupEls.drawRibbon.style.animation = '';
        }
        
        return; 
    }
    
    // DETERMINE WINNER LOGIC...
    const a = match.scoreInfo?.fulltime?.home ?? match.teamA?.score;
    const b = match.scoreInfo?.fulltime?.away ?? match.teamB?.score;
    const hasPenalties = match.scoreInfo?.hasPenalties || match.penalty !== null;
    
    let winnerTeam = null;
    if (match.winner) {
        if (match.winner === 'home') winnerTeam = match.homeTeam || match.team_a || match.teamA?.name;
        else if (match.winner === 'away') winnerTeam = match.awayTeam || match.team_b || match.teamB?.name;
        else if (match.winner === 'draw') winnerTeam = 'Draw';
    } else if (match.teamA?.winner || match.teamB?.winner) {
        if (match.teamA.winner) winnerTeam = match.teamA.name;
        else if (match.teamB.winner) winnerTeam = match.teamB.name;
        else if (match.teamA.isDraw) winnerTeam = 'Draw';
    }

    let newState = null;
    if (winnerTeam === 'Draw' || winnerTeam === 'draw') newState = 'draw';
    else if (winnerTeam) {
        const homeTeam = match.homeTeam || match.team_a || match.teamA?.name;
        newState = winnerTeam === homeTeam ? 'a' : 'b';
    }

    if (prevResultState === newState) return;
    prevResultState = newState;

    // CLEAR PREVIOUS STATES
    card.classList.remove('is-winner', 'is-draw');
    if (matchupEls.teamA.container) matchupEls.teamA.container.classList.remove('is-winner', 'is-loser');
    if (matchupEls.teamB.container) matchupEls.teamB.container.classList.remove('is-winner', 'is-loser');
    
    if (matchupEls.teamA.badge) { matchupEls.teamA.badge.style.opacity = '0'; matchupEls.teamA.badge.innerHTML = ''; }
    if (matchupEls.teamB.badge) { matchupEls.teamB.badge.style.opacity = '0'; matchupEls.teamB.badge.innerHTML = ''; }
    
    if (matchupEls.teamA.crown) matchupEls.teamA.crown.style.animation = '';
    if (matchupEls.teamB.crown) matchupEls.teamB.crown.style.animation = '';
    
    if (matchupEls.drawRibbon) {
        matchupEls.drawRibbon.style.display = 'none';
        matchupEls.drawRibbon.style.animation = '';
    }

    // APPLY NEW STATES
    if (newState === 'draw') {
        card.classList.add('is-draw');
        if (matchupEls.drawRibbon) {
            matchupEls.drawRibbon.style.display = 'flex';
            matchupEls.drawRibbon.style.animation = 'none';
            void matchupEls.drawRibbon.offsetWidth;
            matchupEls.drawRibbon.style.animation = 'drawRibbonExpand 0.6s cubic-bezier(0.34, 1.56, 0.64, 1) forwards';
            
            const textSpan = matchupEls.drawRibbon.querySelector('.tm-draw-text-matchup');
            if(textSpan) textSpan.textContent = hasPenalties ? 'Match Nul (Après Tirs au But)' : 'Match Nul';
        }
    } else if (newState === 'a' || newState === 'b') {
        card.classList.add('is-winner');
        
        let winnerObj = newState === 'a' ? matchupEls.teamA : matchupEls.teamB;
        let loserObj = newState === 'a' ? matchupEls.teamB : matchupEls.teamA;

        if (winnerObj.container) winnerObj.container.classList.add('is-winner');
        if (loserObj.container) loserObj.container.classList.add('is-loser');
        
        if (winnerObj.crown) {
            winnerObj.crown.style.animation = 'none';
            void winnerObj.crown.offsetWidth;
            winnerObj.crown.style.animation = 'badgeSlideUp 0.5s cubic-bezier(0.34, 1.56, 0.64, 1) forwards';
        }
    }
}

function flagUrl(name) {
    if (!name) return null;
    const cleanName = name.replace(/[^a-zA-Z0-9]/g, '_');
    return `/assets/flags/${cleanName}.png`;
}

// Dynamic Styles Injection (Cleaned up to remove duplicate event styles)
const style = document.createElement('style');
style.textContent = `
    @keyframes drawRibbonExpand {
        0% { opacity: 0; transform: translate(-50%, -50%) scaleX(0.5); }
        100% { opacity: 1; transform: translate(-50%, -50%) scaleX(1); }
    }
    
    @keyframes badgeSlideUp {
        0% { 
            opacity: 0; 
            transform: translateX(-50%) translateY(20px) scale(0.5) rotate(-10deg); 
            filter: drop-shadow(0 0 0px rgba(255, 215, 0, 0));
        }
        60% {
            opacity: 1;
            transform: translateX(-50%) translateY(-5px) scale(1.1) rotate(5deg);
        }
        100% { 
            opacity: 1; 
            transform: translateX(-50%) translateY(0) scale(1) rotate(0deg); 
            filter: 
                drop-shadow(0 1px 0px #FFF8DC) 
                drop-shadow(0 2px 4px rgba(0, 0, 0, 0.6)) 
                drop-shadow(0 0 15px rgba(255, 215, 0, 0.7)) 
                drop-shadow(0 0 30px rgba(255, 165, 0, 0.4));
        }
    }

    @keyframes scorePopUpdate {
        0% { transform: scale(1); color: #fff; }
        50% { transform: scale(1.3); color: #fbbf24; text-shadow: 0 0 30px rgba(251, 191, 36, 0.8); }
        100% { transform: scale(1); color: #fff; }
    }
    .score-update-pop {
        animation: scorePopUpdate 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275);
    }

    @keyframes livePulseGlow {
        0% { box-shadow: 0 0 0 0 rgba(59, 130, 246, 0.4); border-color: rgba(255, 255, 255, 0.25); }
        50% { box-shadow: 0 0 20px 5px rgba(59, 130, 246, 0.2); border-color: rgba(59, 130, 246, 0.6); }
        100% { box-shadow: 0 0 0 0 rgba(59, 130, 246, 0.4); border-color: rgba(255, 255, 255, 0.25); }
    }
    
    .is-live-pulse {
        animation: livePulseGlow 2s infinite;
    }
    
    .tm-vs-badge-matchup.is-live-pulse .tm-vs-text-matchup {
        color: #60a5fa;
        text-shadow: 0 0 15px rgba(59, 130, 246, 0.8);
    }
    
    /* SAFETY NETS */
    .tm-vs-badge-matchup {
        display: flex !important;
        visibility: visible !important;
    }
    .tm-team-matchup {
        min-height: clamp(200px, 40vh, 400px);
    }
`;
document.head.appendChild(style);