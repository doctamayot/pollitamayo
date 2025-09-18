// Ya no necesitamos la clave de API aquí, porque la usará el servidor.
const API_SERVERLESS_URL = '/api/football'; 

// Ya no necesitamos los headers aquí.
// const headers = { 'X-Auth-Token': API_KEY };

const RELEVANT_COMPETITIONS = ['CL', 'PL', 'BL1', 'SA', 'PD', 'FL1', 'WC'];

export const getCompetitions = async () => {
    // Ahora llamamos a nuestra propia función serverless
    const response = await fetch(`${API_SERVERLESS_URL}?path=competitions`);
    if (!response.ok) throw new Error('Error al obtener las competiciones.');
    const data = await response.json();
    
    return data.competitions
                .map(comp => ({ id: comp.id, name: comp.name, emblem: comp.emblem }));
};

export const getMatchesByCompetition = async (competitionId) => {
    if (!competitionId) return [];
    const response = await fetch(`${API_SERVERLESS_URL}?path=competitions/${competitionId}/matches?status=SCHEDULED`);
    if (!response.ok) throw new Error('Error al obtener los partidos.');
    const data = await response.json();
    
    return data.matches.map(match => ({
        id: match.id,
        date: match.utcDate,
        venue: match.venue,
        homeTeam: { id: match.homeTeam.id, name: match.homeTeam.name, crest: match.homeTeam.crest, tla: match.homeTeam.tla },
        awayTeam: { id: match.awayTeam.id, name: match.awayTeam.name, crest: match.awayTeam.crest, tla: match.awayTeam.tla }
    }));
};

export const getLiveResultsByIds = async (matchIds) => {
    if (!matchIds || matchIds.length === 0) return {};
    const response = await fetch(`${API_SERVERLESS_URL}?path=matches?ids=${matchIds.join(',')}`);
    if (!response.ok) throw new Error('Error al obtener los resultados en vivo.');
    const data = await response.json();

    const resultsMap = {};
    data.matches.forEach(match => {
        if (match.status === 'IN_PLAY' || match.status === 'PAUSED' || match.status === 'FINISHED') {
            resultsMap[match.id] = {
                home: match.score.fullTime.home?.toString() || '0',
                away: match.score.fullTime.away?.toString() || '0',
            };
        }
    });
    return resultsMap;
};

export const getStandings = async (competitionId) => {
    if (!competitionId) return [];
    const response = await fetch(`${API_SERVERLESS_URL}?path=competitions/${competitionId}/standings`);
    if (!response.ok) {
        throw new Error(`Error al obtener la tabla de posiciones para la competición ${competitionId}.`);
    }
    const data = await response.json();
    const table = data.standings[0]?.table;
    if (!table) return [];
    return table.slice(0, 4).map(row => row.team.name);
};