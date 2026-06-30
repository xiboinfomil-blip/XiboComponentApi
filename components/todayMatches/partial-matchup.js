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
        crown: document.getElementById('crown-a-matchup'),
        penaltyScore: document.getElementById('penalty-score-a-matchup'),
        penaltySection: document.getElementById('penalty-a-matchup'),
        events: document.getElementById('events-a-matchup')
    },
    teamB: {
        container: document.getElementById('team-b-container-matchup'),
        name: document.getElementById('name-b-matchup'),
        score: document.getElementById('score-b-matchup'),
        flag: document.getElementById('flag-b-matchup'),
        fallback: document.querySelector('#team-b-container-matchup .tm-flag-fallback-matchup'),
        badge: document.getElementById('badge-b-matchup'),
        crown: document.getElementById('crown-b-matchup'),
        penaltyScore: document.getElementById('penalty-score-b-matchup'),
        penaltySection: document.getElementById('penalty-b-matchup'),
        events: document.getElementById('events-b-matchup')
    }
};

// Debug: Log initial element state
console.log('🔍 Matchup Elements Initialized:', {
    card: !!matchupEls.card,
    vsBadge: !!matchupEls.vsBadge,
    teamA: !!matchupEls.teamA.container,
    teamB: !!matchupEls.teamB.container,
    timer: !!matchupEls.timer
});

let prevScores = { a: null, b: null };

function renderMatchup(match) {
    console.log('🎨 renderMatchup called with:', match);

    if (matchupEls.card && matchupEls.card.classList.contains('is-loading')) {
        console.log('⏸️ Render skipped: Card is in loading state');
        return;
    }

    const normalizedMatch = match; 
    if (!normalizedMatch) {
        console.error('❌ Render aborted: Normalized match is null');
        return;
    }

    // --- TEXT UPDATES ---
    const teamAName = normalizedMatch.homeTeam || normalizedMatch.team_a || 'Équipe A';
    const teamBName = normalizedMatch.awayTeam || normalizedMatch.team_b || 'Équipe B';
    
    if (matchupEls.teamA.name) {
        matchupEls.teamA.name.textContent = teamAName;
    }

    if (matchupEls.teamB.name) {
        matchupEls.teamB.name.textContent = teamBName;
    }
    
    // --- SCORE UPDATES ---
    const scoreA = normalizedMatch.scoreInfo?.fulltime?.home;
    const scoreB = normalizedMatch.scoreInfo?.fulltime?.away;

    updateScoreWithAnimation(matchupEls.teamA.score, scoreA, 'a');
    updateScoreWithAnimation(matchupEls.teamB.score, scoreB, 'b');

    // --- PENALTY SCORES ---
    updatePenaltyScores(normalizedMatch);

    // --- FLAGS ---
    resetFlagAnimations();
    
    const flagUrlA = flagUrl(teamAName);
    const flagUrlB = flagUrl(teamBName);
    
    setFlag(matchupEls.teamA, flagUrlA, teamAName);
    setFlag(matchupEls.teamB, flagUrlB, teamBName);

    // --- VS BADGE FORCE SHOW ---
    if (matchupEls.vsBadge) {
        matchupEls.vsBadge.style.display = 'flex';
    }

    // --- STATUS & LIVE EFFECTS ---
    applyStatus(normalizedMatch.statusInfo, normalizedMatch);
    
    // --- TIMER DISPLAY (moved after applyStatus) ---
    updateTimerDisplay(normalizedMatch);

    // --- GOAL EVENTS ---
    renderGoalEvents(normalizedMatch);

    // --- RESULT LOGIC ---
    applyResult(normalizedMatch);
    
    // --- ENTRANCE ANIMATIONS ---
    triggerEntranceAnimations();
    
    console.log('✅ Render Complete');
}

function updateScoreWithAnimation(el, newScore, teamKey) {
    if (!el) return;
    
    // Ensure element is always visible regardless of animation state
    el.style.opacity = '1';
    el.style.visibility = 'visible';
    
    const displayScore = (newScore !== null && newScore !== undefined) ? newScore : '-';
    
    if (prevScores[teamKey] !== null && String(prevScores[teamKey]) !== String(displayScore)) {
        el.classList.remove('score-update-pop');
        void el.offsetWidth; // Trigger reflow
        el.classList.add('score-update-pop');
        
        // Remove class after animation to allow re-triggering
        setTimeout(() => el.classList.remove('score-update-pop'), 500);
    }
    
    el.textContent = displayScore;
    prevScores[teamKey] = displayScore;
}

