document.addEventListener('DOMContentLoaded', () => {
    // Use getConfig() to retrieve URL parameters
    const config = getConfig(); 
    let matches = [];
    let currentMatchIndex = 0;
    let timerInterval, sliderInterval;

    const els = {
        card:       document.getElementById('main-card'),
        statusBadge:document.getElementById('match-status-badge'),
        statusLabel:document.getElementById('status-label'),
        liveDot:    document.getElementById('live-indicator'),
        timer:      document.getElementById('match-timer'),
        vsBadge:    document.getElementById('vs-badge'),
        drawRibbon: document.getElementById('draw-ribbon'),
        teamA: {
            container: document.getElementById('team-a-container'),
            name:      document.getElementById('name-a'),
            score:     document.getElementById('score-a'),
            flag:      document.getElementById('flag-a'),
            fallback:  document.querySelector('#team-a-container .tm-flag-fallback'),
            badge:     document.getElementById('badge-a'),
            crown:     document.getElementById('crown-a')
        },
        teamB: {
            container: document.getElementById('team-b-container'),
            name:      document.getElementById('name-b'),
            score:     document.getElementById('score-b'),
            flag:      document.getElementById('flag-b'),
            fallback:  document.querySelector('#team-b-container .tm-flag-fallback'),
            badge:     document.getElementById('badge-b'),
            crown:     document.getElementById('crown-b')
        },
        dateDisplay: document.getElementById('match-date-display')
    };

    /* ---------- Fetch ---------- */
    const fetchMatches = async () => {
        try {
            const params = new URLSearchParams();
            if (config.refetch) {
                params.append('refetch', 'true');
            }
            if (config.dummy) {
                params.append('dummy', 'true');
            }

            const queryString = params.toString();
            const apiUrl = queryString ? `/api/todayMatches?${queryString}` : '/api/todayMatches';
            
            console.log('Fetching from:', apiUrl);
            
            const response = await fetch(apiUrl);
            
            if (!response.ok) throw new Error(`Network response was not ok: ${response.status}`);
            
            const result = await response.json();
            console.log('API Response:', result);
            
            // API returns enriched matches with statusInfo already attached
            const data = result.data || result;
            console.log('Data extracted:', data);

            if (data && Array.isArray(data) && data.length > 0) {
                matches = data;
                console.log(`Loaded ${matches.length} matches`);
                console.log('First match:', matches[0]);
                
                renderMatch(currentMatchIndex);
                startTimer();
                startSlider();
            } else {
                console.warn('No matches found or invalid data format');
                showEmptyState();
            }
        } catch (error) {
            console.error("Failed to load matches", error);
            showEmptyState();
        }
    };

    const showEmptyState = () => {
        if (!els.card) return;
        els.card.innerHTML = `
            <div class="tm-bg-effects"></div>
            <div class="tm-glass-overlay"></div>
            <div class="tm-card-content">
                <div class="tm-empty-state">
                    <div class="tm-empty-icon">
                        <svg width="60" height="60" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                            <circle cx="12" cy="12" r="10"/>
                            <path d="M12 8v4m0 4h.01"/>
                        </svg>
                    </div>
                    <h3>Aucun match aujourd'hui</h3>
                    <p>Revenez plus tard pour voir les prochains matchs.</p>
                </div>
            </div>`;
    };

    /* ---------- Render ---------- */
    const renderMatch = (index) => {
        console.log(`Rendering match at index ${index}`);
        
        if (!matches.length || !els.card) {
            console.warn('Cannot render: no matches or card element');
            return;
        }
        
        const match = matches[index];
        console.log('Match data:', match);

        if (!match) {
            console.warn('Match is undefined/null at index', index);
            return;
        }

        // Text - use safe defaults
        const teamAName = match.team_a || 'Équipe A';
        const teamBName = match.team_b || 'Équipe B';
        
        console.log('Teams:', teamAName, 'vs', teamBName);
        
        if (els.teamA.name) els.teamA.name.textContent = teamAName;
        if (els.teamB.name) els.teamB.name.textContent = teamBName;
        
        if (els.teamA.score) {
            els.teamA.score.textContent = (match.fulltime_a !== null && match.fulltime_a !== undefined) ? match.fulltime_a : '-';
        }
        if (els.teamB.score) {
            els.teamB.score.textContent = (match.fulltime_b !== null && match.fulltime_b !== undefined) ? match.fulltime_b : '-';
        }

        // Flags
        setFlag(els.teamA, match.team_a_flag || flagUrl(match.team_a), match.team_a);
        setFlag(els.teamB, match.team_b_flag || flagUrl(match.team_b), match.team_b);

        // Date
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
        } else if (els.dateDisplay) {
            els.dateDisplay.textContent = '';
        }

        // Ensure VS badge is always visible
        if (els.vsBadge) {
            els.vsBadge.style.display = 'flex'; 
        }

        // Use statusInfo from API (already calculated server-side)
        const statusInfo = match.statusInfo || {};
        console.log('Status info from API:', statusInfo);
        
        // Status
        applyStatus(statusInfo, match);

        // Winner / Draw highlight
        applyResult(match);
        
        console.log('Render complete');
    };

    const setFlag = (teamObj, url, fallbackText) => {
        if (!teamObj || !teamObj.flag || !teamObj.fallback) {
            console.warn('setFlag: Missing teamObj elements');
            return;
        }
        
        teamObj.flag.style.display = 'none';
        teamObj.fallback.style.display = 'flex';
        teamObj.fallback.textContent = fallbackText ? fallbackText.charAt(0).toUpperCase() : '?';
        
        if (url) {
            console.log('Loading flag from:', url);
            teamObj.flag.src = url;
            teamObj.flag.onload = () => { 
                console.log('Flag loaded successfully');
                teamObj.flag.style.display = 'block'; 
                teamObj.fallback.style.display = 'none'; 
            };
            teamObj.flag.onerror = () => { 
                console.warn('Flag failed to load:', url);
                teamObj.flag.style.display = 'none';  
                teamObj.fallback.style.display = 'flex'; 
            };
        }
    };

    /* ---------- Status ---------- */
    const applyStatus = (info, match) => {
        if (!info) {
            console.warn('applyStatus: No status info provided');
            return;
        }

        const displayStatus = info.status || 'upcoming';
        const displayLabel = info.label || 'À venir';
        const isLive = info.isLive || false;
        const timeString = info.timeString || '';

        console.log('Applying status:', { displayStatus, displayLabel, isLive, timeString });

        if (els.statusBadge) {
            els.statusBadge.className = `tm-status-badge tm-status-${displayStatus}`;
        }
        if (els.statusLabel) {
            els.statusLabel.textContent = displayLabel;
        }
        if (els.liveDot) {
            els.liveDot.style.display = isLive ? 'block' : 'none';
        }

        // Handle Timer Display
        if (els.timer) {
            if (displayStatus === 'finished') {
                els.timer.textContent = ''; 
                els.timer.classList.remove('is-live');
                els.timer.style.display = 'none';
            } else {
                els.timer.style.display = 'block';
                els.timer.textContent = timeString;
                els.timer.classList.toggle('is-live', isLive);
            }
        }
    };

    /* ---------- Result (Winner / Draw) ---------- */
    const applyResult = (match) => {
        if (!match || !els.card) return;

        const card = els.card;

        // Reset everything
        card.classList.remove('is-winner', 'is-draw');
        
        if (els.teamA.container) els.teamA.container.classList.remove('is-winner', 'is-loser');
        if (els.teamB.container) els.teamB.container.classList.remove('is-winner', 'is-loser');
        
        if (els.teamA.badge) {
            els.teamA.badge.style.opacity = '0';
            els.teamA.badge.innerHTML = '';
        }
        if (els.teamB.badge) {
            els.teamB.badge.style.opacity = '0';
            els.teamB.badge.innerHTML = '';
        }

        // Check if match has scores
        const a = match.fulltime_a;
        const b = match.fulltime_b;

        if (a === null || a === undefined || b === null || b === undefined) {
            console.log('Match not finished yet (no scores)');
            return;
        }

        const sa = parseInt(a);
        const sb = parseInt(b);

        console.log(`Score: ${sa} - ${sb}`);

        if (sa === sb) {
            // DRAW
            card.classList.add('is-draw');
            console.log('Match is a draw');
        } else {
            // WINNER
            card.classList.add('is-winner');
            const winner = sa > sb ? els.teamA : els.teamB;
            const loser = sa > sb ? els.teamB : els.teamA;

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
            
            console.log(`Winner: ${sa > sb ? match.team_a : match.team_b}`);
        }
    };

    /* ---------- Timer ---------- */
    const startTimer = () => {
        if (timerInterval) clearInterval(timerInterval);
        
        timerInterval = setInterval(() => {
            if (!matches.length) return;
            const match = matches[currentMatchIndex];
            
            if (!match) return;

            // If scores exist, it's finished
            if (match.fulltime_a !== null && match.fulltime_a !== undefined && 
                match.fulltime_b !== null && match.fulltime_b !== undefined) {
                if (els.timer) els.timer.textContent = '';
                return; 
            }

            // Use statusInfo from API for live/upcoming
            if (match.statusInfo) {
                if (els.timer) {
                    if (match.statusInfo.status === 'finished') {
                        els.timer.textContent = '';
                    } else {
                        els.timer.textContent = match.statusInfo.timeString || '';
                        els.timer.classList.toggle('is-live', match.statusInfo.isLive || false);
                    }
                }
            }

            // Refresh data if match time has passed and refetch is enabled
            if (config.refetch && match.statusInfo && match.statusInfo.status !== 'upcoming') {
                const now = new Date();
                const mDate = new Date(match.date.replace(' ', 'T') + '+04:00');
                const diff = mDate.getTime() - now.getTime();
                
                if (diff <= 0 && diff > -2000) {
                    console.log('Triggering refetch...');
                    fetchMatches();
                }
            }
        }, 1000);
    };

    /* ---------- Slider ---------- */
    const startSlider = () => {
        if (sliderInterval) clearInterval(sliderInterval);
        if (matches.length <= 1) {
            console.log('Only one match or no matches, slider disabled');
            return;
        }
        
        const sliderIntervalTime = (config.speed || 5) * 1000;
        console.log(`Slider interval: ${sliderIntervalTime}ms`);

        sliderInterval = setInterval(() => {
            currentMatchIndex = (currentMatchIndex + 1) % matches.length;
            console.log(`Sliding to match index ${currentMatchIndex}`);
            
            if (els.card) {
                els.card.classList.add('fade-out');
                setTimeout(() => {
                    renderMatch(currentMatchIndex);
                    els.card.classList.remove('fade-out');
                }, 400);
            }
        }, sliderIntervalTime);
    };

    /* ---------- Helpers ---------- */
    const flagUrl = (name) => {
        if (!name) return null;
        return `assets/flags/${name.replace(/ /g, '_')}.png`;
    };

    fetchMatches();
});