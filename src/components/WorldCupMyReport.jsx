import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { db } from '../firebase';
import { doc, onSnapshot, getDoc } from 'firebase/firestore';
import { getWorldCupMatches } from '../services/apiFootball';
import logocopa from '../assets/logocopa.png';
import { generateFullBracket } from '../services/bracketEngine';

// --- CONSTANTES Y DICCIONARIOS ---
const teamTranslations = {
    "Albania": "Albania", "Algeria": "Argelia", "Argentina": "Argentina", "Australia": "Australia", 
    "Austria": "Austria", "Belgium": "Bélgica", "Bolivia": "Bolivia", "Bosnia and Herzegovina": "Bosnia y Herzegovina",
    "Brazil": "Brasil", "Bulgaria": "Bulgaria", "Cameroon": "Camerún", "Canada": "Canadá", 
    "Chile": "Chile", "China": "China", "Colombia": "Colombia", "Costa Rica": "Costa Rica", 
    "Croatia": "Croacia", "Czechia": "República Checa", "Czech Republic": "República Checa", 
    "Denmark": "Dinamarca", "Ecuador": "Ecuador", "Egypt": "Egipto", "El Salvador": "El Salvador", 
    "England": "Inglaterra", "France": "Francia", "Germany": "Alemania", "Ghana": "Ghana", 
    "Greece": "Grecia", "Guatemala": "Guatemala", "Honduras": "Honduras", "Hungary": "Hungría", 
    "Iceland": "Islandia", "Island": "Islandia", "Iran": "Irán", "Ireland": "Irlanda", "Italy": "Italia", 
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

const matchStatusTranslations = {
    SCHEDULED: 'Programado', TIMED: 'Confirmado', IN_PLAY: 'En Juego', PAUSED: 'En Pausa',
    FINISHED: 'Finalizado', SUSPENDED: 'Suspendido', POSTPONED: 'Pospuesto', CANCELLED: 'Cancelado', AWARDED: 'Adjudicado'
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

const knockoutSubTabs = [
    { id: 'LAST_32', label: '16vos' },
    { id: 'LAST_16', label: 'Octavos' },
    { id: 'QUARTER_FINALS', label: 'Cuartos' },
    { id: 'SEMI_FINALS', label: 'Semis' },
    { id: 'FINALS', label: 'Finales' }
];

const extraQuestions = [
    { id: 'goleador', label: '1. Goleador', manual: true }, 
    { id: 'equipo_goleador', label: '2. Equipo Más Goleador' },
    { id: 'equipo_menos_goleador', label: '3. Equipo Menos Goleador' }, 
    { id: 'mas_amarillas', label: '4. Más Amarillas' },
    { id: 'mas_rojas', label: '5. Más Rojas' }, 
    { id: 'valla_menos_vencida', label: '6. Valla menos vencida' },
    { id: 'valla_mas_vencida', label: '7. Valla más vencida' }, 
    { id: 'grupo_mas_goles', label: '8. Grupo con más goles' },
    { id: 'grupo_menos_goles', label: '9. Grupo con menos goles' }, 
    { id: 'maximo_asistidor', label: '10. Máximo asistidor', manual: true },
    { id: 'atajapenales', label: '11. El Atajapenales', manual: true }
];

const specialEvents = [
    { id: 'gol_olimpico', label: 'Gol Olímpico' }, { id: 'remontada_epica', label: 'Remontada Épica (2+ goles)' },
    { id: 'el_festival', label: 'El Festival (8+ goles)' }, { id: 'muralla_final', label: 'Muralla en la Final (Penal atajado 90\')' },
    { id: 'hat_trick_hero', label: 'Hat-Trick Hero' }, { id: 'roja_banquillo', label: 'Roja al Banquillo (DT)' },
    { id: 'portero_goleador', label: 'El Portero Goleador' }, { id: 'debut_sin_red', label: 'Debut sin Red (0 goles totales)' },
    { id: 'leyenda_viva', label: 'Leyenda Viva (Messi/CR7 3+ goles)' }, { id: 'drama_final', label: 'Drama Final (Roja en la Final)' },
    { id: 'penales_final', label: 'Final en Penales' }
];

const translateTeam = (englishName) => teamTranslations[englishName] || englishName;

const isSmartMatch = (userText, adminText) => {
    if (!userText || !adminText) return false;
    const clean = (str) => str.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]/g, " ").replace(/\s+/g, " ").trim();
    const u = clean(userText);
    const a = clean(adminText);
    if (u === a) return true;
    if (u.length >= 4 && a.includes(u)) return true;
    if (a.length >= 4 && u.includes(a)) return true;
    const getLevenshtein = (s, t) => {
        if (!s.length) return t.length;
        if (!t.length) return s.length;
        const arr = [];
        for (let i = 0; i <= t.length; i++) { arr[i] = [i]; }
        for (let j = 0; j <= s.length; j++) { arr[0][j] = j; }
        for (let i = 1; i <= t.length; i++) {
            for (let j = 1; j <= s.length; j++) {
                if (t[i - 1] === s[j - 1]) {
                    arr[i][j] = arr[i - 1][j - 1];
                } else {
                    arr[i][j] = Math.min(arr[i - 1][j - 1] + 1, Math.min(arr[i][j - 1] + 1, arr[i - 1][j] + 1));
                }
            }
        }
        return arr[t.length][s.length];
    };
    const uWords = u.split(' ');
    const aWords = a.split(' ');
    for (const uWord of uWords) {
        if (uWord.length < 4) continue; 
        for (const aWord of aWords) {
            if (aWord.length < 4) continue;
            if (uWord === aWord) return true;
            const dist = getLevenshtein(uWord, aWord);
            const threshold = aWord.length > 5 ? 2 : 1; 
            if (dist <= threshold) return true;
        }
    }
    const uNoSpace = u.replace(/\s/g, '');
    const aNoSpace = a.replace(/\s/g, '');
    if (uNoSpace.length > 4 && aNoSpace.includes(uNoSpace)) return true;
    const distFull = getLevenshtein(uNoSpace, aNoSpace);
    const thresholdFull = aNoSpace.length > 8 ? 2 : 1;
    if (distFull <= thresholdFull) return true;
    return false;
};

// 🧠 FUNCIÓN HELPER CON MAGIA DEDUCTIVA PARA EL TERCER PUESTO
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

