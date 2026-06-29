const { onDocumentUpdated } = require("firebase-functions/v2/firestore");
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
        const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" }); 

        // 1. OBTENER ESTADO DEL TORNEO
        const settingsSnap = await db.collection("worldCupAdmin").doc("settings").get();
        const isTournamentStarted = settingsSnap.exists ? settingsSnap.data().predictionsClosed === true : false;

        // 2. LEER LA VERDAD ABSOLUTA DEL ADMIN (SIN API)
        const adminResultsSnap = await db.collection("worldCupAdmin").doc("results").get();
        const adminResultsData = adminResultsSnap.exists ? adminResultsSnap.data() : {};
        const adminPreds = adminResultsData.predictions || {};
        const simStatuses = adminResultsData.simulation?.matchStatuses || {};

        // 3. OBTENER EL DICCIONARIO DE EQUIPOS Y ESTRUCTURA DE LA API (SOLO COMO PLANTILLA BÁSICA)
        const apiCacheSnap = await db.collection("worldCupAdmin").doc("apiCache").get();
        const apiMatchesTemplate = apiCacheSnap.exists ? (apiCacheSnap.data().matches || []) : [];

        // 4. CONSTRUIR LOS PARTIDOS BASADOS ESTRICTAMENTE EN EL ADMIN
        const matches = apiMatchesTemplate.map(m => {
            let newMatch = { ...m };
            
            // Sobrescribimos el status con lo que diga el simulador del Admin
            if (simStatuses[m.id] && simStatuses[m.id] !== '') {
                newMatch.status = simStatuses[m.id];
            } else {
                // Si no hay status manual, asumimos 'SCHEDULED' por defecto para evitar errores
                newMatch.status = 'SCHEDULED';
            }

            // 🛑 LEY DE HIERRO: Solo existen goles si el Admin los tecleó (!isNaN)
            const adm = adminPreds[m.id];
            const hasAdminScore = adm && adm.home !== undefined && adm.home !== '' && adm.away !== undefined && adm.away !== '';
            
            if (hasAdminScore) {
                const hScore = parseInt(adm.home, 10);
                const aScore = parseInt(adm.away, 10);
                
                if (!isNaN(hScore) && !isNaN(aScore)) {
                    if (!newMatch.score) newMatch.score = {};
                    newMatch.score.fullTime = { home: hScore, away: aScore };
                    
                    // Si el Admin le puso marcador y no tiene status manual, lo damos por finalizado
                    if (!simStatuses[m.id] || simStatuses[m.id] === '') {
                        newMatch.status = 'FINISHED';
                    }
                }
            } else {
                // Si el Admin no le ha puesto goles, ELIMINAMOS cualquier basura que venga de la API
                if (newMatch.score) {
                    newMatch.score.fullTime = { home: null, away: null };
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
           const liveMatches = matches.filter(m => 
                (m.status === 'IN_PLAY' || m.status === 'PAUSED') && 
                m.score?.fullTime?.home !== undefined && m.score?.fullTime?.home !== null
            );
            const liveText = liveMatches.map(m => `EN VIVO: ${m.homeTeam.name} ${m.score.fullTime.home} - ${m.score.fullTime.away} ${m.awayTeam.name}`).join(" | ");

            const recentMatches = matches
                .filter(m => 
                    m.status === 'FINISHED' && 
                    m.score?.fullTime?.home !== undefined && m.score?.fullTime?.home !== null
                )
                .sort((a, b) => new Date(b.utcDate) - new Date(a.utcDate))
                .slice(0, 3);
            const recentText = recentMatches.map(m => `${m.homeTeam.name} ${m.score.fullTime.home} - ${m.score.fullTime.away} ${m.awayTeam.name}`).join(" | ");

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
                
                // 🟢 NUEVO BLOQUE: Extracción dinámica y aleatoria
                let randomExtras = 'Ninguna';
                if (data.extraPicks) {
                    const extraEntries = Object.entries(data.extraPicks);
                    // Barajamos las opciones y sacamos 2 al azar cada vez que el radar se dispara
                    const shuffled = extraEntries.sort(() => 0.5 - Math.random()).slice(0, 2);
                    randomExtras = shuffled.map(([key, val]) => `${key.replace(/_/g, ' ')}: ${val}`).join(", ");
                }
                const futurePicks = `Candidatos en su radar: Campeón ${campeon}, Subcampeón ${subcampeon}. Apuestas extras reveladas en este reporte: ${randomExtras}`;

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

            // 2. EL PARTIDO DESTACADO SIN ERRORES DE 0-0
            const targetMatch = liveMatches.length > 0 ? liveMatches[0] : (recentMatches.length > 0 ? recentMatches[0] : null);
            let exactGuessers = "Ningún jugador";
            let targetMatchInfo = "Ninguno";

            if (targetMatch) {
                const rH = targetMatch.score?.fullTime?.home;
                const rA = targetMatch.score?.fullTime?.away;
                
                // Si el marcador existe de verdad, armamos la información
                if (rH !== undefined && rH !== null && rA !== undefined && rA !== null) {
                    targetMatchInfo = `${targetMatch.homeTeam.name} ${rH} - ${rA} ${targetMatch.awayTeam.name}`;
                    
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
               - Titular 6: EL FOCO EN EL LÍDER: Sé dinámico, impredecible y analítico. Elige SOLO UNA de estas opciones para analizar al líder hoy (asegúrate de variar tu elección respecto a reportes pasados):
                 Opción A) Analiza y opina sobre su candidato a Campeón o Subcampeón. ¿Le ves futuro?
                 Opción B) Sorpréndete o debate las "apuestas extras reveladas" en sus datos.
                 Opción C) Comenta su rendimiento específico en los marcadores de los partidos en vivo o recientes.
                 ¡ESTÁ ESTRICTAMENTE PROHIBIDO HACER UN LISTADO! No menciones todas las opciones. Construye un solo comentario periodístico enfocado en UN solo tema para mantener la frescura de la transmisión.
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

// 🟢 ESCUCHA EL TRIGER ULTRA-RÁPIDO DEL AUTO-SYNC O DEL MANUAL (Navegador Admin)
exports.onLiveTriggerUpdate = onDocumentUpdated("worldCupAdmin/trigger", async (event) => {
    console.log("🚨 ¡ALERTA DE GOL ENVIADA DESDE EL NAVEGADOR! Despertando a Gemini...");
    await runAiNewsGeneration();
});