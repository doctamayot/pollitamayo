import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { db } from '../firebase';
import { collection, onSnapshot, doc, getDoc } from 'firebase/firestore'; 
import { getWorldCupMatches } from '../services/apiFootball';
import logocopa from '../assets/logocopa.png';

// --- CONFIGURACIÓN FINANCIERA ---
const ENTRY_FEE = 170000;
const ADMIN_FEE_PERCENT = 0.10; 
const PORCENTAJES = { p1: 0.70, p2: 0.20, p3: 0.05, mitad: 0.05 };
const EXCLUDED_EMAILS = ['doctamayot@gmail.com', 'admin@polli-tamayo.com'];

const teamTranslations = {
    "Albania": "Albania", "Algeria": "Argelia", "Argentina": "Argentina", "Australia": "Australia", 
    "Austria": "Austria", "Belgium": "Bélgica", "Bolivia": "Bolivia", "Bosnia and Herzegovina": "Bosnia y Herzegovina",
    "Brazil": "Brasil", "Bulgaria": "Bulgaria", "Cameroon": "Camerún", "Canada": "Canadá", 
    "Chile": "Chile", "China": "China", "Colombia": "Colombia", "Costa Rica": "Costa Rica", 
    "Croatia": "Croacia", "Czechia": "República Checa", "Czech Republic": "República Checa", 
    "Denmark": "Dinamarca", "Ecuador": "Ecuador", "Egypt": "Egipto", "El Salvador": "El Salvador", 
    "England": "Inglaterra", "France": "Francia", "Germany": "Alemania", "Ghana": "Ghana", 
    "Greece": "Grecia", "Guatemala": "Guatemala", "Honduras": "Honduras", "Hungary": "Hungría", 
    "Iceland": "Islandia", "Iran": "Irán", "Ireland": "Irlanda", "Italy": "Italia", 
    "Ivory Coast": "Costa de Marfil", "Cote d'Ivoire": "Costa de Marfil", "Jamaica": "Jamaica", 
    "Japan": "Japón", "Mexico": "México", "Morocco": "Marruecos", "Netherlands": "Países Bajos", 
    "New Zealand": "Nueva Zelanda", "Nigeria": "Nigeria", "North Korea": "Corea del Norte", 
    "Norway": "Noruega", "Panama": "Panamá", "Paraguay": "Paraguay", "Peru": "Perú", 
    "Poland": "Polonia", "Portugal": "Portugal", "Qatar": "Catar", "Republic of Ireland": "República de Irlanda", 
    "Romania": "Rumania", "Russia": "Rusia", "Saudi Arabia": "Arabia Saudita", "Scotland": "Escocia", 
    "Senegal": "Senegal", "Serbia": "Serbia", "Slovakia": "Eslovaquia", "Slovenia": "Eslovaquia", 
    "South Africa": "Sudáfrica", "South Korea": "Corea del Sur", "Spain": "España", "Sweden": "Suecia", 
    "Switzerland": "Suiza", "Tunisia": "Túnez", "Turkey": "Turquía", "Ukraine": "Ucrania", 
    "United Arab Emirates": "Emiratos Árabes Unidos", "United States": "Estados Unidos", 
    "Uruguay": "Uruguay", "Venezuela": "Venezuela", "Wales": "Gales", "Por definir": "Por definir", "TBD": "Por definir"
};

const translateTeam = (name) => teamTranslations[name] || name;

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

const formatMoney = (amount) => {
    return new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0 }).format(amount || 0);
};

const isSmartMatch = (userText, adminText) => {
    if (!userText || !adminText) return false;
    const clean = (str) => str.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]/g, "").trim();
    const u = clean(userText); const a = clean(adminText);
    return u === a || (u.length > 3 && (a.includes(u) || u.includes(a)));
};

const getThirdPlaceTeams = (picksObj) => {
    if (!picksObj) return [];
    const teamsMap = new Map();
    const t3 = Array.isArray(picksObj.tercero) ? picksObj.tercero : (picksObj.tercero ? [picksObj.tercero] : []);
    const t4 = Array.isArray(picksObj.cuarto) ? picksObj.cuarto : (picksObj.cuarto ? [picksObj.cuarto] : []);
    [...t3, ...t4].forEach(t => {
        if (t && t.name) teamsMap.set(t.name, t);
    });
    const semifinalistas = picksObj.cuartos || []; 
    const finalistas = picksObj.semis || [];       
    if (semifinalistas.length > 0 && finalistas.length > 0) {
        const deductedTeams = semifinalistas.filter(semiTeam => 
            !finalistas.some(finTeam => finTeam.name === semiTeam.name)
        );
        deductedTeams.forEach(t => { 
            if (t && t.name) teamsMap.set(t.name, t);
        });
    }
    return Array.from(teamsMap.values());
};