const WorldCupMyReport = ({ currentUser }) => {
    const isAdmin = currentUser?.email === 'doctamayot@gmail.com' || currentUser?.email === 'admin@polli-tamayo.com';
    const [matches, setMatches] = useState([]);
    const [matchesByGroup, setMatchesByGroup] = useState({});
    const [knockoutMatches, setKnockoutMatches] = useState({
        LAST_32: [], LAST_16: [], QUARTER_FINALS: [], SEMI_FINALS: [], FINALS: []
    });
    
    const [predictions, setPredictions] = useState({});
    const [knockoutPicks, setKnockoutPicks] = useState(null);
    const [extraPicks, setExtraPicks] = useState({});
    const [eventPicks, setEventPicks] = useState({});
    const [manualTiebreakers, setManualTiebreakers] = useState({});
    const [adminResults, setAdminResults] = useState(null);
    const [loading, setLoading] = useState(true);
    
    const [reportTab, setReportTab] = useState('partidos'); 
    const [matchFilter, setMatchFilter] = useState('ALL'); 
    const [selectedSubTab, setSelectedSubTab] = useState(''); 

    const subTabsRef = useRef(null);

    useEffect(() => {
        let unsubUser = () => {};
        let unsubAdmin = () => {};

        const fetchApiData = async () => {
            try {
                let data = null;

                if (isAdmin) {
                    // El admin llama a la API y actualiza el caché (por si acaso entra directo aquí)
                    data = await getWorldCupMatches();
                    /* (Opcional) No guardamos el caché aquí porque el Grid o Predictions ya lo hacen, 
                       pero usamos la API fresca para el admin */
                } else {
                    // Los usuarios mortales leen el caché de Firebase GRATIS
                    const cacheDoc = await getDoc(doc(db, 'worldCupAdmin', 'apiCache'));
                    if (cacheDoc.exists() && cacheDoc.data().matches) {
                        data = { matches: cacheDoc.data().matches };
                    } else {
                        // Solo si por algún milagro no hay caché, llaman a la API como emergencia
                        data = await getWorldCupMatches();
                    }
                }

                if (data && data.matches) {
                    setMatches(data.matches);

                    // Agrupar Fase de Grupos
                    const groupStageMatches = data.matches.filter(m => m.stage === 'GROUP_STAGE');
                    const grouped = groupStageMatches.reduce((acc, match) => {
                        let groupName = match.group || 'Fase de Grupos';
                        groupName = groupName.replace('GROUP_', 'Grupo ');
                        if (!acc[groupName]) acc[groupName] = [];
                        acc[groupName].push(match);
                        return acc;
                    }, {});
                    setMatchesByGroup(grouped);

                    // Agrupar Rondas Finales
                    const ko = { LAST_32: [], LAST_16: [], QUARTER_FINALS: [], SEMI_FINALS: [], FINALS: [] };
                    data.matches.forEach(match => {
                        if (match.stage === 'LAST_32' || match.stage === 'ROUND_OF_32') ko.LAST_32.push(match);
                        else if (match.stage === 'LAST_16') ko.LAST_16.push(match);
                        else if (match.stage === 'QUARTER_FINALS') ko.QUARTER_FINALS.push(match);
                        else if (match.stage === 'SEMI_FINALS') ko.SEMI_FINALS.push(match);
                        else if (match.stage === 'FINAL' || match.stage === 'THIRD_PLACE') ko.FINALS.push(match);
                    });
                    
                    Object.keys(ko).forEach(key => ko[key].sort((a, b) => Number(a.id) - Number(b.id)));
                    setKnockoutMatches(ko);
                }
            } catch (err) {
                console.error("Error al obtener partidos en Mi Polla:", err);
            } finally {
                setLoading(false);
            }
        };

        fetchApiData();

        if (currentUser) {
            const userRef = doc(db, 'worldCupPredictions', currentUser.uid);
            unsubUser = onSnapshot(userRef, (docSnap) => {
                if (docSnap.exists()) {
                    const savedData = docSnap.data();
                    if (savedData.predictions) setPredictions(savedData.predictions);
                    if (savedData.knockoutPicks) setKnockoutPicks(savedData.knockoutPicks);
                    if (savedData.extraPicks) setExtraPicks(savedData.extraPicks);
                    if (savedData.eventPicks) setEventPicks(savedData.eventPicks);
                    if (savedData.manualTiebreakers) setManualTiebreakers(savedData.manualTiebreakers);
                }
            });
        }

        const adminRef = doc(db, 'worldCupAdmin', 'results');
        unsubAdmin = onSnapshot(adminRef, (docSnap) => {
            if (docSnap.exists()) {
                setAdminResults(docSnap.data());
            } else {
                setAdminResults(null);
            }
        });

        return () => {
            unsubUser();
            unsubAdmin();
        };
    }, [currentUser]);

    useEffect(() => {
        if (Object.keys(matchesByGroup).length > 0 && selectedSubTab === '') {
            setSelectedSubTab(Object.keys(matchesByGroup).sort()[0]);
        }
    }, [matchesByGroup, selectedSubTab]);

    const allTeams = useMemo(() => {
        const teamsMap = new Map();
        matches.forEach(m => {
            if (m.homeTeam?.name && !m.homeTeam.name.includes('Winner') && !m.homeTeam.name.includes('Loser') && m.homeTeam.name !== 'TBD') {
                teamsMap.set(m.homeTeam.name, m.homeTeam);
            }
            if (m.awayTeam?.name && !m.awayTeam.name.includes('Winner') && !m.awayTeam.name.includes('Loser') && m.awayTeam.name !== 'TBD') {
                teamsMap.set(m.awayTeam.name, m.awayTeam);
            }
        });
        return Array.from(teamsMap.values());
    }, [matches]);

    const handleSubTabScroll = (direction) => {
        if (subTabsRef.current) {
            subTabsRef.current.scrollBy({ left: direction === 'left' ? -300 : 300, behavior: 'smooth' });
        }
    };

    const groupStatus = useMemo(() => {
        const status = {};
        let allFinished = true;
        Object.keys(matchesByGroup).forEach(g => {
            const groupMatches = matchesByGroup[g];
            const isGroupFinished = groupMatches.every(m => {
                const aPred = adminResults?.predictions?.[m.id];
                const hasAdminRes = aPred && aPred.home !== '' && aPred.away !== '';
                return hasAdminRes || m.status === 'FINISHED';
            });
            status[g] = isGroupFinished;
            if (!isGroupFinished) allFinished = false;
        });
        return { groups: status, allFinished }; 
    }, [matchesByGroup, adminResults]);

    // 🟢 LA CALCULADORA PODEROSA: Ahora Mi Polla también desempata perfectamente
    const calculateStandings = useCallback((groupName, predsToUse, tiesToUse) => {
        if (!groupName || !matchesByGroup[groupName]) return [];
        const groupMatches = matchesByGroup[groupName];
        const teams = {};

        groupMatches.forEach(m => {
            const h = m.homeTeam?.name || 'Por definir';
            const a = m.awayTeam?.name || 'Por definir';
            if (!teams[h]) teams[h] = { name: h, crest: m.homeTeam?.crest, pj: 0, pg: 0, pe: 0, pp: 0, gf: 0, gc: 0, dg: 0, pts: 0, isTied: false, tieOptions: [], tiedTeamNames: [] };
            if (!teams[a]) teams[a] = { name: a, crest: m.awayTeam?.crest, pj: 0, pg: 0, pe: 0, pp: 0, gf: 0, gc: 0, dg: 0, pts: 0, isTied: false, tieOptions: [], tiedTeamNames: [] };
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
                            const tNames = finalTied.map(t => t.name);
                            finalTied.forEach(t => {
                                t.isTrulyTied = true; 
                                t.tiedTeamNamesArray = tNames;
                            });
                            
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
        let currentRank = 1;

        sortedPtsKeys.forEach(pts => {
            const groupTeams = groupedByPts[pts];
            const resolved = resolveTie(groupTeams);

            let i = 0;
            while(i < resolved.length) {
                const t = resolved[i];
                if (t.isTrulyTied) {
                    const tiedBlockSize = t.tiedTeamNamesArray.length;
                    const availablePositions = [];
                    for(let k=0; k<tiedBlockSize; k++) { availablePositions.push(currentRank + k); }
                    
                    for(let k=0; k<tiedBlockSize; k++) {
                        const currT = resolved[i+k];
                        currT.isTied = currT.pj > 0; 
                        currT.tieOptions = currT.pj > 0 ? availablePositions : [];
                        currT.tiedTeamNames = currT.pj > 0 ? t.tiedTeamNamesArray : [];
                    }
                    currentRank += tiedBlockSize;
                    i += tiedBlockSize;
                } else {
                    t.isTied = false;
                    t.tieOptions = [];
                    t.tiedTeamNames = [];
                    currentRank += 1;
                    i++;
                }
            }
            finalFlattenedStandings.push(...resolved);
        });

        return finalFlattenedStandings;
    }, [matchesByGroup]);

    const isUserGroupStageComplete = useMemo(() => {
        const allGroupMatches = Object.values(matchesByGroup).flat();
        if (allGroupMatches.length === 0) return false;
        return allGroupMatches.every(m => 
            predictions?.[m.id]?.home !== undefined && predictions?.[m.id]?.home !== '' && 
            predictions?.[m.id]?.away !== undefined && predictions?.[m.id]?.away !== ''
        );
    }, [matchesByGroup, predictions]);


    const qualifiedRoundOf32 = useMemo(() => {
        if (!isUserGroupStageComplete) return { all32: [] }; 
        let top2 = [];
        let thirds = [];
        Object.keys(matchesByGroup).forEach(groupName => {
            const standings = calculateStandings(groupName, predictions, manualTiebreakers);
            if (standings.length > 0) top2.push({ ...standings[0], group: groupName, qualReason: '1º' });
            if (standings.length > 1) top2.push({ ...standings[1], group: groupName, qualReason: '2º' });
            if (standings.length > 2) thirds.push({ ...standings[2], group: groupName, qualReason: 'Mejor 3º' });
        });
        thirds.sort((a, b) => b.pts - a.pts || b.dg - a.dg || b.gf - a.gf);
        return { all32: [...top2, ...thirds.slice(0, 8)] };
    }, [matchesByGroup, predictions, manualTiebreakers, calculateStandings, isUserGroupStageComplete]);

    const adminQualifiedRoundOf32 = useMemo(() => {
        let top2 = [];
        let thirds = [];
        let allGroupsFinished = true;

        if (!adminResults?.predictions) return { all32: [] };

        Object.keys(matchesByGroup).forEach(groupName => {
            const groupMatches = matchesByGroup[groupName];
            const isGroupFinished = groupMatches.every(m => adminResults.predictions[m.id]?.home !== undefined && adminResults.predictions[m.id]?.home !== '');

            if (!isGroupFinished) allGroupsFinished = false;

            if (isGroupFinished) {
                const standings = calculateStandings(groupName, adminResults.predictions, adminResults.manualTiebreakers);
                if (standings.length > 0) top2.push({ ...standings[0], group: groupName, qualReason: '1º' });
                if (standings.length > 1) top2.push({ ...standings[1], group: groupName, qualReason: '2º' });
                if (standings.length > 2) thirds.push({ ...standings[2], group: groupName, qualReason: 'Mejor 3º' });
            }
        });

        if (allGroupsFinished && top2.length > 0) {
            thirds.sort((a, b) => b.pts - a.pts || b.dg - a.dg || b.gf - a.gf);
            return { all32: [...top2, ...thirds.slice(0, 8)] };
        }
        
        return { all32: top2 };
    }, [matchesByGroup, adminResults, calculateStandings]);

    // 🟢 EL BRACKET OFICIAL DEL ADMIN CON FANTASMAS: Garantiza la misma estructura en ambos lados
    const adminFullBracket = useMemo(() => {
        let teams = adminQualifiedRoundOf32?.all32 || [];
        
        if (teams.length < 32) {
            const tempTeams = [...teams];
            for (let i = tempTeams.length; i < 32; i++) {
                tempTeams.push({ name: `Por Definir ${i}`, isPlaceholder: true, group: 'Grupo TBD', qualReason: '-' });
            }
            teams = tempTeams;
        }

        const currentKOPicks = adminResults?.knockoutPicks || {};
        try {
            return generateFullBracket(teams, currentKOPicks);
        } catch (e) {
            console.error("Error armando bracket admin en mi reporte:", e);
            return null;
        }
    }, [adminQualifiedRoundOf32, adminResults?.knockoutPicks]);

    const calculateMatchPoints = (hasOfficialResult, userPred, realHome, realAway) => {
        if (!hasOfficialResult || !userPred || userPred.home === '' || userPred.away === '') return null;
        const pHome = parseInt(userPred.home, 10);
        const pAway = parseInt(userPred.away, 10);
        const rHome = parseInt(realHome, 10);
        const rAway = parseInt(realAway, 10);

        if (isNaN(rHome) || isNaN(rAway)) return null; 
        if (pHome === rHome && pAway === rAway) return 5; 
        
        const pResult = Math.sign(pHome - pAway);
        const rResult = Math.sign(rHome - rAway);
        const hitResult = pResult === rResult;
        const hitDigit = pHome === rHome || pAway === rAway;

        if (hitResult && hitDigit) return 3; 
        if (hitResult && !hitDigit) return 2; 
        if (!hitResult && hitDigit) return 1; 
        return 0; 
    };

    const checkSuperBonoTop4 = () => {
        if (!knockoutPicks || !adminResults?.knockoutPicks) return false;
        const slots = ['campeon', 'subcampeon', 'tercero', 'cuarto'];
        for (let slot of slots) {
            const uTeam = knockoutPicks[slot]?.[0]?.name;
            const aTeam = adminResults.knockoutPicks[slot]?.[0]?.name;
            if (!uTeam || !aTeam || uTeam !== aTeam) return false;
        }
        return true;
    };

    const totalPoints = useMemo(() => {
        let total = 0;

        matches.forEach(match => {
            const pred = predictions[match.id];
            const adminPred = adminResults?.predictions?.[match.id];
            const realHome = adminPred ? adminPred.home : match.score?.fullTime?.home;
            const realAway = adminPred ? adminPred.away : match.score?.fullTime?.away;
            const hasOfficialResult = (adminPred && adminPred.home !== '' && adminPred.away !== '') || match.status === 'FINISHED';
            
            const pts = calculateMatchPoints(hasOfficialResult, pred, realHome, realAway);
            if (pts) total += pts;
        });

        Object.keys(matchesByGroup).forEach(groupName => {
            if (groupStatus.groups[groupName]) {
                const groupMatches = matchesByGroup[groupName];
                const predictedCount = groupMatches.filter(m => predictions[m.id]?.home !== undefined && predictions[m.id]?.home !== '').length;

                if (predictedCount === groupMatches.length) {
                    const userTable = calculateStandings(groupName, predictions, manualTiebreakers).map(t => t.name);
                    const adminTable = calculateStandings(groupName, adminResults?.predictions, adminResults?.manualTiebreakers).map(t => t.name);
                    
                    const isPleno = userTable.length >= 4 && adminTable.length >= 4 && 
                                    userTable[0] === adminTable[0] && userTable[1] === adminTable[1] &&
                                    userTable[2] === adminTable[2] && userTable[3] === adminTable[3];
                    
                    if (isPleno) total += 8;
                }
            }
        });

        if (adminQualifiedRoundOf32.all32.length > 0) {
            qualifiedRoundOf32.all32.forEach(ut => {
                if (adminQualifiedRoundOf32.all32.some(at => at.name === ut.name)) total += 2;
            });
        }

        knockoutPicks?.dieciseisavos?.forEach(ut => {
            if (adminResults?.knockoutPicks?.dieciseisavos?.some(at => at.name === ut.name)) total += 3;
        });

        knockoutPicks?.octavos?.forEach(ut => {
            if (adminResults?.knockoutPicks?.octavos?.some(at => at.name === ut.name)) total += 4;
        });

        knockoutPicks?.cuartos?.forEach(ut => {
            if (adminResults?.knockoutPicks?.cuartos?.some(at => at.name === ut.name)) total += 5;
        });

        knockoutPicks?.semis?.forEach(ut => {
            if (adminResults?.knockoutPicks?.semis?.some(at => at.name === ut.name)) total += 6;
        });

        const uThirds = getThirdPlaceTeams(knockoutPicks);
        const aThirds = getThirdPlaceTeams(adminResults?.knockoutPicks);
        
        if (aThirds.length > 0) {
            uThirds.forEach(ut => {
                if (aThirds.some(at => at.name === ut.name)) total += 4;
            });
        }

        const honorSlots = [
            { id: 'campeon', pts: 10 }, { id: 'subcampeon', pts: 6 },
            { id: 'tercero', pts: 6 }, { id: 'cuarto', pts: 6 }
        ];
        honorSlots.forEach(slot => {
            const uTeam = knockoutPicks?.[slot.id]?.[0]?.name;
            const aTeam = adminResults?.knockoutPicks?.[slot.id]?.[0]?.name;
            if (uTeam && aTeam && uTeam === aTeam) total += slot.pts;
        });

        if (checkSuperBonoTop4()) total += 10;

        extraQuestions.forEach(q => {
            const answer = extraPicks?.[q.id];
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
            let answer = eventPicks?.[e.id];
            let officialAnswer = adminResults?.eventPicks?.[e.id];
            
            if (answer && officialAnswer) {
                answer = String(answer).toUpperCase().trim();
                officialAnswer = String(officialAnswer).toUpperCase().trim();
                
                if (officialAnswer === answer) {
                    total += answer === 'SI' ? 5 : 2;
                }
            }
        });

        return total;
    }, [matches, predictions, matchesByGroup, manualTiebreakers, knockoutPicks, extraPicks, eventPicks, adminResults, qualifiedRoundOf32, adminQualifiedRoundOf32, groupStatus, calculateStandings]);

    const subTabPoints = useMemo(() => {
        if (!selectedSubTab) return 0;

        let pts = 0;
        const matchesInTab = selectedSubTab.startsWith('Grupo') 
            ? (matchesByGroup[selectedSubTab] || [])
            : (knockoutMatches[selectedSubTab] || []);

        matchesInTab.forEach(match => {
            const pred = predictions[match.id];
            const adminPred = adminResults?.predictions?.[match.id];
            const realHome = adminPred ? adminPred.home : match.score?.fullTime?.home;
            const realAway = adminPred ? adminPred.away : match.score?.fullTime?.away;
            const hasOfficialResult = (adminPred && adminPred.home !== '' && adminPred.away !== '') || match.status === 'FINISHED';
            
            const mPts = calculateMatchPoints(hasOfficialResult, pred, realHome, realAway);
            if (mPts) pts += mPts;
        });

        if (selectedSubTab.startsWith('Grupo') && groupStatus.groups[selectedSubTab]) {
            const groupMatches = matchesByGroup[selectedSubTab];
            const predictedCount = groupMatches.filter(m => predictions[m.id]?.home !== undefined && predictions[m.id]?.home !== '').length;

            if (predictedCount === groupMatches.length) {
                const userTable = calculateStandings(selectedSubTab, predictions, manualTiebreakers).map(t => t.name);
                const adminTable = calculateStandings(selectedSubTab, adminResults?.predictions, adminResults?.manualTiebreakers).map(t => t.name);
                
                const isPleno = userTable.length >= 4 && adminTable.length >= 4 && 
                                userTable[0] === adminTable[0] && userTable[1] === adminTable[1] &&
                                userTable[2] === adminTable[2] && userTable[3] === adminTable[3];
                if (isPleno) pts += 8;
            }
        }

        if (selectedSubTab === 'LAST_32' && adminQualifiedRoundOf32.all32.length > 0) {
            qualifiedRoundOf32.all32.forEach(ut => {
                if (adminQualifiedRoundOf32.all32.some(at => at.name === ut.name)) pts += 2;
            });
        }

        return pts;
    }, [selectedSubTab, matchesByGroup, knockoutMatches, predictions, adminResults, groupStatus, calculateStandings, manualTiebreakers, qualifiedRoundOf32, adminQualifiedRoundOf32]);

    const displayedMatches = useMemo(() => {
        let filtered = [];

        if (selectedSubTab) {
            if (selectedSubTab.startsWith('Grupo')) {
                filtered = matchesByGroup[selectedSubTab] || [];
            } else {
                filtered = knockoutMatches[selectedSubTab] || [];
            }
        }

        if (matchFilter === 'FINISHED') {
            filtered = filtered.filter(m => {
                const adminPred = adminResults?.predictions?.[m.id];
                const hasAdminResult = adminPred && adminPred.home !== '' && adminPred.away !== '';
                return hasAdminResult || m.status === 'FINISHED';
            });
            return filtered.sort((a, b) => new Date(b.utcDate) - new Date(a.utcDate));
        }
        
        if (matchFilter === 'PENDING') {
            filtered = filtered.filter(m => {
                const adminPred = adminResults?.predictions?.[m.id];
                const hasAdminResult = adminPred && adminPred.home !== '' && adminPred.away !== '';
                return !hasAdminResult && m.status !== 'FINISHED';
            });
            return filtered.sort((a, b) => new Date(a.utcDate) - new Date(b.utcDate));
        }
        
        return filtered.sort((a, b) => new Date(a.utcDate) - new Date(b.utcDate));
    }, [matchesByGroup, knockoutMatches, matchFilter, adminResults, selectedSubTab]);

    if (loading) {
        return (
            <div className="flex flex-col items-center justify-center py-20">
                <div className="w-16 h-16 border-4 border-primary border-t-transparent rounded-full animate-spin mb-4"></div>
                <p className="text-foreground-muted font-bold tracking-widest uppercase text-sm">Generando Reporte Oficial...</p>
            </div>
        );
    }

    return (
        <div className="max-w-5xl mx-auto pb-24 animate-fade-in">
            
            <div className="bg-gradient-to-br from-slate-900 to-slate-800 dark:from-background-offset dark:to-card rounded-[2.5rem] p-8 sm:p-10 mb-8 relative overflow-hidden shadow-xl border border-border">
                <img src={logocopa} alt="" className="absolute -right-10 -bottom-10 w-64 h-64 object-contain opacity-[0.05] pointer-events-none z-0 rotate-12" />
                <div className="relative z-10 flex flex-col items-center text-center">
                    <img src={currentUser.photoURL} alt="Perfil" className="w-20 h-20 rounded-full border-4 border-primary shadow-lg mb-4" />
                    <h2 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tighter mb-2">Mi Polla Mundialista</h2>
                    <p className="text-primary font-bold tracking-widest uppercase text-xs sm:text-sm">Reporte Oficial de Predicciones y Puntos</p>
                    
                    <div className="mt-5 bg-background/20 backdrop-blur-md border border-white/10 px-8 py-3 rounded-full flex items-center gap-3 shadow-lg transform hover:scale-105 transition-transform">
                        <span className="text-amber-400 text-2xl sm:text-3xl drop-shadow-md">🏆</span>
                        <div className="flex items-baseline gap-1.5">
                            <span className="text-4xl sm:text-5xl font-black text-white drop-shadow-md">{totalPoints}</span>
                            <span className="text-xs sm:text-sm font-bold text-white/80 uppercase tracking-widest">PTS Totales</span>
                        </div>
                    </div>
                </div>
            </div>

            <div className="flex w-full justify-between sm:justify-center gap-2 mb-8 pb-2 border-b border-border overflow-x-auto hide-scrollbar">
                {[
                    { id: 'partidos', label: 'Partidos', icon: '⚽' },
                    { id: 'rondas', label: 'Cuadro & Rondas', icon: '🏆' },
                    { id: 'extras', label: 'Extras & Eventos', icon: '⭐' }
                ].map(tab => (
                    <button 
                        key={tab.id} onClick={() => setReportTab(tab.id)}
                        className={`flex flex-col sm:flex-row items-center justify-center gap-1 sm:gap-2 px-4 py-3 rounded-2xl font-bold transition-all whitespace-nowrap ${reportTab === tab.id ? 'bg-primary text-primary-foreground shadow-md' : 'bg-card text-foreground-muted border border-card-border hover:bg-background-offset'}`}
                    >
                        <span className="text-xl sm:text-base">{tab.icon}</span>
                        <span className="text-[10px] sm:text-sm uppercase sm:normal-case tracking-tighter sm:tracking-normal">{tab.label}</span>
                    </button>
                ))}
            </div>

            {/* TAB 1: PARTIDOS */}
            {reportTab === 'partidos' && (
                <div className="animate-fade-in">
                    
                    {/* SELECTOR HORIZONTAL DE GRUPOS Y RONDAS */}
                    <div className="relative w-full mb-6 flex items-center group">
                        <button onClick={() => handleSubTabScroll('left')} className="absolute left-0 z-20 bg-card border border-border text-foreground p-1.5 rounded-full shadow-lg hidden md:flex hover:bg-primary hover:text-white transition-all ml-0">
                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-4 h-4"><path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" /></svg>
                        </button>

                        <div ref={subTabsRef} className="flex overflow-x-auto hide-scrollbar gap-2 sm:gap-3 pb-4 pt-2 px-2 md:px-10 snap-x scroll-smooth items-center w-full">

                            {Object.keys(matchesByGroup).sort((a,b)=>a.localeCompare(b)).map(gn => {
                                const isSelected = selectedSubTab === gn;
                                return (
                                    <button 
                                        key={gn} onClick={() => setSelectedSubTab(gn)} 
                                        className={`snap-center shrink-0 flex flex-col items-center justify-center min-w-[70px] sm:min-w-[85px] h-14 sm:h-16 rounded-[1rem] font-black transition-all border ${
                                            isSelected ? 'bg-gradient-to-b from-primary to-amber-600 text-white border-transparent scale-105 z-10' : 'bg-card text-foreground-muted hover:bg-background-offset'
                                        }`}
                                    >
                                        <span className="text-xs sm:text-base tracking-widest">{gn.replace('Grupo ', '')}</span>
                                        <span className={`text-[8px] sm:text-[9px] uppercase tracking-widest opacity-70 mt-0.5 ${isSelected ? 'text-white' : ''}`}>Grupo</span>
                                    </button>
                                );
                            })}
                            
                            <div className="w-px h-10 bg-gradient-to-b from-transparent via-border to-transparent mx-2 sm:mx-4 shrink-0"></div>
                            
                            {knockoutSubTabs.map(ko => {
                                const isSelected = selectedSubTab === ko.id;
                                return (
                                    <button 
                                        key={ko.id} onClick={() => setSelectedSubTab(ko.id)} 
                                        className={`snap-center shrink-0 flex items-center justify-center px-4 sm:px-6 h-14 sm:h-16 rounded-[1rem] font-black transition-all border ${
                                            isSelected ? 'bg-gradient-to-br from-indigo-500 to-purple-600 text-white border-transparent scale-105 z-10' : 'bg-card text-foreground-muted hover:bg-background-offset'
                                        }`}
                                    >
                                        <span className="text-[10px] sm:text-xs uppercase tracking-widest">{ko.label}</span>
                                    </button>
                                );
                            })}
                        </div>

                        <button onClick={() => handleSubTabScroll('right')} className="absolute right-0 z-20 bg-card border border-border text-foreground p-1.5 rounded-full shadow-lg hidden md:flex hover:bg-primary hover:text-white transition-all mr-0">
                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-4 h-4"><path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" /></svg>
                        </button>
                    </div>

                    {/* INSIGNIA DE PUNTOS TOTALES PARA LA SUB-PESTAÑA */}
                    {selectedSubTab && (
                        <div className="flex justify-center mb-6 animate-fade-in">
                            <div className="bg-primary/10 border border-primary/30 px-6 py-2 rounded-2xl flex items-center gap-3 shadow-sm">
                                <span className="text-xl">🏆</span>
                                <div className="flex flex-col">
                                    <span className="text-[10px] font-bold text-primary uppercase tracking-widest leading-none">
                                        Puntos en {selectedSubTab.startsWith('Grupo') ? selectedSubTab : knockoutSubTabs.find(k => k.id === selectedSubTab)?.label}
                                    </span>
                                    <span className="text-xl font-black text-foreground leading-none mt-1">{subTabPoints} PTS</span>
                                </div>
                            </div>
                        </div>
                    )}

                    <div className="flex justify-center gap-2 mb-8">
                        {[
                            { id: 'ALL', label: 'Todos' }, 
                            { id: 'PENDING', label: 'Por Jugar' }, 
                            { id: 'FINISHED', label: 'Ya Jugados' }
                        ].map(f => (
                            <button 
                                key={f.id} onClick={() => setMatchFilter(f.id)}
                                className={`px-5 py-2 rounded-full font-bold text-xs sm:text-sm transition-all ${matchFilter === f.id ? 'bg-foreground text-background shadow-md' : 'bg-card border border-border text-foreground-muted hover:border-foreground/50'}`}
                            >
                                {f.label}
                            </button>
                        ))}
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
                        {displayedMatches.map((match, index) => {
                            const pred = predictions[match.id];
                            const hasPred = pred && pred.home !== '' && pred.away !== '';
                            const isFinished = match.status === 'FINISHED';
                            const isLive = match.status === 'IN_PLAY' || match.status === 'PAUSED';
                            
                            const adminPred = adminResults?.predictions?.[match.id];
                            const realHome = adminPred ? adminPred.home : match.score?.fullTime?.home;
                            const realAway = adminPred ? adminPred.away : match.score?.fullTime?.away;
                            
                            const hasOfficialResult = (adminPred && adminPred.home !== '' && adminPred.away !== '') || isFinished;
                            const points = calculateMatchPoints(hasOfficialResult, pred, realHome, realAway);

                            const isKnockout = match.stage !== 'GROUP_STAGE';
                            const homeOriginal = match.homeTeam?.name || '';
                            const awayOriginal = match.awayTeam?.name || '';

                            const customHome = adminPred?.customHomeTeam || '';
                            const customAway = adminPred?.customAwayTeam || '';

                            let finalHomeName = '';
                            let finalAwayName = '';
                            let isTeamDrawnFromBracket = false;

                            if (isKnockout) {
                                let roundKey = '';
                                let currentStageArray = [];

                                if (match.stage === 'LAST_32' || match.stage === 'ROUND_OF_32') { roundKey = 'dieciseisavos'; currentStageArray = knockoutMatches.LAST_32; }
                                else if (match.stage === 'LAST_16') { roundKey = 'octavos'; currentStageArray = knockoutMatches.LAST_16; }
                                else if (match.stage === 'QUARTER_FINALS') { roundKey = 'cuartos'; currentStageArray = knockoutMatches.QUARTER_FINALS; }
                                else if (match.stage === 'SEMI_FINALS') { roundKey = 'semis'; currentStageArray = knockoutMatches.SEMI_FINALS; }
                                else if (match.stage === 'FINAL') { roundKey = 'final'; currentStageArray = knockoutMatches.FINALS; }
                                else if (match.stage === 'THIRD_PLACE') { roundKey = 'tercero'; currentStageArray = knockoutMatches.FINALS; }

                                let bracketHome = null;
                                let bracketAway = null;

                                if (roundKey && adminFullBracket && adminFullBracket[roundKey]) {
                                    let bMatch;
                                    if (roundKey === 'final' || roundKey === 'tercero') {
                                        bMatch = Object.values(adminFullBracket[roundKey])[0];
                                    } else {
                                        const sortedStageMatches = [...currentStageArray].sort((a, b) => Number(a.id) - Number(b.id));
                                        const absoluteIndex = sortedStageMatches.findIndex(m => String(m.id) === String(match.id));
                                        
                                        const bracketMatchValues = Object.keys(adminFullBracket[roundKey])
                                            .sort((a, b) => {
                                                const numA = parseInt(a.replace(/\D/g, '')) || 0;
                                                const numB = parseInt(b.replace(/\D/g, '')) || 0;
                                                return numA - numB;
                                            })
                                            .map(k => adminFullBracket[roundKey][k]);
                                        
                                        bMatch = bracketMatchValues[absoluteIndex >= 0 ? absoluteIndex : 0]; 
                                    }
                                    
                                    if (bMatch) {
                                        bracketHome = bMatch.home && !bMatch.home.isPlaceholder ? bMatch.home.name : null;
                                        bracketAway = bMatch.away && !bMatch.away.isPlaceholder ? bMatch.away.name : null;
                                    }
                                }

                                finalHomeName = customHome || bracketHome || '';
                                finalAwayName = customAway || bracketAway || '';
                                if (bracketHome || bracketAway || customHome || customAway) isTeamDrawnFromBracket = true;

                            } else {
                                const isUnknownHome = !homeOriginal || homeOriginal === 'TBD' || homeOriginal.includes('Winner') || homeOriginal.includes('Loser');
                                const isUnknownAway = !awayOriginal || awayOriginal === 'TBD' || awayOriginal.includes('Winner') || awayOriginal.includes('Loser');
                                
                                finalHomeName = customHome || (!isUnknownHome ? homeOriginal : '');
                                finalAwayName = customAway || (!isUnknownAway ? awayOriginal : '');
                            }

                            const homeCrest = allTeams.find(t => t.name === finalHomeName)?.crest || (!isKnockout && finalHomeName ? match.homeTeam?.crest : null);
                            const awayCrest = allTeams.find(t => t.name === finalAwayName)?.crest || (!isKnockout && finalAwayName ? match.awayTeam?.crest : null);

                            return (
                                <div key={match.id} className="bg-card border border-card-border rounded-2xl p-4 sm:p-5 shadow-sm relative overflow-hidden flex flex-col">
                                    <div className="flex justify-between items-center mb-4 pb-3 border-b border-border/50">
                                        <div className="flex items-center gap-2">
                                            <span className="text-[10px] font-black text-background bg-foreground px-2 py-0.5 rounded uppercase tracking-wider shadow-sm">
                                                {match.group ? match.group.replace('GROUP_', 'Grupo ') : stageTranslations[match.stage] || match.stage?.replace(/_/g, ' ') || 'Fase'}
                                            </span>
                                            <span className={`text-[9px] sm:text-[10px] font-bold uppercase tracking-wider ${isLive ? 'text-green-500 animate-pulse' : isFinished ? 'text-foreground-muted' : 'text-amber-500'}`}>
                                                {matchStatusTranslations[match.status] || match.status}
                                            </span>
                                        </div>
                                        <div className="flex items-center gap-3">
                                            {points !== null && (
                                                <span className={`text-[10px] sm:text-xs font-black px-2 py-1 rounded-full shadow-sm border ${
                                                    points === 5 ? 'bg-green-500/10 text-green-500 border-green-500/30' : 
                                                    points === 3 ? 'bg-blue-500/10 text-blue-500 border-blue-500/30' : 
                                                    points === 2 ? 'bg-yellow-500/10 text-yellow-600 border-yellow-500/30' : 
                                                    points === 1 ? 'bg-orange-500/10 text-orange-500 border-orange-500/30' : 
                                                    'bg-red-500/10 text-red-500 border-red-500/30'
                                                }`}>
                                                    {points > 0 ? `+${points}` : '0'} PTS
                                                </span>
                                            )}
                                        </div>
                                    </div>

                                    <div className="flex flex-col">
                                        <div className="flex justify-end gap-2 sm:gap-6 mb-2 pr-1 sm:pr-2">
                                            <div className="w-10 sm:w-16 text-center"><span className="text-[9px] sm:text-[10px] font-black uppercase text-primary tracking-widest">Apuesta</span></div>
                                            <div className="w-10 sm:w-16 text-center"><span className="text-[9px] sm:text-[10px] font-black uppercase text-foreground-muted tracking-widest">Real</span></div>
                                        </div>

                                        <div className="bg-background-offset rounded-xl border border-border overflow-hidden">
                                            <div className="flex items-center justify-between p-2 sm:p-3 border-b border-border/50">
                                                <div className="flex items-center gap-2 sm:gap-3 overflow-hidden pr-2 flex-1">
                                                    <div className="w-6 h-4 sm:w-8 sm:h-5 bg-background rounded-[2px] overflow-hidden border border-border/50 shrink-0 flex items-center justify-center">
                                                        {homeCrest ? <img src={homeCrest} className="w-full h-full object-cover" alt="" /> : <span className="opacity-30 text-[10px]">🛡️</span>}
                                                    </div>
                                                    <div className="flex flex-col truncate">
                                                        <span className={`font-bold text-sm sm:text-base truncate ${!finalHomeName ? 'text-foreground-muted italic' : 'text-foreground'}`}>
                                                            {finalHomeName ? translateTeam(finalHomeName) : 'Por Definir'}
                                                        </span>
                                                        {isTeamDrawnFromBracket && finalHomeName && (
                                                            <span className="text-[8px] font-bold text-amber-500 uppercase opacity-90 tracking-widest mt-0.5">Dato Oficial</span>
                                                        )}
                                                    </div>
                                                </div>
                                                <div className="flex gap-2 sm:gap-6 shrink-0">
                                                    <div className="w-10 sm:w-16 flex justify-center"><span className="font-black text-lg sm:text-xl text-primary">{hasPred ? pred.home : '-'}</span></div>
                                                    <div className="w-10 sm:w-16 flex justify-center border-l border-border/50"><span className={`font-black text-lg sm:text-xl ${(hasOfficialResult || isLive) ? 'text-foreground' : 'text-foreground-muted opacity-50'}`}>{(hasOfficialResult || isLive) ? (realHome ?? 0) : '-'}</span></div>
                                                </div>
                                            </div>

                                            <div className="flex items-center justify-between p-2 sm:p-3">
                                                <div className="flex items-center gap-2 sm:gap-3 overflow-hidden pr-2 flex-1">
                                                    <div className="w-6 h-4 sm:w-8 sm:h-5 bg-background rounded-[2px] overflow-hidden border border-border/50 shrink-0 flex items-center justify-center">
                                                        {awayCrest ? <img src={awayCrest} className="w-full h-full object-cover" alt="" /> : <span className="opacity-30 text-[10px]">🛡️</span>}
                                                    </div>
                                                    <div className="flex flex-col truncate">
                                                        <span className={`font-bold text-sm sm:text-base truncate ${!finalAwayName ? 'text-foreground-muted italic' : 'text-foreground'}`}>
                                                            {finalAwayName ? translateTeam(finalAwayName) : 'Por Definir'}
                                                        </span>
                                                        {isTeamDrawnFromBracket && finalAwayName && (
                                                            <span className="text-[8px] font-bold text-amber-500 uppercase opacity-90 tracking-widest mt-0.5">Dato Oficial</span>
                                                        )}
                                                    </div>
                                                </div>
                                                <div className="flex gap-2 sm:gap-6 shrink-0">
                                                    <div className="w-10 sm:w-16 flex justify-center"><span className="font-black text-lg sm:text-xl text-primary">{hasPred ? pred.away : '-'}</span></div>
                                                    <div className="w-10 sm:w-16 flex justify-center border-l border-border/50"><span className={`font-black text-lg sm:text-xl ${(hasOfficialResult || isLive) ? 'text-foreground' : 'text-foreground-muted opacity-50'}`}>{(hasOfficialResult || isLive) ? (realAway ?? 0) : '-'}</span></div>
                                                </div>
                                            </div>
                                        </div>

                                        {!hasPred && (
                                            <div className="text-center text-[10px] sm:text-xs text-red-500 font-bold mt-3 bg-red-500/10 py-1.5 rounded-md border border-red-500/20">
                                                ⚠️ No pronosticaste este partido
                                            </div>
                                        )}
                                        <div className="mt-3 text-center sm:hidden">
                                            <span className="text-[9px] text-foreground-muted font-semibold uppercase tracking-wider">
                                                {new Date(match.utcDate).toLocaleDateString('es-ES', { day: '2-digit', month: 'short', hour:'2-digit', minute:'2-digit' })}
                                            </span>
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                        {displayedMatches.length === 0 && <div className="text-center py-10 bg-card rounded-2xl border border-card-border col-span-full"><p className="text-foreground-muted font-bold text-sm">No hay partidos en esta categoría.</p></div>}
                    </div>
                </div>
            )}

            {/* TAB 2: CUADRO DE HONOR Y RONDAS */}
            {reportTab === 'rondas' && knockoutPicks && (
                <div className="animate-fade-in space-y-10">
                    
                    {checkSuperBonoTop4() && (
                        <div className="bg-gradient-to-r from-yellow-400 via-yellow-500 to-yellow-600 rounded-2xl p-6 shadow-[0_10px_30px_rgba(234,179,8,0.4)] flex flex-col sm:flex-row items-center justify-between gap-4 border border-yellow-300 transform hover:scale-[1.02] transition-transform">
                            <div className="flex items-center gap-4">
                                <span className="text-5xl drop-shadow-md">🏆</span>
                                <div>
                                    <h3 className="text-xl font-black text-white drop-shadow-md uppercase tracking-widest">¡Súper Bono Top 4!</h3>
                                    <p className="text-yellow-100 font-bold text-sm">Acertaste el orden exacto del podio mundial.</p>
                                </div>
                            </div>
                            <span className="bg-white text-yellow-600 font-black text-2xl px-6 py-2 rounded-xl shadow-inner">+10 PTS</span>
                        </div>
                    )}

                    <div>
                        <h3 className="text-2xl font-black text-foreground mb-6 flex items-center gap-3 border-b border-border pb-2">
                            <span>👑</span> Cuadro de Honor
                        </h3>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                            {[
                                { id: 'campeon', title: 'Campeón', icon: '🥇', bg: 'from-yellow-300 to-yellow-600', text: 'text-yellow-600', pts: 10 },
                                { id: 'subcampeon', title: 'Subcampeón', icon: '🥈', bg: 'from-slate-300 to-slate-500', text: 'text-slate-500', pts: 6 },
                                { id: 'tercero', title: 'Tercer Puesto', icon: '🥉', bg: 'from-orange-400 to-orange-700', text: 'text-orange-600', pts: 6 },
                                { id: 'cuarto', title: 'Cuarto Puesto', icon: '🎖️', bg: 'from-blue-400 to-blue-600', text: 'text-blue-500', pts: 6 }
                            ].map(podio => {
                                const userTeam = knockoutPicks[podio.id]?.[0];
                                const officialTeam = adminResults?.knockoutPicks?.[podio.id]?.[0];
                                const isExactHit = officialTeam && userTeam && officialTeam.name === userTeam.name;

                                const isFinalistSlot = podio.id === 'campeon' || podio.id === 'subcampeon';
                                const isThirdMatchSlot = podio.id === 'tercero' || podio.id === 'cuarto';
                                
                                let reachedPoints = 0;
                                let reachedLabel = '';
                                let isReachedHit = false;
                                let isPendingReached = false;

                                if (isFinalistSlot) {
                                    const aFinalists = [...(adminResults?.knockoutPicks?.campeon || []), ...(adminResults?.knockoutPicks?.subcampeon || [])];
                                    isPendingReached = aFinalists.length === 0;
                                    if (userTeam && aFinalists.some(t => t.name === userTeam.name)) {
                                        isReachedHit = true;
                                        reachedPoints = 6;
                                        reachedLabel = 'Finalista';
                                    }
                                } else if (isThirdMatchSlot) {
                                    const aThirds = [...(adminResults?.knockoutPicks?.tercero || []), ...(adminResults?.knockoutPicks?.cuarto || [])];
                                    isPendingReached = aThirds.length === 0;
                                    if (userTeam && aThirds.some(t => t.name === userTeam.name)) {
                                        isReachedHit = true;
                                        reachedPoints = 4;
                                        reachedLabel = '3er/4to';
                                    }
                                }

                                return (
                                    <div key={podio.id} className={`bg-gradient-to-br ${podio.bg} p-1 rounded-2xl shadow-lg transform hover:-translate-y-1 transition-transform relative`}>
                                        <div className="bg-card h-full rounded-xl p-4 flex flex-col items-center text-center relative">
                                            <div className="text-3xl mb-2">{podio.icon}</div>
                                            <h4 className={`text-[10px] font-black uppercase ${podio.text} tracking-widest mb-3`}>{podio.title}</h4>
                                            
                                            {userTeam ? (
                                                <>
                                                    <div className={`w-12 h-8 bg-background rounded-[4px] overflow-hidden shadow-sm border border-border/50 mb-2 shrink-0 ${(!isPendingReached && !isReachedHit) ? 'grayscale opacity-50' : ''}`}>
                                                        <img src={userTeam.crest} className="w-full h-full object-cover" alt="" />
                                                    </div>
                                                    <span className={`font-bold text-sm leading-tight mb-2 ${(!isPendingReached && !isReachedHit) ? 'text-foreground-muted line-through' : 'text-foreground'}`}>
                                                        {translateTeam(userTeam.name)}
                                                    </span>
                                                    
                                                    <div className="w-full mt-auto pt-2 border-t border-border/50 min-h-[46px] flex flex-col items-center justify-center gap-1">
                                                        {isPendingReached ? (
                                                            <span className="text-[10px] font-bold text-amber-500 italic">En Juego...</span>
                                                        ) : (
                                                            <>
                                                                {isReachedHit ? (
                                                                    <span className="text-[9px] font-bold text-blue-500">Llega a {reachedLabel} (+{reachedPoints} pts)</span>
                                                                ) : (
                                                                    <span className="text-[9px] font-bold text-red-500/70 line-through">Llega a {reachedLabel}</span>
                                                                )}

                                                                {isExactHit ? (
                                                                    <span className="text-[10px] font-black text-green-500 uppercase">Puesto Exacto (+{podio.pts} pts)</span>
                                                                ) : (
                                                                    <div className="flex items-center gap-1 justify-center w-full mt-0.5 bg-red-500/10 px-1 py-0.5 rounded">
                                                                        <span className="text-[8px] text-red-500 uppercase font-black">Real:</span>
                                                                        <span className="text-[9px] font-bold text-red-500 truncate">{officialTeam ? translateTeam(officialTeam.name) : '-'}</span>
                                                                    </div>
                                                                )}
                                                            </>
                                                        )}
                                                    </div>
                                                </>
                                            ) : (<span className="text-xs text-foreground-muted italic">Sin Selección</span>)}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>

                    <div>
                        <h3 className="text-2xl font-black text-foreground mb-6 flex items-center gap-3 border-b border-border pb-2">
                            <span>🔥</span> Plenos de Grupo <span className="text-sm font-normal text-foreground-muted">(+8 pts c/u)</span>
                        </h3>
                        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
                            {Object.keys(matchesByGroup).sort().map(groupName => {
                                const isGroupFinished = groupStatus.groups[groupName]; 
                                const groupMatches = matchesByGroup[groupName];

                                let predictedCount = 0;
                                groupMatches.forEach(m => {
                                    if (predictions[m.id]?.home !== undefined && predictions[m.id]?.home !== '') {
                                        predictedCount++;
                                    }
                                });

                                const userTableData = predictedCount > 0 ? calculateStandings(groupName, predictions, manualTiebreakers) : [];
                                const userTableNames = userTableData.map(t => t.name);
                                
                                const adminTableNames = calculateStandings(groupName, adminResults?.predictions, adminResults?.manualTiebreakers).map(t => t.name);
                                
                                const isPleno = isGroupFinished && predictedCount === groupMatches.length && adminTableNames.length >= 4 && userTableNames.length >= 4 && 
                                                userTableNames[0] === adminTableNames[0] && userTableNames[1] === adminTableNames[1] &&
                                                userTableNames[2] === adminTableNames[2] && userTableNames[3] === adminTableNames[3];
                                
                                return (
                                    <div key={groupName} className={`bg-card border ${isGroupFinished && isPleno ? 'border-primary shadow-[0_0_15px_rgba(245,158,11,0.3)]' : 'border-card-border'} p-4 rounded-xl relative flex flex-col justify-between`}>
                                        {isGroupFinished && isPleno && <div className="absolute -top-3 -right-2 bg-primary text-background font-black text-[10px] px-2 py-1 rounded shadow-md">+8 PTS</div>}
                                        
                                        <h4 className="font-bold text-sm text-foreground-muted uppercase tracking-widest mb-3 text-center">{groupName}</h4>
                                        
                                        <div className="space-y-1.5 mb-3 flex-grow">
                                            {userTableData.slice(0, 4).map((team, idx) => (
                                                <div key={idx} className="flex items-center gap-2">
                                                    <span className={`text-[10px] font-bold w-3 text-center ${idx < 2 ? 'text-green-500' : 'text-foreground-muted'}`}>{idx + 1}</span>
                                                    <img src={team.crest} className="w-4 h-3 object-cover rounded-sm border border-border/50 shrink-0" alt="" />
                                                    <span className="text-xs font-semibold text-foreground truncate">{translateTeam(team.name)}</span>
                                                </div>
                                            ))}
                                            {userTableData.length === 0 && <span className="text-xs text-foreground-muted italic block text-center">Sin pronósticos</span>}
                                        </div>

                                        <div className="text-center pt-2 border-t border-border/50 mt-auto">
                                            {predictedCount === 0 ? (
                                                <span className="text-[10px] font-bold text-red-500 bg-red-500/10 px-2 py-0.5 rounded border border-red-500/20">❌ Sin Llenar</span>
                                            ) : isGroupFinished ? (
                                                isPleno ? (
                                                    <span className="text-xs font-black text-green-500 uppercase tracking-widest">¡Pleno! 🎯</span>
                                                ) : (
                                                    <span className="text-[10px] font-bold text-red-500 bg-red-500/10 px-2 py-0.5 rounded border border-red-500/20">❌ Fallado</span>
                                                )
                                            ) : (
                                                <span className="text-[10px] text-amber-500 font-bold italic">⏳ En juego...</span>
                                            )}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>

                    {/* --- 🔧 MAPEO PROGRESIVO DE LAS RONDAS DEL BRACKET --- */}
                    <div>
                        <h3 className="text-2xl font-black text-foreground mb-6 flex items-center gap-3 border-b border-border pb-2">
                            <span>📈</span> Camino a la Gloria
                        </h3>
                        <div className="space-y-6">
                            {[
                                { id: 'finalistas', label: 'Clasificados a la Final (2)', pts: 6 },
                                { id: 'tercer_puesto', label: 'Juegan por 3er Puesto (2)', pts: 4 }, 
                                { id: 'semis_partido', label: 'Clasificados a Semis (4)', pts: 5 },
                                { id: 'cuartos_partido', label: 'Clasificados a Cuartos (8)', pts: 4 },
                                { id: 'octavos_partido', label: 'Clasificados a Octavos (16)', pts: 3 },
                                { id: 'dieciseisavos_partido', label: 'Clasificados a 16vos (32)', pts: 2 }
                            ].map(round => {
                                let roundTeams = [];
                                let officialRoundTeams = [];
                                let hasOfficialData = false;

                                if (round.id === 'dieciseisavos_partido') {
                                    roundTeams = qualifiedRoundOf32.all32;
                                    officialRoundTeams = adminQualifiedRoundOf32.all32;
                                    hasOfficialData = officialRoundTeams.length > 0; // 🟢 PROGRESIVO: Ya no exige groupStatus.allFinished
                                } else if (round.id === 'octavos_partido') {
                                    roundTeams = knockoutPicks?.dieciseisavos || [];
                                    officialRoundTeams = adminResults?.knockoutPicks?.dieciseisavos || [];
                                    hasOfficialData = officialRoundTeams.length > 0;
                                } else if (round.id === 'cuartos_partido') {
                                    roundTeams = knockoutPicks?.octavos || [];
                                    officialRoundTeams = adminResults?.knockoutPicks?.octavos || [];
                                    hasOfficialData = officialRoundTeams.length > 0;
                                } else if (round.id === 'semis_partido') {
                                    roundTeams = knockoutPicks?.cuartos || [];
                                    officialRoundTeams = adminResults?.knockoutPicks?.cuartos || [];
                                    hasOfficialData = officialRoundTeams.length > 0;
                                } else if (round.id === 'finalistas') {
                                    roundTeams = knockoutPicks?.semis || [];
                                    officialRoundTeams = adminResults?.knockoutPicks?.semis || [];
                                    hasOfficialData = officialRoundTeams.length > 0;
                                } else if (round.id === 'tercer_puesto') {
                                    roundTeams = getThirdPlaceTeams(knockoutPicks);
                                    officialRoundTeams = getThirdPlaceTeams(adminResults?.knockoutPicks);
                                    hasOfficialData = officialRoundTeams.length > 0;
                                }
                                
                                const roundPoints = round.pts;

                                return (
                                    <div key={round.id} className="bg-background-offset border border-border rounded-3xl p-5 sm:p-8 shadow-sm">
                                        <div className="flex items-center justify-between mb-4">
                                            <h4 className="text-sm font-black text-primary uppercase tracking-widest">
                                                {round.label} <span className="text-foreground-muted text-xs ml-2">({roundTeams.length})</span>
                                            </h4>
                                        </div>
                                        
                                        {roundTeams.length > 0 ? (
                                            <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-3 sm:gap-4">
                                                {roundTeams.map((team, idx) => {
                                                    const isHit = officialRoundTeams.some(ot => ot.name === team.name);

                                                    return (
                                                        <div key={idx} className={`bg-card border ${hasOfficialData && isHit ? 'border-green-500 shadow-[0_0_10px_rgba(34,197,94,0.2)]' : 'border-card-border'} p-3 rounded-xl flex flex-col items-center text-center shadow-sm relative h-full`}>
                                                            
                                                            {hasOfficialData && isHit && (
                                                                <div className="absolute -top-2 -right-2 bg-green-500 text-white text-[9px] font-black w-5 h-5 flex items-center justify-center rounded-full shadow-md z-10">+{roundPoints}</div>
                                                            )}
                                                            {hasOfficialData && !isHit && round.id !== 'dieciseisavos_partido' && (
                                                                <div className="absolute -top-2 -right-2 bg-red-500 text-white text-[9px] font-black w-5 h-5 flex items-center justify-center rounded-full shadow-md z-10">❌</div>
                                                            )}
                                                            {/* 🟢 Para 16vos progresivo, si no está en la lista oficial pero aún faltan grupos por cerrar, NO pongas la X */}
                                                            {hasOfficialData && !isHit && round.id === 'dieciseisavos_partido' && groupStatus.allFinished && (
                                                                <div className="absolute -top-2 -right-2 bg-red-500 text-white text-[9px] font-black w-5 h-5 flex items-center justify-center rounded-full shadow-md z-10">❌</div>
                                                            )}
                                                            
                                                            <div className={`w-10 h-6 sm:w-12 sm:h-8 bg-background rounded-[3px] overflow-hidden shadow-sm border border-border/50 mb-2 shrink-0 ${hasOfficialData && !isHit && (round.id !== 'dieciseisavos_partido' || groupStatus.allFinished) ? 'grayscale opacity-50' : ''}`}>
                                                                <img src={team.crest} className="w-full h-full object-cover" alt="" />
                                                            </div>
                                                            
                                                            <span className={`font-bold text-[10px] sm:text-xs leading-tight flex-grow flex items-center justify-center ${hasOfficialData && !isHit && (round.id !== 'dieciseisavos_partido' || groupStatus.allFinished) ? 'text-foreground-muted line-through' : 'text-foreground'}`}>
                                                                {translateTeam(team.name)}
                                                            </span>

                                                            {(!hasOfficialData || (round.id === 'dieciseisavos_partido' && !isHit && !groupStatus.allFinished)) && (
                                                                <span className="mt-2 text-[8px] sm:text-[9px] font-bold text-amber-500 italic">En Juego</span>
                                                            )}
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        ) : (<p className="text-foreground-muted text-sm italic">No seleccionaste equipos para esta ronda.</p>)}
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </div>
            )}

            {/* 3. EXTRAS & EVENTOS */}
            {reportTab === 'extras' && (
                <div className="animate-fade-in space-y-10">
                    <div>
                        <h3 className="text-2xl font-black text-foreground mb-6 flex items-center gap-3 border-b border-border pb-2">
                            <span>⭐</span> Predicciones Extras <span className="text-sm font-normal text-foreground-muted">(6 pts c/u)</span>
                        </h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            {extraQuestions.map(q => {
                                const answer = extraPicks[q.id];
                                const officialAnswer = adminResults?.extraPicks?.[q.id];
                                
                                const isHit = officialAnswer && answer && (q.manual ? isSmartMatch(answer, officialAnswer) : answer.toLowerCase() === officialAnswer.toLowerCase());

                                return (
                                    <div key={q.id} className={`bg-card border ${isHit ? 'border-green-500' : officialAnswer ? 'border-red-500/50' : 'border-card-border'} rounded-2xl p-4 sm:p-5 shadow-sm flex flex-col relative`}>
                                        {isHit && <div className="absolute top-2 right-2 bg-green-500 text-white text-[9px] font-black px-1.5 py-0.5 rounded shadow-sm">+6 pts</div>}
                                        
                                        <h4 className="text-xs text-foreground-muted font-bold uppercase tracking-wider mb-2 pr-8">{q.label}</h4>
                                        {answer ? (
                                            <p className={`text-lg font-black leading-tight break-words mb-2 ${isHit ? 'text-green-500' : officialAnswer ? 'text-foreground-muted line-through' : 'text-primary'}`}>{translateTeam(answer)}</p>
                                        ) : (<p className="text-sm text-red-500 font-semibold italic mb-2">Sin respuesta</p>)}
                                        
                                        {officialAnswer && !isHit && (
                                            <div className="mt-auto pt-2 border-t border-border/50">
                                                <span className="text-[9px] text-foreground-muted uppercase tracking-widest block mb-0.5">Real:</span>
                                                <span className="text-sm font-bold text-foreground">{translateTeam(officialAnswer)}</span>
                                            </div>
                                        )}
                                        {!officialAnswer && (
                                            <div className="mt-auto pt-2 border-t border-border/50">
                                                <span className="text-[9px] text-amber-500 italic block mb-0.5">En Juego...</span>
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    </div>

                    <div>
                        <h3 className="text-2xl font-black text-foreground mb-6 flex items-center gap-3 border-b border-border pb-2">
                            <span>❓</span> Eventos Especiales <span className="text-sm font-normal text-foreground-muted">(SÍ: 5 pts | NO: 2 pts)</span>
                        </h3>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            {specialEvents.map(e => {
                                let answer = eventPicks[e.id];
                                let officialAnswer = adminResults?.eventPicks?.[e.id];
                                
                                if (answer) answer = String(answer).toUpperCase().trim();
                                if (officialAnswer) officialAnswer = String(officialAnswer).toUpperCase().trim();

                                const isHit = officialAnswer && answer && officialAnswer === answer;
                                const pts = answer === 'SI' ? 5 : 2;

                                return (
                                    <div key={e.id} className={`bg-background-offset border ${isHit ? 'border-green-500' : officialAnswer ? 'border-red-500/50' : 'border-border'} rounded-2xl p-4 shadow-sm flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 relative`}>
                                        <span className="text-sm font-bold text-foreground pr-8">{e.label}</span>
                                        
                                        <div className="flex flex-col items-end shrink-0 w-full sm:w-auto">
                                            {answer ? (
                                                <span className={`px-4 py-1.5 rounded-lg text-xs font-black text-white shadow-sm w-full sm:w-auto text-center ${isHit ? 'bg-green-500' : officialAnswer ? 'bg-foreground-muted opacity-50' : answer === 'SI' ? 'bg-primary' : 'bg-red-500'}`}>
                                                    MI APUESTA: {answer}
                                                </span>
                                            ) : (<span className="text-xs text-red-500 font-semibold italic">Vacío</span>)}
                                            
                                            {officialAnswer ? (
                                                <div className="mt-2 text-right w-full">
                                                    {isHit ? (
                                                        <span className="text-xs font-black text-green-500 block">✅ +{pts} pts</span>
                                                    ) : (
                                                        <span className="text-[10px] font-black uppercase text-red-500 block bg-red-500/10 px-2 py-0.5 rounded border border-red-500/20">REAL: {officialAnswer}</span>
                                                    )}
                                                </div>
                                            ) : (
                                                <div className="mt-2 text-right w-full">
                                                    <span className="text-[10px] text-amber-500 italic block">En Juego...</span>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default WorldCupMyReport;