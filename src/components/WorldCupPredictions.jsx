import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { db } from '../firebase'; 
import { doc, setDoc, getDoc, onSnapshot } from 'firebase/firestore';
import { getWorldCupMatches } from '../services/apiFootball';
import toast from 'react-hot-toast'; 
import logocopa from '../assets/logocopa.png';
import StatsBanner from './StatsBanner';

// --- DICCIONARIO DE TRADUCCIÓN COMPLETO ---
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

const matchStatusTranslations = {
    SCHEDULED: 'Programado', TIMED: 'Confirmado', IN_PLAY: 'En Juego', PAUSED: 'En Pausa',
    FINISHED: 'Finalizado', SUSPENDED: 'Suspendido', POSTPONED: 'Pospuesto', CANCELLED: 'Cancelado', AWARDED: 'Adjudicado'
};

const translateTeam = (englishName) => teamTranslations[englishName] || englishName;

// --- ESTRUCTURAS DE PREGUNTAS EXTRAS ---
const extraQuestions = [
    { id: 'goleador', label: '1. Goleador', type: 'player', desc: 'Jugador con más goles anotados.' },
    { id: 'equipo_goleador', label: '2. Equipo Goleador', type: 'team', desc: 'Equipo con más goles a favor totales.' },
    { id: 'equipo_menos_goleador', label: '3. Equipo Menos Goleador', type: 'team', desc: 'Equipo con menos goles a favor.' },
    { id: 'mas_amarillas', label: '4. Más Amarillas', type: 'team', desc: 'Equipo que reciba más tarjetas amarillas.' },
    { id: 'mas_rojas', label: '5. Más Rojas', type: 'team', desc: 'Equipo que reciba más tarjetas rojas.' },
    { id: 'valla_menos_vencida', label: '6. Valla menos vencida', type: 'team', desc: 'Equipo con menos goles en contra.' },
    { id: 'valla_mas_vencida', label: '7. Valla más vencida', type: 'team', desc: 'Equipo con más goles en contra.' },
    { id: 'grupo_mas_goles', label: '8. Grupo con más goles', type: 'group', desc: 'Suma total de goles del grupo (A-L).' },
    { id: 'grupo_menos_goles', label: '9. Grupo con menos goles', type: 'group', desc: 'Suma total de goles del grupo (A-L).' },
    { id: 'maximo_asistidor', label: '10. Máximo asistidor', type: 'player', desc: 'Jugador con más pases de gol.' },
    { id: 'atajapenales', label: '11. El Atajapenales', type: 'player', desc: 'Arquero con más penales tapados (90\').' }
];

const specialEvents = [
    { id: 'gol_olimpico', label: 'Gol Olímpico', desc: '¿Habrá al menos un gol directo de tiro de esquina?' },
    { id: 'remontada_epica', label: 'Remontada Épica', desc: '¿Alguien ganará tras ir perdiendo por 2+ goles?' },
    { id: 'el_festival', label: 'El Festival', desc: '¿Habrá un partido con 8 o más goles (90 min)?' },
    { id: 'muralla_final', label: 'Muralla en la Final', desc: '¿Se atajará algún penal en los 90\' de la Gran Final?' },
    { id: 'hat_trick_hero', label: 'Hat-Trick Hero', desc: '¿Algún jugador anotará 3 o más goles en un partido?' },
    { id: 'roja_banquillo', label: 'Roja al Banquillo', desc: '¿Un Director Técnico será expulsado con roja?' },
    { id: 'portero_goleador', label: 'El Portero Goleador', desc: '¿Algún arquero anotará (fuera de penales)?' },
    { id: 'debut_sin_red', label: 'Debut sin Red', desc: '¿Al menos un equipo se irá con 0 goles anotados?' },
    { id: 'leyenda_viva', label: 'Leyenda Viva', desc: '¿Messi o CR7 anotarán 3 o más goles totales?' },
    { id: 'drama_final', label: 'Drama Final', desc: '¿Habrá roja (jugador) en el partido de la Gran Final?' },
    { id: 'penales_final', label: 'Final en Penales', desc: '¿La final se decide en penales?' }
];

const roundTabs = [
    { id: 'dieciseisavos', label: '16vos', limit: 32 },
    { id: 'octavos', label: '8vos', limit: 16 },
    { id: 'cuartos', label: '4tos', limit: 8 },
    { id: 'semis', label: 'Semis', limit: 4 },
    { id: 'campeon', label: 'Campeón', limit: 1 },
    { id: 'subcampeon', label: 'Subcampeón', limit: 1 },
    { id: 'tercero', label: 'Tercero', limit: 1 },
    { id: 'cuarto', label: 'Cuarto', limit: 1 }
];

const knockoutSubTabs = [
    { id: 'LAST_32', label: '16vos' },
    { id: 'LAST_16', label: 'Octavos' },
    { id: 'QUARTER_FINALS', label: 'Cuartos' },
    { id: 'SEMI_FINALS', label: 'Semis' },
    { id: 'FINALS', label: 'Finales' }
];

const TOURNAMENT_PHASES = [
    { id: 'ALL_OPEN', label: 'Todo Abierto (Testing)' },
    { id: 'GROUP_STAGE', label: 'Fase de Grupos' },
    { id: 'LAST_32', label: '16vos de Final' },
    { id: 'LAST_16', label: 'Octavos de Final' },
    { id: 'QUARTER_FINALS', label: 'Cuartos de Final' },
    { id: 'SEMI_FINALS', label: 'Semifinales' },
    { id: 'FINALS', label: '3er Puesto & Final' },
    { id: 'CLOSED', label: 'Torneo Finalizado' }
];

