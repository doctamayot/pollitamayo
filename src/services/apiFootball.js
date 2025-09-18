

// Leemos las variables de entorno
const API_KEY = import.meta.env.VITE_FOOTBALL_DATA_API_KEY;
const API_BASE_PATH = import.meta.env.VITE_PUBLIC_BASE_PATH || "";

// Si estamos en producción (la ruta base es /pollitamayo), llamamos a nuestra función.
// Si estamos en local (la ruta base es /), llamamos al proxy de Vite.
const API_URL_PREFIX = API_BASE_PATH === '/' 
    ? '/api' 
    : `${API_BASE_PATH}/api`;

/**
 * Función centralizada para hacer las llamadas a la API.
 * Detecta el entorno y construye la petición correcta.
 * @param {string} pathWithParams - La ruta y parámetros de la API (ej: 'competitions/2014/standings')
 * @returns {Promise<any>} - Los datos JSON de la respuesta.
 */
const fetchFromApi = async (pathWithParams) => {
    let url;
    const options = {};

    if (API_BASE_PATH === '/') {
        // En LOCAL: usamos el proxy de Vite y necesitamos enviar la clave en el header.
        url = `${API_URL_PREFIX}/${pathWithParams}`;
        options.headers = { 'X-Auth-Token': API_KEY };
    } else {
        // En PRODUCCIÓN: llamamos a nuestra función serverless. La clave la pone el servidor.
        url = `${API_URL_PREFIX}/football?path=${encodeURIComponent(pathWithParams)}`;
    }

    const response = await fetch(url, options);
    if (!response.ok) {
        throw new Error(`Error en la llamada para: ${pathWithParams}. Status: ${response.status}`);
    }
    return response.json();
};

/**
 * Busca todas las competiciones disponibles (filtradas).
 */
export const getCompetitions = async () => {
    const data = await fetchFromApi('competitions');
    // Filtramos para mostrar solo las más relevantes y evitar una lista gigante
    const RELEVANT_COMPETITIONS = ['CL', 'PL', 'BL1', 'SA', 'PD', 'FL1', 'WC'];
    return data.competitions
        .filter(comp => RELEVANT_COMPETITIONS.includes(comp.code))
        .map(comp => ({ 
            id: comp.id, 
            name: comp.name, 
            emblem: comp.emblem 
        }));
};

/**
 * Busca los partidos programados de una competición.
 */
export const getMatchesByCompetition = async (competitionId) => {
    if (!competitionId) return [];
    const data = await fetchFromApi(`competitions/${competitionId}/matches?status=SCHEDULED`);
    return data.matches.map(match => ({
        id: match.id,
        date: match.utcDate,
        venue: match.venue,
        homeTeam: { id: match.homeTeam.id, name: match.homeTeam.name, crest: match.homeTeam.crest, tla: match.homeTeam.tla },
        awayTeam: { id: match.awayTeam.id, name: match.awayTeam.name, crest: match.awayTeam.crest, tla: match.awayTeam.tla }
    }));
};

/**
 * Busca los resultados actuales de una lista de partidos por sus IDs.
 */
export const getLiveResultsByIds = async (matchIds) => {
    if (!matchIds || matchIds.length === 0) return {};
    const data = await fetchFromApi(`matches?ids=${matchIds.join(',')}`);
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

/**
 * Busca la tabla de posiciones de una competición.
 * NOTA: Esta función puede fallar si el plan gratuito de la API restringe el acceso.
 */
export const getStandings = async (competitionId) => {
    if (!competitionId) return [];
    const data = await fetchFromApi(`competitions/${competitionId}/standings`);
    const table = data.standings[0]?.table;
    if (!table) return [];
    // Devuelve un array simple con los nombres de los equipos
    return table.slice(0, 4).map(row => row.team.name);
};