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

                const ko = data.knockoutPicks || {};
                const campeon = ko.campeon?.[0]?.name || 'Ninguno';
                const subcampeon = ko.subcampeon?.[0]?.name || 'Ninguno';
                const tercero = ko.tercero?.[0]?.name || 'Ninguno';
                const cuarto = ko.cuarto?.[0]?.name || 'Ninguno';
                
                const extras = data.extraPicks ? Object.values(data.extraPicks).slice(0, 2).join(", ") : 'Ninguno';
                const futurePicks = `Campeón: ${campeon}, Subcampeón: ${subcampeon}, 3ro: ${tercero}, 4to: ${cuarto}. Apuestas extras clave: ${extras}`;

                return { 
                    name: data.displayName, 
                    points: livePointsMap[data.id] || 0, 
                    picks: picks.join(", "),
                    futurePicks: futurePicks
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

            // 🟢 SEPARAR LA TABLA EN BLOQUES ESTRATÉGICOS PARA LA IA
            const topPoints = parsedUsers[0]?.points || 0;
            const lideres = parsedUsers.filter(u => u.points === topPoints);
            const isSingleLeader = lideres.length === 1;
            const lideresStr = lideres.map(u => `${u.name} (${u.points} pts, Botín asegurado: ${formatMoney(u.premio)}) - Predicciones recientes: ${u.picks || 'Ninguna'} - APUESTAS FINALES Y EXTRAS: ${u.futurePicks}`).join(" | ");

            // 🌟 NUEVO: Los 5 perseguidores (Escoltas) y a cuánto están del líder
            const perseguidores = parsedUsers.slice(lideres.length, lideres.length + 5);
            const perseguidoresStr = perseguidores.map(u => {
                const diferencia = topPoints - u.points;
                return `Puesto #${u.calculatedRank}: ${u.name} (${u.points} pts, a ${diferencia} pts de la punta)`;
            }).join(" | ");

            const midIndex = Math.max(0, Math.floor(parsedUsers.length / 2) - 1);
            const mitadTabla = parsedUsers.slice(midIndex, midIndex + 3);
            const mitadStr = mitadTabla.map(u => `Puesto #${u.calculatedRank}: ${u.name} (${u.points} pts) - Predicciones recientes: ${u.picks || 'Ninguna'}`).join(" | ");

            const coleros = parsedUsers.slice(-3);
            const colerosStr = coleros.map(u => `Puesto #${u.calculatedRank}: ${u.name} (${u.points} pts) - Predicciones recientes: ${u.picks || 'Ninguna'}`).join(" | ");

            const targetMatch = liveMatches.length > 0 ? liveMatches[0] : (recentMatches.length > 0 ? recentMatches[0] : null);
            let exactGuessers = "Ningún jugador";
            let targetMatchInfo = "Ninguno";

            if (targetMatch) {
                const rH = targetMatch.score?.fullTime?.home;
                const rA = targetMatch.score?.fullTime?.away;
                targetMatchInfo = `${targetMatch.homeTeam.name} ${rH ?? 0} - ${rA ?? 0} ${targetMatch.awayTeam.name}`;
                
                if (rH !== undefined && rH !== null && rA !== undefined && rA !== null) {
                    const winners = [];
                    usersData.forEach(u => {
                        const p = u.predictions?.[targetMatch.id];
                        if (p && parseInt(p.home) === parseInt(rH) && parseInt(p.away) === parseInt(rA)) {
                            winners.push(u.displayName);
                        }
                    });
                    if (winners.length > 0) exactGuessers = winners.join(", ");
                }
            }

           prompt = `Eres el presentador estrella de Deportes (estilo Fernando Palomo). El Mundial está EN JUEGO y debes redactar 6 titulares deportivos impactantes y analíticos para nuestra Polla.
            
            ⚽ CONTEXTO DEL TORNEO AHORA MISMO:
            - BOLSA TOTAL REPARTIÉNDOSE: ${formatMoney(netPot)}
            - PARTIDOS EN VIVO: ${liveText || 'No hay partidos rodando.'}
            - ÚLTIMOS RESULTADOS: ${recentText || 'Aún no hay resultados.'}
            - PARTIDO DESTACADO (Para el Titular 1): ${targetMatchInfo}
            - JUGADORES QUE ACERTARON ESTE MARCADOR EXACTO: ${exactGuessers}
            
            📊 RADIOGRAFÍA DE LA TABLA (Menciona nombres reales de los participantes y sus puntos):
            - EN LA PUNTA: ${lideresStr}
            - 🌟 LOS ESCOLTAS (Inmediatos perseguidores): ${perseguidoresStr || 'Aún no hay escoltas definidos.'}
            - EN LA MITAD: ${mitadStr}
            - EN EL FONDO (Coleros): ${colerosStr}

            🚨 REGLAS ESTRICTAS E INQUEBRANTABLES:
            1. ESTADO DE LA PUNTA: ${isSingleLeader ? 'HAY UN LÍDER SOLITARIO Y ABSOLUTO. ESTÁ TOTALMENTE PROHIBIDO usar palabras como "empate en la punta", "comparten liderato" o "trancón".' : 'HAY VARIOS LÍDERES EMPATADOS. Narra la guerra total por dividir el premio.'}
            2. DISTRIBUCIÓN DE TEMAS EN LOS 6 TITULARES:
               - Titular 1: Analiza el "PARTIDO DESTACADO" y su marcador. Si hay "JUGADORES QUE ACERTARON ESTE MARCADOR EXACTO", menciónalos para felicitarlos. Si dice "Ningún jugador", búrlate diciendo que nadie lo vio venir. ¡NUNCA INVENTES NOMBRES que no estén en esa variable exacta!
               - Titular 2: Habla de los líderes, el dineral que se están embolsando (${formatMoney(netPot)} en juego) y MENCIONA A LOS ESCOLTAS que vienen respirándoles en la nuca, destacando a cuántos puntos exactos están de alcanzarlos para meter presión.
               - Titular 3: Habla del pelotón de la mitad de tabla y habla que van a ganar un premio de consolacion por quedar en la mitad.
               - Titular 4: Haz una broma deportiva con los coleros (el fondo de la tabla).
               - Titular 5: Un análisis general de Pollitamayo News sobre toda la fecha del dia.
               - Titular 6: DATOS CLAVE: Haz un análisis revelando a quiénes apostó el líder (o líderes) para extras, Campeón, Subcampeón, 3ro, 4to y posiciones finales. Usa la información de "APUESTAS FINALES Y EXTRAS" que te envié arriba en la sección de la punta.
            3. NUNCA reveles que eres una Inteligencia Artificial. Eres un periodista deportivo humano.
            4. NUNCA uses nombres de países en inglés. Todo debe estar en español impecable (Ej: Netherlands es Países Bajos, England es Inglaterra).
            5. Usa prefijos en mayúsculas como "EN VIVO:", "LA CIMA:", "EL PELOTÓN:", "ZONA DE DESCENSO:", "EL BOTÍN:","EL ORÁCULO:", "DATOS CLAVE:", "AL ACECHO:".
            6. Devuelve ÚNICAMENTE un array JSON válido de strings. No agregues nada más.
            7. El mundial es del 2026 de la FIFA`;
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

// =========================================================================
// 🚀 EL RADAR INMORTAL DE GOOGLE CLOUD (Autónomo + Heartbeat)
// =========================================================================
exports.generateespnnews = onSchedule({
    schedule: "*/2 9-23 * * *", // 🟢 Ejecutar cada 2 minutos
    timeZone: "America/Bogota"
}, async (event) => {
    const settingsSnap = await db.collection("worldCupAdmin").doc("settings").get();
    const isTournamentStarted = settingsSnap.exists ? settingsSnap.data().predictionsClosed === true : false;
    
    const now = new Date();
    const minutes = now.getMinutes();

    // 1. Si el Mundial no ha empezado, refresca la marquesina 1 vez por hora y muere.
    if (!isTournamentStarted) {
        if (minutes === 0) await runAiNewsGeneration();
        return null;
    }

    // 2. Revisar si el Administrador está activo en su navegador (Mecanismo de Latido)
    const presenceSnap = await db.collection("worldCupAdmin").doc("presence").get();
    const lastSeenStr = presenceSnap.exists ? presenceSnap.data().adminLastSeen : null;
    let isAdminOnline = false;

    if (lastSeenStr) {
        const diffSeconds = (now.getTime() - new Date(lastSeenStr).getTime()) / 1000;
        // Si el Admin reportó presencia hace menos de 70 segundos, está en línea
        if (diffSeconds < 70) {
            isAdminOnline = true;
        }
    }

    // 3. Leer la API Cachada y los resultados actuales en la DB
    const apiCacheSnap = await db.collection("worldCupAdmin").doc("apiCache").get();
    const apiMatches = apiCacheSnap.exists ? (apiCacheSnap.data().matches || []) : [];
    
    const adminResultsSnap = await db.collection("worldCupAdmin").doc("results").get();
    const adminResultsData = adminResultsSnap.exists ? adminResultsSnap.data() : {};
    const simStatuses = adminResultsData.simulation?.matchStatuses || {};
    const adminPreds = adminResultsData.predictions || {};
    const currentLocks = adminResultsData.lockedMatches || {};

    // 4. EL CEREBRO AUTÓNOMO: ¿Hay partido activo o partido que ya debió empezar?
    const currentTimeMs = now.getTime();
    const shouldActivateCloudRadar = apiMatches.some(m => {
        const finalStatus = simStatuses[m.id] && simStatuses[m.id] !== '' ? simStatuses[m.id] : m.status;
        
        // Gatillo A: La base de datos sabe que está rodando el balón
        if (finalStatus === 'IN_PLAY' || finalStatus === 'PAUSED') return true;

        // Gatillo B (El Salvavidas): Dice programado, pero la hora oficial ya fue superada
        if (finalStatus === 'SCHEDULED' || finalStatus === 'TIMED') {
            const matchStartTimeMs = new Date(m.utcDate).getTime();
            if (currentTimeMs >= matchStartTimeMs) {
                return true; 
            }
        }
        return false;
    });

    // 5. ÁRBOL DE DECISIÓN FINAL
    if (isAdminOnline) {
        console.log("🛡️ [Modo Ahorro] Admin en línea vigilando. Google Cloud en reposo.");
        // Solo publica noticias genéricas si es la hora en punto para que la app no parezca muerta
        if (minutes === 0) await runAiNewsGeneration();
        return null;
    }

    if (!isAdminOnline && shouldActivateCloudRadar) {
        console.log("☁️🚨 [Emergencia] ADMIN OFFLINE y partido en curso. ¡La Nube toma el control!");

        try {
            // 🔑 IMPORTANTE: Reemplaza este texto por tu API KEY real de Football-Data, 
            // o usa process.env.FOOTBALL_API_KEY si lo tienes configurado en Google Cloud.
            const FOOTBALL_API_KEY = process.env.FOOTBALL_API_KEY; 
            
            // Llamamos a la API Europea directamente desde el servidor
            // 🛡️ BLINDAJE DE CONEXIÓN: Reintentos y disfraz de navegador (User-Agent)
            let response;
            let retries = 3;
            
            while(retries > 0) {
                try {
                    response = await fetch("https://api.football-data.org/v4/competitions/WC/matches", {
                        headers: { 
                            "X-Auth-Token": FOOTBALL_API_KEY,
                            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
                            "Accept": "application/json"
                        }
                    });
                    if (response.ok) break; // Si respondió bien, salimos del bucle
                } catch (fetchError) {
                    console.warn(`⚠️ Intento fallido hacia la API (${4 - retries}/3). Motivo: ${fetchError.message}`);
                }
                retries--;
                if (retries > 0) await new Promise(res => setTimeout(res, 2000)); // Esperar 2 segudos antes de volver a tocar la puerta
            }
            
            if (!response || !response.ok) {
                throw new Error(`La API externa rechazó la conexión después de 3 intentos. Estado final: ${response?.status}`);
            }
            
            const data = await response.json();
            const freshMatches = data.matches;

            if (!freshMatches) return null;

            // Guardamos el nuevo listado oficial para la app
            await db.collection("worldCupAdmin").doc("apiCache").set({ matches: freshMatches }, { merge: true });

            let hasChanges = false;
            let dbPreds = { ...adminPreds };

            // Auditamos todos los marcadores en busca de Goles
            freshMatches.forEach(m => {
                if (currentLocks[m.id]) return; // Si el admin lo bloqueó manualmente, no lo tocamos

                const apiH = m.score?.fullTime?.home;
                const apiA = m.score?.fullTime?.away;

                // Si la API devolvió un marcador válido
                if (apiH !== null && apiH !== undefined) {
                    if (dbPreds[m.id]?.home !== apiH || dbPreds[m.id]?.away !== apiA) {
                        dbPreds[m.id] = { ...dbPreds[m.id], home: apiH, away: apiA };
                        hasChanges = true;
                    }
                }
            });

            if (hasChanges) {
                console.log("⚽ ¡GOL DETECTADO POR LA NUBE! Guardando y activando IA...");
                await db.collection("worldCupAdmin").doc("results").set({ predictions: dbPreds }, { merge: true });
                
                // Le damos 5 segundos de gracia a Firestore para re-calcular los puntos (Race Condition)
                await new Promise(resolve => setTimeout(resolve, 5000));
                
                await runAiNewsGeneration();
            } else {
                console.log("⏱️ Sin novedades en el marcador durante este minuto.");
            }

        } catch (err) {
            console.error("❌ Error en el Radar Autónomo de la Nube:", err);
        }

    } else if (minutes === 0) {
        console.log("💤 Torneo dormido y Admin desconectado. Refrescando boletín horario estándar.");
        await runAiNewsGeneration();
    }

    return null;
});

// 🟢 ESCUCHA EL TRIGER ULTRA-RÁPIDO DEL AUTO-SYNC O DEL MANUAL (Navegador Admin)
exports.onLiveTriggerUpdate = onDocumentUpdated("worldCupAdmin/trigger", async (event) => {
    console.log("🚨 ¡ALERTA DE GOL ENVIADA DESDE EL NAVEGADOR! Despertando a Gemini...");
    await runAiNewsGeneration();
});