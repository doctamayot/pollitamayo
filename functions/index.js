const { onDocumentUpdated } = require("firebase-functions/v2/firestore");
const { onSchedule } = require("firebase-functions/v2/scheduler");
const admin = require("firebase-admin");
const { GoogleGenerativeAI } = require("@google/generative-ai");

if (admin.apps.length === 0) admin.initializeApp();
const db = admin.firestore();

// --- CONSTANTES FINANCIERAS ---
const ENTRY_FEE = 170000;
const ADMIN_FEE_PERCENT = 0.10;

// --- FUNCIÓN MAESTRA DE GENERACIÓN (La IA Deportiva) ---
async function runAiNewsGeneration() {
    try {
        const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
        const model = genAI.getGenerativeModel({ model: "gemini-3.5-flash" }); 

        // 1. OBTENER ESTADO DEL TORNEO
        const settingsSnap = await db.collection("worldCupAdmin").doc("settings").get();
        const isTournamentStarted = settingsSnap.exists ? settingsSnap.data().predictionsClosed === true : false;

        // 2. LEER LA API REAL
        const apiCacheSnap = await db.collection("worldCupAdmin").doc("apiCache").get();
        const apiMatches = apiCacheSnap.exists ? (apiCacheSnap.data().matches || []) : [];

        // 3. LEER LA VERDAD DEL ADMIN (LA PRIORIDAD)
        const adminResultsSnap = await db.collection("worldCupAdmin").doc("results").get();
        const adminResultsData = adminResultsSnap.exists ? adminResultsSnap.data() : {};
        const adminPreds = adminResultsData.predictions || {};
        const simStatuses = adminResultsData.simulation?.matchStatuses || {};

        // 🟢 4. FUSIONAR: EL ADMIN MANDA SOBRE LA API OFICIAL
        const matches = apiMatches.map(m => {
            let newMatch = { ...m };
            
            // A. Forzar estado si el admin lo cambió en el select (Simulación)
            if (simStatuses[m.id] && simStatuses[m.id] !== '') {
                newMatch.status = simStatuses[m.id];
            }

            // B. Forzar marcador si el admin lo guardó manualmente
            const adm = adminPreds[m.id];
            const hasAdminScore = adm && adm.home !== undefined && adm.home !== '' && adm.away !== undefined && adm.away !== '';
            
            if (hasAdminScore) {
                if (!newMatch.score) newMatch.score = {};
                newMatch.score.fullTime = {
                    home: parseInt(adm.home, 10),
                    away: parseInt(adm.away, 10)
                };
                
                // Si el admin puso marcador pero el estado oficial sigue "Programado", lo forzamos a "FINALIZADO"
                if (newMatch.status === 'SCHEDULED' || newMatch.status === 'TIMED') {
                    newMatch.status = 'FINISHED';
                }
            }
            return newMatch;
        });
        
        // 5. OBTENER USUARIOS Y CALCULAR EL BOTÍN
        const usersSnap = await db.collection("worldCupPredictions").get();
        let totalUsers = 0;
        let paidUsers = 0;
        let paidNames = [];
        let usersData = [];

        usersSnap.forEach(doc => {
            totalUsers++;
            const data = doc.data();
            if (data.hasPaid) {
                paidUsers++;
                paidNames.push(data.displayName || 'Un jugador');
                usersData.push({ id: doc.id, ...data }); 
            }
        });

        // Cálculos Financieros Reales
        const netPot = (paidUsers * ENTRY_FEE) * (1 - ADMIN_FEE_PERCENT);
        const prize1 = netPot * 0.70;
        const prize2 = netPot * 0.20;
        const prize3 = netPot * 0.05;

        const formatMoney = (amount) => new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0 }).format(amount);

        const upcomingMatches = matches
            .filter(m => m.status === 'SCHEDULED' || m.status === 'TIMED')
            .sort((a, b) => new Date(a.utcDate) - new Date(b.utcDate))
            .slice(0, 3);
        const upcomingText = upcomingMatches.map(m => `${m.homeTeam.name} vs ${m.awayTeam.name}`).join(" | ");

        let prompt = "";

        // ==========================================
        // 🧠 MODO 1: PRE-MUNDIAL (Expectativa pura)
        // ==========================================
        if (!isTournamentStarted) {
            const randomPaidNames = paidNames.sort(() => 0.5 - Math.random()).slice(0, 6).join(", ");

            prompt = `Eres el presentador principal de Sportscenter en ESPN. Faltan semanas para el Mundial y nuestra Polla oficial está en plena fase de inscripciones.
            
            Datos financieros y de sistema actuales:
            - Usuarios registrados totales: ${totalUsers}
            - Usuarios OFICIALES (Ya pagaron): ${paidUsers}
            - BOLSA TOTAL DE PREMIOS ACUMULADA HASTA AHORA: ${formatMoney(netPot)}
            - Premio estimado al 1er lugar actual: ${formatMoney(prize1)}
            - Jugadores destacados ya confirmados: ${randomPaidNames}
            - Primeros partidos: ${upcomingText}

            Instrucciones:
            1. Crea 5 titulares vibrantes para la marquesina de TV generando MUCHO HYPE.
            2. HABLA DEL DINERO: Menciona lo jugosa que está la bolsa acumulada (${formatMoney(netPot)}) y cuánto se llevaría el ganador hoy. Usa esto para motivar a los que faltan por pagar.
            3. Menciona los primeros partidos del Mundial que se vienen.
            4. REGLA DE ORO: NO inventes marcadores, puntos ni líderes porque el torneo no ha empezado.
            5. Usa prefijos como: "EXPECTATIVA:", "LA BOLSA:", "CUENTA REGRESIVA:", "MILLONES:", "PREVIA:".
            6. Devuelve ÚNICAMENTE un array JSON válido de strings.`;

        } 
        // ==========================================
        // 🧠 MODO 2: TORNEO ACTIVO (Goles, Ranking y Dinero en vivo)
        // ==========================================
        else {
            // Partidos en VIVO y Recientes (Usando la data Fusionada)
            const liveMatches = matches.filter(m => m.status === 'IN_PLAY' || m.status === 'PAUSED');
            const liveText = liveMatches.map(m => `EN VIVO: ${m.homeTeam.name} ${m.score?.fullTime?.home ?? 0} - ${m.score?.fullTime?.away ?? 0} ${m.awayTeam.name}`).join(" | ");

            const recentMatches = matches
                .filter(m => m.status === 'FINISHED')
                .sort((a, b) => new Date(b.utcDate) - new Date(a.utcDate))
                .slice(0, 3);
            const recentText = recentMatches.map(m => `${m.homeTeam.name} ${m.score?.fullTime?.home} - ${m.score?.fullTime?.away} ${m.awayTeam.name}`).join(" | ");

            // 1. LEER EL RANKING REAL QUE GUARDÓ REACT EN FIREBASE
            const liveRankingSnap = await db.collection("worldCupAdmin").doc("liveRanking").get();
            const livePointsMap = liveRankingSnap.exists ? liveRankingSnap.data().points || {} : {};

            // 2. Parsear datos de usuarios para el Top 5
            let parsedUsers = usersData.map(data => {
                let picks = [];
                [...liveMatches, ...recentMatches].forEach(m => {
                    const pred = data.predictions?.[m.id];
                    if (pred && pred.home !== '' && pred.away !== '') {
                        picks.push(`${m.homeTeam.name} ${pred.home}-${pred.away} ${m.awayTeam.name}`);
                    }
                });

                const knockout = data.knockoutPicks || {};
                const extras = data.extraPicks || {};
                const eventos = data.eventPicks || {};

                const campeon = knockout.campeon?.[0]?.name || 'Nadie';
                const subcampeon = knockout.subcampeon?.[0]?.name || 'Nadie';
                const semis = (knockout.semis || []).map(t => t.name).join(", ") || 'Ninguno';
                const cuartos = (knockout.cuartos || []).map(t => t.name).join(", ") || 'Ninguno';

                const extrasStr = Object.entries(extras)
                    .filter(([k, v]) => v && v !== '')
                    .map(([k, v]) => `${k.replace(/_/g, ' ')}: ${v}`)
                    .join(", ");

                const eventosSi = Object.entries(eventos)
                    .filter(([k, v]) => v === 'SI')
                    .map(([k]) => k.replace(/_/g, ' '));
                const eventosStr = eventosSi.length > 0 ? `| Eventos: ${eventosSi.join(", ")}` : '';

                return { 
                    name: data.displayName, 
                    points: livePointsMap[data.id] || 0, // Puntos Reales
                    picks: picks.join(", "),
                    campeon,
                    futuro: `Campeón: ${campeon} | Sub: ${subcampeon} | Semis: ${semis} | Cuartos: ${cuartos} | Extras (${extrasStr}) ${eventosStr}`
                };
            });
            
            parsedUsers.sort((a, b) => b.points - a.points);
            
            const top5 = parsedUsers.slice(0, 5).map((u, i) => {
                let premio = i === 0 ? prize1 : i === 1 ? prize2 : i === 2 ? prize3 : 0;
                return `#${i+1} ${u.name} (${u.points} pts) - Llevándose ${formatMoney(premio)} | Campeón apostado: ${u.campeon} | Marcadores actuales: ${u.picks || 'Nada'} | Predicciones locas: ${u.futuro}`;
            }).join(" \n ");

            prompt = `Eres el presentador estrella de Sportscenter en ESPN. El Mundial está EN JUEGO y tu trabajo es redactar 5 titulares deportivos impactantes para la marquesina de TV de nuestra Polla.
            
            Datos EN TIEMPO REAL:
            - BOLSA TOTAL EN JUEGO: ${formatMoney(netPot)}
            - MARCADORES EN VIVO AHORA MISMO: ${liveText || 'No hay partidos en juego en este instante.'}
            - ÚLTIMOS RESULTADOS FINALES: ${recentText || 'Aún no hay resultados.'}
            - RANKING TOP 5 Y LA PLATA QUE SE ESTÁN LLEVANDO AHORA: 
            ${top5}

            Instrucciones vitales:
            1. Si hay partidos EN VIVO, NARRA LA TENSIÓN: Habla de los goles actuales y cómo un gol más o menos puede hacerle perder ${formatMoney(prize1)} al líder actual.
            2. HABLA DE LA PLATA: Menciona al actual líder con nombre propio y el botín exacto que tiene en el bolsillo ahora mismo.
            3. EL MURO DEL VAR (Salseo en vivo): Dedica 1 o 2 titulares para burlarte con sarcasmo de las apuestas fallidas de los líderes en los partidos recientes o de sus predicciones locas a futuro.
            4. Tono: Épico, frenético de última hora, pero sumamente burlón/picante en el VAR.
            5. Usa SIEMPRE prefijos como "ALERTA GOL:", "EL BOTÍN:", "LIDERATO:", "BATACAZO:", "EL VAR:".
            6. PROHIBIDO mencionar que eres una IA.
            7. Devuelve ÚNICAMENTE un array JSON válido de strings.`;
        }

        const result = await model.generateContent(prompt);
        const titulares = JSON.parse(result.response.text().replace(/```json/g, "").replace(/```/g, "").trim());

        await db.collection("systemAdmin").doc("ai_news").set({
            titulares,
            lastUpdate: admin.firestore.FieldValue.serverTimestamp()
        });
        console.log(`Noticias ESPN actualizadas. Modo: ${!isTournamentStarted ? 'PRE-MUNDIAL' : 'TORNEO'}`);
        
    } catch (e) { console.error("Error IA:", e); }
}