const WorldCupRanking = ({ currentUser }) => { 
    const isAdmin = currentUser?.email === 'doctamayot@gmail.com' || currentUser?.email === 'admin@polli-tamayo.com';

    const [matches, setMatches] = useState([]);
    const [allPredictions, setAllPredictions] = useState({});
    const [usersInfo, setUsersInfo] = useState({});
    const [adminResults, setAdminResults] = useState(null);
    const [expandedUser, setExpandedUser] = useState(null);
    const [activeBadgeInfo, setActiveBadgeInfo] = useState(null);
    const [loadingStatus, setLoadingStatus] = useState({ api: false, preds: false, users: false, admin: false });
    const isLoading = !loadingStatus.api || !loadingStatus.preds || !loadingStatus.users || !loadingStatus.admin;

    useEffect(() => {
        if (activeBadgeInfo) {
            const timer = setTimeout(() => setActiveBadgeInfo(null), 3000);
            return () => clearTimeout(timer);
        }
    }, [activeBadgeInfo]);

   useEffect(() => {
        const fetchMatches = async () => {
            try {
                let data = null;
                if (isAdmin) {
                    data = await getWorldCupMatches();
                } else {
                    const cacheDoc = await getDoc(doc(db, 'worldCupAdmin', 'apiCache'));
                    if (cacheDoc.exists() && cacheDoc.data().matches) {
                        data = { matches: cacheDoc.data().matches };
                    } else {
                        data = await getWorldCupMatches();
                    }
                }
                if (data && data.matches) setMatches(data.matches);
            } catch (err) { 
                console.error(err); 
            } finally { 
                setLoadingStatus(prev => ({ ...prev, api: true })); 
            }
        };
        fetchMatches();

        const unsubPreds = onSnapshot(collection(db, 'worldCupPredictions'), (snap) => {
            const preds = {}; snap.forEach(doc => { preds[doc.id] = doc.data(); });
            setAllPredictions(preds);
            setLoadingStatus(prev => ({ ...prev, preds: true }));
        });

        const unsubUsers = onSnapshot(collection(db, 'users'), (snap) => {
            const users = {}; snap.forEach(doc => { users[doc.id] = doc.data(); });
            setUsersInfo(users);
            setLoadingStatus(prev => ({ ...prev, users: true }));
        });

        const unsubAdmin = onSnapshot(doc(db, 'worldCupAdmin', 'results'), (docSnap) => {
            if (docSnap.exists()) setAdminResults(docSnap.data());
            setLoadingStatus(prev => ({ ...prev, admin: true }));
        });

        return () => { unsubPreds(); unsubUsers(); unsubAdmin(); };
    }, [isAdmin]);

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

    // 🟢 1. OBTENER PARTIDOS OFICIALES EN ORDEN CRONOLÓGICO PARA INSIGNIAS HISTÓRICAS
    const officialMatches = useMemo(() => {
        return effectiveMatches.filter(m => {
            const rH = mergedAdminPreds[m.id]?.home;
            const rA = mergedAdminPreds[m.id]?.away;
            const matchStatus = m.status || '';
            const hasOfficialAdminResult = (rH !== undefined && rH !== '' && rH !== null) && (rA !== undefined && rA !== '' && rA !== null);
            const isMatchActiveOrFinished = matchStatus === 'FINISHED' || matchStatus === 'IN_PLAY' || matchStatus === 'PAUSED';
            return hasOfficialAdminResult || isMatchActiveOrFinished;
        }).sort((a, b) => new Date(a.utcDate) - new Date(b.utcDate));
    }, [effectiveMatches, mergedAdminPreds]);

    // 🟢 2. CALCULAR EL HISTORIAL DE POSICIONES (Para "El Dictador" y "El Ancla")
    const historicalRanks = useMemo(() => {
        const userScores = {};
        Object.keys(allPredictions).forEach(uid => userScores[uid] = 0);
        const history = [];

        officialMatches.forEach(m => {
            const rH = parseInt(mergedAdminPreds[m.id]?.home);
            const rA = parseInt(mergedAdminPreds[m.id]?.away);
            const validResult = !isNaN(rH) && !isNaN(rA);

            if (validResult) {
                Object.keys(allPredictions).forEach(uid => {
                    const userData = allPredictions[uid];
                    if (!userData || !userData.hasPaid || EXCLUDED_EMAILS.includes(userData.email)) return;

                    const p = userData.predictions?.[m.id];
                    if (p && p.home !== '' && p.away !== '') {
                        const pH = parseInt(p.home); const pA = parseInt(p.away);
                        if (pH === rH && pA === rA) userScores[uid] += 5;
                        else {
                            const pR = Math.sign(pH - pA); const rR = Math.sign(rH - rA);
                            if (pR === rR && (pH === rH || pA === rA)) userScores[uid] += 3;
                            else if (pR === rR) userScores[uid] += 2;
                            else if (pH === rH || pA === rA) userScores[uid] += 1;
                        }
                    }
                });

                let max = -1; let min = 999999;
                Object.keys(userScores).forEach(uid => {
                    const userData = allPredictions[uid];
                    if (!userData || !userData.hasPaid || EXCLUDED_EMAILS.includes(userData.email)) return;
                    const s = userScores[uid];
                    if (s > max) max = s;
                    if (s < min) min = s;
                });

                history.push({ topScore: max, bottomScore: min, scores: { ...userScores } });
            }
        });
        return history;
    }, [officialMatches, allPredictions, mergedAdminPreds]);

    const groupStageMatches = useMemo(() => effectiveMatches.filter(m => m.stage === 'GROUP_STAGE'), [effectiveMatches]);

    const byGroup = useMemo(() => {
        return groupStageMatches.reduce((acc, m) => {
            let g = m.group?.replace('GROUP_', 'Grupo ') || 'Fase de Grupos';
            if (!acc[g]) acc[g] = []; acc[g].push(m); return acc;
        }, {});
    }, [groupStageMatches]);

    const groupStatus = useMemo(() => {
        const status = {};
        let allFinished = true;
        Object.keys(byGroup).forEach(g => {
            const groupMatches = byGroup[g];
            const isGroupFinished = groupMatches.every(m => {
                const aPred = mergedAdminPreds?.[m.id];
                const hasAdminRes = aPred && aPred.home !== '' && aPred.away !== '' && aPred.home !== undefined && aPred.away !== undefined;
                return hasAdminRes || m.status === 'FINISHED';
            });
            status[g] = isGroupFinished;
            if (!isGroupFinished) allFinished = false;
        });
        return { groups: status, allFinished }; 
    }, [byGroup, mergedAdminPreds]);

    const isGroupStageFinished = groupStatus.allFinished;

    const computeStandings = useCallback((groupName, predsToUse, tiesToUse) => {
        if (!groupName || !byGroup[groupName]) return [];
        const groupMatches = byGroup[groupName];
        const teams = {};

        groupMatches.forEach(m => {
            const h = m.homeTeam?.name || 'Por definir';
            const a = m.awayTeam?.name || 'Por definir';
            if (!teams[h]) teams[h] = { name: h, crest: m.homeTeam?.crest, pj: 0, pg: 0, pe: 0, pp: 0, gf: 0, gc: 0, dg: 0, pts: 0 };
            if (!teams[a]) teams[a] = { name: a, crest: m.awayTeam?.crest, pj: 0, pg: 0, pe: 0, pp: 0, gf: 0, gc: 0, dg: 0, pts: 0 };
        });

        groupMatches.forEach(m => {
            const pred = predsToUse?.[m.id];
            if (pred && pred.home !== '' && pred.home !== undefined && pred.away !== '' && pred.away !== undefined) {
                const hG = parseInt(pred.home, 10); const aG = parseInt(pred.away, 10);
                const h = m.homeTeam.name; const a = m.awayTeam.name;

                teams[h].pj++; teams[a].pj++;
                teams[h].gf += hG; teams[a].gf += aG;
                teams[h].gc += aG; teams[a].gc += hG;
                teams[h].dg = teams[h].gf - teams[h].gc;
                teams[a].dg = teams[a].gf - teams[a].gc;

                if (hG > aG) { teams[h].pts += 3; teams[h].pg++; teams[a].pp++; } 
                else if (hG < aG) { teams[a].pts += 3; teams[a].pg++; teams[h].pp++; } 
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
                    const pred = predsToUse?.[m.id];
                    if (pred && pred.home !== '' && pred.away !== '') {
                        const hG = parseInt(pred.home, 10); const aG = parseInt(pred.away, 10);
                        const h = m.homeTeam.name; const a = m.awayTeam.name;
                        
                        h2hStats[h].gf += hG; h2hStats[a].gf += aG;
                        h2hStats[h].dg += (hG - aG); h2hStats[a].dg += (aG - hG);
                        if (hG > aG) { h2hStats[h].pts += 3; }
                        else if (hG < aG) { h2hStats[a].pts += 3; }
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
                } 
                else if (subGroup.length > 1) {
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
                                const tieA = tiesToUse?.[groupName]?.[a.name] || 99;
                                const tieB = tiesToUse?.[groupName]?.[b.name] || 99;
                                if (tieA !== tieB) return tieA - tieB; 
                                return translateTeam(a.name).localeCompare(translateTeam(b.name));
                            });
                        }
                        finalSorted.push(...finalTied);
                    });
                } 
                else {
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
            const groupTeams = groupedByPts[pts];
            finalFlattenedStandings.push(...resolveTie(groupTeams));
        });

        return finalFlattenedStandings;
    }, [byGroup]);

    const adminQualified32 = useMemo(() => {
        let top2 = []; let thirds = [];
        let allGroupsFinished = true;
        
        Object.keys(byGroup).forEach(g => {
            const isGroupFinished = groupStatus.groups[g];
            if (!isGroupFinished) allGroupsFinished = false;

            if (isGroupFinished) {
                const st = computeStandings(g, mergedAdminPreds, adminResults?.manualTiebreakers);
                if (st[0]) top2.push(st[0]); if (st[1]) top2.push(st[1]); if (st[2]) thirds.push(st[2]);
            }
        });
        
        if (allGroupsFinished && top2.length > 0) {
            thirds.sort((a, b) => b.pts - a.pts || b.dg - a.dg || b.gf - a.gf);
            return [...top2, ...thirds.slice(0, 8)];
        }
        return top2;
    }, [byGroup, mergedAdminPreds, adminResults, groupStatus, computeStandings]);

    const ranking = useMemo(() => {
        const ranks = [];

        Object.keys(allPredictions).forEach(uid => {
            const userData = allPredictions[uid];
            if (!userData.hasPaid || EXCLUDED_EMAILS.includes(userData.email)) return;

            const stats = { plenosCount: 0, ptsPlenos: 0, ptsOtrosAciertos: 0, ptsHonorYBonos: 0, ptsRondas: 0, ptsExtras: 0, ptsEventos: 0, total: 0 };

            // 🟢 LÓGICA DE INSIGNIAS HISTÓRICAS
            let consecutivePlenos = 0;
            let maxConsecutivePlenos = 0;

            officialMatches.forEach(m => {
                const p = userData.predictions?.[m.id];
                const rH = mergedAdminPreds[m.id]?.home;
                const rA = mergedAdminPreds[m.id]?.away;
                if (p && p.home !== '' && p.away !== '' && rH !== undefined && rA !== undefined) {
                    const pH = parseInt(p.home); const pA = parseInt(p.away);
                    const realH = parseInt(rH); const realA = parseInt(rA);
                    if (pH === realH && pA === realA) {
                        consecutivePlenos++;
                        if (consecutivePlenos > maxConsecutivePlenos) maxConsecutivePlenos = consecutivePlenos;
                    } else { consecutivePlenos = 0; }
                } else { consecutivePlenos = 0; }
            });

            let isDictador = false;
            let isColero = false;
            if (historicalRanks.length >= 7) {
                const last7 = historicalRanks.slice(-7);
                isDictador = last7.every(step => step.scores[uid] === step.topScore && step.topScore > 0);
                isColero = last7.every(step => step.scores[uid] === step.bottomScore);
            }

            effectiveMatches.forEach(m => {
                const p = userData.predictions?.[m.id]; 
                const rH = mergedAdminPreds[m.id]?.home;
                const rA = mergedAdminPreds[m.id]?.away;
                const matchStatus = m.status || '';
                
                const hasOfficialAdminResult = (rH !== undefined && rH !== '' && rH !== null) && (rA !== undefined && rA !== '' && rA !== null);
                const isMatchActiveOrFinished = matchStatus === 'FINISHED' || matchStatus === 'IN_PLAY' || matchStatus === 'PAUSED';
                const canSumPoints = hasOfficialAdminResult || isMatchActiveOrFinished;

                if (canSumPoints && p && p.home !== '' && p.away !== '') {
                    const pH = parseInt(p.home); const pA = parseInt(p.away);
                    const realH = parseInt(rH); const realA = parseInt(rA);

                    if (pH === realH && pA === realA) { stats.plenosCount++; stats.ptsPlenos += 5; }
                    else {
                        const pR = Math.sign(pH - pA); const rR = Math.sign(realH - realA);
                        if (pR === rR && (pH === realH || pA === realA)) stats.ptsOtrosAciertos += 3;
                        else if (pR === rR) stats.ptsOtrosAciertos += 2;
                        else if (pH === realH || pA === realA) stats.ptsOtrosAciertos += 1;
                    }
                }
            });

            const isSeco = officialMatches.length >= 5 && stats.plenosCount === 0;
            const isFrancotirador = maxConsecutivePlenos >= 3;

            // Guardamos las insignias en el objeto
            stats.isDictador = isDictador;
            stats.isColero = isColero;
            stats.isSeco = isSeco;
            stats.isFrancotirador = isFrancotirador;

            let userTop2 = []; let userThirds = [];
            
            Object.keys(byGroup).forEach(g => {
                const groupMatches = byGroup[g];
                
                let predictedCount = 0;
                groupMatches.forEach(m => {
                    const p = userData.predictions?.[m.id];
                    if (p && p.home !== '' && p.home !== undefined && p.away !== '' && p.away !== undefined) {
                        predictedCount++;
                    }
                });

                if (predictedCount === 0) return;

                const isGroupFinished = groupStatus.groups[g];
                
                const uT = computeStandings(g, userData.predictions, userData.manualTiebreakers);
                if (uT[0]) userTop2.push(uT[0]); if (uT[1]) userTop2.push(uT[1]); if (uT[2]) userThirds.push(uT[2]);
                
                if (isGroupFinished && predictedCount === groupMatches.length) {
                    const aT = computeStandings(g, mergedAdminPreds, adminResults?.manualTiebreakers);
                    if (uT.length >= 4 && aT.length >= 4 && uT[0].name === aT[0].name && uT[1].name === aT[1].name && uT[2].name === aT[2].name && uT[3].name === aT[3].name) {
                        stats.ptsHonorYBonos += 8;
                    }
                }
            });
            
            userThirds.sort((a, b) => b.pts - a.pts || b.dg - a.dg || b.gf - a.gf);
            const userQualified32 = [...userTop2, ...userThirds.slice(0, 8)];

            if (adminQualified32.length > 0) {
                userQualified32.forEach(ut => {
                    if (adminQualified32.some(at => at.name === ut.name)) stats.ptsRondas += 2;
                });
            }

            const koRounds = [
                { id: 'dieciseisavos', pts: 3 }, 
                { id: 'octavos', pts: 4 },       
                { id: 'cuartos', pts: 5 },       
                { id: 'semis', pts: 6 }          
            ];

            koRounds.forEach(r => {
                const uTeams = userData.knockoutPicks?.[r.id] || [];
                const aTeams = adminResults?.knockoutPicks?.[r.id] || [];
                if (aTeams.length > 0) {
                    uTeams.forEach(ut => {
                        if (aTeams.some(at => at.name === ut.name)) stats.ptsRondas += r.pts;
                    });
                }
            });

            const uThirdsList = getThirdPlaceTeams(userData.knockoutPicks);
            const aThirdsList = getThirdPlaceTeams(adminResults?.knockoutPicks);
            if (aThirdsList.length > 0) {
                uThirdsList.forEach(ut => {
                    if (ut && aThirdsList.some(at => at && at.name === ut.name)) stats.ptsRondas += 4;
                });
            }

            extraQuestions.forEach(q => {
                const u = userData.extraPicks?.[q.id]; const a = adminResults?.extraPicks?.[q.id];
                if (u && a && (q.manual ? isSmartMatch(u, a) : u.toLowerCase() === a.toLowerCase())) stats.ptsExtras += 6;
            });
            specialEvents.forEach(e => {
                let u = userData.eventPicks?.[e.id]; 
                let a = adminResults?.eventPicks?.[e.id];
                if (u && a) {
                    u = String(u).toUpperCase().trim();
                    a = String(a).toUpperCase().trim();
                    if (a === u) {
                        stats.ptsEventos += (u === 'SI' ? 5 : 2);
                    }
                }
            });

            const honorSlots = [{ id: 'campeon', pts: 10 }, { id: 'subcampeon', pts: 6 }, { id: 'tercero', pts: 6 }, { id: 'cuarto', pts: 6 }];
            honorSlots.forEach(s => {
                if (userData.knockoutPicks?.[s.id]?.[0]?.name === adminResults?.knockoutPicks?.[s.id]?.[0]?.name && adminResults?.knockoutPicks?.[s.id]?.[0]?.name) { stats.ptsHonorYBonos += s.pts; }
            });
            
            let isSuperBono = false;
            if (adminResults?.knockoutPicks) {
                isSuperBono = honorSlots.every(s => userData.knockoutPicks?.[s.id]?.[0]?.name === adminResults.knockoutPicks[s.id]?.[0]?.name && adminResults.knockoutPicks[s.id]?.[0]?.name);
            }
            if (isSuperBono) stats.ptsHonorYBonos += 10;

            stats.total = stats.ptsPlenos + stats.ptsOtrosAciertos + stats.ptsHonorYBonos + stats.ptsRondas + stats.ptsExtras + stats.ptsEventos;
            ranks.push({ uid, name: usersInfo[uid]?.displayName || userData.displayName || 'Jugador', photoURL: usersInfo[uid]?.photoURL || userData.photoURL || logocopa, ...stats });
        });

        ranks.sort((a, b) => b.total - a.total);
        let currentRank = 1;
        ranks.forEach((r, i) => {
            if (i > 0 && r.total < ranks[i - 1].total) currentRank = i + 1;
            r.position = currentRank;
        });
        return ranks;
    }, [allPredictions, effectiveMatches, officialMatches, historicalRanks, byGroup, adminResults, usersInfo, isGroupStageFinished, adminQualified32, computeStandings, mergedAdminPreds, groupStatus]);

    const premiosRepartidos = useMemo(() => {
        if (ranking.length === 0) return { p1Ind: 0, p2Ind: 0, p3Ind: 0, p1Total: 0, p2Total: 0, p3Total: 0, mitad: 0, netPot: 0, r1: 1, r2: 0, r3: 0 };
        
        const netPot = (ranking.length * ENTRY_FEE) * (1 - ADMIN_FEE_PERCENT);
        const bolsa1 = netPot * PORCENTAJES.p1;
        const bolsa2 = netPot * PORCENTAJES.p2;
        const bolsa3 = netPot * PORCENTAJES.p3;
        const bolsaMitad = netPot * PORCENTAJES.mitad;

        const playersByPos = {};
        ranking.forEach(r => { playersByPos[r.position] = (playersByPos[r.position] || 0) + 1; });

        const uniquePositions = [...new Set(ranking.map(r => r.position))].sort((a, b) => a - b);
        const r1 = uniquePositions[0] || 0;
        const r2 = uniquePositions[1] || 0;
        const r3 = uniquePositions[2] || 0;

        let p1Ind = 0, p2Ind = 0, p3Ind = 0;
        let p1Total = 0, p2Total = 0, p3Total = 0;

        const n1 = playersByPos[r1] || 0;
        const n2 = playersByPos[r2] || 0;
        const n3 = playersByPos[r3] || 0;

        if (n1 >= 3) {
            p1Total = bolsa1 + bolsa2 + bolsa3;
            p1Ind = p1Total / n1;
        } else if (n1 === 2) {
            p1Total = bolsa1 + bolsa2;
            p1Ind = p1Total / 2;
            p2Total = bolsa3;      
            p2Ind = bolsa3 / n2;   
        } else {
            p1Total = bolsa1;
            p1Ind = bolsa1;
            if (n2 >= 2) {
                p2Total = bolsa2 + bolsa3;
                p2Ind = p2Total / n2;
            } else {
                p2Total = bolsa2;
                p2Ind = bolsa2;
                p3Total = bolsa3;
                p3Ind = bolsa3 / n3;
            }
        }

        return { p1Ind, p2Ind, p3Ind, p1Total, p2Total, p3Total, mitad: bolsaMitad, netPot, r1, r2, r3 };
    }, [ranking]);

    const physicalMiddlePos = ranking.length > 0 ? Math.ceil(ranking.length / 2) : -1;
    const middlePlayerUid = physicalMiddlePos !== -1 ? ranking[physicalMiddlePos - 1]?.uid : null;

    const PodiumSpot = ({ users, place, prizeTotal, bgGradient, heightClass, medalIcon, delayClass }) => {
        const isTied = users.length > 1;
        const mainUser = users[0];
        if (!mainUser || prizeTotal <= 0) return <div className={`w-1/3 ${heightClass}`}></div>;

        return (
            <div className={`w-1/3 flex flex-col items-center justify-end relative z-10 animate-slide-up ${delayClass}`}>
                <div className="flex flex-col items-center mb-2 sm:mb-4">
                    <span className="text-3xl sm:text-5xl drop-shadow-lg mb-1 sm:mb-2">{medalIcon}</span>
                    <div className="relative">
                        {!isTied ? (
                            <>
                                <img src={mainUser.photoURL} alt={mainUser.name} className={`w-14 h-14 sm:w-20 sm:h-20 rounded-full border-4 shadow-xl object-cover ${place === 1 ? 'border-yellow-400' : place === 2 ? 'border-slate-300' : 'border-amber-600'}`} />
                                <div className={`absolute -bottom-2 left-1/2 -translate-x-1/2 font-black text-white text-[10px] sm:text-xs px-2 rounded-full shadow-md ${place === 1 ? 'bg-yellow-500' : place === 2 ? 'bg-slate-500' : 'bg-amber-700'}`}>{mainUser.total} PTS</div>
                            </>
                        ) : (
                            <div className={`w-14 h-14 sm:w-20 sm:h-20 rounded-full border-4 flex items-center justify-center bg-background border-dashed ${place === 1 ? 'border-yellow-400' : place === 2 ? 'border-slate-300' : 'border-amber-600'}`}>
                                <span className="text-2xl sm:text-4xl opacity-40">👥</span>
                                <div className={`absolute -bottom-2 left-1/2 -translate-x-1/2 font-black text-white text-[10px] sm:text-xs px-2 rounded-full shadow-md bg-slate-800`}>EMPATE</div>
                            </div>
                        )}
                    </div>
                </div>
                <div className={`w-full ${bgGradient} ${heightClass} rounded-t-2xl sm:rounded-t-[2rem] border-x border-t border-white/20 shadow-xl flex flex-col items-center justify-start pt-4 sm:pt-6`}>
                    {isTied ? (
                        <span className="font-black text-white text-xs sm:text-xl uppercase tracking-tighter drop-shadow-md">REPARTIR</span>
                    ) : (
                        <span className="font-black text-white text-[10px] sm:text-sm text-center px-1 truncate w-full">{formatShortName(mainUser.name)}</span>
                    )}
                    <div className="flex flex-col items-center mt-2 bg-black/20 rounded-lg p-1 px-2 border border-white/10">
                        <span className="text-white/70 text-[7px] sm:text-[8px] font-bold uppercase tracking-tighter">{isTied ? 'Bolsa Total:' : 'Premio:'}</span>
                        <span className="text-white font-black text-[9px] sm:text-[11px] leading-tight">{formatMoney(prizeTotal)}</span>
                    </div>
                </div>
            </div>
        );
    };

    if (isLoading) return (
        <div className="flex flex-col items-center justify-center py-32 animate-fade-in">
            <img src={logocopa} className="w-20 h-20 mb-6 animate-pulse opacity-50" alt="Cargando" />
            <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin mb-4"></div>
            <p className="text-foreground-muted font-bold tracking-widest uppercase text-xs text-center">Auditando Expedientes y Calculando Ranking...</p>
        </div>
    );

    return (
        <div className="max-w-4xl mx-auto pb-24 animate-fade-in px-3 sm:px-0">
            <div className="text-center mb-6 pt-6">
                <span className="text-primary font-black tracking-widest uppercase text-xs bg-primary/10 px-4 py-1 rounded-full border border-primary/20">Leaderboard Oficial</span>
                <h2 className="text-4xl sm:text-5xl font-extrabold text-foreground tracking-tighter mt-4 mb-2">Ranking Oficial 🏆</h2>
                <p className="text-foreground-muted font-medium text-sm">Bolsa Real (90%): <strong className="text-green-500 font-black">{formatMoney(premiosRepartidos.netPot)}</strong></p>
            </div>

            

            {ranking.length >= 2 && (
                <div className="flex justify-center items-end h-[280px] sm:h-[380px] mb-12 relative">
                    <img src={logocopa} className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-64 h-64 opacity-5 pointer-events-none" alt="" />
                    <PodiumSpot users={ranking.filter(r => r.position === premiosRepartidos.r2)} place={2} prizeTotal={premiosRepartidos.p2Total} medalIcon="🥈" bgGradient="bg-gradient-to-b from-slate-400 to-slate-600" heightClass="h-[65%]" delayClass="animation-delay-200" />
                    <PodiumSpot users={ranking.filter(r => r.position === premiosRepartidos.r1)} place={1} prizeTotal={premiosRepartidos.p1Total} medalIcon="👑" bgGradient="bg-gradient-to-b from-yellow-400 to-amber-600" heightClass="h-[85%]" delayClass="animation-delay-100" />
                    <PodiumSpot users={ranking.filter(r => r.position === premiosRepartidos.r3)} place={3} prizeTotal={premiosRepartidos.p3Total} medalIcon="🥉" bgGradient="bg-gradient-to-b from-amber-600 to-amber-800" heightClass="h-[55%]" delayClass="animation-delay-300" />
                </div>
            )}

            <div className="space-y-4">
                {ranking.map((user) => {
                    const isExpanded = expandedUser === user.uid;
                    const isMiddle = user.uid === middlePlayerUid;
                    
                    let rewardLabel = null;
                    if (user.position === premiosRepartidos.r1) rewardLabel = formatMoney(premiosRepartidos.p1Ind);
                    else if (user.position === premiosRepartidos.r2) rewardLabel = formatMoney(premiosRepartidos.p2Ind);
                    else if (user.position === premiosRepartidos.r3) rewardLabel = formatMoney(premiosRepartidos.p3Ind);
                    
                    return (
                        <div key={user.uid} className={`bg-card border ${isExpanded ? 'border-primary shadow-lg ring-1 ring-primary/20' : 'border-card-border hover:border-border'} rounded-2xl overflow-hidden transition-all duration-300`}>
                            <div onClick={() => setExpandedUser(isExpanded ? null : user.uid)} className="flex items-center p-3 sm:p-5 cursor-pointer relative overflow-hidden select-none">
                                {user.position === premiosRepartidos.r1 && <div className="absolute left-0 top-0 bottom-0 w-1.5 bg-yellow-400"></div>}
                                {user.position === premiosRepartidos.r2 && <div className="absolute left-0 top-0 bottom-0 w-1.5 bg-slate-400"></div>}
                                {user.position === premiosRepartidos.r3 && <div className="absolute left-0 top-0 bottom-0 w-1.5 bg-amber-600"></div>}
                                
                                <div className="w-8 sm:w-14 flex justify-center shrink-0 font-black text-lg sm:text-2xl text-foreground-muted/30">{user.position}</div>
                                
                                {/* 🟢 AVATAR CON ICONOS SOBREPUESTOS SEGÚN POSICIÓN */}
                                <div className="relative shrink-0 mr-3 sm:mr-5">
                                    <img src={user.photoURL} className={`w-10 h-10 sm:w-14 sm:h-14 rounded-full object-cover shadow-sm border ${
                                        user.position === premiosRepartidos.r1 ? 'border-yellow-400' : 
                                        user.position === premiosRepartidos.r2 ? 'border-slate-300' : 
                                        user.position === premiosRepartidos.r3 ? 'border-amber-600' : 
                                        user.position === ranking[ranking.length - 1]?.position ? 'border-red-500/50' : 
                                        isMiddle ? 'border-blue-400/50' : 'border-border'
                                    }`} alt="" />
                                    
                                    {user.position === premiosRepartidos.r1 ? (
                                        <span className="absolute -top-3 -left-3 text-xl sm:text-2xl drop-shadow-md pointer-events-none" title="El Rey">👑</span>
                                    ) : user.position === premiosRepartidos.r2 ? (
                                        <span className="absolute -top-3 -left-3 text-xl sm:text-2xl drop-shadow-md pointer-events-none" title="Segundo">🥈</span>
                                    ) : user.position === premiosRepartidos.r3 ? (
                                        <span className="absolute -top-3 -left-3 text-xl sm:text-2xl drop-shadow-md pointer-events-none" title="Tercero">🥉</span>
                                    ) : user.position === ranking[ranking.length - 1]?.position ? (
                                        <span className="absolute -top-3 -left-3 text-xl sm:text-2xl drop-shadow-md pointer-events-none" title="El Colero Actual">🐢</span>
                                    ) : isMiddle ? (
                                        <span className="absolute -top-3 -left-3 text-xl sm:text-2xl drop-shadow-md pointer-events-none" title="En toda la mitad">🥪</span>
                                    ) : null}
                                </div>
                                
                                <div className="flex flex-col flex-1 min-w-0 pr-2">
                                    <span className="font-bold text-sm sm:text-lg text-foreground leading-tight truncate">{formatShortName(user.name)}</span>
                                    
                                    {/* 🟢 RENDERIZADO DE LAS NUEVAS INSIGNIAS */}
                                 
                                    <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
                                        {user.isDictador && <span onClick={(e) => { e.stopPropagation(); setActiveBadgeInfo({ title: 'El Dictador', desc: 'Líder por 7 partidos seguidos. ¡Intocable!', x: e.clientX, y: e.clientY }); }} className="text-sm sm:text-base drop-shadow-sm cursor-pointer active:scale-125 transition-transform">🗿</span>}
                                        {user.isFrancotirador && <span onClick={(e) => { e.stopPropagation(); setActiveBadgeInfo({ title: 'Francotirador', desc: 'Acertó 3 marcadores exactos consecutivos.', x: e.clientX, y: e.clientY }); }} className="text-sm sm:text-base drop-shadow-sm cursor-pointer active:scale-125 transition-transform">🎯</span>}
                                        {user.isColero && <span onClick={(e) => { e.stopPropagation(); setActiveBadgeInfo({ title: 'El Ancla', desc: 'Colero general por 7 partidos. Hundiendo la tabla.', x: e.clientX, y: e.clientY }); }} className="text-sm sm:text-base opacity-70 cursor-pointer active:scale-125 transition-transform">⚓</span>}
                                        {user.isSeco && <span onClick={(e) => { e.stopPropagation(); setActiveBadgeInfo({ title: 'El Seco', desc: 'Ningún pleno hasta el momento. ¡Cero puntería!', x: e.clientX, y: e.clientY }); }} className="text-sm sm:text-base opacity-70 cursor-pointer active:scale-125 transition-transform">🌵</span>}

                                        {isMiddle && <span className="text-[7px] sm:text-[9px] font-black uppercase text-blue-500 bg-blue-500/10 px-1.5 py-0.5 rounded-full border border-blue-500/20 whitespace-nowrap truncate max-w-full ml-1">⚖️ MITAD: {formatMoney(premiosRepartidos.mitad)}</span>}
                                        {rewardLabel && rewardLabel !== "$0" && <span className="text-[7px] sm:text-[9px] font-black uppercase text-primary bg-primary/5 px-1.5 py-0.5 rounded-full border border-primary/10 whitespace-nowrap truncate max-w-full ml-1">GANANDO: {rewardLabel}</span>}
                                    </div>
                                </div>

                                <div className="flex items-center justify-end gap-2 sm:gap-4 shrink-0 border-l border-border/20 pl-2 sm:pl-5 min-w-[65px] sm:min-w-[100px]">
                                    <div className="flex flex-col items-end justify-center w-full">
                                        <span className="font-black text-xl sm:text-3xl text-foreground tabular-nums leading-none truncate w-full text-right tracking-tighter">{user.total}</span>
                                        <span className="text-[7px] sm:text-[9px] font-bold text-foreground-muted uppercase tracking-widest mt-1">Puntos</span>
                                    </div>
                                    <span className={`transition-transform duration-300 opacity-30 text-xs ${isExpanded ? 'rotate-180' : ''}`}>▼</span>
                                </div>
                            </div>
                            {isExpanded && (
                                <div className="bg-background-offset border-t border-border p-5 sm:p-8 animate-fade-in">
                                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-center">
                                        <div className="bg-card p-4 rounded-2xl border border-card-border shadow-sm">
                                            <span className="text-2xl mb-1 block">🎯</span>
                                            <span className="text-[10px] text-foreground-muted font-bold uppercase">Plenos ({user.plenosCount})</span>
                                            <div className="text-xl font-black text-green-500">{user.ptsPlenos} <small className="text-[10px] font-normal opacity-50">pts</small></div>
                                        </div>
                                        <div className="bg-card p-4 rounded-2xl border border-card-border shadow-sm">
                                            <span className="text-2xl mb-1 block">👑</span>
                                            <span className="text-[10px] text-yellow-600 font-bold uppercase tracking-tighter">Honor y Bonos</span>
                                            <div className="text-xl font-black text-yellow-600">{user.ptsHonorYBonos} <small className="text-[10px] font-normal opacity-50">pts</small></div>
                                        </div>
                                        <div className="bg-card p-4 rounded-2xl border border-card-border shadow-sm">
                                            <span className="text-2xl mb-1 block">📈</span>
                                            <span className="text-[10px] text-foreground-muted font-bold uppercase">Otros Aciertos</span>
                                            <div className="text-xl font-black text-foreground">{user.ptsOtrosAciertos} <small className="text-[10px] font-normal opacity-50">pts</small></div>
                                        </div>
                                        <div className="bg-card p-4 rounded-2xl border border-card-border shadow-sm">
                                            <span className="text-2xl mb-1 block">📈</span>
                                            <span className="text-[10px] text-foreground-muted font-bold uppercase">Rondas</span>
                                            <div className="text-xl font-black text-foreground">{user.ptsRondas} <small className="text-[10px] font-normal opacity-50">pts</small></div>
                                        </div>
                                        <div className="bg-card p-4 rounded-2xl border border-card-border shadow-sm">
                                            <span className="text-2xl mb-1 block">⭐</span>
                                            <span className="text-[10px] text-foreground-muted font-bold uppercase">Extras</span>
                                            <div className="text-xl font-black text-foreground">{user.ptsExtras} <small className="text-[10px] font-normal opacity-50">pts</small></div>
                                        </div>
                                        <div className="bg-card p-4 rounded-2xl border border-card-border shadow-sm">
                                            <span className="text-2xl mb-1 block">❓</span>
                                            <span className="text-[10px] text-foreground-muted font-bold uppercase">Eventos</span>
                                            <div className="text-xl font-black text-foreground">{user.ptsEventos} <small className="text-[10px] font-normal opacity-50">pts</small></div>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                        
                    );
                })}
                {/* 🟢 SECCIÓN: GUÍA DE INSIGNIAS */}
            <div className="bg-card border border-border rounded-2xl p-4 sm:p-5 mb-10 shadow-sm">
                <h3 className="text-foreground font-black text-xs sm:text-sm uppercase tracking-widest mb-3 opacity-60 text-center">Guía de Insignias y Logros</h3>
                <div className="flex flex-wrap justify-center gap-3 sm:gap-6 text-[10px] sm:text-xs text-foreground-muted">
                    <div className="flex items-center gap-1.5 bg-background-offset px-3 py-1.5 rounded-lg border border-border/50"><span className="text-base sm:text-lg">🎯</span> <b>Francotirador:</b> 3 plenos consecutivos</div>
                    <div className="flex items-center gap-1.5 bg-background-offset px-3 py-1.5 rounded-lg border border-border/50"><span className="text-base sm:text-lg">🗿</span> <b>El Dictador:</b> Líder por 7 partidos seguidos</div>
                    <div className="flex items-center gap-1.5 bg-background-offset px-3 py-1.5 rounded-lg border border-border/50"><span className="text-base sm:text-lg">⚓</span> <b>El Ancla:</b> Colero por 7 partidos seguidos</div>
                    <div className="flex items-center gap-1.5 bg-background-offset px-3 py-1.5 rounded-lg border border-border/50"><span className="text-base sm:text-lg">🌵</span> <b>El Seco:</b> Ningún pleno hasta el momento</div>
                </div>
            </div>
            </div>
            {/* 🟢 POP-UP / MODAL DE INSIGNIAS PARA MÓVILES */}
            {activeBadgeInfo && (
                <div 
                    className="fixed z-[100] bg-slate-800 border border-slate-600 text-white p-2 rounded-xl shadow-2xl flex flex-col items-center pointer-events-none animate-fade-in w-40 text-center"
                    style={{
                        top: activeBadgeInfo.y - 15, // Un poco más arriba del dedo
                        left: Math.min(Math.max(activeBadgeInfo.x, 85), window.innerWidth - 85), // Evita que se salga de los bordes
                        transform: 'translate(-50%, -100%)'
                    }}
                >
                    <span className="font-black text-[11px] text-yellow-400 leading-tight mb-1">{activeBadgeInfo.title}</span>
                    <span className="text-[10px] leading-tight text-slate-200">{activeBadgeInfo.desc}</span>
                    
                    {/* Triangulito de globo de cómic */}
                    <div className="absolute top-full left-1/2 -translate-x-1/2 border-[6px] border-transparent border-t-slate-800"></div>
                </div>
            )}
        </div>
    );
};

export default WorldCupRanking;