function updatePenaltyScores(match) {
    if (!match.scoreInfo) return;
    
    const hasPenalties = match.scoreInfo.hasPenalties;
    
    // FIX: Changed from .penalties to .penalty to match your normalizeMatchData output
    const penaltyHome = match.scoreInfo.penalty?.home; 
    const penaltyAway = match.scoreInfo.penalty?.away;
    
    // Team A penalties
    if (matchupEls.teamA.penaltySection && matchupEls.teamA.penaltyScore) {
        if (hasPenalties && penaltyHome !== null && penaltyHome !== undefined) {
            matchupEls.teamA.penaltySection.style.display = 'flex'; // Use flex for alignment
            matchupEls.teamA.penaltySection.classList.add('visible');
            matchupEls.teamA.penaltyScore.textContent = penaltyHome;
        } else {
            matchupEls.teamA.penaltySection.style.display = 'none';
            matchupEls.teamA.penaltySection.classList.remove('visible');
        }
    }
    
    // Team B penalties
    if (matchupEls.teamB.penaltySection && matchupEls.teamB.penaltyScore) {
        if (hasPenalties && penaltyAway !== null && penaltyAway !== undefined) {
            matchupEls.teamB.penaltySection.style.display = 'flex';
            matchupEls.teamB.penaltySection.classList.add('visible');
            matchupEls.teamB.penaltyScore.textContent = penaltyAway;
        } else {
            matchupEls.teamB.penaltySection.style.display = 'none';
            matchupEls.teamB.penaltySection.classList.remove('visible');
        }
    }
}

function renderGoalEvents(match) {
    // FIX: Ensure we look at match.goals (from normalizeMatchData) 
    // instead of match.events which might be undefined
    const homeGoals = match.goals?.home || [];
    const awayGoals = match.goals?.away || [];
    
    renderEventsList(matchupEls.teamA.events, homeGoals);
    renderEventsList(matchupEls.teamB.events, awayGoals);
}

