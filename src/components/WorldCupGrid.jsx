import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { db } from '../firebase';
import { collection, onSnapshot, doc, setDoc, getDoc } from 'firebase/firestore';
import { getWorldCupMatches } from '../services/apiFootball';
import logocopa from '../assets/logocopa.png';
import toast from 'react-hot-toast';
import { generateFullBracket } from '../services/bracketEngine';
import NewsTicker from '../components/shared/NewsTicker'
import InfografiaModal from '../components/InfografiaModal'
import WorldCupCountdown from './worldcupcomponents/WorldCupCountdown';

// 📺 IMPORTACIÓN DE LOS LOGOS DE LOS CANALES
import caracolImg from '../assets/caracol.png';
import rcnImg from '../assets/rcn.png';
import directvImg from '../assets/direct.webp';
import winImg from '../assets/Win.webp';
import disneyImg from '../assets/disney.png'

// --- TRADUCCIONES Y CONSTANTES ---
const EXCLUDED_EMAILS = ['doctamayot@gmail.com', 'admin@polli-tamayo.com'];

export const teamTranslations = {
    "Algeria": "Argelia", "Argentina": "Argentina", "Australia": "Australia", "Austria": "Austria",
    "Belgium": "Bélgica", "Bosnia and Herzegovina": "Bosnia y Herzegovina", "Brazil": "Brasil", "Canada": "Canadá",
    "Ivory Coast": "Costa de Marfil", "Cote d'Ivoire": "Costa de Marfil", "DR Congo": "República Democrática del Congo", "Congo DR": "República Democrática del Congo", 
    "Colombia": "Colombia", "Cape Verde": "Cabo Verde", "Cape Verde Islands": "Cabo Verde", "Croatia": "Croacia",
    "Czechia": "República Checa", "Czech Republic": "República Checa", "Curacao": "Curazao",
    "Ecuador": "Ecuador", "Egypt": "Egipto", "England": "Inglaterra", "Spain": "España",
    "France": "Francia", "Germany": "Alemania", "Ghana": "Ghana", "Haiti": "Haití",
    "Iran": "Irán", "Iraq": "Irak", "Jordan": "Jordania", "Japan": "Japón",
    "South Korea": "Corea del Sur", "Korea Republic": "Corea del Sur", "Saudi Arabia": "Arabia Saudita",
    "Morocco": "Marruecos", "Mexico": "México", "Netherlands": "Países Bajos", "Norway": "Noruega",
    "New Zealand": "Nueva Zelanda", "Panama": "Panamá", "Paraguay": "Paraguay", "Portugal": "Portugal",
    "Qatar": "Qatar", "South Africa": "Sudáfrica", "Scotland": "Escocia", "Senegal": "Senegal",
    "Switzerland": "Suiza", "Sweden": "Suecia", "Tunisia": "Túnez", "Turkey": "Turquía",
    "United States": "Estados Unidos", "USA": "Estados Unidos", "Uruguay": "Uruguay", "Uzbekistan": "Uzbekistán", "Por definir": "Por definir", "TBD": "Por definir"
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
    const parts = fullName.trim().split(/\s+/); 
    if (parts.length === 1) return parts[0];
    if (parts.length === 2) {
        return `${parts[0]} ${parts[1].charAt(0)}.`;
    }
    return `${parts[0]} ${parts[2].charAt(0)}.`;
};

const formatDateObj = (dateStr) => {
    const d = new Date(dateStr + "T12:00:00"); 
    const dayName = d.toLocaleDateString('es-ES', { weekday: 'short' }).toUpperCase().replace('.', '');
    const dayNum = d.getDate();
    const monthName = d.toLocaleDateString('es-ES', { month: 'short' }).toUpperCase().replace('.', '');
    return { dayName, dayNum, monthName };
};

const translateTeam = (name) => teamTranslations[name] || name;

const isSmartMatch = (userText, adminText) => {
    if (!userText || !adminText) return false;
    const clean = (str) => str.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]/g, "").trim();
    const u = clean(userText); const a = clean(adminText);
    return u === a || (u.length > 3 && (a.includes(u) || u.includes(a)));
};

// =====================================================================
// 📺 NUEVO: SCOREBOARD ESTILO TRANSMISIÓN OFICIAL FIFA TV
// =====================================================================
const getCountryCode = (name) => {
    if (!name || name === 'Por definir' || name === 'TBD') return 'TBD';
    
    // 1. Traducimos el equipo al ESPAÑOL usando nuestro diccionario
    const translated = translateTeam(name);
    
    // 2. Mapeamos el nombre en español a las Siglas Oficiales de TV que enviaste
    const codes = {
        "Argelia": "ALG", "Argentina": "ARG", "Australia": "AUS", "Austria": "AUT",
        "Bélgica": "BEL", "Bosnia y Herzegovina": "BIH", "Brasil": "BRA", "Canadá": "CAN",
        "Costa de Marfil": "CIV", "República Democrática del Congo": "COD", "Colombia": "COL",
        "Cabo Verde": "CPV", "Croacia": "CRO", "República Checa": "CZE", "Curazao": "CUW",
        "Ecuador": "ECU", "Egipto": "EGY", "Inglaterra": "ENG", "España": "ESP",
        "Francia": "FRA", "Alemania": "GER", "Ghana": "GHA", "Haití": "HAI",
        "Irán": "IRN", "Irak": "IRQ", "Jordania": "JOR", "Japón": "JPN",
        "Corea del Sur": "KOR", "Arabia Saudita": "KSA", "Marruecos": "MAR",
        "México": "MEX", "Países Bajos": "NED", "Noruega": "NOR", "Nueva Zelanda": "NZL",
        "Panamá": "PAN", "Paraguay": "PAR", "Portugal": "POR", "Qatar": "QAT",
        "Sudáfrica": "RSA", "Escocia": "SCO", "Senegal": "SEN", "Suiza": "SUI",
        "Suecia": "SWE", "Túnez": "TUN", "Turquía": "TUR", "Estados Unidos": "USA",
        "Uruguay": "URU", "Uzbekistán": "UZB"
    };

    return codes[translated] || translated.substring(0, 3).toUpperCase();
};

