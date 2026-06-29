document.addEventListener('DOMContentLoaded', () => {
    const config = getConfig(); 
    let matches = [];
    let currentMatchIndex = 0;
    let timerInterval, sliderInterval;

    const els = {
        card: document.getElementById('main-card'),
        dateDisplay: document.getElementById('match-date-display')
    };

    /* ---------- Fetch ---------- */
    const fetchMatches = async () => {
        try {
            const params = new URLSearchParams();
            if (config.refetch) params.append('refetch', 'true');
            if (config.dummy) params.append('dummy', 'true');

            const queryString = params.toString();
            const apiUrl = queryString ? `/api/todayMatches?${queryString}` : '/api/todayMatches';
            
            const response = await fetch(apiUrl);
            if (!response.ok) throw new Error(`Network response was not ok: ${response.status}`);
            
            const result = await response.json();
            const data = result.data || result;

            if (data && Array.isArray(data) && data.length > 0) {
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
                            <circle cx="12" cy="12" r="10"/><path d="M12 8v4m0 4h.01"/>
                        </svg>
                    </div>
                    <h3>Aucun match aujourd'hui</h3>
                    <p>Revenez plus tard pour voir les prochains matchs.</p>
                </div>
            </div>`;
    };

    /* ---------- Render Coordinator ---------- */
    const renderMatch = (index) => {
        if (!matches.length || !els.card) return;
        
        const match = matches[index];
        if (!match) return;

        // Update Date in Footer
        if (els.dateDisplay && match.date) {
            try {
                const d = new Date(match.date.replace(' ', 'T'));
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
            if (!matches.length) return;
            const match = matches[currentMatchIndex];
            if (!match) return;

            // Update Timer via Sub-Component
            if (typeof updateTimerDisplay === 'function') updateTimerDisplay(match);

            // Auto-refetch logic
            if (config.refetch && match.statusInfo && match.statusInfo.status !== 'upcoming') {
                const now = new Date();
                const mDate = new Date(match.date.replace(' ', 'T') + '+04:00');
                const diff = mDate.getTime() - now.getTime();
                if (diff <= 0 && diff > -2000) fetchMatches();
            }
        }, 1000);
    };

    const startSlider = () => {
        if (sliderInterval) clearInterval(sliderInterval);
        if (matches.length <= 1) return;
        
        const sliderIntervalTime = (config.speed || 5) * 1000;

        sliderInterval = setInterval(() => {
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

    fetchMatches();
});
