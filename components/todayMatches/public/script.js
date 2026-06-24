document.addEventListener('DOMContentLoaded', () => {
    const config = window.TODAY_MATCHES_CONFIG || { sliderSpeed: 8000 };
    let matches = [];
    let currentMatchIndex = 0;
    let timerInterval;
    let sliderInterval;

    // Cache configuration
    const CACHE_KEY = 'today_matches_cache';
    const CACHE_TIMESTAMP_KEY = 'today_matches_timestamp';
    
    // GMT+4 timezone offset in milliseconds (4 * 60 * 60 * 1000)
    const GMT4_OFFSET = 4 * 60 * 60 * 1000;

    // DOM Elements
    const els = {
        card: document.getElementById('main-card'),
        statusBadge: document.getElementById('match-status-badge'),
        statusLabel: document.getElementById('status-label'),
        liveDot: document.getElementById('live-indicator'),
        timer: document.getElementById('match-timer'),
        teamA: {
            container: document.getElementById('team-a-container'),
            name: document.getElementById('name-a'),
            score: document.getElementById('score-a'),
            flag: document.getElementById('flag-a'),
            fallback: document.querySelector('#team-a-container .tm-flag-fallback'),
            badge: document.getElementById('badge-a')
        },
        teamB: {
            container: document.getElementById('team-b-container'),
            name: document.getElementById('name-b'),
            score: document.getElementById('score-b'),
            flag: document.getElementById('flag-b'),
            fallback: document.querySelector('#team-b-container .tm-flag-fallback'),
            badge: document.getElementById('badge-b')
        },
        dateDisplay: document.getElementById('match-date-display')
    };

    /**
     * Checks if the cached data is expired.
     * Expires daily at 2:00 AM GMT+4.
     */
    const isCacheExpired = () => {
        const cachedTimestamp = localStorage.getItem(CACHE_TIMESTAMP_KEY);
        if (!cachedTimestamp) return true;

        const lastFetchTime = parseInt(cachedTimestamp, 10);
        const now = new Date();
        
        // Convert current time to GMT+4
        const nowGMT4 = new Date(now.getTime() + GMT4_OFFSET);
        
        // Get the start of the current day in GMT+4 (midnight)
        const startOfDayGMT4 = new Date(nowGMT4);
        startOfDayGMT4.setUTCHours(0, 0, 0, 0);
        
        // Calculate the expiration time: 2:00 AM GMT+4 today
        const expirationTimeGMT4 = new Date(startOfDayGMT4.getTime() + 2 * 60 * 60 * 1000);
        
        // Convert expiration time back to UTC for comparison with lastFetchTime (which is UTC timestamp)
        const expirationTimeUTC = new Date(expirationTimeGMT4.getTime() - GMT4_OFFSET);
        
        // If last fetch was before today's 2 AM GMT+4, cache is expired
        return lastFetchTime < expirationTimeUTC.getTime();
    };

    /**
     * Saves matches to cache with current timestamp
     */
    const saveToCache = (data) => {
        try {
            localStorage.setItem(CACHE_KEY, JSON.stringify(data));
            localStorage.setItem(CACHE_TIMESTAMP_KEY, Date.now().toString());
        } catch (e) {
            console.warn('Failed to save to cache:', e);
        }
    };

    /**
     * Retrieves matches from cache
     */
    const getFromCache = () => {
        try {
            const cachedData = localStorage.getItem(CACHE_KEY);
            return cachedData ? JSON.parse(cachedData) : null;
        } catch (e) {
            console.warn('Failed to retrieve from cache:', e);
            return null;
        }
    };

    const fetchMatches = async () => {
        // Check cache first
        const cachedMatches = getFromCache();
        const cacheExpired = isCacheExpired();
        
        if (cachedMatches && !cacheExpired && cachedMatches.length > 0) {
            console.log('Using cached matches');
            matches = cachedMatches;
            renderMatch(currentMatchIndex);
            startTimer();
            startSlider();
            return;
        }

        console.log('Fetching fresh matches from API');
        
        try {
            const response = await fetch('/api/todayMatches');
            if (!response.ok) throw new Error('Network response was not ok');
            
            const result = await response.json();
            // Adjust 'data' key based on your actual API response structure
            const data = result.data || result; 

            if (data && data.length > 0) {
                matches = data;
                saveToCache(data); // Save to cache
                renderMatch(currentMatchIndex);
                startTimer();
                startSlider();
            } else {
                showEmptyState();
            }
        } catch (error) {
            console.error("Failed to load matches", error);
            // If API fails but we have cached data, use it even if expired
            if (cachedMatches && cachedMatches.length > 0) {
                console.log('API failed, using expired cache as fallback');
                matches = cachedMatches;
                renderMatch(currentMatchIndex);
                startTimer();
                startSlider();
            } else {
                showEmptyState();
            }
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
        if (els.teamA.name) els.teamA.name.textContent = match.team_a;
        if (els.teamB.name) els.teamB.name.textContent = match.team_b;
        
        // Scores
        if (els.teamA.score) els.teamA.score.textContent = match.fulltime_a !== null ? match.fulltime_a : '-';
        if (els.teamB.score) els.teamB.score.textContent = match.fulltime_b !== null ? match.fulltime_b : '-';

        // Flags - Fetching from API
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
                const dateObj = new Date(match.date.replace(' ', 'T') + '+04:00');
                els.dateDisplay.textContent = dateObj.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });
            } catch (e) {
                els.dateDisplay.textContent = match.date;
            }
        }

        // Status UI
        updateStatusUI(match.statusInfo);
        
        // Winner/Draw highlighting
        highlightResult(match);
    };

    const updateStatusUI = (statusInfo) => {
        if (!els.statusBadge) return;
        els.statusBadge.className = `tm-status-badge tm-status-${statusInfo.status}`;
        if (els.statusLabel) els.statusLabel.textContent = statusInfo.label;
        if (els.liveDot) els.liveDot.style.display = statusInfo.isLive ? 'block' : 'none';
        
        // Hide timer if match is finished
        if (els.timer) {
            if (statusInfo.status === 'finished') {
                els.timer.style.display = 'none';
                els.timer.classList.remove('tm-live-flicker');
            } else {
                els.timer.style.display = 'block';
                els.timer.textContent = statusInfo.timeString;
                
                // Add flicker effect if live
                if (statusInfo.isLive) {
                    els.timer.classList.add('tm-live-flicker');
                } else {
                    els.timer.classList.remove('tm-live-flicker');
                }
            }
        }
    };

    const highlightResult = (match) => {
        const centerBadge = document.getElementById('center-badge');
        
        // Reset states
        els.teamA.container.classList.remove('tm-winner', 'tm-draw', 'tm-loser');
        els.teamB.container.classList.remove('tm-winner', 'tm-draw', 'tm-loser');
        
        if (centerBadge) centerBadge.style.display = 'none';
        if (els.teamA.badge) els.teamA.badge.style.display = 'none';
        if (els.teamB.badge) els.teamB.badge.style.display = 'none';

        // Only highlight if match is finished and scores are available
        if (match.statusInfo.status === 'finished' && match.fulltime_a !== null && match.fulltime_b !== null) {
            const scoreA = parseInt(match.fulltime_a);
            const scoreB = parseInt(match.fulltime_b);

            if (scoreA > scoreB) {
                // Team A wins
                els.teamA.container.classList.add('tm-winner');
                els.teamB.container.classList.add('tm-loser');
                if (els.teamA.badge) {
                    els.teamA.badge.innerHTML = `
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                            <path d="M7 3v2H3v4c0 1.65 1.35 3 3 3h.72c.75 2.48 2.82 4.34 5.28 4.82V19h-3v2h8v-2h-3v-2.18c2.46-.48 4.53-2.34 5.28-4.82H18c1.65 0 3-1.35 3-3V5h-4V3H7zm0 7c-1.1 0-2-.9-2-2V6h2v4zm12-2c0 1.1-.9 2-2 2V6h2v4z"/>
                        </svg>
                        <span>Vainqueur</span>
                    `;
                    els.teamA.badge.style.display = 'inline-flex';
                }
            } else if (scoreB > scoreA) {
                // Team B wins
                els.teamB.container.classList.add('tm-winner');
                els.teamA.container.classList.add('tm-loser');
                if (els.teamB.badge) {
                    els.teamB.badge.innerHTML = `
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                            <path d="M7 3v2H3v4c0 1.65 1.35 3 3 3h.72c.75 2.48 2.82 4.34 5.28 4.82V19h-3v2h8v-2h-3v-2.18c2.46-.48 4.53-2.34 5.28-4.82H18c1.65 0 3-1.35 3-3V5h-4V3H7zm0 7c-1.1 0-2-.9-2-2V6h2v4zm12-2c0 1.1-.9 2-2 2V6h2v4z"/>
                        </svg>
                        <span>Vainqueur</span>
                    `;
                    els.teamB.badge.style.display = 'inline-flex';
                }
            } else {
                // It's a draw
                els.teamA.container.classList.add('tm-draw');
                els.teamB.container.classList.add('tm-draw');
                
                if (centerBadge) {
                    centerBadge.innerHTML = `
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                            <line x1="5" y1="12" x2="19" y2="12"/>
                        </svg>
                        <span>Match Nul</span>
                    `;
                    centerBadge.style.display = 'inline-flex';
                }
            }
        }
    };

    const startTimer = () => {
        if (timerInterval) clearInterval(timerInterval);
        
        timerInterval = setInterval(() => {
            if (matches.length === 0) return;
            
            const match = matches[currentMatchIndex];
            
            // Don't update timer if match is finished
            if (match.statusInfo.status === 'finished') {
                return;
            }
            
            const now = new Date();
            const matchDate = new Date(match.date.replace(' ', 'T') + '+04:00');
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