function renderEventsList(container, goals) {
    if (!container) return;
    container.innerHTML = '';
    
    if (!goals || goals.length === 0) return;
    
    goals.forEach(goal => {
        const eventEl = document.createElement('div');
        eventEl.className = 'tm-event-matchup'; // Updated class name to match CSS
        
        // Handle time formatting (e.g. 90 + 2)
        let timeText = goal.time;
        if (goal.extra) timeText += ` +${goal.extra}`;
        
        eventEl.innerHTML = `
            <span class="tm-event-time-matchup">${timeText}'</span>
            <span class="tm-event-player-matchup">${goal.player || 'Unknown'}</span>
        `;
        container.appendChild(eventEl);
    });
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

function setFlag(teamObj, url, fallbackText) {
    if (!teamObj || !teamObj.flag || !teamObj.fallback) return;
    
    teamObj.flag.style.display = 'none';
    teamObj.fallback.style.display = 'flex';
    teamObj.fallback.textContent = fallbackText ? fallbackText.charAt(0).toUpperCase() : '?';
    
    if (url) {
        const img = new Image();
        
        img.onload = () => { 
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
            console.warn(`Flag failed to load: ${url}`);
            teamObj.flag.style.display = 'none';  
            teamObj.fallback.style.display = 'flex'; 
        };
        
        img.src = url;
    }
}

function applyStatus(info, match) {
    if (!info) return;

    const displayStatus = info.status || 'upcoming';
    const isLive = info.isLive || false;

    if (matchupEls.statusBadge) {
        matchupEls.statusBadge.classList.remove('tm-status-upcoming', 'tm-status-live', 'tm-status-finished');
        matchupEls.statusBadge.classList.add(`tm-status-${displayStatus}`);
    }
    
    if (matchupEls.statusLabel) matchupEls.statusLabel.textContent = info.label;
    
    const vsBadge = matchupEls.vsBadge;
    const timer = matchupEls.timer;
    
    if (isLive) {
        if (vsBadge) vsBadge.classList.add('is-live-pulse');
        if (timer) timer.classList.add('is-live-pulse');
        
        const energyLeft = document.querySelector('.tm-vs-energy-left-matchup');
        const energyRight = document.querySelector('.tm-vs-energy-right-matchup');
        if (energyLeft) energyLeft.style.animationDuration = '0.8s';
        if (energyRight) energyRight.style.animationDuration = '0.8s';
        
    } else {
        if (vsBadge) vsBadge.classList.remove('is-live-pulse');
        if (timer) timer.classList.remove('is-live-pulse');
        
        const energyLeft = document.querySelector('.tm-vs-energy-left-matchup');
        const energyRight = document.querySelector('.tm-vs-energy-right-matchup');
        if (energyLeft) energyLeft.style.animationDuration = '2s';
        if (energyRight) energyRight.style.animationDuration = '2s';
    }
}

function updateTimerDisplay(match) {
    if (!matchupEls.timer) return;

    if (match.statusInfo) {
        // FIX: Handle multiple possible time properties
        const time = match.statusInfo.timeString || 
                     match.statusInfo.time || 
                     match.statusInfo.clock || 
                     match.time || 
                     '--:--';
        
        matchupEls.timer.textContent = time;
        
        if (match.statusInfo.isLive) {
            matchupEls.timer.classList.add('is-live-pulse');
        } else {
            matchupEls.timer.classList.remove('is-live-pulse');
        }
    } else {
        // If no statusInfo, show default
        matchupEls.timer.textContent = '--:--';
        matchupEls.timer.classList.remove('is-live-pulse');
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
    
    // Reset crowns
    if (matchupEls.teamA.crown) matchupEls.teamA.crown.style.display = 'none';
    if (matchupEls.teamB.crown) matchupEls.teamB.crown.style.display = 'none';

    const a = match.scoreInfo?.fulltime?.home;
    const b = match.scoreInfo?.fulltime?.away;
    const hasPenalties = match.scoreInfo?.hasPenalties;
    const winnerDraw = match.winner;

    if (a === null || a === undefined || b === null || b === undefined) {
        if (matchupEls.drawRibbon) matchupEls.drawRibbon.style.display = 'none';
        return;
    }

    const sa = parseInt(a);
    const sb = parseInt(b);

    if (winnerDraw === 'Draw') {
        console.log('🤝 Match is a DRAW');
        card.classList.add('is-draw');
        if (matchupEls.drawRibbon) {
            matchupEls.drawRibbon.style.display = 'flex';
            matchupEls.drawRibbon.style.animation = 'none';
            void matchupEls.drawRibbon.offsetWidth;
            matchupEls.drawRibbon.style.animation = 'drawRibbonExpand 0.6s cubic-bezier(0.34, 1.56, 0.64, 1) forwards';
            
            if (hasPenalties) {
                const textSpan = matchupEls.drawRibbon.querySelector('.tm-draw-text-matchup');
                if(textSpan) textSpan.textContent = 'Match Nul (Après Tirs au But)';
            } else {
                const textSpan = matchupEls.drawRibbon.querySelector('.tm-draw-text-matchup');
                if(textSpan) textSpan.textContent = 'Match Nul';
            }
        }
    } else {
        console.log(`🏆 Winner detected via API: ${winnerDraw}`);
        if (matchupEls.drawRibbon) matchupEls.drawRibbon.style.display = 'none';
        
        card.classList.add('is-winner');
        
        let winnerObj, loserObj;
        if (winnerDraw === match.homeTeam) {
            winnerObj = matchupEls.teamA;
            loserObj = matchupEls.teamB;
        } else {
            winnerObj = matchupEls.teamB;
            loserObj = matchupEls.teamA;
        }

        if (winnerObj.container) winnerObj.container.classList.add('is-winner');
        if (loserObj.container) loserObj.container.classList.add('is-loser');
        
        // Show crown for winner
        if (winnerObj.crown) {
            winnerObj.crown.style.display = 'block';
            winnerObj.crown.style.animation = 'none';
            void winnerObj.crown.offsetWidth;
            winnerObj.crown.style.animation = 'badgeSlideUp 0.5s cubic-bezier(0.34, 1.56, 0.64, 1) forwards';
        }

        if (winnerObj.badge) {
            const penaltyText = hasPenalties ? ' (Tirs au but)' : '';
            
        }
    }
}

function flagUrl(name) {
    if (!name) return null;
    const cleanName = name.replace(/[^a-zA-Z0-9]/g, '_');
    return `/assets/flags/${cleanName}.png`;
}

// Dynamic Styles Injection
const style = document.createElement('style');
style.textContent = `
    @keyframes drawRibbonExpand {
        0% { opacity: 0; transform: translate(-50%, -50%) scaleX(0.5); }
        100% { opacity: 1; transform: translate(-50%, -50%) scaleX(1); }
    }
    
    @keyframes badgeSlideUp {
        0% { opacity: 0; transform: translateY(10px); }
        100% { opacity: 1; transform: translateY(0); }
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
    
    .tm-crown-matchup {
        display: none;
        position: absolute;
        top: -20px;
        left: 50%;
        transform: translateX(-50%);
        color: #fbbf24;
        font-size: 24px;
        z-index: 10;
    }
    
    .tm-penalty-section-matchup {
        display: none;
        margin-top: 8px;
        text-align: center;
    }
    
    .tm-penalty-label-matchup {
        font-size: 10px;
        opacity: 0.7;
        margin-right: 4px;
    }
    
    .tm-penalty-score-matchup {
        font-size: 14px;
        font-weight: bold;
    }
    
    .tm-goal-events-matchup {
        margin-top: 8px;
        font-size: 20px;
    }
    
    .tm-goal-event-matchup {
        display: flex;
        align-items: center;
        gap: 4px;
        margin: 2px 0;
    }
    
    .tm-event-minute {
        font-weight: bold;
        color: #fbbf24;
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