import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { db } from '../firebase'; 
import { doc, setDoc, getDoc, onSnapshot } from 'firebase/firestore';
import { getWorldCupMatches } from '../services/apiFootball';
import toast from 'react-hot-toast'; 
import logocopa from '../assets/logocopa.png';
import StatsBanner from './StatsBanner';
import NewsTicker from './shared/NewsTicker'

import { generateFullBracket } from '../services/bracketEngine'; 

import { 
    translateTeam, 
    extraQuestions, 
    specialEvents, 
    knockoutSubTabs 
} from './worldcupcomponents/constants';
import AdminPanel from './worldcupcomponents/AdminPanel';
import StandingsTable from './worldcupcomponents/StandingsTable';
import ExtrasTab from './worldcupcomponents/ExtrasTab';
import EventsTab from './worldcupcomponents/EventsTab';
import KnockoutTab from './worldcupcomponents/KnockoutTab';
import MatchCard from './worldcupcomponents/MatchCard';
import StatusWarnings from './worldcupcomponents/StatusWarning';
import WorldCupCountdown from './worldcupcomponents/WorldCupCountdown';

const WorldCupPredictions = ({ currentUser }) => {
    const isAdmin = currentUser.email === 'doctamayot@gmail.com' || currentUser.email === 'admin@polli-tamayo.com';

    // ESTADOS
    const [activePhase, setActivePhase] = useState('GROUP_STAGE'); 
    const [activeTab, setActiveTab] = useState('partidos');
    const [adminResults, setAdminResults] = useState(null);
    const [matchesByGroup, setMatchesByGroup] = useState({});
    const [knockoutMatches, setKnockoutMatches] = useState({
        LAST_32: [], LAST_16: [], QUARTER_FINALS: [], SEMI_FINALS: [], FINALS: []
    });
    const [selectedSubTab, setSelectedSubTab] = useState(null); 
    const [predictions, setPredictions] = useState({});
    const [knockoutPicks, setKnockoutPicks] = useState({
        dieciseisavos: [], octavos: [], cuartos: [], semis: [], campeon: [], subcampeon: [], tercero: [], cuarto: []
    });
    const [extraPicks, setExtraPicks] = useState({});
    const [eventPicks, setEventPicks] = useState({});
    const [manualTiebreakers, setManualTiebreakers] = useState({});
    const [lockedMatches, setLockedMatches] = useState({}); 
    const [isAutoSyncActive, setIsAutoSyncActive] = useState(false); 
    const [predictionsClosed, setPredictionsClosed] = useState(false); 
    
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [hasPaid, setHasPaid] = useState(false);
    const [activeRoundTab, setActiveRoundTab] = useState('dieciseisavos');

    const subTabsRef = useRef(null);
    const roundTabsRef = useRef(null);
    const lastSyncTime = useRef(0);
    const apiFetchedRef = useRef(false); 

    const tabs = [
        { id: 'partidos', label: 'Marcadores', icon: '⚽', linkedPhase: 'GROUP_STAGE' },
        { id: 'rondas', label: 'Clasificados', icon: '📈', linkedPhase: 'GROUP_STAGE' },
        { id: 'extras', label: 'Extras', icon: '⭐', linkedPhase: 'GROUP_STAGE' },
        { id: 'eventos', label: 'Eventos', icon: '❓', linkedPhase: 'GROUP_STAGE' }
    ];

    useEffect(() => {
        const fetchMatchesAndData = async () => {
            try {
                let data = null;

                if (isAdmin) {
                    data = await getWorldCupMatches();
                    console.log("llamando api")
                    if (data && data.matches) {
                        await setDoc(doc(db, 'worldCupAdmin', 'apiCache'), { matches: data.matches }, { merge: true });
                    }
                } else {
                    const cacheDoc = await getDoc(doc(db, 'worldCupAdmin', 'apiCache'));
                    if (cacheDoc.exists() && cacheDoc.data().matches) {
                        data = { matches: cacheDoc.data().matches };
                    } else {
                        data = await getWorldCupMatches();
                    }
                }

                if (!data || !data.matches) return;

                const groupedGroups = {};
                const ko = { LAST_32: [], LAST_16: [], QUARTER_FINALS: [], SEMI_FINALS: [], FINALS: [] };

                data.matches.forEach(match => {
                    if (match.stage === 'GROUP_STAGE') {
                        let groupName = match.group || 'Fase de Grupos';
                        groupName = groupName.replace('GROUP_', 'Grupo ');
                        if (!groupedGroups[groupName]) groupedGroups[groupName] = [];
                        groupedGroups[groupName].push(match);
                    } 
                    else if (match.stage === 'LAST_32' || match.stage === 'ROUND_OF_32') ko.LAST_32.push(match);
                    else if (match.stage === 'LAST_16') ko.LAST_16.push(match);
                    else if (match.stage === 'QUARTER_FINALS') ko.QUARTER_FINALS.push(match);
                    else if (match.stage === 'SEMI_FINALS') ko.SEMI_FINALS.push(match);
                    else if (match.stage === 'FINAL' || match.stage === 'THIRD_PLACE') ko.FINALS.push(match);
                });

                Object.keys(groupedGroups).forEach(key => groupedGroups[key].sort((a, b) => new Date(a.utcDate) - new Date(b.utcDate)));
                Object.keys(ko).forEach(key => ko[key].sort((a, b) => new Date(a.utcDate) - new Date(b.utcDate)));

                setMatchesByGroup(groupedGroups);
                setKnockoutMatches(ko);

                if (currentUser) {
                    const docRef = isAdmin ? doc(db, 'worldCupAdmin', 'results') : doc(db, 'worldCupPredictions', currentUser.uid);
                    const docSnap = await getDoc(docRef);
                    if (docSnap.exists()) {
                        const savedData = docSnap.data();
                        if (savedData.predictions) setPredictions(savedData.predictions);
                        if (savedData.knockoutPicks) setKnockoutPicks(savedData.knockoutPicks);
                        if (savedData.extraPicks) setExtraPicks(savedData.extraPicks);
                        if (savedData.eventPicks) setEventPicks(savedData.eventPicks);
                        if (savedData.manualTiebreakers) setManualTiebreakers(savedData.manualTiebreakers);
                        if (savedData.lockedMatches) setLockedMatches(savedData.lockedMatches); 
                    }
                }
            } catch (err) {
                console.error(err);
                toast.error("Error al cargar datos del servidor");
            } finally {
                setLoading(false);
            }
        };

        if (!apiFetchedRef.current) {
            apiFetchedRef.current = true;
            fetchMatchesAndData();
        }
    }, [currentUser, isAdmin]);

    useEffect(() => {
        const unsubSettings = onSnapshot(doc(db, 'worldCupAdmin', 'settings'), (docSnap) => {
            if (docSnap.exists()) {
                setPredictionsClosed(!!docSnap.data().predictionsClosed);
            }
        });
        return () => unsubSettings();
    }, []);

    const isKnockoutPhaseActive = activePhase !== 'GROUP_STAGE' && activePhase !== 'ALL_OPEN';

    const orderedSubTabs = useMemo(() => {
        const groupTabs = Object.keys(matchesByGroup).sort((a,b)=>a.localeCompare(b)).map(gn => ({
            id: gn, type: 'group', label: gn.replace('Grupo ', '')
        }));
        
        if (isKnockoutPhaseActive) {
            return [
                ...knockoutSubTabs.map(k => ({...k, type: 'knockout'})),
                { type: 'divider', id: 'div1' },
                ...groupTabs
            ];
        } else {
            return [
                ...groupTabs, 
                { type: 'divider', id: 'div1' }, 
                ...knockoutSubTabs.map(k => ({...k, type: 'knockout'}))
            ];
        }
    }, [matchesByGroup, isKnockoutPhaseActive]);

   useEffect(() => {
        const validKnockoutPhases = ['LAST_32', 'LAST_16', 'QUARTER_FINALS', 'SEMI_FINALS', 'FINALS'];

        if (activePhase === 'ALL_OPEN') {
            setSelectedSubTab('FINALS');
        } else if (isKnockoutPhaseActive) {
            if (validKnockoutPhases.includes(activePhase)) {
                setSelectedSubTab(activePhase);
            } else {
                setSelectedSubTab('FINALS');
            }
        } else if (Object.keys(matchesByGroup).length > 0 && (!selectedSubTab || !selectedSubTab.startsWith('Grupo'))) {
            setSelectedSubTab(Object.keys(matchesByGroup).sort((a, b) => a.localeCompare(b))[0]); 
        }
    }, [activePhase, matchesByGroup, isKnockoutPhaseActive]);

    useEffect(() => {
        if (selectedSubTab && selectedSubTab !== 'ALL' && subTabsRef.current) {
            setTimeout(() => {
                const tabElement = document.getElementById(`subtab-${selectedSubTab}`);
                if (tabElement && subTabsRef.current) {
                    const scrollLeft = tabElement.offsetLeft - (subTabsRef.current.offsetWidth / 2) + (tabElement.offsetWidth / 2);
                    subTabsRef.current.scrollTo({ left: scrollLeft, behavior: 'smooth' });
                }
            }, 150); 
        }
    }, [selectedSubTab, orderedSubTabs]); 

    useEffect(() => {
        if (!isAdmin || !isAutoSyncActive) return;

        const performAutoSync = async () => {
            const now = Date.now();
            if (now - lastSyncTime.current < 14000) return;
            lastSyncTime.current = now;

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
                    setPredictions(dbPreds); 
                    toast.success('⚽ ¡Auto-Sync: Marcadores sincronizados con la API!', { id: 'autosync-toast' });
                   
                }
            } catch (error) {
                console.error("❌ Error en Auto-Sync:", error);
            }
        };

        performAutoSync();
        const intervalId = setInterval(performAutoSync, 15000);
         
        return () => clearInterval(intervalId);        
    }, [isAdmin, isAutoSyncActive]);

    useEffect(() => {
        if (!currentUser || isAdmin) return;
        const unsubUser = onSnapshot(doc(db, 'worldCupPredictions', currentUser.uid), (docSnap) => {
            if (docSnap.exists()) setHasPaid(!!docSnap.data().hasPaid);
        });
        return () => unsubUser();
        
    }, [currentUser, isAdmin]);

    useEffect(() => {
        const unsubAdmin = onSnapshot(doc(db, 'worldCupAdmin', 'results'), (docSnap) => {
            if (docSnap.exists()) {
                setAdminResults(docSnap.data());
                if (docSnap.data().activePhase) setActivePhase(docSnap.data().activePhase);
               
            }
        });
        return () => unsubAdmin();
    }, []);

    const isSubTabLocked = useCallback((subTab) => {
        if (isAdmin || activePhase === 'ALL_OPEN') return false;
        if (predictionsClosed && subTab && subTab.startsWith('Grupo')) return true;
        if (!subTab) return true;
        if (subTab.startsWith('Grupo')) return activePhase !== 'GROUP_STAGE';
        return activePhase !== subTab;
    }, [activePhase, isAdmin, predictionsClosed]);

    const isCurrentMainTabLocked = useMemo(() => {
        if (isAdmin || activePhase === 'ALL_OPEN') return false; 
        if (predictionsClosed && (activeTab === 'extras' || activeTab === 'eventos' || activeTab === 'rondas')) return true;
        if (activeTab === 'partidos') return false; 
        return activePhase !== 'GROUP_STAGE'; 
    }, [activeTab, activePhase, isAdmin, predictionsClosed]);

    const allTeams = useMemo(() => {
        const teamsMap = new Map();
        Object.values(matchesByGroup).flat().forEach(m => {
            if (m.homeTeam?.name && m.homeTeam.name !== 'Por definir') teamsMap.set(m.homeTeam.name, m.homeTeam);
            if (m.awayTeam?.name && m.awayTeam.name !== 'Por definir') teamsMap.set(m.awayTeam.name, m.awayTeam);
        });
        return Array.from(teamsMap.values()).sort((a, b) => translateTeam(a.name).localeCompare(translateTeam(b.name)));
    }, [matchesByGroup]);


    // 🟢 SUPER CALCULADORA UNIFICADA: Esta función ahora sirve para Usuarios y para el Admin
    const computeStandings = useCallback((groupName, currentPreds, currentTies) => {
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
            const pred = currentPreds[m.id];
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
                    const pred = currentPreds[m.id];
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
                                const tieA = currentTies[groupName]?.[a.name] || 99;
                                const tieB = currentTies[groupName]?.[b.name] || 99;
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

    const currentGroupStandings = useMemo(() => {
        if (!selectedSubTab || !selectedSubTab.startsWith('Grupo')) return [];
        return computeStandings(selectedSubTab, predictions, manualTiebreakers);
    }, [computeStandings, selectedSubTab, predictions, manualTiebreakers]);

    const hasTiesInGroup = useMemo(() => currentGroupStandings.some(t => t.isTied), [currentGroupStandings]);

    const isGroupStageComplete = useMemo(() => {
        const allGroupMatches = Object.values(matchesByGroup).flat();
        if (allGroupMatches.length === 0) return false;
        return allGroupMatches.every(m => 
            predictions[m.id]?.home !== undefined && predictions[m.id]?.home !== '' && 
            predictions[m.id]?.away !== undefined && predictions[m.id]?.away !== ''
        );
    }, [matchesByGroup, predictions]);

    const isAdminGroupStageComplete = useMemo(() => {
        const allGroupMatches = Object.values(matchesByGroup).flat();
        if (allGroupMatches.length === 0) return false;
        return allGroupMatches.every(m => 
            adminResults?.predictions?.[m.id]?.home !== undefined && adminResults?.predictions?.[m.id]?.home !== '' && 
            adminResults?.predictions?.[m.id]?.away !== undefined && adminResults?.predictions?.[m.id]?.away !== ''
        );
    }, [matchesByGroup, adminResults]);

    // 🟢 MOTOR PROGRESIVO DEL ADMIN PARA CLASIFICADOS A 16VOS
    const adminQualified32 = useMemo(() => {
        const adminPreds = adminResults?.predictions || {};
        const adminTies = adminResults?.manualTiebreakers || {};
        
        let top2 = []; 
        let thirds = [];
        let allGroupsFinished = true;

        Object.keys(matchesByGroup).forEach(groupName => {
            const groupMatches = matchesByGroup[groupName] || [];
            
            const isThisGroupComplete = groupMatches.length > 0 && groupMatches.every(m =>
                adminPreds[m.id]?.home !== undefined && adminPreds[m.id]?.home !== '' &&
                adminPreds[m.id]?.away !== undefined && adminPreds[m.id]?.away !== ''
            );

            if (!isThisGroupComplete) {
                allGroupsFinished = false; 
            }

            if (isThisGroupComplete) {
                const standings = computeStandings(groupName, adminPreds, adminTies);
                if (standings.length > 0) top2.push({ ...standings[0], group: groupName, qualReason: '1º' });
                if (standings.length > 1) top2.push({ ...standings[1], group: groupName, qualReason: '2º' });
                if (standings.length > 2) thirds.push({ ...standings[2], group: groupName, qualReason: 'Mejor 3º' });
            }
        });

        if (allGroupsFinished && top2.length > 0) {
            thirds.sort((a, b) => b.pts - a.pts || b.dg - a.dg || b.gf - a.gf);
            return [...top2, ...thirds.slice(0, 8)];
        } else {
            return top2; 
        }
    }, [matchesByGroup, adminResults, computeStandings]);

    // 🟢 MOTOR PROGRESIVO DE LAS PREDICCIONES DEL USUARIO
    const qualifiedRoundOf32 = useMemo(() => {
        let top2 = []; 
        let thirds = [];
        let allGroupsFinished = true;

        Object.keys(matchesByGroup).forEach(groupName => {
            const groupMatches = matchesByGroup[groupName] || [];
            
            const isThisGroupComplete = groupMatches.length > 0 && groupMatches.every(m =>
                predictions[m.id]?.home !== undefined && predictions[m.id]?.home !== '' &&
                predictions[m.id]?.away !== undefined && predictions[m.id]?.away !== ''
            );

            if (!isThisGroupComplete) {
                allGroupsFinished = false;
            }

            if (isThisGroupComplete) {
                const standings = computeStandings(groupName, predictions, manualTiebreakers);
                if (standings.length > 0) top2.push({ ...standings[0], group: groupName, qualReason: '1º' });
                if (standings.length > 1) top2.push({ ...standings[1], group: groupName, qualReason: '2º' });
                if (standings.length > 2) thirds.push({ ...standings[2], group: groupName, qualReason: 'Mejor 3º' });
            }
        });

        if (allGroupsFinished && top2.length > 0) {
            thirds.sort((a, b) => b.pts - a.pts || b.dg - a.dg || b.gf - a.gf);
            return { all32: [...top2, ...thirds.slice(0, 8)] };
        } else {
            return { all32: top2 }; 
        }
    }, [matchesByGroup, predictions, manualTiebreakers, computeStandings]);

    // 🟢 BRACKET OFICIAL DEL ADMIN CON FANTASMAS (Evita el error en octavos)
    const adminFullBracket = useMemo(() => {
        let teams = adminQualified32 || [];
        
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
            console.error("Error armando bracket admin:", e);
            return null;
        }
    }, [adminQualified32, adminResults?.knockoutPicks]);

    const getAvailableTeamsForRound = useCallback((roundId) => {
        switch(roundId) {
            case 'dieciseisavos': case 'LAST_32': case 'octavos': return qualifiedRoundOf32.all32;
            case 'LAST_16': case 'cuartos': return knockoutPicks.octavos || [];
            case 'QUARTER_FINALS': case 'semis': return knockoutPicks.cuartos || [];
            case 'SEMI_FINALS': case 'campeon': case 'subcampeon': case 'FINALS': return knockoutPicks.semis || [];
            case 'tercero': case 'cuarto': {
                const semifinalistas = knockoutPicks.cuartos || []; 
                const finalistas = knockoutPicks.semis || [];       
                return semifinalistas.filter(st => !finalistas.some(ft => ft.name === st.name));
            }
            default: return [];
        }
    }, [qualifiedRoundOf32, knockoutPicks]);

    const missingSections = useMemo(() => {
        if (isAdmin) return [];
        const missing = [];

        if (activePhase === 'GROUP_STAGE' || activePhase === 'ALL_OPEN') {
            const allGroupMatches = Object.values(matchesByGroup).flat();
            const predictedGroups = allGroupMatches.filter(m => predictions[m.id]?.home !== undefined && predictions[m.id]?.home !== '' && predictions[m.id]?.away !== undefined && predictions[m.id]?.away !== '').length;
            if (predictedGroups < allGroupMatches.length) missing.push(`Grupos (${predictedGroups}/${allGroupMatches.length})`);

            if ((knockoutPicks.dieciseisavos?.length || 0) < 16) missing.push(`16vos (${knockoutPicks.dieciseisavos?.length || 0}/16)`);
            if ((knockoutPicks.octavos?.length || 0) < 8) missing.push(`Octavos (${knockoutPicks.octavos?.length || 0}/8)`);
            if ((knockoutPicks.cuartos?.length || 0) < 4) missing.push(`Cuartos (${knockoutPicks.cuartos?.length || 0}/4)`);
            if ((knockoutPicks.semis?.length || 0) < 2) missing.push(`Semis (${knockoutPicks.semis?.length || 0}/2)`);
            
            const podiumMissing = [];
            if (!knockoutPicks.campeon?.length) podiumMissing.push('Campeón');
            if (!knockoutPicks.subcampeon?.length) podiumMissing.push('Sub');
            if (!knockoutPicks.tercero?.length) podiumMissing.push('3ro');
            if (!knockoutPicks.cuarto?.length) podiumMissing.push('4to');
            if (podiumMissing.length > 0) missing.push(`Podio (${podiumMissing.join(', ')})`);

            const filledExtras = extraQuestions.filter(q => extraPicks[q.id] !== undefined && extraPicks[q.id] !== '').length;
            if (filledExtras < extraQuestions.length) missing.push(`Extras (${filledExtras}/${extraQuestions.length})`);

            const filledEvents = specialEvents.filter(e => eventPicks[e.id] !== undefined && eventPicks[e.id] !== '').length;
            if (filledEvents < specialEvents.length) missing.push(`Eventos (${filledEvents}/${specialEvents.length})`);
        }

        const checkKnockoutPhase = (phaseId, label) => {
            if (activePhase === phaseId || activePhase === 'ALL_OPEN') {
                const phaseMatches = knockoutMatches[phaseId] || [];
                if (phaseMatches.length > 0) {
                    const predictedKO = phaseMatches.filter(m => predictions[m.id]?.home !== undefined && predictions[m.id]?.home !== '' && predictions[m.id]?.away !== undefined && predictions[m.id]?.away !== '').length;
                    if (predictedKO < phaseMatches.length) missing.push(`${label} (${predictedKO}/${phaseMatches.length})`);
                }
            }
        };

        checkKnockoutPhase('LAST_32', 'Marcadores 16vos');
        checkKnockoutPhase('LAST_16', 'Marcadores Octavos');
        checkKnockoutPhase('QUARTER_FINALS', 'Marcadores Cuartos');
        checkKnockoutPhase('SEMI_FINALS', 'Marcadores Semis');
        checkKnockoutPhase('FINALS', 'Marcadores Finales');

        return missing;
    }, [activePhase, matchesByGroup, knockoutMatches, predictions, knockoutPicks, extraPicks, eventPicks, isAdmin]);

    const handleScoreChange = (matchId, team, value) => {
        if (activeTab === 'partidos' ? isSubTabLocked(selectedSubTab) : isCurrentMainTabLocked) return;
        if (value !== '' && (isNaN(value) || value < 0 || value > 99)) return;
        
        setPredictions(prev => {
            const newPreds = {
                ...prev, [matchId]: { ...prev[matchId], [team]: value === '' ? '' : parseInt(value, 10) }
            };
            return newPreds;
        });

        const isGroupMatch = Object.values(matchesByGroup).flat().some(m => String(m.id) === String(matchId));
        if (isGroupMatch) {
            setKnockoutPicks(prev => {
                const hasPicks = Object.values(prev).some(arr => arr && arr.length > 0);
                if (hasPicks) {
                    setTimeout(() => toast('Si grabas, El Árbol de Clasificados se Reseteara por cambios en los resultados del grupo', { icon: '🧹', id: 'reset-bracket' }), 500);
                    return { dieciseisavos: [], octavos: [], cuartos: [], semis: [], campeon: [], subcampeon: [], tercero: [], cuarto: [] };
                }
                return prev;
            });
        }
    };

    const handleCustomTeamChange = () => {};

    const handleExtraChange = (extraId, value) => {
        if (isCurrentMainTabLocked) return;
        setExtraPicks(prev => ({ ...prev, [extraId]: value }));
    };

    const handleEventChange = (eventId, value) => {
        if (isCurrentMainTabLocked) return;
        setEventPicks(prev => ({ ...prev, [eventId]: prev[eventId] === value ? '' : value }));
    };

    const handleToggleLockMatch = async (matchId) => {
        if (!isAdmin) return;
        const newValue = !lockedMatches[matchId];
        setLockedMatches(prev => ({ ...prev, [matchId]: newValue }));
        
        try {
            await setDoc(doc(db, 'worldCupAdmin', 'results'), { 
                lockedMatches: { [matchId]: newValue } 
            }, { merge: true });
            
            if (newValue) toast.success("🔒 Partido cerrado a los 90min (El Robot no lo sobrescribirá)");
            else toast("🔓 Partido desbloqueado para la API", { icon: '🔓' });
        } catch (error) { toast.error("Error al bloquear el partido"); }
    };

    const handleManualTiebreaker = (group, teamName, positionValue, tiedTeamNames, tieOptions) => {
        if (isSubTabLocked(selectedSubTab)) return;
        
        setManualTiebreakers(prev => {
            const groupTies = { ...(prev[group] || {}) };
            const newVal = positionValue === '' ? 0 : parseInt(positionValue, 10);
            if (newVal === 0) { groupTies[teamName] = 0; return { ...prev, [group]: groupTies }; }

            const previousTeamWithVal = tiedTeamNames.find(t => t !== teamName && groupTies[t] === newVal);
            const oldVal = groupTies[teamName];
            groupTies[teamName] = newVal;

            if (previousTeamWithVal && oldVal && tieOptions.includes(oldVal)) groupTies[previousTeamWithVal] = oldVal;
            else if (previousTeamWithVal) groupTies[previousTeamWithVal] = 0; 

            const assignedValues = tiedTeamNames.map(t => groupTies[t]).filter(v => tieOptions.includes(v));
            if (assignedValues.length === tieOptions.length - 1) {
                const missingOption = tieOptions.find(opt => !assignedValues.includes(assignedValues));
                const missingTeam = tiedTeamNames.find(t => !tieOptions.includes(groupTies[t]));
                if (missingOption && missingTeam) groupTies[missingTeam] = missingOption;
            }
            return { ...prev, [group]: groupTies };
        });

        setKnockoutPicks(prev => {
            const hasPicks = Object.values(prev).some(arr => arr && arr.length > 0);
            if (hasPicks) {
                setTimeout(() => toast('El Árbol de Clasificados se recalculó automáticamente', { icon: '🧹', id: 'reset-bracket' }), 100);
                return { dieciseisavos: [], octavos: [], cuartos: [], semis: [], campeon: [], subcampeon: [], tercero: [], cuarto: [] };
            }
            return prev;
        });
    };

    const replaceKnockoutPick = (roundId, oldTeam, newTeam) => {
        if (isCurrentMainTabLocked) return;
        setKnockoutPicks(prev => {
            const newPicks = { ...prev };
            const roundsOrder = ['dieciseisavos', 'octavos', 'cuartos', 'semis', 'campeon'];
            const podiumSlots = ['subcampeon', 'tercero', 'cuarto'];
            const startIndex = roundsOrder.indexOf(roundId);
            
            if (startIndex !== -1) {
                const swapInArray = (arr) => {
                    if (!Array.isArray(arr)) return [];
                    return arr.map(t => {
                        if (t.name === oldTeam.name) return newTeam;
                        if (t.name === newTeam.name) return oldTeam;
                        return t;
                    });
                };

                for (let i = startIndex; i < roundsOrder.length; i++) {
                    const r = roundsOrder[i];
                    newPicks[r] = swapInArray(newPicks[r]);
                }
                
                podiumSlots.forEach(slot => {
                    newPicks[slot] = swapInArray(newPicks[slot]);
                });
            }
            return newPicks;
        });
    };

    const toggleKnockoutPick = (roundId, team, limit, opponentTeam = null) => {
        if (isCurrentMainTabLocked) return;
        setKnockoutPicks(prev => {
            const currentRoundPicks = prev[roundId] || [];
            const isSelected = currentRoundPicks.some(t => t.name === team.name);
            const podiumSlots = ['campeon', 'subcampeon', 'tercero', 'cuarto'];

            if (isSelected) {
                const newPicks = { ...prev };
                newPicks[roundId] = currentRoundPicks.filter(t => t.name !== team.name);
                const roundsOrder = ['dieciseisavos', 'octavos', 'cuartos', 'semis'];
                const startIndex = roundsOrder.indexOf(roundId);
                
                if (startIndex !== -1) {
                    for (let i = startIndex + 1; i < roundsOrder.length; i++) {
                        newPicks[roundsOrder[i]] = (newPicks[roundsOrder[i]] || []).filter(t => t.name !== team.name);
                    }
                    podiumSlots.forEach(slot => newPicks[slot] = (newPicks[slot] || []).filter(t => t.name !== team.name));
                }
                if (roundId === 'campeon') newPicks.subcampeon = [];
                if (roundId === 'tercero') newPicks.cuarto = [];
                return newPicks;
            } else {
                const newPicks = { ...prev };
                if (limit === 1) {
                    podiumSlots.forEach(slot => { newPicks[slot] = (newPicks[slot] || []).filter(t => t.name !== team.name); });
                    newPicks[roundId] = [team];

                    if (roundId === 'campeon') {
                        const finalistas = newPicks.semis || [];
                        const sub = opponentTeam || finalistas.find(t => t.name !== team.name);
                        if (sub) newPicks.subcampeon = [sub];
                    }
                    if (roundId === 'tercero') {
                        const semifinalistas = newPicks.cuartos || []; 
                        const finalistas = newPicks.semis || []; 
                        const contenders = semifinalistas.filter(st => !finalistas.some(ft => ft.name === st.name));
                        const cuarto = opponentTeam || contenders.find(t => t.name !== team.name);
                        if (cuarto) newPicks.cuarto = [cuarto];
                    }
                    return newPicks;
                }
                
                if (podiumSlots.includes(roundId)) podiumSlots.forEach(slot => newPicks[slot] = (newPicks[slot] || []).filter(t => t.name !== team.name));
                if ((newPicks[roundId] || []).length < limit) newPicks[roundId] = [...(newPicks[roundId] || []), team];
                return newPicks;
            }
        });
    };

    const handleAdminSetPhase = async (phase) => {
        if (!window.confirm(`¿Seguro que deseas cambiar la fase a ${phase}? Las demás fases quedarán bloqueadas para los usuarios.`)) return;
        try {
            await setDoc(doc(db, 'worldCupAdmin', 'results'), { activePhase: phase }, { merge: true });
            toast.success(`Fase cambiada a: ${phase}`);
        } catch (error) { toast.error("Error al cambiar la fase"); }
    };

    const handleSavePredictions = async () => {
        if (activeTab === 'partidos' ? isSubTabLocked(selectedSubTab) : isCurrentMainTabLocked) {
            toast.error("Esta sección está bloqueada, no puedes guardar cambios aquí.");
            return;
        }

        setSaving(true);

        // 🟢 LÓGICA DE TIEMPO FRANCOTIRADOR: Ancla el evento a la hora EXACTA del último partido calificado
        let finalTimestamps = adminResults?.timestamps || {};
        
        if (isAdmin) {
            const simDate = adminResults?.simulation?.simulatedDate;
            let virtualDateIso = new Date().toISOString(); 

            // Recopilamos todos los partidos y buscamos los que ya tienen marcador del Admin
            const allMatches = [
                ...Object.values(matchesByGroup).flat(),
                ...Object.values(knockoutMatches).flat()
            ];
            const matchesWithScore = allMatches.filter(m => 
                predictions[m.id]?.home !== undefined && predictions[m.id]?.home !== ''
            );

            if (simDate) {
                // Límite final del día simulado en hora Colombia (UTC-5)
                const simDateEnd = new Date(`${simDate}T23:59:59-05:00`);
                
                // Filtramos los partidos con marcador que se jugaron EN O ANTES de esta fecha
                const validMatches = matchesWithScore.filter(m => new Date(m.utcDate) <= simDateEnd);
                
                if (validMatches.length > 0) {
                    // 🎯 AQUÍ ESTÁ LA MAGIA: Tomamos la hora exacta del ÚLTIMO partido que llenaste
                    const lastMatch = validMatches.sort((a, b) => new Date(b.utcDate) - new Date(a.utcDate))[0];
                    virtualDateIso = lastMatch.utcDate;
                } else {
                    // Si no has llenado ningún partido de ese día, lo mandamos al final del día
                    virtualDateIso = simDateEnd.toISOString();
                }
            } else {
                // Si no estás simulando (estás en tiempo real), agarra tu último partido llenado
                if (matchesWithScore.length > 0) {
                    const lastMatch = matchesWithScore.sort((a, b) => new Date(b.utcDate) - new Date(a.utcDate))[0];
                    virtualDateIso = lastMatch.utcDate;
                }
            }

            const newTimestamps = { ...finalTimestamps };
            const oldExtras = adminResults?.extraPicks || {};
            const oldEvents = adminResults?.eventPicks || {};
            
            // Comparamos y sellamos con la hora exacta del partido
            Object.keys(extraPicks).forEach(key => {
                if (extraPicks[key]) {
                    if (extraPicks[key] !== oldExtras[key]) {
                        newTimestamps[key] = virtualDateIso;
                    }
                } else {
                    delete newTimestamps[key];
                }
            });
            
            Object.keys(eventPicks).forEach(key => {
                if (eventPicks[key]) {
                    if (eventPicks[key] !== oldEvents[key]) {
                        newTimestamps[key] = virtualDateIso;
                    }
                } else {
                    delete newTimestamps[key];
                }
            });
            
            finalTimestamps = newTimestamps;
        }

        const predictionData = { 
            predictions, 
            knockoutPicks, 
            extraPicks, 
            eventPicks, 
            manualTiebreakers, 
            updatedAt: new Date().toISOString() 
        };
        
        if (isAdmin) {
            predictionData.timestamps = finalTimestamps;
        } else {
            predictionData.displayName = currentUser.displayName;
            predictionData.email = currentUser.email;
            predictionData.photoURL = currentUser.photoURL;
        }

        const docRef = isAdmin ? doc(db, 'worldCupAdmin', 'results') : doc(db, 'worldCupPredictions', currentUser.uid);
        const saveOp = setDoc(docRef, predictionData, { merge: true });
        
        toast.promise(saveOp, {
            loading: isAdmin ? 'Guardando Fase Oficial...' : 'Guardando tus marcadores...',
            success: isAdmin ? '👑 ¡Resultados guardados y fechados al partido exacto!' : '¡Tus predicciones se guardaron! 🏆',
            error: 'Error de red al guardar.',
        });

        try { await saveOp; } catch (error) { console.error(error); } finally { setSaving(false); }
    };
    const handleClearData = () => {
        if (!window.confirm("⚠️ ¡Atención Admin! Vas a BORRAR TODAS tus respuestas. ¿Continuar?")) return;
        setPredictions({}); setEventPicks({}); setExtraPicks({});
        setKnockoutPicks({ dieciseisavos: [], octavos: [], cuartos: [], semis: [], campeon: [], subcampeon: [], tercero: [], cuarto: [] });
        setManualTiebreakers({});
        setLockedMatches({});
        toast.success("🧹 ¡Todo ha sido borrado! Recuerda presionar Guardar.");
    };

    const handleSimulateData = () => {
        if (!window.confirm("🎲 ¡Atención Admin! Vas a generar marcadores aleatorios. Las clasificaciones de fases quedarán vacías. ¿Continuar?")) return;
        
        const shuffledTeams = [...allTeams].sort(() => 0.5 - Math.random());
        const newPreds = {};
        
        Object.values(matchesByGroup).flat().forEach(m => {
            newPreds[m.id] = { home: Math.floor(Math.random() * 4), away: Math.floor(Math.random() * 4) };
        });

        // En simulación solo se llenan goles para que el árbol se arme solo
        Object.values(knockoutMatches).flat().forEach(m => {
             newPreds[m.id] = { home: Math.floor(Math.random() * 4), away: Math.floor(Math.random() * 4) };
        });
        
        setPredictions(newPreds);
        setKnockoutPicks({ dieciseisavos: [], octavos: [], cuartos: [], semis: [], campeon: [], subcampeon: [], tercero: [], cuarto: [] });
        
        const newEvents = {};
        specialEvents.forEach(e => { newEvents[e.id] = Math.random() > 0.5 ? 'SI' : 'NO'; });
        setEventPicks(newEvents);

        const newExtras = {};
        extraQuestions.forEach(q => {
            if (q.type === 'team') newExtras[q.id] = allTeams[Math.floor(Math.random() * allTeams.length)]?.name || '';
            else if (q.type === 'group') newExtras[q.id] = Object.keys(matchesByGroup)[Math.floor(Math.random() * Object.keys(matchesByGroup).length)] || '';
            else newExtras[q.id] = 'Jugador Test ' + Math.floor(Math.random() * 100);
        });
        setExtraPicks(newExtras);
        
        toast.success("✅ Marcadores generados. Verifica el Árbol de Clasificados.");
    };

    const handleSubTabScroll = (direction) => {
        if (subTabsRef.current) subTabsRef.current.scrollBy({ left: direction === 'left' ? -300 : 300, behavior: 'smooth' });
    };
    const handleRoundTabScroll = (direction) => {
        if (roundTabsRef.current) roundTabsRef.current.scrollBy({ left: direction === 'left' ? -250 : 250, behavior: 'smooth' });
    };

    if (loading) return (
        <div className="flex flex-col items-center justify-center py-20">
            <div className="w-16 h-16 border-4 border-primary border-t-transparent rounded-full animate-spin mb-4"></div>
            <p className="text-foreground-muted font-bold tracking-widest uppercase text-sm">Cargando Terreno de Juego...</p>
        </div>
    );

    return (
        <div className="max-w-full mx-auto pb-24 px-4 xl:px-8">
            
            {isAdmin && (
                <>
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

                    <AdminPanel activePhase={activePhase} handleAdminSetPhase={handleAdminSetPhase} handleClearData={handleClearData} handleSimulateData={handleSimulateData} />
                </>
            )}

            <div className="mb-8 text-center animate-fade-in">
                <h2 className="text-3xl sm:text-4xl font-extrabold text-foreground tracking-tighter mb-2">
                    {isAdmin ? '👑 Resultados Reales' : 'Mis Predicciones'}
                </h2>
                <p className="text-foreground-muted text-sm max-w-2xl mx-auto">
                    {isAdmin ? 'Estás guardando los resultados oficiales del torneo fase por fase.' : 'El Torneo se juega por etapas. Completa tus predicciones en la pestaña que esté activa.'}
                </p>
                <WorldCupCountdown />
                <NewsTicker />
            </div>

            <StatusWarnings 
                isAdmin={isAdmin} 
                hasPaid={hasPaid} 
                missingSections={missingSections} 
                isLocked={activeTab === 'partidos' ? isSubTabLocked(selectedSubTab) : isCurrentMainTabLocked} 
            />

            <div className="mb-10 w-full flex justify-center sticky top-16 sm:top-20 z-30 px-1 sm:px-4">
                <div className="bg-card border border-card-border p-1.5 sm:p-2 rounded-[2rem] sm:rounded-full shadow-xl flex w-full max-w-3xl items-center justify-between gap-1 backdrop-blur-sm relative overflow-hidden group">
                    {tabs.map((tab) => {
                        const isSelected = activeTab === tab.id;
                        
                        return (
                            <button
                                key={tab.id} onClick={() => setActiveTab(tab.id)}
                                className={`flex flex-1 flex-col sm:flex-row items-center justify-center gap-0.5 sm:gap-2.5 py-2 sm:py-0 sm:h-12 px-0.5 sm:px-6 rounded-xl sm:rounded-full font-black transition-all duration-300 relative overflow-hidden ${
                                    isSelected ? 'bg-gradient-to-br from-primary to-amber-600 text-white shadow-lg sm:scale-105 z-10' : 'bg-transparent text-foreground-muted hover:bg-background-offset hover:text-foreground'
                                }`}
                            >
                                <span className="text-[18px] sm:text-base relative z-10 leading-none mb-0.5 sm:mb-0">{tab.icon}</span>
                                <span className="text-[8px] sm:text-xs uppercase tracking-tight sm:tracking-wider text-center relative z-10 w-full whitespace-nowrap">{tab.label}</span>
                            </button>
                        );
                    })}
                </div>
            </div>

            {/* 1. PESTAÑA: MARCADORES */}
            {activeTab === 'partidos' && (
                <div className="animate-fade-in">
                    <div className="relative w-full mb-6 flex items-center group">
                        <button onClick={() => handleSubTabScroll('left')} className="absolute left-0 z-20 bg-card border border-border text-foreground p-1.5 rounded-full shadow-lg hidden md:flex hover:bg-primary hover:text-white transition-all ml-0">
                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-4 h-4"><path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" /></svg>
                        </button>

                        <div ref={subTabsRef} className="flex overflow-x-auto hide-scrollbar gap-2 sm:gap-3 pb-4 pt-2 px-2 md:px-10 snap-x scroll-smooth items-center w-full">
                            {orderedSubTabs.map(tab => {
                                if (tab.type === 'divider') {
                                    return <div key={tab.id} className="w-px h-10 bg-gradient-to-b from-transparent via-border to-transparent mx-2 sm:mx-4 shrink-0"></div>;
                                }
                                
                                const isSelected = selectedSubTab === tab.id;
                                
                                if (tab.type === 'group') {
                                    return (
                                        <button 
                                            key={tab.id} id={`subtab-${tab.id}`} onClick={() => setSelectedSubTab(tab.id)} 
                                            className={`snap-center shrink-0 flex flex-col items-center justify-center min-w-[70px] sm:min-w-[85px] h-14 sm:h-16 rounded-[1rem] font-black transition-all border ${
                                                isSelected ? 'bg-gradient-to-b from-primary to-amber-600 text-white border-transparent scale-105 z-10' : 'bg-card text-foreground-muted hover:bg-background-offset'
                                            }`}
                                        >
                                            <span className="text-xs sm:text-base tracking-widest">{tab.label}</span>
                                            <span className={`text-[8px] sm:text-[9px] uppercase tracking-widest opacity-70 mt-0.5 ${isSelected ? 'text-white' : ''}`}>Grupo</span>
                                        </button>
                                    );
                                }
                                
                                return (
                                    <button 
                                        key={tab.id} id={`subtab-${tab.id}`} onClick={() => setSelectedSubTab(tab.id)} 
                                        className={`snap-center shrink-0 flex items-center justify-center px-4 sm:px-6 h-14 sm:h-16 rounded-[1rem] font-black transition-all border ${
                                            isSelected ? 'bg-gradient-to-br from-indigo-500 to-purple-600 text-white border-transparent scale-105 z-10' : 'bg-card text-foreground-muted hover:bg-background-offset'
                                        }`}
                                    >
                                        <span className="text-[10px] sm:text-xs uppercase tracking-widest">{tab.label}</span>
                                    </button>
                                );
                            })}
                        </div>

                        <button onClick={() => handleSubTabScroll('right')} className="absolute right-0 z-20 bg-card border border-border text-foreground p-1.5 rounded-full shadow-lg hidden md:flex hover:bg-primary hover:text-white transition-all mr-0">
                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-4 h-4"><path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" /></svg>
                        </button>
                    </div>

                    {selectedSubTab?.startsWith('Grupo') ? (
                        <div className="grid grid-cols-1 xl:grid-cols-12 gap-8 animate-fade-in">
                            <div className="xl:col-span-7 space-y-4">
                                <div className="flex items-center justify-between border-b border-border pb-3 mb-4 gap-4">
                                    <div className="flex items-center gap-3 min-w-0 flex-1">
                                        <div className="w-10 h-10 sm:w-12 sm:h-12 bg-gradient-to-b from-card to-background-offset border border-amber-500/30 rounded-full p-1.5 flex items-center justify-center shrink-0 shadow-lg overflow-hidden">
                                            <img src={logocopa} alt="Copa" className="w-full h-full object-contain filter drop-shadow-md" />
                                        </div>
                                        <h3 className="text-xl sm:text-2xl font-black text-primary uppercase tracking-widest truncate min-w-0 flex-1">
                                            {selectedSubTab}
                                        </h3>
                                    </div>
                                    
                                    <div className="flex items-center gap-1 sm:gap-1.5 shrink-0">
                                        {currentGroupStandings.map(team => (
                                            <div key={team.name} className="w-5 h-3.5 sm:w-7 sm:h-5 bg-background rounded-[3px] overflow-hidden shadow-sm border border-border/50" title={translateTeam(team.name)}>
                                                <img src={team.crest} className="w-full h-full object-cover" alt="" />
                                            </div>
                                        ))}
                                    </div>
                                </div>
                                <div className="mb-6">
                                    <StatsBanner activeGroup={selectedSubTab} />
                                </div>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                                    {matchesByGroup[selectedSubTab]?.map(match => (
                                        <MatchCard 
                                            key={match.id} match={match} isLocked={isSubTabLocked(selectedSubTab)}
                                            allowTbdInput={activePhase === 'ALL_OPEN'} predictions={predictions} adminResults={adminResults} 
                                            allTeams={allTeams} isAdmin={isAdmin} handleScoreChange={handleScoreChange} handleCustomTeamChange={handleCustomTeamChange} 
                                            lockedMatches={lockedMatches} handleToggleLockMatch={handleToggleLockMatch} 
                                        />
                                    ))}
                                </div>
                            </div>
                            
                            <div className="xl:col-span-5">
                                <StandingsTable 
                                    currentGroupStandings={currentGroupStandings} hasTiesInGroup={hasTiesInGroup} manualTiebreakers={manualTiebreakers}
                                    selectedSubTab={selectedSubTab} handleManualTiebreaker={handleManualTiebreaker}
                                    isGroupStageComplete={isGroupStageComplete} qualifiedRoundOf32={qualifiedRoundOf32} 
                                />
                            </div>
                        </div>
                    ) : (
                        <div className="max-w-4xl mx-auto space-y-4 animate-fade-in">
                            <div className="flex items-center justify-between border-b border-border pb-3 mb-6">
                                <h3 className="text-xl sm:text-2xl font-black text-primary uppercase tracking-widest">
                                    Partidos de {knockoutSubTabs.find(k => k.id === selectedSubTab)?.label || 'Ronda Final'}
                                </h3>
                            </div>
                            
                            {knockoutMatches[selectedSubTab]?.length > 0 ? (
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                                    {knockoutMatches[selectedSubTab].map((match, index) => (
                                        <MatchCard 
                                            key={match.id} match={match} index={index} adminFullBracket={adminFullBracket}
                                            isLocked={isSubTabLocked(selectedSubTab)}
                                            allowTbdInput={activePhase === 'ALL_OPEN'} predictions={predictions} adminResults={adminResults} 
                                            allTeams={allTeams} isAdmin={isAdmin} handleScoreChange={handleScoreChange} handleCustomTeamChange={handleCustomTeamChange} 
                                            lockedMatches={lockedMatches} handleToggleLockMatch={handleToggleLockMatch} 
                                            stageMatches={knockoutMatches[selectedSubTab]}
                                        />
                                    ))}
                                </div>
                            ) : (
                                <div className="text-center py-20 bg-background-offset border border-border rounded-3xl shadow-inner">
                                    <span className="text-4xl block mb-4">⏳</span>
                                    <h3 className="font-bold text-foreground">Partidos no definidos</h3>
                                    <p className="text-foreground-muted text-sm">La FIFA aún no ha publicado los cruces oficiales para esta fase.</p>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            )}

            {/* 2. PESTAÑA: CLASIFICADOS */}
            {activeTab === 'rondas' && (
                <KnockoutTab 
                    activeRoundTab={activeRoundTab} setActiveRoundTab={setActiveRoundTab} handleRoundTabScroll={handleRoundTabScroll}
                    roundTabsRef={roundTabsRef} qualifiedRoundOf32={qualifiedRoundOf32} getAvailableTeamsForRound={getAvailableTeamsForRound}
                    knockoutPicks={knockoutPicks} toggleKnockoutPick={toggleKnockoutPick} replaceKnockoutPick={replaceKnockoutPick} isCurrentMainTabLocked={isCurrentMainTabLocked}
                    isGroupStageComplete={isGroupStageComplete}
                />
            )}

            {/* 3. PESTAÑA: EXTRAS */}
            {activeTab === 'extras' && (
                <ExtrasTab extraPicks={extraPicks} handleExtraChange={handleExtraChange} isCurrentMainTabLocked={isCurrentMainTabLocked} allTeams={allTeams} matchesByGroup={matchesByGroup} />
            )}

            {/* 4. PESTAÑA: EVENTOS */}
            {activeTab === 'eventos' && (
                <EventsTab eventPicks={eventPicks} handleEventChange={handleEventChange} isCurrentMainTabLocked={isCurrentMainTabLocked} />
            )}

            {/* BOTÓN FLOTANTE GUARDAR */}
            {!(activeTab === 'partidos' ? isSubTabLocked(selectedSubTab) : isCurrentMainTabLocked) && (
                <div className="fixed bottom-28 md:bottom-10 right-4 sm:right-10 z-30 flex flex-col gap-3 items-end animate-slide-up">
                    <button onClick={handleSavePredictions} disabled={saving} className="bg-primary text-primary-foreground font-black py-3 px-5 sm:py-4 sm:px-10 rounded-full shadow-[0_15px_30px_-5px_rgba(245,158,11,0.5)] border border-amber-500/50 transition-all hover:scale-110 active:scale-95 flex items-center gap-2 sm:gap-3 disabled:opacity-50 uppercase tracking-tighter text-xs sm:text-base">
                        {saving ? (
                            <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div><span>...</span></>
                        ) : (
                            <>
                                <span className="text-base sm:text-lg">💾</span>
                                <span className="hidden sm:inline">Guardar Predicciones</span>
                                <span className="sm:hidden">Guardar</span>
                            </>
                        )}
                    </button>
                </div>
            )}
        </div>
    );
};

export default WorldCupPredictions;