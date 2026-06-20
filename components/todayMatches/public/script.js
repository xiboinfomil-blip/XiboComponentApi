// components/todayMatches/public/script.js

document.addEventListener('DOMContentLoaded', async () => {
    const config = window.TODAY_MATCHES_CONFIG || { sliderSpeed: 8000 };
    const sliderSpeed = Number(config.sliderSpeed) || 8000;

    const container = document.querySelector('.tm-card-container');
    if (!container) return;

    let currentMatchesData = [];
    let currentIndex = 0;

    // Helper to get flag image path
    const getFlagPath = (teamName) => {
        if (!teamName) return '';
        const cleanName = teamName.toLowerCase().replace(/[^a-z]/g, '');
        // Note: Ensure your flags are stored in the root 'public/flags' folder 
        // or adjust this path to match where you put them.
        return `/assets/flags/${cleanName}.png`; 
    };

    // Function to generate the HTML for a single match card
    const renderCard = (match) => {
        if (!match) {
            return `
            <div class="tm-card-worldcup">
                <div class="tm-bg-effects">
                    <div class="tm-gradient-orb tm-orb-1"></div>
                    <div class="tm-gradient-orb tm-orb-2"></div>
                    <div class="tm-gradient-orb tm-orb-3"></div>
                    <div class="tm-mesh-gradient"></div>
                </div>
                <div class="tm-glass-overlay"></div>
                <div class="tm-card-content">
                    <div class="tm-empty-state">
                        <div class="tm-empty-icon">
                            <svg width="80" height="80" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
                                <circle cx="12" cy="12" r="10"/>
                                <path d="M12 8v4m0 4h.01"/>
                            </svg>
                        </div>
                        <h3>Aucun Match Aujourd'hui</h3>
                        <p>Revenez demain pour des matchs excitants !</p>
                    </div>
                </div>
            </div>`;
        }

        const time = match.date ? match.date.split(' ')[1]?.substring(0, 5) : "--:--";
        const isFinished = match.fulltime === true;
        const statusText = isFinished ? "TERMINÉ" : "À VENIR";
        const statusColor = isFinished ? "#10b981" : "#f59e0b";
        const statusBg = isFinished ? "rgba(16, 185, 129, 0.15)" : "rgba(245, 158, 11, 0.15)";

        let winnerTeam = null;
        if (isFinished && match.fulltime_a !== undefined && match.fulltime_b !== undefined) {
            if (match.fulltime_a > match.fulltime_b) winnerTeam = 'a';
            else if (match.fulltime_b > match.fulltime_a) winnerTeam = 'b';
        }

        return `
        <div class="tm-card-worldcup">
            <div class="tm-bg-effects">
                <div class="tm-gradient-orb tm-orb-1"></div>
                <div class="tm-gradient-orb tm-orb-2"></div>
                <div class="tm-gradient-orb tm-orb-3"></div>
                <div class="tm-mesh-gradient"></div>
            </div>
            <div class="tm-glass-overlay"></div>
            <div class="tm-card-content">
                <div class="tm-card-header">
                    <div class="tm-tournament-badge">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                            <path d="M12 2L2 7l10 5 10-5-10-5z"/>
                            <path d="M2 17l10 5 10-5"/>
                            <path d="M2 12l10 5 10-5"/>
                        </svg>
                        <span>${match.group || 'Coupe du Monde 2026'}</span>
                    </div>
                    <div class="tm-status-indicator" style="background: ${statusBg}; color: ${statusColor}; border-color: ${statusColor}40;">
                        <span class="tm-status-dot" style="background: ${statusColor};"></span>
                        <span>${statusText}</span>
                    </div>
                </div>
                <div class="tm-venue-info">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/>
                        <circle cx="12" cy="10" r="3"/>
                    </svg>
                    <span>${match.stadium || 'Stade'}</span>
                </div>
                <div class="tm-matchup-container">
                    <div class="tm-team tm-team-a ${winnerTeam === 'a' ? 'tm-winner' : ''}">
                        <div class="tm-flag-wrapper">
                            <div class="tm-flag-container">
                                <img src="${getFlagPath(match.team_a)}" alt="${match.team_a}" loading="lazy" class="tm-flag-image"
                                     onerror="this.parentElement.classList.add('tm-flag-error'); this.style.display='none'; this.nextElementSibling.style.display='flex'">
                                <div class="tm-flag-fallback" style="display:none">${match.team_a ? match.team_a.charAt(0).toUpperCase() : '?'}</div>
                            </div>
                            ${winnerTeam === 'a' ? '<div class="tm-winner-badge">👑</div>' : ''}
                        </div>
                        <h3 class="tm-team-name">${match.team_a || 'Équipe A'}</h3>
                        ${isFinished ? `<div class="tm-team-score">${match.fulltime_a ?? '-'}</div>` : ''}
                    </div>
                    <div class="tm-center-display">
                        ${isFinished ? `
                            <div class="tm-final-score"><span class="tm-score-separator">-</span></div>
                            <div class="tm-match-result">${winnerTeam ? 'VAINQUEUR' : 'MATCH NUL'}</div>
                        ` : `
                            <div class="tm-vs-badge">VS</div>
                            <div class="tm-kickoff-time">
                                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                                    <circle cx="12" cy="12" r="10"/>
                                    <polyline points="12 6 12 12 16 14"/>
                                </svg>
                                <span>${time}</span>
                            </div>
                        `}
                    </div>
                    <div class="tm-team tm-team-b ${winnerTeam === 'b' ? 'tm-winner' : ''}">
                        <div class="tm-flag-wrapper">
                            <div class="tm-flag-container">
                                <img src="${getFlagPath(match.team_b)}" alt="${match.team_b}" loading="lazy" class="tm-flag-image"
                                     onerror="this.parentElement.classList.add('tm-flag-error'); this.style.display='none'; this.nextElementSibling.style.display='flex'">
                                <div class="tm-flag-fallback" style="display:none">${match.team_b ? match.team_b.charAt(0).toUpperCase() : '?'}</div>
                            </div>
                            ${winnerTeam === 'b' ? '<div class="tm-winner-badge">👑</div>' : ''}
                        </div>
                        <h3 class="tm-team-name">${match.team_b || 'Équipe B'}</h3>
                        ${isFinished ? `<div class="tm-team-score">${match.fulltime_b ?? '-'}</div>` : ''}
                    </div>
                </div>
                <div class="tm-card-footer">
                    <div class="tm-match-date">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                            <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
                            <line x1="16" y1="2" x2="16" y2="6"/>
                            <line x1="8" y1="2" x2="8" y2="6"/>
                            <line x1="3" y1="10" x2="21" y2="10"/>
                        </svg>
                        <span>AUJOURD'HUI</span>
                    </div>
                </div>
            </div>
        </div>`;
    };

    // Function to handle the fade-out, data fetch, cycling, and fade-in
    const updateCard = async () => {
        const card = container.querySelector('.tm-card-worldcup');
        
        // 1. Fade out current card
        if (card) {
            card.classList.add('fade-out');
            await new Promise(resolve => setTimeout(resolve, 800)); // Wait for CSS transition
        }
        
        try {
            // 2. Fetch fresh data from API (ensures scores/status are up to date)
            const response = await fetch('/api/todayMatches');
            const result = await response.json();
            
            if (result.status === 'success' && result.data) {
                currentMatchesData = result.data;
            }
            
            // 3. Cycle to the next match index
            if (currentMatchesData.length > 0) {
                currentIndex = (currentIndex + 1) % currentMatchesData.length;
            } else {
                currentIndex = 0;
            }
            
            // 4. Render the new card
            const match = currentMatchesData.length > 0 ? currentMatchesData[currentIndex] : null;
            const newCardHtml = renderCard(match);
            container.innerHTML = newCardHtml;
            
            // 5. Fade in the new card
            const newCard = container.querySelector('.tm-card-worldcup');
            if (newCard) {
                requestAnimationFrame(() => {
                    newCard.classList.remove('fade-out');
                });
            }
        } catch (error) {
            console.error("Error updating card:", error);
            // If fetch fails, fade the old card back in
            if (card) card.classList.remove('fade-out');
        }
    };

    // --- INITIAL LOAD ---
    try {
        const response = await fetch('/api/todayMatches');
        const result = await response.json();
        if (result.status === 'success' && result.data) {
            currentMatchesData = result.data;
        }
    } catch (e) { 
        console.error("Initial fetch error:", e); 
    }

    // Render the first card immediately (no fade out)
    const firstMatch = currentMatchesData.length > 0 ? currentMatchesData[0] : null;
    container.innerHTML = renderCard(firstMatch);
    const firstCard = container.querySelector('.tm-card-worldcup');
    if(firstCard) firstCard.classList.remove('fade-out');

    // --- START SLIDER LOOP ---
    // Only start the interval if we have more than 1 match to cycle through
    if (currentMatchesData.length > 1) {
        setTimeout(() => {
            updateCard(); // First update after the initial delay
            setInterval(updateCard, sliderSpeed); // Recurring updates
        }, sliderSpeed);
    }
});