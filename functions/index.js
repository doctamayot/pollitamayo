const { onDocumentUpdated } = require("firebase-functions/v2/firestore");
const { onSchedule } = require("firebase-functions/v2/scheduler");
const admin = require("firebase-admin");
const { GoogleGenerativeAI } = require("@google/generative-ai");

if (admin.apps.length === 0) admin.initializeApp();
const db = admin.firestore();

// --- FUNCIÓN MAESTRA DE GENERACIÓN (La IA Deportiva) ---
async function runAiNewsGeneration() {
    try {
        const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
        const model = genAI.getGenerativeModel({ model: "gemini-3.1-flash-lite-preview" }); 

        // 1. OBTENER ESTADO DEL TORNEO
        const settingsSnap = await db.collection("worldCupAdmin").doc("settings").get();
        const isTournamentStarted = settingsSnap.exists ? settingsSnap.data().predictionsClosed === true : false;

        // 2. OBTENER PARTIDOS (Desde apiCache)
        const apiCacheSnap = await db.collection("worldCupAdmin").doc("apiCache").get();
        const matches = apiCacheSnap.exists ? (apiCacheSnap.data().matches || []) : [];
        
        const upcomingMatches = matches
            .filter(m => m.score?.fullTime?.home === null)
            .sort((a, b) => new Date(a.utcDate) - new Date(b.utcDate))
            .slice(0, 3);
        const upcomingText = upcomingMatches.map(m => `[ID: ${m.id}] ${m.homeTeam.name} vs ${m.awayTeam.name}`).join(" | ");

        let prompt = "";

        // ==========================================
        // 🧠 MODO 1: PRE-MUNDIAL (Expectativa pura)
        // ==========================================
        if (!isTournamentStarted) {
            const usersSnap = await db.collection("worldCupPredictions").get();
            let totalUsers = 0;
            let paidUsers = 0;
            let paidNames = [];

            usersSnap.forEach(doc => {
                totalUsers++;
                const data = doc.data();
                if (data.hasPaid) {
                    paidUsers++;
                    paidNames.push(data.displayName || 'Un jugador');
                }
            });

            const randomPaidNames = paidNames.sort(() => 0.5 - Math.random()).slice(0, 6).join(", ");

            prompt = `Eres el presentador principal de Sportscenter en ESPN. Faltan semanas para el Mundial y nuestra Polla oficial está en plena fase de inscripciones y calentamiento.
            
            Datos actuales en el sistema:
            - Usuarios registrados: ${totalUsers}
            - Usuarios que YA PAGARON y están oficiales: ${paidUsers}
            - Jugadores destacados ya confirmados (con pago): ${randomPaidNames}
            - Primeros partidos del Mundial: ${upcomingText}

            Instrucciones:
            1. Crea 5 titulares vibrantes para la marquesina (el banner rodante de TV) generando MUCHO HYPE.
            2. Analiza los números: Celebra a los que ya pagaron su cupo y mete un poco de presión amistosa y picante a los que están registrados pero aún no sueltan el dinero.
            3. Menciona la tensión previa a los primeros partidos del Mundial que se vienen.
            4. REGLA DE ORO: NO inventes marcadores, puntos ni líderes porque el torneo no ha empezado.
            5. Usa SIEMPRE uno de estos prefijos antes del texto: "EXPECTATIVA:", "INSCRIPCIONES:", "CUENTA REGRESIVA:", "PREVIA:", "OFICIAL:", "RUMOR:".
            6. NUNCA reveles que eres una IA. Eres un periodista deportivo.
            7. Devuelve ÚNICAMENTE un array JSON válido de strings.`;

        } 
        // ==========================================
        // 🧠 MODO 2: TORNEO ACTIVO (Análisis Profundo)
        // ==========================================
        else {
            const recentMatches = matches
                .filter(m => m.score?.fullTime?.home !== null)
                .sort((a, b) => new Date(b.utcDate) - new Date(a.utcDate))
                .slice(0, 3); // Aumentamos a 3 para más contexto
            const recentText = recentMatches.map(m => `[ID: ${m.id}] ${m.homeTeam.name} ${m.score.fullTime.home} - ${m.score.fullTime.away} ${m.awayTeam.name}`).join(" | ");

            const usersSnap = await db.collection("worldCupPredictions").get();
            let usersData = [];
            usersSnap.forEach(doc => {
                const data = doc.data();
                if (data.hasPaid) {
                    let picks = [];
                    [...recentMatches, ...upcomingMatches].forEach(m => {
                        const pred = data.predictions?.[m.id];
                        if (pred && pred.home !== '' && pred.away !== '') {
                            picks.push(`${m.homeTeam.name} ${pred.home}-${pred.away} ${m.awayTeam.name}`);
                        }
                    });
                    usersData.push({ name: data.displayName, points: data.totalPoints || 0, picks: picks.join(", ") });
                }
            });
            
            usersData.sort((a, b) => b.points - a.points);
            const top5 = usersData.slice(0, 5).map(u => `${u.name} (${u.points} pts) [Pronosticó: ${u.picks || 'Nada'}]`).join(" \n ");

            prompt = `Eres el presentador estrella de Sportscenter en ESPN. El Mundial ya empezó y tu trabajo es redactar 5 titulares deportivos impactantes para la marquesina de TV de nuestra Polla.
            
            Datos en tiempo real de la jornada:
            - RANKING TOP 5 DE LA POLLA Y SUS PRONÓSTICOS: 
            ${top5}
            
            - ÚLTIMOS RESULTADOS REALES DEL MUNDIAL: 
            ${recentText || 'Aún no hay resultados finales.'}
            
            - PRÓXIMOS PARTIDOS DEL MUNDIAL: 
            ${upcomingText || 'Aún no hay partidos.'}

           Instrucciones vitales:
            1. Saca conclusiones cruzadas: Compara los "Resultados Reales" con lo que "Pronosticó" el Top 5. ¿Alguien le atinó al marcador exacto?
            2. Analiza los "Próximos partidos" y expón al público qué predicciones hicieron los líderes para esos encuentros.
            3. EL MURO DEL VAR (Salseo en vivo): Dedica al menos 2 de los 5 titulares a simular "El Muro del VAR". Estos deben ser mensajes directos, sarcásticos y picantes como si el VAR estuviera revisando las predicciones y burlándose de quienes perdieron puntos por un gol, o alabando una predicción arriesgada. 
            4. Tono: Épico, analítico, y sumamente burlón/picante en la sección del VAR.
            5. Usa SIEMPRE prefijos como "LIDERATO:", "ALERTA:", "BATACAZO:", "PRONÓSTICO:", "EL VAR:", "CHAT:".
            6. PROHIBIDO mencionar que eres una IA o usar la palabra "ID".
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

// --- 1. DISPARADOR POR EVENTOS (Para el Mundial en Vivo) ---
exports.onMatchUpdate = onDocumentUpdated("worldCupAdmin/apiCache", async (event) => {
    const beforeMatches = event.data.before?.data()?.matches || [];
    const afterMatches = event.data.after?.data()?.matches || [];

    const statusChanged = afterMatches.some((match, i) => {
        return beforeMatches[i] && match.status !== beforeMatches[i].status;
    });

    if (statusChanged) {
        console.log("Detectado cambio de estado en partido. Generando noticias instantáneas...");
        await runAiNewsGeneration();
    }
});

// --- 2. RELOJ INTELIGENTE (Ahorro de energía en Pre-Mundial) ---
exports.generateespnnews = onSchedule({
    schedule: "*/5 9-23 * * *", 
    timeZone: "America/Bogota"
}, async (event) => {
    
    const settingsSnap = await db.collection("worldCupAdmin").doc("settings").get();
    const isTournamentStarted = settingsSnap.exists ? settingsSnap.data().predictionsClosed === true : false;
    
    const now = new Date();
    const minutes = now.getMinutes();

    if (!isTournamentStarted) {
        // MODO PRE-MUNDIAL: Solo en punto de la hora (Minutos 0 al 4)
        if (minutes < 5) {
            console.log("Modo Pre-Mundial: Generando boletín horario...");
            await runAiNewsGeneration();
        } else {
            return null; // Ahorro de créditos
        }
    } 
    else {
        // MODO TORNEO: Radar activo cada 5 minutos
        const apiCacheSnap = await db.collection("worldCupAdmin").doc("apiCache").get();
        const matches = apiCacheSnap.exists ? (apiCacheSnap.data().matches || []) : [];

        const isAboutToStart = matches.some(m => {
            const startTime = new Date(m.utcDate);
            const diffMinutes = (startTime - now) / (1000 * 60);
            return diffMinutes > 0 && diffMinutes <= 7;
        });

        if (isAboutToStart || minutes < 5) {
            console.log("Modo Torneo: Generando noticias por partido cercano o boletín horario...");
            await runAiNewsGeneration();
        }
    }
    return null;
});