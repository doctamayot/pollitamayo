import React, { useState, useEffect, useMemo } from 'react';
import { db } from '../firebase';
import { collection, onSnapshot, doc } from 'firebase/firestore';
import { getWorldCupMatches } from '../services/apiFootball';
import logocopa from '../assets/logocopa.png';

// --- TRADUCCIONES Y CONSTANTES ---
const EXCLUDED_EMAILS = ['doctamayot@gmail.com', 'admin@polli-tamayo.com'];

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

const matchStatusTranslations = {
    SCHEDULED: 'Programado', TIMED: 'Confirmado', IN_PLAY: 'En Juego', PAUSED: 'En Pausa',
    FINISHED: 'Finalizado', SUSPENDED: 'Suspendido', POSTPONED: 'Pospuesto', CANCELLED: 'Cancelado'
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

const roundTabs = [
    { id: 'dieciseisavos', pts: 2 }, { id: 'octavos', pts: 3 }, { id: 'cuartos', pts: 4 }, { id: 'semis', pts: 5 }
];

const translateTeam = (name) => teamTranslations[name] || name;

const formatShortName = (fullName) => {
    if (!fullName) return 'Anon';
    const parts = fullName.trim().split(' ');
    if (parts.length === 1) return parts[0];
    return `${parts[0]} ${parts[1].charAt(0)}.`;
};

const isSmartMatch = (userText, adminText) => {
    if (!userText || !adminText) return false;
    const clean = (str) => str.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]/g, "").trim();
    const u = clean(userText); const a = clean(adminText);
    return u === a || (u.length > 3 && (a.includes(u) || u.includes(a)));
};

