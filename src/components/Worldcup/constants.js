// --- DICCIONARIOS DE TRADUCCIÓN ---
export const teamTranslations = {
    "Albania": "Albania", "Algeria": "Argelia", "Argentina": "Argentina", "Australia": "Australia", 
    "Austria": "Austria", "Belgium": "Bélgica", "Bolivia": "Bolivia", "Bosnia and Herzegovina": "Bosnia y Herzegovina",
    "Brazil": "Brasil", "Bulgaria": "Bulgaria", "Cameroon": "Camerún", "Canada": "Canadá", 
    "Chile": "Chile", "China": "China", "Colombia": "Colombia", "Costa Rica": "Costa Rica", 
    "Croatia": "Croacia", "Czechia": "República Checa", "Czech Republic": "República Checa", 
    "Denmark": "Dinamarca", "Ecuador": "Ecuador", "Egypt": "Egipto", "El Salvador": "El Salvador", 
    "England": "Inglaterra", "France": "Francia", "Germany": "Alemania", "Ghana": "Ghana", 
    "Greece": "Grecia", "Guatemala": "Guatemala", "Honduras": "Honduras", "Hungary": "Hungría", 
    "Iceland": "Islandia", "Iran": "Irán", "Ireland": "Irlanda", "Italy": "Italia", 
    "Ivory Coast": "Costa de Marfil", "Cote d'Ivoire": "Costa de Marfil", "Jamaica": "Jamaica", 
    "Japan": "Japón", "Mexico": "México", "Morocco": "Marruecos", "Netherlands": "Países Bajos", 
    "New Zealand": "Nueva Zelanda", "Nigeria": "Nigeria", "North Korea": "Corea del Norte", 
    "Norway": "Noruega", "Panama": "Panamá", "Paraguay": "Paraguay", "Peru": "Perú", 
    "Poland": "Polonia", "Portugal": "Portugal", "Qatar": "Catar", "Republic of Ireland": "República de Irlanda", 
    "Romania": "Rumania", "Russia": "Rusia", "Saudi Arabia": "Arabia Saudita", "Scotland": "Escocia", 
    "Senegal": "Senegal", "Serbia": "Serbia", "Slovakia": "Eslovaquia", "Slovenia": "Eslovaquia", 
    "South Africa": "Sudáfrica", "South Korea": "Corea del Sur", "Spain": "España", "Sweden": "Suecia", 
    "Switzerland": "Suiza", "Tunisia": "Túnez", "Turkey": "Turquía", "Ukraine": "Ucrania", 
    "United Arab Emirates": "Emiratos Árabes Unidos", "United States": "Estados Unidos", 
    "Uruguay": "Uruguay", "Venezuela": "Venezuela", "Wales": "Gales", "Por definir": "Por definir", "TBD": "Por definir"
};

export const translateTeam = (englishName) => teamTranslations[englishName] || englishName;

export const stageTranslations = {
    'GROUP_STAGE': 'Fase de Grupos',
    'LAST_32': '16vos de Final',
    'ROUND_OF_32': '16vos de Final',
    'LAST_16': 'Octavos de Final',
    'QUARTER_FINALS': 'Cuartos de Final',
    'SEMI_FINALS': 'Semifinales',
    'FINAL': 'Gran Final',
    'THIRD_PLACE': 'Tercer Puesto'
};

