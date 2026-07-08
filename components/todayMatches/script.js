document.addEventListener('DOMContentLoaded', () => {
    const config = getConfig(); 
    let matches = [];
    let currentMatchIndex = 0;
    let timerInterval, sliderInterval, refetchCheckInterval;
    let isLoading = false;
    let lastFetchTime = 0;
    
    // Track which refetch events have been handled to prevent loops
    let triggeredRefetches = new Set();

    const els = {
        card: document.getElementById('main-card-main'),
        dateDisplay: document.getElementById('match-date-display-main'),
        dateDisplayFooter: document.getElementById('match-date-display-footer'),
        wrapper: document.getElementById('today-matches-slider-wrapper-main'),
        
        // Header Elements
        statusBadge: document.getElementById('match-status-badge-header'),
        liveIndicator: document.getElementById('live-indicator-header'),
        statusLabel: document.getElementById('status-label-header'),
        statusTextContent: document.querySelector('.tm-status-text-content-header'),
        
        // Matchup/Timer Elements
        matchupCard: document.getElementById('main-card-matchup'),
        timerDisplay: document.getElementById('match-timer-matchup'),
        vsBadge: document.getElementById('vs-badge-matchup')
    };

    /* ---------- Loading State Management ---------- */
    const showLoadingState = () => {
        if (!els.card) return;
        isLoading = true;
        
        if (timerInterval) clearInterval(timerInterval);
        if (sliderInterval) clearInterval(sliderInterval);
        
        els.card.classList.add('is-loading');
        
        const existingLoader = els.card.querySelector('.tm-loading-overlay-main');
        if (!existingLoader) {
            const loaderHTML = `
                <div class="tm-loading-overlay-main">
                    <div class="tm-loading-spinner-main">
                        <div class="tm-spinner-ring-main"></div>
                        <div class="tm-spinner-ring-main"></div>
                        <div class="tm-spinner-ring-main"></div>
                        <svg class="tm-spinner-icon-main" viewBox="0 0 24 24" fill="currentColor">
                            <path d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z"/>
                        </svg>
                    </div>
                    <div class="tm-loading-text-main">Chargement des matchs...</div>
                </div>
            `;
            els.card.insertAdjacentHTML('beforeend', loaderHTML);
        }
    };

    const hideLoadingState = () => {
        if (!els.card) return;
        isLoading = false;
        
        els.card.classList.remove('is-loading');
        
        const loader = els.card.querySelector('.tm-loading-overlay-main');
        if (loader) {
            loader.classList.add('fade-out');
            setTimeout(() => {
                loader.remove();
            }, 300);
        }
    };

    /* ---------- Data Normalization ---------- */
const normalizeMatchData = (apiMatch) => {
    if (!apiMatch) return null;

    const matchDate = new Date(apiMatch.date.replace(' ', 'T') + '+04:00'); 
    const now = new Date();
    
    // 1. Map Status correctly from apiMatch.status
    const apiStatus = apiMatch.status || {};
    const statusKey = apiStatus.state || 'upcoming'; 
    const isLive = apiStatus.isLive === true;
    const isFinished = apiStatus.isFinished === true;
    
    const minutesSinceStart = Math.floor((now - matchDate) / (1000 * 60));
    const estimatedEndTime = new Date(matchDate.getTime() + (120 * 60 * 1000)); 
    const minutesSinceEnd = Math.floor((now - estimatedEndTime) / (1000 * 60));
    
    // 2. Map Scores correctly from teamA/teamB objects
    const scoreA = apiMatch.teamA?.score ?? null;
    const scoreB = apiMatch.teamB?.score ?? null;
    const htScoreA = apiMatch.teamA?.htScore ?? null;
    const htScoreB = apiMatch.teamB?.htScore ?? null;
    
    const hasScores = scoreA !== null && scoreB !== null && (scoreA > 0 || scoreB > 0 || isFinished);
    
    // 3. Map Penalties
    const hasPenalties = apiMatch.penalty !== null && apiMatch.penalty !== undefined;

    const timeOptions = { hour: '2-digit', minute: '2-digit' };
    const formattedTime = !isNaN(matchDate.getTime()) 
        ? matchDate.toLocaleTimeString('fr-FR', timeOptions) 
        : apiMatch.date.split(' ')[1]?.substring(0, 5);

    let label = apiStatus.label || '';
    let timeString = apiStatus.timeString || formattedTime;

    if (statusKey === 'upcoming') {
        label = label || 'À venir';
        timeString = formattedTime;
    } else if (statusKey === 'live') {
        label = label || 'Live';
        timeString = 'LIVE';
    } else if (statusKey === 'finished') {
        label = label || 'Match terminé';
        timeString = formattedTime;
    }

    // 4. Map Scorers correctly from teamA.scorers and teamB.scorers
    const rawScorersA = Array.isArray(apiMatch.teamA?.scorers) ? apiMatch.teamA.scorers : [];
    const rawScorersB = Array.isArray(apiMatch.teamB?.scorers) ? apiMatch.teamB.scorers : [];
    
// Helper function to parse time safely inside normalizeMatchData
const getScorerTime = (s) => {
    // Check if minute or time exists and is explicitly a number or valid string
    if (s.minute !== undefined && s.minute !== null && s.minute !== '') return s.minute;
    if (s.time !== undefined && s.time !== null && s.time !== '') return s.time;
    
    // If there is no minute/time mark, but a penalty shootout happened
    if (hasPenalties) {
        return 'Penalty'; 
    }
    
    // Absolute fallback if everything else is missing
    return 0;
};

    const goalsA = rawScorersA
        .map(s => ({
            player: s.name || 'Inconnu',
            time: getScorerTime(s),
            extra: s.extra_time || null,
            detail: s.detail || ''
        }))
        // Filter sorting safely since 'Penalty' is a string now
        .sort((a, b) => (typeof a.time === 'number' && typeof b.time === 'number') ? a.time - b.time : 0);

    const goalsB = rawScorersB
        .map(s => ({
            player: s.name || 'Inconnu',
            time: getScorerTime(s),
            extra: s.extra_time || null,
            detail: s.detail || ''
        }))
        .sort((a, b) => (typeof a.time === 'number' && typeof b.time === 'number') ? a.time - b.time : 0);

    // 5. Map Winner correctly from team booleans
    let winnerKey = null;
    if (isFinished) {
        if (apiMatch.teamA?.winner) {
            winnerKey = 'home';
        } else if (apiMatch.teamB?.winner) {
            winnerKey = 'away';
        } else if (apiMatch.teamA?.isDraw || apiMatch.teamB?.isDraw) {
            winnerKey = 'draw';
        }
    }

    return {
        ...apiMatch, 
        id: apiMatch.id,
        date: apiMatch.date,
        
        team_a: apiMatch.teamA?.name, 
        team_b: apiMatch.teamB?.name,
        fulltime_a: scoreA,
        fulltime_b: scoreB,
        halftime_a: htScoreA,
        halftime_b: htScoreB,
        
        statusInfo: { 
            status: statusKey, 
            isLive, 
            isFinished,  
            isAwaitingScore: false, 
            timeString, 
            label,
            minutesSinceStart,
            minutesSinceEnd,
            hasScores,
            hasPenalties
        },
        scoreInfo: {
            fulltime: { home: scoreA ?? null, away: scoreB ?? null },
            halftime: { home: htScoreA ?? null, away: htScoreB ?? null },
            penalty: hasPenalties ? apiMatch.penalty : null,
            hasPenalties
        },
        goals: { home: goalsA, away: goalsB },
        homeTeam: apiMatch.teamA?.name,
        awayTeam: apiMatch.teamB?.name,
        winner: winnerKey, 
        finalScore: `${scoreA ?? '-'}-${scoreB ?? '-'}`,
        penaltyScore: hasPenalties ? `${apiMatch.penalty?.home ?? apiMatch.penalty?.scoreA ?? 0}-${apiMatch.penalty?.away ?? apiMatch.penalty?.scoreB ?? 0}` : null
    };
};

    /* ---------- Smart Refetch Logic ---------- */
    const getRefetchKey = (type, matchId, time) => {
        return `${type}-${matchId}-${time}`;
    };

    const shouldRefetch = () => {
        const now = new Date();
        const currentHour = now.getHours();
        const currentMinute = now.getMinutes();
        const nowMinutes = currentHour * 60 + currentMinute;
        
        // Fetch at minute 0 of every hour (only once per hour)
        const hourlyKey = `hourly-${currentHour}`;
        if (currentMinute === 0 && !triggeredRefetches.has(hourlyKey)) {
            return { should: true, key: hourlyKey };
        }
        
        // Check each match for specific timing
        for (const match of matches) {
            if (!match.date || !match.id) continue;
            
            const matchStart = new Date(match.date.replace(' ', 'T') + '+04:00');
            const matchStartMinutes = matchStart.getHours() * 60 + matchStart.getMinutes();
            const matchId = match.id;
            
            // Halftime is approximately 45 minutes after start
            const halftimeMinutes = matchStartMinutes + 45;
            const halftimeHour = Math.floor(halftimeMinutes / 60);
            
            if (Math.abs(currentHour - halftimeHour) <= 1) {
                const diff = Math.abs((currentHour * 60 + currentMinute) - halftimeMinutes);
                if (diff <= 2) {
                    const key = getRefetchKey('halftime', matchId, halftimeMinutes);
                    if (!triggeredRefetches.has(key)) {
                        return { should: true, key: key };
                    }
                }
            }
            
            // Full time is approximately 90 minutes after start
            const fulltimeMinutes = matchStartMinutes + 90;
            const fulltimeHour = Math.floor(fulltimeMinutes / 60);
            
            if (Math.abs(currentHour - fulltimeHour) <= 1) {
                const diff = Math.abs((currentHour * 60 + currentMinute) - fulltimeMinutes);
                if (diff <= 2) {
                    const key = getRefetchKey('fulltime', matchId, fulltimeMinutes);
                    if (!triggeredRefetches.has(key)) {
                        return { should: true, key: key };
                    }
                }
            }
            
            // 1 hour after full time
            const oneHourAfterFulltime = fulltimeMinutes + 60;
            const oneHourHour = Math.floor(oneHourAfterFulltime / 60);
            
            if (Math.abs(currentHour - oneHourHour) <= 1) {
                const diff = Math.abs((currentHour * 60 + currentMinute) - oneHourAfterFulltime);
                if (diff <= 2) {
                    const key = getRefetchKey('afterfulltime', matchId, oneHourAfterFulltime);
                    if (!triggeredRefetches.has(key)) {
                        return { should: true, key: key };
                    }
                }
            }
        }
        
        return { should: false, key: null };
    };

    /* ---------- Fetch ---------- */
    const fetchMatches = async (force = false) => {
        const now = Date.now();
        if (!force && (now - lastFetchTime) < 30000) {
            console.log('Skipping fetch - too soon since last fetch');
            return;
        }
        
        showLoadingState();
        lastFetchTime = now;
        
        try {
            const params = new URLSearchParams();
            if (config.refetch) params.append('refetch', 'true');
            if (config.dummy) params.append('dummy', 'true');

            const queryString = params.toString();
            const REAL_BACKEND_URL = 'https://xibo-component-api.vercel.app';
            const apiUrl = queryString 
                ? `${REAL_BACKEND_URL}/api/todayMatches?${queryString}` 
                : `${REAL_BACKEND_URL}/api/todayMatches`;
                
            const response = await fetch(apiUrl);
            if (!response.ok) throw new Error(`Network response was not ok: ${response.status}`);
            
            const result = await response.json();
            console.log('Fetched matches:', result);
            // Handle both { data: [...] } and direct array responses
            const rawData = result.data || result;

            if (rawData && Array.isArray(rawData) && rawData.length > 0) {
                matches = rawData.map(normalizeMatchData).filter(m => m !== null);
                
                if (currentMatchIndex >= matches.length) currentMatchIndex = 0;
                
                hideLoadingState();
                
                setTimeout(() => {
                    renderMatch(currentMatchIndex);
                    startTimer();
                    startSlider();
                }, 100);
            } else {
                hideLoadingState();
                showEmptyState();
            }
        } catch (error) {
            console.error("Failed to load matches", error);
            hideLoadingState();
            showErrorState();
        }
    };

    const showEmptyState = () => {
        if (!els.card) return;
        if (timerInterval) clearInterval(timerInterval);
        if (sliderInterval) clearInterval(sliderInterval);
        if (refetchCheckInterval) clearInterval(refetchCheckInterval);
        
        els.card.innerHTML = `
            <div class="tm-bg-effects-main"></div>
            <div class="tm-glass-overlay-main"></div>
            <div class="tm-card-content-main">
                <div class="tm-empty-state-main">
                    <div class="tm-empty-icon-main">
                        <svg width="60" height="60" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                            <circle cx="12" cy="12" r="10"/><path d="M12 8v4m0 4h.01"/>
                        </svg>
                    </div>
                    <h3>Aucun match aujourd'hui</h3>
                    <p>Revenez plus tard pour voir les prochains matchs.</p>
                </div>
            </div>`;
    };

    const showErrorState = () => {
        if (!els.card) return;
        if (timerInterval) clearInterval(timerInterval);
        if (sliderInterval) clearInterval(sliderInterval);
        if (refetchCheckInterval) clearInterval(refetchCheckInterval);
        
        els.card.innerHTML = `
            <div class="tm-bg-effects-main"></div>
            <div class="tm-glass-overlay-main"></div>
            <div class="tm-card-content-main">
                <div class="tm-error-state-main">
                    <div class="tm-error-icon-main">
                        <svg width="60" height="60" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                            <circle cx="12" cy="12" r="10"/><path d="M12 8v4m0 4h.01"/>
                        </svg>
                    </div>
                    <h3>Erreur de chargement</h3>
                    <p>Impossible de charger les matchs. Veuillez réessayer.</p>
                    <button onclick="location.reload()" class="tm-retry-btn-main">Réessayer</button>
                </div>
            </div>`;
    };

    /* ---------- Update Header Status ---------- */
    const updateHeaderStatus = (statusInfo) => {
        if (!els.statusBadge) return;
        
        const { status, isLive, isAwaitingScore, label } = statusInfo;
        
        // Remove all status classes
        els.statusBadge.classList.remove('tm-status-upcoming-header', 'tm-status-live-header', 'tm-status-finished-header', 'tm-status-awaiting-header');
        
        // Add appropriate status class
        if (status === 'live') {
            els.statusBadge.classList.add('tm-status-live-header');
            els.statusBadge.setAttribute('data-state', 'live');
            
            if (els.liveIndicator) {
                els.liveIndicator.style.display = 'flex';
            }
        } else if (status === 'finished') {
            els.statusBadge.classList.add('tm-status-finished-header');
            els.statusBadge.setAttribute('data-state', 'finished');
            
            if (els.liveIndicator) {
                els.liveIndicator.style.display = 'none';
            }
        } else if (status === 'awaiting_score') {
            els.statusBadge.classList.add('tm-status-awaiting-header');
            els.statusBadge.setAttribute('data-state', 'awaiting');
            
            if (els.liveIndicator) {
                els.liveIndicator.style.display = 'none';
            }
        } else {
            els.statusBadge.classList.add('tm-status-upcoming-header');
            els.statusBadge.setAttribute('data-state', 'upcoming');
            
            if (els.liveIndicator) {
                els.liveIndicator.style.display = 'none';
            }
        }
        
        // Update status text
        if (els.statusTextContent) {
            els.statusTextContent.textContent = label;
        }
        
        // Update icon based on status
        const statusIcon = els.statusLabel?.querySelector('.tm-status-icon-header');
        if (statusIcon) {
            let iconSVG = '';
            
            if (status === 'live') {
                iconSVG = `
                    <svg class="tm-status-icon-header" viewBox="0 0 24 24" fill="currentColor">
                        <circle cx="12" cy="12" r="6"/>
                    </svg>`;
            } else if (status === 'finished') {
                iconSVG = `
                    <svg class="tm-status-icon-header" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                        <path d="M20 6L9 17l-5-5"/>
                    </svg>`;
            } else if (status === 'awaiting_score') {
                iconSVG = `
                    <svg class="tm-status-icon-header" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                        <circle cx="12" cy="12" r="10"/>
                        <path d="M12 6v6l4 2"/>
                        <circle cx="18" cy="6" r="3" fill="#f59e0b"/>
                    </svg>`;
            } else {
                iconSVG = `
                    <svg class="tm-status-icon-header" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                        <circle cx="12" cy="12" r="10"/>
                        <path d="M12 6v6l4 2"/>
                    </svg>`;
            }
            
            statusIcon.outerHTML = iconSVG;
        }
    };

    /* ---------- Render Coordinator ---------- */
    const renderMatch = (index) => {
        if (!matches.length || !els.card || isLoading) return;
        
        const match = matches[index];
        if (!match) return;

        // Update header/main date display
        if (els.dateDisplay && match.date) {
            try {
                const d = new Date(match.date.replace(' ', 'T') + '+04:00');
                if (!isNaN(d.getTime())) {
                    els.dateDisplay.textContent = d.toLocaleDateString('fr-FR', { weekday:'long', day:'numeric', month:'long' });
                } else { 
                    els.dateDisplay.textContent = match.date; 
                }
            } catch { 
                els.dateDisplay.textContent = match.date; 
            }
        }

        // Update footer date display
        if (els.dateDisplayFooter && match.date) {
            try {
                const d = new Date(match.date.replace(' ', 'T') + '+04:00');
                if (!isNaN(d.getTime())) {
                    els.dateDisplayFooter.textContent = d.toLocaleDateString('fr-FR', { weekday:'long', day:'numeric', month:'long' });
                } else { 
                    els.dateDisplayFooter.textContent = match.date; 
                }
            } catch { 
                els.dateDisplayFooter.textContent = match.date; 
            }
        }

        // Update header status badge
        updateHeaderStatus(match.statusInfo);

        // Call external render functions if they exist
        if (typeof applyStatus === 'function') applyStatus(match.statusInfo, match);
        if (typeof renderMatchup === 'function') renderMatchup(match);
        
        // Ensure timer is running for this specific match
        restartTimerForMatch(match);
    };

    /* ---------- Timer & Slider ---------- */
    
    const restartTimerForMatch = (match) => {
        if (timerInterval) clearInterval(timerInterval);
        
        if (typeof updateTimerDisplay === 'function') {
             timerInterval = setInterval(() => {
                if (!matches.length || isLoading) return;
                const currentMatch = matches[currentMatchIndex];
                if (currentMatch) updateTimerDisplay(currentMatch);
            }, 1000);
            updateTimerDisplay(match);
        } 
        else if (els.timerDisplay) {
            const updateLocalTimer = () => {
                if (!match) return;
                
                if (match.statusInfo.isLive) {
                    // Use backend match minute if available (more accurate)
                    if (match.matchTime && match.matchTime.minute) {
                        els.timerDisplay.textContent = match.matchTime.display;
                    } else {
                        const matchStart = new Date(match.date.replace(' ', 'T') + '+04:00');
                        const now = new Date();
                        const elapsed = Math.floor((now - matchStart) / 1000);
                        const minutes = Math.floor(elapsed / 60);
                        const seconds = elapsed % 60;
                        els.timerDisplay.textContent = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
                    }
                } else if (match.statusInfo.status === 'upcoming') {
                    const matchStart = new Date(match.date.replace(' ', 'T') + '+04:00');
                    const now = new Date();
                    const remaining = Math.floor((matchStart - now) / 1000);
                    
                    if (remaining > 0) {
                        const hours = Math.floor(remaining / 3600);
                        const minutes = Math.floor((remaining % 3600) / 60);
                        const seconds = remaining % 60;
                        
                        if (hours > 0) {
                            els.timerDisplay.textContent = `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
                        } else {
                            els.timerDisplay.textContent = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
                        }
                    } else {
                        els.timerDisplay.textContent = '00:00';
                    }
                } else {
                    // For finished or awaiting_score, show static time
                    els.timerDisplay.textContent = match.statusInfo.timeString;
                }
            };

            updateLocalTimer();
            
            if (match.statusInfo.isLive || match.statusInfo.status === 'upcoming') {
                timerInterval = setInterval(updateLocalTimer, 1000);
            }
        }
    };

    const startTimer = () => {
        if (!matches.length) return;
        const currentMatch = matches[currentMatchIndex];
        if (currentMatch) {
            restartTimerForMatch(currentMatch);
        }
    };

    const startSlider = () => {
        if (sliderInterval) clearInterval(sliderInterval);
        if (matches.length <= 1) return;
        
        const sliderIntervalTime = (config.speed || 5) * 1000;

        sliderInterval = setInterval(() => {
            if (isLoading) return;
            
            currentMatchIndex = (currentMatchIndex + 1) % matches.length;
            if (els.card) {
                els.card.classList.add('fade-out');
                setTimeout(() => {
                    renderMatch(currentMatchIndex);
                    els.card.classList.remove('fade-out');
                }, 400);
            }
        }, sliderIntervalTime);
    };

    // Start smart refetch checker
    const startSmartRefetch = () => {
        if (refetchCheckInterval) clearInterval(refetchCheckInterval);
        
        refetchCheckInterval = setInterval(() => {
            if (isLoading) return;
            
            const refetchInfo = shouldRefetch();
            if (refetchInfo.should) {
                console.log('Smart refetch triggered:', refetchInfo.key);
                triggeredRefetches.add(refetchInfo.key);
                fetchMatches(true);
            }
        }, 30000);
    };

    // Clean up old triggered refetches every 5 minutes
    const cleanupTriggeredRefetches = () => {
        setInterval(() => {
            const now = new Date();
            const currentHour = now.getHours();
            
            for (const key of triggeredRefetches) {
                if (key.startsWith('hourly-')) {
                    const hour = parseInt(key.split('-')[1]);
                    if (hour !== currentHour) {
                        triggeredRefetches.delete(key);
                    }
                }
            }
        }, 300000);
    };

    // Initial fetch
    fetchMatches(true);
    
    // Start smart refetch checking
    startSmartRefetch();
    cleanupTriggeredRefetches();
});