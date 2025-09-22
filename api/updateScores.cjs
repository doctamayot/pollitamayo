
const admin = require('firebase-admin');

const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
if (!admin.apps.length) {
  admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
}
const db = admin.firestore();

module.exports = async (request, response) => {
  console.log('Iniciando Cron Job: updateScores...');

  // --- ▼▼▼ RUTA DEL SEMÁFORO ACTUALIZADA ▼▼▼ ---
  const lockRef = db.collection('settings').doc('liveUpdates');
  const lockDoc = await lockRef.get();
  if (lockDoc.exists && lockDoc.data().isLockedByAdmin) {
    console.log('Cron Job en pausa: el admin tiene el control.');
    return response.status(200).send('Pausado por el admin.');
  }

  try {
    // ... (El resto de la función no cambia)
    const quinielasRef = db.collection('quinielas');
    const snapshot = await quinielasRef.where('isActive', '==', true).where('isClosed', '==', false).get();
    if (snapshot.empty) {
      return response.status(200).send('No hay quinielas activas para actualizar.');
    }
    const allMatchIds = new Set();
    const activeQuinielas = [];
    snapshot.forEach(doc => {
      const quiniela = { id: doc.id, ...doc.data() };
      activeQuinielas.push(quiniela);
      quiniela.matches.forEach(match => {
        if (typeof match.id === 'number') allMatchIds.add(match.id);
      });
    });
    if (allMatchIds.size === 0) {
        return response.status(200).send('No hay partidos con IDs de API.');
    }
    const apiKey = process.env.VITE_FOOTBALL_DATA_API_KEY;
    const matchIdsString = [...allMatchIds].join(',');
    const apiUrl = `https://api.football-data.org/v4/matches?ids=${matchIdsString}`;
    const apiResponse = await fetch(apiUrl, { headers: { 'X-Auth-Token': apiKey } });
    if (!apiResponse.ok) throw new Error(`API de fútbol devolvió error: ${apiResponse.statusText}`);
    const apiData = await apiResponse.json();
    const liveResults = {};
    apiData.matches.forEach(match => {
        if (match.status === 'IN_PLAY' || match.status === 'PAUSED' || match.status === 'FINISHED') {
            liveResults[match.id] = {
                home: match.score.fullTime.home?.toString() || '0',
                away: match.score.fullTime.away?.toString() || '0',
            };
        }
    });
    const batch = db.batch();
    activeQuinielas.forEach(quiniela => {
      const quinielaRef = db.collection('quinielas').doc(quiniela.id);
      const resultsForThisQuiniela = {};
      quiniela.matches.forEach(match => {
        if (liveResults[match.id]) resultsForThisQuiniela[match.id] = liveResults[match.id];
      });
      if (Object.keys(resultsForThisQuiniela).length > 0) {
        batch.set(quinielaRef, { realResults: resultsForThisQuiniela }, { merge: true });
      }
    });
    await batch.commit();
    return response.status(200).send('Resultados actualizados por Cron Job.');
  } catch (error) {
    console.error('Error en el Cron Job updateScores:', error);
    return response.status(500).send('Error interno en la función.');
  }
};