const TVScoreboard = ({ match, homeName, awayName, homeCrest, awayCrest, rH, rA, hasO, broadcasters }) => {
    const [elapsed, setElapsed] = useState(0);

    useEffect(() => {
        let interval;
        if (match.status === 'IN_PLAY') {
            interval = setInterval(() => {
                const start = new Date(match.utcDate).getTime();
                const now = new Date().getTime();
                let diffSeconds = Math.floor((now - start) / 1000)-180;

                if (diffSeconds < 0) diffSeconds = 0;
                
                // ⚽ Truco Mágico del 2do Tiempo
                if (diffSeconds >= 3960) { // 3960 segundos = 66 minutos
                    diffSeconds = 2700 + (diffSeconds - 3960);
                }
                
                setElapsed(diffSeconds);
            }, 1000);
        } else if (match.status === 'PAUSED') {
            setElapsed(2700); // 45:00 Congelado
        } else if (match.status === 'FINISHED') {
            setElapsed(5400); // 90:00 Finalizado
        } else {
            setElapsed(0);
        }
        return () => clearInterval(interval);
    }, [match.status, match.utcDate]);

    const formatTime = (secs) => {
        const m = Math.floor(secs / 60);
        const s = secs % 60;
        return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
    };

    const isPlaying = match.status === 'IN_PLAY';
    const isPaused = match.status === 'PAUSED';
    const isFinished = match.status === 'FINISHED';

    return (
        <div className="flex flex-col items-center w-full my-4 px-2">
            {/* Etiqueta superior del Grupo */}
            <span className={`text-[8px] sm:text-[10px] font-black px-4 py-1 rounded-t-lg uppercase mb-2 z-0 shadow-inner ${isPlaying ? 'bg-green-500 text-white animate-pulse' : isPaused ? 'bg-amber-500 text-white' : 'bg-slate-700 text-slate-300'}`}>
                {match.group ? match.group.replace('GROUP_', 'Grupo ') : stageTranslations[match.stage] || match.stage?.replace(/_/g, ' ') || 'Fase'}
            </span>

            {/* Contenedor Principal Transmisión TV */}
            <div className="flex h-12 sm:h-16 w-full max-w-xl mx-auto rounded-xl sm:rounded-2xl overflow-visible border-2 border-slate-600/30 shadow-2xl relative z-20 bg-[#1e293b]">
                
                {/* 🏠 Equipo Local */}
                <div className="flex-1 flex items-center justify-end bg-gradient-to-r from-slate-800 to-[#2c3e50] px-2 sm:px-4 gap-2 sm:gap-3 rounded-l-lg sm:rounded-l-[14px]">
                    <span className="text-white font-black text-sm sm:text-xl uppercase tracking-wider">{getCountryCode(homeName)}</span>
                    {homeCrest ? <img src={homeCrest} className="w-6 h-4 sm:w-8 sm:h-6 object-cover rounded-[2px] shadow-sm border border-white/10" alt="" /> : <span className="opacity-30 text-xs sm:text-base">🛡️</span>}
                </div>

                {/* ⚽ Marcador Local */}
                <div className="flex items-center justify-center bg-[#0cf2c4] text-[#0f172a] font-black text-xl sm:text-3xl w-10 sm:w-14 shrink-0 shadow-[inset_-2px_0_5px_rgba(0,0,0,0.1)]">
                    {hasO ? (rH ?? 0) : '-'}
                </div>

                {/* 🏆 Escudo Central Sobresaliente */}
                <div className="flex items-center justify-center bg-[#0f172a] w-12 sm:w-16 shrink-0 z-30 scale-110 sm:scale-125 shadow-2xl rounded-sm border-y border-[#0f172a]">
                    <img src={logocopa} className="w-8 h-8 sm:w-12 sm:h-12 object-contain drop-shadow-md brightness-110 contrast-125" alt="FIFA" />
                </div>

                {/* ⚽ Marcador Visitante */}
                <div className="flex items-center justify-center bg-[#0cf2c4] text-[#0f172a] font-black text-xl sm:text-3xl w-10 sm:w-14 shrink-0 shadow-[inset_2px_0_5px_rgba(0,0,0,0.1)]">
                    {hasO ? (rA ?? 0) : '-'}
                </div>

                {/* ✈️ Equipo Visitante */}
                <div className="flex-1 flex items-center justify-start bg-gradient-to-l from-slate-800 to-[#2c3e50] px-2 sm:px-4 gap-2 sm:gap-3 rounded-r-lg sm:rounded-r-[14px]">
                    {awayCrest ? <img src={awayCrest} className="w-6 h-4 sm:w-8 sm:h-6 object-cover rounded-[2px] shadow-sm border border-white/10" alt="" /> : <span className="opacity-30 text-xs sm:text-base">🛡️</span>}
                    <span className="text-white font-black text-sm sm:text-xl uppercase tracking-wider">{getCountryCode(awayName)}</span>
                </div>
            </div>

            {/* ⏱️ Zona de Reloj (Color Celeste TV) */}
            <div className="w-fit mx-auto flex items-center justify-center bg-[#c3e1e5] text-[#0f172a] px-6 py-1.5 mt-[-1px] rounded-b-xl shadow-md z-10 relative border-x-2 border-b-2 border-slate-600/30">
                <span className="font-black text-sm sm:text-base tabular-nums leading-none tracking-tighter mr-2">
                    {isFinished ? 'FT' : isPlaying || isPaused ? formatTime(elapsed) : new Date(match.utcDate).toLocaleTimeString('en-US', {hour: 'numeric', minute:'2-digit', hour12: true})}
                </span>
                {(isPlaying || isPaused) && !isFinished && (
                    <span className="text-[9px] sm:text-[10px] font-bold text-slate-700 leading-none uppercase tracking-widest border-l border-slate-400/50 pl-2">
                        {isPaused ? 'M. TIEMPO' : 'EN VIVO'}
                    </span>
                )}
            </div>

            {/* 📺 NUEVO: ZONA DE TRANSMISIÓN OFICIAL */}
            {broadcasters && broadcasters.length > 0 && (
                <div className="flex justify-center items-center gap-2 sm:gap-3 mt-3 bg-white/95 rounded-full px-3 sm:px-4 py-1.5 w-fit mx-auto border border-slate-200 shadow-sm">
                    <span className="text-[7px] sm:text-[8px] uppercase font-black text-slate-500 tracking-widest mr-1">📺 TRANSMISIÓN:</span>
                    {broadcasters.includes('DSPORTS') && <img src={directvImg} className="h-2.5 sm:h-3.5 object-contain drop-shadow-sm" alt="DSports" title="DSports / DGO" />}
                    {broadcasters.includes('WIN') && <img src={winImg} className="h-2.5 sm:h-3.5 object-contain drop-shadow-sm" alt="Win Sports" title="Win Sports" />}
                    {broadcasters.includes('CARACOL') && <img src={caracolImg} className="h-2.5 sm:h-3.5 object-contain drop-shadow-sm" alt="Caracol" title="Caracol TV" />}
                    {broadcasters.includes('RCN') && <img src={rcnImg} className="h-2.5 sm:h-3.5 object-contain drop-shadow-sm" alt="RCN" title="Canal RCN" />}
                    {broadcasters.includes('DISNEY') && <img src={disneyImg} className="h-2.5 sm:h-3.5 object-contain drop-shadow-sm" alt="Disney+" title="Disney+ / ESPN" />}
                </div>
            )}
        </div>
    );
};
// =====================================================================

