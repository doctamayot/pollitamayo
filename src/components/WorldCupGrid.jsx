import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { db } from '../firebase';
import { collection, onSnapshot, doc, setDoc, getDoc } from 'firebase/firestore';
import { getWorldCupMatches } from '../services/apiFootball';
import logocopa from '../assets/logocopa.png';
import toast from 'react-hot-toast';

// --- TRADUCCIONES Y CONSTANTES ---
const EXCLUDED_EMAILS = ['doctamayot@gmail.com', 'admin@polli-tamayo.com'];

const teamTranslations = {
    "Albania": "Albania", "Algeria": "Argelia", "Argentina": "Argentina", "Australia": "Australia", 
    "Austria": "Austria", "Belgium": "Bélgica", "Bolivia": "Bolivia", "Brazil": "Brasil", 
    "Cameroon": "Camerún", "Canada": "Canadá", "Chile": "Chile", "Colombia": "Colombia",  "Cape Verde Islands": "Cabo Verde",
    "Costa Rica": "Costa Rica", "Croatia": "Croacia", "Denmark": "Dinamarca", "Ecuador": "Ecuador", 
    "England": "Inglaterra", "France": "Francia", "Germany": "Alemania", "Japan": "Japón", 
    "Mexico": "México", "Morocco": "Marruecos", "Netherlands": "Países Bajos", "Peru": "Perú", 
    "Portugal": "Portugal", "Senegal": "Senegal", "South Korea": "Corea del Sur", "Spain": "España", 
    "United States": "Estados Unidos", "Uruguay": "Uruguay", "Venezuela": "Venezuela", "Por definir": "Por definir", "TBD": "Por definir"
};

const matchStatusTranslations = {
    SCHEDULED: 'Programado', TIMED: 'Confirmado', IN_PLAY: 'En Juego', PAUSED: 'En Pausa',
    FINISHED: 'Finalizado', SUSPENDED: 'Suspendido', POSTPONED: 'Pospuesto', CANCELLED: 'Cancelado'
};

const stageTranslations = {
    'GROUP_STAGE': 'Fase de Grupos',
    'LAST_32': '16vos de Final',
    'ROUND_OF_32': '16vos de Final',
    'LAST_16': 'Octavos de Final',
    'QUARTER_FINALS': 'Cuartos de Final',
    'SEMI_FINALS': 'Semifinales',
    'FINAL': 'Gran Final',
    'THIRD_PLACE': 'Tercer Puesto'
};

const extraQuestions = [
    { id: 'goleador', manual: true }, { id: 'equipo_goleador' }, { id: 'equipo_menos_goleador' },
    { id: 'mas_amarillas' }, { id: 'mas_rojas' }, { id: 'valla_menos_vencida' },
    { id: 'valla_mas_vencida' }, { id: 'grupo_mas_goles' }, { id: 'grupo_menos_goles' },
    { id: 'maximo_asistidor', manual: true }, { id: 'atajapenales', manual: true }
];

const specialEvents = [
    { id: 'gol_olimpico' }, { id: 'remontada_epica' }, { id: 'el_festival' }, { id: 'muralla_final' },
    { id: 'hat_trick_hero' }, { id: 'roja_banquillo' }, { id: 'portero_goleador' }, { id: 'debut_sin_red' },
    { id: 'leyenda_viva' }, { id: 'drama_final' }, { id: 'penales_final' }
];

const formatShortName = (fullName) => {
    if (!fullName) return 'Anon';
    const parts = fullName.trim().split(' ');
    if (parts.length === 1) return parts[0];
    return `${parts[0]} ${parts[1].charAt(0)}.`;
};

const formatDateObj = (dateStr) => {
    const d = new Date(dateStr + "T12:00:00"); 
    const dayName = d.toLocaleDateString('es-ES', { weekday: 'short' }).toUpperCase().replace('.', '');
    const dayNum = d.getDate();
    const monthName = d.toLocaleDateString('es-ES', { month: 'short' }).toUpperCase().replace('.', '');
    return { dayName, dayNum, monthName };
};

const translateTeam = (name) => teamTranslations[name] || name;

const isSmartMatch = (userText, adminText) => {
    if (!userText || !adminText) return false;
    const clean = (str) => str.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]/g, "").trim();
    const u = clean(userText); const a = clean(adminText);
    return u === a || (u.length > 3 && (a.includes(u) || u.includes(a)));
};