const WorldCupPredictions = ({ currentUser }) => {
    const isAdmin = currentUser.email === 'doctamayot@gmail.com';

    // ESTADO GENERAL DE LA APP
    const [activePhase, setActivePhase] = useState('GROUP_STAGE'); 
    const [activeTab, setActiveTab] = useState('partidos');
    const [adminResults, setAdminResults] = useState(null);
    
    // DATA DE LOS PARTIDOS MULTIFASE
    const [matchesByGroup, setMatchesByGroup] = useState({});
    const [knockoutMatches, setKnockoutMatches] = useState({
        LAST_32: [], LAST_16: [], QUARTER_FINALS: [], SEMI_FINALS: [], FINALS: []
    });
    const [selectedSubTab, setSelectedSubTab] = useState(null); 

    // PREDICCIONES
    const [predictions, setPredictions] = useState({});
    const [knockoutPicks, setKnockoutPicks] = useState({
        octavos: [], cuartos: [], semis: [], campeon: [], subcampeon: [], tercero: [], cuarto: []
    });
    const [extraPicks, setExtraPicks] = useState({});
    const [eventPicks, setEventPicks] = useState({});
    const [manualTiebreakers, setManualTiebreakers] = useState({});

    // ESTADOS DE UI
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [hasPaid, setHasPaid] = useState(false);
    const [activeRoundTab, setActiveRoundTab] = useState('dieciseisavos');

    // Referencias para carruseles de pestañas
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

                Object.keys(groupedGroups).forEach(key => {
                    groupedGroups[key].sort((a, b) => new Date(a.utcDate) - new Date(b.utcDate));
                });
                Object.keys(ko).forEach(key => {
                    ko[key].sort((a, b) => new Date(a.utcDate) - new Date(b.utcDate));
                });

                setMatchesByGroup(groupedGroups);
                setKnockoutMatches(ko);
                
                const sortedGroups = Object.keys(groupedGroups).sort((a, b) => a.localeCompare(b));
                if (sortedGroups.length > 0 && !selectedSubTab) setSelectedSubTab(sortedGroups[0]);

                if (currentUser) {
                    const docRef = isAdmin 
                        ? doc(db, 'worldCupAdmin', 'results') 
                        : doc(db, 'worldCupPredictions', currentUser.uid);
                    
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
        if (!currentUser) return;
        if (!isAdmin) {
            const userRef = doc(db, 'worldCupPredictions', currentUser.uid);
            const unsubUser = onSnapshot(userRef, (docSnap) => {
                if (docSnap.exists()) setHasPaid(!!docSnap.data().hasPaid);
            });
            return () => unsubUser();
        }
    }, [currentUser, isAdmin]);

    useEffect(() => {
        const adminRef = doc(db, 'worldCupAdmin', 'results');
        const unsubAdmin = onSnapshot(adminRef, (docSnap) => {
            if (docSnap.exists()) {
                setAdminResults(docSnap.data());
                if (docSnap.data().activePhase) {
                    setActivePhase(docSnap.data().activePhase);
                }
            }
        });
        return () => unsubAdmin();
    }, []);

    const isSubTabLocked = useCallback((subTab) => {
        if (isAdmin) return false;
        if (activePhase === 'ALL_OPEN') return false;
        if (!subTab) return true;
        if (subTab.startsWith('Grupo')) return activePhase !== 'GROUP_STAGE';
        return activePhase !== subTab;
    }, [activePhase, isAdmin]);

    const isCurrentMainTabLocked = useMemo(() => {
        if (isAdmin) return false;
        if (activePhase === 'ALL_OPEN') return false;
        if (activeTab === 'partidos') return false; 
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

        groupMatches.forEach(m => {
            const home = m.homeTeam?.name || 'Por definir';
            const away = m.awayTeam?.name || 'Por definir';
            if (!teams[home]) teams[home] = { name: home, crest: m.homeTeam?.crest, pj: 0, pg: 0, pe: 0, pp: 0, gf: 0, gc: 0, dg: 0, pts: 0, isTied: false, tieOptions: [], tiedTeamNames: [] };
            if (!teams[away]) teams[away] = { name: away, crest: m.awayTeam?.crest, pj: 0, pg: 0, pe: 0, pp: 0, gf: 0, gc: 0, dg: 0, pts: 0, isTied: false, tieOptions: [], tiedTeamNames: [] };
        });

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
        const groupedByStats = {};
        teamsArray.forEach(t => {
            const key = `${t.pts}_${t.dg}_${t.gf}`;
            if (!groupedByStats[key]) groupedByStats[key] = [];
            groupedByStats[key].push(t);
        });

        const sortedKeys = Object.keys(groupedByStats).sort((a, b) => {
            const [ptsA, dgA, gfA] = a.split('_').map(Number);
            const [ptsB, dgB, gfB] = b.split('_').map(Number);
            if (ptsB !== ptsA) return ptsB - ptsA;
            if (dgB !== dgA) return dgB - dgA;
            return gfB - gfA;
        });

        let currentRank = 1;
        sortedKeys.forEach(key => {
            const groupTeams = groupedByStats[key];
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
            currentRank += numTeams;
        });

        return teamsArray.sort((a, b) => {
            if (b.pts !== a.pts) return b.pts - a.pts;
            if (b.dg !== a.dg) return b.dg - a.dg;
            if (b.gf !== a.gf) return b.gf - a.gf;
            const tieA = manualTiebreakers[groupName]?.[a.name] || 99;
            const tieB = manualTiebreakers[groupName]?.[b.name] || 99;
            if (tieA !== tieB) return tieA - tieB; 
            return translateTeam(a.name).localeCompare(translateTeam(b.name));
        });
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

    // --- LÓGICA RESTAURADA EXACTAMENTE COMO LA ORIGINAL PARA RONDAS ---
    const getAvailableTeamsForRound = (roundId) => {
        switch(roundId) {
            case 'dieciseisavos': return qualifiedRoundOf32.all32;
            case 'LAST_32': return qualifiedRoundOf32.all32;
            
            case 'octavos': return qualifiedRoundOf32.all32; // Se alimenta de los 32 equipos
            case 'LAST_16': return knockoutPicks.octavos || [];
            
            case 'cuartos': return knockoutPicks.octavos || []; // Se alimenta de los 16 elegidos
            case 'QUARTER_FINALS': return knockoutPicks.cuartos || [];
            
            case 'semis': return knockoutPicks.cuartos || [];
            case 'SEMI_FINALS': return knockoutPicks.semis || [];
            
            case 'campeon': case 'subcampeon': case 'tercero': case 'cuarto': return knockoutPicks.semis || [];
            case 'FINALS': return knockoutPicks.semis || [];
            
            default: return [];
        }
    };

    const getAvailableTeamsForSubTab = (subTab) => {
        const teams = getAvailableTeamsForRound(subTab);
        return teams && teams.length > 0 ? teams : qualifiedRoundOf32.all32;
    };

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

    const handleScoreChange = (matchId, team, value) => {
        if (activeTab === 'partidos' ? isSubTabLocked(selectedSubTab) : isCurrentMainTabLocked) return;
        if (value !== '' && (isNaN(value) || value < 0 || value > 99)) return;
        setPredictions(prev => ({
            ...prev,
            [matchId]: {
                ...prev[matchId],
                [team]: value === '' ? '' : parseInt(value, 10)
            }
        }));
    };

    const handleCustomTeamChange = (matchId, side, teamName) => {
        if (!isAdmin) return; 
        setPredictions(prev => ({
            ...prev,
            [matchId]: {
                ...(prev[matchId] || {}),
                [side === 'home' ? 'customHomeTeam' : 'customAwayTeam']: teamName
            }
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
            
            if (newVal === 0) {
                groupTies[teamName] = 0;
                return { ...prev, [group]: groupTies };
            }

            const previousTeamWithVal = tiedTeamNames.find(t => t !== teamName && groupTies[t] === newVal);
            const oldVal = groupTies[teamName];
            
            groupTies[teamName] = newVal;

            if (previousTeamWithVal && oldVal && tieOptions.includes(oldVal)) {
                groupTies[previousTeamWithVal] = oldVal;
            } else if (previousTeamWithVal) {
                groupTies[previousTeamWithVal] = 0; 
            }

            const assignedValues = tiedTeamNames.map(t => groupTies[t]).filter(v => tieOptions.includes(v));
            if (assignedValues.length === tieOptions.length - 1) {
                const missingOption = tieOptions.find(opt => !assignedValues.includes(opt));
                const missingTeam = tiedTeamNames.find(t => !tieOptions.includes(groupTies[t]));
                if (missingOption && missingTeam) {
                    groupTies[missingTeam] = missingOption;
                }
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
                    podiumSlots.forEach(slot => {
                        newPicks[slot] = (newPicks[slot] || []).filter(t => t.name !== team.name);
                    });
                }
                return newPicks;
            } else {
                const newPicks = { ...prev };
                if (limit === 1) {
                    podiumSlots.forEach(slot => { newPicks[slot] = (newPicks[slot] || []).filter(t => t.name !== team.name); });
                    newPicks[roundId] = [team];
                    return newPicks;
                }
                if (podiumSlots.includes(roundId)) {
                    podiumSlots.forEach(slot => newPicks[slot] = (newPicks[slot] || []).filter(t => t.name !== team.name));
                }
                if ((newPicks[roundId] || []).length < limit) {
                    newPicks[roundId] = [...(newPicks[roundId] || []), team];
                }
                return newPicks;
            }
        });
    };

    const handleAdminSetPhase = async (phase) => {
        if (!window.confirm(`¿Seguro que deseas cambiar la fase a ${phase}? Las demás fases quedarán bloqueadas para los usuarios.`)) return;
        try {
            await setDoc(doc(db, 'worldCupAdmin', 'results'), { activePhase: phase }, { merge: true });
            toast.success(`Fase cambiada a: ${phase}`);
        } catch (error) {
            toast.error("Error al cambiar la fase");
        }
    };

    const handleSavePredictions = async () => {
        if (activeTab === 'partidos' ? isSubTabLocked(selectedSubTab) : isCurrentMainTabLocked) {
            toast.error("Esta sección está bloqueada, no puedes guardar cambios aquí.");
            return;
        }

        setSaving(true);
        const predictionData = {
            predictions, knockoutPicks, extraPicks, eventPicks, manualTiebreakers,
            updatedAt: new Date().toISOString()
        };

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
        
        Object.values(matchesByGroup).flat().forEach(m => {
            newPreds[m.id] = { home: Math.floor(Math.random() * 4), away: Math.floor(Math.random() * 4) };
        });
        
        Object.values(knockoutMatches).flat().forEach(m => {
             newPreds[m.id] = {
                home: Math.floor(Math.random() * 4),
                away: Math.floor(Math.random() * 4),
                customHomeTeam: shuffledTeams[Math.floor(Math.random() * shuffledTeams.length)]?.name,
                customAwayTeam: shuffledTeams[Math.floor(Math.random() * shuffledTeams.length)]?.name
            };
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
        if (subTabsRef.current) {
            const scrollAmount = 300; 
            subTabsRef.current.scrollBy({
                left: direction === 'left' ? -scrollAmount : scrollAmount,
                behavior: 'smooth'
            });
        }
    };

    const handleRoundTabScroll = (direction) => {
        if (roundTabsRef.current) {
            const scrollAmount = 250; 
            roundTabsRef.current.scrollBy({
                left: direction === 'left' ? -scrollAmount : scrollAmount,
                behavior: 'smooth'
            });
        }
    };

    const renderMatchCard = (match, subTabName) => {
        const isLocked = isSubTabLocked(subTabName);
        const allowTbdInput = activePhase === 'ALL_OPEN';
        
        const homeOriginal = match.homeTeam?.name;
        const awayOriginal = match.awayTeam?.name;
        
        const isUnknownHome = !homeOriginal || homeOriginal === 'TBD' || homeOriginal.includes('Winner') || homeOriginal.includes('Loser');
        const isUnknownAway = !awayOriginal || awayOriginal === 'TBD' || awayOriginal.includes('Winner') || awayOriginal.includes('Loser');
        
        const customHome = predictions[match.id]?.customHomeTeam || '';
        const customAway = predictions[match.id]?.customAwayTeam || '';
        
        // JUGADORES VEN EL EQUIPO QUE PUSO EL ADMIN, ADMIN VE SU PROPIO SELECTOR
        const displayHome = isUnknownHome ? (isAdmin ? customHome : (adminResults?.predictions?.[match.id]?.customHomeTeam || '')) : homeOriginal;
        const displayAway = isUnknownAway ? (isAdmin ? customAway : (adminResults?.predictions?.[match.id]?.customAwayTeam || '')) : awayOriginal;
        
        const homeCrest = isUnknownHome && displayHome ? allTeams.find(t=>t.name === displayHome)?.crest : match.homeTeam?.crest;
        const awayCrest = isUnknownAway && displayAway ? allTeams.find(t=>t.name === displayAway)?.crest : match.awayTeam?.crest;

        const availableTeams = getAvailableTeamsForSubTab(subTabName) || allTeams;

        return (
            <div key={match.id} className={`bg-card border ${isLocked ? 'border-border/50 opacity-80' : 'border-card-border hover:border-primary/50'} rounded-2xl shadow-sm relative overflow-hidden flex flex-col transition-all`}>
                <div className="bg-background-offset px-4 py-2.5 flex justify-between items-center border-b border-border">
                    <div className="flex items-center gap-2">
                        <span className="text-[9px] font-black text-background bg-primary px-2 py-0.5 rounded uppercase tracking-wider shadow-sm">
                            {match.group ? match.group.replace('GROUP_', 'Grupo ') : stageTranslations[match.stage] || match.stage.replace(/_/g, ' ')}
                        </span>
                    </div>
                    <span className="text-[10px] text-foreground-muted font-semibold uppercase tracking-wider">
                        {new Date(match.utcDate).toLocaleDateString('es-ES', { weekday: 'short', day: '2-digit', month: 'short', hour:'2-digit', minute:'2-digit' }).replace('.', '')}
                    </span>
                </div>

                <div className="p-4 flex flex-col gap-3 relative z-10">
                    <img src={logocopa} alt="" className="absolute right-2 top-1/2 -translate-y-1/2 w-28 opacity-[0.03] grayscale pointer-events-none" />
                    
                    <div className="flex items-center justify-between relative z-10">
                        <div className="flex items-center gap-2 sm:gap-4 overflow-hidden pr-2">
                            <div className="w-10 h-6 sm:w-14 sm:h-9 bg-background rounded-[4px] overflow-hidden shadow-[0_2px_5px_rgba(0,0,0,0.1)] border border-border/50 shrink-0 relative flex items-center justify-center">
                                {homeCrest ? <img src={homeCrest} className="w-full h-full object-cover" alt="" /> : <span className="text-xl opacity-30">🛡️</span>}
                            </div>
                            {isAdmin && isUnknownHome ? (
                                <select 
                                    value={displayHome} 
                                    onChange={(e) => handleCustomTeamChange(match.id, 'home', e.target.value)}
                                    disabled={isLocked}
                                    className="bg-background-offset border border-border/50 text-[10px] sm:text-xs font-bold rounded p-1 truncate w-24 sm:w-32 focus:ring-1 focus:ring-primary disabled:opacity-50"
                                >
                                    <option value="">Definir...</option>
                                    {availableTeams.map((t, i) => <option key={`home-${t.name}-${i}`} value={t.name}>{translateTeam(t.name)}</option>)}
                                </select>
                            ) : (
                                <span className={`font-bold text-sm sm:text-base truncate drop-shadow-sm ${!displayHome ? 'text-foreground-muted italic' : 'text-foreground'}`}>
                                    {displayHome ? translateTeam(displayHome) : 'Por Definir'}
                                </span>
                            )}
                            {/* ... después del Panel Maestro del Admin y antes de las Tabs Principales ... */}

                        </div>
                        <input 
                            type="number" 
                            className="w-12 h-12 sm:w-14 sm:h-14 text-center bg-background border border-card-border rounded-xl text-xl sm:text-2xl font-black text-foreground focus:ring-2 focus:ring-primary shadow-inner shrink-0 transition-all disabled:opacity-50 disabled:bg-background-offset" 
                            placeholder="-" 
                            disabled={isLocked || (!displayHome && !allowTbdInput)}
                            value={predictions[match.id]?.home ?? ''} 
                            onChange={(e) => handleScoreChange(match.id, 'home', e.target.value)} 
                        />
                    </div>

                    <div className="flex items-center justify-between relative z-10">
                        <div className="flex items-center gap-2 sm:gap-4 overflow-hidden pr-2">
                            <div className="w-10 h-6 sm:w-14 sm:h-9 bg-background rounded-[4px] overflow-hidden shadow-[0_2px_5px_rgba(0,0,0,0.1)] border border-border/50 shrink-0 relative flex items-center justify-center">
                                {awayCrest ? <img src={awayCrest} className="w-full h-full object-cover" alt="" /> : <span className="text-xl opacity-30">🛡️</span>}
                            </div>
                            {isAdmin && isUnknownAway ? (
                                <select 
                                    value={displayAway} 
                                    onChange={(e) => handleCustomTeamChange(match.id, 'away', e.target.value)}
                                    disabled={isLocked}
                                    className="bg-background-offset border border-border/50 text-[10px] sm:text-xs font-bold rounded p-1 truncate w-24 sm:w-32 focus:ring-1 focus:ring-primary disabled:opacity-50"
                                >
                                    <option value="">Definir...</option>
                                    {availableTeams.map((t, i) => <option key={`away-${t.name}-${i}`} value={t.name}>{translateTeam(t.name)}</option>)}
                                </select>
                            ) : (
                                <span className={`font-bold text-sm sm:text-base truncate drop-shadow-sm ${!displayAway ? 'text-foreground-muted italic' : 'text-foreground'}`}>
                                    {displayAway ? translateTeam(displayAway) : 'Por Definir'}
                                </span>
                            )}
                        </div>
                        <input 
                            type="number" 
                            className="w-12 h-12 sm:w-14 sm:h-14 text-center bg-background border border-card-border rounded-xl text-xl sm:text-2xl font-black text-foreground focus:ring-2 focus:ring-primary shadow-inner shrink-0 transition-all disabled:opacity-50 disabled:bg-background-offset" 
                            placeholder="-" 
                            disabled={isLocked || (!displayAway && !allowTbdInput)}
                            value={predictions[match.id]?.away ?? ''} 
                            onChange={(e) => handleScoreChange(match.id, 'away', e.target.value)} 
                        />
                    </div>
                </div>
            </div>
        );
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
                <div className="bg-gradient-to-r from-purple-900 to-indigo-900 p-5 rounded-3xl mb-8 border border-purple-500/30 shadow-xl relative overflow-hidden animate-fade-in">
                    <div className="absolute right-0 top-0 h-full w-32 bg-white/5 skew-x-12 pointer-events-none"></div>
                    <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
                        <div>
                            <div className="flex items-center gap-3 mb-2">
                                <span className="text-3xl drop-shadow-md">🕹️</span>
                                <div>
                                    <h3 className="text-white font-black text-lg uppercase tracking-widest leading-none">Panel Maestro</h3>
                                    <p className="text-purple-200 text-xs">Fase Activa: Los jugadores solo pueden guardar datos en la fase seleccionada.</p>
                                </div>
                            </div>
                            <div className="flex flex-wrap gap-2 mt-4">
                                {TOURNAMENT_PHASES.map(phase => (
                                    <button
                                        key={phase.id}
                                        onClick={() => handleAdminSetPhase(phase.id)}
                                        className={`px-4 py-2 rounded-xl font-bold text-xs transition-all shadow-sm ${activePhase === phase.id ? 'bg-purple-500 text-white ring-2 ring-purple-300 ring-offset-2 ring-offset-indigo-900' : 'bg-background/20 text-purple-100 hover:bg-background/40 border border-white/10'}`}
                                    >
                                        {phase.id === 'ALL_OPEN' ? '🔓' : '🔒'} {phase.label}
                                    </button>
                                ))}
                            </div>
                        </div>
                        
                        <div className="flex md:flex-col gap-2 shrink-0 border-t md:border-t-0 md:border-l border-white/10 pt-4 md:pt-0 md:pl-4">
                            <button onClick={handleClearData} type="button" className="bg-red-600 text-white font-black py-2 px-4 rounded-xl shadow-lg hover:scale-105 active:scale-95 transition-transform flex items-center justify-center gap-2 flex-1">
                                <span>🧹</span><span className="text-[10px] uppercase tracking-wider">Limpiar</span>
                            </button>
                            <button onClick={handleSimulateData} type="button" className="bg-fuchsia-600 text-white font-black py-2 px-4 rounded-xl shadow-lg hover:scale-105 active:scale-95 transition-transform flex items-center justify-center gap-2 flex-1">
                                <span>🎲</span><span className="text-[10px] uppercase tracking-wider">Random</span>
                            </button>
                        </div>
                    </div>
                </div>
            )}

            <div className="mb-8 text-center animate-fade-in">
                <h2 className="text-3xl sm:text-4xl font-extrabold text-foreground tracking-tighter mb-2">
                    {isAdmin ? '👑 Resultados Reales' : 'Mis Predicciones'}
                </h2>
                <p className="text-foreground-muted text-sm max-w-2xl mx-auto">
                    {isAdmin 
                        ? 'Estás guardando los resultados oficiales del torneo fase por fase.' 
                        : 'El Torneo se juega por etapas. Completa tus predicciones en la pestaña que esté activa.'}
                </p>
            </div>

            {/* AVISO DE FASE BLOQUEADA PARA USUARIOS */}
            {(activeTab === 'partidos' ? isSubTabLocked(selectedSubTab) : isCurrentMainTabLocked) && (
                <div className="bg-red-500/10 border border-red-500/20 p-4 rounded-2xl mb-8 flex items-center justify-center gap-3 animate-fade-in shadow-sm z-50">
                    <span className="text-2xl animate-pulse">🔒</span>
                    <p className="text-sm font-bold text-red-500 uppercase tracking-widest">Esta fase está cerrada para predicciones.</p>
                </div>
            )}

            {!isAdmin && (
                <div className="space-y-4 mb-8">
                    {!hasPaid && (
                        <div className="bg-amber-500/10 border border-amber-500/20 rounded-2xl p-4 sm:p-5 flex items-start sm:items-center gap-3 shadow-sm animate-fade-in">
                            <div className="text-2xl sm:text-3xl shrink-0">💳</div>
                            <div>
                                <h3 className="font-bold text-amber-500 mb-1 text-sm sm:text-base">Pago Pendiente</h3>
                                <p className="text-xs sm:text-sm text-foreground-muted leading-relaxed">
                                    Aún no se ha confirmado el pago de tu inscripción. Recuerda que es requisito indispensable para participar.{' '}
                                    <a href="https://wa.me/573144261190" target="_blank" rel="noopener noreferrer" className="text-amber-500 font-bold underline hover:text-amber-400 transition-colors">
                                        Paga aquí vía WhatsApp.
                                    </a>
                                </p>
                            </div>
                        </div>
                    )}
                    
                    {missingSections.length > 0 ? (
                        <div className="bg-red-500/10 border border-red-500/20 rounded-2xl p-4 sm:p-5 flex items-start gap-3 shadow-sm animate-fade-in">
                            <div className="text-2xl shrink-0">⚠️</div>
                            <div>
                                <h3 className="font-bold text-red-500 mb-1 text-sm sm:text-base">Tu predicción está incompleta</h3>
                                <p className="text-xs sm:text-sm text-foreground-muted leading-relaxed">
                                    Faltan predicciones en la fase activa. Te falta completar: <strong className="text-foreground">{missingSections.join(' • ')}</strong>
                                </p>
                            </div>
                        </div>
                    ) : (
                        <div className="bg-green-500/10 border border-green-500/20 rounded-2xl p-4 sm:p-5 flex items-start sm:items-center gap-3 shadow-sm animate-fade-in">
                            <div className="text-2xl sm:text-3xl shrink-0">✅</div>
                            <div>
                                <h3 className="font-bold text-green-500 mb-1 text-sm sm:text-base">¡Todo listo en esta Fase!</h3>
                                <p className="text-xs sm:text-sm text-foreground-muted">Has completado todas las predicciones habilitadas. Recuerda presionar Guardar.</p>
                            </div>
                        </div>
                    )}
                </div>
            )}
            

            {/* --- NUEVOS TABS PRINCIPALES PROFESIONALES --- */}
            <div className="mb-8 w-full flex justify-center sticky top-16 sm:top-20 z-[30] animate-fade-in px-1 sm:px-4">
                <div className="bg-card border border-card-border p-1.5 sm:p-2 rounded-[2rem] sm:rounded-full shadow-xl flex w-full max-w-3xl items-center justify-between gap-1 backdrop-blur-sm relative overflow-hidden group">
                    <div className="absolute left-0 top-0 w-32 h-32 bg-primary/10 rounded-full filter blur-3xl -translate-x-16 -translate-y-16 pointer-events-none opacity-50"></div>
                    <div className="absolute right-0 bottom-0 w-32 h-32 bg-primary/10 rounded-full filter blur-3xl translate-x-16 translate-y-16 pointer-events-none opacity-50"></div>
                    
                    {tabs.map((tab) => {
                        const isSelected = activeTab === tab.id;
                        const isLocked = !isAdmin && activePhase !== 'ALL_OPEN' && activePhase !== tab.linkedPhase && tab.id !== 'partidos';
                        
                        return (
                            <button
                                key={tab.id}
                                onClick={() => setActiveTab(tab.id)}
                                disabled={isLocked}
                                className={`flex flex-1 flex-col sm:flex-row items-center justify-center gap-0.5 sm:gap-2.5 py-2 sm:py-0 sm:h-12 px-0.5 sm:px-6 rounded-xl sm:rounded-full font-black transition-all duration-300 relative overflow-hidden disabled:opacity-50 disabled:grayscale ${
                                    isSelected 
                                    ? 'bg-gradient-to-br from-primary to-amber-600 text-white shadow-lg shadow-amber-500/30 sm:scale-105 z-10' 
                                    : 'bg-transparent text-foreground-muted hover:bg-background-offset hover:text-foreground hover:border-primary/50'
                                }`}
                            >
                                {isSelected && (
                                    <div className="absolute inset-0 bg-black/10 rounded-full scale-110 blur-md pointer-events-none"></div>
                                )}
                                <span className="text-[18px] sm:text-base relative z-10 leading-none mb-0.5 sm:mb-0">{isLocked ? '🔒' : tab.icon}</span>
                                <span className="text-[8px] sm:text-xs uppercase tracking-tight sm:tracking-wider text-center relative z-10 w-full whitespace-nowrap">{tab.label}</span>
                            </button>
                        );
                    })}
                </div>
            </div>
            {/* --- FIN NUEVOS TABS PRINCIPALES --- */}


            {/* --- 1. PESTAÑA: MARCADORES --- */}
            {activeTab === 'partidos' && (
                <div className="animate-fade-in">
                    
                    {/* --- NUEVOS TABS PROFESIONALES DE SUB-FASES CON FLECHAS --- */}
                    <div className="relative w-full mb-6 flex items-center group">
                        <div className="absolute left-0 top-0 bottom-0 w-8 bg-gradient-to-r from-background to-transparent z-10 pointer-events-none rounded-l-2xl"></div>
                        <div className="absolute right-0 top-0 bottom-0 w-8 bg-gradient-to-l from-background to-transparent z-10 pointer-events-none rounded-r-2xl"></div>
                        
                        <button onClick={() => handleSubTabScroll('left')} className="absolute left-0 z-20 bg-card border border-border text-foreground p-1.5 rounded-full shadow-lg hidden md:flex hover:bg-primary hover:text-white transition-all hover:scale-110 ml-0">
                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-4 h-4">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
                            </svg>
                        </button>

                        <div ref={subTabsRef} className="flex overflow-x-auto hide-scrollbar gap-2 sm:gap-3 pb-4 pt-2 px-2 md:px-10 snap-x scroll-smooth items-center w-full">
                            
                            {Object.keys(matchesByGroup).sort((a,b)=>a.localeCompare(b)).map(gn => {
                                const isSelected = selectedSubTab === gn;
                                return (
                                    <button 
                                        key={gn} 
                                        onClick={() => setSelectedSubTab(gn)} 
                                        className={`snap-center shrink-0 flex flex-col items-center justify-center min-w-[70px] sm:min-w-[85px] h-14 sm:h-16 rounded-[1rem] font-black transition-all duration-300 relative border overflow-hidden ${
                                            isSelected 
                                            ? 'bg-gradient-to-b from-primary to-amber-600 text-white shadow-[0_8px_20px_-6px_rgba(245,158,11,0.6)] border-transparent scale-105 z-10' 
                                            : 'bg-card text-foreground-muted border-border hover:bg-background-offset hover:border-primary/50 hover:-translate-y-1 shadow-sm'
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
                                        key={ko.id} 
                                        onClick={() => setSelectedSubTab(ko.id)} 
                                        className={`snap-center shrink-0 flex items-center justify-center px-4 sm:px-6 h-14 sm:h-16 rounded-[1rem] font-black transition-all duration-300 relative border overflow-hidden ${
                                            isSelected 
                                            ? 'bg-gradient-to-br from-indigo-500 to-purple-600 text-white shadow-[0_8px_20px_-6px_rgba(99,102,241,0.6)] border-transparent scale-105 z-10' 
                                            : 'bg-card text-foreground-muted border-border hover:bg-background-offset hover:border-indigo-500/50 hover:-translate-y-1 shadow-sm'
                                        }`}
                                    >
                                        <span className="text-[10px] sm:text-xs uppercase tracking-widest">{ko.label}</span>
                                    </button>
                                );
                            })}
                        </div>

                        <button onClick={() => handleSubTabScroll('right')} className="absolute right-0 z-20 bg-card border border-border text-foreground p-1.5 rounded-full shadow-lg hidden md:flex hover:bg-primary hover:text-white transition-all hover:scale-110 mr-0">
                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-4 h-4">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
                            </svg>
                        </button>
                    </div>


                    {selectedSubTab?.startsWith('Grupo') ? (
                        <div className="grid grid-cols-1 xl:grid-cols-12 gap-8 animate-fade-in">
                            <div className="xl:col-span-7 space-y-4">
                                <div className="flex items-center justify-between border-b border-border pb-3 mb-4 gap-4">
                                    <div className="flex items-center gap-3 min-w-0 flex-1">
                                        {/* --- NUEVO CONTENEDOR DEL LOGO (SIN FONDO NEGRO) --- */}
                                        <div className="w-10 h-10 sm:w-12 sm:h-12 bg-gradient-to-b from-card to-background-offset border border-amber-500/30 rounded-full p-1.5 flex items-center justify-center shrink-0 shadow-lg relative overflow-hidden">
                                            <div className="absolute inset-0 bg-primary/5 filter blur-xl"></div>
                                            <img src={logocopa} alt="Copa" className="w-full h-full object-contain filter drop-shadow-md relative z-10" />
                                        </div>
                                        <h3 className="text-xl sm:text-2xl font-black text-primary uppercase tracking-widest truncate min-w-0 flex-1">
                                            {selectedSubTab}
                                        </h3>
                                    </div>
                                    
                                    <div className="flex items-center gap-1 sm:gap-1.5 shrink-0">
                                        {currentGroupStandings.map(team => (
                                            <div key={team.name} className="w-5 h-3.5 sm:w-7 sm:h-5 bg-background rounded-[3px] overflow-hidden shadow-sm border border-border/50 relative" title={translateTeam(team.name)}>
                                                <img src={team.crest} className="w-full h-full object-cover" alt="" />
                                            </div>
                                        ))}
                                    </div>
                                </div>
                                <div className="mb-6">
    <StatsBanner activeGroup={selectedSubTab} />
</div>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                                    {matchesByGroup[selectedSubTab].map(match => renderMatchCard(match, selectedSubTab))}
                                </div>
                            </div>
                            
                            
                            <div className="xl:col-span-5">
                                <div className="bg-card border border-card-border rounded-3xl p-3 sm:p-6 shadow-sm sticky top-48">
                                    <div className="flex items-center justify-between mb-4">
                                        <h3 className="text-xl font-black text-foreground ml-2 sm:ml-0">Tabla Proyectada</h3>
                                    </div>
                                    
                                    {hasTiesInGroup && (
                                        <div className="bg-amber-500/10 border border-amber-500/20 p-3 rounded-xl mb-4 flex items-start gap-2 animate-fade-in mx-2 sm:mx-0">
                                            <span className="text-amber-500 text-lg">⚖️</span>
                                            <p className="text-[11px] sm:text-xs text-amber-500 font-bold leading-tight">
                                                Hay un empate total en puntos y goles. Elige explícitamente en el  <strong className="text-amber-400">selector de desempate</strong> la posición de cada equipo (1º, 2º...) para romper el empate.
                                            </p>
                                        </div>
                                    )}

                                    <div className="overflow-x-auto px-2 sm:px-0">
                                        <table className="w-full text-sm">
    <thead>
        <tr className="border-b border-border text-foreground-muted text-[10px]">
            <th className="pb-2 text-left">Equipo</th>
            <th className="pb-2 text-center">PJ</th>
            <th className="pb-2 text-center">GF</th>
            <th className="pb-2 text-center">DG</th>
            <th className="pb-2 text-center font-black text-primary">PTS</th>
            {/* Columna sin nombre para ganar espacio para el selector de desempate */}
            <th className="pb-2 text-center w-8 sm:w-12"></th> 
        </tr>
    </thead>
    <tbody>
        {currentGroupStandings.map((team, idx) => (
            <tr key={team.name} className="border-b border-border/50 last:border-0 h-12">
                <td className="flex items-center gap-1.5 sm:gap-2 h-12 overflow-hidden pr-1">
                    <div className="w-5 h-3.5 sm:w-6 sm:h-4 bg-background rounded-sm overflow-hidden border border-border/50 shrink-0">
                        <img src={team.crest} className="w-full h-full object-cover" alt="" />
                    </div>
                    <span className="font-bold truncate text-[11px] sm:text-sm">{translateTeam(team.name)}</span>
                </td>
                <td className="text-center font-medium text-foreground-muted text-xs">{team.pj}</td>
                <td className="text-center font-medium text-foreground-muted text-xs">{team.gf}</td>
                <td className="text-center font-medium text-foreground-muted text-xs">{team.dg > 0 ? `+${team.dg}` : team.dg}</td>
                <td className="text-center font-black text-primary text-xs sm:text-sm">{team.pts}</td>
                
                <td className="text-center">
                    {team.isTied ? (
                        <select 
                            value={manualTiebreakers[selectedSubTab]?.[team.name] || ''} 
                            onChange={(e) => handleManualTiebreaker(selectedSubTab, team.name, e.target.value, team.tiedTeamNames, team.tieOptions)} 
                            className="bg-background-offset border border-amber-500/50 rounded-md px-1 py-0.5 text-[9px] sm:text-[10px] font-black text-amber-500 shadow-sm"
                        >
                            <option value="">-</option>
                            {team.tieOptions.map(o => <option key={o} value={o}>{o}º</option>)}
                        </select>
                    ) : (
                        <span className="font-bold text-foreground-muted opacity-30 text-[9px] sm:text-[10px]">{idx + 1}º</span>
                    )}
                </td>
            </tr>
        ))}
    </tbody>
</table>
                                    </div>
                                </div>
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
                                    {knockoutMatches[selectedSubTab].map(match => renderMatchCard(match, selectedSubTab))}
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
            

            {/* 2. PESTAÑA: CLASIFICADOS --- */}
            {activeTab === 'rondas' && (
                <div className="animate-fade-in">
                    
                    {/* --- NUEVOS TABS PROFESIONALES DE RONDAS CON FLECHAS (PÍLDORAS) --- */}
                    {/* --- SUB-TABS CLASIFICADOS (AJUSTE PC CENTRADO) --- */}
<div className="relative w-full mb-8 flex items-center group justify-center">
    {/* Botón Flecha Izquierda (Oculto en PC) */}
    <button onClick={() => handleRoundTabScroll('left')} className="absolute left-0 z-20 bg-card border border-border p-1.5 rounded-full shadow-lg md:hidden">
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-4 h-4"><path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" /></svg>
    </button>

    <div ref={roundTabsRef} className="flex overflow-x-auto md:overflow-visible hide-scrollbar gap-3 pb-4 pt-2 px-2 md:px-0 md:justify-center w-full md:w-auto snap-x scroll-smooth items-center">
        {roundTabs.map(rt => {
            const isSelected = activeRoundTab === rt.id;
            const currentPicks = rt.id === 'dieciseisavos' ? 32 : (knockoutPicks[rt.id]?.length || 0);
            return (
                <button 
                    key={rt.id} 
                    onClick={() => setActiveRoundTab(rt.id)} 
                    className={`snap-center shrink-0 flex flex-col items-center justify-center min-w-[85px] h-16 rounded-2xl border transition-all ${
                        isSelected 
                        ? 'bg-gradient-to-b from-primary to-amber-600 text-white shadow-lg border-transparent scale-105 z-10' 
                        : 'bg-card text-foreground-muted border-border hover:bg-background-offset'
                    }`}
                >
                    <span className="text-[10px] font-black uppercase">{rt.label}</span>
                    <span className={`text-[9px] font-bold mt-1 px-2 py-0.5 rounded-full ${currentPicks === rt.limit ? 'bg-green-500/20 text-green-500' : 'bg-black/20 text-white/50'}`}>{currentPicks}/{rt.limit}</span>
                </button>
                
            );
        })}
    </div>

    {/* Botón Flecha Derecha (Oculto en PC) */}
    <button onClick={() => handleRoundTabScroll('right')} className="absolute right-0 z-20 bg-card border border-border p-1.5 rounded-full shadow-lg md:hidden">
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-4 h-4"><path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" /></svg>
    </button>
</div>
{/* --- AVISO INFORMATIVO DINÁMICO DE RONDAS (REFINADO) --- */}
<div className="mb-6 px-4">
    <div className="bg-primary/10 border border-primary/20 rounded-2xl p-4 flex items-center gap-4 shadow-sm animate-fade-in">
        <div className="text-2xl shrink-0">
            {activeRoundTab === 'dieciseisavos' ? '📋' : '🏆'}
        </div>
        <div>
            <h4 className="text-primary font-black text-xs uppercase tracking-widest mb-0.5">
                {activeRoundTab === 'dieciseisavos' ? 'Información' : 'Predicción de Podio'}
            </h4>
            <p className="text-foreground-muted text-[11px] sm:text-xs leading-tight font-medium">
                {(() => {
                    switch (activeRoundTab) {
                        case 'dieciseisavos':
                            return 'Estos son tus 32 clasificados automáticos según los marcadores que pusiste en la Fase de Grupos.';
                        case 'campeon':
                            return '¡El momento de la verdad! Selecciona al equipo que se coronará Campeón del Mundo.';
                        case 'subcampeon':
                            return 'Selecciona al equipo que crees que perderá la final y quedará en segundo lugar.';
                        case 'tercero':
                            return 'Selecciona al equipo que ganará el partido por el tercer puesto.';
                        case 'cuarto':
                            return 'Selecciona al equipo que perderá el partido por el tercer puesto.';
                        default:
                            const limit = roundTabs.find(r => r.id === activeRoundTab)?.limit;
                            return `Selecciona a los ${limit} equipos que crees que avanzarán a la ronda de ${activeRoundTab}.`;
                    }
                })()}
            </p>
        </div>
    </div>
</div>

                    <div className="bg-background-offset border border-border p-6 sm:p-10 rounded-3xl shadow-sm">
                        
                        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-4">
                            {activeRoundTab === 'dieciseisavos' ? (
                                qualifiedRoundOf32.all32.map((team, idx) => (
                                    <div key={idx} className="bg-card border border-card-border p-3 sm:p-4 rounded-xl flex flex-col items-center text-center shadow-sm relative overflow-hidden h-full">
                                        <div className="w-12 h-8 bg-background rounded-[4px] overflow-hidden border border-border/50 mb-2 shrink-0"><img src={team.crest} className="w-full h-full object-cover" alt="" /></div>
                                        <span className="font-bold text-[11px] sm:text-xs text-foreground mb-3 flex-grow">{translateTeam(team.name)}</span>
                                        <span className="text-[8px] font-black uppercase bg-primary/10 text-primary px-1.5 py-0.5 rounded">{team.qualReason} {team.group ? team.group.replace('Grupo ', '') : ''}</span>
                                    </div>
                                ))
                            ) : (
                                getAvailableTeamsForRound(activeRoundTab).map((team, idx) => {
                                    const limit = roundTabs.find(t => t.id === activeRoundTab).limit;
                                    const isSelected = knockoutPicks[activeRoundTab].some(t => t.name === team.name);
                                    return (
                                        <button key={idx} onClick={() => toggleKnockoutPick(activeRoundTab, team, limit)} disabled={isCurrentMainTabLocked} className={`p-3 sm:p-4 rounded-2xl flex flex-col items-center text-center transition-all border-2 h-full disabled:opacity-50 ${isSelected ? 'bg-primary/10 border-primary scale-105 shadow-md' : 'bg-card border-card-border hover:border-primary/50'}`}>
                                            <div className="w-12 h-8 bg-background rounded-[4px] overflow-hidden border border-border/50 mb-2 sm:mb-3 shrink-0"><img src={team.crest} className="w-full h-full object-cover" alt="" /></div>
                                            <span className={`font-bold text-[11px] sm:text-sm flex-grow ${isSelected ? 'text-primary' : 'text-foreground'}`}>{translateTeam(team.name)}</span>
                                        </button>
                                    );
                                })
                            )}
                        </div>
                    </div>
                    
                </div>
            )}

            {/* 3. PESTAÑA: EXTRAS --- */}
            {activeTab === 'extras' && (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 animate-fade-in">
                    {extraQuestions.map(q => (
                        <div key={q.id} className="bg-background-offset border border-border rounded-2xl p-5 shadow-sm">
                            <h4 className="text-base font-black text-foreground mb-1">{q.label}</h4>
                            <p className="text-xs text-foreground-muted mb-4">{q.desc}</p>
                            {q.type === 'player' ? (
                                <input type="text" placeholder="Nombre..." disabled={isCurrentMainTabLocked} value={extraPicks[q.id] || ''} onChange={(e) => handleExtraChange(q.id, e.target.value)} className="w-full bg-card border rounded-xl py-3 px-4 text-sm font-semibold disabled:opacity-50" />
                            ) : (
                                <select value={extraPicks[q.id] || ''} disabled={isCurrentMainTabLocked} onChange={(e) => handleExtraChange(q.id, e.target.value)} className="w-full bg-card border rounded-xl py-3 px-4 text-sm font-semibold disabled:opacity-50">
                                    <option value="">Selecciona...</option>
                                    {q.type === 'team' ? allTeams.map(t => <option key={t.name} value={t.name}>{translateTeam(t.name)}</option>) : Object.keys(matchesByGroup).map(g => <option key={g} value={g}>{g}</option>)}
                                </select>
                            )}
                        </div>
                    ))}
                </div>
            )}

            {/* 4. PESTAÑA: EVENTOS --- */}
            {activeTab === 'eventos' && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 animate-fade-in">
                    {specialEvents.map(e => (
                        <div key={e.id} className="bg-background-offset border border-border rounded-2xl p-5 shadow-sm flex flex-col sm:flex-row justify-between items-center gap-4">
                            <div className="flex-1">
                                <h4 className="text-base font-black text-foreground mb-1">{e.label}</h4>
                                <p className="text-xs text-foreground-muted">{e.desc}</p>
                            </div>
                            <div className="flex items-center gap-2 bg-card p-1.5 rounded-xl border">
                                {['SI', 'NO'].map(opt => (
                                    <button key={opt} disabled={isCurrentMainTabLocked} onClick={() => handleEventChange(e.id, opt)} className={`w-20 py-2 rounded-lg font-black text-sm disabled:opacity-50 ${eventPicks[e.id] === opt ? (opt === 'SI' ? 'bg-green-500 text-white' : 'bg-red-500 text-white') : 'text-foreground-muted'}`}>
                                        {opt}
                                    </button>
                                ))}
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* BOTÓN FLOTANTE GUARDAR */}
            {!(activeTab === 'partidos' ? isSubTabLocked(selectedSubTab) : isCurrentMainTabLocked) && (
                <div className="fixed bottom-28 md:bottom-10 right-4 sm:right-10 z-[30] flex flex-col gap-3 items-end animate-slide-up">
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