const WorldCupGrid = ({ currentUser }) => {
    const isAdmin = currentUser?.email === 'doctamayot@gmail.com' || currentUser?.email === 'admin@polli-tamayo.com';

    const [matches, setMatches] = useState([]);
    const [allPredictions, setAllPredictions] = useState({});
    const [usersInfo, setUsersInfo] = useState({});
    const [adminResults, setAdminResults] = useState(null);
    const [selectedDate, setSelectedDate] = useState(null);
    const [isApiLoading, setIsApiLoading] = useState(true);
    const [isDbLoading, setIsDbLoading] = useState(true);
    const [isLivePollingActive, setIsLivePollingActive] = useState(false);
    const [reportData, setReportData] = useState(null);

    const scrollContainerRef = useRef(null);
    const prevSimDateRef = useRef(''); 
    const apiFetchedRef = useRef(false); 

    const fetchApiMatches = useCallback(async (isBackgroundUpdate = false) => {
        try {
            if (!isBackgroundUpdate) setIsApiLoading(true);

            if (isAdmin) {
                const data = await getWorldCupMatches();
                if (data && data.matches) {
                    setMatches(data.matches);
                    await setDoc(doc(db, 'worldCupAdmin', 'apiCache'), { matches: data.matches }, { merge: true });
                }
            } else {
                const cacheDoc = await getDoc(doc(db, 'worldCupAdmin', 'apiCache'));
                if (cacheDoc.exists() && cacheDoc.data().matches) {
                    setMatches(cacheDoc.data().matches);
                } else {
                    const data = await getWorldCupMatches();
                    if (data && data.matches) setMatches(data.matches);
                }
            }
        } catch (err) { 
            console.error("Error obteniendo partidos:", err); 
        } finally { 
            if (!isBackgroundUpdate) setIsApiLoading(false); 
        }
    }, [isAdmin]);

    useEffect(() => {
        if (!apiFetchedRef.current) {
            fetchApiMatches();
            apiFetchedRef.current = true;
        }

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
    }, [fetchApiMatches]);

    
    // 🟢 ROBOT AUTO-SYNC INTELIGENTE (Radar de 10 segundos)
    const simStatusesString = JSON.stringify(adminResults?.simulation?.matchStatuses || {});
    const radarTimeoutRef = useRef(null);

    // 🟢 EL CAFE VIRTUAL: Mantiene la pantalla encendida para el Admin
    const wakeLockRef = useRef(null);

    

    useEffect(() => {
        if (!isAdmin) return;
        
        // Función que le escribe a Firebase "sigo aquí"
        const reportPresence = async () => {
            try {
                // Escribe en la colección worldCupAdmin, documento "presence"
                await setDoc(doc(db, 'worldCupAdmin', 'presence'), {
                    adminLastSeen: new Date().toISOString()
                }, { merge: true });
            } catch (error) {
                console.error("❌ [Presence] Error enviando señal de vida a la nube:", error);
            }
        };

        // Reportamos inmediatamente al entrar a la Grilla
        reportPresence();

        // Y luego repetimos el reporte cada 30 segundos rigurosamente
        const intervalId = setInterval(reportPresence, 30000); 

        // Limpiador: Si cambias de pestaña o cierras la app, dejas de reportar presencia
        return () => clearInterval(intervalId);
    }, [isAdmin]);

    useEffect(() => {
        // Si no es el administrador, no necesitamos gastarle batería
        if (!isAdmin) return;

        const requestWakeLock = async () => {
            try {
                // Verificamos si el navegador moderno soporta esta tecnología
                if ('wakeLock' in navigator) {
                    wakeLockRef.current = await navigator.wakeLock.request('screen');
                    console.log('🌞 [Wake Lock] Pantalla activa: Bloqueo de suspensión ACTIVADO. Puedes irte a dormir.');

                    // Si por alguna razón el sistema lo suelta (ej. batería en 1%), nos avisa
                    wakeLockRef.current.addEventListener('release', () => {
                        console.log('🌙 [Wake Lock] Bloqueo liberado (la pantalla puede suspenderse).');
                    });
                } else {
                    console.warn('⚠️ [Wake Lock] Tu navegador actual no soporta mantener la pantalla encendida automáticamente.');
                }
            } catch (err) {
                console.error(`❌ [Wake Lock] Error al pedir pantalla encendida: ${err.name}, ${err.message}`);
            }
        };

        requestWakeLock();

        // 🚨 REGLA DEL SISTEMA OPERATIVO: Si minimizas el navegador, el celular suelta el bloqueo.
        // Así que le decimos que lo vuelva a pedir tan pronto regreses a la pestaña.
        const handleVisibilityChange = () => {
            if (document.visibilityState === 'visible') {
                console.log('👀 [Wake Lock] Regresaste a la pestaña. Pidiendo pantalla activa de nuevo...');
                requestWakeLock();
            }
        };

        document.addEventListener('visibilitychange', handleVisibilityChange);

        // Limpiador: Cuando el Admin cambie a la pestaña de "Ranking" o cierre la app, soltamos la pantalla
        return () => {
            document.removeEventListener('visibilitychange', handleVisibilityChange);
            if (wakeLockRef.current !== null) {
                wakeLockRef.current.release()
                    .then(() => console.log('🛑 [Wake Lock] Componente cerrado. Pantalla liberada.'))
                    .catch(console.error);
                wakeLockRef.current = null;
            }
        };
    }, [isAdmin]);
    
    // 🟢 EL ESCUDO DE PROTECCIÓN ASÍNCRONA
    const isMountedRef = useRef(true); 

    useEffect(() => {
        if (!isAdmin) return;
        
        // Cada vez que se monte el componente, el escudo se activa
        isMountedRef.current = true; 

        const performSmartSync = async () => {
            try {
                // Si por alguna razón se llama y ya está desmontado, frenar de inmediato
                if (!isMountedRef.current) return;

                const now = Date.now();
                console.log(`[Radar Predictivo] 📡 Consultando la API... Hora: ${new Date(now).toLocaleTimeString()}`);

                const data = await getWorldCupMatches();
                
                // 🎯 CRÍTICO: Si internet tardó 2 segundos y el participe cambió de pestaña, ¡FRENAR AQUÍ!
                if (!isMountedRef.current) {
                    console.log("[Radar Predictivo] 🛑 La petición regresó pero el usuario cambió de pestaña. Abortando loop zombi.");
                    return;
                }

                const freshMatches = data.matches;

                // 🛡️ ESCUDO ANTI-CUOTA 1: Solo actualiza React y Firebase si la API trae un cambio real
                setMatches(prevMatches => {
                    if (JSON.stringify(prevMatches) === JSON.stringify(freshMatches)) {
                        return prevMatches; // No hay cambios, cancelamos el re-render para ahorrar memoria
                    }
                    // Si hubo cambios, actualizamos el caché de Firebase en segundo plano
                    setDoc(doc(db, 'worldCupAdmin', 'apiCache'), { matches: freshMatches }, { merge: true }).catch(console.error);
                    return freshMatches;
                });

                const adminDoc = await getDoc(doc(db, 'worldCupAdmin', 'results'));
                
                // Volvemos a verificar el escudo por si el guardado de Firebase tardó
                if (!isMountedRef.current) return;

                let dbPreds = adminDoc.exists() ? (adminDoc.data().predictions || {}) : {};
                let currentLocks = adminDoc.exists() ? (adminDoc.data().lockedMatches || {}) : {};
                let simStatuses = adminDoc.exists() ? (adminDoc.data().simulation?.matchStatuses || {}) : {};

                const isAnyMatchLive = freshMatches.some(m => {
                    const matchId = String(m.id);
                    const finalStatus = simStatuses[matchId] && simStatuses[matchId] !== '' ? simStatuses[matchId] : m.status;
                    return finalStatus === 'IN_PLAY' || finalStatus === 'PAUSED';
                });

                const upcomingMatches = freshMatches.filter(m => m.status === 'SCHEDULED' || m.status === 'TIMED');
                let timeToNextMatch = Infinity;
                
                if (upcomingMatches.length > 0) {
                    upcomingMatches.sort((a, b) => new Date(a.utcDate) - new Date(b.utcDate));
                    const nextMatchDate = new Date(upcomingMatches[0].utcDate).getTime();
                    timeToNextMatch = nextMatchDate - now;
                }

                let nextCheckDelay;
                let statusMsg = "";

                if (isAnyMatchLive) {
                    nextCheckDelay = 30000; // 🟢 30 Segundos
                    statusMsg = "¡HAY PARTIDO! Velocidad Ráfaga (30s)";
                } else if (timeToNextMatch <= 0) {
                    nextCheckDelay = 30000; 
                    statusMsg = "¡Es la hora cero! Esperando pitazo inicial (30s)";
                } else if (timeToNextMatch <= 5 * 60 * 1000) {
                    nextCheckDelay = 30000; 
                    statusMsg = `Calentando motores. Pitazo en ${Math.ceil(timeToNextMatch/60000)} min (30s)`;
                } else if (timeToNextMatch <= 60 * 60 * 1000) {
                    nextCheckDelay = 3 * 60 * 1000; 
                    statusMsg = `En la sala de espera. Pitazo en ${Math.ceil(timeToNextMatch/60000)} min (3 min)`;
                } else {
                    nextCheckDelay = 15 * 60 * 1000; 
                    statusMsg = `Torneo dormido. Próximo partido en horas (15 min)`;
                }

                setIsLivePollingActive(isAnyMatchLive || timeToNextMatch <= 0);
                console.log(`[Radar Predictivo] 🏎️ Estado: ${statusMsg}`);

                let hasChanges = false;
                let currentApiStatuses = adminDoc.exists() ? (adminDoc.data().apiStatuses || {}) : {};
                let newApiStatuses = { ...currentApiStatuses };

                let newlyFinishedMatches = [];

                freshMatches.forEach(m => {
                    if (currentLocks[m.id]) return; 

                    const apiH = (m.score?.fullTime?.home !== null && m.score?.fullTime?.home !== undefined) ? m.score.fullTime.home : '';
                    const apiA = (m.score?.fullTime?.away !== null && m.score?.fullTime?.away !== undefined) ? m.score.fullTime.away : '';

                    // 1. ¿Hubo Gol?
                    if (dbPreds[m.id]?.home !== apiH || dbPreds[m.id]?.away !== apiA) {
                        dbPreds[m.id] = { ...dbPreds[m.id], home: apiH, away: apiA };
                        hasChanges = true;
                    }

                    // 2. ¿Cambió el estado? (Ej: Pitazo inicial, Medio Tiempo, Finalizado)
                    if (currentApiStatuses[m.id] !== m.status) {
                        newApiStatuses[m.id] = m.status;
                        hasChanges = true;
                        
                        // 📸 EL FOTÓGRAFO
                        if (m.status === 'FINISHED') {
                            newlyFinishedMatches.push(m);
                        }
                    }
                });
                if (hasChanges && isMountedRef.current) {
                    console.log("[Radar Predictivo] ⚽ 🔥 ¡CAMBIO DETECTADO! Actualizando marcadores y estados...");
                    
                    // 1. Guardamos el nuevo marcador y los ESTADOS en la BD que escuchan los usuarios
                    await setDoc(doc(db, 'worldCupAdmin', 'results'), { 
                        predictions: dbPreds,
                        apiStatuses: newApiStatuses 
                    }, { merge: true });
                    
                    toast.success('⚽ Marcadores y Estados sincronizados.', { id: 'autosync-grid-toast' });

                    // 📸 2. EL FOTÓGRAFO EN ACCIÓN
                    if (newlyFinishedMatches.length > 0) {
                        console.log("[Fotógrafo Histórico] 📸 Partido(s) finalizado(s). Tomando snapshot del ranking...");
                        setTimeout(async () => {
                            if (!isMountedRef.current) return;
                            try {
                                const snapshotsUpdate = {};
                                
                                for (const finishedMatch of newlyFinishedMatches) {
                                    const snapshotRanking = calculateProgressiveRankingRef.current(finishedMatch.utcDate, true);
                                    const scoresOnly = {};
                                    snapshotRanking.forEach(user => { scoresOnly[user.uid] = user.totalPoints; });

                                    const homeName = finishedMatch.homeTeam?.name || 'TBD';
                                    const awayName = finishedMatch.awayTeam?.name || 'TBD';

                                    snapshotsUpdate[`match_${finishedMatch.id}`] = {
                                        matchId: finishedMatch.id,
                                        matchName: `${homeName} vs ${awayName}`,
                                        dateRecorded: new Date().toISOString(),
                                        matchDate: finishedMatch.utcDate,
                                        scores: scoresOnly
                                    };
                                }

                                await setDoc(doc(db, 'worldCupAdmin', 'rankingHistory'), { 
                                    snapshots: snapshotsUpdate 
                                }, { merge: true });
                                
                                console.log(`[Fotógrafo Histórico] ✅ Fotos guardadas en worldCupAdmin/rankingHistory`);
                            } catch (snapErr) {
                                console.error("[Fotógrafo Histórico] ❌ Error tomando la foto:", snapErr);
                            }
                        }, 2000); 
                    }

                    // 3. Damos 3 segundos para que el Sincronizador Maestro guarde el ranking y despertamos a Gemini
                    setTimeout(async () => {
                        if (isMountedRef.current) {
                            console.log("[Radar Predictivo] 🤖 Despertando a la IA con el ranking fresco...");
                            await setDoc(doc(db, 'worldCupAdmin', 'trigger'), { 
                                action: 'API_GOL_DETECTED',
                                timestamp: new Date().toISOString() 
                            });
                        }
                    }, 3000);
                }
                
                // Programamos el siguiente ciclo asegurándonos de limpiar el anterior
                if (radarTimeoutRef.current) clearTimeout(radarTimeoutRef.current);
                if (isMountedRef.current) {
                    radarTimeoutRef.current = setTimeout(performSmartSync, nextCheckDelay);
                }

            } catch (error) {
                if (!isMountedRef.current) return;
                console.error("❌ Error en Auto-Sync:", error);
                if (radarTimeoutRef.current) clearTimeout(radarTimeoutRef.current);
                radarTimeoutRef.current = setTimeout(performSmartSync, 30000); 
            }
        };

        performSmartSync();

        return () => {
            isMountedRef.current = false; 
            if (radarTimeoutRef.current) {
                console.log("[Radar Predictivo] 🛑 Destruyendo radar de manera segura.");
                clearTimeout(radarTimeoutRef.current);
            }
        };
    }, [isAdmin, simStatusesString]);
    const simulatedDate = adminResults?.simulation?.simulatedDate || '';

    const effectiveMatches = useMemo(() => {
        return matches.map(m => {
            const simStatus = adminResults?.simulation?.matchStatuses?.[m.id];
            const apiStatus = adminResults?.apiStatuses?.[m.id]; 
            
            let finalStatus = m.status;
            if (simStatus && simStatus !== '') {
                finalStatus = simStatus; // 1. Manda la Simulación
            } else if (apiStatus && apiStatus !== '') {
                finalStatus = apiStatus; // 2. Manda el radar automático
            }
            
            return { ...m, status: finalStatus };
        });
    }, [matches, adminResults]);

    // 📺 DICCIONARIO DE ORDENAMIENTO GLOBAL PARA CANALES (1 a 104)
    const globalMatchIndexMap = useMemo(() => {
        const sorted = [...effectiveMatches].sort((a,b) => new Date(a.utcDate) - new Date(b.utcDate) || Number(a.id) - Number(b.id));
        const map = {};
        sorted.forEach((m, idx) => map[m.id] = idx + 1);
        return map;
    }, [effectiveMatches]);

    const mergedAdminPreds = useMemo(() => {
        const preds = { ...(adminResults?.predictions || {}) };
        effectiveMatches.forEach(m => {
            const status = m.status || '';
            const hasO = (preds[m.id] && preds[m.id].home !== '' && preds[m.id].away !== '') || status === 'FINISHED' || status.includes('PLAY');
            
            if (hasO) {
                if (preds[m.id]?.home === undefined || preds[m.id]?.home === '') {
                    if (m.score?.fullTime?.home !== null && m.score?.fullTime?.home !== undefined) {
                        preds[m.id] = {
                            ...preds[m.id],
                            home: m.score.fullTime.home,
                            away: m.score.fullTime.away
                        };
                    }
                }
            }
        });
        return preds;
    }, [adminResults, effectiveMatches]);

    const handleSimulateDate = async (newDate) => {
        const adminRef = doc(db, 'worldCupAdmin', 'results');
        await setDoc(adminRef, { simulation: { simulatedDate: newDate } }, { merge: true });
    };

    const handleSimulateStatus = async (matchId, newStatus) => {
        const adminRef = doc(db, 'worldCupAdmin', 'results');
        const currentSim = adminResults?.simulation || {};
        const currentStatuses = currentSim.matchStatuses || {};
        const newStatuses = { ...currentStatuses, [matchId]: newStatus };

        await setDoc(adminRef, { 
            simulation: { ...currentSim, matchStatuses: newStatuses } 
        }, { merge: true });
    };

    const allTeams = useMemo(() => {
        const teamsMap = new Map();
        effectiveMatches.forEach(m => {
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
    }, [effectiveMatches]);

    const getStandings = useCallback((groupMatches, preds, groupName, tiebreakers) => {
        const teams = {};
        groupMatches.forEach(m => {
            const h = m.homeTeam?.name || 'Por definir';
            const a = m.awayTeam?.name || 'Por definir';
            if (!teams[h]) teams[h] = { name: h, crest: m.homeTeam?.crest, pj: 0, pg: 0, pe: 0, pp: 0, gf: 0, gc: 0, dg: 0, pts: 0 };
            if (!teams[a]) teams[a] = { name: a, crest: m.awayTeam?.crest, pj: 0, pg: 0, pe: 0, pp: 0, gf: 0, gc: 0, dg: 0, pts: 0 };
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
                if (gh > ga) { teams[h].pts += 3; teams[h].pg++; teams[a].pp++; } 
                else if (gh < ga) { teams[a].pts += 3; teams[a].pg++; teams[h].pp++; } 
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
                    const pr = preds?.[m.id];
                    if (pr && pr.home !== '' && pr.away !== '') {
                        const hG = parseInt(pr.home, 10); const aG = parseInt(pr.away, 10);
                        const h = m.homeTeam.name; const a = m.awayTeam.name;
                        h2hStats[h].gf += hG; h2hStats[a].gf += aG;
                        h2hStats[h].dg += (hG - aG); h2hStats[a].dg += (aG - hG);
                        if (hG > aG) h2hStats[h].pts += 3;
                        else if (hG < aG) h2hStats[a].pts += 3;
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
                } else if (subGroup.length > 1) {
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
                                const tieA = tiebreakers?.[groupName]?.[a.name] || 99;
                                const tieB = tiebreakers?.[groupName]?.[b.name] || 99;
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
            finalFlattenedStandings.push(...resolveTie(groupedByPts[pts]));
        });
        return finalFlattenedStandings;
    }, []);

    const groupMatchesMap = useMemo(() => {
        return effectiveMatches.filter(m => m.stage === 'GROUP_STAGE').reduce((acc, m) => {
            let g = m.group?.replace('GROUP_', 'Grupo ') || 'Fase de Grupos';
            if (!acc[g]) acc[g] = []; acc[g].push(m); return acc;
        }, {});
    }, [effectiveMatches]);

    const adminQualified32 = useMemo(() => {
        let top2 = []; let thirds = []; let allFinished = true;
        Object.keys(groupMatchesMap).forEach(g => {
            const groupMatches = groupMatchesMap[g];
            const isGroupFinished = groupMatches.every(m => mergedAdminPreds[m.id]?.home !== undefined && mergedAdminPreds[m.id]?.home !== '');
            if (!isGroupFinished) allFinished = false;
            if (isGroupFinished) {
                const st = getStandings(groupMatches, mergedAdminPreds, g, adminResults?.manualTiebreakers);
                if (st[0]) top2.push({ ...st[0], qualReason: '1º', group: g });
                if (st[1]) top2.push({ ...st[1], qualReason: '2º', group: g });
                if (st[2]) thirds.push({ ...st[2], qualReason: '3º', group: g });
            }
        });
        if (allFinished && top2.length > 0) {
            thirds.sort((a, b) => b.pts - a.pts || b.dg - a.dg || b.gf - a.gf);
            return [...top2, ...thirds.slice(0, 8)];
        }
        return top2;
    }, [groupMatchesMap, mergedAdminPreds, adminResults, getStandings]);

    const adminFullBracket = useMemo(() => {
        let teams = adminQualified32 || [];
        const tempTeams = [...teams];
        for (let i = tempTeams.length; i < 32; i++) {
            tempTeams.push({ name: `Por Definir ${i}`, isPlaceholder: true, group: 'Grupo TBD', qualReason: '-' });
        }
        try { 
            return generateFullBracket(tempTeams, adminResults?.knockoutPicks || {}); 
        } 
        catch (e) { 
            console.error("Error armando bracket en Grilla Live", e); 
            return null; 
        }
    }, [adminQualified32, adminResults]);

    const getThirdPlaceTeams = (picksObj) => {
        if (!picksObj) return [];
        const teamsMap = new Map();
        const t3 = Array.isArray(picksObj.tercero) ? picksObj.tercero : (picksObj.tercero ? [picksObj.tercero] : []);
        const t4 = Array.isArray(picksObj.cuarto) ? picksObj.cuarto : (picksObj.cuarto ? [picksObj.cuarto] : []);
        [...t3, ...t4].forEach(t => { if (t && t.name) teamsMap.set(t.name, t); });
        
        const semifinalistas = picksObj.cuartos || []; 
        const finalistas = picksObj.semis || [];        
        if (semifinalistas.length > 0 && finalistas.length > 0) {
            const deductedTeams = semifinalistas.filter(semiTeam => !finalistas.some(finTeam => finTeam.name === semiTeam.name));
            deductedTeams.forEach(t => { if (t && t.name) teamsMap.set(t.name, t); });
        }
        return Array.from(teamsMap.values());
    };

    const calculateProgressiveRanking = useCallback((targetMatchDateStr, isGlobalLive = false) => {
        const ranks = [];
        const targetDate = new Date(targetMatchDateStr);
        
        // 🛡️ FILTRO ELÁSTICO CORREGIDO: Sólo aplica para el Sincronizador Global en la nube
        const pastMatches = effectiveMatches.filter(m => {
            const matchDate = new Date(m.utcDate);
            if (isGlobalLive && (m.status === 'IN_PLAY' || m.status === 'PAUSED' || m.status === 'FINISHED')) {
                return true;
            }
            return matchDate <= targetDate;
        });

        let adminProgTop2 = []; 
        let adminProgThirds = [];
        let allGroupsFinishedUpToDate = true;

        Object.keys(groupMatchesMap).forEach(g => {
            const groupMatches = groupMatchesMap[g];
            const lastMatchOfGroup = [...groupMatches].sort((a,b) => new Date(b.utcDate) - new Date(a.utcDate))[0];
            
            if (lastMatchOfGroup && new Date(lastMatchOfGroup.utcDate) <= targetDate) {
                const isGroupFinished = groupMatches.every(m => (mergedAdminPreds[m.id]?.home !== undefined && mergedAdminPreds[m.id]?.home !== '') || m.status === 'FINISHED');
                if (isGroupFinished) {
                    const st = getStandings(groupMatches, mergedAdminPreds, g, adminResults?.manualTiebreakers);
                    if (st[0]) adminProgTop2.push(st[0]); 
                    if (st[1]) adminProgTop2.push(st[1]); 
                    if (st[2]) adminProgThirds.push(st[2]);
                } else {
                    allGroupsFinishedUpToDate = false;
                }
            } else {
                allGroupsFinishedUpToDate = false;
            }
        });

        let adminProgQual32 = [...adminProgTop2];
        if (allGroupsFinishedUpToDate && adminProgTop2.length > 0) {
            adminProgThirds.sort((a, b) => b.pts - a.pts || b.dg - a.dg || b.gf - a.gf);
            adminProgQual32 = [...adminProgTop2, ...adminProgThirds.slice(0, 8)];
        }

        Object.keys(allPredictions).forEach(uid => {
            const userData = allPredictions[uid];
            if (!userData.hasPaid || EXCLUDED_EMAILS.includes(userData.email)) return;

            let total = 0;

            pastMatches.forEach(m => {
                const p = userData.predictions?.[m.id]; 
                const rH = mergedAdminPreds[m.id]?.home;
                const rA = mergedAdminPreds[m.id]?.away;
                const matchStatus = m.status || '';
                const canSumMatch = (rH !== undefined && rH !== '' && rA !== undefined && rA !== '') || matchStatus === 'FINISHED' || matchStatus === 'IN_PLAY' || matchStatus === 'PAUSED';
                
                if (canSumMatch && p && p.home !== '' && p.away !== '') {
                    const realH = parseInt(rH, 10);
                    const realA = parseInt(rA, 10);
                    
                    if (!isNaN(realH) && !isNaN(realA)) {
                        const pH = parseInt(p.home, 10); const pA = parseInt(p.away, 10);
                        if (pH === realH && pA === realA) total += 5;
                        else {
                            const pR = Math.sign(pH - pA); const rR = Math.sign(realH - realA);
                            if (pR === rR && (pH === realH || pA === realA)) total += 3;
                            else if (pR === rR) total += 2;
                            else if (pH === realH || pA === realA) total += 1;
                        }
                    }
                }
            });

            Object.keys(groupMatchesMap).forEach(g => {
                const groupMatches = groupMatchesMap[g];
                const lastMatchOfGroup = [...groupMatches].sort((a,b) => new Date(b.utcDate) - new Date(a.utcDate))[0];
                if (lastMatchOfGroup && new Date(lastMatchOfGroup.utcDate) <= targetDate) {
                    const isGroupFinished = groupMatches.every(m => (mergedAdminPreds[m.id]?.home !== undefined && mergedAdminPreds[m.id]?.home !== '') || m.status === 'FINISHED');
                    const predictedCount = groupMatches.filter(m => userData.predictions?.[m.id]?.home !== undefined && userData.predictions?.[m.id]?.home !== '').length;
                    if (isGroupFinished && predictedCount === groupMatches.length) {
                        const uT = getStandings(groupMatches, userData.predictions, g, userData.manualTiebreakers);
                        const aT = getStandings(groupMatches, mergedAdminPreds, g, adminResults?.manualTiebreakers);
                        if (uT.length >= 4 && aT.length >= 4 && uT[0].name === aT[0].name && uT[1].name === aT[1].name && uT[2].name === aT[2].name && uT[3].name === aT[3].name) total += 8;
                    }
                }
            });

            let userTop2 = []; let userThirds = [];
            Object.keys(groupMatchesMap).forEach(g => {
                const uT = getStandings(groupMatchesMap[g], userData.predictions, g, userData.manualTiebreakers);
                if (uT[0]) userTop2.push(uT[0]); 
                if (uT[1]) userTop2.push(uT[1]); 
                if (uT[2]) userThirds.push(uT[2]);
            });
            userThirds.sort((a, b) => b.pts - a.pts || b.dg - a.dg || b.gf - a.gf);
            const userProgQual32 = [...userTop2, ...userThirds.slice(0, 8)];

            if (adminProgQual32.length > 0) {
                userProgQual32.forEach(ut => {
                    if (adminProgQual32.some(at => at.name === ut.name)) total += 2;
                });
            }

            const koRounds = [
                { id: 'dieciseisavos', pts: 3, stage: 'LAST_32' }, 
                { id: 'octavos', pts: 4, stage: 'LAST_16' },
                { id: 'cuartos', pts: 5, stage: 'QUARTER_FINALS' }, 
                { id: 'semis', pts: 6, stage: 'SEMI_FINALS' }
            ];

            koRounds.forEach(r => {
                const uTeams = userData.knockoutPicks?.[r.id] || [];
                const aTeams = adminResults?.knockoutPicks?.[r.id] || [];
                
                if (aTeams.length > 0) {
                    uTeams.forEach(ut => {
                        if (aTeams.some(at => at.name === ut.name)) {
                            let matchDateForTeam = null;

                            if (adminFullBracket && adminFullBracket[r.id]) {
                                const apiMatchesForStage = effectiveMatches.filter(m => m.stage === r.stage).sort((a, b) => Number(a.id) - Number(b.id));
                                const bracketMatchValues = Object.keys(adminFullBracket[r.id])
                                    .sort((a, b) => (parseInt(a.replace(/\D/g, '')) || 0) - (parseInt(b.replace(/\D/g, '')) || 0))
                                    .map(k => adminFullBracket[r.id][k]);

                                apiMatchesForStage.forEach((m, index) => {
                                    const bMatch = bracketMatchValues[index];
                                    if (bMatch) {
                                        const hName = bMatch.home && !bMatch.home.isPlaceholder ? bMatch.home.name : null;
                                        const aName = bMatch.away && !bMatch.away.isPlaceholder ? bMatch.away.name : null;
                                        if (hName === ut.name || aName === ut.name) {
                                            matchDateForTeam = new Date(m.utcDate);
                                        }
                                    }
                                });
                            }

                            if (matchDateForTeam && matchDateForTeam <= targetDate) {
                                total += r.pts;
                            }
                        }
                    });
                }
            });

            const uThirdsList = getThirdPlaceTeams(userData.knockoutPicks);
            let officialThirdPlaceContenders = [];
            let thirdPlaceMatchDates = {};

            if (adminFullBracket && adminFullBracket['semis']) {
                const adminFinalists = adminResults?.knockoutPicks?.semis || [];
                const apiMatchesForSemis = effectiveMatches.filter(m => m.stage === 'SEMI_FINALS').sort((a, b) => Number(a.id) - Number(b.id));
                const bracketMatchValues = Object.keys(adminFullBracket['semis'])
                    .sort((a, b) => (parseInt(a.replace(/\D/g, '')) || 0) - (parseInt(b.replace(/\D/g, '')) || 0))
                    .map(k => adminFullBracket['semis'][k]);

                bracketMatchValues.forEach((bMatch, index) => {
                    const hName = bMatch.home && !bMatch.home.isPlaceholder ? bMatch.home.name : null;
                    const aName = bMatch.away && !bMatch.away.isPlaceholder ? bMatch.away.name : null;
                    
                    if (hName && aName) {
                        const homeAdvanced = adminFinalists.some(f => f.name === hName);
                        const awayAdvanced = adminFinalists.some(f => f.name === aName);
                        
                        const apiMatch = apiMatchesForSemis[index];
                        const matchDate = apiMatch ? new Date(apiMatch.utcDate) : null;

                        if (homeAdvanced && !awayAdvanced) {
                            officialThirdPlaceContenders.push(aName);
                            if (matchDate) thirdPlaceMatchDates[aName] = matchDate;
                        }
                        if (awayAdvanced && !homeAdvanced) {
                            officialThirdPlaceContenders.push(hName);
                            if (matchDate) thirdPlaceMatchDates[hName] = matchDate;
                        }
                    }
                });
            }

            if (officialThirdPlaceContenders.length > 0) {
                uThirdsList.forEach(ut => {
                    if (ut && officialThirdPlaceContenders.includes(ut.name)) {
                        const matchDate = thirdPlaceMatchDates[ut.name];
                        if (matchDate && matchDate <= targetDate) {
                            total += 4;
                        }
                    }
                });
            }

            const thirdMatch = effectiveMatches.find(m => m.stage === 'THIRD_PLACE');
            if (thirdMatch && new Date(thirdMatch.utcDate) <= targetDate) {
                const honorSlotsThird = [{ id: 'tercero', pts: 6 }, { id: 'cuarto', pts: 6 }];
                honorSlotsThird.forEach(s => {
                    if (userData.knockoutPicks?.[s.id]?.[0]?.name === adminResults?.knockoutPicks?.[s.id]?.[0]?.name && adminResults?.knockoutPicks?.[s.id]?.[0]?.name) { total += s.pts; }
                });
            }

            const finalMatch = effectiveMatches.find(m => m.stage === 'FINAL');
            if (finalMatch && new Date(finalMatch.utcDate) <= targetDate) {
                const honorSlotsFinal = [{ id: 'campeon', pts: 10 }, { id: 'subcampeon', pts: 6 }];
                honorSlotsFinal.forEach(s => {
                    if (userData.knockoutPicks?.[s.id]?.[0]?.name === adminResults?.knockoutPicks?.[s.id]?.[0]?.name && adminResults?.knockoutPicks?.[s.id]?.[0]?.name) { total += s.pts; }
                });
                
                let isSuperBono = false;
                if (adminResults?.knockoutPicks) {
                    const allHonorSlots = [{ id: 'campeon' }, { id: 'subcampeon' }, { id: 'tercero' }, { id: 'cuarto' }];
                    isSuperBono = allHonorSlots.every(s => userData.knockoutPicks?.[s.id]?.[0]?.name === adminResults.knockoutPicks[s.id]?.[0]?.name && adminResults.knockoutPicks[s.id]?.[0]?.name);
                }
                if (isSuperBono) total += 10;
            }

            extraQuestions.forEach(q => {
                const answer = userData.extraPicks?.[q.id];
                const officialAnswer = adminResults?.extraPicks?.[q.id];
                const timestampStr = adminResults?.timestamps?.[q.id]; 
                const eventDate = timestampStr ? new Date(timestampStr) : new Date(0);

                if (officialAnswer && answer && eventDate <= targetDate) {
                    if (q.manual) {
                        if (isSmartMatch(answer, officialAnswer)) total += 6;
                    } else {
                        if (officialAnswer.toLowerCase() === answer.toLowerCase()) total += 6;
                    }
                }
            });

            specialEvents.forEach(e => {
                let answer = userData.eventPicks?.[e.id];
                let officialAnswer = adminResults?.eventPicks?.[e.id];
                const timestampStr = adminResults?.timestamps?.[e.id]; 
                const eventDate = timestampStr ? new Date(timestampStr) : new Date(0);

                if (answer && officialAnswer && eventDate <= targetDate) {
                    answer = String(answer).toUpperCase().trim();
                    officialAnswer = String(officialAnswer).toUpperCase().trim();
                    if (officialAnswer === answer) {
                        total += answer === 'SI' ? 5 : 2;
                    }
                }
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
    }, [allPredictions, effectiveMatches, mergedAdminPreds, groupMatchesMap, getStandings, adminResults, usersInfo, adminFullBracket]);
    
    // 🟢 EL TELÉFONO ROJO: Para que el radar siempre tenga las matemáticas frescas
    const calculateProgressiveRankingRef = useRef(calculateProgressiveRanking);
    useEffect(() => {
        calculateProgressiveRankingRef.current = calculateProgressiveRanking;
    }, [calculateProgressiveRanking]);

    // 🌟 NUEVO: SINCRONIZADOR MAESTRO (Garantiza que Firestore sea un espejo fiel de tu pantalla)
    useEffect(() => {
        if (!isAdmin) return;

        const syncLiveRankingToFirestore = async () => {
            try {
                const nowISO = new Date().toISOString();
                const currentRanking = calculateProgressiveRanking(nowISO, true);

                if (currentRanking.length > 0) {
                    const pointsMap = {};
                    currentRanking.forEach(user => {
                        pointsMap[user.uid] = user.totalPoints;
                    });

                    const newPointsString = JSON.stringify(pointsMap);

                    // 🛡️ ESCUDO ANTI-CUOTA 2: Solo gastamos una escritura en Firebase si el ranking matemático realmente se movió
                    if (window.lastSavedRanking !== newPointsString) {
                        await setDoc(doc(db, 'worldCupAdmin', 'liveRanking'), {
                            points: pointsMap,
                            lastCalculated: nowISO
                        }, { merge: true });
                        
                        window.lastSavedRanking = newPointsString; 
                        console.log("🧮 [Sincronizador Maestro] liveRanking actualizado en Firestore con éxito.");
                    }
                }
            } catch (error) {
                console.error("❌ [Sincronizador Maestro] Error al sincronizar:", error);
            }
        };

        syncLiveRankingToFirestore();
    }, [isAdmin, calculateProgressiveRanking]);

    const matchesByDate = useMemo(() => {
        const grouped = {};
        effectiveMatches.forEach(m => {
            const d = new Date(m.utcDate);
            const dateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
            if (!grouped[dateStr]) grouped[dateStr] = [];
            grouped[dateStr].push(m);
        });
        return grouped;
    }, [effectiveMatches]);

    const sortedDates = useMemo(() => {
        return Object.keys(matchesByDate).sort((a, b) => new Date(a) - new Date(b));
    }, [matchesByDate]);

    useEffect(() => {
        if (sortedDates.length === 0) return;

        if (simulatedDate !== prevSimDateRef.current) {
            prevSimDateRef.current = simulatedDate;
            
            if (simulatedDate && sortedDates.includes(simulatedDate)) {
                setSelectedDate(simulatedDate);
            } 
            else if (!simulatedDate) {
                const d = new Date();
                const todayStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
                
                if (sortedDates.includes(todayStr)) {
                    setSelectedDate(todayStr);
                } else {
                    const nextActiveDate = sortedDates.find(date => matchesByDate[date]?.some(m => m.status !== 'FINISHED'));
                    setSelectedDate(nextActiveDate || sortedDates[0]);
                }
            }
            return;
        }

        if (!selectedDate) {
            let targetDate = simulatedDate || (() => {
                const d = new Date();
                return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
            })();
            
            if (sortedDates.includes(targetDate)) {
                setSelectedDate(targetDate);
            } else {
                const nextActiveDate = sortedDates.find(date => matchesByDate[date]?.some(m => m.status !== 'FINISHED'));
                setSelectedDate(nextActiveDate || sortedDates[0]);
            }
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [sortedDates, simulatedDate, selectedDate, matchesByDate]); 

    useEffect(() => {
        if (selectedDate && scrollContainerRef.current) {
            const activeTab = document.getElementById(`date-tab-${selectedDate}`);
            if (activeTab) {
                const container = scrollContainerRef.current;
                const scrollLeft = activeTab.offsetLeft - (container.offsetWidth / 2) + (activeTab.offsetWidth / 2);
                container.scrollTo({ left: scrollLeft, behavior: 'smooth' });
            }
        }
    }, [selectedDate]);

    const sortedMatchesOfDay = useMemo(() => {
        if (!selectedDate || !matchesByDate[selectedDate]) return [];
        return [...matchesByDate[selectedDate]].sort((a, b) => {
            const getStatusPriority = (m) => {
                if (m.status === 'IN_PLAY' || m.status === 'PAUSED') return 0; 
                if (m.status === 'FINISHED') return 1; 
                if (m.status === 'TIMED' || m.status === 'SCHEDULED') return 2;
                return 3; 
            };
            
            const priorityA = getStatusPriority(a);
            const priorityB = getStatusPriority(b);
            
            if (priorityA !== priorityB) return priorityA - priorityB;
            
            if (priorityA === 1) {
                return new Date(b.utcDate) - new Date(a.utcDate);
            }
            
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

    // 📸 BOTÓN DE RESCATE BLINDADO: Genera las fotos y las guarda en worldCupAdmin
    const handleTakeRetroactivePhotos = async () => {
        try {
            const finishedMatches = effectiveMatches.filter(m => {
                const isFinished = m.status === 'FINISHED';
                const hasHomeTeam = m.homeTeam && m.homeTeam.name && m.homeTeam.name !== 'TBD' && !m.homeTeam.name.includes('Winner') && !m.homeTeam.name.includes('Loser');
                const hasAwayTeam = m.awayTeam && m.awayTeam.name && m.awayTeam.name !== 'TBD' && !m.awayTeam.name.includes('Winner') && !m.awayTeam.name.includes('Loser');
                return isFinished && hasHomeTeam && hasAwayTeam;
            });

            if (finishedMatches.length === 0) {
                toast.error("No hay partidos válidos finalizados para fotografiar.");
                return;
            }

            toast.loading(`Generando ${finishedMatches.length} fotos históricas...`, { id: 'retro-photos' });
            
            const snapshotsToSave = {};

            for (const match of finishedMatches) {
                const snapshotRanking = calculateProgressiveRankingRef.current(match.utcDate, false);
                const scoresOnly = {};
                snapshotRanking.forEach(user => { scoresOnly[user.uid] = user.totalPoints; });

                const homeName = match.homeTeam?.name || 'TBD';
                const awayName = match.awayTeam?.name || 'TBD';

                snapshotsToSave[`match_${match.id}`] = {
                    matchId: match.id,
                    matchName: `${homeName} vs ${awayName}`, 
                    dateRecorded: new Date().toISOString(),
                    matchDate: match.utcDate,
                    scores: scoresOnly
                };
            }

            await setDoc(doc(db, 'worldCupAdmin', 'rankingHistory'), { 
                snapshots: snapshotsToSave 
            }, { merge: true });
            
            toast.success(`¡Misión cumplida! Historial guardado en worldCupAdmin/rankingHistory.`, { id: 'retro-photos' });
        } catch (error) {
            console.error("❌ Error en el viaje temporal:", error);
            toast.error('Error generando el historial retroactivo.', { id: 'retro-photos' });
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
            
            <div className="bg-gradient-to-br from-slate-900 to-slate-800 rounded-2xl sm:rounded-[2rem] p-3 sm:p-10 mb-6 sm:mb-8 text-center border border-border shadow-xl relative overflow-hidden flex flex-row items-center justify-center gap-3 sm:gap-6">
                <div className="absolute top-0 left-0 w-full h-full bg-primary/5 z-0 pointer-events-none"></div>
                <img src={logocopa} className="w-12 h-12 sm:w-20 sm:h-20 object-contain drop-shadow-[0_0_15px_rgba(245,158,11,0.4)] z-10" alt="" />
                
                <div className="relative z-10 flex flex-col items-start sm:items-center text-left sm:text-center">
                    <h2 className="text-xl sm:text-4xl font-black text-white mb-0.5 sm:mb-2 tracking-tighter drop-shadow-md">📡 GRILLA LIVE</h2>
                    <div className="flex gap-2">
                        <p className="text-primary font-black uppercase text-[8px] sm:text-xs tracking-widest bg-primary/10 px-2.5 sm:px-4 py-1 sm:py-1.5 rounded-full border border-primary/20 shadow-sm">
                            Puntos Progresivos
                        </p>
                        {isAdmin && isLivePollingActive && (
                            <p className="text-green-500 font-black uppercase text-[8px] sm:text-xs tracking-widest bg-green-500/10 px-2.5 sm:px-4 py-1 sm:py-1.5 rounded-full border border-green-500/20 shadow-sm animate-pulse">
                                🔄 Radar 10s Activado
                            </p>
                        )}
                    </div>
                </div>
            </div>

            {isAdmin && (
                <div className="mb-8 bg-purple-900/20 border border-purple-500/30 p-4 sm:p-5 rounded-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-[0_0_15px_rgba(168,85,247,0.05)] animate-fade-in">
                    <div className="flex items-center gap-3">
                        <span className="text-2xl sm:text-3xl animate-pulse">⏱️</span>
                        <div>
                            <h4 className="font-black text-purple-400 uppercase tracking-widest text-[10px] sm:text-xs mb-0.5">Control Maestro: Simulación Global</h4>
                            <p className="text-[10px] sm:text-xs text-purple-300/70 leading-tight">Cambia la fecha y los estados. ¡Esto afectará a TODOS los usuarios conectados!</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2 w-full sm:w-auto">
                        {!simulatedDate && (
                            <span className="text-[9px] sm:text-[10px] font-black uppercase tracking-widest text-green-500 bg-green-500/10 px-3 py-2.5 rounded-xl border border-green-500/20 whitespace-nowrap">
                                🟢 API Real
                            </span>
                        )}
                        <input 
                            type="date" 
                            value={simulatedDate}
                            onChange={(e) => handleSimulateDate(e.target.value)}
                            className="flex-1 sm:flex-none bg-background-offset border border-purple-500/50 text-foreground font-bold p-2 sm:p-2.5 rounded-xl focus:ring-2 focus:ring-purple-500 outline-none text-xs sm:text-sm"
                        />
                        {simulatedDate && (
                            <button 
                                onClick={() => handleSimulateDate('')} 
                                className="bg-red-500/20 text-red-400 px-3 py-2 sm:py-2.5 rounded-xl font-black hover:bg-red-500/40 transition-colors text-xs flex items-center gap-1.5 uppercase tracking-widest" 
                                title="Volver a fecha real"
                            >
                                <span>✖️</span> <span className="hidden sm:inline">Apagar</span>
                            </button>
                        )}
                        <button 
                            onClick={handleTakeRetroactivePhotos} 
                            className="bg-yellow-500/20 text-yellow-400 px-3 py-2 sm:py-2.5 rounded-xl font-black hover:bg-yellow-500/40 transition-colors text-xs flex items-center gap-1.5 uppercase tracking-widest ml-2" 
                            title="Recuperar fotos del pasado"
                        >
                            <span>📸</span> <span className="hidden sm:inline">Recuperar Historial</span>
                        </button>
                    </div>
                </div>
            )}
            <WorldCupCountdown />
            <NewsTicker />
    
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
                        
                        const isKnockout = matchesByDate[d].some(m => m.stage !== 'GROUP_STAGE');

                        return (
                            
                            <button 
                                key={d} 
                                id={`date-tab-${d}`} 
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
                                    isSelected ? 'w-8 bg-white/40' : (allFinished ? 'w-4 bg-border/50' : (isKnockout ? 'w-4 bg-indigo-500/30' : 'w-4 bg-primary/30'))
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
                    const a = mergedAdminPreds[match.id];
                    const rH = a?.home;
                    const rA = a?.away;
                    const matchStatus = match.status || '';
                    const hasO = (rH !== undefined && rH !== '' && rA !== undefined && rA !== '') || matchStatus === 'FINISHED' || matchStatus.includes('PLAY');
                    const isPlaying = matchStatus === 'IN_PLAY';
                    const isPaused = matchStatus === 'PAUSED';

                    // 🟢 RANKING ESPECÍFICO HASTA ESTE PARTIDO EXACTO
                    // 🟢 RANKING ESPECÍFICO HASTA ESTE PARTIDO EXACTO
                    const matchSpecificRanking = calculateProgressiveRanking(match.utcDate).map(user => {
                        const uP = allPredictions[user.uid]?.predictions?.[match.id];
                        let pts = null;
                        
                        const realH = parseInt(rH, 10);
                        const realA = parseInt(rA, 10);
                        const hasValidRealScore = !isNaN(realH) && !isNaN(realA);

                        if (hasO && uP && uP.home !== '' && hasValidRealScore) {
                            const pH = parseInt(uP.home, 10); const pA = parseInt(uP.away, 10);
                            
                            if (pH === realH && pA === realA) pts = 5;
                            else {
                                const pR = Math.sign(pH - pA); const rR = Math.sign(realH - realA);
                                if (pR === rR && (pH === realH || pA === realA)) pts = 3;
                                else if (pR === rR) pts = 2;
                                else if (pH === realH || pA === realA) pts = 1;
                                else pts = 0;
                            }
                        }
                        return { ...user, uP, pts };
                    });

                    // 🔥 NUEVO: ESCÁNER DE INSIGNIAS PREDICTIVAS (Con matemática cruzada)
                    const validPicks = matchSpecificRanking.filter(u => u.uP && u.uP.home !== '');
                    const scoreFrequencies = {};
                    const outcomeFrequencies = { H: 0, D: 0, A: 0 };
                    let currentLeaderPoints = 0;

                    validPicks.forEach(u => {
                        const h = parseInt(u.uP.home, 10);
                        const a = parseInt(u.uP.away, 10);
                        const key = `${h}-${a}`;
                        
                        scoreFrequencies[key] = (scoreFrequencies[key] || 0) + 1;
                        
                        if (h > a) outcomeFrequencies.H++;
                        else if (h < a) outcomeFrequencies.A++;
                        else outcomeFrequencies.D++;

                        if (u.totalPoints > currentLeaderPoints) currentLeaderPoints = u.totalPoints;
                    });

                    const maxFrequency = Math.max(0, ...Object.values(scoreFrequencies));

                    // Función auxiliar de simulación para el Cohete
                    const calcSimPts = (uH, uA, realH, realA) => {
                        if (uH === realH && uA === realA) return 5;
                        const pR = Math.sign(uH - uA);
                        const rR = Math.sign(realH - realA);
                        if (pR === rR && (uH === realH || uA === realA)) return 3;
                        if (pR === rR) return 2;
                        if (uH === realH || uA === realA) return 1;
                        return 0;
                    };

                    const matchRankingWithBadges = matchSpecificRanking.map(user => {
                        let gridBadges = [];
                        if (user.uP && user.uP.home !== '') {
                            const h = parseInt(user.uP.home, 10);
                            const a = parseInt(user.uP.away, 10);
                            const key = `${h}-${a}`;
                            const outcome = h > a ? 'H' : (h < a ? 'A' : 'D');

                            if (scoreFrequencies[key] === 1) gridBadges.push({ icon: '🐺', title: 'Lobo Solitario: Único con este marcador exacto' });
                            
                            if (outcomeFrequencies[outcome] === 1 && scoreFrequencies[key] !== 1) gridBadges.push({ icon: '🦄', title: 'El Visionario: Nadie más confió en este resultado' });

                            if (Math.abs(h - a) >= 4) gridBadges.push({ icon: '💣', title: 'Kamikaze: Apostando a una goleada histórica' });
                            
                            if (scoreFrequencies[key] === maxFrequency && maxFrequency > 2) gridBadges.push({ icon: '🐑', title: 'El Rebaño: El marcador más popular de la polla' });

                            // 🚀 Asalto al Trono (Matemática cruzada perfecta)
                            if (user.totalPoints < currentLeaderPoints) {
                                const myHypotheticalScore = user.totalPoints + 5; 
                                let wouldBeLeader = true;
                                
                                for (const otherUser of validPicks) {
                                    if (otherUser.uid === user.uid) continue;
                                    
                                    const oH = parseInt(otherUser.uP.home, 10);
                                    const oA = parseInt(otherUser.uP.away, 10);
                                    // Simulamos cuántos puntos ganaría el Oponente si NUESTRO marcador es el que se da
                                    const simPts = calcSimPts(oH, oA, h, a); 
                                    const otherHypotheticalScore = otherUser.totalPoints + simPts;
                                    
                                    if (otherHypotheticalScore > myHypotheticalScore) {
                                        wouldBeLeader = false;
                                        break; // Ya no lo alcanzó, rompemos el ciclo
                                    }
                                }
                                
                                if (wouldBeLeader) {
                                    gridBadges.push({ icon: '🚀', title: 'Asalto al Trono: Si acierta este pleno exacto, salta al liderato general' });
                                }
                            }
                        }
                        return { ...user, gridBadges };
                    });

                    

                    // 🟢 LÓGICA INFALIBLE PARA LOS NOMBRES DE LOS EQUIPOS BASADA EN EL ADMIN
                    const isKnockout = match.stage !== 'GROUP_STAGE';
                    const homeOriginal = match.homeTeam?.name || '';
                    const awayOriginal = match.awayTeam?.name || '';

                    const adminPred = adminResults?.predictions?.[match.id];
                    const customHome = adminPred?.customHomeTeam || '';
                    const customAway = adminPred?.customAwayTeam || '';

                    let finalHomeName = '';
                    let finalAwayName = '';
                    let isTeamDrawnFromBracket = false;

                    if (isKnockout) {
                        let roundKey = '';
                        if (match.stage === 'LAST_32' || match.stage === 'ROUND_OF_32') roundKey = 'dieciseisavos';
                        else if (match.stage === 'LAST_16') roundKey = 'octavos';
                        else if (match.stage === 'QUARTER_FINALS') roundKey = 'cuartos';
                        else if (match.stage === 'SEMI_FINALS') roundKey = 'semis';
                        else if (match.stage === 'FINAL') roundKey = 'final';
                        else if (match.stage === 'THIRD_PLACE') roundKey = 'tercero';

                        let bracketHome = null;
                        let bracketAway = null;

                        if (roundKey && adminFullBracket && adminFullBracket[roundKey]) {
                            const currentStageArray = effectiveMatches.filter(m => m.stage === match.stage).sort((a,b) => Number(a.id) - Number(b.id));

                            let bMatch;
                            if (roundKey === 'final' || roundKey === 'tercero') {
                                bMatch = Object.values(adminFullBracket[roundKey])[0];
                            } else {
                                const absoluteIndex = currentStageArray.findIndex(m => m.id === match.id);
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

                    const homeCrest = allTeams.find(t => t.name === finalHomeName)?.crest || match.homeTeam?.crest;
                    const awayCrest = allTeams.find(t => t.name === finalAwayName)?.crest || match.awayTeam?.crest;

                    const mainReferee = match.referees && match.referees.length > 0 
                        ? match.referees.find(r => r.type === 'REFEREE' || r.role === 'REFEREE') || match.referees[0] 
                        : null;

                    // 📺 LÓGICA DE CANALES DE TRANSMISIÓN 📺
                    // 📺 LÓGICA DE CANALES DE TRANSMISIÓN 📺
                    let broadcasters = ['DSPORTS']; // Siempre base
                    const matchNumber = globalMatchIndexMap[match.id];

                    if (!isKnockout) {
                        const caracolPairs = [
                            "Suiza-Bosnia y Herzegovina", "Escocia-Marruecos", "Alemania-Costa de Marfil", "Bélgica-Irán", 
                            "Argentina-Austria", "Colombia-República Democrática del Congo", "Brasil-Escocia", "Ecuador-Alemania", 
                            "Uruguay-España", "Colombia-Portugal", "México-Sudáfrica", "Estados Unidos-Paraguay", 
                            "Brasil-Marruecos", "Países Bajos-Japón", "Argentina-Argelia", "Uzbekistán-Colombia"
                        ];

                        const rcnPairs = [
                            ...caracolPairs, "España-Cabo Verde" // RCN tiene los mismos de Caracol + España vs Cabo Verde
                        ];

                        const winPairs = [
                            "Corea del Sur-República Checa", "Canadá-Bosnia y Herzegovina", "Qatar-Suiza", "Costa de Marfil-Ecuador", 
                            "Arabia Saudita-Uruguay", "Irak-Noruega", "Inglaterra-Croacia", "México-Corea del Sur", "Turquía-Paraguay", 
                            "Países Bajos-Suecia", "Ecuador-Curazao", "España-Arabia Saudita", "Noruega-Senegal", "Portugal-Uzbekistán", 
                            "República Checa-México", "Túnez-Países Bajos", "Noruega-Francia", "Jordania-Argentina"
                        ];

                        const disneyPairs = [
                            "México-Sudáfrica", "Canadá-Bosnia y Herzegovina", "Estados Unidos-Paraguay", "Brasil-Marruecos", 
                            "Alemania-Curazao", "Países Bajos-Japón", "Costa de Marfil-Ecuador", "España-Cabo Verde", 
                            "Bélgica-Egipto", "Arabia Saudita-Uruguay", "Francia-Senegal", "Argentina-Argelia", 
                            "Inglaterra-Croacia", "Uzbekistán-Colombia", "Suiza-Bosnia y Herzegovina", "Estados Unidos-Australia", 
                            "Escocia-Marruecos", "Turquía-Paraguay", "Alemania-Costa de Marfil", "Ecuador-Curazao", 
                            "España-Arabia Saudita", "Bélgica-Irán", "Uruguay-Cabo Verde", "Argentina-Austria", 
                            "Portugal-Uzbekistán", "Inglaterra-Ghana", "Colombia-República Democrática del Congo", "Brasil-Escocia", 
                            "Sudáfrica-Corea del Sur", "Ecuador-Alemania", "Túnez-Países Bajos", "Paraguay-Australia", 
                            "Noruega-Francia", "Uruguay-España", "Croacia-Ghana", "Colombia-Portugal", "Jordania-Argentina"
                        ];

                        const pair1 = `${translateTeam(finalHomeName)}-${translateTeam(finalAwayName)}`;
                        const pair2 = `${translateTeam(finalAwayName)}-${translateTeam(finalHomeName)}`;
                        
                        if (caracolPairs.includes(pair1) || caracolPairs.includes(pair2)) broadcasters.push('CARACOL');
                        if (rcnPairs.includes(pair1) || rcnPairs.includes(pair2)) broadcasters.push('RCN');
                        if (winPairs.includes(pair1) || winPairs.includes(pair2)) broadcasters.push('WIN');
                        if (disneyPairs.includes(pair1) || disneyPairs.includes(pair2)) broadcasters.push('DISNEY');

                    } else {
                        // Partidos de Eliminatoria en TV Abierta (Caracol/RCN)
                        const openTvKnockouts = [73, 76, 78, 81, 84, 86, 89, 90, 93, 94, 97, 98, 99, 100, 101, 102, 103, 104];
                        if (openTvKnockouts.includes(matchNumber)) {
                            broadcasters.push('CARACOL', 'RCN');
                        }
                    }

                    return (
                        <div key={match.id} className={`bg-card border ${isPlaying ? 'border-green-500 shadow-[0_0_20px_rgba(34,197,94,0.15)]' : isPaused ? 'border-amber-500 shadow-[0_0_20px_rgba(245,158,11,0.15)]' : 'border-border'} rounded-[1.5rem] sm:rounded-[2rem] overflow-hidden shadow-xl relative flex flex-col`}>
                            
                            {isAdmin && (
                                <div className="absolute top-3 right-3 z-50 mt-[-10px]">
                                    <select 
                                        className="bg-purple-900 text-purple-100 text-[9px] font-bold p-1 rounded-lg outline-none border border-purple-500/50 shadow-md cursor-pointer hover:bg-purple-800 transition-colors"
                                        value={adminResults?.simulation?.matchStatuses?.[match.id] || ''}
                                        onChange={(e) => handleSimulateStatus(match.id, e.target.value)}
                                        title="Simular Estado del Partido"
                                    >
                                        <option value="">⚙️ API Real</option>
                                        <option value="SCHEDULED">⏱️ Programado</option>
                                        <option value="IN_PLAY">🟢 En Juego</option>
                                        <option value="PAUSED">⏸️ En Pausa</option>
                                        <option value="FINISHED">🏁 Finalizado</option>
                                    </select>
                                </div>
                            )}

                            <div className={`${isPlaying ? 'bg-green-500/5' : isPaused ? 'bg-amber-500/5' : 'bg-background-offset'} pb-4 sm:pb-6 border-b border-border relative z-20`}>
                                
                                {/* 🟢 NUEVO SCOREBOARD ESTILO TV (Con canales inyectados) */}
                                <TVScoreboard 
                                    match={match} 
                                    homeName={finalHomeName} 
                                    awayName={finalAwayName} 
                                    homeCrest={homeCrest} 
                                    awayCrest={awayCrest} 
                                    rH={rH} 
                                    rA={rA} 
                                    hasO={hasO} 
                                    broadcasters={broadcasters}
                                />

                                {/* <div className="mt-4 text-center">
                                    <span className="inline-flex items-center gap-1.5 text-[9px] text-foreground-muted font-bold tracking-widest bg-background px-2.5 py-1 rounded border border-border/50">
                                        <span>👨‍⚖️</span> Árbitro: {mainReferee ? mainReferee.name : 'Por Definir'}
                                    </span>
                                </div> */}
                            </div>

                            {/* 🟢 BOTÓN DE INFOGRAFÍA EN LA GRILLA */}
                            {matchStatus === 'FINISHED' && (
                                <div className="px-4 pb-4 sm:px-6 sm:pb-6 relative z-20 bg-background-offset border-b border-border pt-[0px]">
                                    <button 
                                        onClick={() => setReportData({ match, ranking: matchSpecificRanking, adminPreds: a, homeCrest, awayCrest, finalHomeName, finalAwayName })}
                                        className="w-full bg-gradient-to-r from-emerald-500 to-teal-600 text-white font-black text-[10px] sm:text-xs py-3 rounded-xl shadow-md hover:scale-[1.02] transition-transform flex items-center justify-center gap-2 uppercase tracking-widest"
                                    >
                                        <span>📸</span> Reporte del Partido
                                    </button>
                                </div>
                            )}

                            {/* 🟢 LA TABLA CON EL FONDO CORRECTO (Cero huecos) */}
                            <div className="w-full relative z-10 overflow-hidden bg-background min-h-[150px] flex-grow">
                                <img src={logocopa} className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-48 h-48 sm:w-80 sm:h-80 object-contain opacity-[0.02] dark:opacity-[0.03] pointer-events-none z-0" alt="" />

                                <table className="w-full text-left table-fixed relative z-10">
                                    <thead>
                                        <tr className="bg-background-offset/80 backdrop-blur-md text-[8px] sm:text-xs uppercase font-black border-b border-border text-foreground-muted">
                                            <th className="py-2 pl-3 sm:p-5 w-[42%] sm:w-[50%] lg:w-[58%] sm:pl-8">Jugador</th>
                                            <th className="py-2 w-[22%] sm:w-[18%] lg:w-[14%] text-center">Predicción</th>
                                            <th className="py-2 w-[18%] sm:w-[16%] lg:w-[14%] text-center">Puntos</th>
                                            <th className="py-2 pr-3 sm:p-5 w-[18%] sm:w-[16%] lg:w-[14%] text-center sm:pr-8 text-amber-500">Hasta este momento</th>
                                        </tr>
                                    </thead>
                                    <tbody className="text-[10px] sm:text-sm">
                                        {matchRankingWithBadges.map((user) => {
                                            const is1st = user.position === 1;
                                            const is2nd = user.position === 2;
                                            const is3rd = user.position === 3;

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
                                                            <div className="flex flex-col flex-1 min-w-0">
                                                                <span className={`font-bold truncate text-[11px] sm:text-lg ${nameColor}`}>{formatShortName(user.name)}</span>
                                                                
                                                                {/* 🔥 INSIGNIAS DE LA GRILLA (DEBAJO DEL NOMBRE) */}
                                                                {user.gridBadges && user.gridBadges.length > 0 && (
                                                                    <div className="flex flex-wrap items-center gap-1 sm:gap-1.5 mt-0.5 sm:mt-1">
                                                                        {user.gridBadges.map((b, i) => (
                                                                            <span key={i} title={b.title} className="text-[11px] sm:text-[14px] cursor-help hover:scale-125 transition-transform drop-shadow-sm">
                                                                                {b.icon}
                                                                            </span>
                                                                        ))}
                                                                    </div>
                                                                )}
                                                            </div>
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
    user.pts === 3 ? 'text-blue-100 bg-gradient-to-r from-blue-600 to-indigo-600 border border-blue-400/50 shadow-[0_0_10px_rgba(37,99,235,0.3)]' : 
    user.pts === 2 ? 'text-white bg-gradient-to-r from-yellow-400 to-yellow-500 border border-yellow-300/50 shadow-[0_0_10px_rgba(250,204,21,0.4)]' :
    user.pts === 1 ? 'text-white bg-gradient-to-r from-orange-500 to-orange-600 border border-orange-400/50 shadow-[0_0_10px_rgba(249,115,22,0.4)]' :
    'text-white bg-gradient-to-r from-red-500 to-red-600 border border-red-400/50 shadow-[0_0_10px_rgba(239,68,68,0.4)]'
}`}>
    {user.pts > 0 ? `+${user.pts}` : '0'}
</span>

                                                            )}
                                                        </div>
                                                    </td>

                                                    <td className="py-3 sm:py-5 text-center pr-3 sm:pr-8 bg-amber-500/5">
                                                        <div className="flex justify-center w-full">
                                                            <span className="font-black text-amber-500 text-sm sm:text-3xl tabular-nums drop-shadow-sm">
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
            <InfografiaModal data={reportData} onClose={() => setReportData(null)} />
        </div>
    );
};

export default WorldCupGrid;