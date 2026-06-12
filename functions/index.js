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
                    points: livePointsMap[data.id] || 0, 
                    picks: picks.join(", "),
                    campeon,
                    futuro: `Campeón: ${campeon} | Sub: ${subcampeon} | Semis: ${semis} | Cuartos: ${cuartos} | Extras (${extrasStr}) ${eventosStr}`
                };
            });
            
            // Ordenar por puntos de mayor a menor
            parsedUsers.sort((a, b) => b.points - a.points);
            
            // 🟢 MATEMÁTICA DE EMPATES: Distribución justa de premios reales
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

            // 🔥 SOLUCIÓN AL CORTE: Expandir el Top de forma dinámica si hay un empate masivo
            let dynamicLimit = 5;
            if (parsedUsers.length > dynamicLimit) {
                const cutoffPoints = parsedUsers[dynamicLimit - 1].points;
                while (dynamicLimit < parsedUsers.length && parsedUsers[dynamicLimit].points === cutoffPoints) {
                    dynamicLimit++;
                }
            }

            // Datos específicos de la cima para darle contexto brutal a la IA
            const maxPointsInTorneo = parsedUsers[0]?.points || 0;
            const totalLideresReales = parsedUsers.filter(u => u.points === maxPointsInTorneo).length;

            const topDynamicList = parsedUsers.slice(0, dynamicLimit).map((u) => {
                const empateTexto = u.isTied ? `(EMPATE en el puesto #${u.calculatedRank})` : `(Puesto #${u.calculatedRank})`;
                return `${empateTexto} ${u.name} con ${u.points} pts - Asegurando un botín de ${formatMoney(u.premio)} | Campeón apostado: ${u.campeon} | Marcadores: ${u.picks || 'Ninguno'} | Futuro: ${u.futuro}`;
            }).join(" \n ");

            prompt = `Eres el presentador estrella de Sportscenter en ESPN. El Mundial está EN JUEGO y tu trabajo es redactar 5 titulares deportivos impactantes para la marquesina de TV de nuestra Polla.
            
            Datos EN TIEMPO REAL:
            - BOLSA TOTAL EN JUEGO: ${formatMoney(netPot)}
            - MARCADORES EN VIVO AHORA MISMO: ${liveText || 'No hay partidos en juego en este instante.'}
            - ÚLTIMOS RESULTADOS FINALES: ${recentText || 'Aún no hay resultados.'}
            - ALERTA DE TRANCÓN EN LA PUNTA: ¡Hay exactamente ${totalLideresReales} personas empatadas en el PRIMER LUGAR con ${maxPointsInTorneo} puntos!
            - LISTADO DE JUGADORES CLAVE (CON EMPATES Y PREMIOS YA CALCULADOS): 
            ${topDynamicList}

            Instrucciones vitales:
            1. REGLA DE ORO PARA EL EMPATE MASIVO: Si el número de líderes en la punta es enorme (como ${totalLideresReales} personas), EXÁGERALO con humor en los titulares. Llama a esto "un trancón histórico", "un empate de película", o "guerra total en el liderato". Explica que en este momento el gran botín se está dividiendo en partes milimétricas entre un montón de gente.
            2. Si hay partidos EN VIVO, NARRA LA TENSIÓN: Habla de cómo un solo gol va a desatar el caos total, destruyendo el empate de los ${totalLideresReales} líderes y enviando a la mitad al abismo.
            3. HABLA DE LA PLATA: Usa los nombres del listado y los montos exactos de dinero calculados.
            4. EL MURO DEL VAR (Salseo en vivo): Dedica titulares para hacer bromas picantes sobre las predicciones de los líderes.
            5. Usa prefijos como "TRANCÓN HISTÓRICO:", "ALERTA DE GOL:", "CIMA COMPARTIDA:", "EL BOTÍN:", "EL VAR:".
            6. Devuelve ÚNICAMENTE un array JSON válido de strings.
            7. Por ningun motivo debes dar nombres de paises en ingles, siempre en español todo`;
            
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

// El disparador manual del Admin sigue intacto (Momento 1)
// 🟢 AHORA ESCUCHA EL TRIGER ULTRA-RÁPIDO DEL AUTO-SYNC O DEL MANUAL
exports.onLiveTriggerUpdate = onDocumentUpdated("worldCupAdmin/trigger", async (event) => {
    console.log("🚨 ¡ALERTA DE GOL O CAMBIO EN VIVO! Despertando a Gemini...");
    
    // Simplemente generamos las noticias con la Inteligencia Artificial (Gemini) sin enviar push
    await runAiNewsGeneration();
});