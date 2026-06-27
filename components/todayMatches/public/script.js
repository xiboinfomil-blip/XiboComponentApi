document.addEventListener('DOMContentLoaded', () => {
    const config = window.TODAY_MATCHES_CONFIG || { sliderSpeed: 8000 };
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
            const response = await fetch('/api/todayMatches');
            if (!response.ok) throw new Error('Network response was not ok');
            const result = await response.json();
            const data = result.data || result;

            if (data && data.length > 0) {
                matches = data;
                renderMatch(currentMatchIndex);
                startTimer();
                startSlider();
            } else {
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
        if (!matches.length || !els.card) return;
        const match = matches[index];

        // Text
        els.teamA.name.textContent = match.team_a;
        els.teamB.name.textContent = match.team_b;
        els.teamA.score.textContent = match.fulltime_a !== null ? match.fulltime_a : '-';
        els.teamB.score.textContent = match.fulltime_b !== null ? match.fulltime_b : '-';

        // Flags
        setFlag(els.teamA, match.team_a_flag || flagUrl(match.team_a), match.team_a);
        setFlag(els.teamB, match.team_b_flag || flagUrl(match.team_b), match.team_b);

        // Date
        if (els.dateDisplay) {
            try {
                const d = new Date(match.date.replace(' ', 'T') + '+04:00');
                els.dateDisplay.textContent = d.toLocaleDateString('fr-FR', { weekday:'long', day:'numeric', month:'long' });
            } catch { els.dateDisplay.textContent = match.date; }
        }

        // Ensure VS badge is always visible
        if (els.vsBadge) {
            els.vsBadge.style.display = 'flex'; 
        }

        // Status - Pass match object to check scores
        applyStatus(match.statusInfo, match);

        // Winner / Draw highlight
        applyResult(match);
    };

    const setFlag = (teamObj, url, fallbackText) => {
        if (!teamObj.flag || !teamObj.fallback) return;
        teamObj.flag.style.display = 'none';
        teamObj.fallback.style.display = 'flex';
        teamObj.fallback.textContent = fallbackText ? fallbackText.charAt(0).toUpperCase() : '?';
        if (url) {
            teamObj.flag.src = url;
            teamObj.flag.onload  = () => { teamObj.flag.style.display = 'block'; teamObj.fallback.style.display = 'none'; };
            teamObj.flag.onerror = () => { teamObj.flag.style.display = 'none';  teamObj.fallback.style.display = 'flex'; };
        }
    };

    /* ---------- Status ---------- */
    const applyStatus = (info, match) => {
        // Determine if finished based on score presence
        const hasScores = match.fulltime_a !== null && match.fulltime_b !== null;
        
        let displayStatus = info.status;
        let displayLabel = info.label;
        let isLive = info.isLive;

        if (hasScores) {
            displayStatus = 'finished';
            isLive = false;
            
            // Format start time (e.g., "20:45")
            try {
                const d = new Date(match.date.replace(' ', 'T') + '+04:00');
                const timeString = d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
                displayLabel = `Terminé • ${timeString}`;
            } catch (e) {
                displayLabel = 'Terminé';
            }
        }

        els.statusBadge.className = `tm-status-badge tm-status-${displayStatus}`;
        els.statusLabel.textContent = displayLabel;
        els.liveDot.style.display = isLive ? 'block' : 'none';

        // Handle Timer Display
        if (displayStatus === 'finished') {
            // Clear timer text so it doesn't duplicate the time shown in status label
            els.timer.textContent = ''; 
            els.timer.classList.remove('is-live');
        } else {
            els.timer.style.display = 'block';
            els.timer.textContent = info.timeString;
            els.timer.classList.toggle('is-live', isLive);
        }
    };

    /* ---------- Result (Winner / Draw) ---------- */
    const applyResult = (match) => {
        const card = els.card;

        // Reset everything
        card.classList.remove('is-winner', 'is-draw');
        els.teamA.container.classList.remove('is-winner', 'is-loser');
        els.teamB.container.classList.remove('is-winner', 'is-loser');
        els.teamA.badge.style.opacity = '0';
        els.teamB.badge.style.opacity = '0';
        els.teamA.badge.innerHTML = '';
        els.teamB.badge.innerHTML = '';

        // Check if match has scores (which means it's finished per your API)
        const a = match.fulltime_a;
        const b = match.fulltime_b;

        if (a === null || b === null) return; // No scores = not finished

        const sa = parseInt(a), sb = parseInt(b);

        if (sa === sb) {
            // DRAW — single unified ribbon, both teams equal
            card.classList.add('is-draw');
        } else {
            // WINNER
            card.classList.add('is-winner');
            const winner = sa > sb ? els.teamA : els.teamB;
            const loser  = sa > sb ? els.teamB : els.teamA;

            winner.container.classList.add('is-winner');
            loser.container.classList.add('is-loser');

            winner.badge.innerHTML = `
                <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M7 3v2H3v4c0 1.65 1.35 3 3 3h.72c.75 2.48 2.82 4.34 5.28 4.82V19h-3v2h8v-2h-3v-2.18c2.46-.48 4.53-2.34 5.28-4.82H18c1.65 0 3-1.35 3-3V5h-4V3H7zm0 7c-1.1 0-2-.9-2-2V6h2v4zm12-2c0 1.1-.9 2-2 2V6h2v4z"/>
                </svg>
                <span>Vainqueur</span>`;
            winner.badge.style.opacity = '1';
        }
    };

    /* ---------- Timer ---------- */
    const startTimer = () => {
        if (timerInterval) clearInterval(timerInterval);
        
        timerInterval = setInterval(() => {
            if (!matches.length) return;
            const match = matches[currentMatchIndex];
            
            // If scores exist, it's finished. Clear timer and stop logic.
            if (match.fulltime_a !== null && match.fulltime_b !== null) {
                els.timer.textContent = '';
                return; 
            }

            // Live/Upcoming Logic
            const now = new Date();
            const mDate = new Date(match.date.replace(' ', 'T') + '+04:00');
            const diff = mDate.getTime() - now.getTime();
            const abs = Math.abs(diff);

            const h = Math.floor(abs / 3.6e6) % 24;
            const m = Math.floor(abs / 6e4) % 60;
            const s = Math.floor(abs / 1000) % 60;

            let str = '';
            if (h > 0) str += `${h}h `;
            str += `${String(m).padStart(2,'0')}m ${String(s).padStart(2,'0')}s`;

            els.timer.textContent = diff > 0 ? str : `+${str}`;

            // Refresh data if match time has passed and no scores yet
            if (diff <= 0 && diff > -2000) {
                fetchMatches();
            }
        }, 1000);
    };

    /* ---------- Slider ---------- */
    const startSlider = () => {
        if (sliderInterval) clearInterval(sliderInterval);
        if (matches.length <= 1) return;
        sliderInterval = setInterval(() => {
            currentMatchIndex = (currentMatchIndex + 1) % matches.length;
            els.card.classList.add('fade-out');
            setTimeout(() => {
                renderMatch(currentMatchIndex);
                els.card.classList.remove('fade-out');
            }, 400);
        }, config.sliderSpeed);
    };

    /* ---------- Helpers ---------- */
const flagUrl = (name) => {
    // Returns path to local flag image: assets/flags/Country.png
    if (!name) return null;
    return `assets/flags/${name.replace(/ /g, '_')}.png`;
};

    fetchMatches();
});