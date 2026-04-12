import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { db } from '../firebase'; 
import { doc, setDoc, getDoc, onSnapshot } from 'firebase/firestore';
import { getWorldCupMatches } from '../services/apiFootball';
import toast from 'react-hot-toast'; 
import logocopa from '../assets/logocopa.png';
import StatsBanner from './StatsBanner';

// --- IMPORTACIONES MODULARES ---
import { 
    stageTranslations, 
    translateTeam, 
    extraQuestions, 
    specialEvents, 
    knockoutSubTabs 
} from './Worldcup/Constants';
import AdminPanel from './WorldCup/AdminPanel';
import StandingsTable from './WorldCup/StandingsTable';
import ExtrasTab from './WorldCup/ExtrasTab';
import EventsTab from './WorldCup/EventsTab';
import KnockoutTab from './WorldCup/KnockoutTab';
import MatchCard from './WorldCup/MatchCard';
import StatusWarnings from './WorldCup/StatusWarnings';

const WorldCupPredictions = ({ currentUser }) => {
    const isAdmin = currentUser.email === 'doctamayot@gmail.com';

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
        octavos: [], cuartos: [], semis: [], campeon: [], subcampeon: [], tercero: [], cuarto: []
    });
    const [extraPicks, setExtraPicks] = useState({});
    const [eventPicks, setEventPicks] = useState({});
    const [manualTiebreakers, setManualTiebreakers] = useState({});
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [hasPaid, setHasPaid] = useState(false);
    const [activeRoundTab, setActiveRoundTab] = useState('dieciseisavos');

    const subTabsRef = useRef(null);
    const roundTabsRef = useRef(null);

    const tabs = [
        { id: 'partidos', label: 'Marcadores', icon: '⚽', linkedPhase: 'GROUP_STAGE' },
        { id: 'rondas', label: 'Clasificados', icon: '📈', linkedPhase: 'GROUP_STAGE' },
        { id: 'extras', label: 'Extras', icon: '⭐', linkedPhase: 'GROUP_STAGE' },
        { id: 'eventos', label: 'Eventos', icon: '❓', linkedPhase: 'GROUP_STAGE' }
    ];

    useEffect(() => {
        const fetchMatchesAndData = async () => {
            try {
                const data = await getWorldCupMatches();
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
                
                const sortedGroups = Object.keys(groupedGroups).sort((a, b) => a.localeCompare(b));
                if (sortedGroups.length > 0 && !selectedSubTab) setSelectedSubTab(sortedGroups[0]);

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
                    }
                }
            } catch (err) {
                console.error(err);
                toast.error("Error al cargar datos del servidor");
            } finally {
                setLoading(false);
            }
        };
        fetchMatchesAndData();
    }, [currentUser, isAdmin]);

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

    // --- LÓGICAS DE BLOQUEO Y DESEMPATE ---
    const isSubTabLocked = useCallback((subTab) => {
        if (isAdmin || activePhase === 'ALL_OPEN') return false;
        if (!subTab) return true;
        if (subTab.startsWith('Grupo')) return activePhase !== 'GROUP_STAGE';
        return activePhase !== subTab;
    }, [activePhase, isAdmin]);

    const isCurrentMainTabLocked = useMemo(() => {
        if (isAdmin || activePhase === 'ALL_OPEN' || activeTab === 'partidos') return false; 
        return activePhase !== 'GROUP_STAGE'; 
    }, [activeTab, activePhase, isAdmin]);

    const allTeams = useMemo(() => {
        const teamsMap = new Map();
        Object.values(matchesByGroup).flat().forEach(m => {
            if (m.homeTeam?.name && m.homeTeam.name !== 'Por definir') teamsMap.set(m.homeTeam.name, m.homeTeam);
            if (m.awayTeam?.name && m.awayTeam.name !== 'Por definir') teamsMap.set(m.awayTeam.name, m.awayTeam);
        });
        return Array.from(teamsMap.values()).sort((a, b) => translateTeam(a.name).localeCompare(translateTeam(b.name)));
    }, [matchesByGroup]);

    const calculateStandings = useCallback((groupName) => {
        if (!groupName || !matchesByGroup[groupName]) return [];
        const groupMatches = matchesByGroup[groupName];
        const teams = {};

        // 1. Inicializar estadísticas
        groupMatches.forEach(m => {
            const home = m.homeTeam?.name || 'Por definir';
            const away = m.awayTeam?.name || 'Por definir';
            if (!teams[home]) teams[home] = { name: home, crest: m.homeTeam?.crest, pj: 0, pg: 0, pe: 0, pp: 0, gf: 0, gc: 0, dg: 0, pts: 0, isTied: false, tieOptions: [], tiedTeamNames: [] };
            if (!teams[away]) teams[away] = { name: away, crest: m.awayTeam?.crest, pj: 0, pg: 0, pe: 0, pp: 0, gf: 0, gc: 0, dg: 0, pts: 0, isTied: false, tieOptions: [], tiedTeamNames: [] };
        });

        // 2. Calcular Estadísticas Generales
        groupMatches.forEach(m => {
            const pred = predictions[m.id];
            if (pred && pred.home !== '' && pred.home !== undefined && pred.away !== '' && pred.away !== undefined) {
                const homeGoals = parseInt(pred.home, 10);
                const awayGoals = parseInt(pred.away, 10);

                teams[m.homeTeam.name].pj += 1; teams[m.awayTeam.name].pj += 1;
                teams[m.homeTeam.name].gf += homeGoals; teams[m.awayTeam.name].gf += awayGoals;
                teams[m.homeTeam.name].gc += awayGoals; teams[m.awayTeam.name].gc += homeGoals;
                teams[m.homeTeam.name].dg = teams[m.homeTeam.name].gf - teams[m.homeTeam.name].gc;
                teams[m.awayTeam.name].dg = teams[m.awayTeam.name].gf - teams[m.awayTeam.name].gc;

                if (homeGoals > awayGoals) {
                    teams[m.homeTeam.name].pts += 3; teams[m.homeTeam.name].pg += 1; teams[m.awayTeam.name].pp += 1;
                } else if (homeGoals < awayGoals) {
                    teams[m.awayTeam.name].pts += 3; teams[m.awayTeam.name].pg += 1; teams[m.homeTeam.name].pp += 1;
                } else {
                    teams[m.homeTeam.name].pts += 1; teams[m.awayTeam.name].pts += 1; teams[m.homeTeam.name].pe += 1; teams[m.awayTeam.name].pe += 1;
                }
            }
        });

        const teamsArray = Object.values(teams);

        // 3. Regla FIFA 2026: Agrupar por Puntos Totales
        const groupedByPts = {};
        teamsArray.forEach(t => {
            if (!groupedByPts[t.pts]) groupedByPts[t.pts] = [];
            groupedByPts[t.pts].push(t);
        });

        const sortedPtsKeys = Object.keys(groupedByPts).map(Number).sort((a, b) => b - a);

        // 4. FUNCIÓN RECURSIVA: "Cara a Cara"
        const resolveTie = (tiedTeams) => {
            if (tiedTeams.length <= 1) return [tiedTeams];

            const h2hStats = {};
            tiedTeams.forEach(t => h2hStats[t.name] = { pts: 0, dg: 0, gf: 0 });
            const tiedNames = tiedTeams.map(t => t.name);

            groupMatches.forEach(m => {
                if (tiedNames.includes(m.homeTeam?.name) && tiedNames.includes(m.awayTeam?.name)) {
                    const pred = predictions[m.id];
                    if (pred && pred.home !== '' && pred.home !== undefined && pred.away !== '' && pred.away !== undefined) {
                        const hG = parseInt(pred.home, 10);
                        const aG = parseInt(pred.away, 10);
                        const home = m.homeTeam.name;
                        const away = m.awayTeam.name;

                        h2hStats[home].gf += hG; h2hStats[away].gf += aG;
                        h2hStats[home].dg += (hG - aG); h2hStats[away].dg += (aG - hG);

                        if (hG > aG) h2hStats[home].pts += 3;
                        else if (hG < aG) h2hStats[away].pts += 3;
                        else { h2hStats[home].pts += 1; h2hStats[away].pts += 1; }
                    }
                }
            });

            const sortedByH2H = [...tiedTeams].sort((a, b) => {
                const sA = h2hStats[a.name];
                const sB = h2hStats[b.name];
                if (sB.pts !== sA.pts) return sB.pts - sA.pts;
                if (sB.dg !== sA.dg) return sB.dg - sA.dg;
                return sB.gf - sA.gf;
            });

            const subGroups = [];
            let currGroup = [sortedByH2H[0]];
            for (let i = 1; i < sortedByH2H.length; i++) {
                const prev = h2hStats[sortedByH2H[i-1].name];
                const curr = h2hStats[sortedByH2H[i].name];
                if (prev.pts === curr.pts && prev.dg === curr.dg && prev.gf === curr.gf) {
                    currGroup.push(sortedByH2H[i]);
                } else {
                    subGroups.push(currGroup); 
                    currGroup = [sortedByH2H[i]];
                }
            }
            subGroups.push(currGroup);

            if (subGroups.length === 1) {
                const sortedByOverall = [...tiedTeams].sort((a, b) => {
                    if (b.dg !== a.dg) return b.dg - a.dg;
                    return b.gf - a.gf;
                });
                
                const overallGroups = [];
                let currOverallGroup = [sortedByOverall[0]];
                for (let i = 1; i < sortedByOverall.length; i++) {
                    const prev = sortedByOverall[i-1];
                    const curr = sortedByOverall[i];
                    if (prev.dg === curr.dg && prev.gf === curr.gf) {
                        currOverallGroup.push(sortedByOverall[i]);
                    } else {
                        overallGroups.push(currOverallGroup);
                        currOverallGroup = [sortedByOverall[i]];
                    }
                }
                overallGroups.push(currOverallGroup);
                return overallGroups; 
            }

            let finalGroups = [];
            for (const sg of subGroups) {
                finalGroups.push(...resolveTie(sg));
            }
            return finalGroups;
        };

        let finalRankedGroups = [];
        sortedPtsKeys.forEach(pts => {
            const groupTeams = groupedByPts[pts];
            finalRankedGroups.push(...resolveTie(groupTeams)); 
        });

        let currentRank = 1;
        let finalFlattenedStandings = [];

        finalRankedGroups.forEach(groupTeams => {
            const numTeams = groupTeams.length;
            const availablePositions = [];
            for (let i = 0; i < numTeams; i++) availablePositions.push(currentRank + i);
            const tiedTeamNames = groupTeams.map(t => t.name);

            groupTeams.forEach(t => {
                const isRealTie = numTeams > 1 && t.pj > 0;
                t.isTied = isRealTie; 
                t.tieOptions = isRealTie ? availablePositions : [];
                t.tiedTeamNames = isRealTie ? tiedTeamNames : [];
            });

            const sortedGroup = [...groupTeams].sort((a, b) => {
                const tieA = manualTiebreakers[groupName]?.[a.name] || 99;
                const tieB = manualTiebreakers[groupName]?.[b.name] || 99;
                if (tieA !== tieB) return tieA - tieB; 
                return translateTeam(a.name).localeCompare(translateTeam(b.name));
            });

            finalFlattenedStandings.push(...sortedGroup);
            currentRank += numTeams;
        });

        return finalFlattenedStandings;
    }, [matchesByGroup, predictions, manualTiebreakers]);

    const currentGroupStandings = useMemo(() => {
        if (!selectedSubTab || !selectedSubTab.startsWith('Grupo')) return [];
        return calculateStandings(selectedSubTab);
    }, [calculateStandings, selectedSubTab]);

    const hasTiesInGroup = useMemo(() => currentGroupStandings.some(t => t.isTied), [currentGroupStandings]);

    const qualifiedRoundOf32 = useMemo(() => {
        let top2 = []; let thirds = [];
        Object.keys(matchesByGroup).forEach(groupName => {
            const standings = calculateStandings(groupName);
            if (standings.length > 0) top2.push({ ...standings[0], group: groupName, qualReason: '1º' });
            if (standings.length > 1) top2.push({ ...standings[1], group: groupName, qualReason: '2º' });
            if (standings.length > 2) thirds.push({ ...standings[2], group: groupName, qualReason: 'Mejor 3º' });
        });
        thirds.sort((a, b) => b.pts - a.pts || b.dg - a.dg || b.gf - a.gf);
        return { all32: [...top2, ...thirds.slice(0, 8)] };
    }, [matchesByGroup, calculateStandings]);

    const getAvailableTeamsForRound = useCallback((roundId) => {
        switch(roundId) {
            case 'dieciseisavos': case 'LAST_32': case 'octavos': return qualifiedRoundOf32.all32;
            case 'LAST_16': case 'cuartos': return knockoutPicks.octavos || [];
            case 'QUARTER_FINALS': case 'semis': return knockoutPicks.cuartos || [];
            case 'SEMI_FINALS': case 'campeon': case 'subcampeon': case 'tercero': case 'cuarto': case 'FINALS': return knockoutPicks.semis || [];
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

            if ((knockoutPicks.octavos?.length || 0) < 16) missing.push(`Octavos (${knockoutPicks.octavos?.length || 0}/16)`);
            if ((knockoutPicks.cuartos?.length || 0) < 8) missing.push(`Cuartos (${knockoutPicks.cuartos?.length || 0}/8)`);
            if ((knockoutPicks.semis?.length || 0) < 4) missing.push(`Semis (${knockoutPicks.semis?.length || 0}/4)`);
            
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

    // --- HANDLERS Y ACTIONS ---
    const handleScoreChange = (matchId, team, value) => {
        if (activeTab === 'partidos' ? isSubTabLocked(selectedSubTab) : isCurrentMainTabLocked) return;
        if (value !== '' && (isNaN(value) || value < 0 || value > 99)) return;
        setPredictions(prev => ({
            ...prev, [matchId]: { ...prev[matchId], [team]: value === '' ? '' : parseInt(value, 10) }
        }));
    };

    const handleCustomTeamChange = (matchId, side, teamName) => {
        if (!isAdmin) return; 
        setPredictions(prev => ({
            ...prev, [matchId]: { ...(prev[matchId] || {}), [side === 'home' ? 'customHomeTeam' : 'customAwayTeam']: teamName }
        }));
    };

    const handleExtraChange = (extraId, value) => {
        if (isCurrentMainTabLocked) return;
        setExtraPicks(prev => ({ ...prev, [extraId]: value }));
    };

    const handleEventChange = (eventId, value) => {
        if (isCurrentMainTabLocked) return;
        setEventPicks(prev => ({ ...prev, [eventId]: prev[eventId] === value ? '' : value }));
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
                const missingOption = tieOptions.find(opt => !assignedValues.includes(opt));
                const missingTeam = tiedTeamNames.find(t => !tieOptions.includes(groupTies[t]));
                if (missingOption && missingTeam) groupTies[missingTeam] = missingOption;
            }
            return { ...prev, [group]: groupTies };
        });
    };

    const toggleKnockoutPick = (roundId, team, limit) => {
        if (isCurrentMainTabLocked) return;
        setKnockoutPicks(prev => {
            const currentRoundPicks = prev[roundId] || [];
            const isSelected = currentRoundPicks.some(t => t.name === team.name);
            const podiumSlots = ['campeon', 'subcampeon', 'tercero', 'cuarto'];

            if (isSelected) {
                const newPicks = { ...prev };
                newPicks[roundId] = currentRoundPicks.filter(t => t.name !== team.name);
                const roundsOrder = ['octavos', 'cuartos', 'semis'];
                const startIndex = roundsOrder.indexOf(roundId);
                if (startIndex !== -1) {
                    for (let i = startIndex + 1; i < roundsOrder.length; i++) {
                        newPicks[roundsOrder[i]] = (newPicks[roundsOrder[i]] || []).filter(t => t.name !== team.name);
                    }
                    podiumSlots.forEach(slot => newPicks[slot] = (newPicks[slot] || []).filter(t => t.name !== team.name));
                }
                return newPicks;
            } else {
                const newPicks = { ...prev };
                if (limit === 1) {
                    podiumSlots.forEach(slot => { newPicks[slot] = (newPicks[slot] || []).filter(t => t.name !== team.name); });
                    newPicks[roundId] = [team];
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
        const predictionData = { predictions, knockoutPicks, extraPicks, eventPicks, manualTiebreakers, updatedAt: new Date().toISOString() };
        const docRef = isAdmin ? doc(db, 'worldCupAdmin', 'results') : doc(db, 'worldCupPredictions', currentUser.uid);

        if (!isAdmin) {
            predictionData.displayName = currentUser.displayName;
            predictionData.email = currentUser.email;
            predictionData.photoURL = currentUser.photoURL;
        }

        const saveOp = setDoc(docRef, predictionData, { merge: true });
        toast.promise(saveOp, {
            loading: isAdmin ? 'Guardando Fase Oficial...' : 'Guardando tus marcadores...',
            success: isAdmin ? '👑 ¡Resultados MAESTROS actualizados!' : '¡Tus predicciones se guardaron! 🏆',
            error: 'Error de red al guardar. Reintenta.',
        }, { style: { minWidth: '250px' } });

        try { await saveOp; } catch (error) { console.error(error); } finally { setSaving(false); }
    };

    const handleClearData = () => {
        if (!window.confirm("⚠️ ¡Atención Admin! Vas a BORRAR TODAS tus respuestas. ¿Continuar?")) return;
        setPredictions({}); setEventPicks({}); setExtraPicks({});
        setKnockoutPicks({ octavos: [], cuartos: [], semis: [], campeon: [], subcampeon: [], tercero: [], cuarto: [] });
        setManualTiebreakers({});
        toast.success("🧹 ¡Todo ha sido borrado! Recuerda presionar Guardar.");
    };

    const handleSimulateData = () => {
        if (!window.confirm("🎲 ¡Atención Admin! Vas a sobreescribir TODAS tus respuestas con datos aleatorios. ¿Continuar?")) return;
        const shuffledTeams = [...allTeams].sort(() => 0.5 - Math.random());
        const newPreds = {};
        
        Object.values(matchesByGroup).flat().forEach(m => newPreds[m.id] = { home: Math.floor(Math.random() * 4), away: Math.floor(Math.random() * 4) });
        Object.values(knockoutMatches).flat().forEach(m => {
             newPreds[m.id] = { home: Math.floor(Math.random() * 4), away: Math.floor(Math.random() * 4), customHomeTeam: shuffledTeams[Math.floor(Math.random() * shuffledTeams.length)]?.name, customAwayTeam: shuffledTeams[Math.floor(Math.random() * shuffledTeams.length)]?.name };
        });
        
        setPredictions(newPreds);
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
        setKnockoutPicks({
            octavos: shuffledTeams.slice(0, 16), cuartos: shuffledTeams.slice(0, 8), semis: shuffledTeams.slice(0, 4),
            campeon: [shuffledTeams[0]], subcampeon: [shuffledTeams[1]], tercero: [shuffledTeams[2]], cuarto: [shuffledTeams[3]]
        });
        toast.success("✅ ¡Datos inyectados! Recuerda presionar Guardar.");
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
        <div className="max-w-6xl mx-auto pb-24">
            
            {isAdmin && (
                <AdminPanel activePhase={activePhase} handleAdminSetPhase={handleAdminSetPhase} handleClearData={handleClearData} handleSimulateData={handleSimulateData} />
            )}

            <div className="mb-8 text-center animate-fade-in">
                <h2 className="text-3xl sm:text-4xl font-extrabold text-foreground tracking-tighter mb-2">
                    {isAdmin ? '👑 Resultados Reales' : 'Mis Predicciones'}
                </h2>
                <p className="text-foreground-muted text-sm max-w-2xl mx-auto">
                    {isAdmin ? 'Estás guardando los resultados oficiales del torneo fase por fase.' : 'El Torneo se juega por etapas. Completa tus predicciones en la pestaña que esté activa.'}
                </p>
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
                        const isLocked = !isAdmin && activePhase !== 'ALL_OPEN' && activePhase !== tab.linkedPhase && tab.id !== 'partidos';
                        
                        return (
                            <button
                                key={tab.id} onClick={() => setActiveTab(tab.id)} disabled={isLocked}
                                className={`flex flex-1 flex-col sm:flex-row items-center justify-center gap-0.5 sm:gap-2.5 py-2 sm:py-0 sm:h-12 px-0.5 sm:px-6 rounded-xl sm:rounded-full font-black transition-all duration-300 relative overflow-hidden disabled:opacity-50 disabled:grayscale ${
                                    isSelected ? 'bg-gradient-to-br from-primary to-amber-600 text-white shadow-lg sm:scale-105 z-10' : 'bg-transparent text-foreground-muted hover:bg-background-offset hover:text-foreground'
                                }`}
                            >
                                <span className="text-[18px] sm:text-base relative z-10 leading-none mb-0.5 sm:mb-0">{isLocked ? '🔒' : tab.icon}</span>
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
                                    {matchesByGroup[selectedSubTab].map(match => (
                                        <MatchCard 
                                            key={match.id} match={match} isLocked={isSubTabLocked(selectedSubTab)}
                                            allowTbdInput={activePhase === 'ALL_OPEN'} predictions={predictions} adminResults={adminResults} 
                                            allTeams={allTeams} isAdmin={isAdmin} handleScoreChange={handleScoreChange} handleCustomTeamChange={handleCustomTeamChange} 
                                        />
                                    ))}
                                </div>
                            </div>
                            
                            <div className="xl:col-span-5">
                                <StandingsTable 
                                    currentGroupStandings={currentGroupStandings} hasTiesInGroup={hasTiesInGroup} manualTiebreakers={manualTiebreakers}
                                    selectedSubTab={selectedSubTab} handleManualTiebreaker={handleManualTiebreaker}
                                />
                            </div>
                        </div>
                    ) : (
                        <div className="max-w-4xl mx-auto space-y-4 animate-fade-in">
                            <div className="flex items-center justify-between border-b border-border pb-3 mb-6">
                                <h3 className="text-xl sm:text-2xl font-black text-primary uppercase tracking-widest">
                                    Partidos de {knockoutSubTabs.find(k => k.id === selectedSubTab)?.label}
                                </h3>
                            </div>
                            
                            {knockoutMatches[selectedSubTab]?.length > 0 ? (
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                                    {knockoutMatches[selectedSubTab].map(match => (
                                        <MatchCard 
                                            key={match.id} match={match} isLocked={isSubTabLocked(selectedSubTab)}
                                            allowTbdInput={activePhase === 'ALL_OPEN'} predictions={predictions} adminResults={adminResults} 
                                            allTeams={allTeams} isAdmin={isAdmin} handleScoreChange={handleScoreChange} handleCustomTeamChange={handleCustomTeamChange} 
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
                    knockoutPicks={knockoutPicks} toggleKnockoutPick={toggleKnockoutPick} isCurrentMainTabLocked={isCurrentMainTabLocked}
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