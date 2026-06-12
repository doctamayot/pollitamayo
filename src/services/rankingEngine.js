import { db } from '../firebase';
import { collection, getDocs, doc, setDoc, getDoc } from 'firebase/firestore'; 
import { getWorldCupMatches } from './apiFootball';

// --- CONSTANTES COPIADAS DE TU RANKING ---
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

// 🟢 FUNCIÓN PRINCIPAL DE RECALCULO EN SEGUNDO PLANO
export const recalculateAndSaveRanking = async () => {
    console.log("⚙️ Ejecutando Motor de Ranking en segundo plano...");
    try {
        // 1. Obtener Datos
        let apiData = null;
        const cacheDoc = await getDoc(doc(db, 'worldCupAdmin', 'apiCache'));
        if (cacheDoc.exists() && cacheDoc.data().matches) {
            apiData = { matches: cacheDoc.data().matches };
        } else {
            apiData = await getWorldCupMatches();
        }
        const matches = apiData?.matches || [];

        const adminDoc = await getDoc(doc(db, 'worldCupAdmin', 'results'));
        const adminResults = adminDoc.exists() ? adminDoc.data() : null;

        const predsSnap = await getDocs(collection(db, 'worldCupPredictions'));
        const allPredictions = {};
        predsSnap.forEach(d => { allPredictions[d.id] = d.data(); });

        const usersSnap = await getDocs(collection(db, 'users'));
        const usersInfo = {};
        usersSnap.forEach(d => { usersInfo[d.id] = d.data(); });

        // 2. Procesar Matches
        const effectiveMatches = matches.map(m => {
            const simStatus = adminResults?.simulation?.matchStatuses?.[m.id];
            return (simStatus && simStatus !== '') ? { ...m, status: simStatus } : m;
        });

        const mergedAdminPreds = { ...(adminResults?.predictions || {}) };
        effectiveMatches.forEach(m => {
            const status = m.status || '';
            const hasO = (mergedAdminPreds[m.id] && mergedAdminPreds[m.id].home !== '' && mergedAdminPreds[m.id].away !== '') || status === 'FINISHED' || status.includes('PLAY');
            
            if (hasO) {
                if (mergedAdminPreds[m.id]?.home === undefined || mergedAdminPreds[m.id]?.home === '') {
                    if (m.score?.fullTime?.home !== null && m.score?.fullTime?.home !== undefined) {
                        mergedAdminPreds[m.id] = {
                            ...mergedAdminPreds[m.id],
                            home: m.score.fullTime.home,
                            away: m.score.fullTime.away
                        };
                    }
                }
            }
        });

        const officialMatches = effectiveMatches.filter(m => {
            const rH = mergedAdminPreds[m.id]?.home;
            const rA = mergedAdminPreds[m.id]?.away;
            const matchStatus = m.status || '';
            const hasOfficialAdminResult = (rH !== undefined && rH !== '' && rH !== null) && (rA !== undefined && rA !== '' && rA !== null);
            const isMatchActiveOrFinished = matchStatus === 'FINISHED' || matchStatus === 'IN_PLAY' || matchStatus === 'PAUSED';
            return hasOfficialAdminResult || isMatchActiveOrFinished;
        }).sort((a, b) => new Date(a.utcDate) - new Date(b.utcDate));

        // 3. Funciones Auxiliares Internas (Compute Standings)
        const groupStageMatches = effectiveMatches.filter(m => m.stage === 'GROUP_STAGE');
        const byGroup = groupStageMatches.reduce((acc, m) => {
            let g = m.group?.replace('GROUP_', 'Grupo ') || 'Fase de Grupos';
            if (!acc[g]) acc[g] = []; acc[g].push(m); return acc;
        }, {});

        const groupStatus = {};
        Object.keys(byGroup).forEach(g => {
            groupStatus[g] = byGroup[g].every(m => {
                const aPred = mergedAdminPreds?.[m.id];
                const hasAdminRes = aPred && aPred.home !== '' && aPred.away !== '' && aPred.home !== undefined && aPred.away !== undefined;
                return hasAdminRes || m.status === 'FINISHED';
            });
        });

        const computeStandings = (groupName, predsToUse, tiesToUse) => {
            if (!groupName || !byGroup[groupName]) return [];
            const groupMatches = byGroup[groupName];
            const teams = {};

            groupMatches.forEach(m => {
                const h = m.homeTeam?.name || 'Por definir'; const a = m.awayTeam?.name || 'Por definir';
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
                const groupTeams = groupedByPts[pts];
                finalFlattenedStandings.push(...resolveTie(groupTeams));
            });

            return finalFlattenedStandings;
        };

        let adminTop2 = []; let adminThirds = [];
        let allGroupsFinished = true;
        Object.keys(byGroup).forEach(g => {
            if (!groupStatus[g]) allGroupsFinished = false;
            if (groupStatus[g]) {
                const st = computeStandings(g, mergedAdminPreds, adminResults?.manualTiebreakers);
                if (st[0]) adminTop2.push(st[0]); if (st[1]) adminTop2.push(st[1]); if (st[2]) adminThirds.push(st[2]);
            }
        });
        
        let adminQualified32 = adminTop2;
        if (allGroupsFinished && adminTop2.length > 0) {
            adminThirds.sort((a, b) => b.pts - a.pts || b.dg - a.dg || b.gf - a.gf);
            adminQualified32 = [...adminTop2, ...adminThirds.slice(0, 8)];
        }

        // 4. Calcular Puntos para todos
        const ranks = [];
        Object.keys(allPredictions).forEach(uid => {
            const userData = allPredictions[uid];
            if (!userData.hasPaid || EXCLUDED_EMAILS.includes(userData.email)) return;

            const stats = { total: 0 };
            let ptsAcumulados = 0;

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

                    if (pH === realH && pA === realA) { ptsAcumulados += 5; }
                    else {
                        const pR = Math.sign(pH - pA); const rR = Math.sign(realH - realA);
                        if (pR === rR && (pH === realH || pA === realA)) ptsAcumulados += 3;
                        else if (pR === rR) ptsAcumulados += 2;
                        else if (pH === realH || pA === realA) ptsAcumulados += 1;
                    }
                }
            });

            let userTop2 = []; let userThirds = [];
            Object.keys(byGroup).forEach(g => {
                const groupMatches = byGroup[g];
                let predictedCount = 0;
                groupMatches.forEach(m => {
                    const p = userData.predictions?.[m.id];
                    if (p && p.home !== '' && p.home !== undefined && p.away !== '' && p.away !== undefined) predictedCount++;
                });

                if (predictedCount === 0) return;
                
                const uT = computeStandings(g, userData.predictions, userData.manualTiebreakers);
                if (uT[0]) userTop2.push(uT[0]); if (uT[1]) userTop2.push(uT[1]); if (uT[2]) userThirds.push(uT[2]);
                
                if (groupStatus[g] && predictedCount === groupMatches.length) {
                    const aT = computeStandings(g, mergedAdminPreds, adminResults?.manualTiebreakers);
                    if (uT.length >= 4 && aT.length >= 4 && uT[0].name === aT[0].name && uT[1].name === aT[1].name && uT[2].name === aT[2].name && uT[3].name === aT[3].name) {
                        ptsAcumulados += 8;
                    }
                }
            });
            
            userThirds.sort((a, b) => b.pts - a.pts || b.dg - a.dg || b.gf - a.gf);
            const userQualified32 = [...userTop2, ...userThirds.slice(0, 8)];

            if (adminQualified32.length > 0) {
                userQualified32.forEach(ut => {
                    if (adminQualified32.some(at => at.name === ut.name)) ptsAcumulados += 2;
                });
            }

            const koRounds = [
                { id: 'dieciseisavos', pts: 3 }, { id: 'octavos', pts: 4 },      
                { id: 'cuartos', pts: 5 }, { id: 'semis', pts: 6 }          
            ];

            koRounds.forEach(r => {
                const uTeams = userData.knockoutPicks?.[r.id] || [];
                const aTeams = adminResults?.knockoutPicks?.[r.id] || [];
                if (aTeams.length > 0) {
                    uTeams.forEach(ut => {
                        if (aTeams.some(at => at.name === ut.name)) ptsAcumulados += r.pts;
                    });
                }
            });

            const uThirdsList = getThirdPlaceTeams(userData.knockoutPicks);
            const aThirdsList = getThirdPlaceTeams(adminResults?.knockoutPicks);
            if (aThirdsList.length > 0) {
                uThirdsList.forEach(ut => {
                    if (ut && aThirdsList.some(at => at && at.name === ut.name)) ptsAcumulados += 4;
                });
            }

            extraQuestions.forEach(q => {
                const u = userData.extraPicks?.[q.id]; const a = adminResults?.extraPicks?.[q.id];
                if (u && a && (q.manual ? isSmartMatch(u, a) : u.toLowerCase() === a.toLowerCase())) ptsAcumulados += 6;
            });

            specialEvents.forEach(e => {
                let u = userData.eventPicks?.[e.id]; let a = adminResults?.eventPicks?.[e.id];
                if (u && a) {
                    u = String(u).toUpperCase().trim(); a = String(a).toUpperCase().trim();
                    if (a === u) ptsAcumulados += (u === 'SI' ? 5 : 2);
                }
            });

            const honorSlots = [{ id: 'campeon', pts: 10 }, { id: 'subcampeon', pts: 6 }, { id: 'tercero', pts: 6 }, { id: 'cuarto', pts: 6 }];
            honorSlots.forEach(s => {
                if (userData.knockoutPicks?.[s.id]?.[0]?.name === adminResults?.knockoutPicks?.[s.id]?.[0]?.name && adminResults?.knockoutPicks?.[s.id]?.[0]?.name) { ptsAcumulados += s.pts; }
            });
            
            let isSuperBono = false;
            if (adminResults?.knockoutPicks) {
                isSuperBono = honorSlots.every(s => userData.knockoutPicks?.[s.id]?.[0]?.name === adminResults.knockoutPicks[s.id]?.[0]?.name && adminResults.knockoutPicks[s.id]?.[0]?.name);
            }
            if (isSuperBono) ptsAcumulados += 10;

            stats.total = ptsAcumulados;
            ranks.push({ uid, ...stats });
        });

        // 5. Ordenar y Guardar en Firebase Directamente
        ranks.sort((a, b) => b.total - a.total);
        const pointsMap = {};
        ranks.forEach(u => { pointsMap[u.uid] = u.total; });

        await setDoc(doc(db, 'worldCupAdmin', 'liveRanking'), { points: pointsMap }, { merge: true });
        console.log("✅ Motor de Ranking finalizó exitosamente y guardó datos para la IA.");

    } catch (e) {
        console.error("❌ Error en el motor de ranking:", e);
    }
};