// --- PREGUNTAS Y EVENTOS ---
export const extraQuestions = [
    { id: 'goleador', label: '1. Goleador', type: 'player', desc: 'Jugador con más goles anotados.' },
    { id: 'equipo_goleador', label: '2. Equipo Goleador', type: 'team', desc: 'Equipo con más goles a favor totales.' },
    { id: 'equipo_menos_goleador', label: '3. Equipo Menos Goleador', type: 'team', desc: 'Equipo con menos goles a favor.' },
    { id: 'mas_amarillas', label: '4. Más Amarillas', type: 'team', desc: 'Equipo que reciba más tarjetas amarillas.' },
    { id: 'mas_rojas', label: '5. Más Rojas', type: 'team', desc: 'Equipo que reciba más tarjetas rojas.' },
    { id: 'valla_menos_vencida', label: '6. Valla menos vencida', type: 'team', desc: 'Equipo con menos goles en contra.' },
    { id: 'valla_mas_vencida', label: '7. Valla más vencida', type: 'team', desc: 'Equipo con más goles en contra.' },
    { id: 'grupo_mas_goles', label: '8. Grupo con más goles', type: 'group', desc: 'Suma total de goles del grupo (A-L).' },
    { id: 'grupo_menos_goles', label: '9. Grupo con menos goles', type: 'group', desc: 'Suma total de goles del grupo (A-L).' },
    { id: 'maximo_asistidor', label: '10. Máximo asistidor', type: 'player', desc: 'Jugador con más pases de gol.' },
    { id: 'atajapenales', label: '11. El Atajapenales', type: 'player', desc: 'Arquero con más penales tapados (90\').' }
];

export const specialEvents = [
    { id: 'gol_olimpico', label: 'Gol Olímpico', desc: '¿Habrá al menos un gol directo de tiro de esquina?' },
    { id: 'remontada_epica', label: 'Remontada Épica', desc: '¿Alguien ganará tras ir perdiendo por 2+ goles?' },
    { id: 'el_festival', label: 'El Festival', desc: '¿Habrá un partido con 8 o más goles (90 min)?' },
    { id: 'muralla_final', label: 'Muralla en la Final', desc: '¿Se atajará algún penal en los 90\' de la Gran Final?' },
    { id: 'hat_trick_hero', label: 'Hat-Trick Hero', desc: '¿Algún jugador anotará 3 o más goles en un partido?' },
    { id: 'roja_banquillo', label: 'Roja al Banquillo', desc: '¿Un Director Técnico será expulsado con roja?' },
    { id: 'portero_goleador', label: 'El Portero Goleador', desc: '¿Algún arquero anotará (fuera de penales)?' },
    { id: 'debut_sin_red', label: 'Debut sin Red', desc: '¿Al menos un equipo se irá con 0 goles anotados?' },
    { id: 'leyenda_viva', label: 'Leyenda Viva', desc: '¿Messi o CR7 anotarán 3 o más goles totales?' },
    { id: 'drama_final', label: 'Drama Final', desc: '¿Habrá roja (jugador) en el partido de la Gran Final?' },
    { id: 'penales_final', label: 'Final en Penales', desc: '¿La final se decide en penales?' }
];

// --- RONDAS Y FASES ---
export const roundTabs = [
    { id: 'dieciseisavos', label: '16vos', limit: 32 },
    { id: 'octavos', label: '8vos', limit: 16 },
    { id: 'cuartos', label: '4tos', limit: 8 },
    { id: 'semis', label: 'Semis', limit: 4 },
    { id: 'campeon', label: 'Campeón', limit: 1 },
    { id: 'subcampeon', label: 'Subcampeón', limit: 1 },
    { id: 'tercero', label: 'Tercero', limit: 1 },
    { id: 'cuarto', label: 'Cuarto', limit: 1 }
];

export const knockoutSubTabs = [
    { id: 'LAST_32', label: '16vos' },
    { id: 'LAST_16', label: 'Octavos' },
    { id: 'QUARTER_FINALS', label: 'Cuartos' },
    { id: 'SEMI_FINALS', label: 'Semis' },
    { id: 'FINALS', label: 'Finales' }
];

export const TOURNAMENT_PHASES = [
    { id: 'ALL_OPEN', label: 'Todo Abierto (Testing)' },
    { id: 'GROUP_STAGE', label: 'Fase de Grupos' },
    { id: 'LAST_32', label: '16vos de Final' },
    { id: 'LAST_16', label: 'Octavos de Final' },
    { id: 'QUARTER_FINALS', label: 'Cuartos de Final' },
    { id: 'SEMI_FINALS', label: 'Semifinales' },
    { id: 'FINALS', label: '3er Puesto & Final' },
    { id: 'CLOSED', label: 'Torneo Finalizado' }
];