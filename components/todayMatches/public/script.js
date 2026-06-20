document.addEventListener('DOMContentLoaded', () => {
    const config = window.TODAY_MATCHES_CONFIG || { sliderSpeed: 8000 };
    let matches = [];
    let currentMatchIndex = 0;
    let timerInterval;
    let sliderInterval;

    // DOM Elements
    const els = {
        card: document.getElementById('main-card'),
        statusBadge: document.getElementById('match-status-badge'),
        statusLabel: document.getElementById('status-label'),
        liveDot: document.getElementById('live-indicator'),
        timer: document.getElementById('match-timer'),
        stadium: document.getElementById('stadium-name'),
        teamA: {
            container: document.getElementById('team-a-container'),
            name: document.getElementById('name-a'),
            score: document.getElementById('score-a'),
            flag: document.getElementById('flag-a'),
            fallback: document.querySelector('#team-a-container .tm-flag-fallback')
        },
        teamB: {
            container: document.getElementById('team-b-container'),
            name: document.getElementById('name-b'),
            score: document.getElementById('score-b'),
            flag: document.getElementById('flag-b'),
            fallback: document.querySelector('#team-b-container .tm-flag-fallback')
        },
        dateDisplay: document.getElementById('match-date-display'),
        prevBtn: document.getElementById('prev-match'),
        nextBtn: document.getElementById('next-match')
    };

    const fetchMatches = async () => {
        try {
            // Assuming you have an API endpoint set up in your Express app
            // e.g., app.get('/api/todayMatches', (req, res) => res.json(service.getTodayMatches()))
            const response = await fetch('/api/todayMatches');
            if (!response.ok) throw new Error('Network response was not ok');
            
            const data = await response.json();
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
        els.card.innerHTML = `
            <div class="tm-bg-effects"></div>
            <div class="tm-glass-overlay"></div>
            <div class="tm-card-content">
                <div class="tm-empty-state">
                    <div class="tm-empty-icon">
                        <svg width="80" height="80" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
                            <circle cx="12" cy="12" r="10"/>
                            <path d="M12 8v4m0 4h.01"/>
                        </svg>
                    </div>
                    <h3>Aucun match aujourd'hui</h3>
                    <p>Revenez plus tard pour voir les prochains matchs.</p>
                </div>
            </div>
        `;
    };

    const renderMatch = (index) => {
        if (matches.length === 0) return;
        const match = matches[index];

        // Update Text Content
        els.stadium.textContent = match.stadium || 'Stadium';
        els.teamA.name.textContent = match.team_a;
        els.teamB.name.textContent = match.team_b;
        
        // Scores
        els.teamA.score.textContent = match.fulltime_a !== null ? match.fulltime_a : '-';
        els.teamB.score.textContent = match.fulltime_b !== null ? match.fulltime_b : '-';

        // Flags (Using a placeholder service or local assets)
        // Note: You might need to map team names to country codes for flags
        els.teamA.flag.src = `https://flagcdn.com/w160/${getCountryCode(match.team_a)}.png`;
        els.teamB.flag.src = `https://flagcdn.com/w160/${getCountryCode(match.team_b)}.png`;

        // Date
        const dateObj = new Date(match.date.replace(' ', 'T') + 'Z');
        els.dateDisplay.textContent = dateObj.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });

        // Status UI
        updateStatusUI(match.statusInfo);
    };

    const updateStatusUI = (statusInfo) => {
        els.statusBadge.className = `tm-status-badge tm-status-${statusInfo.status}`;
        els.statusLabel.textContent = statusInfo.label;
        els.liveDot.style.display = statusInfo.isLive ? 'block' : 'none';
        
        // Initial timer text
        els.timer.textContent = statusInfo.timeString;
    };

    const startTimer = () => {
        if (timerInterval) clearInterval(timerInterval);
        
        timerInterval = setInterval(() => {
            if (matches.length === 0) return;
            
            const match = matches[currentMatchIndex];
            const now = new Date();
            const matchDate = new Date(match.date.replace(' ', 'T') + 'Z');
            const diffMs = matchDate.getTime() - now.getTime();
            
            // Recalculate time string locally
            const absMs = Math.abs(diffMs);
            const seconds = Math.floor((absMs / 1000) % 60);
            const minutes = Math.floor((absMs / (1000 * 60)) % 60);
            const hours = Math.floor((absMs / (1000 * 60 * 60)) % 24);
            
            let timeStr = '';
            if (hours > 0) timeStr += `${hours}h `;
            timeStr += `${minutes}m ${seconds}s`;

            els.timer.textContent = diffMs > 0 ? timeStr : `+${timeStr}`;

            // If a match just started (crossed 0), refresh data to get scores
            if (diffMs <= 0 && diffMs > -2000 && match.statusInfo.status !== 'live') {
                fetchMatches(); 
            }
        }, 1000);
    };

    const startSlider = () => {
        if (sliderInterval) clearInterval(sliderInterval);
        if (matches.length <= 1) return;

        sliderInterval = setInterval(() => {
            currentMatchIndex = (currentMatchIndex + 1) % matches.length;
            
            // Add fade-out effect
            els.card.classList.add('fade-out');
            
            setTimeout(() => {
                renderMatch(currentMatchIndex);
                els.card.classList.remove('fade-out');
            }, 400); // Wait for half the transition time
        }, config.sliderSpeed);
    };

    // Helper to map team names to ISO codes for flags
    const getCountryCode = (teamName) => {
        const map = {
            'Allemagne': 'de', 'Écosse': 'gb-sct', 'Espagne': 'es', 'Italie': 'it',
            'France': 'fr', 'Angleterre': 'gb-eng', 'Portugal': 'pt', 'Belgique': 'be'
        };
        return map[teamName] || 'unknown';
    };

    // Button Listeners
    if (els.prevBtn) {
        els.prevBtn.addEventListener('click', () => {
            currentMatchIndex = (currentMatchIndex - 1 + matches.length) % matches.length;
            renderMatch(currentMatchIndex);
        });
    }
    if (els.nextBtn) {
        els.nextBtn.addEventListener('click', () => {
            currentMatchIndex = (currentMatchIndex + 1) % matches.length;
            renderMatch(currentMatchIndex);
        });
    }

    // Initialize
    fetchMatches();
});