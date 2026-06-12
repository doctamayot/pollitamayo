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
        const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash-lite" }); 

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

        // 4. FUSIONAR: EL ADMIN MANDA SOBRE LA API OFICIAL
        const matches = apiMatches.map(m => {
            let newMatch = { ...m };
            
            if (simStatuses[m.id] && simStatuses[m.id] !== '') {
                newMatch.status = simStatuses[m.id];
            }

            const adm = adminPreds[m.id];
            const hasAdminScore = adm && adm.home !== undefined && adm.home !== '' && adm.away !== undefined && adm.away !== '';
            
            if (hasAdminScore) {
                if (!newMatch.score) newMatch.score = {};
                newMatch.score.fullTime = {
                    home: parseInt(adm.home, 10),
                    away: parseInt(adm.away, 10)
                };
                
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
                usersData.push({ ...data, id: doc.id }); 
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
            const liveMatches = matches.filter(m => m.status === 'IN_PLAY' || m.status === 'PAUSED');
            const liveText = liveMatches.map(m => `EN VIVO: ${m.homeTeam.name} ${m.score?.fullTime?.home ?? 0} - ${m.score?.fullTime?.away ?? 0} ${m.awayTeam.name}`).join(" | ");

            const recentMatches = matches
                .filter(m => m.status === 'FINISHED')
                .sort((a, b) => new Date(b.utcDate) - new Date(a.utcDate))
                .slice(0, 3);
            const recentText = recentMatches.map(m => `${m.homeTeam.name} ${m.score?.fullTime?.home} - ${m.score?.fullTime?.away} ${m.awayTeam.name}`).join(" | ");

            const liveRankingSnap = await db.collection("worldCupAdmin").doc("liveRanking").get();
            const livePointsMap = liveRankingSnap.exists ? liveRankingSnap.data().points || {} : {};

            let parsedUsers = usersData.map(data => {
                let picks = [];
                [...liveMatches, ...recentMatches].forEach(m => {
                    const pred = data.predictions?.[m.id];
                    if (pred && pred.home !== '' && pred.away !== '') {
                        picks.push(`${m.homeTeam.name} vs ${m.awayTeam.name} (Puso: ${pred.home}-${pred.away})`);
                    }
                });

                return { 
                    name: data.displayName, 
                    points: livePointsMap[data.id] || 0, 
                    picks: picks.join(", ")
                };
            });
            
            // Ordenar por puntos de mayor a menor
            parsedUsers.sort((a, b) => b.points - a.points);
            
            // 🟢 MATEMÁTICA DE EMPATES Y PREMIOS
            let currentRank = 1;
            let idx = 0;
            while (idx < parsedUsers.length) {
                const targetPoints = parsedUsers[idx].points;
                let tiedGroup = [];
                let j = idx;
                
                while (j < parsedUsers.length && parsedUsers[j].points === targetPoints) {
                    tiedGroup.push(parsedUsers[j]);
                    j++;
                }

                const count = tiedGroup.length;
                let combinedPrizePool = 0;
                
                for (let k = 0; k < count; k++) {
                    const slot = currentRank - 1 + k;
                    if (slot === 0) combinedPrizePool += prize1;
                    else if (slot === 1) combinedPrizePool += prize2;
                    else if (slot === 2) combinedPrizePool += prize3;
                }

                const sharedPayout = combinedPrizePool / count;

                for (let k = 0; k < count; k++) {
                    parsedUsers[idx + k].calculatedRank = currentRank;
                    parsedUsers[idx + k].premio = sharedPayout;
                    parsedUsers[idx + k].isTied = count > 1;
                }

                currentRank += count;
                idx = j;
            }

            // 🟢 SEPARAR LA TABLA EN 3 BLOQUES ESTRATÉGICOS PARA LA IA
            // 1. Líderes (La Punta)
            const topPoints = parsedUsers[0]?.points || 0;
            const lideres = parsedUsers.filter(u => u.points === topPoints);
            const isSingleLeader = lideres.length === 1;
            const lideresStr = lideres.map(u => `${u.name} (${u.points} pts, Botín asegurado: ${formatMoney(u.premio)}) - Predicciones recientes: ${u.picks || 'Ninguna'}`).join(" | ");

            // 2. Mitad de Tabla (El Pelotón)
            const midIndex = Math.max(0, Math.floor(parsedUsers.length / 2) - 1);
            const mitadTabla = parsedUsers.slice(midIndex, midIndex + 3);
            const mitadStr = mitadTabla.map(u => `Puesto #${u.calculatedRank}: ${u.name} (${u.points} pts) - Predicciones recientes: ${u.picks || 'Ninguna'}`).join(" | ");

            // 3. Coleros (El Fondo)
            const coleros = parsedUsers.slice(-3);
            const colerosStr = coleros.map(u => `Puesto #${u.calculatedRank}: ${u.name} (${u.points} pts) - Predicciones recientes: ${u.picks || 'Ninguna'}`).join(" | ");

            prompt = `Eres el presentador estrella de Sportscenter en ESPN (estilo Fernando Palomo). El Mundial está EN JUEGO y debes redactar 5 titulares deportivos impactantes y analíticos para nuestra Polla.
            
            ⚽ CONTEXTO DEL TORNEO AHORA MISMO:
            - BOLSA TOTAL REPARTIÉNDOSE: ${formatMoney(netPot)}
            - PARTIDOS EN VIVO: ${liveText || 'No hay partidos rodando.'}
            - ÚLTIMOS RESULTADOS: ${recentText || 'Aún no hay resultados.'}
            
            📊 RADIOGRAFÍA DE LA TABLA (Menciona nombres reales de los participantes y sus puntos):
            - EN LA PUNTA: ${lideresStr}
            - EN LA MITAD: ${mitadStr}
            - EN EL FONDO (Coleros): ${colerosStr}

            🚨 REGLAS ESTRICTAS E INQUEBRANTABLES:
            1. ESTADO DE LA PUNTA: ${isSingleLeader ? 'HAY UN LÍDER SOLITARIO Y ABSOLUTO. ESTÁ TOTALMENTE PROHIBIDO usar palabras como "empate en la punta", "comparten liderato" o "trancón".' : 'HAY VARIOS LÍDERES EMPATADOS. Narra la guerra total por dividir el premio.'}
            2. DISTRIBUCIÓN DE TEMAS EN LOS 5 TITULARES:
               - Titular 1: Analiza el partido actual/reciente, el marcador y menciona específicamente a un usuario que haya acertado o fallado su predicción (usa la data enviada).
               - Titular 2: Habla de los líderes y el dineral que se están embolsando (${formatMoney(netPot)} en juego).
               - Titular 3: Habla del pelotón de la mitad de tabla luchando por subir.
               - Titular 4: Haz una broma deportiva con los coleros (el fondo de la tabla).
               - Titular 5: Un análisis general de ESPN sobre la fecha y cómo un gol lo cambia todo.
            3. NUNCA reveles que eres una Inteligencia Artificial. Eres un periodista deportivo humano.
            4. NUNCA uses nombres de países en inglés. Todo debe estar en español impecable (Ej: Netherlands es Países Bajos, England es Inglaterra).
            5. Usa prefijos en mayúsculas como "EN VIVO:", "LA CIMA:", "EL PELOTÓN:", "ZONA DE DESCENSO:", "EL BOTÍN:", "EL VAR:".
            6. Devuelve ÚNICAMENTE un array JSON válido de strings. No agregues nada más.`;
            
        }

        const result = await model.generateContent(prompt);
        const rawText = result.response.text();

        const startBracket = rawText.indexOf('[');
        const endBracket = rawText.lastIndexOf(']') + 1;
        
        let titulares;
        if (startBracket !== -1 && endBracket !== -1) {
            titulares = JSON.parse(rawText.substring(startBracket, endBracket));
        } else {
            titulares = JSON.parse(rawText.replace(/```json/g, "").replace(/```/g, "").trim());
        }

        await db.collection("systemAdmin").doc("ai_news").set({
            titulares,
            lastUpdate: admin.firestore.FieldValue.serverTimestamp()
        });
        console.log(`Noticias ESPN actualizadas con éxito.`);
        
    } catch (e) { 
        console.error("Error crítico en IA detectado:", e); 
    }
}

