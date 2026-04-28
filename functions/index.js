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
                    // 1. Extraer marcadores cercanos
                    let picks = [];
                    [...recentMatches, ...upcomingMatches].forEach(m => {
                        const pred = data.predictions?.[m.id];
                        if (pred && pred.home !== '' && pred.away !== '') {
                            picks.push(`${m.homeTeam.name} ${pred.home}-${pred.away} ${m.awayTeam.name}`);
                        }
                    });

                    // 2. Extraer TODAS las predicciones a futuro dinámicamente
                    const knockout = data.knockoutPicks || {};
                    const extras = data.extraPicks || {};
                    const eventos = data.eventPicks || {};

                    const campeon = knockout.campeon?.[0]?.name || 'Nadie';
                    const subcampeon = knockout.subcampeon?.[0]?.name || 'Nadie';
                    const semis = (knockout.semis || []).map(t => t.name).join(", ") || 'Ninguno';
                    const cuartos = (knockout.cuartos || []).map(t => t.name).join(", ") || 'Ninguno';

                    // Convertir TODAS las preguntas Extras a un texto legible
                    const extrasStr = Object.entries(extras)
                        .filter(([k, v]) => v && v !== '')
                        .map(([k, v]) => `${k.replace(/_/g, ' ')}: ${v}`)
                        .join(", ");

                    // Convertir TODOS los Eventos Especiales (Solo los que apostó que "SI")
                    const eventosSi = Object.entries(eventos)
                        .filter(([k, v]) => v === 'SI')
                        .map(([k]) => k.replace(/_/g, ' '));
                    const eventosStr = eventosSi.length > 0 ? `| Eventos que jura que pasarán: ${eventosSi.join(", ")}` : '';

                    usersData.push({ 
                        name: data.displayName, 
                        points: data.totalPoints || 0, 
                        picks: picks.join(", "),
                        futuro: `Campeón: ${campeon} | Subcampeón: ${subcampeon} | Semis: ${semis} | Cuartos: ${cuartos} | Extras (${extrasStr}) ${eventosStr}`
                    });
                }
            });
            
            usersData.sort((a, b) => b.points - a.points);
            const top5 = usersData.slice(0, 5).map(u => `${u.name} (${u.points} pts) [Marcadores: ${u.picks || 'Nada'}] [Predicciones Generales: ${u.futuro}]`).join(" \n ");

            prompt = `Eres el presentador estrella de Sportscenter en ESPN. El Mundial ya empezó y tu trabajo es redactar 5 titulares deportivos impactantes para la marquesina de TV de nuestra Polla.
            
            Datos en tiempo real de la jornada:
            - RANKING TOP 5 DE LA POLLA Y SUS PRONÓSTICOS (Marcadores y Torneo): 
            ${top5}
            
            - ÚLTIMOS RESULTADOS REALES DEL MUNDIAL: 
            ${recentText || 'Aún no hay resultados finales.'}
            
            - PRÓXIMOS PARTIDOS DEL MUNDIAL: 
            ${upcomingText || 'Aún no hay partidos.'}

            Instrucciones vitales:
            1. Saca conclusiones cruzadas: Compara los "Resultados Reales" con los "Marcadores" que pronosticó el Top 5. ¿Alguien le atinó?
            2. Analiza el futuro de los líderes: Revisa a fondo la sección "Predicciones Generales". Si un líder va de primero pero tiene predicciones absurdas o arriesgadas (ej: en Cuartos, Semis, en preguntas Extras o Eventos locos), exponlo públicamente.
            3. EL MURO DEL VAR (Salseo en vivo): Dedica al menos 2 de los 5 titulares a simular "El Muro del VAR". Usa este espacio para burlarte con sarcasmo de los que perdieron puntos en marcadores recientes, o para cuestionar las apuestas generales del líder (ej. "El VAR revisa la quiniela de Hugo... ¿De verdad cree que habrá una roja en el banquillo y que el goleador será de Ecuador?").
            4. Tono: Épico, analítico, estadístico, pero sumamente burlón/picante en la sección del VAR.
            5. Usa SIEMPRE prefijos como "LIDERATO:", "ALERTA:", "BATACAZO:", "PRONÓSTICO:", "EL VAR:", "CHAT:", "EL ORÁCULO:".
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