const WorldCupGrid = () => {
    const [matches, setMatches] = useState([]);
    const [allPredictions, setAllPredictions] = useState({});
    const [usersInfo, setUsersInfo] = useState({});
    const [adminResults, setAdminResults] = useState(null);
    const [selectedDate, setSelectedDate] = useState(null);
    const [isApiLoading, setIsApiLoading] = useState(true);
    const [isDbLoading, setIsDbLoading] = useState(true);

    useEffect(() => {
        const fetchMatches = async () => {
            try {
                const data = await getWorldCupMatches();
                if (data && data.matches) setMatches(data.matches.filter(m => m.stage === 'GROUP_STAGE'));
            } catch (err) { console.error(err); }
            finally { setIsApiLoading(false); }
        };
        fetchMatches();

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
    }, []);

    // --- LÓGICA DE TABLAS PARA EL MOTOR DE PUNTOS ---
    const groupMatchesMap = useMemo(() => {
        return matches.reduce((acc, m) => {
            let g = m.group?.replace('GROUP_', 'Grupo ') || 'Fase de Grupos';
            if (!acc[g]) acc[g] = []; acc[g].push(m); return acc;
        }, {});
    }, [matches]);

    const isGroupStageFinished = useMemo(() => {
        if (matches.length === 0) return false;
        return matches.every(m => {
            const apiFinished = m.status === 'FINISHED';
            const adminFinished = adminResults?.predictions?.[m.id] && adminResults.predictions[m.id].home !== '';
            return apiFinished || adminFinished;
        });
    }, [matches, adminResults]);

    const getStandings = (groupMatches, preds, ties) => {
        const teams = {};
        groupMatches.forEach(m => {
            const h = m.homeTeam.name; const v = m.awayTeam.name;
            if (!teams[h]) teams[h] = { name: h, pts: 0, dg: 0, gf: 0 };
            if (!teams[v]) teams[v] = { name: v, pts: 0, dg: 0, gf: 0 };
            const pr = preds?.[m.id];
            if (pr && pr.home !== '' && pr.home !== undefined && pr.away !== '') {
                const gh = parseInt(pr.home); const ga = parseInt(pr.away);
                teams[h].pts += gh > ga ? 3 : gh === ga ? 1 : 0;
                teams[v].pts += ga > gh ? 3 : gh === ga ? 1 : 0;
                teams[h].dg += (gh - ga); teams[v].dg += (ga - gh);
                teams[h].gf += gh; teams[v].gf += ga;
            }
        });
        return Object.values(teams).sort((a,b) => (b.pts - a.pts) || (b.dg - a.dg) || (b.gf - a.gf) || ((ties?.[a.name] || 0) - (ties?.[b.name] || 0)));
    };

    const adminQualified32 = useMemo(() => {
        if (!adminResults?.predictions) return [];
        let top2 = []; let thirds = [];
        Object.keys(groupMatchesMap).forEach(g => {
            const st = getStandings(groupMatchesMap[g], adminResults.predictions, adminResults.manualTiebreakers?.[g]);
            if (st[0]) top2.push(st[0]); if (st[1]) top2.push(st[1]); if (st[2]) thirds.push(st[2]);
        });
        thirds.sort((a, b) => b.pts - a.pts || b.dg - a.dg || b.gf - a.gf);
        return [...top2, ...thirds.slice(0, 8)];
    }, [groupMatchesMap, adminResults]);

    // --- MOTOR DE PUNTOS TOTAL (Sincronizado con Ranking Oficial) ---
    const liveRanking = useMemo(() => {
        const ranks = [];
        Object.keys(allPredictions).forEach(uid => {
            const userData = allPredictions[uid];
            if (!userData.hasPaid || EXCLUDED_EMAILS.includes(userData.email)) return;

            let total = 0;

            matches.forEach(m => {
                const p = userData.predictions?.[m.id]; const a = adminResults?.predictions?.[m.id];
                const rH = (a && a.home !== '') ? a.home : m.score?.fullTime?.home;
                const rA = (a && a.away !== '') ? a.away : m.score?.fullTime?.away;
                const hasO = (a && a.home !== '' && a.away !== '') || m.status === 'FINISHED' || m.status.includes('PLAY');
                if (hasO && p && p.home !== '' && p.away !== '') {
                    const pH = parseInt(p.home); const pA = parseInt(p.away);
                    if (pH == rH && pA == rA) total += 5;
                    else {
                        const pR = Math.sign(pH - pA); const rR = Math.sign(rH - rA);
                        if (pR === rR && (pH == rH || pA == rA)) total += 3;
                        else if (pR === rR) total += 2;
                        else if (pH == rH || pA == rA) total += 1;
                    }
                }
            });

            let userTop2 = []; let userThirds = [];
            Object.keys(groupMatchesMap).forEach(g => {
                const groupIsOver = groupMatchesMap[g].every(m => (adminResults?.predictions?.[m.id] && adminResults?.predictions?.[m.id].home !== '') || m.status === 'FINISHED');
                const uT = getStandings(groupMatchesMap[g], userData.predictions, userData.manualTiebreakers?.[g]);
                if (uT[0]) userTop2.push(uT[0]); if (uT[1]) userTop2.push(uT[1]); if (uT[2]) userThirds.push(uT[2]);

                if (groupIsOver) {
                    const aT = getStandings(groupMatchesMap[g], adminResults?.predictions, adminResults?.manualTiebreakers?.[g]);
                    if (uT.length >= 4 && aT.length >= 4 && uT.slice(0,4).map(t=>t.name).every((v,i) => v === aT[i].name)) total += 8;
                }
            });
            userThirds.sort((a, b) => b.pts - a.pts || b.dg - a.dg || b.gf - a.gf);
            const userQualified32 = [...userTop2, ...userThirds.slice(0, 8)];

            roundTabs.forEach(r => {
                const is16 = r.id === 'dieciseisavos';
                if (is16 && !isGroupStageFinished) return;
                const uTeams = is16 ? userQualified32 : (userData.knockoutPicks?.[r.id] || []);
                const aTeams = is16 ? adminQualified32 : (adminResults?.knockoutPicks?.[r.id] || []);
                if (aTeams.length > 0) {
                    uTeams.forEach(ut => { if (aTeams.some(at => at.name === ut.name)) total += r.pts; });
                }
            });

            extraQuestions.forEach(q => {
                const u = userData.extraPicks?.[q.id]; const a = adminResults?.extraPicks?.[q.id];
                if (u && a && (q.manual ? isSmartMatch(u, a) : u.toLowerCase() === a.toLowerCase())) total += 6;
            });
            specialEvents.forEach(e => {
                const u = userData.eventPicks?.[e.id]; const a = adminResults?.eventPicks?.[e.id];
                if (u && a === u) total += (u === 'SI' ? 5 : 2);
            });

            const honorSlots = [{ id: 'campeon', pts: 10 }, { id: 'subcampeon', pts: 6 }, { id: 'tercero', pts: 6 }, { id: 'cuarto', pts: 6 }];
            let honorHits = 0;
            honorSlots.forEach(s => {
                if (userData.knockoutPicks?.[s.id]?.[0]?.name === adminResults?.knockoutPicks?.[s.id]?.[0]?.name && adminResults?.knockoutPicks?.[s.id]?.[0]?.name) { total += s.pts; honorHits++; }
            });
            if (honorHits === 4) total += 10;

            ranks.push({
                uid,
                name: usersInfo[uid]?.displayName || userData.displayName || 'Invitado',
                photoURL: usersInfo[uid]?.photoURL || userData.photoURL || logocopa,
                totalPoints: total
            });
        });

        // Posiciones globales para las coronas
        ranks.sort((a, b) => b.totalPoints - a.totalPoints);
        let currentRank = 1;
        ranks.forEach((r, i) => {
            if (i > 0 && r.totalPoints < ranks[i - 1].totalPoints) currentRank = i + 1;
            r.position = currentRank;
        });

        return ranks;
    }, [allPredictions, matches, adminResults, usersInfo, groupMatchesMap, isGroupStageFinished, adminQualified32]);

    // --- AGRUPACIÓN DE FECHAS ---
    const matchesByDate = useMemo(() => {
        const grouped = {};
        matches.forEach(m => {
            const dateStr = new Date(m.utcDate).toLocaleDateString('es-ES', { year: 'numeric', month: '2-digit', day: '2-digit' });
            if (!grouped[dateStr]) grouped[dateStr] = [];
            grouped[dateStr].push(m);
        });
        return grouped;
    }, [matches]);

    const sortedDates = useMemo(() => {
        return Object.keys(matchesByDate).sort((a, b) => {
            const [d1, m1, y1] = a.split('/'); const [d2, m2, y2] = b.split('/');
            return new Date(`${y1}-${m1}-${d1}`) - new Date(`${y2}-${m2}-${d2}`);
        });
    }, [matchesByDate]);

    // --- LÓGICA DE APARICIÓN INTELIGENTE ---
    useEffect(() => {
        if (sortedDates.length > 0 && !selectedDate) {
            const today = new Date().toLocaleDateString('es-ES', { year: 'numeric', month: '2-digit', day: '2-digit' });
            if (sortedDates.includes(today)) {
                setSelectedDate(today);
            } else {
                const nextActiveDate = sortedDates.find(date => {
                    return matchesByDate[date]?.some(m => m.status !== 'FINISHED');
                });
                setSelectedDate(nextActiveDate || sortedDates[0]);
            }
        }
    }, [sortedDates, selectedDate, matchesByDate]);

    const sortedMatchesOfDay = useMemo(() => {
        if (!selectedDate || !matchesByDate[selectedDate]) return [];
        return [...matchesByDate[selectedDate]].sort((a, b) => {
            const getStatusPriority = (m) => {
                if (m.status === 'IN_PLAY' || m.status === 'PAUSED') return 0; 
                if (m.status === 'TIMED' || m.status === 'SCHEDULED') return 1;
                if (m.status === 'FINISHED') return 2; 
                return 3; 
            };
            const priorityDiff = getStatusPriority(a) - getStatusPriority(b);
            if (priorityDiff !== 0) return priorityDiff;
            return new Date(a.utcDate) - new Date(b.utcDate);
        });
    }, [selectedDate, matchesByDate]); 

    if (isApiLoading || isDbLoading) return (
        <div className="flex flex-col items-center justify-center py-32 animate-fade-in">
            <img src={logocopa} className="w-20 h-20 mb-6 animate-pulse opacity-50" alt="Cargando" />
            <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin mb-4"></div>
            <p className="text-foreground-muted font-bold tracking-widest uppercase text-xs text-center">Sincronizando Grilla Live...</p>
        </div>
    );

    return (
        <div className="max-w-5xl mx-auto pb-24 animate-fade-in px-2 sm:px-0">
            
            {/* BANNER PRINCIPAL PREMIUM */}
            <div className="bg-gradient-to-br from-slate-900 to-slate-800 rounded-[2rem] p-6 sm:p-10 mb-8 text-center border border-border shadow-2xl relative overflow-hidden flex flex-col sm:flex-row items-center justify-center gap-4 sm:gap-6">
                <div className="absolute top-0 left-0 w-full h-full bg-primary/5 z-0 pointer-events-none"></div>
                <img src={logocopa} className="hidden sm:block w-20 h-20 object-contain drop-shadow-[0_0_15px_rgba(245,158,11,0.4)] z-10" alt="" />
                
                <div className="relative z-10">
                    <h2 className="text-2xl sm:text-4xl font-black text-white mb-1 sm:mb-2 tracking-tighter">📡 GRILLA LIVE</h2>
                    <p className="text-primary font-black uppercase text-[9px] sm:text-xs tracking-widest bg-primary/10 px-4 py-1.5 rounded-full border border-primary/20 inline-block">
                        Puntos Globales en Tiempo Real
                    </p>
                </div>
                
                <img src={logocopa} className="sm:hidden w-16 h-16 object-contain opacity-80 z-10" alt="" />
            </div>

            {/* SELECTOR FECHAS */}
            <div className="flex overflow-x-auto gap-2 mb-6 pb-2 hide-scrollbar">
                {sortedDates.map(d => (
                    <button key={d} onClick={() => setSelectedDate(d)} className={`shrink-0 px-4 py-2 sm:px-6 sm:py-3.5 rounded-xl text-[10px] sm:text-xs font-black transition-all shadow-sm ${selectedDate === d ? 'bg-primary text-white scale-105' : 'bg-card text-foreground-muted border border-border hover:bg-background-offset'}`}>
                        {d}
                    </button>
                ))}
            </div>

            {/* PARTIDOS */}
            <div className="space-y-6 sm:space-y-10">
                {sortedMatchesOfDay.map(match => {
                    const a = adminResults?.predictions?.[match.id];
                    const rH = (a && a.home !== '') ? a.home : match.score?.fullTime?.home;
                    const rA = (a && a.away !== '') ? a.away : match.score?.fullTime?.away;
                    const hasO = (a && a.home !== '' && a.away !== '') || match.status === 'FINISHED' || match.status.includes('PLAY');
                    const isLive = match.status === 'IN_PLAY' || match.status === 'PAUSED';

                    // --- ORDENAMIENTO EN CALIENTE POR PARTIDO EN CASCADA (5, 3, 2, 1, 0) ---
                    const matchSpecificRanking = liveRanking.map(user => {
                        const uP = allPredictions[user.uid]?.predictions?.[match.id];
                        let pts = null;
                        if (hasO && uP && uP.home !== '') {
                            const pH = parseInt(uP.home); const pA = parseInt(uP.away);
                            if (pH == rH && pA == rA) pts = 5;
                            else {
                                const pR = Math.sign(pH - pA); const rR = Math.sign(rH - rA);
                                if (pR === rR && (pH == rH || pA == rA)) pts = 3;
                                else if (pR === rR) pts = 2;
                                else if (pH == rH || pA == rA) pts = 1;
                                else pts = 0;
                            }
                        }
                        return { ...user, uP, pts };
                    }).sort((userA, userB) => {
                        // 1. Líderes del torneo (Globales) siempre arriba
                        const isLeaderA = userA.position === 1;
                        const isLeaderB = userB.position === 1;
                        if (isLeaderA && !isLeaderB) return -1;
                        if (!isLeaderA && isLeaderB) return 1;

                        // 2. Orden en cascada por puntos del partido (5, 3, 2, 1, 0, null)
                        const ptsA = userA.pts !== null ? userA.pts : -1; 
                        const ptsB = userB.pts !== null ? userB.pts : -1;
                        
                        if (ptsA !== ptsB) {
                            return ptsB - ptsA; // De mayor a menor
                        }

                        // 3. Desempate: Se mantiene el orden del Ranking Global
                        return userB.totalPoints - userA.totalPoints;
                    });

                    return (
                        <div key={match.id} className={`bg-card border ${isLive ? 'border-green-500 shadow-[0_0_20px_rgba(34,197,94,0.15)]' : 'border-border'} rounded-[1.5rem] sm:rounded-[2rem] overflow-hidden shadow-xl relative flex flex-col`}>
                            
                            {/* SCOREBOARD PARTIDO - DISTRIBUCIÓN MATEMÁTICA 40% - 20% - 40% */}
                            <div className={`${isLive ? 'bg-green-500/5' : 'bg-background-offset'} p-4 sm:p-6 border-b border-border relative z-20`}>
                                <div className="flex justify-between items-center mb-3 sm:mb-5">
                                    <span className={`text-[9px] sm:text-[10px] font-black px-2.5 sm:px-4 py-0.5 sm:py-1 rounded-full uppercase ${isLive ? 'bg-green-500 text-white animate-pulse' : 'bg-primary/20 text-primary'}`}>
                                        {match.group?.replace('GROUP_', 'Grupo ') || 'Fase'}
                                    </span>
                                    <span className="text-[10px] sm:text-xs font-bold text-foreground-muted uppercase tracking-widest bg-background/50 px-2 py-1 rounded border border-border/50">
                                        {new Date(match.utcDate).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                                    </span>
                                </div>
                                
                                <div className="flex items-center justify-between w-full">
                                    {/* Izquierda: Equipo 40% */}
                                    <div className="w-[40%] flex flex-col items-center justify-center">
                                        <img src={match.homeTeam.crest} className="h-6 sm:h-14 mb-1.5 sm:mb-3 drop-shadow-md" alt="" />
                                        <p className="font-black text-[11px] sm:text-xl truncate px-1 text-center w-full">{translateTeam(match.homeTeam.name)}</p>
                                    </div>
                                    
                                    {/* Centro: Marcador 20% */}
                                    <div className="w-[20%] flex flex-col items-center justify-center shrink-0">
                                        <span className={`text-[7px] sm:text-[10px] font-black uppercase tracking-widest mb-1.5 sm:mb-2 px-2 py-0.5 rounded ${isLive ? 'text-green-500 bg-green-500/10 animate-pulse' : match.status === 'FINISHED' ? 'text-red-500 bg-red-500/10' : 'text-foreground-muted bg-background/50'}`}>
                                            {isLive ? '• EN VIVO' : matchStatusTranslations[match.status] || match.status}
                                        </span>
                                        <div className={`flex items-center justify-center gap-1.5 sm:gap-4 px-3 py-1.5 sm:px-6 sm:py-3 rounded-xl sm:rounded-2xl border font-black text-2xl sm:text-5xl flex-nowrap whitespace-nowrap shadow-md ${hasO ? 'bg-foreground text-background border-foreground scale-105 transition-transform' : 'bg-background text-foreground-muted border-border'}`}>
                                            <span>{hasO ? (rH ?? 0) : '-'}</span>
                                            <span className="text-lg sm:text-3xl opacity-20">-</span>
                                            <span>{hasO ? (rA ?? 0) : '-'}</span>
                                        </div>
                                    </div>
                                    
                                    {/* Derecha: Equipo 40% */}
                                    <div className="w-[40%] flex flex-col items-center justify-center">
                                        <img src={match.awayTeam.crest} className="h-6 sm:h-14 mb-1.5 sm:mb-3 drop-shadow-md" alt="" />
                                        <p className="font-black text-[11px] sm:text-xl truncate px-1 text-center w-full">{translateTeam(match.awayTeam.name)}</p>
                                    </div>
                                </div>
                            </div>

                            {/* TABLA JUGADORES */}
                            <div className="w-full relative z-10 overflow-hidden bg-background-offset/10 min-h-[150px] flex-grow">
                                
                                {/* Marca de agua Logocopa Centrada SOLO EN LA ZONA DE JUGADORES */}
                                <img src={logocopa} className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-48 h-48 sm:w-80 sm:h-80 object-contain opacity-[0.03] dark:opacity-[0.05] pointer-events-none z-0" alt="" />

                                {/* TABLA - DISTRIBUCIÓN MATEMÁTICA 40% - 20% - 20% - 20% */}
                                <table className="w-full text-left table-fixed relative z-10">
                                    <thead>
                                        <tr className="bg-background/80 backdrop-blur-md text-[8px] sm:text-xs uppercase font-black border-b border-border text-foreground-muted">
                                            <th className="py-2 pl-3 sm:p-5 w-[42%] sm:w-[50%] lg:w-[58%] sm:pl-8">Jugador</th>
                                            <th className="py-2 w-[22%] sm:w-[18%] lg:w-[14%] text-center">Apuesta</th>
                                            <th className="py-2 w-[18%] sm:w-[16%] lg:w-[14%] text-center">Pts P.</th>
                                            <th className="py-2 pr-3 sm:p-5 w-[18%] sm:w-[16%] lg:w-[14%] text-center sm:pr-8">Global</th>
                                        </tr>
                                    </thead>
                                    <tbody className="text-[10px] sm:text-sm">
                                        {/* AHORA MAPEAMOS EL ARRAY ORDENADO EN CASCADA */}
                                        {matchSpecificRanking.map((user) => {
                                            return (
                                                <tr key={user.uid} className={`border-b border-border/10 hover:bg-background/50 transition-colors ${user.position === 1 ? 'bg-yellow-500/5' : ''}`}>
                                                    <td className="py-3 sm:py-5 pl-3 sm:pl-8 border-r border-border/10 overflow-hidden">
                                                        <div className="flex items-center gap-1.5 sm:gap-4 min-w-0">
                                                            <div className="relative shrink-0">
                                                                <img src={user.photoURL} className={`w-6 h-6 sm:w-12 sm:h-12 rounded-full border object-cover ${user.position === 1 ? 'border-yellow-400 shadow-sm' : 'border-border'}`} alt="" />
                                                                {/* CORONA PARA TODOS LOS QUE ESTÉN EMPATADOS EN EL 1ER LUGAR DEL TORNEO */}
                                                                {user.position === 1 && <span className="absolute -top-1.5 -left-1.5 text-[8px] sm:text-sm drop-shadow-md">👑</span>}
                                                            </div>
                                                            <span className={`font-bold truncate text-[9px] sm:text-lg ${user.position === 1 ? 'text-yellow-500' : 'text-foreground'}`}>{formatShortName(user.name)}</span>
                                                        </div>
                                                    </td>
                                                    
                                                    {/* CELDA APUESTA CENTRADA ESTRICTA */}
                                                    <td className="py-3 sm:py-5 text-center border-r border-border/10">
                                                        <div className="flex justify-center w-full">
                                                            {user.uP ? (
                                                                <span className="bg-background-offset/80 px-2 py-1 sm:px-5 sm:py-2.5 rounded-lg border border-border font-black text-[9px] sm:text-xl whitespace-nowrap inline-flex items-center shadow-inner">
                                                                    {user.uP.home} - {user.uP.away}
                                                                </span>
                                                            ) : <span className="opacity-30 italic text-[9px] sm:text-base">-</span>}
                                                        </div>
                                                    </td>
                                                    
                                                    {/* CELDA PUNTOS PARTIDO CENTRADA ESTRICTA */}
                                                    <td className="py-3 sm:py-5 text-center border-r border-border/10">
                                                        <div className="flex justify-center w-full">
                                                            {user.pts !== null && (
                                                                <span className={`inline-flex items-center justify-center font-black px-1.5 py-0.5 sm:px-4 sm:py-2 rounded-md text-[10px] sm:text-xl ${user.pts === 5 ? 'text-green-500 bg-green-500/10 border border-green-500/20 shadow-[0_0_8px_rgba(34,197,94,0.15)]' : user.pts > 0 ? 'text-blue-500 bg-blue-500/10' : 'text-red-500/40'}`}>
                                                                    {user.pts > 0 ? `+${user.pts}` : '0'}
                                                                </span>
                                                            )}
                                                        </div>
                                                    </td>

                                                    {/* CELDA PUNTOS GLOBALES */}
                                                    <td className="py-3 sm:py-5 text-center pr-3 sm:pr-8">
                                                        <div className="flex justify-center w-full">
                                                            <span className="font-black text-primary text-xs sm:text-3xl tabular-nums">
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