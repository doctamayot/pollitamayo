const API_KEY = import.meta.env.VITE_FOOTBALL_DATA_API_KEY;
const API_PROXY_URL = '/api'; 

const headers = {
    'X-Auth-Token': API_KEY,
};

const RELEVANT_COMPETITIONS = ['CL', 'PL', 'BL1', 'SA', 'PD', 'FL1', 'WC'];

export const getCompetitions = async () => {
    const response = await fetch(`${API_PROXY_URL}/competitions`, { headers });
    if (!response.ok) throw new Error('Error al obtener las competiciones.');
    const data = await response.json();
    return data.competitions.map(comp => ({ 
        id: comp.id, 
        name: comp.name, 
        emblem: comp.emblem 
    }));
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

// --- ▼▼▼ FUNCIÓN MODIFICADA CON CONSOLE.LOGS PARA DEPURACIÓN ▼▼▼ ---
export const getStandings = async (competitionId) => {
    
    if (!competitionId) return [];
    
    try {
        const response = await fetch(`${API_PROXY_URL}/competitions/${competitionId}/standings`, { headers });
        
        

        if (!response.ok) {
            console.error(`La respuesta de la API para la liga ${competitionId} no fue exitosa.`);
            // Lanzamos el error para que Promise.allSettled lo capture
            throw new Error(`Respuesta no exitosa: ${response.status}`);
        }

        const data = await response.json();
        

        const table = data.standings[0]?.table;
        

        if (!table) {
            console.warn(`No se encontró una tabla en los datos para la liga ${competitionId}.`);
            return [];
        }
        
        const finalResult = table.slice(0, 4).map(row => row.team.name);
        
        
        return finalResult;

    } catch (error) {
        console.error(`Error CATASTRÓFICO en getStandings para la liga ${competitionId}:`, error);
        // Devolvemos un array vacío en caso de cualquier error para no romper la aplicación
        return [];
    }
};