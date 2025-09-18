

// Leemos nuestra variable de entorno para saber dónde estamos.
const API_BASE_PATH = import.meta.env.VITE_PUBLIC_BASE_PATH || "";

// Si estamos en producción (la ruta base es /pollitamayo), llamamos a nuestra función.
// Si estamos en local (la ruta base es /), llamamos al proxy de Vite.
const API_URL = API_BASE_PATH === '/' 
    ? '/api' 
    : `${API_BASE_PATH}/api`;

const API_KEY = import.meta.env.VITE_FOOTBALL_DATA_API_KEY;

/**
 * Función centralizada para hacer las llamadas a la API.
 * Detecta el entorno y construye la petición correcta.
 */
const fetchFromApi = async (pathWithParams) => {
    let url;
    const options = {};

    if (API_BASE_PATH === '/') {
        // En LOCAL: usamos el proxy de Vite y necesitamos enviar la clave en el header.
        url = `${API_URL}/${pathWithParams}`;
        options.headers = { 'X-Auth-Token': API_KEY };
    } else {
        // En PRODUCCIÓN: llamamos a nuestra función serverless. La KEY la pone el servidor.
        //url = `${API_URL}/football?path=${encodeURIComponent(pathWithParams)}`;
        url = `/api/football?path=${encodeURIComponent(pathWithParams)}`;
        
    }

    const response = await fetch(url, options);
    if (!response.ok) {
        throw new Error(`Error en la llamada para: ${pathWithParams}. Status: ${response.status}`);
    }
    return response.json();
};

export const getCompetitions = async () => {
    const data = await fetchFromApi('competitions');
    
    return data.competitions        
        .map(comp => ({ id: comp.id, name: comp.name, emblem: comp.emblem }));
};

export const getMatchesByCompetition = async (competitionId) => {
    if (!competitionId) {
        // Mejor lanzar un error aquí si el input es incorrecto
        throw new Error("El ID de competición no puede ser nulo.");
    }
    const data = await fetchFromApi(`competitions/${competitionId}/matches?status=SCHEDULED`);
    return data.matches.map(match => ({
        id: match.id, date: match.utcDate, venue: match.venue,
        homeTeam: { id: match.homeTeam.id, name: match.homeTeam.name, crest: match.homeTeam.crest, tla: match.homeTeam.tla },
        awayTeam: { id: match.awayTeam.id, name: match.awayTeam.name, crest: match.awayTeam.crest, tla: match.awayTeam.tla }
    }));
};

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


export const getStandings = async (competitionId) => {
    if (!competitionId) {
        // Mejor lanzar un error aquí si el input es incorrecto
        throw new Error("El ID de competición no puede ser nulo.");
    }

    const data = await fetchFromApi(`competitions/${competitionId}/standings`);

    // Validar la estructura de la respuest
    const table = data?.standings?.[0]?.table;

    if (!table) {
        // En lugar de devolver [], lanza un error
        console.error(`Datos de standings no encontrados para la competición: ${competitionId}`, data);
        throw new Error("La respuesta de la API no contiene datos de standings válidos.");
    }

    return table.slice(0, 4).map(row => row.team.name);
};