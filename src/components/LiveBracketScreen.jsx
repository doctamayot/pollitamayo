import React from 'react';
import logocopa from '../assets/logocopa.png';

// 🟢 DICCIONARIO DE TRADUCCIONES PARA EL VISOR
const teamTranslations = {
    "Algeria": "Argelia", "Argentina": "Argentina", "Australia": "Australia", "Austria": "Austria",
    "Belgium": "Bélgica", "Bosnia and Herzegovina": "Bosnia y Herzegovina", "Brazil": "Brasil", "Canada": "Canadá",
    "Ivory Coast": "Costa de Marfil", "Cote d'Ivoire": "Costa de Marfil", "DR Congo": "Rep. del Congo", "Congo DR": "Rep. del Congo",
    "Colombia": "Colombia", "Cape Verde": "Cabo Verde", "Cape Verde Islands": "Cabo Verde", "Croatia": "Croacia",
    "Czechia": "República Checa", "Czech Republic": "República Checa", "Curacao": "Curazao",
    "Ecuador": "Ecuador", "Egypt": "Egipto", "England": "Inglaterra", "Spain": "España",
    "France": "Francia", "Germany": "Alemania", "Ghana": "Ghana", "Haiti": "Haití",
    "Iran": "Irán", "Iraq": "Irak", "Jordan": "Jordania", "Japan": "Japón",
    "South Korea": "Corea del Sur", "Korea Republic": "Corea del Sur", "Saudi Arabia": "Arabia Saudita",
    "Morocco": "Marruecos", "Mexico": "México", "Netherlands": "Países Bajos", "Norway": "Noruega",
    "New Zealand": "Nueva Zelanda", "Panama": "Panamá", "Paraguay": "Paraguay", "Portugal": "Portugal",
    "Qatar": "Qatar", "South Africa": "Sudáfrica", "Scotland": "Escocia", "Senegal": "Senegal",
    "Switzerland": "Suiza", "Sweden": "Suecia", "Tunisia": "Túnez", "Turkey": "Turquía",
    "United States": "Estados Unidos", "USA": "Estados Unidos", "Uruguay": "Uruguay", "Uzbekistan": "Uzbekistán",
    "Por definir": "Por definir", "TBD": "Por definir"
};

const translateTeam = (name) => {
    if (!name) return 'Por definir';
    return teamTranslations[name] || name; // Si no está (ej: "Ganador Llave 02"), deja el original
};

