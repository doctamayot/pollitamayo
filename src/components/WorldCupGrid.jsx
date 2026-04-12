import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
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

// Formateador de fechas elegante para los Tabs
const formatDateObj = (dateStr) => {
    const [y, m, d] = dateStr.split('-');
    const date = new Date(y, m - 1, d);
    const dayName = date.toLocaleDateString('es-ES', { weekday: 'short' }).toUpperCase().replace('.', '');
    const dayNum = date.getDate();
    const monthName = date.toLocaleDateString('es-ES', { month: 'short' }).toUpperCase().replace('.', '');
    return { dayName, dayNum, monthName };
};

const WorldCupGrid = () => {
    const [matches, setMatches] = useState([]);
    const [allPredictions, setAllPredictions] = useState({});
    const [usersInfo, setUsersInfo] = useState({});
    const [adminResults, setAdminResults] = useState(null);
    const [selectedDate, setSelectedDate] = useState(null);
    const [isApiLoading, setIsApiLoading] = useState(true);
    const [isDbLoading, setIsDbLoading] = useState(true);

    const scrollContainerRef = useRef(null);

    useEffect(() => {
        const fetchMatches = async () => {
            try {
                const data = await getWorldCupMatches();
                if (data && data.matches) setMatches(data.matches);
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

    const allTeams = useMemo(() => {
        const teamsMap = new Map();
        matches.forEach(m => {
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
    }, [matches]);

    const getStandings = useCallback((groupMatches, preds, groupName, tiebreakers) => {
        const teams = {};
        groupMatches.forEach(m => {
            const h = m.homeTeam.name; const v = m.awayTeam.name;
            if (!teams[h]) teams[h] = { name: h, pts: 0, dg: 0, gf: 0 };
            if (!teams[v]) teams[v] = { name: v, pts: 0, dg: 0, gf: 0 };
        });

        groupMatches.forEach(m => {
            const pr = preds?.[m.id];
            if (pr && pr.home !== '' && pr.home !== undefined && pr.away !== '' && pr.away !== undefined) {
                const gh = parseInt(pr.home, 10); const ga = parseInt(pr.away, 10);
                teams[m.homeTeam.name].pts += gh > ga ? 3 : gh === ga ? 1 : 0;
                teams[m.awayTeam.name].pts += ga > gh ? 3 : gh === ga ? 1 : 0;
                teams[m.homeTeam.name].dg += (gh - ga); teams[m.awayTeam.name].dg += (ga - gh);
                teams[m.homeTeam.name].gf += gh; teams[m.awayTeam.name].gf += ga;
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

    const groupStageMatches = useMemo(() => matches.filter(m => m.stage === 'GROUP_STAGE'), [matches]);

    const groupMatchesMap = useMemo(() => {
        return groupStageMatches.reduce((acc, m) => {
            let g = m.group?.replace('GROUP_', 'Grupo ') || 'Fase de Grupos';
            if (!acc[g]) acc[g] = []; acc[g].push(m); return acc;
        }, {});
    }, [groupStageMatches]);

    const isGroupStageFinished = useMemo(() => {
        if (groupStageMatches.length === 0) return false;
        return groupStageMatches.every(m => {
            const apiFinished = m.status === 'FINISHED';
            const adminFinished = adminResults?.predictions?.[m.id] && adminResults.predictions[m.id].home !== '' && adminResults.predictions[m.id].home !== null;
            return apiFinished || adminFinished;
        });
    }, [groupStageMatches, adminResults]);

    const adminQualified32 = useMemo(() => {
        if (!adminResults?.predictions) return [];
        let top2 = []; let thirds = [];
        Object.keys(groupMatchesMap).forEach(g => {
            const st = getStandings(groupMatchesMap[g], adminResults.predictions, g, adminResults.manualTiebreakers);
            if (st[0]) top2.push(st[0]); if (st[1]) top2.push(st[1]); if (st[2]) thirds.push(st[2]);
        });
        thirds.sort((a, b) => b.pts - a.pts || b.dg - a.dg || b.gf - a.gf);
        return [...top2, ...thirds.slice(0, 8)];
    }, [groupMatchesMap, adminResults, getStandings]);

    const liveRanking = useMemo(() => {
        const ranks = [];
        Object.keys(allPredictions).forEach(uid => {
            const userData = allPredictions[uid];
            if (!userData.hasPaid || EXCLUDED_EMAILS.includes(userData.email)) return;

            let total = 0;

            matches.forEach(m => {
                const p = userData.predictions?.[m.id]; const a = adminResults?.predictions?.[m.id];
                const rH = a?.home !== undefined && a?.home !== '' ? a.home : m.score?.fullTime?.home;
                const rA = a?.away !== undefined && a?.away !== '' ? a.away : m.score?.fullTime?.away;
                const matchStatus = m.status || '';
                const hasO = (a && a.home !== '' && a.away !== '') || matchStatus === 'FINISHED' || matchStatus.includes('PLAY');
                
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
                const groupMatches = groupMatchesMap[g];
                
                let predictedCount = 0;
                groupMatches.forEach(m => {
                    const p = userData.predictions?.[m.id];
                    if (p && p.home !== '' && p.home !== undefined && p.away !== '' && p.away !== undefined) {
                        predictedCount++;
                    }
                });

                if (predictedCount === 0) return;

                const groupIsOver = groupMatches.every(m => {
                    const apiFinished = m.status === 'FINISHED';
                    const adminFinished = adminResults?.predictions?.[m.id] && adminResults.predictions[m.id].home !== '' && adminResults.predictions[m.id].home !== null;
                    return apiFinished || adminFinished;
                });

                const uT = getStandings(groupMatches, userData.predictions, g, userData.manualTiebreakers);
                if (uT[0]) userTop2.push(uT[0]); if (uT[1]) userTop2.push(uT[1]); if (uT[2]) userThirds.push(uT[2]);

                if (groupIsOver && predictedCount === groupMatches.length) {
                    const aT = getStandings(groupMatches, adminResults?.predictions, g, adminResults?.manualTiebreakers);
                    if (uT.length >= 4 && aT.length >= 4 && uT[0].name === aT[0].name && uT[1].name === aT[1].name && uT[2].name === aT[2].name && uT[3].name === aT[3].name) {
                        total += 8;
                    }
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

            const uFinalists = [...(userData.knockoutPicks?.campeon || []), ...(userData.knockoutPicks?.subcampeon || [])];
            const aFinalists = [...(adminResults?.knockoutPicks?.campeon || []), ...(adminResults?.knockoutPicks?.subcampeon || [])];
            if (aFinalists.length > 0) {
                uFinalists.forEach(ut => {
                    if (ut && aFinalists.some(at => at && at.name === ut.name)) total += 6;
                });
            }

            const uThirds = [...(userData.knockoutPicks?.tercero || []), ...(userData.knockoutPicks?.cuarto || [])];
            const aThirds = [...(adminResults?.knockoutPicks?.tercero || []), ...(adminResults?.knockoutPicks?.cuarto || [])];
            if (aThirds.length > 0) {
                uThirds.forEach(ut => {
                    if (ut && aThirds.some(at => at && at.name === ut.name)) total += 4;
                });
            }

            // Honor y bonos
            const honorSlots = [{ id: 'campeon', pts: 10 }, { id: 'subcampeon', pts: 6 }, { id: 'tercero', pts: 6 }, { id: 'cuarto', pts: 6 }];
            let honorHits = 0;
            honorSlots.forEach(s => {
                if (userData.knockoutPicks?.[s.id]?.[0]?.name === adminResults?.knockoutPicks?.[s.id]?.[0]?.name && adminResults?.knockoutPicks?.[s.id]?.[0]?.name) { total += s.pts; honorHits++; }
            });
            
            let isSuperBono = false;
            if (adminResults?.knockoutPicks) {
                isSuperBono = honorSlots.every(s => userData.knockoutPicks?.[s.id]?.[0]?.name === adminResults.knockoutPicks[s.id]?.[0]?.name && adminResults.knockoutPicks[s.id]?.[0]?.name);
            }
            if (isSuperBono) total += 10;

            // Extras y eventos
            const extraQuestions = [ { id: 'goleador', manual: true }, { id: 'equipo_goleador' }, { id: 'equipo_menos_goleador' }, { id: 'mas_amarillas' }, { id: 'mas_rojas' }, { id: 'valla_menos_vencida' }, { id: 'valla_mas_vencida' }, { id: 'grupo_mas_goles' }, { id: 'grupo_menos_goles' }, { id: 'maximo_asistidor', manual: true }, { id: 'atajapenales', manual: true } ];
            const specialEvents = [ { id: 'gol_olimpico' }, { id: 'remontada_epica' }, { id: 'el_festival' }, { id: 'muralla_final' }, { id: 'hat_trick_hero' }, { id: 'roja_banquillo' }, { id: 'portero_goleador' }, { id: 'debut_sin_red' }, { id: 'leyenda_viva' }, { id: 'drama_final' }, { id: 'penales_final' } ];
            
            const isSmartMatch = (userText, adminText) => {
                if (!userText || !adminText) return false;
                const clean = (str) => str.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]/g, "").trim();
                const u = clean(userText); const a = clean(adminText);
                return u === a || (u.length > 3 && (a.includes(u) || u.includes(a)));
            };

            extraQuestions.forEach(q => {
                const u = userData.extraPicks?.[q.id]; const a = adminResults?.extraPicks?.[q.id];
                if (u && a && (q.manual ? isSmartMatch(u, a) : u.toLowerCase() === a.toLowerCase())) total += 6;
            });
            specialEvents.forEach(e => {
                const u = userData.eventPicks?.[e.id]; const a = adminResults?.eventPicks?.[e.id];
                if (u && a === u) total += (u === 'SI' ? 5 : 2);
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
    }, [allPredictions, matches, adminResults, usersInfo, groupMatchesMap, isGroupStageFinished, adminQualified32, getStandings]);

    // --- REFACTORIZACIÓN DE FECHAS ---
    const matchesByDate = useMemo(() => {
        const grouped = {};
        matches.forEach(m => {
            const d = new Date(m.utcDate);
            const dateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
            if (!grouped[dateStr]) grouped[dateStr] = [];
            grouped[dateStr].push(m);
        });
        return grouped;
    }, [matches]);

    const sortedDates = useMemo(() => {
        return Object.keys(matchesByDate).sort(); 
    }, [matchesByDate]);

    useEffect(() => {
        if (sortedDates.length > 0 && !selectedDate) {
            const d = new Date();
            const today = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
            
            if (sortedDates.includes(today)) {
                setSelectedDate(today);
            } else {
                const nextActiveDate = sortedDates.find(date => {
                    return matchesByDate[date]?.some(m => m.status !== 'FINISHED');
                });
                setSelectedDate(nextActiveDate || sortedDates[sortedDates.length - 1]);
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
            
            {/* --- HEADER PREMIUM COMPACTO PARA MÓVIL --- */}
            <div className="bg-gradient-to-br from-slate-900 to-slate-800 rounded-2xl sm:rounded-[2rem] p-3 sm:p-10 mb-6 sm:mb-8 text-center border border-border shadow-xl relative overflow-hidden flex flex-row items-center justify-center gap-3 sm:gap-6">
                <div className="absolute top-0 left-0 w-full h-full bg-primary/5 z-0 pointer-events-none"></div>
                <img src={logocopa} className="w-12 h-12 sm:w-20 sm:h-20 object-contain drop-shadow-[0_0_15px_rgba(245,158,11,0.4)] z-10" alt="" />
                
                <div className="relative z-10 flex flex-col items-start sm:items-center text-left sm:text-center">
                    <h2 className="text-xl sm:text-4xl font-black text-white mb-0.5 sm:mb-2 tracking-tighter drop-shadow-md">📡 GRILLA LIVE</h2>
                    <p className="text-primary font-black uppercase text-[8px] sm:text-xs tracking-widest bg-primary/10 px-2.5 sm:px-4 py-1 sm:py-1.5 rounded-full border border-primary/20 inline-block shadow-sm">
                        Puntos Globales
                    </p>
                </div>
            </div>

            {/* --- SELECTOR DE FECHAS ESTILO PREMIUM CON FLECHAS --- */}
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

                        return (
                            <button 
                                key={d} 
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
                                    isSelected ? 'w-8 bg-white/40' : (allFinished ? 'w-4 bg-border/50' : 'w-4 bg-primary/30')
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
                    const a = adminResults?.predictions?.[match.id];
                    const rH = a?.home !== undefined && a?.home !== '' ? a.home : match.score?.fullTime?.home;
                    const rA = a?.away !== undefined && a?.away !== '' ? a.away : match.score?.fullTime?.away;
                    const matchStatus = match.status || '';
                    const hasO = (a && a.home !== '' && a.away !== '') || matchStatus === 'FINISHED' || matchStatus.includes('PLAY');
                    const isLive = matchStatus === 'IN_PLAY' || matchStatus === 'PAUSED';

                    // --- ORDENAMIENTO EXTREMO (Top 3 > Puntos Partido > Puntos Globales) ---
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
                        // 1. TOP 3 LÍDERES TIENEN PRIORIDAD ABSOLUTA
                        const isTop3A = userA.position <= 3;
                        const isTop3B = userB.position <= 3;
                        
                        if (isTop3A && !isTop3B) return -1;
                        if (!isTop3A && isTop3B) return 1;
                        
                        if (isTop3A && isTop3B) {
                            if (userA.position !== userB.position) return userA.position - userB.position;
                        }

                        // 2. ORDENAR POR ACIERTOS EN ESTE PARTIDO ESPECÍFICO (5 > 3 > 2 > 1 > 0)
                        const ptsA = userA.pts !== null ? userA.pts : -1; 
                        const ptsB = userB.pts !== null ? userB.pts : -1;
                        if (ptsA !== ptsB) return ptsB - ptsA;

                        // 3. DESEMPATE FINAL POR PUNTOS GLOBALES EN LA POLLA
                        return userB.totalPoints - userA.totalPoints;
                    });

                    const homeOriginal = match.homeTeam?.name || '';
                    const awayOriginal = match.awayTeam?.name || '';
                    
                    const isUnknownHome = !homeOriginal || homeOriginal === 'TBD' || homeOriginal.includes('Winner') || homeOriginal.includes('Loser');
                    const isUnknownAway = !awayOriginal || awayOriginal === 'TBD' || awayOriginal.includes('Winner') || awayOriginal.includes('Loser');

                    const customHome = a?.customHomeTeam || '';
                    const customAway = a?.customAwayTeam || '';

                    const finalHomeName = isUnknownHome ? (customHome || 'Por Definir') : homeOriginal;
                    const finalAwayName = isUnknownAway ? (customAway || 'Por Definir') : awayOriginal;

                    const homeCrest = isUnknownHome && customHome ? allTeams.find(t => t.name === customHome)?.crest : match.homeTeam?.crest;
                    const awayCrest = isUnknownAway && customAway ? allTeams.find(t => t.name === customAway)?.crest : match.awayTeam?.crest;

                    return (
                        <div key={match.id} className={`bg-card border ${isLive ? 'border-green-500 shadow-[0_0_20px_rgba(34,197,94,0.15)]' : 'border-border'} rounded-[1.5rem] sm:rounded-[2rem] overflow-hidden shadow-xl relative flex flex-col`}>
                            
                            <div className={`${isLive ? 'bg-green-500/5' : 'bg-background-offset'} p-4 sm:p-6 border-b border-border relative z-20`}>
                                <div className="flex justify-between items-center mb-3 sm:mb-5">
                                    <span className={`text-[9px] sm:text-[10px] font-black px-2.5 sm:px-4 py-0.5 sm:py-1 rounded-full uppercase ${isLive ? 'bg-green-500 text-white animate-pulse' : 'bg-primary/20 text-primary'}`}>
                                        {match.group ? match.group.replace('GROUP_', 'Grupo ') : stageTranslations[match.stage] || match.stage?.replace(/_/g, ' ') || 'Fase'}
                                    </span>
                                    <span className="text-[10px] sm:text-xs font-bold text-foreground-muted uppercase tracking-widest bg-background/50 px-2 py-1 rounded border border-border/50">
                                        {new Date(match.utcDate).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                                    </span>
                                </div>
                                
                                <div className="flex items-center justify-between w-full gap-1 sm:gap-4 px-1 sm:px-4">
                                    {/* EQUIPO LOCAL */}
                                    <div className="flex-1 flex flex-col items-center justify-start min-w-0">
                                        {homeCrest ? <img src={homeCrest} className="h-8 sm:h-16 mb-2 sm:mb-3 drop-shadow-lg" alt="" /> : <span className="text-2xl opacity-30 mb-2">🛡️</span>}
                                        <p className="font-black text-[10px] sm:text-xl text-center w-full leading-tight break-words" style={{ wordBreak: 'break-word' }}>
                                            {translateTeam(finalHomeName)}
                                        </p>
                                    </div>
                                    
                                    {/* MARCADOR DIGITAL PREMIUM */}
                                    <div className="flex flex-col items-center justify-center shrink-0 min-w-[90px] sm:min-w-[140px]">
                                        <span className={`text-[7px] sm:text-[9px] font-black uppercase tracking-widest mb-2 sm:mb-3 px-2 py-0.5 rounded shadow-sm ${isLive ? 'text-green-500 bg-green-500/10 animate-pulse border border-green-500/20' : 'text-foreground-muted bg-background/50 border border-border/50'}`}>
                                            {isLive ? '• EN VIVO' : matchStatusTranslations[match.status] || match.status}
                                        </span>
                                        
                                        <div className="flex items-center justify-center gap-1.5 sm:gap-3">
                                            {/* Caja Número Local */}
                                            <div className={`flex items-center justify-center w-9 h-11 sm:w-16 sm:h-20 rounded-lg sm:rounded-2xl font-black text-xl sm:text-4xl shadow-inner border transition-all ${hasO ? 'bg-background-offset text-primary border-primary/30 shadow-[inset_0_2px_10px_rgba(0,0,0,0.5)]' : 'bg-background text-foreground-muted border-border/50 opacity-50'}`}>
                                                {hasO ? (rH ?? 0) : '-'}
                                            </div>
                                            
                                            {/* Separador (Dos puntitos estilo reloj digital) */}
                                            <div className="flex flex-col gap-1 sm:gap-2 opacity-50">
                                                <span className="w-1 h-1 sm:w-1.5 sm:h-1.5 rounded-full bg-foreground"></span>
                                                <span className="w-1 h-1 sm:w-1.5 sm:h-1.5 rounded-full bg-foreground"></span>
                                            </div>
                                            
                                            {/* Caja Número Visitante */}
                                            <div className={`flex items-center justify-center w-9 h-11 sm:w-16 sm:h-20 rounded-lg sm:rounded-2xl font-black text-xl sm:text-4xl shadow-inner border transition-all ${hasO ? 'bg-background-offset text-primary border-primary/30 shadow-[inset_0_2px_10px_rgba(0,0,0,0.5)]' : 'bg-background text-foreground-muted border-border/50 opacity-50'}`}>
                                                {hasO ? (rA ?? 0) : '-'}
                                            </div>
                                        </div>
                                    </div>
                                    
                                    {/* EQUIPO VISITANTE */}
                                    <div className="flex-1 flex flex-col items-center justify-start min-w-0">
                                        {awayCrest ? <img src={awayCrest} className="h-8 sm:h-16 mb-2 sm:mb-3 drop-shadow-lg" alt="" /> : <span className="text-2xl opacity-30 mb-2">🛡️</span>}
                                        <p className="font-black text-[10px] sm:text-xl text-center w-full leading-tight break-words" style={{ wordBreak: 'break-word' }}>
                                            {translateTeam(finalAwayName)}
                                        </p>
                                    </div>
                                </div>
                            </div>

                            <div className="w-full relative z-10 overflow-hidden bg-background min-h-[150px] flex-grow">
                                <img src={logocopa} className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-48 h-48 sm:w-80 sm:h-80 object-contain opacity-[0.02] dark:opacity-[0.03] pointer-events-none z-0" alt="" />

                                <table className="w-full text-left table-fixed relative z-10">
                                    <thead>
                                        <tr className="bg-background-offset/80 backdrop-blur-md text-[8px] sm:text-xs uppercase font-black border-b border-border text-foreground-muted">
                                            <th className="py-2 pl-3 sm:p-5 w-[42%] sm:w-[50%] lg:w-[58%] sm:pl-8">Jugador</th>
                                            <th className="py-2 w-[22%] sm:w-[18%] lg:w-[14%] text-center">Predicción</th>
                                            <th className="py-2 w-[18%] sm:w-[16%] lg:w-[14%] text-center">Puntos</th>
                                            <th className="py-2 pr-3 sm:p-5 w-[18%] sm:w-[16%] lg:w-[14%] text-center sm:pr-8">Global</th>
                                        </tr>
                                    </thead>
                                    <tbody className="text-[10px] sm:text-sm">
                                        {matchSpecificRanking.map((user) => {
                                            const is1st = user.position === 1;
                                            const is2nd = user.position === 2;
                                            const is3rd = user.position === 3;

                                            // Estilos Premium según el rango (Oro, Plata, Bronce)
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

                                                    <td className="py-3 sm:py-5 text-center pr-3 sm:pr-8">
                                                        <div className="flex justify-center w-full">
                                                            <span className="font-black text-primary text-sm sm:text-3xl tabular-nums drop-shadow-sm">
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