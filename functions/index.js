const { onDocumentUpdated } = require("firebase-functions/v2/firestore");
const { onSchedule } = require("firebase-functions/v2/scheduler");
const admin = require("firebase-admin");
const { GoogleGenerativeAI } = require("@google/generative-ai");

if (admin.apps.length === 0) admin.initializeApp();
const db = admin.firestore();

// --- FUNCIÓN MAESTRA DE GENERACIÓN (La lógica de la IA) ---
async function runAiNewsGeneration() {
    try {
        const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
        // 🚀 Modelo actualizado a la versión exacta que solicitaste
        const model = genAI.getGenerativeModel({ model: "gemini-3.1-flash-lite-preview" }); 

        // 1. Obtener Partidos de apiCache (Recientes y Próximos)
        const apiCacheSnap = await db.collection("worldCupAdmin").doc("apiCache").get();
        if (!apiCacheSnap.exists) return;

        const matches = apiCacheSnap.data().matches || [];
        
        const recentMatches = matches
            .filter(m => m.score?.fullTime?.home !== null)
            .sort((a, b) => new Date(b.utcDate) - new Date(a.utcDate))
            .slice(0, 2); // Últimos 2 partidos

        const upcomingMatches = matches
            .filter(m => m.score?.fullTime?.home === null)
            .sort((a, b) => new Date(a.utcDate) - new Date(b.utcDate))
            .slice(0, 2); // Próximos 2 partidos

        const recentText = recentMatches.map(m => `[ID: ${m.id}] ${m.homeTeam.name} ${m.score.fullTime.home} - ${m.score.fullTime.away} ${m.awayTeam.name}`).join(" | ");
        const upcomingText = upcomingMatches.map(m => `[ID: ${m.id}] ${m.homeTeam.name} vs ${m.awayTeam.name}`).join(" | ");

        // 2. Obtener Ranking y Predicciones EXACTAS de los Líderes
        const usersSnap = await db.collection("worldCupPredictions").get();
        let usersData = [];
        
        usersSnap.forEach(doc => {
            const data = doc.data();
            if (data.hasPaid) {
                // Extraemos qué apostó esta persona para los partidos que le mandaremos a la IA
                let picks = [];
                [...recentMatches, ...upcomingMatches].forEach(m => {
                    const pred = data.predictions?.[m.id];
                    if (pred && pred.home !== '' && pred.away !== '') {
                        picks.push(`${m.homeTeam.name} ${pred.home}-${pred.away} ${m.awayTeam.name}`);
                    }
                });
                
                usersData.push({ 
                    name: data.displayName, 
                    points: data.totalPoints || 0,
                    picks: picks.join(", ")
                });
            }
        });
        
        usersData.sort((a, b) => b.points - a.points);
        // Armamos el texto final de los usuarios mostrando sus apuestas
        const top5 = usersData.slice(0, 5).map(u => `${u.name} (${u.points} pts) [Predicciones hechas: ${u.picks || 'Ninguna'}]`).join(" \n ");

        // 3. EL SUPER PROMPT (Enriquecido para mezclar toda la información)
        const prompt = `Eres el presentador estrella de Sportscenter en ESPN. Tu trabajo es redactar 5 titulares deportivos para la marquesina de TV de nuestra Polla Mundialista.
        
        Aquí tienes los datos en tiempo real:
        - RANKING TOP 5 Y SUS PREDICCIONES DE LOS PARTIDOS DE HOY:
        ${top5}
        
        - ÚLTIMOS RESULTADOS REALES DEL MUNDIAL: 
        ${recentText || 'Aún no hay resultados.'}
        
        - PRÓXIMOS PARTIDOS DEL MUNDIAL: 
        ${upcomingText || 'Aún no hay partidos.'}

        Instrucciones:
        1. Mezcla TODO: Menciona cómo un resultado real afectó a los líderes, o qué predijeron los líderes para los próximos partidos. (Ejemplo: "BATACAZO: México empata y le arruina la predicción a Hugo, quien apostaba por la victoria azteca").
        2. Tono: Épico, analítico, picante, estilo narrador de fútbol de TV.
        3. Usa SIEMPRE prefijos con dos puntos para iniciar el titular (Ej: "LIDERATO:", "ALERTA:", "TENDENCIA:", "BATACAZO:", "PRONÓSTICO:").
        4. NUNCA menciones que eres una IA, ni uses la palabra "ID".
        5. Devuelve ÚNICAMENTE un array JSON válido de strings. Ejemplo: ["LIDERATO: texto", "BATACAZO: texto"]`;

        const result = await model.generateContent(prompt);
        const titulares = JSON.parse(result.response.text().replace(/```json/g, "").replace(/```/g, "").trim());

        await db.collection("systemAdmin").doc("ai_news").set({
            titulares,
            lastUpdate: admin.firestore.FieldValue.serverTimestamp()
        });
        console.log("Noticias actualizadas con éxito usando Gemini 3.1 Flash Lite Preview.");
    } catch (e) { console.error("Error IA:", e); }
}

// --- 1. DISPARADOR POR CAMBIO DE MARCADOR O ESTADO (En Vivo) ---
exports.onMatchUpdate = onDocumentUpdated("worldCupAdmin/apiCache", async (event) => {
    const beforeMatches = event.data.before.data().matches || [];
    const afterMatches = event.data.after.data().matches || [];

    const statusChanged = afterMatches.some((match, i) => {
        return beforeMatches[i] && match.status !== beforeMatches[i].status;
    });

    if (statusChanged) {
        console.log("Detectado cambio de estado en partido. Generando noticias...");
        await runAiNewsGeneration();
    }
});

// --- 2. RELOJ CADA 5 MINUTOS (Para la previa de 5 min y horas en punto) ---
exports.generateespnnews = onSchedule({
    schedule: "*/5 9-23 * * *", 
    timeZone: "America/Bogota"
}, async (event) => {
    const apiCacheSnap = await db.collection("worldCupAdmin").doc("apiCache").get();
    if (!apiCacheSnap.exists) return;

    const matches = apiCacheSnap.data().matches || [];
    const now = new Date();

    const isAboutToStart = matches.some(m => {
        const startTime = new Date(m.utcDate);
        const diffMinutes = (startTime - now) / (1000 * 60);
        return diffMinutes > 0 && diffMinutes <= 7;
    });

    if (isAboutToStart || now.getMinutes() < 5) {
        console.log("Partido cercano o actualización horaria. Ejecutando IA...");
        await runAiNewsGeneration();
    }
});