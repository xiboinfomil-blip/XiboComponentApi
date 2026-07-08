const eventsEls = {
    teamA: {
        penaltyScore: document.getElementById('penalty-score-a-matchup'),
        penaltySection: document.getElementById('penalty-a-matchup'),
        events: document.getElementById('events-a-matchup')
    },
    teamB: {
        penaltyScore: document.getElementById('penalty-score-b-matchup'),
        penaltySection: document.getElementById('penalty-b-matchup'),
        events: document.getElementById('events-b-matchup')
    }
};

let prevPenalties = { a: null, b: null };

// Main function exposed to be called by partial-matchup.js
function renderEventsPartial(match) {
    if (!match) return;
    updatePenaltyScores(match);
    renderGoalEvents(match);
}

function updatePenaltyScores(match) {
    if (!match.scoreInfo && !match.penalty) return;
    
    const hasPenalties = match.scoreInfo?.hasPenalties || match.penalty !== null;
    const penaltyHome = match.scoreInfo?.penalty?.home ?? match.penalty?.teamA; 
    const penaltyAway = match.scoreInfo?.penalty?.away ?? match.penalty?.teamB;
    
    updateTeamPenalty(eventsEls.teamA, hasPenalties, penaltyHome, 'a');
    updateTeamPenalty(eventsEls.teamB, hasPenalties, penaltyAway, 'b');
}

function updateTeamPenalty(teamObj, hasPenalties, score, key) {
    if (!teamObj.penaltySection || !teamObj.penaltyScore) return;
    
    const displayScore = (hasPenalties && score !== null && score !== undefined) ? score : null;
    
    if (prevPenalties[key] !== displayScore) {
        prevPenalties[key] = displayScore;
        
        if (displayScore !== null) {
            teamObj.penaltySection.style.display = 'flex';
            void teamObj.penaltySection.offsetWidth; // Trigger reflow for animation
            teamObj.penaltySection.classList.add('visible');
            teamObj.penaltyScore.textContent = displayScore;
        } else {
            teamObj.penaltySection.classList.remove('visible');
            setTimeout(() => {
                if(!teamObj.penaltySection.classList.contains('visible')) {
                    teamObj.penaltySection.style.display = 'none';
                }
            }, 600);
        }
    }
}

function renderGoalEvents(match) {
    const homeGoals = match.goals?.home || match.teamA?.scorers || [];
    const awayGoals = match.goals?.away || match.teamB?.scorers || [];
    
    renderEventsList(eventsEls.teamA.events, homeGoals);
    renderEventsList(eventsEls.teamB.events, awayGoals);
}

function renderEventsList(container, goals) {
    if (!container) return;
    
    // Optimization: Only re-render if the goals array actually changed
    const goalsJson = JSON.stringify(goals);
    if (container.dataset.goals === goalsJson) return;
    container.dataset.goals = goalsJson;
    
    container.innerHTML = '';
    if (!goals || goals.length === 0) return;
    
    // ==========================================
    // 1. GROUPING LOGIC: Group by Player Name
    // ==========================================
    const groupedGoals = [];
    const playerMap = new Map();

    goals.forEach(goal => {
        const playerName = goal.player || goal.name || 'Unknown';
        
        if (!playerMap.has(playerName)) {
            const group = { player: playerName, times: [] };
            playerMap.set(playerName, group);
            groupedGoals.push(group); // Preserves chronological order of first goal
        }
        
        playerMap.get(playerName).times.push(goal);
    });

    // ==========================================
    // 2. RENDERING LOGIC: Build the Grouped UI
    // ==========================================
    groupedGoals.forEach(group => {
        const eventEl = document.createElement('div');
        eventEl.className = 'tm-event-matchup'; 
        
        // Add special golden class if the player scored more than once (Brace/Hat-trick)
        if (group.times.length > 1) {
            eventEl.classList.add('tm-event-multi-matchup');
        }

        // Generate HTML for all time badges for this player
        let timesHtml = group.times.map(goal => {
            let timeValue = goal.time || goal.minute;
            let displayTime = '';

            // Check if the time value is a custom string indicator instead of a number
            if (typeof timeValue === 'string') {
                displayTime = timeValue; // Renders "Penalty" directly without appending "'"
            } else {
                displayTime = `${timeValue || 0}`;
                if (goal.extra || goal.extra_time) {
                    displayTime += ` +${goal.extra || goal.extra_time}`;
                }
                displayTime += `'`; // Safely append minute symbol to regular times
            }

            return `<span class="tm-event-time-matchup">${displayTime}</span>`;
        }).join('');

        // Inject the grouped structure into the DOM
        eventEl.innerHTML = `
            <span class="tm-event-icon-matchup"></span>
            <span class="tm-event-player-matchup">${group.player}</span>
            <div class="tm-event-times-container">
                ${timesHtml}
            </div>
        `;
        
        container.appendChild(eventEl);
    });
}