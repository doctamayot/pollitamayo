const { onSchedule } = require("firebase-functions/v2/scheduler");
const admin = require("firebase-admin");
const { GoogleGenerativeAI } = require("@google/generative-ai");

admin.initializeApp();
const db = admin.firestore();

exports.generateespnnews = onSchedule({
    schedule: "0 9-23 * * *",
    timeZone: "America/Bogota"
}, async (event) => {
    try {
        const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
        const model = genAI.getGenerativeModel({ model: "gemini-3.1-flash-lite-preview" }); 

        // 1. OBTENER RANKING (Leaderboard)
        const usersSnap = await db.collection("worldCupPredictions").get();
        let usersData = [];
        usersSnap.forEach(doc => {
            const data = doc.data();
            if (data.hasPaid) {
               usersData.push({ name: data.displayName, points: data.totalPoints || 0 });
            }
        });
        usersData.sort((a, b) => b.points - a.points);
        const top5 = usersData.slice(0, 5).map(u => `${u.name} (${u.points} pts)`).join(", ");

        // 2. OBTENER PARTIDOS (Desde apiCache)
        const apiCacheSnap = await db.collection("worldCupAdmin").doc("apiCache").get();
        let recentResults = "No hay resultados recientes aún.";
        let upcomingMatches = "No hay partidos programados pronto.";

        if (apiCacheSnap.exists) {
            const matches = apiCacheSnap.data().matches || [];
            
            // Filtrar últimos resultados (partidos con goles definidos)
            const finished = matches
                .filter(m => m.score && m.score.fullTime.home !== null)
                .sort((a, b) => new Date(b.utcDate) - new Date(a.utcDate)) // Los más recientes primero
                .slice(0, 3)
                .map(m => `${m.homeTeam.name} ${m.score.fullTime.home} - ${m.score.fullTime.away} ${m.awayTeam.name}`)
                .join(" | ");
            
            if(finished) recentResults = finished;

            // Filtrar próximos partidos (partidos que no han empezado)
            const upcoming = matches
                .filter(m => m.score && m.score.fullTime.home === null)
                .sort((a, b) => new Date(a.utcDate) - new Date(b.utcDate)) // Los más cercanos primero
                .slice(0, 3)
                .map(m => `${m.homeTeam.name} vs ${m.awayTeam.name}`)
                .join(" | ");

            if(upcoming) upcomingMatches = upcoming;
        }

        // 3. EL SUPER PROMPT (Ahora con datos deportivos reales)
        const prompt = `
        Eres el editor jefe de Sportscenter en ESPN. Tu trabajo es redactar 5 titulares deportivos para la marquesina de TV.
        Usa estos datos REALES del torneo para ser preciso:

        RANKING DE LA POLLA (Líderes): ${top5}
        ÚLTIMOS RESULTADOS: ${recentResults}
        PRÓXIMOS PARTIDOS: ${upcomingMatches}
        
        Instrucciones:
        - Mezcla los datos. Habla de quién va ganando la polla, pero también de los resultados de los partidos o de la expectativa de los juegos que vienen.
        - Tono: Épico, profesional, estilo narrador deportivo.
        - Usa prefijos como "TENDENCIA:", "LIDERATO:", "RESULTADO:", "PREVIA:", "ALERTA:".
        - PROHIBIDO mencionar "IA", "Gemini" o "Bot".
        - Devuelve ÚNICAMENTE un array JSON: ["titular 1", "titular 2", "titular 3", "titular 4", "titular 5"]
        `;

        const result = await model.generateContent(prompt);
        const responseText = result.response.text();
        const cleanJson = responseText.replace(/```json/g, "").replace(/```/g, "").trim();
        const titulares = JSON.parse(cleanJson);

        await db.collection("systemAdmin").doc("ai_news").set({
            titulares: titulares,
            lastUpdate: admin.firestore.FieldValue.serverTimestamp()
        });

        console.log("Noticias ESPN actualizadas con datos de partidos:", titulares);
        return null;

    } catch (error) {
        console.error("Error en la generación de noticias:", error);
        return null;
    }
});