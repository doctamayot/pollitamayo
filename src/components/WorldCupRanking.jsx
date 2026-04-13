import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { db } from '../firebase';
import { collection, onSnapshot, doc } from 'firebase/firestore';
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

const WorldCupRanking = () => {
    const [matches, setMatches] = useState([]);
    const [allPredictions, setAllPredictions] = useState({});
    const [usersInfo, setUsersInfo] = useState({});
    const [adminResults, setAdminResults] = useState(null);
    const [loading, setLoading] = useState(true);
    const [expandedUser, setExpandedUser] = useState(null);

    useEffect(() => {
        const fetchMatches = async () => {
            try {
                const data = await getWorldCupMatches();
                if (data && data.matches) setMatches(data.matches);
            } catch (err) { console.error(err); }
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
            setLoading(false);
        });

        return () => { unsubPreds(); unsubUsers(); unsubAdmin(); };
    }, []);

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
        const byGroup = groupStageMatches.reduce((acc, m) => {
            let g = m.group?.replace('GROUP_', 'Grupo ') || 'Fase de Grupos';
            if (!acc[g]) acc[g] = []; acc[g].push(m); return acc;
        }, {});
        
        Object.keys(byGroup).forEach(g => {
            const st = getStandings(byGroup[g], adminResults.predictions, g, adminResults.manualTiebreakers);
            if (st[0]) top2.push(st[0]); if (st[1]) top2.push(st[1]); if (st[2]) thirds.push(st[2]);
        });
        thirds.sort((a, b) => b.pts - a.pts || b.dg - a.dg || b.gf - a.gf);
        return [...top2, ...thirds.slice(0, 8)];
    }, [groupStageMatches, adminResults, getStandings]);

    const ranking = useMemo(() => {
        const ranks = [];
        const byGroup = groupStageMatches.reduce((acc, m) => {
            let g = m.group?.replace('GROUP_', 'Grupo ') || 'Fase de Grupos';
            if (!acc[g]) acc[g] = []; acc[g].push(m); return acc;
        }, {});

        Object.keys(allPredictions).forEach(uid => {
            const userData = allPredictions[uid];
            if (!userData.hasPaid || EXCLUDED_EMAILS.includes(userData.email)) return;

            const stats = { plenosCount: 0, ptsPlenos: 0, ptsOtrosAciertos: 0, ptsHonorYBonos: 0, ptsRondas: 0, ptsExtras: 0, ptsEventos: 0, total: 0 };

            matches.forEach(m => {
                const p = userData.predictions?.[m.id]; const a = adminResults?.predictions?.[m.id];
                const rH = a?.home !== undefined && a?.home !== '' ? a.home : m.score?.fullTime?.home;
                const rA = a?.away !== undefined && a?.away !== '' ? a.away : m.score?.fullTime?.away;
                const hasO = (a && a.home !== '' && a.away !== '') || m.status === 'FINISHED' || m.status.includes('PLAY');
                if (hasO && p && p.home !== '' && p.away !== '') {
                    const pH = parseInt(p.home); const pA = parseInt(p.away);
                    if (pH == rH && pA == rA) { stats.plenosCount++; stats.ptsPlenos += 5; }
                    else {
                        const pR = Math.sign(pH - pA); const rR = Math.sign(rH - rA);
                        if (pR === rR && (pH == rH || pA == rA)) stats.ptsOtrosAciertos += 3;
                        else if (pR === rR) stats.ptsOtrosAciertos += 2;
                        else if (pH == rH || pA == rA) stats.ptsOtrosAciertos += 1;
                    }
                }
            });

            let userTop2 = []; let userThirds = [];
            
            Object.keys(byGroup).forEach(g => {
                const groupMatches = byGroup[g];
                
                // 🛑 SEGURO CONTRA PUNTOS FANTASMA: Contar cuántos partidos de este grupo predijo el usuario
                let predictedCount = 0;
                groupMatches.forEach(m => {
                    const p = userData.predictions?.[m.id];
                    if (p && p.home !== '' && p.home !== undefined && p.away !== '' && p.away !== undefined) {
                        predictedCount++;
                    }
                });

                // Si no predijo NINGÚN partido, se ignora el grupo
                if (predictedCount === 0) return;

                const isGroupFinished = groupMatches.every(m => {
                    const apiFinished = m.status === 'FINISHED';
                    const adminFinished = adminResults?.predictions?.[m.id] && adminResults.predictions[m.id].home !== '' && adminResults.predictions[m.id].home !== null;
                    return apiFinished || adminFinished;
                });
                
                const uT = getStandings(groupMatches, userData.predictions, g, userData.manualTiebreakers);
                if (uT[0]) userTop2.push(uT[0]); if (uT[1]) userTop2.push(uT[1]); if (uT[2]) userThirds.push(uT[2]);
                
                // Solo gana el PLENO si predijo el grupo completo (los 6 partidos)
                if (isGroupFinished && predictedCount === groupMatches.length) {
                    const aT = getStandings(groupMatches, adminResults?.predictions, g, adminResults?.manualTiebreakers);
                    if (uT.length >= 4 && aT.length >= 4 && uT[0].name === aT[0].name && uT[1].name === aT[1].name && uT[2].name === aT[2].name && uT[3].name === aT[3].name) {
                        stats.ptsHonorYBonos += 8;
                    }
                }
            });
            
            userThirds.sort((a, b) => b.pts - a.pts || b.dg - a.dg || b.gf - a.gf);
            const userQualified32 = [...userTop2, ...userThirds.slice(0, 8)];

            // --- INICIO DE PUNTOS EXACTOS DE RONDAS ---
            
            // 1. PUNTOS POR CLASIFICAR A 16VOS (32 equipos): 2 pts c/u
            if (isGroupStageFinished && adminQualified32.length > 0) {
                userQualified32.forEach(ut => {
                    if (adminQualified32.some(at => at.name === ut.name)) stats.ptsRondas += 2;
                });
            }

            // 2. PUNTOS POR AVANZAR EN EL BRACKET
            const koRounds = [
                { id: 'dieciseisavos', pts: 3 }, // Los 16 que ganan 16vos y pasan a Octavos
                { id: 'octavos', pts: 4 },       // Los 8 que ganan Octavos y pasan a Cuartos
                { id: 'cuartos', pts: 5 },       // Los 4 que ganan Cuartos y pasan a Semis
                { id: 'semis', pts: 6 }          // Los 2 que ganan Semis y pasan a la Final
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

            // 3. PUNTOS POR PASAR A 3ER PUESTO (Los 2 que pierden Semis): 4 pts c/u
            const uThirdsList = [...(userData.knockoutPicks?.tercero || []), ...(userData.knockoutPicks?.cuarto || [])];
            const aThirdsList = [...(adminResults?.knockoutPicks?.tercero || []), ...(adminResults?.knockoutPicks?.cuarto || [])];
            if (aThirdsList.length > 0) {
                uThirdsList.forEach(ut => {
                    if (ut && aThirdsList.some(at => at && at.name === ut.name)) stats.ptsRondas += 4;
                });
            }
            // --- FIN DE PUNTOS EXACTOS DE RONDAS ---

            extraQuestions.forEach(q => {
                const u = userData.extraPicks?.[q.id]; const a = adminResults?.extraPicks?.[q.id];
                if (u && a && (q.manual ? isSmartMatch(u, a) : u.toLowerCase() === a.toLowerCase())) stats.ptsExtras += 6;
            });
            specialEvents.forEach(e => {
                const u = userData.eventPicks?.[e.id]; const a = adminResults?.eventPicks?.[e.id];
                if (u && a === u) stats.ptsEventos += (u === 'SI' ? 5 : 2);
            });

            const honorSlots = [{ id: 'campeon', pts: 10 }, { id: 'subcampeon', pts: 6 }, { id: 'tercero', pts: 6 }, { id: 'cuarto', pts: 6 }];
            let honorHits = 0;
            honorSlots.forEach(s => {
                if (userData.knockoutPicks?.[s.id]?.[0]?.name === adminResults?.knockoutPicks?.[s.id]?.[0]?.name && adminResults?.knockoutPicks?.[s.id]?.[0]?.name) { stats.ptsHonorYBonos += s.pts; honorHits++; }
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
    }, [allPredictions, matches, groupStageMatches, adminResults, usersInfo, isGroupStageFinished, adminQualified32, getStandings]);

    const premiosRepartidos = useMemo(() => {
        if (ranking.length === 0) return { p1Ind: 0, p2Ind: 0, p3Ind: 0, p1Total: 0, p2Total: 0, p3Total: 0, mitad: 0, r1: 1, r2: 0, r3: 0 };
        
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

    if (loading) return <div className="py-32 text-center">Calculando Ranking...</div>;

    return (
        <div className="max-w-4xl mx-auto pb-24 animate-fade-in px-3 sm:px-0">
            <div className="text-center mb-10 pt-6">
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
                {ranking.map((user, idx) => {
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
                                <img src={user.photoURL} className={`w-10 h-10 sm:w-14 sm:h-14 rounded-full object-cover shadow-sm mr-3 sm:mr-5 border shrink-0 border-border`} alt="" />
                                
                                <div className="flex flex-col flex-1 min-w-0 pr-2">
                                    <span className="font-bold text-sm sm:text-lg text-foreground leading-tight truncate">{formatShortName(user.name)}</span>
                                    <div className="flex flex-wrap gap-1 mt-1">
                                        {isMiddle && <span className="text-[7px] sm:text-[9px] font-black uppercase text-blue-500 bg-blue-500/10 px-1.5 py-0.5 rounded-full border border-blue-500/20 whitespace-nowrap truncate max-w-full">🎯 MITAD: {formatMoney(premiosRepartidos.mitad)}</span>}
                                        {rewardLabel && rewardLabel !== "$0" && <span className="text-[7px] sm:text-[9px] font-black uppercase text-primary bg-primary/5 px-1.5 py-0.5 rounded-full border border-primary/10 whitespace-nowrap truncate max-w-full">GANANDO: {rewardLabel}</span>}
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
            </div>
        </div>
    );
};

export default WorldCupRanking;