const WorldCupGrid = ({ currentUser }) => {
    const isAdmin = currentUser?.email === 'doctamayot@gmail.com' || currentUser?.email === 'admin@polli-tamayo.com';

    const [matches, setMatches] = useState([]);
    const [allPredictions, setAllPredictions] = useState({});
    const [usersInfo, setUsersInfo] = useState({});
    const [adminResults, setAdminResults] = useState(null);
    const [selectedDate, setSelectedDate] = useState(null);
    const [isApiLoading, setIsApiLoading] = useState(true);
    const [isDbLoading, setIsDbLoading] = useState(true);
    const [isLivePollingActive, setIsLivePollingActive] = useState(false);
    const [isAutoSyncActive, setIsAutoSyncActive] = useState(false);

    const scrollContainerRef = useRef(null);
    const lastSyncTime = useRef(0);
    const prevSimDateRef = useRef(''); 
    const apiFetchedRef = useRef(false); // <--- 1. AGREGA ESTA LÍNEA
    const autoSyncTimeRef = useRef(0);

    const fetchApiMatches = useCallback(async (isBackgroundUpdate = false) => {
        try {
            if (!isBackgroundUpdate) setIsApiLoading(true);
            const data = await getWorldCupMatches();
            if (data && data.matches) {
                setMatches(data.matches);
                console.log("llamando api")
                if (isAdmin) {
                    const adminRef = doc(db, 'worldCupAdmin', 'results');
                    const adminDoc = await getDoc(adminRef);
                    let currentAdminPreds = adminDoc.exists() ? adminDoc.data().predictions || {} : {};
                    let currentLocks = adminDoc.exists() ? adminDoc.data().lockedMatches || {} : {};
                    let hasChanges = false;

                    data.matches.forEach(apiMatch => {
                        if (currentLocks[apiMatch.id]) return;

                        const isFinished = apiMatch.status === 'FINISHED';
                        const isLive = apiMatch.status === 'IN_PLAY' || apiMatch.status === 'PAUSED';
                        
                        if (isFinished || isLive) {
                            const currentH = currentAdminPreds[apiMatch.id]?.home;
                            const currentA = currentAdminPreds[apiMatch.id]?.away;
                            const newH = apiMatch.score?.fullTime?.home;
                            const newA = apiMatch.score?.fullTime?.away;

                            if (currentH !== newH || currentA !== newA) {
                                currentAdminPreds[apiMatch.id] = {
                                    ...currentAdminPreds[apiMatch.id],
                                    home: newH !== null ? newH : '',
                                    away: newA !== null ? newA : ''
                                };
                                hasChanges = true;
                            }
                        }
                    });

                    if (hasChanges) {
                        await setDoc(adminRef, { predictions: currentAdminPreds }, { merge: true });
                    }
                }
            }
        } catch (err) { 
            console.error(err); 
        } finally { 
            if (!isBackgroundUpdate) setIsApiLoading(false); 
        }
    }, [isAdmin]);

    useEffect(() => {
        if (!apiFetchedRef.current) {
            fetchApiMatches();
            apiFetchedRef.current = true;
        }

        const unsubPreds = onSnapshot(collection(db, 'worldCupPredictions'), (snap) => {
            const preds = {}; snap.forEach(doc => { preds[doc.id] = doc.data(); });
            setAllPredictions(preds);
        });

        const unsubUsers = onSnapshot(collection(db, 'users'), (snap) => {
            const users = {}; snap.forEach(doc => { users[doc.id] = doc.data(); });
            setUsersInfo(users);
        });

        const unsubAdmin = onSnapshot(doc(db, 'worldCupAdmin', 'results'), (docSnap) => {
            if (docSnap.exists()) setAdminResults(docSnap.data());
            setIsDbLoading(false);
        });

        return () => { unsubPreds(); unsubUsers(); unsubAdmin(); };
    }, [fetchApiMatches]);

    useEffect(() => {
        if (!isAdmin) return;

        const hasLiveMatches = matches.some(m => m.status === 'IN_PLAY' || m.status === 'PAUSED');
        setIsLivePollingActive(hasLiveMatches);

        let pollInterval;

        if (hasLiveMatches || isAutoSyncActive) {
            pollInterval = setInterval(() => {
                const now = Date.now();
                if (now - lastSyncTime.current >= 14000) {
                    lastSyncTime.current = now;
                    fetchApiMatches(true); 
                }
            }, 10000); 
        } else {
            pollInterval = setInterval(() => {
                const now = Date.now();
                if (now - lastSyncTime.current >= 170000) {
                    lastSyncTime.current = now;
                    fetchApiMatches(true);
                }
            }, 180000); 
        }

        return () => clearInterval(pollInterval);
    }, [matches, isAdmin, fetchApiMatches, isAutoSyncActive]);

    // 🟢 ROBOT AUTO-SYNC: Sincroniza la API con la Base de Datos automáticamente
    useEffect(() => {
        if (!isAdmin || !isAutoSyncActive) return;

        const performAutoSync = async () => {
            const now = Date.now();
            if (now - autoSyncTimeRef.current < 14000) return;
            autoSyncTimeRef.current = now;

            try {
                const data = await getWorldCupMatches();
                if (!data || !data.matches) return;

                const adminDoc = await getDoc(doc(db, 'worldCupAdmin', 'results'));
                let dbPreds = adminDoc.exists() ? (adminDoc.data().predictions || {}) : {};
                let currentLocks = adminDoc.exists() ? (adminDoc.data().lockedMatches || {}) : {};
                let hasChanges = false;

                data.matches.forEach(m => {
                    if (currentLocks[m.id]) return; 

                    const apiH = (m.score?.fullTime?.home !== null && m.score?.fullTime?.home !== undefined) ? m.score.fullTime.home : '';
                    const apiA = (m.score?.fullTime?.away !== null && m.score?.fullTime?.away !== undefined) ? m.score.fullTime.away : '';

                    if (dbPreds[m.id]?.home !== apiH || dbPreds[m.id]?.away !== apiA) {
                        dbPreds[m.id] = { ...dbPreds[m.id], home: apiH, away: apiA };
                        hasChanges = true;
                    }
                });

                if (hasChanges) {
                    await setDoc(doc(db, 'worldCupAdmin', 'results'), { predictions: dbPreds }, { merge: true });
                    toast.success('⚽ ¡Auto-Sync: Marcadores sincronizados en la Grilla!', { id: 'autosync-grid-toast' });
                }
            } catch (error) {
                console.error("❌ Error en Auto-Sync:", error);
            }
        };

        performAutoSync();
        const intervalId = setInterval(performAutoSync, 15000);
        return () => clearInterval(intervalId);
    }, [isAdmin, isAutoSyncActive]);

    const simulatedDate = adminResults?.simulation?.simulatedDate || '';

    const effectiveMatches = useMemo(() => {
        return matches.map(m => {
            const simStatus = adminResults?.simulation?.matchStatuses?.[m.id];
            if (simStatus && simStatus !== '') {
                return { ...m, status: simStatus };
            }
            return m;
        });
    }, [matches, adminResults]);

    const mergedAdminPreds = useMemo(() => {
        const preds = { ...(adminResults?.predictions || {}) };
        effectiveMatches.forEach(m => {
            const status = m.status || '';
            const hasO = (preds[m.id] && preds[m.id].home !== '' && preds[m.id].away !== '') || status === 'FINISHED' || status.includes('PLAY');
            
            if (hasO) {
                if (preds[m.id]?.home === undefined || preds[m.id]?.home === '') {
                    if (m.score?.fullTime?.home !== null && m.score?.fullTime?.home !== undefined) {
                        preds[m.id] = {
                            ...preds[m.id],
                            home: m.score.fullTime.home,
                            away: m.score.fullTime.away
                        };
                    }
                }
            }
        });
        return preds;
    }, [adminResults, effectiveMatches]);

    const handleSimulateDate = async (newDate) => {
        const adminRef = doc(db, 'worldCupAdmin', 'results');
        await setDoc(adminRef, { simulation: { simulatedDate: newDate } }, { merge: true });
    };

    const handleSimulateStatus = async (matchId, newStatus) => {
        const adminRef = doc(db, 'worldCupAdmin', 'results');
        const currentSim = adminResults?.simulation || {};
        const currentStatuses = currentSim.matchStatuses || {};
        const newStatuses = { ...currentStatuses, [matchId]: newStatus };

        await setDoc(adminRef, { 
            simulation: { ...currentSim, matchStatuses: newStatuses } 
        }, { merge: true });
    };

    const allTeams = useMemo(() => {
        const teamsMap = new Map();
        effectiveMatches.forEach(m => {
            const hName = m.homeTeam?.name || '';
            const aName = m.awayTeam?.name || '';
            if (hName && !hName.includes('Winner') && !hName.includes('Loser') && hName !== 'TBD') {
                teamsMap.set(hName, m.homeTeam);
            }
            if (aName && !aName.includes('Winner') && !aName.includes('Loser') && aName !== 'TBD') {
                teamsMap.set(aName, m.awayTeam);
            }
        });
        return Array.from(teamsMap.values());
    }, [effectiveMatches]);

    const getStandings = useCallback((groupMatches, preds, groupName, tiebreakers) => {
        const teams = {};
        groupMatches.forEach(m => {
            const h = m.homeTeam?.name || 'Por definir';
            const a = m.awayTeam?.name || 'Por definir';
            if (!teams[h]) teams[h] = { name: h, crest: m.homeTeam?.crest, pj: 0, pg: 0, pe: 0, pp: 0, gf: 0, gc: 0, dg: 0, pts: 0 };
            if (!teams[a]) teams[a] = { name: a, crest: m.awayTeam?.crest, pj: 0, pg: 0, pe: 0, pp: 0, gf: 0, gc: 0, dg: 0, pts: 0 };
        });

        groupMatches.forEach(m => {
            const pr = preds?.[m.id];
            if (pr && pr.home !== '' && pr.home !== undefined && pr.away !== '' && pr.away !== undefined) {
                const gh = parseInt(pr.home, 10); const ga = parseInt(pr.away, 10);
                const h = m.homeTeam.name; const a = m.awayTeam.name;
                teams[h].pj++; teams[a].pj++;
                teams[h].gf += gh; teams[a].gf += ga;
                teams[h].gc += ga; teams[a].gc += gh;
                teams[h].dg = teams[h].gf - teams[h].gc;
                teams[a].dg = teams[a].gf - teams[a].gc;
                if (gh > ga) { teams[h].pts += 3; teams[h].pg++; teams[a].pp++; } 
                else if (gh < ga) { teams[a].pts += 3; teams[a].pg++; teams[h].pp++; } 
                else { teams[h].pts += 1; teams[a].pts += 1; teams[h].pe++; teams[a].pe++; }
            }
        });

        const resolveTie = (tiedTeams) => {
            if (tiedTeams.length <= 1) return tiedTeams;

            const h2hStats = {};
            tiedTeams.forEach(t => h2hStats[t.name] = { pts: 0, dg: 0, gf: 0 });
            const tiedNames = tiedTeams.map(t => t.name);

            groupMatches.forEach(m => {
                if (tiedNames.includes(m.homeTeam?.name) && tiedNames.includes(m.awayTeam?.name)) {
                    const pr = preds?.[m.id];
                    if (pr && pr.home !== '' && pr.away !== '') {
                        const hG = parseInt(pr.home, 10); const aG = parseInt(pr.away, 10);
                        const h = m.homeTeam.name; const a = m.awayTeam.name;
                        h2hStats[h].gf += hG; h2hStats[a].gf += aG;
                        h2hStats[h].dg += (hG - aG); h2hStats[a].dg += (aG - hG);
                        if (hG > aG) h2hStats[h].pts += 3;
                        else if (hG < aG) h2hStats[a].pts += 3;
                        else { h2hStats[h].pts += 1; h2hStats[a].pts += 1; }
                    }
                }
            });

            const h2hGroups = {};
            tiedTeams.forEach(t => {
                const stats = h2hStats[t.name];
                const key = `${stats.pts}_${stats.dg}_${stats.gf}`;
                if (!h2hGroups[key]) h2hGroups[key] = [];
                h2hGroups[key].push(t);
            });

            const sortedH2HKeys = Object.keys(h2hGroups).sort((a, b) => {
                const [ptsA, dgA, gfA] = a.split('_').map(Number);
                const [ptsB, dgB, gfB] = b.split('_').map(Number);
                if (ptsB !== ptsA) return ptsB - ptsA;
                if (dgB !== dgA) return dgB - dgA;
                return gfB - gfA;
            });

            let finalSorted = [];
            sortedH2HKeys.forEach(key => {
                const subGroup = h2hGroups[key];
                if (subGroup.length > 1 && subGroup.length < tiedTeams.length) {
                    finalSorted.push(...resolveTie(subGroup));
                } else if (subGroup.length > 1) {
                    const groupedByOverall = {};
                    subGroup.forEach(t => {
                        const oKey = `${t.dg}_${t.gf}`;
                        if (!groupedByOverall[oKey]) groupedByOverall[oKey] = [];
                        groupedByOverall[oKey].push(t);
                    });
                    const sortedOverallKeys = Object.keys(groupedByOverall).sort((a, b) => {
                        const [dgA, gfA] = a.split('_').map(Number);
                        const [dgB, gfB] = b.split('_').map(Number);
                        if (dgB !== dgA) return dgB - dgA;
                        return gfB - gfA;
                    });
                    sortedOverallKeys.forEach(oKey => {
                        const finalTied = groupedByOverall[oKey];
                        if (finalTied.length > 1) {
                            finalTied.sort((a, b) => {
                                const tieA = tiebreakers?.[groupName]?.[a.name] || 99;
                                const tieB = tiebreakers?.[groupName]?.[b.name] || 99;
                                if (tieA !== tieB) return tieA - tieB; 
                                return translateTeam(a.name).localeCompare(translateTeam(b.name));
                            });
                        }
                        finalSorted.push(...finalTied);
                    });
                } else {
                    finalSorted.push(subGroup[0]);
                }
            });
            return finalSorted;
        };

        const groupedByPts = {};
        Object.values(teams).forEach(t => {
            if (!groupedByPts[t.pts]) groupedByPts[t.pts] = [];
            groupedByPts[t.pts].push(t);
        });

        const sortedPtsKeys = Object.keys(groupedByPts).map(Number).sort((a, b) => b - a);
        let finalFlattenedStandings = [];
        sortedPtsKeys.forEach(pts => {
            finalFlattenedStandings.push(...resolveTie(groupedByPts[pts]));
        });
        return finalFlattenedStandings;
    }, []);

    const groupMatchesMap = useMemo(() => {
        return effectiveMatches.filter(m => m.stage === 'GROUP_STAGE').reduce((acc, m) => {
            let g = m.group?.replace('GROUP_', 'Grupo ') || 'Fase de Grupos';
            if (!acc[g]) acc[g] = []; acc[g].push(m); return acc;
        }, {});
    }, [effectiveMatches]);

    // 🟢 MOTOR PROGRESIVO DEFINITIVO: Calcula el acumulado exacto hasta una fecha/partido
    const calculateProgressiveRanking = useCallback((targetMatchDateStr) => {
        const ranks = [];
        const targetDate = new Date(targetMatchDateStr);
        const pastMatches = effectiveMatches.filter(m => new Date(m.utcDate) <= targetDate);

        Object.keys(allPredictions).forEach(uid => {
            const userData = allPredictions[uid];
            if (!userData.hasPaid || EXCLUDED_EMAILS.includes(userData.email)) return;

            let total = 0;

            // 1. Puntos por Marcadores Progresivos
            pastMatches.forEach(m => {
                const p = userData.predictions?.[m.id]; 
                const rH = mergedAdminPreds[m.id]?.home;
                const rA = mergedAdminPreds[m.id]?.away;
                const matchStatus = m.status || '';
                const canSumMatch = (rH !== undefined && rH !== '' && rA !== undefined && rA !== '') || matchStatus === 'FINISHED' || matchStatus === 'IN_PLAY' || matchStatus === 'PAUSED';
                
                if (canSumMatch && p && p.home !== '' && p.away !== '') {
                    const realH = parseInt(rH, 10);
                    const realA = parseInt(rA, 10);
                    
                    // CANDADO: Solo suma si hay números reales
                    if (!isNaN(realH) && !isNaN(realA)) {
                        const pH = parseInt(p.home, 10); const pA = parseInt(p.away, 10);
                        if (pH === realH && pA === realA) total += 5;
                        else {
                            const pR = Math.sign(pH - pA); const rR = Math.sign(realH - realA);
                            if (pR === rR && (pH === realH || pA === realA)) total += 3;
                            else if (pR === rR) total += 2;
                            else if (pH === realH || pA === realA) total += 1;
                        }
                    }
                }
            });

            // 2. Plenos de Grupo (Solo si el grupo terminó antes o en la fecha del targetDate)
            Object.keys(groupMatchesMap).forEach(g => {
                const groupMatches = groupMatchesMap[g];
                const lastMatchOfGroup = [...groupMatches].sort((a,b) => new Date(b.utcDate) - new Date(a.utcDate))[0];
                if (lastMatchOfGroup && new Date(lastMatchOfGroup.utcDate) <= targetDate) {
                    const isGroupFinished = groupMatches.every(m => (mergedAdminPreds[m.id]?.home !== undefined && mergedAdminPreds[m.id]?.home !== '') || m.status === 'FINISHED');
                    const predictedCount = groupMatches.filter(m => userData.predictions?.[m.id]?.home !== undefined && userData.predictions?.[m.id]?.home !== '').length;
                    if (isGroupFinished && predictedCount === groupMatches.length) {
                        const uT = getStandings(groupMatches, userData.predictions, g, userData.manualTiebreakers);
                        const aT = getStandings(groupMatches, mergedAdminPreds, g, adminResults?.manualTiebreakers);
                        if (uT.length >= 4 && aT.length >= 4 && uT[0].name === aT[0].name && uT[1].name === aT[1].name && uT[2].name === aT[2].name && uT[3].name === aT[3].name) total += 8;
                    }
                }
            });

            // 3. Clasificados a Rondas
            const koRounds = [
                { id: 'dieciseisavos', pts: 3, stage: 'LAST_32' }, { id: 'octavos', pts: 4, stage: 'LAST_16' },
                { id: 'cuartos', pts: 5, stage: 'QUARTER_FINALS' }, { id: 'semis', pts: 6, stage: 'SEMI_FINALS' }
            ];
            koRounds.forEach(r => {
                const lastMatchOfStage = effectiveMatches.filter(m => m.stage === r.stage).sort((a,b) => new Date(b.utcDate) - new Date(a.utcDate))[0];
                if (lastMatchOfStage && new Date(lastMatchOfStage.utcDate) <= targetDate) {
                    const uTeams = userData.knockoutPicks?.[r.id] || [];
                    const aTeams = adminResults?.knockoutPicks?.[r.id] || [];
                    uTeams.forEach(ut => { if (aTeams.some(at => at.name === ut.name)) total += r.pts; });
                }
            });

            // 4. Podio y Super Bono
            const finalMatch = effectiveMatches.find(m => m.stage === 'FINAL');
            if (finalMatch && new Date(finalMatch.utcDate) <= targetDate) {
                const honorSlots = [{ id: 'campeon', pts: 10 }, { id: 'subcampeon', pts: 6 }, { id: 'tercero', pts: 6 }, { id: 'cuarto', pts: 6 }];
                honorSlots.forEach(s => {
                    if (userData.knockoutPicks?.[s.id]?.[0]?.name === adminResults?.knockoutPicks?.[s.id]?.[0]?.name && adminResults?.knockoutPicks?.[s.id]?.[0]?.name) { total += s.pts; }
                });
                let isSuperBono = false;
                if (adminResults?.knockoutPicks) {
                    isSuperBono = honorSlots.every(s => userData.knockoutPicks?.[s.id]?.[0]?.name === adminResults.knockoutPicks[s.id]?.[0]?.name && adminResults.knockoutPicks[s.id]?.[0]?.name);
                }
                if (isSuperBono) total += 10;
            }

            // 5. Extras y Eventos
            extraQuestions.forEach(q => {
                const answer = userData.extraPicks?.[q.id];
                const officialAnswer = adminResults?.extraPicks?.[q.id];
                if (officialAnswer && answer) {
                    if (q.manual) {
                        if (isSmartMatch(answer, officialAnswer)) total += 6;
                    } else {
                        if (officialAnswer.toLowerCase() === answer.toLowerCase()) total += 6;
                    }
                }
            });

            specialEvents.forEach(e => {
                let answer = userData.eventPicks?.[e.id];
                let officialAnswer = adminResults?.eventPicks?.[e.id];
                if (answer && officialAnswer) {
                    answer = String(answer).toUpperCase().trim();
                    officialAnswer = String(officialAnswer).toUpperCase().trim();
                    if (officialAnswer === answer) {
                        total += answer === 'SI' ? 5 : 2;
                    }
                }
            });

            ranks.push({
                uid,
                name: usersInfo[uid]?.displayName || userData.displayName || 'Invitado',
                photoURL: usersInfo[uid]?.photoURL || userData.photoURL || logocopa,
                totalPoints: total
            });
        });

        ranks.sort((a, b) => b.totalPoints - a.totalPoints);
        let currentRank = 1;
        ranks.forEach((r, i) => {
            if (i > 0 && r.totalPoints < ranks[i - 1].totalPoints) currentRank = i + 1;
            r.position = currentRank;
        });

        return ranks;
    }, [allPredictions, effectiveMatches, mergedAdminPreds, groupMatchesMap, getStandings, adminResults, usersInfo]);

    const matchesByDate = useMemo(() => {
        const grouped = {};
        effectiveMatches.forEach(m => {
            const d = new Date(m.utcDate);
            const dateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
            if (!grouped[dateStr]) grouped[dateStr] = [];
            grouped[dateStr].push(m);
        });
        return grouped;
    }, [effectiveMatches]);

    const sortedDates = useMemo(() => {
        const rawDates = Object.keys(matchesByDate).sort(); 
        const activePhase = adminResults?.activePhase || 'GROUP_STAGE';

        if (activePhase === 'GROUP_STAGE' || activePhase === 'ALL_OPEN') {
            return rawDates; 
        }

        const knockoutDates = [];
        const groupDates = [];

        rawDates.forEach(d => {
            const hasKnockoutMatch = matchesByDate[d].some(m => m.stage !== 'GROUP_STAGE');
            if (hasKnockoutMatch) {
                knockoutDates.push(d);
            } else {
                groupDates.push(d);
            }
        });

        knockoutDates.sort((a, b) => new Date(a) - new Date(b));
        groupDates.sort((a, b) => new Date(a) - new Date(b));

        return [...knockoutDates, ...groupDates];
    }, [matchesByDate, adminResults]);

    useEffect(() => {
        if (sortedDates.length === 0) return;

        if (simulatedDate !== prevSimDateRef.current) {
            prevSimDateRef.current = simulatedDate;
            
            if (simulatedDate && sortedDates.includes(simulatedDate)) {
                setSelectedDate(simulatedDate);
            } 
            else if (!simulatedDate) {
                const d = new Date();
                const todayStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
                
                if (sortedDates.includes(todayStr)) {
                    setSelectedDate(todayStr);
                } else {
                    const nextActiveDate = sortedDates.find(date => matchesByDate[date]?.some(m => m.status !== 'FINISHED'));
                    setSelectedDate(nextActiveDate || sortedDates[0]);
                }
            }
            return;
        }

        if (!selectedDate) {
            let targetDate = simulatedDate || (() => {
                const d = new Date();
                return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
            })();
            
            if (sortedDates.includes(targetDate)) {
                setSelectedDate(targetDate);
            } else {
                const nextActiveDate = sortedDates.find(date => matchesByDate[date]?.some(m => m.status !== 'FINISHED'));
                setSelectedDate(nextActiveDate || sortedDates[0]);
            }
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [sortedDates, simulatedDate, selectedDate, matchesByDate]); 

    useEffect(() => {
        if (selectedDate && scrollContainerRef.current) {
            const activeTab = document.getElementById(`date-tab-${selectedDate}`);
            if (activeTab) {
                const container = scrollContainerRef.current;
                const scrollLeft = activeTab.offsetLeft - (container.offsetWidth / 2) + (activeTab.offsetWidth / 2);
                container.scrollTo({ left: scrollLeft, behavior: 'smooth' });
            }
        }
    }, [selectedDate]);

    const sortedMatchesOfDay = useMemo(() => {
        if (!selectedDate || !matchesByDate[selectedDate]) return [];
        return [...matchesByDate[selectedDate]].sort((a, b) => {
            const getStatusPriority = (m) => {
                if (m.status === 'IN_PLAY' || m.status === 'PAUSED') return 0; 
                if (m.status === 'FINISHED') return 1; 
                if (m.status === 'TIMED' || m.status === 'SCHEDULED') return 2;
                return 3; 
            };
            
            const priorityA = getStatusPriority(a);
            const priorityB = getStatusPriority(b);
            
            // 1. Primero por estado (En juego > Finalizados > Programados)
            if (priorityA !== priorityB) return priorityA - priorityB;
            
            // 2. Si ambos están FINALIZADOS, el más reciente (el último que se jugó) va arriba
            if (priorityA === 1) {
                return new Date(b.utcDate) - new Date(a.utcDate);
            }
            
            // 3. Si ambos están PROGRAMADOS/EN JUGAR, orden cronológico normal (mañana a noche)
            return new Date(a.utcDate) - new Date(b.utcDate);
        });
    }, [selectedDate, matchesByDate]);

    const handleScroll = (direction) => {
        if (scrollContainerRef.current) {
            const scrollAmount = 250; 
            scrollContainerRef.current.scrollBy({
                left: direction === 'left' ? -scrollAmount : scrollAmount,
                behavior: 'smooth'
            });
        }
    };

    if (isApiLoading || isDbLoading) return (
        <div className="flex flex-col items-center justify-center py-32 animate-fade-in">
            <img src={logocopa} className="w-20 h-20 mb-6 animate-pulse opacity-50" alt="Cargando" />
            <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin mb-4"></div>
            <p className="text-foreground-muted font-bold tracking-widest uppercase text-xs text-center">Sincronizando Puntos Globales...</p>
        </div>
    );

    return (
        <div className="max-w-5xl mx-auto pb-24 animate-fade-in px-2 sm:px-0">
            
            <div className="bg-gradient-to-br from-slate-900 to-slate-800 rounded-2xl sm:rounded-[2rem] p-3 sm:p-10 mb-6 sm:mb-8 text-center border border-border shadow-xl relative overflow-hidden flex flex-row items-center justify-center gap-3 sm:gap-6">
                <div className="absolute top-0 left-0 w-full h-full bg-primary/5 z-0 pointer-events-none"></div>
                <img src={logocopa} className="w-12 h-12 sm:w-20 sm:h-20 object-contain drop-shadow-[0_0_15px_rgba(245,158,11,0.4)] z-10" alt="" />
                
                <div className="relative z-10 flex flex-col items-start sm:items-center text-left sm:text-center">
                    <h2 className="text-xl sm:text-4xl font-black text-white mb-0.5 sm:mb-2 tracking-tighter drop-shadow-md">📡 GRILLA LIVE</h2>
                    <div className="flex gap-2">
                        <p className="text-primary font-black uppercase text-[8px] sm:text-xs tracking-widest bg-primary/10 px-2.5 sm:px-4 py-1 sm:py-1.5 rounded-full border border-primary/20 shadow-sm">
                            Puntos Progresivos
                        </p>
                        {isAdmin && isLivePollingActive && (
                            <p className="text-green-500 font-black uppercase text-[8px] sm:text-xs tracking-widest bg-green-500/10 px-2.5 sm:px-4 py-1 sm:py-1.5 rounded-full border border-green-500/20 shadow-sm animate-pulse">
                                🔄 Auto-Sync
                            </p>
                        )}
                    </div>
                </div>
            </div>
{isAdmin && (
                <div className="mb-6 flex justify-center animate-fade-in">
                    <button
                        onClick={() => setIsAutoSyncActive(!isAutoSyncActive)}
                        className={`flex items-center gap-3 px-6 py-3 rounded-full font-black text-sm uppercase tracking-widest shadow-lg transition-all transform hover:scale-105 ${
                            isAutoSyncActive 
                            ? 'bg-green-500 text-white shadow-green-500/30 border-2 border-green-400' 
                            : 'bg-card text-foreground-muted border-2 border-border hover:bg-background-offset'
                        }`}
                    >
                        {isAutoSyncActive ? (
                            <><span className="animate-spin text-xl">🔄</span> Auto-Sync Activado (15s)</>
                        ) : (
                            <><span className="text-xl">📡</span> Activar Auto-Sync API</>
                        )}
                    </button>
                </div>
            )}
            {isAdmin && (
                
                <div className="mb-8 bg-purple-900/20 border border-purple-500/30 p-4 sm:p-5 rounded-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-[0_0_15px_rgba(168,85,247,0.05)] animate-fade-in">
                    <div className="flex items-center gap-3">
                        <span className="text-2xl sm:text-3xl animate-pulse">⏱️</span>
                        <div>
                            <h4 className="font-black text-purple-400 uppercase tracking-widest text-[10px] sm:text-xs mb-0.5">Control Maestro: Simulación Global</h4>
                            <p className="text-[10px] sm:text-xs text-purple-300/70 leading-tight">Cambia la fecha y los estados. ¡Esto afectará a TODOS los usuarios conectados!</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2 w-full sm:w-auto">
                        {!simulatedDate && (
                            <span className="text-[9px] sm:text-[10px] font-black uppercase tracking-widest text-green-500 bg-green-500/10 px-3 py-2.5 rounded-xl border border-green-500/20 whitespace-nowrap">
                                🟢 API Real
                            </span>
                        )}
                        <input 
                            type="date" 
                            value={simulatedDate}
                            onChange={(e) => handleSimulateDate(e.target.value)}
                            className="flex-1 sm:flex-none bg-background-offset border border-purple-500/50 text-foreground font-bold p-2 sm:p-2.5 rounded-xl focus:ring-2 focus:ring-purple-500 outline-none text-xs sm:text-sm"
                        />
                        {simulatedDate && (
                            <button 
                                onClick={() => handleSimulateDate('')} 
                                className="bg-red-500/20 text-red-400 px-3 py-2 sm:py-2.5 rounded-xl font-black hover:bg-red-500/40 transition-colors text-xs flex items-center gap-1.5 uppercase tracking-widest" 
                                title="Volver a fecha real"
                            >
                                <span>✖️</span> <span className="hidden sm:inline">Apagar</span>
                            </button>
                        )}
                    </div>
                </div>
            )}

            <div className="relative w-full mb-8 flex items-center group">
                <div className="absolute left-0 top-0 bottom-0 w-8 bg-gradient-to-r from-background to-transparent z-10 pointer-events-none"></div>
                <div className="absolute right-0 top-0 bottom-0 w-8 bg-gradient-to-l from-background to-transparent z-10 pointer-events-none"></div>
                
                <button 
                    onClick={() => handleScroll('left')} 
                    className="absolute left-0 z-20 bg-card border border-border text-foreground p-1.5 rounded-full shadow-lg hidden md:flex hover:bg-primary hover:text-white transition-all hover:scale-110 ml-1"
                >
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-5 h-5">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
                    </svg>
                </button>

                <div ref={scrollContainerRef} className="flex overflow-x-auto gap-3 pb-4 pt-2 px-3 sm:px-12 hide-scrollbar snap-x items-center w-full scroll-smooth">
                    {sortedDates.map(d => {
                        const isSelected = selectedDate === d;
                        const { dayName, dayNum, monthName } = formatDateObj(d);
                        
                        const hasLive = matchesByDate[d].some(m => m.status === 'IN_PLAY' || m.status === 'PAUSED');
                        const allFinished = matchesByDate[d].every(m => m.status === 'FINISHED');
                        
                        const isKnockout = matchesByDate[d].some(m => m.stage !== 'GROUP_STAGE');

                        return (
                            <button 
                                key={d} 
                                id={`date-tab-${d}`} 
                                onClick={() => setSelectedDate(d)} 
                                className={`snap-center shrink-0 flex flex-col items-center justify-center w-16 h-20 sm:w-20 sm:h-[5.5rem] rounded-2xl transition-all duration-300 relative border ${
                                    isSelected 
                                    ? 'bg-gradient-to-b from-primary to-amber-600 text-white shadow-[0_8px_20px_-6px_rgba(245,158,11,0.6)] border-transparent scale-105 z-10' 
                                    : 'bg-card text-foreground-muted border-border hover:bg-background-offset hover:border-primary/50'
                                }`}
                            >
                                {hasLive && (
                                    <span className="absolute -top-1 -right-1 flex h-3 w-3">
                                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                                        <span className="relative inline-flex rounded-full h-3 w-3 bg-green-500 border border-background shadow-sm"></span>
                                    </span>
                                )}
                                
                                <span className={`text-[8px] sm:text-[9px] font-black tracking-widest uppercase mb-0.5 ${isSelected ? 'text-white/80' : 'opacity-50'}`}>
                                    {dayName}
                                </span>
                                <span className="text-xl sm:text-2xl font-black leading-none mb-0.5 tracking-tighter">
                                    {dayNum}
                                </span>
                                <span className={`text-[9px] sm:text-[10px] font-bold uppercase tracking-widest ${isSelected ? 'text-white' : 'text-primary'}`}>
                                    {monthName}
                                </span>
                                
                                <div className={`absolute bottom-0 left-1/2 -translate-x-1/2 h-1 rounded-t-full transition-all duration-300 ${
                                    isSelected ? 'w-8 bg-white/40' : (allFinished ? 'w-4 bg-border/50' : (isKnockout ? 'w-4 bg-indigo-500/30' : 'w-4 bg-primary/30'))
                                }`}></div>
                            </button>
                        );
                    })}
                </div>

                <button 
                    onClick={() => handleScroll('right')} 
                    className="absolute right-0 z-20 bg-card border border-border text-foreground p-1.5 rounded-full shadow-lg hidden md:flex hover:bg-primary hover:text-white transition-all hover:scale-110 mr-1"
                >
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-5 h-5">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
                    </svg>
                </button>
            </div>

            <div className="space-y-6 sm:space-y-10">
                {sortedMatchesOfDay.map(match => {
                    const a = mergedAdminPreds[match.id];
                    const rH = a?.home;
                    const rA = a?.away;
                    const matchStatus = match.status || '';
                    const hasO = (rH !== undefined && rH !== '' && rA !== undefined && rA !== '') || matchStatus === 'FINISHED' || matchStatus.includes('PLAY');
                    const isLive = matchStatus === 'IN_PLAY' || matchStatus === 'PAUSED';

                    // 🟢 RANKING ESPECÍFICO HASTA ESTE PARTIDO EXACTO
                    const matchSpecificRanking = calculateProgressiveRanking(match.utcDate).map(user => {
                        const uP = allPredictions[user.uid]?.predictions?.[match.id];
                        let pts = null;
                        
                        const realH = parseInt(rH, 10);
                        const realA = parseInt(rA, 10);
                        const hasValidRealScore = !isNaN(realH) && !isNaN(realA);

                        if (hasO && uP && uP.home !== '' && hasValidRealScore) {
                            const pH = parseInt(uP.home, 10); const pA = parseInt(uP.away, 10);
                            
                            if (pH === realH && pA === realA) pts = 5;
                            else {
                                const pR = Math.sign(pH - pA); const rR = Math.sign(realH - realA);
                                if (pR === rR && (pH === realH || pA === realA)) pts = 3;
                                else if (pR === rR) pts = 2;
                                else if (pH === realH || pA === realA) pts = 1;
                                else pts = 0;
                            }
                        }
                        return { ...user, uP, pts };
                    });

                    const homeOriginal = match.homeTeam?.name || '';
                    const awayOriginal = match.awayTeam?.name || '';
                    
                    const isUnknownHome = !homeOriginal || homeOriginal === 'TBD' || homeOriginal.includes('Winner') || homeOriginal.includes('Loser');
                    const isUnknownAway = !awayOriginal || awayOriginal === 'TBD' || awayOriginal.includes('Winner') || awayOriginal.includes('Loser');

                    const customHome = a?.customHomeTeam || '';
                    const customAway = a?.customAwayTeam || '';

                    const finalHomeName = customHome || (isUnknownHome ? 'Por Definir' : homeOriginal);
                    const finalAwayName = customAway || (isUnknownAway ? 'Por Definir' : awayOriginal);

                    const homeCrest = customHome ? allTeams.find(t => t.name === customHome)?.crest : match.homeTeam?.crest;
                    const awayCrest = customAway ? allTeams.find(t => t.name === customAway)?.crest : match.awayTeam?.crest;

                    const mainReferee = match.referees && match.referees.length > 0 
                        ? match.referees.find(r => r.type === 'REFEREE' || r.role === 'REFEREE') || match.referees[0] 
                        : null;

                    return (
                        <div key={match.id} className={`bg-card border ${isLive ? 'border-green-500 shadow-[0_0_20px_rgba(34,197,94,0.15)]' : 'border-border'} rounded-[1.5rem] sm:rounded-[2rem] overflow-hidden shadow-xl relative flex flex-col`}>
                            
                            {isAdmin && (
                                <div className="absolute top-3 right-3 z-50">
                                    <select 
                                        className="bg-purple-900 text-purple-100 text-[9px] font-bold p-1 rounded-lg outline-none border border-purple-500/50 shadow-md cursor-pointer hover:bg-purple-800 transition-colors"
                                        value={adminResults?.simulation?.matchStatuses?.[match.id] || ''}
                                        onChange={(e) => handleSimulateStatus(match.id, e.target.value)}
                                        title="Simular Estado del Partido"
                                    >
                                        <option value="">⚙️ API Real</option>
                                        <option value="SCHEDULED">⏱️ Programado</option>
                                        <option value="IN_PLAY">🟢 En Juego</option>
                                        <option value="PAUSED">⏸️ En Pausa</option>
                                        <option value="FINISHED">🏁 Finalizado</option>
                                    </select>
                                </div>
                            )}

                            <div className={`${isLive ? 'bg-green-500/5' : 'bg-background-offset'} p-4 sm:p-6 border-b border-border relative z-20`}>
                                <div className="flex justify-between items-center mb-3 sm:mb-5">
                                    <div className="flex items-center gap-2 sm:gap-4">
                                        <span className={`text-[9px] sm:text-[10px] font-black px-2.5 sm:px-4 py-0.5 sm:py-1 rounded-full uppercase ${isLive ? 'bg-green-500 text-white animate-pulse' : 'bg-primary/20 text-primary'}`}>
                                            {match.group ? match.group.replace('GROUP_', 'Grupo ') : stageTranslations[match.stage] || match.stage?.replace(/_/g, ' ') || 'Fase'}
                                        </span>
                                        <span className="hidden sm:flex items-center gap-1.5 text-[10px] text-foreground-muted font-bold tracking-widest bg-background px-2.5 py-0.5 rounded border border-border/50">
                                            <span>👨‍⚖️</span> {mainReferee ? mainReferee.name : 'Por Definir'}
                                        </span>
                                    </div>
                                    <span className="text-[10px] sm:text-xs font-bold text-foreground-muted uppercase tracking-widest bg-background/50 px-2 py-1 rounded border border-border/50">
                                        {new Date(match.utcDate).toLocaleTimeString('en-US', {hour: 'numeric', minute:'2-digit', hour12: true})}
                                    </span>
                                </div>
                                
                                <div className="flex items-center justify-between w-full gap-1 sm:gap-4 px-1 sm:px-4">
                                    <div className="flex-1 flex flex-col items-center justify-start min-w-0">
                                        {homeCrest ? <img src={homeCrest} className="w-10 h-10 sm:w-18 sm:h-18 relative overflow-hidden mb-2 sm:mb-3 drop-shadow-lg rounded-full border border-border/50 object-cover object-center" alt="" /> : <span className="text-2xl opacity-30 mb-2">🛡️</span>}
                                        <p className="font-black text-[10px] sm:text-xl text-center w-full leading-tight break-words" style={{ wordBreak: 'break-word' }}>
                                            {translateTeam(finalHomeName)}
                                        </p>
                                    </div>
                                    
                                    <div className="flex flex-col items-center justify-center shrink-0 min-w-[90px] sm:min-w-[140px]">
                                        <span className={`text-[7px] sm:text-[9px] font-black uppercase tracking-widest mb-2 sm:mb-3 px-2 py-0.5 rounded shadow-sm ${isLive ? 'text-green-500 bg-green-500/10 animate-pulse border border-green-500/20' : 'text-foreground-muted bg-background/50 border border-border/50'}`}>
                                            {isLive ? '• EN VIVO' : matchStatusTranslations[match.status] || match.status}
                                        </span>
                                        
                                        <div className="flex items-center justify-center gap-1.5 sm:gap-3">
                                            <div className={`flex items-center justify-center w-9 h-11 sm:w-16 sm:h-20 rounded-lg sm:rounded-2xl font-black text-xl sm:text-4xl shadow-inner border transition-all ${hasO ? 'bg-background-offset text-primary border-primary/30 shadow-[inset_0_2px_10px_rgba(0,0,0,0.5)]' : 'bg-background text-foreground-muted border-border/50 opacity-50'}`}>
                                                {hasO ? (rH ?? 0) : '-'}
                                            </div>
                                            
                                            <div className="flex flex-col gap-1 sm:gap-2 opacity-50">
                                                <span className="w-1 h-1 sm:w-1.5 sm:h-1.5 rounded-full bg-foreground"></span>
                                                <span className="w-1 h-1 sm:w-1.5 sm:h-1.5 rounded-full bg-foreground"></span>
                                            </div>
                                            
                                            <div className={`flex items-center justify-center w-9 h-11 sm:w-16 sm:h-20 rounded-lg sm:rounded-2xl font-black text-xl sm:text-4xl shadow-inner border transition-all ${hasO ? 'bg-background-offset text-primary border-primary/30 shadow-[inset_0_2px_10px_rgba(0,0,0,0.5)]' : 'bg-background text-foreground-muted border-border/50 opacity-50'}`}>
                                                {hasO ? (rA ?? 0) : '-'}
                                            </div>
                                        </div>
                                    </div>
                                    
                                    <div className="flex-1 flex flex-col items-center justify-start min-w-0">
                                        {awayCrest ? <img src={awayCrest} className="w-10 h-10 sm:w-18 sm:h-18 relative overflow-hidden mb-2 sm:mb-3 drop-shadow-lg rounded-full border border-border/50 object-cover object-center" alt="" /> : <span className="text-2xl opacity-30 mb-2">🛡️</span>}
                                        <p className="font-black text-[10px] sm:text-xl text-center w-full leading-tight break-words" style={{ wordBreak: 'break-word' }}>
                                            {translateTeam(finalAwayName)}
                                        </p>
                                    </div>
                                </div>

                                <div className="mt-4 text-center sm:hidden">
                                    <span className="inline-flex items-center gap-1.5 text-[9px] text-foreground-muted font-bold tracking-widest bg-background px-2.5 py-1 rounded border border-border/50">
                                        <span>👨‍⚖️</span> Árbitro: {mainReferee ? mainReferee.name : 'Por Definir'}
                                    </span>
                                </div>
                            </div>

                            {/* 🟢 LA TABLA AHORA SE MUESTRA SIEMPRE, SIN RESTRICCIONES */}
                            <div className="w-full relative z-10 overflow-hidden bg-background min-h-[150px] flex-grow">
                                <img src={logocopa} className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-48 h-48 sm:w-80 sm:h-80 object-contain opacity-[0.02] dark:opacity-[0.03] pointer-events-none z-0" alt="" />

                                <table className="w-full text-left table-fixed relative z-10">
                                    <thead>
                                        <tr className="bg-background-offset/80 backdrop-blur-md text-[8px] sm:text-xs uppercase font-black border-b border-border text-foreground-muted">
                                            <th className="py-2 pl-3 sm:p-5 w-[42%] sm:w-[50%] lg:w-[58%] sm:pl-8">Jugador</th>
                                            <th className="py-2 w-[22%] sm:w-[18%] lg:w-[14%] text-center">Predicción</th>
                                            <th className="py-2 w-[18%] sm:w-[16%] lg:w-[14%] text-center">Puntos</th>
                                            <th className="py-2 pr-3 sm:p-5 w-[18%] sm:w-[16%] lg:w-[14%] text-center sm:pr-8 text-amber-500">Hasta este momento</th>
                                        </tr>
                                    </thead>
                                    <tbody className="text-[10px] sm:text-sm">
                                        {matchSpecificRanking.map((user) => {
                                            const is1st = user.position === 1;
                                            const is2nd = user.position === 2;
                                            const is3rd = user.position === 3;

                                            let rowBg = 'hover:bg-background-offset/50';
                                            if (is1st) rowBg = 'bg-yellow-500/10 hover:bg-yellow-500/20';
                                            else if (is2nd) rowBg = 'bg-slate-400/10 hover:bg-slate-400/20';
                                            else if (is3rd) rowBg = 'bg-amber-600/10 hover:bg-amber-600/20';

                                            let avatarBorder = 'border-border';
                                            if (is1st) avatarBorder = 'border-yellow-400 shadow-[0_0_10px_rgba(250,204,21,0.5)]';
                                            else if (is2nd) avatarBorder = 'border-slate-300 shadow-[0_0_10px_rgba(203,213,225,0.5)]';
                                            else if (is3rd) avatarBorder = 'border-amber-600 shadow-[0_0_10px_rgba(217,119,6,0.5)]';

                                            let nameColor = 'text-foreground';
                                            if (is1st) nameColor = 'text-yellow-500';
                                            else if (is2nd) nameColor = 'text-slate-300';
                                            else if (is3rd) nameColor = 'text-amber-500';

                                            let medal = null;
                                            if (is1st) medal = '👑';
                                            else if (is2nd) medal = '🥈';
                                            else if (is3rd) medal = '🥉';

                                            return (
                                                <tr key={user.uid} className={`border-b border-border/10 transition-colors ${rowBg}`}>
                                                    <td className="py-3 sm:py-5 pl-3 sm:pl-8 border-r border-border/10 overflow-hidden">
                                                        <div className="flex items-center gap-2 sm:gap-4 min-w-0">
                                                            <div className="relative shrink-0">
                                                                <img src={user.photoURL} className={`w-8 h-8 sm:w-12 sm:h-12 rounded-full border-2 object-cover ${avatarBorder}`} alt="" />
                                                                {medal && <span className="absolute -top-2.5 -left-2.5 text-[14px] sm:text-xl drop-shadow-md z-10">{medal}</span>}
                                                            </div>
                                                            <span className={`font-bold truncate text-[11px] sm:text-lg ${nameColor}`}>{formatShortName(user.name)}</span>
                                                        </div>
                                                    </td>
                                                    
                                                    <td className="py-3 sm:py-5 text-center border-r border-border/10">
                                                        <div className="flex justify-center w-full">
                                                            {user.uP ? (
                                                                <span className="bg-background-offset/80 px-2.5 py-1 sm:px-6 sm:py-3 rounded-xl border border-border font-black text-[11px] sm:text-xl whitespace-nowrap inline-flex items-center shadow-inner tracking-widest">
                                                                    {user.uP.home} <span className="mx-1 sm:mx-2 opacity-30 font-normal">-</span> {user.uP.away}
                                                                </span>
                                                            ) : <span className="opacity-30 italic text-[10px] sm:text-base">-</span>}
                                                        </div>
                                                    </td>
                                                    
                                                    <td className="py-3 sm:py-5 text-center border-r border-border/10">
                                                        <div className="flex justify-center w-full">
                                                            {user.pts !== null && (
                                                                <span className={`inline-flex items-center justify-center font-black px-2 py-1 sm:px-5 sm:py-2.5 rounded-lg text-[10px] sm:text-xl shadow-sm ${
                                                                    user.pts === 5 ? 'text-white bg-gradient-to-r from-green-500 to-emerald-600 border border-green-400/50 shadow-[0_0_12px_rgba(34,197,94,0.4)]' : 
                                                                    user.pts > 0 ? 'text-blue-100 bg-gradient-to-r from-blue-600 to-indigo-600 border border-blue-400/50 shadow-[0_0_10px_rgba(37,99,235,0.3)]' : 
                                                                    'text-foreground-muted bg-background-offset border border-border/50'
                                                                }`}>
                                                                    {user.pts > 0 ? `+${user.pts}` : '0'}
                                                                </span>
                                                            )}
                                                        </div>
                                                    </td>

                                                    <td className="py-3 sm:py-5 text-center pr-3 sm:pr-8 bg-amber-500/5">
                                                        <div className="flex justify-center w-full">
                                                            <span className="font-black text-amber-500 text-sm sm:text-3xl tabular-nums drop-shadow-sm">
                                                                {user.totalPoints}
                                                            </span>
                                                        </div>
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    );
                })}
            </div>

            {(!isApiLoading && !isDbLoading) && (!matchesByDate[selectedDate] || matchesByDate[selectedDate].length === 0) && (
                <div className="text-center py-20 bg-card rounded-[2.5rem] border border-card-border shadow-inner flex flex-col items-center mt-6">
                    <img src={logocopa} className="w-16 h-16 mb-4 opacity-20 grayscale" alt="" />
                    <p className="text-foreground-muted font-bold text-sm tracking-wider uppercase">No hay partidos para esta fecha.</p>
                </div>
            )}
        </div>
    );
};

export default WorldCupGrid;