// --- 1. DISPARADOR POR PARTIDOS (Cambios de estado O GOLES) ---
exports.onMatchUpdate = onDocumentUpdated("worldCupAdmin/apiCache", async (event) => {
    // Nota: Aunque actualicemos con apiCache, la función runAiNewsGeneration se encarga de leer el admin.
    console.log("Detectado cambio en API. Evaluando...");
    await runAiNewsGeneration();
});

// --- 2. DISPARADOR POR ACTUALIZACIÓN DE RANKING OFICIAL ---
exports.onRankingUpdate = onDocumentUpdated("worldCupAdmin/liveRanking", async (event) => {
    console.log("Ranking oficial actualizado desde React. Generando noticias...");
    await runAiNewsGeneration();
});

// --- 3. RELOJ INTELIGENTE (Ahorro de energía y Mantenimiento) ---
exports.generateespnnews = onSchedule({
    schedule: "*/5 9-23 * * *", 
    timeZone: "America/Bogota"
}, async (event) => {
    
    const settingsSnap = await db.collection("worldCupAdmin").doc("settings").get();
    const isTournamentStarted = settingsSnap.exists ? settingsSnap.data().predictionsClosed === true : false;
    
    const now = new Date();
    const minutes = now.getMinutes();

    if (!isTournamentStarted) {
        if (minutes < 5) {
            console.log("Modo Pre-Mundial: Generando boletín horario...");
            await runAiNewsGeneration();
        }
    } 
    else {
        // En modo torneo leemos api y admin para saber si corremos
        const apiCacheSnap = await db.collection("worldCupAdmin").doc("apiCache").get();
        const apiMatches = apiCacheSnap.exists ? (apiCacheSnap.data().matches || []) : [];
        
        const adminResultsSnap = await db.collection("worldCupAdmin").doc("results").get();
        const simStatuses = adminResultsSnap.exists ? (adminResultsSnap.data().simulation?.matchStatuses || {}) : {};

        const isAboutToStart = apiMatches.some(m => {
            const startTime = new Date(m.utcDate);
            const diffMinutes = (startTime - now) / (1000 * 60);
            return diffMinutes > 0 && diffMinutes <= 7;
        });

        // Revisamos si hay partidos en vivo (según API o simulación del Admin)
        const hasLiveMatches = apiMatches.some(m => {
            const finalStatus = simStatuses[m.id] && simStatuses[m.id] !== '' ? simStatuses[m.id] : m.status;
            return finalStatus === 'IN_PLAY' || finalStatus === 'PAUSED';
        });

        if (isAboutToStart || hasLiveMatches || minutes < 5) {
            console.log("Modo Torneo: Mantenimiento de noticias por reloj...");
            await runAiNewsGeneration();
        }
    }
    return null;
});

exports.onAdminResultsUpdate = onDocumentUpdated("worldCupAdmin/results", async (event) => {
    console.log("El Admin cambió un marcador manual. Generando noticias...");
    await runAiNewsGeneration();
});