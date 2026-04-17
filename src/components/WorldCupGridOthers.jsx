import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { db } from '../firebase';
import { collection, onSnapshot, doc, getDoc } from 'firebase/firestore';
import logocopa from '../assets/logocopa.png';

// --- CONSTANTES Y DICCIONARIOS ---
const EXCLUDED_EMAILS = ['doctamayot@gmail.com', 'admin@polli-tamayo.com'];

const extraQuestions = [
    { id: 'goleador', label: 'Goleador del Torneo', manual: true },
    { id: 'equipo_goleador', label: 'Equipo más Goleador', manual: false },
    { id: 'equipo_menos_goleador', label: 'Equipo menos Goleador', manual: false },
    { id: 'mas_amarillas', label: 'Equipo con más Amarillas', manual: false },
    { id: 'mas_rojas', label: 'Equipo con más Rojas', manual: false },
    { id: 'valla_menos_vencida', label: 'Valla menos Vencida', manual: false },
    { id: 'valla_mas_vencida', label: 'Valla más Vencida', manual: false },
    { id: 'grupo_mas_goles', label: 'Grupo con más Goles', manual: false },
    { id: 'grupo_menos_goles', label: 'Grupo con menos Goles', manual: false },
    { id: 'maximo_asistidor', label: 'Máximo Asistidor', manual: true },
    { id: 'atajapenales', label: 'Mejor Atajapenales', manual: true }
];

const specialEvents = [
    { id: 'gol_olimpico', label: '¿Habrá un Gol Olímpico?' },
    { id: 'remontada_epica', label: '¿Remontada tras ir perdiendo por 2 goles?' },
    { id: 'el_festival', label: '¿Algún partido tendrá 8 o más goles?' },
    { id: 'muralla_final', label: '¿La final terminará 0-0 en los 90 mins?' },
    { id: 'hat_trick_hero', label: '¿Algún jugador anotará un Hat-Trick?' },
    { id: 'roja_banquillo', label: '¿Expulsarán a alguien del banquillo?' },
    { id: 'portero_goleador', label: '¿Anotará un gol algún portero (sin contar penales)?' },
    { id: 'debut_sin_red', label: '¿Algún equipo se irá sin anotar en fase de grupos?' },
    { id: 'leyenda_viva', label: '¿Anotará gol el jugador más veterano?' },
    { id: 'drama_final', label: '¿Habrá gol después del minuto 90+5?' },
    { id: 'penales_final', label: '¿La final se decidirá en penales?' }
];

// 🟢 RONDAS COMPLETAS: Se agregaron Finalistas (6 pts) y A 3er Puesto (4 pts)
const koRounds = [
    { id: 'clasificados32', dbKey: null, label: '16vos de Final', pts: 2, limit: 32 },
    { id: 'octavos', dbKey: 'dieciseisavos', label: 'Octavos de Final', pts: 3, limit: 16 },
    { id: 'cuartos', dbKey: 'octavos', label: 'Cuartos de Final', pts: 4, limit: 8 },
    { id: 'semis', dbKey: 'cuartos', label: 'Semifinales', pts: 5, limit: 4 },
    { id: 'tercer_puesto_match', dbKey: null, label: 'A 3er Puesto', pts: 4, limit: 2 },
    { id: 'finalistas', dbKey: 'semis', label: 'Finalistas', pts: 6, limit: 2 }
];

const honorSlots = [
    { id: 'campeon', label: 'Campeón', pts: 10, icon: '🏆' },
    { id: 'subcampeon', label: 'Subcampeón', pts: 6, icon: '🥈' },
    { id: 'tercero', label: 'Tercer Puesto', pts: 6, icon: '🥉' },
    { id: 'cuarto', label: 'Cuarto Puesto', pts: 6, icon: '🏅' }
];

const teamTranslations = {
    "Albania": "Albania", "Algeria": "Argelia", "Argentina": "Argentina", "Australia": "Australia", 
    "Austria": "Austria", "Belgium": "Bélgica", "Bolivia": "Bolivia", "Brazil": "Brasil", 
    "Cameroon": "Camerún", "Canada": "Canadá", "Chile": "Chile", "Colombia": "Colombia", 
    "Costa Rica": "Costa Rica", "Croatia": "Croacia", "Denmark": "Dinamarca", "Ecuador": "Ecuador", 
    "England": "Inglaterra", "France": "Francia", "Germany": "Alemania", "Japan": "Japón", 
    "Mexico": "México", "Morocco": "Marruecos", "Netherlands": "Países Bajos", "Peru": "Perú", 
    "Portugal": "Portugal", "Senegal": "Senegal", "South Korea": "Corea del Sur", "Spain": "España", 
    "United States": "Estados Unidos", "Uruguay": "Uruguay", "Venezuela": "Venezuela", "Por definir": "Por definir"
};

