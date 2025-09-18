const API_KEY = import.meta.env.VITE_FOOTBALL_DATA_API_KEY;

// --- ▼▼▼ CAMBIO CLAVE: USAMOS NUESTRA PROPIA VARIABLE DE ENTORNO ▼▼▼ ---
// El '|| ""' es un seguro por si la variable no estuviera definida.
const API_BASE_PATH = import.meta.env.VITE_PUBLIC_BASE_PATH || "";
const API_SERVERLESS_URL = `${API_BASE_PATH}/api/football`;

const RELEVANT_COMPETITIONS = ['CL', 'PL', 'BL1', 'SA', 'PD', 'FL1', 'WC'];

export const getCompetitions = async () => {
    const path = 'competitions';
    const response = await fetch(`${API_SERVERLESS_URL}?path=${encodeURIComponent(path)}`);
    if (!response.ok) throw new Error('Error al obtener las competiciones.');
    const data = await response.json();
    return data.competitions.map(comp => ({ 
        id: comp.id, 
        name: comp.name, 
        emblem: comp.emblem 
    }));
};

// ... (El resto de las funciones no cambian, ya que usan API_SERVERLESS_URL)

export const getMatchesByCompetition = async (competitionId) => {
    if (!competitionId) return [];
    const path = `competitions/${competitionId}/matches?status=SCHEDULED`;
    const response = await fetch(`${API_SERVERLESS_URL}?path=${encodeURIComponent(path)}`);
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
    const path = `matches?ids=${matchIds.join(',')}`;
    const response = await fetch(`${API_SERVERLESS_URL}?path=${encodeURIComponent(path)}`);
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
    const path = `competitions/${competitionId}/standings`;
    const response = await fetch(`${API_SERVERLESS_URL}?path=${encodeURIComponent(path)}`);
    if (!response.ok) {
        throw new Error(`Error al obtener la tabla de posiciones.`);
    }
    const data = await response.json();
    const table = data.standings[0]?.table;
    if (!table) return [];
    return table.slice(0, 4).map(row => row.team.name);
};