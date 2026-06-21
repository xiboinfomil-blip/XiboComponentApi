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
        dateDisplay: document.getElementById('match-date-display')
    };

    const fetchMatches = async () => {
        try {
            const response = await fetch('/api/todayMatches');
            if (!response.ok) throw new Error('Network response was not ok');
            
            const result = await response.json();
            // Adjust 'data' key based on your actual API response structure
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
                        <svg width="60" height="60" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
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
        if (matches.length === 0 || !els.card) return;
        const match = matches[index];

        // Update Text Content
        if (els.stadium) els.stadium.textContent = match.stadium || 'Stadium';
        if (els.teamA.name) els.teamA.name.textContent = match.team_a;
        if (els.teamB.name) els.teamB.name.textContent = match.team_b;
        
        // Scores
        if (els.teamA.score) els.teamA.score.textContent = match.fulltime_a !== null ? match.fulltime_a : '-';
        if (els.teamB.score) els.teamB.score.textContent = match.fulltime_b !== null ? match.fulltime_b : '-';

        // Flags - Fetching from API
        // We assume the API returns 'team_a_flag' and 'team_b_flag' as URLs.
        // If your API returns country codes, use the getCountryCode helper below.
        
        const setFlag = (teamObj, flagUrl, fallbackText) => {
            if (!teamObj.flag || !teamObj.fallback) return;
            
            // Reset display states
            teamObj.flag.style.display = 'none';
            teamObj.fallback.style.display = 'flex';
            teamObj.fallback.textContent = fallbackText;

            if (flagUrl) {
                teamObj.flag.src = flagUrl;
                teamObj.flag.onload = () => {
                    teamObj.flag.style.display = 'block';
                    teamObj.fallback.style.display = 'none';
                };
                teamObj.flag.onerror = () => {
                    teamObj.flag.style.display = 'none';
                    teamObj.fallback.style.display = 'flex';
                };
            }
        };

        // Use API flag URLs if available, otherwise fall back to flagcdn using country code
        const flagA = match.team_a_flag || `https://flagcdn.com/w160/${getCountryCode(match.team_a)}.png`;
        const flagB = match.team_b_flag || `https://flagcdn.com/w160/${getCountryCode(match.team_b)}.png`;

        setFlag(els.teamA, flagA, match.team_a ? match.team_a.charAt(0).toUpperCase() : 'A');
        setFlag(els.teamB, flagB, match.team_b ? match.team_b.charAt(0).toUpperCase() : 'B');

        // Date
        if (els.dateDisplay) {
            try {
                const dateObj = new Date(match.date.replace(' ', 'T') + 'Z');
                els.dateDisplay.textContent = dateObj.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });
            } catch (e) {
                els.dateDisplay.textContent = match.date;
            }
        }

        // Status UI
        updateStatusUI(match.statusInfo);
    };

    const updateStatusUI = (statusInfo) => {
        if (!els.statusBadge) return;
        els.statusBadge.className = `tm-status-badge tm-status-${statusInfo.status}`;
        if (els.statusLabel) els.statusLabel.textContent = statusInfo.label;
        if (els.liveDot) els.liveDot.style.display = statusInfo.isLive ? 'block' : 'none';
        
        if (els.timer) els.timer.textContent = statusInfo.timeString;
    };

    const startTimer = () => {
        if (timerInterval) clearInterval(timerInterval);
        
        timerInterval = setInterval(() => {
            if (matches.length === 0) return;
            
            const match = matches[currentMatchIndex];
            const now = new Date();
            const matchDate = new Date(match.date.replace(' ', 'T') + 'Z');
            const diffMs = matchDate.getTime() - now.getTime();
            
            const absMs = Math.abs(diffMs);
            const seconds = Math.floor((absMs / 1000) % 60);
            const minutes = Math.floor((absMs / (1000 * 60)) % 60);
            const hours = Math.floor((absMs / (1000 * 60 * 60)) % 24);
            
            let timeStr = '';
            if (hours > 0) timeStr += `${hours}h `;
            timeStr += `${minutes.toString().padStart(2, '0')}m ${seconds.toString().padStart(2, '0')}s`;

            if (els.timer) {
                els.timer.textContent = diffMs > 0 ? timeStr : `+${timeStr}`;
            }

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
            
            if (els.card) els.card.classList.add('fade-out');
            
            setTimeout(() => {
                renderMatch(currentMatchIndex);
                if (els.card) els.card.classList.remove('fade-out');
            }, 400);
        }, config.sliderSpeed);
    };

    const getCountryCode = (teamName) => {
        const map = {
            'Canada': 'ca', 'Mexico': 'mx', 'United States': 'us',
            'Australia': 'au', 'Iran': 'ir', 'Iraq': 'iq', 'Japan': 'jp',
            'Jordan': 'jo', 'Qatar': 'qa', 'Saudi Arabia': 'sa', 'South Korea': 'kr',
            'Uzbekistan': 'uz', 'Algeria': 'dz', 'Cabo Verde': 'cv', 'Cameroon': 'cm',
            'DR Congo': 'cd', 'Egypt': 'eg', 'Ghana': 'gh', 'Ivory Coast': 'ci',
            'Morocco': 'ma', 'Senegal': 'sn', 'South Africa': 'za', 'Tunisia': 'tn',
            'Costa Rica': 'cr', 'Curaçao': 'cw', 'Haiti': 'ht', 'Panama': 'pa',
            'Argentina': 'ar', 'Brazil': 'br', 'Colombia': 'co', 'Ecuador': 'ec',
            'Paraguay': 'py', 'Uruguay': 'uy', 'New Zealand': 'nz',
            'Austria': 'at', 'Belgium': 'be', 'Bosnia and Herzegovina': 'ba',
            'Croatia': 'hr', 'Czechia': 'cz', 'England': 'gb-eng', 'France': 'fr',
            'Germany': 'de', 'Italy': 'it', 'Netherlands': 'nl', 'Norway': 'no',
            'Portugal': 'pt', 'Scotland': 'gb-sct', 'Spain': 'es', 'Sweden': 'se',
            'Switzerland': 'ch', 'Turkey': 'tr'
        };
        return map[teamName] || 'unknown';
    };

    fetchMatches();
});