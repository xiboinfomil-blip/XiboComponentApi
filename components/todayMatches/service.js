// components/todayMatches/service.js

let cachedMatches = null;
let cacheExpirationTime = 0;

const getNextExpirationTime = () => {
    const now = new Date();
    const today = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
    // L'île Maurice est à UTC+4, donc 6h à l'île Maurice correspond à 2h UTC
    const targetHourUTC = 2; 
    
    let nextExpiration = new Date(today);
    nextExpiration.setUTCHours(targetHourUTC, 0, 0, 0);

    if (now.getTime() >= nextExpiration.getTime()) {
        nextExpiration.setUTCDate(nextExpiration.getUTCDate() + 1);
    }

    return nextExpiration.getTime();
};

const formatDuration = (ms) => {
    const seconds = Math.floor((ms / 1000) % 60);
    const minutes = Math.floor((ms / (1000 * 60)) % 60);
    const hours = Math.floor((ms / (1000 * 60 * 60)) % 24);

    const parts = [];
    if (hours > 0) parts.push(`${hours}h`);
    if (minutes > 0 || hours > 0) parts.push(`${minutes}m`);
    parts.push(`${seconds}s`);
    
    return parts.join(' ');
};

const getMatchStatusInfo = (matchDateStr) => {
    const now = new Date();
    // S'assurer que la date est analysée en UTC si la chaîne ne spécifie pas de fuseau horaire
    const matchDate = new Date(matchDateStr.replace(' ', 'T') + 'Z'); 
    const diffMs = matchDate.getTime() - now.getTime();
    
    // Supposons qu'un match est "En direct" pendant 2 heures après le coup d'envoi pour cette démo
    const LIVE_WINDOW_MS = 2 * 60 * 60 * 1000; 

    if (diffMs > 0) {
        return {
            status: 'upcoming',
            label: 'Commence dans',
            timeString: formatDuration(diffMs),
            isLive: false
        };
    } else if (Math.abs(diffMs) < LIVE_WINDOW_MS) {
        return {
            status: 'live',
            label: 'EN DIRECT',
            timeString: `+${formatDuration(Math.abs(diffMs))}`,
            isLive: true
        };
    } else {
        return {
            status: 'finished',
            label: 'FT', // Fin du temps réglementaire (Full Time)
            timeString: 'Terminé',
            isLive: false
        };
    }
};