const translateTeam = (name) => teamTranslations[name] || name;

const formatShortName = (fullName) => {
    if (!fullName) return 'Anon';
    const parts = fullName.trim().split(' ');
    return parts.length === 1 ? parts[0] : `${parts[0]} ${parts[1].charAt(0)}.`;
};

const isSmartMatch = (userText, adminText) => {
    if (!userText || !adminText) return false;
    const clean = (str) => str.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]/g, "").trim();
    const u = clean(userText); const a = clean(adminText);
    return u === a || (u.length > 3 && (a.includes(u) || u.includes(a)));
};

// --- COMPONENTE PRINCIPAL ---
const WorldCupGridOthers = ({ currentUser }) => {
    const [allPredictions, setAllPredictions] = useState({});
    const [usersInfo, setUsersInfo] = useState({});
    const [adminResults, setAdminResults] = useState(null);
    const [matches, setMatches] = useState([]);
    
    const [activeTab, setActiveTab] = useState('rondas');
    const [selectedRound, setSelectedRound] = useState('clasificados32');
    const [selectedExtra, setSelectedExtra] = useState('goleador');
    const [selectedEvent, setSelectedEvent] = useState('gol_olimpico');
    const [selectedGroup, setSelectedGroup] = useState('Grupo A');

    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchData = async () => {
            try {
                const cacheDoc = await getDoc(doc(db, 'worldCupAdmin', 'apiCache'));
                if (cacheDoc.exists() && cacheDoc.data().matches) {
                    setMatches(cacheDoc.data().matches);
                }
            } catch (err) { console.error(err); }

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
                setLoading(false);
            });

            return () => { unsubPreds(); unsubUsers(); unsubAdmin(); };
        };
        fetchData();
    }, []);

    const effectiveMatches = useMemo(() => {
        return matches.map(m => {
            const simStatus = adminResults?.simulation?.matchStatuses?.[m.id];
            if (simStatus && simStatus !== '') return { ...m, status: simStatus };
            return m;
        });
    }, [matches, adminResults]);

    const groupNames = useMemo(() => {
        const groups = new Set();
        effectiveMatches.forEach(m => {
            if (m.stage === 'GROUP_STAGE' && m.group) {
                groups.add(m.group.replace('GROUP_', 'Grupo '));
            }
        });
        return Array.from(groups).sort();
    }, [effectiveMatches]);

    useEffect(() => { if (groupNames.length > 0 && selectedGroup === 'Grupo A') setSelectedGroup(groupNames[0]); }, [groupNames]);

    const getStandings = useCallback((groupMatches, preds, groupName, tiebreakers) => {
        const teams = {};
        groupMatches.forEach(m => {
            const h = m.homeTeam?.name || 'Por definir'; const a = m.awayTeam?.name || 'Por definir';
            if (!teams[h]) teams[h] = { name: h, crest: m.homeTeam?.crest, pj: 0, pts: 0, dg: 0, gf: 0, gc: 0 };
            if (!teams[a]) teams[a] = { name: a, crest: m.awayTeam?.crest, pj: 0, pts: 0, dg: 0, gf: 0, gc: 0 };
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
                if (gh > ga) teams[h].pts += 3; else if (gh < ga) teams[a].pts += 3; else { teams[h].pts += 1; teams[a].pts += 1; }
            }
        });

        return Object.values(teams).sort((a, b) => {
            if (b.pts !== a.pts) return b.pts - a.pts;
            if (b.dg !== a.dg) return b.dg - a.dg;
            if (b.gf !== a.gf) return b.gf - a.gf;
            const tieA = tiebreakers?.[groupName]?.[a.name] || 99;
            const tieB = tiebreakers?.[groupName]?.[b.name] || 99;
            if (tieA !== tieB) return tieA - tieB; 
            return translateTeam(a.name).localeCompare(translateTeam(b.name));
        });
    }, []);

    const groupStageMatches = useMemo(() => effectiveMatches.filter(m => m.stage === 'GROUP_STAGE'), [effectiveMatches]);

    const isGroupStageFinished = useMemo(() => {
        if (groupStageMatches.length === 0) return false;
        return groupStageMatches.every(m => {
            const p = adminResults?.predictions?.[m.id];
            return p && p.home !== '' && p.home !== undefined && p.home !== null;
        });
    }, [groupStageMatches, adminResults]);

    // 🟢 MOTOR PROGRESIVO: Verifica grupo por grupo y extrae a los clasificados a medida que se completan
    const adminQualified32 = useMemo(() => {
        let top2 = []; 
        let thirds = [];
        let allGroupsFinished = true;

        const byGroup = groupStageMatches.reduce((acc, m) => {
            let g = m.group?.replace('GROUP_', 'Grupo ') || 'Fase de Grupos';
            if (!acc[g]) acc[g] = []; acc[g].push(m); return acc;
        }, {});
        
        Object.keys(byGroup).forEach(g => {
            const groupMatches = byGroup[g];
            // Verificamos si ESTE grupo está completo
            const isGroupFinished = groupMatches.length > 0 && groupMatches.every(m => 
                adminResults?.predictions?.[m.id]?.home !== undefined && 
                adminResults?.predictions?.[m.id]?.home !== ''
            );

            if (!isGroupFinished) allGroupsFinished = false;

            if (isGroupFinished) {
                const st = getStandings(groupMatches, adminResults?.predictions, g, adminResults?.manualTiebreakers);
                if (st[0]) top2.push(st[0]); 
                if (st[1]) top2.push(st[1]); 
                if (st[2]) thirds.push(st[2]);
            }
        });

        // Solo saca a los 3eros de la sala de espera si TODOS los grupos terminaron
        if (allGroupsFinished && top2.length > 0) {
            thirds.sort((a, b) => b.pts - a.pts || b.dg - a.dg || b.gf - a.gf);
            return [...top2, ...thirds.slice(0, 8)];
        }
        
        // Retorna parcialmente los primeros y segundos confirmados
        return top2;
    }, [groupStageMatches, adminResults, getStandings]);

    const validUsers = useMemo(() => {
        return Object.keys(allPredictions)
            .filter(uid => allPredictions[uid].hasPaid && !EXCLUDED_EMAILS.includes(allPredictions[uid].email))
            .map(uid => ({
                uid,
                name: usersInfo[uid]?.displayName || allPredictions[uid].displayName || 'Jugador',
                photoURL: usersInfo[uid]?.photoURL || allPredictions[uid].photoURL || logocopa,
                data: allPredictions[uid]
            }))
            .sort((a, b) => a.name.localeCompare(b.name));
    }, [allPredictions, usersInfo]);

    if (loading) return (
        <div className="flex flex-col items-center justify-center py-20 animate-fade-in">
            <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin mb-4"></div>
            <p className="text-foreground-muted font-bold tracking-widest uppercase text-xs">Cargando Auditoría...</p>
        </div>
    );

    const tabs = [
        { id: 'rondas', icon: '📈', label: 'Rondas' },
        { id: 'podio', icon: '👑', label: 'Cuadro Honor' },
        { id: 'extras', icon: '⭐', label: 'Extras' },
        { id: 'eventos', icon: '❓', label: 'Eventos' },
        { id: 'grupos', icon: '🔢', label: 'Grupos (Exactos)' }
    ];

    return (
        <div className="w-full mx-auto animate-fade-in">
            
            {/* ENCABEZADO */}
            <div className="bg-gradient-to-br from-slate-900 to-slate-800 rounded-2xl sm:rounded-[2rem] p-4 sm:p-8 mb-6 sm:mb-8 text-center border border-border shadow-xl relative overflow-hidden flex flex-row items-center justify-center gap-3 sm:gap-6">
                <div className="absolute top-0 left-0 w-full h-full bg-primary/5 z-0 pointer-events-none"></div>
                <div className="w-12 h-12 sm:w-16 sm:h-16 bg-primary/10 rounded-full flex items-center justify-center border border-primary/20 text-2xl sm:text-3xl relative z-10 shadow-lg">🕵️‍♂️</div>
                <div className="relative z-10 flex flex-col items-start sm:items-center text-left sm:text-center">
                    <h2 className="text-xl sm:text-3xl font-black text-white mb-0.5 sm:mb-1 tracking-tighter drop-shadow-md uppercase">Radar de Aciertos</h2>
                    <p className="text-primary font-black uppercase text-[8px] sm:text-[10px] tracking-widest bg-primary/10 px-2.5 sm:px-4 py-1 rounded-full border border-primary/20 shadow-sm">
                        Auditoría en Tiempo Real
                    </p>
                </div>
            </div>

            {/* MENÚ DE TABS PRINCIPAL */}
            <div className="flex overflow-x-auto hide-scrollbar gap-2 mb-6 p-1">
                {tabs.map(tab => (
                    <button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id)}
                        className={`flex items-center gap-2 px-4 py-2.5 sm:px-6 sm:py-3 rounded-full font-black text-xs sm:text-sm whitespace-nowrap transition-all shadow-sm border ${
                            activeTab === tab.id 
                            ? 'bg-primary text-primary-foreground border-amber-500/50 shadow-[0_0_15px_rgba(245,158,11,0.3)]' 
                            : 'bg-background-offset text-foreground-muted border-border hover:bg-border/30 hover:text-foreground'
                        }`}
                    >
                        <span className="text-base sm:text-lg">{tab.icon}</span> {tab.label}
                    </button>
                ))}
            </div>

            {/* CONTENIDO DINÁMICO */}
            <div className="bg-background-offset rounded-2xl sm:rounded-[2rem] border border-border p-3 sm:p-6 shadow-inner min-h-[400px] relative overflow-hidden">
                <img src={logocopa} className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-64 h-64 object-contain opacity-[0.02] pointer-events-none z-0" alt="" />
                
                {/* TAB: EVENTOS */}
                {activeTab === 'eventos' && (
                    <div className="relative z-10 animate-fade-in">
                        <select className="w-full bg-card border border-primary/30 text-foreground font-bold p-3 sm:p-4 rounded-xl focus:ring-2 focus:ring-primary outline-none mb-6 appearance-none shadow-md text-xs sm:text-sm" value={selectedEvent} onChange={e => setSelectedEvent(e.target.value)}>
                            {specialEvents.map(e => <option key={e.id} value={e.id}>{e.label}</option>)}
                        </select>
                        
                        <div className="flex flex-col sm:flex-row justify-between items-center bg-card p-4 sm:p-6 rounded-2xl border border-primary/20 shadow-lg mb-6 gap-4">
                            <span className="text-xs sm:text-sm font-black uppercase tracking-widest text-primary">Respuesta Oficial (Admin):</span>
                            <span className={`px-6 py-2 rounded-xl font-black text-sm sm:text-lg border shadow-inner ${adminResults?.eventPicks?.[selectedEvent] === 'SI' ? 'bg-green-500/10 text-green-500 border-green-500/30' : adminResults?.eventPicks?.[selectedEvent] === 'NO' ? 'bg-red-500/10 text-red-500 border-red-500/30' : 'bg-background-offset text-foreground-muted border-border'}`}>
                                {adminResults?.eventPicks?.[selectedEvent] || '⏳ Por Definir'}
                            </span>
                        </div>

                        <div className="space-y-2">
                            {validUsers.map(u => {
                                const uAns = u.data?.eventPicks?.[selectedEvent];
                                const aAns = adminResults?.eventPicks?.[selectedEvent];
                                const isCorrect = uAns && aAns && String(uAns).toUpperCase() === String(aAns).toUpperCase();
                                const pts = isCorrect ? (uAns === 'SI' ? 5 : 2) : 0;
                                return (
                                    <div key={u.uid} className={`flex items-center justify-between p-3 sm:p-4 rounded-xl border transition-colors ${isCorrect ? 'bg-green-500/5 border-green-500/20' : 'bg-card border-card-border hover:bg-background-offset'}`}>
                                        <div className="flex items-center gap-3">
                                            <img src={u.photoURL} className="w-8 h-8 sm:w-10 sm:h-10 rounded-full border border-border" alt="" />
                                            <span className="font-bold text-xs sm:text-sm">{formatShortName(u.name)}</span>
                                        </div>
                                        <div className="flex items-center gap-4">
                                            <span className="text-xs sm:text-sm font-black text-foreground-muted">{uAns || '-'}</span>
                                            {isCorrect && <span className="bg-green-500 text-white text-[10px] sm:text-xs font-black px-2 py-1 rounded shadow-sm">+{pts} pts</span>}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                )}

                {/* TAB: EXTRAS */}
                {activeTab === 'extras' && (
                    <div className="relative z-10 animate-fade-in">
                        <select className="w-full bg-card border border-amber-500/30 text-foreground font-bold p-3 sm:p-4 rounded-xl focus:ring-2 focus:ring-amber-500 outline-none mb-6 appearance-none shadow-md text-xs sm:text-sm" value={selectedExtra} onChange={e => setSelectedExtra(e.target.value)}>
                            {extraQuestions.map(e => <option key={e.id} value={e.id}>{e.label} {e.manual ? '✍️' : '⚙️'}</option>)}
                        </select>

                        <div className="flex flex-col sm:flex-row justify-between items-center bg-card p-4 sm:p-6 rounded-2xl border border-amber-500/20 shadow-lg mb-6 gap-4">
                            <span className="text-xs sm:text-sm font-black uppercase tracking-widest text-amber-500">Respuesta Oficial (Admin):</span>
                            <span className="font-black text-sm sm:text-lg text-foreground px-4 py-2 bg-background-offset rounded-xl border border-border shadow-inner text-center">
                                {adminResults?.extraPicks?.[selectedExtra] ? translateTeam(adminResults.extraPicks[selectedExtra]) : '⏳ Por Definir'}
                            </span>
                        </div>

                        <div className="space-y-2">
                            {validUsers.map(u => {
                                const qObj = extraQuestions.find(q => q.id === selectedExtra);
                                const uAns = u.data?.extraPicks?.[selectedExtra];
                                const aAns = adminResults?.extraPicks?.[selectedExtra];
                                const isCorrect = uAns && aAns && (qObj.manual ? isSmartMatch(uAns, aAns) : uAns.toLowerCase() === aAns.toLowerCase());
                                return (
                                    <div key={u.uid} className={`flex items-center justify-between p-3 sm:p-4 rounded-xl border transition-colors ${isCorrect ? 'bg-amber-500/10 border-amber-500/30' : 'bg-card border-card-border hover:bg-background-offset'}`}>
                                        <div className="flex items-center gap-3 w-1/3">
                                            <img src={u.photoURL} className="w-8 h-8 sm:w-10 sm:h-10 rounded-full border border-border shrink-0" alt="" />
                                            <span className="font-bold text-xs sm:text-sm truncate">{formatShortName(u.name)}</span>
                                        </div>
                                        <div className="flex items-center justify-end gap-3 w-2/3">
                                            <span className="text-[10px] sm:text-sm font-bold text-foreground-muted truncate text-right">{uAns ? translateTeam(uAns) : '-'}</span>
                                            {isCorrect && <span className="bg-amber-500 text-white text-[10px] sm:text-xs font-black px-2 py-1 rounded shadow-sm shrink-0">+6 pts</span>}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                )}

                {/* TAB: RONDAS (CLASIFICADOS) */}
                {activeTab === 'rondas' && (
                    <div className="relative z-10 animate-fade-in">
                        <div className="flex overflow-x-auto hide-scrollbar gap-2 mb-6 p-1">
                            {koRounds.map(r => (
                                <button key={r.id} onClick={() => setSelectedRound(r.id)} className={`px-4 py-2 rounded-lg font-black text-xs sm:text-sm whitespace-nowrap border shadow-sm transition-colors ${selectedRound === r.id ? 'bg-indigo-500 text-white border-indigo-400' : 'bg-card text-foreground-muted border-border hover:bg-background-offset'}`}>
                                    {r.label}
                                </button>
                            ))}
                        </div>

                        {(() => {
                            const roundObj = koRounds.find(r => r.id === selectedRound);
                            let aTeamsCurrentRound = [];

                            if (selectedRound === 'clasificados32') {
                                aTeamsCurrentRound = adminQualified32;
                            } else if (selectedRound === 'tercer_puesto_match') {
                                // 🟢 DEDUCCIÓN MATEMÁTICA: Semifinalistas menos los 2 Finalistas = Equipos de 3er puesto
                                const semisTeams = adminResults?.knockoutPicks?.['cuartos'] || [];
                                const finalists = adminResults?.knockoutPicks?.['semis'] || [];
                                if (semisTeams.length === 4 && finalists.length === 2) {
                                    aTeamsCurrentRound = semisTeams.filter(t => !finalists.some(f => f.name === t.name));
                                }
                            } else {
                                aTeamsCurrentRound = adminResults?.knockoutPicks?.[roundObj.dbKey] || [];
                            }

                            return (
                                <>
                                    <div className="bg-indigo-500/10 border border-indigo-500/20 p-4 sm:p-6 rounded-2xl mb-6 shadow-sm">
                                        <h4 className="text-xs sm:text-sm font-black uppercase tracking-widest text-indigo-400 mb-3 text-center">
                                            Clasificados Oficiales ({aTeamsCurrentRound.length}/{roundObj.limit})
                                        </h4>
                                        <div className="flex flex-wrap justify-center gap-2">
                                            {aTeamsCurrentRound.length > 0 ? aTeamsCurrentRound.map(t => (
                                                <span key={t.name} className="bg-card text-foreground border border-border px-2 py-1 rounded text-[10px] sm:text-xs font-bold shadow-sm">{translateTeam(t.name)}</span>
                                            )) : <span className="text-foreground-muted text-xs italic">Aún no hay clasificados confirmados.</span>}
                                        </div>
                                    </div>

                                    <div className="space-y-3">
                                        {validUsers.map(u => {
                                            let uTeams = [];
                                            let hits = 0;
                                            const ptsPerHit = roundObj.pts;

                                            if (selectedRound === 'clasificados32') {
                                                let uTop2 = []; let uThirds = [];
                                                const byGroup = groupStageMatches.reduce((acc, m) => {
                                                    let g = m.group?.replace('GROUP_', 'Grupo ') || 'Fase de Grupos';
                                                    if (!acc[g]) acc[g] = []; acc[g].push(m); return acc;
                                                }, {});
                                                Object.keys(byGroup).forEach(g => {
                                                    const st = getStandings(byGroup[g], u.data?.predictions, g, u.data?.manualTiebreakers);
                                                    if (st[0]) uTop2.push(st[0]); if (st[1]) uTop2.push(st[1]); if (st[2]) uThirds.push(st[2]);
                                                });
                                                uThirds.sort((a, b) => b.pts - a.pts || b.dg - a.dg || b.gf - a.gf);
                                                uTeams = [...uTop2, ...uThirds.slice(0, 8)];

                                                // 🟢 PUNTOS PROGRESIVOS PARA 16VOS: Ya no esperamos a isGroupStageFinished
                                                if (aTeamsCurrentRound.length > 0) {
                                                    hits = uTeams.filter(ut => aTeamsCurrentRound.some(at => at.name === ut.name)).length;
                                                }
                                            } else if (selectedRound === 'tercer_puesto_match') {
                                                const uSemisTeams = u.data?.knockoutPicks?.['cuartos'] || [];
                                                const uFinalists = u.data?.knockoutPicks?.['semis'] || [];
                                                uTeams = uSemisTeams.filter(t => !uFinalists.some(f => f.name === t.name)).slice(0, 2);
                                                
                                                if (aTeamsCurrentRound.length > 0) {
                                                    hits = uTeams.filter(ut => aTeamsCurrentRound.some(at => at.name === ut.name)).length;
                                                }
                                            } else {
                                                uTeams = u.data?.knockoutPicks?.[roundObj.dbKey] || [];
                                                if (aTeamsCurrentRound.length > 0) {
                                                    hits = uTeams.filter(ut => aTeamsCurrentRound.some(at => at.name === ut.name)).length;
                                                }
                                            }
                                            
                                            return (
                                                <div key={u.uid} className={`bg-card p-3 sm:p-4 rounded-xl border shadow-sm flex flex-col sm:flex-row gap-4 items-center justify-between transition-colors ${hits > 0 ? 'border-indigo-500/30' : 'border-card-border'}`}>
                                                    <div className="flex items-center gap-3 w-full sm:w-1/4 shrink-0">
                                                        <img src={u.photoURL} className="w-10 h-10 rounded-full border border-border" alt="" />
                                                        <div>
                                                            <p className="font-bold text-xs sm:text-sm leading-tight">{formatShortName(u.name)}</p>
                                                            {hits > 0 && <p className="text-[10px] text-indigo-400 font-black mt-0.5">+{hits * ptsPerHit} PTS</p>}
                                                        </div>
                                                    </div>
                                                    <div className="flex flex-wrap gap-1.5 w-full sm:w-3/4 justify-start sm:justify-end">
                                                        {uTeams.map(ut => {
                                                            const hit = aTeamsCurrentRound.some(at => at.name === ut.name);
                                                            
                                                            return (
                                                                <span key={ut.name} className={`px-2 py-1 rounded text-[9px] sm:text-[10px] font-bold border transition-colors ${hit ? 'bg-green-500/20 text-green-500 border-green-500/40' : 'bg-background text-foreground-muted border-border/50'}`}>
                                                                    {translateTeam(ut.name)}
                                                                </span>
                                                            );
                                                        })}
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </>
                            );
                        })()}
                    </div>
                )}

                {/* TAB: CUADRO DE HONOR */}
                {activeTab === 'podio' && (
                    <div className="relative z-10 animate-fade-in">
                        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-8">
                            {honorSlots.map(slot => {
                                const aTeam = adminResults?.knockoutPicks?.[slot.id]?.[0];
                                return (
                                    <div key={slot.id} className="bg-card border border-border p-4 rounded-2xl flex flex-col items-center text-center shadow-lg relative overflow-hidden">
                                        <div className="absolute top-0 left-0 w-full h-1 bg-primary/50"></div>
                                        <span className="text-3xl sm:text-4xl mb-2 drop-shadow-md">{slot.icon}</span>
                                        <span className="text-[10px] font-bold uppercase tracking-widest text-foreground-muted mb-1">{slot.label}</span>
                                        <span className="font-black text-xs sm:text-sm text-foreground">{aTeam ? translateTeam(aTeam.name) : '⏳ TBD'}</span>
                                    </div>
                                );
                            })}
                        </div>

                        <div className="space-y-3">
                            {validUsers.map(u => {
                                let totalHonorPts = 0;
                                const userHits = honorSlots.map(slot => {
                                    const uTeam = u.data?.knockoutPicks?.[slot.id]?.[0];
                                    const aTeam = adminResults?.knockoutPicks?.[slot.id]?.[0];
                                    const hit = uTeam && aTeam && uTeam.name === aTeam.name;
                                    if (hit) totalHonorPts += slot.pts;
                                    return { slot, team: uTeam, hit };
                                });

                                let isSuperBono = false;
                                if (adminResults?.knockoutPicks) {
                                    isSuperBono = honorSlots.every(s => u.data?.knockoutPicks?.[s.id]?.[0]?.name === adminResults.knockoutPicks[s.id]?.[0]?.name && adminResults.knockoutPicks[s.id]?.[0]?.name);
                                }
                                if (isSuperBono) totalHonorPts += 10;

                                return (
                                    <div key={u.uid} className={`bg-card p-4 rounded-xl border shadow-sm flex flex-col sm:flex-row gap-4 items-center justify-between transition-colors ${totalHonorPts > 0 ? 'border-primary/30 bg-primary/5' : 'border-card-border'}`}>
                                        <div className="flex items-center gap-3 w-full sm:w-1/4 shrink-0">
                                            <img src={u.photoURL} className="w-10 h-10 rounded-full border border-border" alt="" />
                                            <div>
                                                <p className="font-bold text-xs sm:text-sm leading-tight">{formatShortName(u.name)}</p>
                                                {totalHonorPts > 0 && <p className="text-[10px] text-primary font-black mt-0.5">+{totalHonorPts} PTS {isSuperBono && '(+BONO)'}</p>}
                                            </div>
                                        </div>
                                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 w-full sm:w-3/4">
                                            {userHits.map((h, i) => (
                                                <div key={i} className={`flex flex-col items-center justify-center p-2 rounded-lg border text-center ${h.hit ? 'bg-green-500/20 border-green-500/40 text-green-500' : 'bg-background border-border/50 text-foreground-muted'}`}>
                                                    <span className="text-[8px] uppercase font-bold opacity-50 mb-0.5">{h.slot.label}</span>
                                                    <span className="text-[10px] font-black leading-tight">{h.team ? translateTeam(h.team.name) : '-'}</span>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                )}

                {/* TAB: GRUPOS (POSICIONES EXACTAS) */}
                {activeTab === 'grupos' && (
                    <div className="relative z-10 animate-fade-in">
                        <div className="flex overflow-x-auto hide-scrollbar gap-2 mb-6 p-1">
                            {groupNames.map(g => (
                                <button key={g} onClick={() => setSelectedGroup(g)} className={`px-4 py-2 rounded-lg font-black text-xs sm:text-sm whitespace-nowrap border shadow-sm ${selectedGroup === g ? 'bg-blue-600 text-white border-blue-500' : 'bg-card text-foreground-muted border-border hover:bg-background-offset'}`}>
                                    {g.replace('Grupo ', 'G. ')}
                                </button>
                            ))}
                        </div>

                        {(() => {
                            const groupMatches = effectiveMatches.filter(m => (m.group?.replace('GROUP_', 'Grupo ') || 'Fase de Grupos') === selectedGroup);
                            
                            const isGroupActive = groupMatches.some(m => adminResults?.predictions?.[m.id]?.home !== undefined);
                            
                            const isGroupFinished = groupMatches.length > 0 && groupMatches.every(m => {
                                const p = adminResults?.predictions?.[m.id];
                                return (p && p.home !== undefined && p.home !== '') || m.status === 'FINISHED';
                            });

                            const adminStandings = getStandings(groupMatches, adminResults?.predictions, selectedGroup, adminResults?.manualTiebreakers);

                            return (
                                <>
                                    <div className="bg-blue-600/10 border border-blue-500/20 p-4 rounded-2xl mb-6 shadow-sm">
                                        <div className="flex justify-between items-center mb-3">
                                            <h4 className="text-xs sm:text-sm font-black uppercase tracking-widest text-blue-400">Posiciones Reales ({selectedGroup})</h4>
                                            <span className={`text-[9px] font-black px-2 py-1 rounded uppercase tracking-widest ${isGroupFinished ? 'bg-green-500 text-white' : 'bg-background-offset text-foreground-muted'}`}>{isGroupFinished ? 'Finalizado' : 'En Juego'}</span>
                                        </div>
                                        <div className="flex flex-wrap gap-2">
                                            {isGroupActive ? adminStandings.map((t, i) => (
                                                <div key={t.name} className="flex items-center gap-1.5 bg-card border border-border px-2 py-1.5 rounded shadow-sm">
                                                    <span className="text-[10px] font-black text-foreground-muted">{i+1}º</span>
                                                    <span className="text-[10px] sm:text-xs font-bold text-foreground">{translateTeam(t.name)}</span>
                                                </div>
                                            )) : <span className="text-foreground-muted text-xs italic">No hay puntajes oficiales aún.</span>}
                                        </div>
                                    </div>

                                    <div className="space-y-3">
                                        {validUsers.map(u => {
                                            const userStandings = getStandings(groupMatches, u.data?.predictions, selectedGroup, u.data?.manualTiebreakers);
                                            
                                            const predictedCount = groupMatches.filter(m => u.data?.predictions?.[m.id]?.home !== undefined).length;

                                            const isPleno = isGroupFinished && predictedCount > 0 && userStandings.length >= 4 && adminStandings.length >= 4 &&
                                                userStandings[0].name === adminStandings[0].name && 
                                                userStandings[1].name === adminStandings[1].name &&
                                                userStandings[2].name === adminStandings[2].name && 
                                                userStandings[3].name === adminStandings[3].name;

                                            return (
                                                <div key={u.uid} className={`bg-card p-3 sm:p-4 rounded-xl border shadow-sm flex flex-col sm:flex-row gap-4 items-center justify-between transition-colors ${isPleno ? 'border-green-500/50 bg-green-500/5' : 'border-card-border'}`}>
                                                    <div className="flex items-center gap-3 w-full sm:w-1/4 shrink-0">
                                                        <img src={u.photoURL} className="w-10 h-10 rounded-full border border-border" alt="" />
                                                        <div className="flex flex-col items-start">
                                                            <p className="font-bold text-xs sm:text-sm leading-tight">{formatShortName(u.name)}</p>
                                                            {isPleno && (
                                                                <span className="inline-flex items-center gap-1 bg-green-500 text-white px-2 py-0.5 rounded text-[9px] sm:text-[10px] font-black shadow-sm mt-1 uppercase tracking-widest">
                                                                    <span>🎯</span> PLENO (+8 PTS)
                                                                </span>
                                                            )}
                                                        </div>
                                                    </div>
                                                    <div className="flex flex-wrap gap-1.5 w-full sm:w-3/4 justify-start sm:justify-end">
                                                        {userStandings.map((t, i) => {
                                                            const hit = isGroupFinished && adminStandings[i]?.name === t.name;
                                                            return (
                                                                <div key={t.name} className={`flex items-center gap-1 border px-2 py-1 rounded transition-colors ${hit ? 'bg-green-500/20 border-green-500/40 text-green-500' : 'bg-background border-border/50 text-foreground-muted'}`}>
                                                                    <span className="text-[9px] font-black opacity-50">{i+1}º</span>
                                                                    <span className="text-[9px] sm:text-[10px] font-bold leading-none">{translateTeam(t.name)}</span>
                                                                </div>
                                                            );
                                                        })}
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </>
                            );
                        })()}
                    </div>
                )}

            </div>
        </div>
    );
};

export default WorldCupGridOthers;