const LiveBracketScreen = ({ bracket, onClose }) => {
    if (!bracket) return null;

    // 🌳 EL MAPA VISUAL PERFECTO: 
    // Reordenamos las llaves de la FIFA para que formen un árbol binario limpio en pantalla.
    // Ej: M89 (Octavos 1) enfrenta a M74 y M77, así que los ponemos juntos de primeros.
    const order32 = ['M74', 'M77', 'M73', 'M75', 'M83', 'M84', 'M81', 'M82', 'M76', 'M78', 'M79', 'M80', 'M86', 'M88', 'M85', 'M87'];
    const order16 = ['M89', 'M90', 'M93', 'M94', 'M91', 'M92', 'M95', 'M96'];
    const order8  = ['M97', 'M98', 'M99', 'M100'];
    const order4  = ['M101', 'M102'];

    const getOrdered = (obj, order) => {
        if (!obj) return [];
        return order.map(k => obj[k]).filter(Boolean);
    };

    // Extraemos los partidos en el orden mágico
    const r32 = getOrdered(bracket.dieciseisavos, order32);
    const r16 = getOrdered(bracket.octavos, order16);
    const qf = getOrdered(bracket.cuartos, order8);
    const sf = getOrdered(bracket.semis, order4);
    const final = Object.values(bracket.final || {});
    const third = Object.values(bracket.tercero || {});

    // Componente interno para dibujar cada "Cajita" de partido
    const MatchBox = ({ match }) => {
        if (!match) return null;
        
        // 🟢 Nombres Traducidos
        const rawHome = match.home && !match.home.isPlaceholder ? match.home.name : (match.placeholderHome || 'Por definir');
        const rawAway = match.away && !match.away.isPlaceholder ? match.away.name : (match.placeholderAway || 'Por definir');
        
        const homeName = translateTeam(rawHome);
        const awayName = translateTeam(rawAway);
        
        const homeCrest = match.home && !match.home.isPlaceholder ? match.home.crest : null;
        const awayCrest = match.away && !match.away.isPlaceholder ? match.away.crest : null;

        return (
            <div className="bg-slate-900 border border-slate-700 rounded-xl p-2 w-48 sm:w-56 shadow-md flex flex-col gap-1 relative z-10 hover:border-amber-500 hover:shadow-[0_0_15px_rgba(245,158,11,0.2)] transition-colors">
                <div className="text-[9px] text-amber-500 font-black tracking-widest uppercase text-center mb-1 border-b border-slate-800 pb-1">
                    {match.label}
                </div>
                
                {/* Equipo Local */}
                <div className="flex items-center gap-2">
                    <div className="w-5 h-4 bg-slate-800 rounded-sm overflow-hidden shrink-0 border border-slate-700 flex items-center justify-center">
                        {homeCrest ? <img src={homeCrest} alt="" className="w-full h-full object-cover" /> : <span className="text-[8px]">🛡️</span>}
                    </div>
                    <span className={`text-[10px] sm:text-xs font-bold truncate uppercase ${!match.home || match.home.isPlaceholder ? 'text-slate-500' : 'text-white'}`}>
                        {homeName}
                    </span>
                </div>

                {/* Equipo Visitante */}
                <div className="flex items-center gap-2">
                    <div className="w-5 h-4 bg-slate-800 rounded-sm overflow-hidden shrink-0 border border-slate-700 flex items-center justify-center">
                        {awayCrest ? <img src={awayCrest} alt="" className="w-full h-full object-cover" /> : <span className="text-[8px]">🛡️</span>}
                    </div>
                    <span className={`text-[10px] sm:text-xs font-bold truncate uppercase ${!match.away || match.away.isPlaceholder ? 'text-slate-500' : 'text-white'}`}>
                        {awayName}
                    </span>
                </div>
            </div>
        );
    };

    return (
        <div className="fixed inset-0 z-[99999] bg-slate-950 overflow-hidden animate-fade-in flex flex-col">
            
            {/* CABECERA */}
            <div className="bg-gradient-to-r from-slate-900 to-slate-800 p-4 sm:p-6 flex justify-between items-center border-b border-slate-800 shadow-xl shrink-0 z-20">
                <div className="flex items-center gap-3">
                    <img src={logocopa} alt="Mundial" className="w-8 h-8 sm:w-12 sm:h-12 object-contain drop-shadow-md" />
                    <div>
                        <h2 className="text-white font-black text-lg sm:text-2xl uppercase tracking-widest leading-none">
                            Llaves del Torneo
                        </h2>
                        <p className="text-amber-500 font-bold tracking-widest text-[9px] sm:text-xs uppercase mt-1">
                            Simulador Oficial en Vivo
                        </p>
                    </div>
                </div>
                <button onClick={onClose} className="bg-red-500/20 text-red-400 hover:bg-red-500 hover:text-white px-4 py-2 sm:px-6 sm:py-3 rounded-full font-black uppercase tracking-widest transition-colors text-[10px] sm:text-xs border border-red-500/30">
                    Cerrar Visor
                </button>
            </div>

            {/* ÁRBOL DEL TORNEO PERFECTO */}
            <div className="flex-1 overflow-auto bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-slate-900 via-slate-950 to-black p-4 sm:p-8 hide-scrollbar cursor-grab active:cursor-grabbing relative">
                
                <div className="flex gap-8 sm:gap-16 min-w-max min-h-max pb-16 pt-4 px-4 items-stretch justify-start">
                    
                    {/* COLUMNA 1: 16avos */}
                    <div className="flex flex-col justify-around gap-4 min-h-[1400px]">
                        {r32.map((match, i) => <MatchBox key={i} match={match} />)}
                    </div>

                    {/* COLUMNA 2: Octavos */}
                    <div className="flex flex-col justify-around gap-4 min-h-[1400px]">
                        {r16.map((match, i) => <MatchBox key={i} match={match} />)}
                    </div>

                    {/* COLUMNA 3: Cuartos */}
                    <div className="flex flex-col justify-around gap-4 min-h-[1400px]">
                        {qf.map((match, i) => <MatchBox key={i} match={match} />)}
                    </div>

                    {/* COLUMNA 4: Semifinales */}
                    <div className="flex flex-col justify-around gap-4 min-h-[1400px]">
                        {sf.map((match, i) => <MatchBox key={i} match={match} />)}
                    </div>

                    {/* COLUMNA 5: Final y Tercer Puesto */}
                    <div className="flex flex-col justify-center gap-16 min-h-[1400px]">
                        <div className="relative">
                            <span className="absolute -top-6 left-1/2 -translate-x-1/2 text-yellow-500 font-black tracking-widest text-xs uppercase drop-shadow-md">🏆 Campeón</span>
                            {final.map((match, i) => <MatchBox key={i} match={match} />)}
                        </div>
                        <div className="relative mt-20">
                            <span className="absolute -top-6 left-1/2 -translate-x-1/2 text-amber-600 font-black tracking-widest text-[10px] uppercase">🥉 Tercer Lugar</span>
                            {third.map((match, i) => <MatchBox key={i} match={match} />)}
                        </div>
                    </div>

                </div>
            </div>
        </div>
    );
};

export default LiveBracketScreen;