// --- DISPARADORES ---
exports.generateespnnews = onSchedule({
    schedule: "*/5 9-23 * * *", // Revisa cada 5 minutos
    timeZone: "America/Bogota"
}, async (event) => {
    const settingsSnap = await db.collection("worldCupAdmin").doc("settings").get();
    const isTournamentStarted = settingsSnap.exists ? settingsSnap.data().predictionsClosed === true : false;
    
    const now = new Date();
    const minutes = now.getMinutes();

    // 1. Si el Mundial no ha empezado, refresca la marquesina 1 vez por hora (ej. 3:00, 4:00) y muere.
    if (!isTournamentStarted) {
        if (minutes === 0) await runAiNewsGeneration();
        return null;
    }

    // 2. Leer la API y los estados del Admin
    const apiCacheSnap = await db.collection("worldCupAdmin").doc("apiCache").get();
    const apiMatches = apiCacheSnap.exists ? (apiCacheSnap.data().matches || []) : [];
    const adminResultsSnap = await db.collection("worldCupAdmin").doc("results").get();
    const simStatuses = adminResultsSnap.exists ? (adminResultsSnap.data().simulation?.matchStatuses || {}) : {};

    // 3. Filtrar cuáles partidos están jugándose AHORA MISMO
    const liveMatches = apiMatches.filter(m => {
        const finalStatus = simStatuses[m.id] && simStatuses[m.id] !== '' ? simStatuses[m.id] : m.status;
        return finalStatus === 'IN_PLAY' || finalStatus === 'PAUSED';
    });

    // 4. Saber si hay algún partido en cuenta regresiva (a menos de 7 minutos de pitar el inicio)
    const isAboutToStart = apiMatches.some(m => {
        const startTime = new Date(m.utcDate);
        const diffMinutes = (startTime - now) / (1000 * 60);
        return diffMinutes > 0 && diffMinutes <= 7;
    });

    // 🧠 LA MAGIA DEL AHORRO: Tomar la "Fotografía" de los marcadores en este segundo exacto
    let currentStateString = liveMatches.map(m => {
        const home = m.score?.fullTime?.home ?? 0;
        const away = m.score?.fullTime?.away ?? 0;
        return `${m.id}:${home}-${away}`; // Esto crea un texto como: "partido1:1-0 | partido2:0-0"
    }).join("|");

    if (isAboutToStart) currentStateString += "|STARTING_SOON";

    // 5. Leer la fotografía que guardamos hace 5 minutos en la base de datos
    const stateDocRef = db.collection("systemAdmin").doc("match_state");
    const stateSnap = await stateDocRef.get();
    const lastStateString = stateSnap.exists ? stateSnap.data().lastState : "";

    // 6. LA GRAN DECISIÓN (SÍ Y SOLO SÍ)
    if (liveMatches.length > 0 || isAboutToStart) {
        // ¿Cambió el marcador comparado con hace 5 minutos?
        if (currentStateString !== lastStateString) {
            console.log("¡GOL O CAMBIO DETECTADO! Despertando a la IA...");
            await runAiNewsGeneration();
            await stateDocRef.set({ lastState: currentStateString }); // Guardamos la nueva foto para la próxima
        } else {
            console.log("El marcador no ha cambiado. Silenciando a Gemini para ahorrar dinero.");
        }
    } 
    // 7. Si no hay partidos hoy, mantén la app viva refrescando 1 vez cada hora en punto
    else if (minutes === 0) {
        await runAiNewsGeneration();
    }

    return null;
});

// 🟢 AHORA ESCUCHA EL TRIGER ULTRA-RÁPIDO DEL AUTO-SYNC O DEL MANUAL
exports.onLiveTriggerUpdate = onDocumentUpdated("worldCupAdmin/trigger", async (event) => {
    console.log("🚨 ¡ALERTA DE GOL O CAMBIO EN VIVO! Despertando a Gemini...");
    
    // Simplemente generamos las noticias con la Inteligencia Artificial (Gemini) sin enviar push
    await runAiNewsGeneration();
});