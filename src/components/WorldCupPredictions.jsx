import React, { useState, useEffect, useMemo } from 'react';
import { db } from '../firebase'; 
import { doc, setDoc, getDoc, onSnapshot } from 'firebase/firestore';
import { getWorldCupMatches } from '../services/apiFootball';
import toast from 'react-hot-toast'; // <-- Sistema de avisos profesional

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
    "Uruguay": "Uruguay", "Venezuela": "Venezuela", "Wales": "Gales", "Por definir": "Por definir"
};

const translateTeam = (englishName) => {
    return teamTranslations[englishName] || englishName;
};

const WorldCupPredictions = ({ currentUser }) => {
    const [activeTab, setActiveTab] = useState('grupos');
    const [matchesByGroup, setMatchesByGroup] = useState({});
    const [selectedGroup, setSelectedGroup] = useState(null); 
    const [predictions, setPredictions] = useState({});
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState(null);
    const [hasPaid, setHasPaid] = useState(false);

    const [activeRoundTab, setActiveRoundTab] = useState('dieciseisavos');
    const [knockoutPicks, setKnockoutPicks] = useState({
        octavos: [], cuartos: [], semis: [], campeon: [], subcampeon: [], tercero: [], cuarto: []
    });

    const [extraPicks, setExtraPicks] = useState({});
    const [eventPicks, setEventPicks] = useState({});

    // --- CONFIGURACIÓN DE UI ---
    const tabs = [
        { id: 'grupos', label: 'Fase de Grupos', icon: '📅' },
        { id: 'rondas', label: 'Clasificados', icon: '📈' },
        { id: 'extras', label: 'Extras (11)', icon: '⭐' },
        { id: 'eventos', label: 'Eventos SÍ/NO', icon: '❓' }
    ];

    const roundTabs = [
        { id: 'dieciseisavos', label: 'Dieciseisavos', limit: 32 },
        { id: 'octavos', label: 'Octavos', limit: 16 },
        { id: 'cuartos', label: 'Cuartos', limit: 8 },
        { id: 'semis', label: 'Semifinales', limit: 4 },
        { id: 'campeon', label: 'Campeón', limit: 1 },
        { id: 'subcampeon', label: 'Subcampeón', limit: 1 },
        { id: 'tercero', label: 'Tercero', limit: 1 },
        { id: 'cuarto', label: 'Cuarto', limit: 1 }
    ];

    const extraQuestions = [
        { id: 'goleador', label: '1. Goleador', type: 'player', desc: 'Jugador con más goles anotados. (Por goles, no por premio FIFA).' },
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

    // --- EFECTOS DE CARGA ---
    useEffect(() => {
        const fetchMatchesAndData = async () => {
            try {
                const data = await getWorldCupMatches();
                if (!data || !data.matches) {
                    setMatchesByGroup({});
                    setLoading(false);
                    return;
                }

                const groupStageMatches = data.matches.filter(m => m.stage === 'GROUP_STAGE');
                const grouped = groupStageMatches.reduce((acc, match) => {
                    let groupName = match.group || 'Fase de Grupos';
                    groupName = groupName.replace('GROUP_', 'Grupo ');
                    if (!acc[groupName]) acc[groupName] = [];
                    acc[groupName].push(match);
                    return acc;
                }, {});

                Object.keys(grouped).forEach(key => {
                    grouped[key].sort((a, b) => new Date(a.utcDate) - new Date(b.utcDate));
                });

                setMatchesByGroup(grouped);
                const sortedGroups = Object.keys(grouped).sort((a, b) => a.localeCompare(b));
                if (sortedGroups.length > 0) setSelectedGroup(sortedGroups[0]);

                if (currentUser) {
                    const docRef = currentUser.email === 'doctamayot@gmail.com' 
                        ? doc(db, 'worldCupAdmin', 'results') 
                        : doc(db, 'worldCupPredictions', currentUser.uid);
                    
                    const docSnap = await getDoc(docRef);
                    if (docSnap.exists()) {
                        const savedData = docSnap.data();
                        if (savedData.predictions) setPredictions(savedData.predictions);
                        if (savedData.knockoutPicks) setKnockoutPicks(savedData.knockoutPicks);
                        if (savedData.extraPicks) setExtraPicks(savedData.extraPicks);
                        if (savedData.eventPicks) setEventPicks(savedData.eventPicks);
                    }
                }
            } catch (err) {
                console.error(err);
                setError('No se pudieron cargar los datos del Mundial.');
                toast.error("Error al cargar datos del servidor");
            } finally {
                setLoading(false);
            }
        };
        fetchMatchesAndData();
    }, [currentUser]);

    useEffect(() => {
        if (!currentUser || currentUser.email === 'doctamayot@gmail.com') return;
        const docRef = doc(db, 'worldCupPredictions', currentUser.uid);
        const unsubscribe = onSnapshot(docRef, (docSnap) => {
            if (docSnap.exists()) {
                const data = docSnap.data();
                setHasPaid(!!data.hasPaid);
            }
        });
        return () => unsubscribe();
    }, [currentUser]);

    // --- LÓGICA DE NEGOCIO ---
    const allTeams = useMemo(() => {
        const teamsMap = new Map();
        Object.values(matchesByGroup).flat().forEach(m => {
            if (m.homeTeam?.name && m.homeTeam.name !== 'Por definir') teamsMap.set(m.homeTeam.name, m.homeTeam);
            if (m.awayTeam?.name && m.awayTeam.name !== 'Por definir') teamsMap.set(m.awayTeam.name, m.awayTeam);
        });
        return Array.from(teamsMap.values()).sort((a, b) => translateTeam(a.name).localeCompare(translateTeam(b.name)));
    }, [matchesByGroup]);

    const handleScoreChange = (matchId, team, value) => {
        if (value !== '' && (isNaN(value) || value < 0 || value > 99)) return;
        setPredictions(prev => ({
            ...prev,
            [matchId]: {
                ...prev[matchId],
                [team]: value === '' ? '' : parseInt(value, 10)
            }
        }));
    };

    const handleExtraChange = (extraId, value) => {
        setExtraPicks(prev => ({ ...prev, [extraId]: value }));
    };

    const handleEventChange = (eventId, value) => {
        setEventPicks(prev => ({ ...prev, [eventId]: value }));
    };

    // --- GUARDADO PROFESIONAL CON TOASTS ---
    const handleSavePredictions = async () => {
        setSaving(true);
        const isAdmin = currentUser.email === 'doctamayot@gmail.com';
        
        const predictionData = {
            predictions,
            knockoutPicks,
            extraPicks,
            eventPicks,
            updatedAt: new Date().toISOString()
        };

        const docRef = isAdmin 
            ? doc(db, 'worldCupAdmin', 'results') 
            : doc(db, 'worldCupPredictions', currentUser.uid);

        if (!isAdmin) {
            predictionData.displayName = currentUser.displayName;
            predictionData.email = currentUser.email;
            predictionData.photoURL = currentUser.photoURL;
        }

        const saveOp = setDoc(docRef, predictionData, { merge: true });

        toast.promise(saveOp, {
            loading: isAdmin ? 'Publicando resultados oficiales...' : 'Guardando tus pronósticos...',
            success: isAdmin ? '👑 ¡Resultados MAESTROS actualizados!' : '¡Tus predicciones se guardaron! 🏆',
            error: 'Error de red al guardar. Reintenta.',
        }, {
            style: { minWidth: '250px' },
            success: { duration: 5000 }
        });

        try {
            await saveOp;
        } catch (error) {
            console.error("Error guardando:", error);
        } finally {
            setSaving(false);
        }
    };

    const calculateStandings = (groupName) => {
        if (!groupName || !matchesByGroup[groupName]) return [];
        const matches = matchesByGroup[groupName];
        const teams = {};

        matches.forEach(m => {
            const home = m.homeTeam?.name || 'Por definir';
            const away = m.awayTeam?.name || 'Por definir';
            if (!teams[home]) teams[home] = { name: home, crest: m.homeTeam?.crest, pj: 0, pg: 0, pe: 0, pp: 0, gf: 0, gc: 0, dg: 0, pts: 0 };
            if (!teams[away]) teams[away] = { name: away, crest: m.awayTeam?.crest, pj: 0, pg: 0, pe: 0, pp: 0, gf: 0, gc: 0, dg: 0, pts: 0 };
        });

        matches.forEach(m => {
            const pred = predictions[m.id];
            if (pred && pred.home !== '' && pred.home !== undefined && pred.away !== '' && pred.away !== undefined) {
                const home = m.homeTeam?.name || 'Por definir';
                const away = m.awayTeam?.name || 'Por definir';
                const homeGoals = parseInt(pred.home, 10);
                const awayGoals = parseInt(pred.away, 10);

                teams[home].pj += 1; teams[away].pj += 1;
                teams[home].gf += homeGoals; teams[away].gf += awayGoals;
                teams[home].gc += awayGoals; teams[away].gc += homeGoals;
                teams[home].dg = teams[home].gf - teams[home].gc;
                teams[away].dg = teams[away].gf - teams[away].gc;

                if (homeGoals > awayGoals) {
                    teams[home].pts += 3; teams[home].pg += 1; teams[away].pp += 1;
                } else if (homeGoals < awayGoals) {
                    teams[away].pts += 3; teams[away].pg += 1; teams[home].pp += 1;
                } else {
                    teams[home].pts += 1; teams[away].pts += 1; teams[home].pe += 1; teams[away].pe += 1;
                }
            }
        });

        return Object.values(teams).sort((a, b) => {
            if (b.pts !== a.pts) return b.pts - a.pts;
            if (b.dg !== a.dg) return b.dg - a.dg;
            if (b.gf !== a.gf) return b.gf - a.gf;
            return translateTeam(a.name).localeCompare(translateTeam(b.name));
        });
    };

    const qualifiedRoundOf32 = useMemo(() => {
        let top2 = [];
        let thirds = [];
        Object.keys(matchesByGroup).forEach(groupName => {
            const standings = calculateStandings(groupName);
            if (standings.length > 0) top2.push({ ...standings[0], group: groupName });
            if (standings.length > 1) top2.push({ ...standings[1], group: groupName });
            if (standings.length > 2) thirds.push({ ...standings[2], group: groupName });
        });
        thirds.sort((a, b) => b.pts - a.pts || b.dg - a.dg || b.gf - a.gf);
        const best8Thirds = thirds.slice(0, 8); 
        return { top2, best8Thirds, all32: [...top2, ...best8Thirds] };
    }, [matchesByGroup, predictions]);

    const toggleKnockoutPick = (roundId, team, limit) => {
        setKnockoutPicks(prev => {
            const currentRoundPicks = prev[roundId];
            const isSelected = currentRoundPicks.some(t => t.name === team.name);
            const podiumSlots = ['campeon', 'subcampeon', 'tercero', 'cuarto'];

            if (isSelected) {
                const newPicks = { ...prev };
                newPicks[roundId] = currentRoundPicks.filter(t => t.name !== team.name);
                const roundsOrder = ['octavos', 'cuartos', 'semis'];
                const startIndex = roundsOrder.indexOf(roundId);
                if (startIndex !== -1) {
                    for (let i = startIndex + 1; i < roundsOrder.length; i++) {
                        newPicks[roundsOrder[i]] = newPicks[roundsOrder[i]].filter(t => t.name !== team.name);
                    }
                    podiumSlots.forEach(slot => newPicks[slot] = newPicks[slot].filter(t => t.name !== team.name));
                }
                return newPicks;
            } else {
                const newPicks = { ...prev };
                
                // --- LÓGICA DE REEMPLAZO AUTOMÁTICO PARA PODIO (LIMIT 1) ---
                if (limit === 1) {
                    // Quitamos este equipo de cualquier otra posición del podio para evitar duplicados
                    podiumSlots.forEach(slot => {
                        newPicks[slot] = newPicks[slot].filter(t => t.name !== team.name);
                    });
                    // Reemplazamos el actual (limite 1)
                    newPicks[roundId] = [team];
                    return newPicks;
                }

                if (podiumSlots.includes(roundId)) {
                    podiumSlots.forEach(slot => newPicks[slot] = newPicks[slot].filter(t => t.name !== team.name));
                }
                if (newPicks[roundId].length < limit) {
                    newPicks[roundId] = [...newPicks[roundId], team];
                }
                return newPicks;
            }
        });
    };

    const getAvailableTeamsForRound = (roundId) => {
        switch(roundId) {
            case 'dieciseisavos': return qualifiedRoundOf32.all32;
            case 'octavos': return qualifiedRoundOf32.all32;
            case 'cuartos': return knockoutPicks.octavos;
            case 'semis': return knockoutPicks.cuartos;
            case 'campeon': case 'subcampeon': case 'tercero': case 'cuarto': return knockoutPicks.semis;
            default: return [];
        }
    };

    const getMissingSections = () => {
        if (Object.keys(matchesByGroup).length === 0) return []; 
        const missing = [];
        
        // 1. Fase de Grupos
        const allGroupMatches = Object.values(matchesByGroup).flat();
        const totalMatches = allGroupMatches.length;
        const predictedCount = allGroupMatches.filter(m => {
            const p = predictions[m.id];
            return p && 
                   p.home !== '' && p.home !== undefined && p.home !== null &&
                   p.away !== '' && p.away !== undefined && p.away !== null;
        }).length;

        if (predictedCount < totalMatches) missing.push(`Fase de Grupos (${predictedCount}/${totalMatches})`);

        // 2. Rondas
        if (knockoutPicks.octavos.length < 16) missing.push(`Octavos (${knockoutPicks.octavos.length}/16)`);
        if (knockoutPicks.cuartos.length < 8) missing.push(`Cuartos (${knockoutPicks.cuartos.length}/8)`);
        if (knockoutPicks.semis.length < 4) missing.push(`Semifinales (${knockoutPicks.semis.length}/4)`);
        
        const podiumMissing = [];
        if (knockoutPicks.campeon.length === 0) podiumMissing.push('Campeón');
        if (knockoutPicks.subcampeon.length === 0) podiumMissing.push('Subcampeón');
        if (knockoutPicks.tercero.length === 0) podiumMissing.push('Tercero');
        if (knockoutPicks.cuarto.length === 0) podiumMissing.push('Cuarto');
        if (podiumMissing.length > 0) missing.push(`Podio (Falta: ${podiumMissing.join(', ')})`);

        // 3. Extras
        const filledExtras = extraQuestions.filter(q => {
            const value = extraPicks[q.id];
            return value !== undefined && value !== null && value.toString().trim() !== '';
        }).length;
        if (filledExtras < extraQuestions.length) missing.push(`Extras (${filledExtras}/${extraQuestions.length})`);

        // 4. Eventos
        const filledEvents = specialEvents.filter(e => eventPicks[e.id] === 'SI' || eventPicks[e.id] === 'NO').length;
        if (filledEvents < specialEvents.length) missing.push(`Eventos (${filledEvents}/${specialEvents.length})`);

        return missing;
    };

    // --- RENDERIZADO FINAL ---
    const missingSections = getMissingSections();
    const isAdmin = currentUser.email === 'doctamayot@gmail.com';

    if (loading) return (
        <div className="flex flex-col items-center justify-center py-20">
            <div className="w-16 h-16 border-4 border-primary border-t-transparent rounded-full animate-spin mb-4"></div>
            <p className="text-foreground-muted font-bold tracking-widest uppercase text-sm">Cargando Terreno de Juego...</p>
        </div>
    );

    return (
        <div className="max-w-6xl mx-auto pb-24">
            
            <div className="mb-8 text-center">
                <h2 className="text-3xl sm:text-4xl font-extrabold text-foreground tracking-tighter mb-2">
                    {isAdmin ? '👑 Resultados Reales' : 'Mis Predicciones'}
                </h2>
                <p className="text-foreground-muted">
                    {isAdmin ? 'Estás guardando los resultados oficiales del torneo.' : 'Completa todas las secciones antes del inicio del torneo.'}
                </p>
            </div>

            {/* BANNERS DE ESTADO */}
            {!isAdmin && Object.keys(matchesByGroup).length > 0 && (
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
                                    Asegúrate de llenar todo. Te falta completar: <strong className="text-foreground">{missingSections.join(' • ')}</strong>
                                </p>
                            </div>
                        </div>
                    ) : (
                        <div className="bg-green-500/10 border border-green-500/20 rounded-2xl p-4 sm:p-5 flex items-start sm:items-center gap-3 shadow-sm animate-fade-in">
                            <div className="text-2xl sm:text-3xl shrink-0">✅</div>
                            <div>
                                <h3 className="font-bold text-green-500 mb-1 text-sm sm:text-base">¡Predicción 100% Completa!</h3>
                                <p className="text-xs sm:text-sm text-foreground-muted">Has llenado todas las fases. Recuerda presionar el botón de Guardar.</p>
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* TABS PRINCIPALES CON MICRO-ETIQUETAS PARA MÓVIL */}
            <div className="flex w-full justify-between sm:justify-start gap-1 sm:gap-4 mb-8 pb-2 border-b border-border overflow-x-auto hide-scrollbar">
                {tabs.map((tab) => (
                    <button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id)}
                        className={`flex-1 sm:flex-none flex flex-col sm:flex-row items-center justify-center gap-1 sm:gap-2 px-1 py-3 sm:px-6 rounded-xl sm:rounded-2xl font-bold transition-all whitespace-nowrap ${
                            activeTab === tab.id 
                            ? 'bg-primary text-primary-foreground shadow-md' 
                            : 'bg-card text-foreground-muted border border-card-border hover:bg-background-offset'
                        }`}
                    >
                        <span className="text-xl sm:text-base">{tab.icon}</span>
                        <span className="text-[9px] sm:text-base uppercase sm:normal-case tracking-tighter sm:tracking-normal font-black sm:font-bold">
                            {tab.label}
                        </span>
                    </button>
                ))}
            </div>

            {/* --- CONTENIDO DINÁMICO POR TABS --- */}
            {activeTab === 'grupos' && (
                <div className="animate-fade-in">
                    <div className="flex overflow-x-auto hide-scrollbar gap-2 mb-6 pb-4 snap-x">
                        {Object.keys(matchesByGroup).sort((a,b)=>a.localeCompare(b)).map(gn => (
                            <button
                                key={gn}
                                onClick={() => setSelectedGroup(gn)}
                                className={`snap-start whitespace-nowrap px-5 py-2 rounded-full font-bold text-sm border transition-colors ${
                                    selectedGroup === gn ? 'bg-foreground text-background border-foreground' : 'bg-card text-foreground-muted border-border hover:border-foreground/50'
                                }`}
                            >
                                {gn}
                            </button>
                        ))}
                    </div>

                    {selectedGroup && (
                        <div className="grid grid-cols-1 xl:grid-cols-12 gap-8">
                            <div className="xl:col-span-7 space-y-4">
                                <h3 className="text-2xl font-black text-primary uppercase tracking-widest border-b border-border pb-3 mb-4">Partidos - {selectedGroup}</h3>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                    {matchesByGroup[selectedGroup].map(match => (
                                        <div key={match.id} className="bg-card border border-card-border p-4 rounded-2xl shadow-sm hover:border-primary/50 transition-colors">
                                            <div className="text-[10px] text-foreground-muted text-center mb-4 font-semibold uppercase tracking-wider">
                                                {new Date(match.utcDate).toLocaleDateString('es-ES', { day: '2-digit', month: 'short', hour:'2-digit', minute:'2-digit' })}
                                            </div>
                                            <div className="flex flex-col gap-3">
                                                <div className="flex items-center justify-between bg-background-offset p-2 sm:p-3 rounded-xl border border-border">
                                                    <div className="flex items-center gap-3 overflow-hidden pr-2">
                                                        <img src={match.homeTeam.crest} className="w-8 h-8 object-cover rounded-full border border-border shrink-0" alt="" />
                                                        <span className="font-bold text-sm text-foreground truncate">{translateTeam(match.homeTeam.name)}</span>
                                                    </div>
                                                    <input type="number" className="w-12 h-12 text-center bg-card border border-card-border rounded-lg text-lg font-black text-foreground focus:ring-2 focus:ring-primary shadow-inner" placeholder="-" value={predictions[match.id]?.home ?? ''} onChange={(e) => handleScoreChange(match.id, 'home', e.target.value)} />
                                                </div>
                                                <div className="flex items-center justify-between bg-background-offset p-2 sm:p-3 rounded-xl border border-border">
                                                    <div className="flex items-center gap-3 overflow-hidden pr-2">
                                                        <img src={match.awayTeam.crest} className="w-8 h-8 object-cover rounded-full border border-border shrink-0" alt="" />
                                                        <span className="font-bold text-sm text-foreground truncate">{translateTeam(match.awayTeam.name)}</span>
                                                    </div>
                                                    <input type="number" className="w-12 h-12 text-center bg-card border border-card-border rounded-lg text-lg font-black text-foreground focus:ring-2 focus:ring-primary shadow-inner" placeholder="-" value={predictions[match.id]?.away ?? ''} onChange={(e) => handleScoreChange(match.id, 'away', e.target.value)} />
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                            <div className="xl:col-span-5">
                                <div className="bg-card border border-card-border rounded-3xl p-4 sm:p-6 shadow-sm sticky top-24">
                                    <h3 className="text-xl font-black text-foreground mb-4">Tabla en Vivo</h3>
                                    <div className="overflow-x-auto">
                                        <table className="w-full text-sm">
                                            <thead>
                                                <tr className="border-b border-border text-foreground-muted">
                                                    <th className="pb-2 text-left">País</th>
                                                    <th className="pb-2 text-center">PJ</th>
                                                    <th className="pb-2 text-center">DG</th>
                                                    <th className="pb-2 text-center font-black text-primary">PTS</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {calculateStandings(selectedGroup).map((team, index) => (
                                                    <tr key={team.name} className="border-b border-border/50 last:border-0 hover:bg-background-offset/50 transition-colors">
                                                        <td className="py-3 flex items-center gap-2">
                                                            <span className={`w-5 text-xs font-bold ${index < 2 ? 'text-green-500' : 'text-foreground-muted'}`}>{index+1}</span>
                                                            <img src={team.crest} className="w-6 h-6 rounded-full border border-border" alt="" />
                                                            <span className="font-semibold truncate max-w-[120px]">{translateTeam(team.name)}</span>
                                                        </td>
                                                        <td className="py-3 text-center text-foreground-muted">{team.pj}</td>
                                                        <td className="py-3 text-center text-foreground-muted">{team.dg > 0 ? `+${team.dg}` : team.dg}</td>
                                                        <td className="py-3 text-center font-black text-primary">{team.pts}</td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            )}

            {activeTab === 'rondas' && (
                <div className="animate-fade-in">
                    {/* INSTRUCCIONES DINÁMICAS BASADAS EN LA RONDA */}
                    <div className="bg-primary/10 border-l-4 border-primary p-4 mb-8 rounded-r-2xl animate-fade-in shadow-sm">
                        <div className="flex items-start gap-3">
                            <span className="text-xl">💡</span>
                            <div>
                                <h4 className="font-bold text-primary text-xs sm:text-sm uppercase tracking-wider">¿Cómo funciona esta fase?</h4>
                                <p className="text-[11px] sm:text-sm text-foreground-muted mt-1 leading-relaxed">
                                    {activeRoundTab === 'dieciseisavos' && "Los 32 clasificados aparecen automáticamente según los marcadores que pusiste en la pestaña 'Grupos'."}
                                    {activeRoundTab === 'octavos' && "Selecciona a los 16 ganadores que avanzarán desde los Dieciseisavos de la lista anterior."}
                                    {activeRoundTab === 'cuartos' && "Elige a los 8 mejores equipos que avanzarán a Cuartos de Final."}
                                    {activeRoundTab === 'semis' && "Define a los 4 semifinalistas que lucharán por el trofeo mundial."}
                                    {['campeon', 'subcampeon', 'tercero', 'cuarto'].includes(activeRoundTab) && `Selecciona a tu favorito para el puesto de ${activeRoundTab.toUpperCase()}. Si cambias de opinión, toca a otro equipo.`}
                                </p>
                            </div>
                        </div>
                    </div>

                    {/* TABS DE RONDAS CON MICRO-ETIQUETAS */}
                    <div className="flex overflow-x-auto hide-scrollbar gap-1.5 mb-8 pb-4 border-b border-border snap-x">
                        {roundTabs.map(rt => (
                            <button
                                key={rt.id}
                                onClick={() => setActiveRoundTab(rt.id)}
                                className={`snap-start whitespace-nowrap px-3 py-2 sm:px-5 sm:py-2.5 rounded-xl sm:rounded-2xl font-bold transition-all border flex flex-col items-center gap-0.5 ${
                                    activeRoundTab === rt.id 
                                    ? 'bg-foreground text-background border-foreground shadow-md' 
                                    : 'bg-card text-foreground-muted border-border hover:border-foreground/50'
                                }`}
                            >
                                <span className="text-[9px] sm:text-sm uppercase tracking-tighter">{rt.label}</span>
                                <span className={`text-[8px] sm:text-[10px] font-black uppercase ${
                                    rt.id === 'dieciseisavos' || knockoutPicks[rt.id]?.length === rt.limit 
                                    ? (activeRoundTab === rt.id ? 'text-background/80' : 'text-green-500') 
                                    : 'opacity-70'
                                }`}>
                                    {rt.id === 'dieciseisavos' ? 32 : knockoutPicks[rt.id]?.length || 0}/{rt.limit}
                                </span>
                            </button>
                        ))}
                    </div>

                    <div className="bg-background-offset border border-border p-6 sm:p-10 rounded-3xl shadow-sm">
                        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-4">
                            {activeRoundTab === 'dieciseisavos' ? (
                                qualifiedRoundOf32.all32.map((team, idx) => (
                                    <div key={idx} className="bg-card border border-card-border p-4 rounded-xl flex flex-col items-center text-center shadow-sm">
                                        <img src={team.crest} className="w-10 h-10 rounded-full border border-border mb-2" alt="" />
                                        <span className="font-bold text-xs text-foreground leading-tight">{translateTeam(team.name)}</span>
                                    </div>
                                ))
                            ) : (
                                getAvailableTeamsForRound(activeRoundTab).map((team, idx) => {
                                    const limit = roundTabs.find(t => t.id === activeRoundTab).limit;
                                    const isSelected = knockoutPicks[activeRoundTab].some(t => t.name === team.name);
                                    return (
                                        <button 
                                            key={idx} 
                                            onClick={() => toggleKnockoutPick(activeRoundTab, team, limit)} 
                                            className={`p-4 rounded-2xl flex flex-col items-center text-center transition-all border-2 ${
                                                isSelected ? 'bg-primary/10 border-primary scale-105 shadow-md' : 'bg-card border-card-border hover:border-primary/50'
                                            }`}
                                        >
                                            <img src={team.crest} className="w-12 h-12 rounded-full border border-border mb-3" alt="" />
                                            <span className={`font-bold text-xs sm:text-sm ${isSelected ? 'text-primary' : 'text-foreground'}`}>{translateTeam(team.name)}</span>
                                        </button>
                                    );
                                })
                            )}
                        </div>
                    </div>
                </div>
            )}

            {activeTab === 'extras' && (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 animate-fade-in">
                    {extraQuestions.map(q => (
                        <div key={q.id} className="bg-background-offset border border-border rounded-2xl p-5 shadow-sm group hover:border-primary/50 transition-colors">
                            <h4 className="text-base font-black text-foreground mb-1 group-hover:text-primary">{q.label}</h4>
                            <p className="text-xs text-foreground-muted mb-4">{q.desc}</p>
                            {q.type === 'player' ? (
                                <input 
                                    type="text" 
                                    placeholder="Escribe el nombre..." 
                                    value={extraPicks[q.id] || ''} 
                                    onChange={(e) => handleExtraChange(q.id, e.target.value)} 
                                    className="w-full bg-card border border-card-border rounded-xl py-3 px-4 text-sm font-semibold text-foreground focus:ring-2 focus:ring-primary shadow-inner" 
                                />
                            ) : (
                                <select 
                                    value={extraPicks[q.id] || ''} 
                                    onChange={(e) => handleExtraChange(q.id, e.target.value)} 
                                    className="w-full bg-card border border-card-border rounded-xl py-3 px-4 text-sm font-semibold text-foreground focus:ring-2 focus:ring-primary shadow-inner cursor-pointer"
                                >
                                    <option value="">Selecciona...</option>
                                    {q.type === 'team' ? allTeams.map(t => <option key={t.name} value={t.name}>{translateTeam(t.name)}</option>) : Object.keys(matchesByGroup).map(g => <option key={g} value={g}>{g}</option>)}
                                </select>
                            )}
                        </div>
                    ))}
                </div>
            )}

            {activeTab === 'eventos' && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 animate-fade-in">
                    {specialEvents.map(e => (
                        <div key={e.id} className="bg-background-offset border border-border rounded-2xl p-5 shadow-sm flex flex-col sm:flex-row justify-between items-center gap-4">
                            <div className="flex-1">
                                <h4 className="text-base font-black text-foreground mb-1">{e.label}</h4>
                                <p className="text-xs text-foreground-muted">{e.desc}</p>
                            </div>
                            <div className="flex items-center gap-2 bg-card p-1.5 rounded-xl border border-card-border shadow-inner">
                                {['SI', 'NO'].map(opt => (
                                    <button 
                                        key={opt} 
                                        onClick={() => handleEventChange(e.id, opt)} 
                                        className={`w-20 py-2 rounded-lg font-black text-sm transition-all ${eventPicks[e.id] === opt ? (opt === 'SI' ? 'bg-green-500 text-white' : 'bg-red-500 text-white') : 'text-foreground-muted hover:text-foreground'}`}
                                    >
                                        {opt}
                                    </button>
                                ))}
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* BOTÓN FLOTANTE (FAB) DE GUARDADO - OPTIMIZADO RESPONSIVE */}
            <div className="fixed bottom-24 right-4 sm:bottom-10 sm:right-10 z-[100]">
                <button 
                    onClick={handleSavePredictions}
                    disabled={saving}
                    className="bg-primary text-primary-foreground font-black py-3 px-5 sm:py-4 sm:px-10 rounded-full shadow-[0_15px_30px_-5px_rgba(245,158,11,0.5)] border border-amber-500/50 transition-all hover:scale-110 active:scale-95 flex items-center gap-2 sm:gap-3 disabled:opacity-50 uppercase tracking-tighter text-xs sm:text-base"
                >
                    {saving ? (
                        <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div><span>...</span></>
                    ) : (
                        <>
                            <span className="text-base sm:text-lg">💾</span>
                            {/* Ocultamos "Predicciones" en móvil */}
                            <span className="hidden sm:inline">Guardar Predicciones</span>
                            <span className="sm:hidden">Guardar</span>
                        </>
                    )}
                </button>
            </div>

        </div>
    );
};

export default WorldCupPredictions;