// Obtenemos la clave secreta desde el archivo .env.local
//const API_KEY = import.meta.env.VITE_FOOTBALL_DATA_API_KEY;
const API_KEY = "a877c967a8d74f37859fe8d7e52cbfc1";
const API_PROXY_URL = '/api'; 

const headers = {
    'X-Auth-Token': API_KEY,
};

const RELEVANT_COMPETITIONS = ['CL', 'PL', 'BL1', 'SA', 'PD', 'FL1', 'WC'];

export const getCompetitions = async () => {
    const response = await fetch(`${API_PROXY_URL}/competitions`, { headers });
    if (!response.ok) throw new Error('Error al obtener las competiciones.');
    const data = await response.json();
    
    return data.competitions
        .filter(comp => RELEVANT_COMPETITIONS.includes(comp.code))
        .map(comp => ({ id: comp.id, name: comp.name, emblem: comp.emblem }));
};

export const getMatchesByCompetition = async (competitionId) => {
    if (!competitionId) return [];
    const response = await fetch(`${API_PROXY_URL}/competitions/${competitionId}/matches?status=SCHEDULED`, { headers });
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
    const response = await fetch(`${API_PROXY_URL}/matches?ids=${matchIds.join(',')}`, { headers });
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

// --- ▼▼▼ NUEVA FUNCIÓN PARA OBTENER TABLAS DE POSICIONES ▼▼▼ ---
/**
 * Busca la tabla de posiciones de una competición y devuelve los 4 primeros.
 * @param {number} competitionId - El ID de la competición.
 * @returns {Promise<Array<string>>} - Un array con los nombres de los 4 primeros equipos.
 */
export const getStandings = async (competitionId) => {
    if (!competitionId) return [];
    
    const response = await fetch(`${API_PROXY_URL}/competitions/${competitionId}/standings`, { headers });
    if (!response.ok) {
        throw new Error(`Error al obtener la tabla de posiciones para la competición ${competitionId}.`);
    }
    const data = await response.json();

    // La API devuelve un array de tablas (ej. Grupo A, Grupo B), tomamos la primera que es la general
    const table = data.standings[0]?.table;

    if (!table) return [];

    // Nos quedamos solo con los 4 primeros y extraemos el nombre del equipo
    return table.slice(0, 4).map(row => row.team.name);
};