exports.getTodayMatches = async (useDummyData = false) => {
    const apiUrl = "https://euro.omediainteractive.net/imleuro/items/matches";
    
    console.log("=".repeat(80));
    console.log("[getTodayMatches] Fonction appelée");
    console.log("[getTodayMatches] useDummyData:", useDummyData);
    console.log("[getTodayMatches] Heure actuelle:", new Date().toISOString());
    console.log("[getTodayMatches] Cache existe:", !!cachedMatches);
    console.log("[getTodayMatches] Expiration du cache:", cacheExpirationTime ? new Date(cacheExpirationTime).toISOString() : 'N/A');
    console.log("[getTodayMatches] Cache valide:", cachedMatches && Date.now() < cacheExpirationTime);
    console.log("=".repeat(80));

    const getDummyMatches = () => {
        const todayStr = new Date().toISOString().split('T')[0];
        return [
            {
                date: `${todayStr} 18:00:00`,
                group: "Groupe A",
                stadium: "Olympiastadion",
                team_a: "Allemagne",
                team_b: "Écosse",
                fulltime: false,
                fulltime_a: null,
                fulltime_b: null
            },
            {
                date: `${todayStr} 20:45:00`,
                group: "Groupe B",
                stadium: "Allianz Arena",
                team_a: "Espagne",
                team_b: "Italie",
                fulltime: false,
                fulltime_a: null,
                fulltime_b: null
            }
        ];
    };

    const now = Date.now();

    // Retourner les données mises en cache avec des calculs de temps actualisés si toujours valides
    if (!useDummyData && cachedMatches && now < cacheExpirationTime) {
        console.log("[getTodayMatches] ✅ Retour des matchs en cache");
        return cachedMatches.map(m => ({ ...m, statusInfo: getMatchStatusInfo(m.date) }));
    }

    let matchesData = [];

    try {
        if (useDummyData) {
            console.log("[getTodayMatches] Utilisation des données fictives");
            matchesData = getDummyMatches();
        } else {
            console.log("[getTodayMatches] 🔄 Récupération des nouveaux matchs depuis l'API...");
            console.log("[getTodayMatches] URL de l'API:", apiUrl);
            
            // Vérifier si fetch est disponible
            console.log("[getTodayMatches] typeof fetch:", typeof fetch);
            console.log("[getTodayMatches] global.fetch disponible:", typeof global.fetch !== 'undefined');
            
            const controller = new AbortController();
            const timeoutMs = 10000;
            console.log(`[getTodayMatches] Délai d'attente défini à ${timeoutMs}ms`);
            
            const timeoutId = setTimeout(() => {
                console.log("[getTodayMatches] ⏰ Délai d'attente atteint ! Abandon de la requête...");
                controller.abort();
            }, timeoutMs);

            const startTime = Date.now();
            console.log("[getTodayMatches] Requête démarrée à:", new Date(startTime).toISOString());

            try {
                // Note : Dans Node.js, assurez-vous d'utiliser Node 18+ pour fetch natif, 
                // ou utilisez la bibliothèque node-fetch si vous êtes sur des versions plus anciennes.
                const response = await fetch(apiUrl, { 
                    signal: controller.signal,
                    headers: { 
                        'User-Agent': 'Express-App/1.0', 
                        'Accept': 'application/json' 
                    }
                });
                
                const endTime = Date.now();
                const duration = endTime - startTime;
                console.log("[getTodayMatches] Réponse reçue en", duration, "ms");
                console.log("[getTodayMatches] Statut de la réponse:", response.status);
                console.log("[getTodayMatches] Réponse ok:", response.ok);
                console.log("[getTodayMatches] En-têtes de la réponse:", Object.fromEntries(response.headers.entries()));

                clearTimeout(timeoutId);

                if (!response.ok) {
                    console.error("[getTodayMatches] ❌ Erreur HTTP ! statut:", response.status);
                    throw new Error(`Erreur HTTP ! statut : ${response.status}`);
                }

                console.log("[getTodayMatches] Analyse du JSON...");
                const payload = await response.json();
                console.log("[getTodayMatches] JSON analysé avec succès");
                console.log("[getTodayMatches] Clés du payload:", Object.keys(payload || {}));
                console.log("[getTodayMatches] Payload.data existe:", !!payload?.data);
                console.log("[getTodayMatches] Longueur de Payload.data:", payload?.data?.length || 0);
                
                // Débogage : Afficher l'échantillon brut du payload pour voir la structure
                console.log("[getTodayMatches] Échantillon du premier élément:", JSON.stringify(payload?.data?.[0], null, 2));

                const rawMatches = payload?.data || [];
                const todayStr = new Date().toISOString().split('T')[0];
                console.log("[getTodayMatches] Chaîne de date d'aujourd'hui:", todayStr);

                matchesData = rawMatches.filter(match => {
                    if (!match.date) {
                        console.log("[getTodayMatches] Ignorer le match sans date:", match);
                        return false;
                    }
                    const matchDate = match.date.substring(0, 10);
                    const isToday = matchDate === todayStr;
                    if (!isToday) {
                        console.log("[getTodayMatches] Ignorer le match non actuel:", matchDate, "!==", todayStr);
                    }
                    return isToday;
                });

                console.log("[getTodayMatches] Nombre de matchs filtrés:", matchesData.length);

            } catch (fetchError) {
                clearTimeout(timeoutId);
                console.error("[getTodayMatches] ❌ Détails de l'erreur de récupération :");
                console.error("[getTodayMatches] Nom de l'erreur:", fetchError.name);
                console.error("[getTodayMatches] Message d'erreur:", fetchError.message);
                console.error("[getTodayMatches] Pile d'erreurs:", fetchError.stack);
                throw fetchError; // Relancer pour être capturé par le try-catch externe
            }
        }

        console.log("[getTodayMatches] Enrichissement des matchs avec les informations de statut...");
        // Enrichir les matchs avec les informations de statut
        const enrichedMatches = matchesData.map(match => ({
            ...match,
            statusInfo: getMatchStatusInfo(match.date)
        }));

        console.log("[getTodayMatches] Nombre de matchs enrichis:", enrichedMatches.length);

        if (enrichedMatches.length > 0 || useDummyData) {
            console.log("[getTodayMatches] 💾 Mise en cache des matchs");
            cachedMatches = enrichedMatches;
            cacheExpirationTime = getNextExpirationTime();
            console.log("[getTodayMatches] Expiration du cache définie à:", new Date(cacheExpirationTime).toISOString());
        }

        console.log("[getTodayMatches] ✅ Retour de", enrichedMatches.length, "matchs");
        console.log("=".repeat(80));
        return enrichedMatches;

    } catch (error) {
        console.error("=".repeat(80));
        console.error("[getTodayMatches] ❌ ERREUR CAPTURÉE :");
        console.error("[getTodayMatches] Nom de l'erreur:", error.name);
        console.error("[getTodayMatches] Message d'erreur:", error.message);
        console.error("[getTodayMatches] Pile d'erreurs:", error.stack);
        console.error("=".repeat(80));
        
        if (cachedMatches) {
            console.log("[getTodayMatches] ⚠️ Retour aux matchs en cache");
            return cachedMatches.map(m => ({ ...m, statusInfo: getMatchStatusInfo(m.date) }));
        }
        if (!useDummyData) {
            console.log("[getTodayMatches] ⚠️ Pas de cache, retour d'un tableau vide");
            return [];
        }
    }

    console.log("[getTodayMatches] Retour final avec", matchesData.length, "matchs");
    return matchesData.map(m => ({ ...m, statusInfo: getMatchStatusInfo(m.date) }));
};