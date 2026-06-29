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
        card: document.getElementById('main-card'),
        dateDisplay: document.getElementById('match-date-display'),
        wrapper: document.getElementById('today-matches-slider-wrapper')
    };

    /* ---------- Loading State Management ---------- */
    const showLoadingState = () => {
        if (!els.card) return;
        isLoading = true;
        
        if (timerInterval) clearInterval(timerInterval);
        if (sliderInterval) clearInterval(sliderInterval);
        
        els.card.classList.add('is-loading');
        
        const existingLoader = els.card.querySelector('.tm-loading-overlay');
        if (!existingLoader) {
            const loaderHTML = `
                <div class="tm-loading-overlay">
                    <div class="tm-loading-spinner">
                        <div class="tm-spinner-ring"></div>
                        <div class="tm-spinner-ring"></div>
                        <div class="tm-spinner-ring"></div>
                        <svg class="tm-spinner-icon" viewBox="0 0 24 24" fill="currentColor">
                            <path d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z"/>
                        </svg>
                    </div>
                    <div class="tm-loading-text">Chargement des matchs...</div>
                </div>
            `;
            els.card.insertAdjacentHTML('beforeend', loaderHTML);
        }
    };

    const hideLoadingState = () => {
        if (!els.card) return;
        isLoading = false;
        
        els.card.classList.remove('is-loading');
        
        const loader = els.card.querySelector('.tm-loading-overlay');
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
        
        const isFinished = apiMatch.current_status === 'finished';
        
        // Check for live/progress statuses from API
        const liveStatuses = ['inprogress', 'playing', '1st_half', '2nd_half', 'halftime', 'extra_time', 'penalty', 'live'];
        const currentStatus = apiMatch.current_status?.toLowerCase() || '';
        const isApiLive = liveStatuses.some(status => currentStatus.includes(status));
        
        let statusKey = 'upcoming';
        let isLive = false;
        let timeString = '';
        let label = '';

        const timeOptions = { hour: '2-digit', minute: '2-digit' };
        const formattedTime = !isNaN(matchDate.getTime()) 
            ? matchDate.toLocaleTimeString('fr-FR', timeOptions) 
            : apiMatch.date.split(' ')[1]?.substring(0, 5);

        if (isFinished) {
            statusKey = 'finished';
            label = 'Match terminé';
            timeString = formattedTime;
        } else if (isApiLive) {
            statusKey = 'live';
            isLive = true;
            label = 'Live';
            timeString = 'LIVE'; 
        } else {
            const now = new Date();
            if (now > matchDate && !isFinished) {
                statusKey = 'live';
                isLive = true;
                label = 'Live';
                timeString = 'LIVE'; 
            } else {
                statusKey = 'upcoming';
                label = 'À venir';
                timeString = formattedTime;
            }
        }

        return {
            ...apiMatch,
            statusInfo: {
                status: statusKey,
                isLive: isLive,
                timeString: timeString,
                label: label
            }
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
            const halftimeMin = halftimeMinutes % 60;
            
            // Check if we're within 2 minutes of halftime
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
            const fulltimeMin = fulltimeMinutes % 60;
            
            // Check if we're within 2 minutes of fulltime
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
            const oneHourMin = oneHourAfterFulltime % 60;
            
            // Check if we're within 2 minutes of 1hr after fulltime
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
        // Prevent rapid successive calls (minimum 30 seconds between fetches)
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
            const apiUrl = queryString ? `/api/todayMatches?${queryString}` : '/api/todayMatches';
            
            const response = await fetch(apiUrl);
            if (!response.ok) throw new Error(`Network response was not ok: ${response.status}`);
            
            const result = await response.json();
            const rawData = result.data || result;

            if (rawData && Array.isArray(rawData) && rawData.length > 0) {
                matches = rawData.map(normalizeMatchData);
                
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
            <div class="tm-bg-effects"></div>
            <div class="tm-glass-overlay"></div>
            <div class="tm-card-content">
                <div class="tm-empty-state">
                    <div class="tm-empty-icon">
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
            <div class="tm-bg-effects"></div>
            <div class="tm-glass-overlay"></div>
            <div class="tm-card-content">
                <div class="tm-error-state">
                    <div class="tm-error-icon">
                        <svg width="60" height="60" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                            <circle cx="12" cy="12" r="10"/><path d="M12 8v4m0 4h.01"/>
                        </svg>
                    </div>
                    <h3>Erreur de chargement</h3>
                    <p>Impossible de charger les matchs. Veuillez réessayer.</p>
                    <button onclick="location.reload()" class="tm-retry-btn">Réessayer</button>
                </div>
            </div>`;
    };

    /* ---------- Render Coordinator ---------- */
    const renderMatch = (index) => {
        if (!matches.length || !els.card || isLoading) return;
        
        const match = matches[index];
        if (!match) return;

        if (els.dateDisplay && match.date) {
            try {
                const d = new Date(match.date.replace(' ', 'T') + '+04:00');
                if (!isNaN(d.getTime())) {
                    els.dateDisplay.textContent = d.toLocaleDateString('fr-FR', { weekday:'long', day:'numeric', month:'long' });
                } else { els.dateDisplay.textContent = match.date; }
            } catch { els.dateDisplay.textContent = match.date; }
        }

        if (typeof applyStatus === 'function') applyStatus(match.statusInfo, match);
        if (typeof renderMatchup === 'function') renderMatchup(match);
    };

    /* ---------- Timer & Slider ---------- */
    const startTimer = () => {
        if (timerInterval) clearInterval(timerInterval);
        timerInterval = setInterval(() => {
            if (!matches.length || isLoading) return;
            const match = matches[currentMatchIndex];
            if (!match) return;

            if (typeof updateTimerDisplay === 'function') updateTimerDisplay(match);
        }, 1000);
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
        
        // Check every 30 seconds if we should refetch
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
            
            // Remove hourly keys from previous hours
            for (const key of triggeredRefetches) {
                if (key.startsWith('hourly-')) {
                    const hour = parseInt(key.split('-')[1]);
                    if (hour !== currentHour) {
                        triggeredRefetches.delete(key);
                    }
                }
            }
        }, 300000); // Every 5 minutes
    };

    // Initial fetch
    fetchMatches(true);
    
    // Start smart refetch checking
    startSmartRefetch();
    cleanupTriggeredRefetches();
});