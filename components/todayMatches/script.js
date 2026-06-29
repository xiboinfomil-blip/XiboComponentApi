document.addEventListener('DOMContentLoaded', () => {
    const config = getConfig(); 
    let matches = [];
    let currentMatchIndex = 0;
    let timerInterval, sliderInterval;
    let isLoading = false;

    const els = {
        card: document.getElementById('main-card'),
        dateDisplay: document.getElementById('match-date-display'),
        wrapper: document.getElementById('today-matches-slider-wrapper')
    };

    /* ---------- Loading State Management ---------- */
    const showLoadingState = () => {
        if (!els.card) return;
        isLoading = true;
        
        // Pause any running animations/intervals
        if (timerInterval) clearInterval(timerInterval);
        if (sliderInterval) clearInterval(sliderInterval);
        
        // Add loading class to card for CSS transitions
        els.card.classList.add('is-loading');
        
        // Show loading overlay
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
        
        // Remove loading class
        els.card.classList.remove('is-loading');
        
        // Remove loading overlay with fade out
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

        // Parse the date string "2026-06-11 23:00:00"
        const matchDate = new Date(apiMatch.date.replace(' ', 'T') + '+04:00'); 
        
        const isFinished = apiMatch.current_status === 'finished';
        let statusKey = 'upcoming';
        let isLive = false;
        let timeString = '';
        let label = '';

        // Format time as HH:mm
        const timeOptions = { hour: '2-digit', minute: '2-digit' };
        const formattedTime = !isNaN(matchDate.getTime()) 
            ? matchDate.toLocaleTimeString('fr-FR', timeOptions) 
            : apiMatch.date.split(' ')[1]?.substring(0, 5);

        if (isFinished) {
            statusKey = 'finished';
            label = 'Match terminé';
            timeString = formattedTime; // Display start time for finished matches
        } else {
            // Check if currently live (simple logic: now is after start time)
            const now = new Date();
            if (now > matchDate) {
                statusKey = 'live';
                isLive = true;
                label = 'Live';
                // For live, you might want to show elapsed minutes, but you requested "Live"
                timeString = 'LIVE'; 
            } else {
                statusKey = 'upcoming';
                label = 'À venir';
                timeString = formattedTime; // Display start time for upcoming matches
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

    /* ---------- Fetch ---------- */
    const fetchMatches = async () => {
        // Show loading state immediately
        showLoadingState();
        
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
                
                // Hide loading before rendering to ensure smooth transition
                hideLoadingState();
                
                // Small delay to allow loading overlay to fade out
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

        // Update Date in Footer
        if (els.dateDisplay && match.date) {
            try {
                const d = new Date(match.date.replace(' ', 'T') + '+04:00');
                if (!isNaN(d.getTime())) {
                    els.dateDisplay.textContent = d.toLocaleDateString('fr-FR', { weekday:'long', day:'numeric', month:'long' });
                } else { els.dateDisplay.textContent = match.date; }
            } catch { els.dateDisplay.textContent = match.date; }
        }

        // Call Sub-Component Functions
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

            // Auto-refetch logic
            if (config.refetch && match.statusInfo && match.statusInfo.status === 'live') {
                const now = new Date();
                const mDate = new Date(match.date.replace(' ', 'T') + '+04:00');
                if (now - mDate > 5400000) { // Refetch after ~90 mins
                    fetchMatches();
                }
            }
        }, 1000);
    };

    const startSlider = () => {
        if (sliderInterval) clearInterval(sliderInterval);
        if (matches.length <= 1) return;
        
        const sliderIntervalTime = (config.speed || 5) * 1000;

        sliderInterval = setInterval(() => {
            if (isLoading) return; // Don't slide while loading
            
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

    // Initial fetch
    fetchMatches();
    
    // Optional: Periodic refetch
    if (config.refetch) {
        setInterval(() => {
            if (!isLoading) {
                fetchMatches();
            }
        }, 60000); // Refetch every minute
    }
});