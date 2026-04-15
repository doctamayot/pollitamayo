import React from 'react';
import { stageTranslations, translateTeam } from './constants';
import logocopa from '../../assets/logocopa.png'; 

const MatchCard = ({ 
    match, 
    index, 
    adminFullBracket, 
    isLocked, 
    allowTbdInput, 
    predictions, 
    adminResults, 
    allTeams, 
    isAdmin, 
    handleScoreChange, 
    lockedMatches, 
    handleToggleLockMatch 
}) => {
    
    const isKnockout = match.stage !== 'GROUP_STAGE';

    // 1. 🟢 DATOS DE LA API OFICIAL (Nuestra prioridad #1)
    const homeOriginal = match.homeTeam?.name;
    const awayOriginal = match.awayTeam?.name;
    
    // Verificamos si la API no sabe quién juega todavía
    const isUnknownHome = !homeOriginal || homeOriginal === 'TBD' || homeOriginal.includes('Winner') || homeOriginal.includes('Loser');
    const isUnknownAway = !awayOriginal || awayOriginal === 'TBD' || awayOriginal.includes('Winner') || awayOriginal.includes('Loser');
    
    // 2. 🟢 EL RESPALDO: Árbol de Clasificados del Admin (Nuestra prioridad #2)
    const getAdminBracketTeam = (side) => {
        if (!adminFullBracket) return null;
        
        let roundKey = '';
        if (match.stage === 'LAST_32' || match.stage === 'ROUND_OF_32') roundKey = 'dieciseisavos';
        else if (match.stage === 'LAST_16') roundKey = 'octavos';
        else if (match.stage === 'QUARTER_FINALS') roundKey = 'cuartos';
        else if (match.stage === 'SEMI_FINALS') roundKey = 'semis';
        else if (match.stage === 'FINAL') roundKey = 'final';
        else if (match.stage === 'THIRD_PLACE') roundKey = 'tercero';

        if (!roundKey || !adminFullBracket[roundKey]) return null;

        // Ordenamos las llaves numéricamente (M1, M2, M3...) para que coincidan exacto con la tarjeta
        const bracketMatchValues = Object.keys(adminFullBracket[roundKey])
            .sort((a, b) => {
                const numA = parseInt(a.replace(/\D/g, '')) || 0;
                const numB = parseInt(b.replace(/\D/g, '')) || 0;
                return numA - numB;
            })
            .map(k => adminFullBracket[roundKey][k]);
        
        const bMatch = bracketMatchValues[index]; 
        
        if (bMatch && bMatch[side]) {
            return bMatch[side].name;
        }
        return null;
    };

    const bracketHome = getAdminBracketTeam('home');
    const bracketAway = getAdminBracketTeam('away');

    // 3. 🟢 LA LEY PERFECTA (API -> Bracket -> Vacío)
    // Si la API tiene al equipo real, ¡lo usamos! 
    // Si la API dice "TBD", usamos el que calculó el Admin en Clasificados.
    const displayHome = !isUnknownHome ? homeOriginal : (bracketHome || '');
    const displayAway = !isUnknownAway ? awayOriginal : (bracketAway || '');

    // Escudos
    const homeCrest = allTeams.find(t => t.name === displayHome)?.crest || (!isUnknownHome ? match.homeTeam?.crest : null);
    const awayCrest = allTeams.find(t => t.name === displayAway)?.crest || (!isUnknownAway ? match.awayTeam?.crest : null);

    const formatMatchDate = (utcStr) => {
        if (!utcStr) return '';
        const d = new Date(utcStr);
        const day = d.toLocaleDateString('es-ES', { weekday: 'short', day: '2-digit', month: 'short' }).replace('.', '');
        const time = d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
        return `${day} - ${time}`;
    };

    const mainReferee = match.referees && match.referees.length > 0 
        ? match.referees.find(r => r.type === 'REFEREE' || r.role === 'REFEREE') || match.referees[0] 
        : null;

    return (
        <div className={`bg-card border ${isLocked ? 'border-border/50 opacity-80' : 'border-card-border hover:border-primary/50'} rounded-2xl shadow-sm relative overflow-hidden flex flex-col transition-all`}>
            
            {/* 🔒 BOTÓN DE CANDADO PARA EL ADMIN */}
            {isAdmin && isKnockout && (
                <button
                    onClick={(e) => { e.preventDefault(); handleToggleLockMatch(match.id); }}
                    className={`absolute top-2 right-2 z-20 flex items-center justify-center w-7 h-7 rounded-full border shadow-sm transition-all ${
                        lockedMatches?.[match.id] 
                            ? 'bg-red-500 text-white border-red-600 hover:bg-red-600 shadow-[0_0_10px_rgba(239,68,68,0.5)]' 
                            : 'bg-background-offset text-foreground-muted border-border hover:bg-foreground hover:text-background'
                    }`}
                    title={lockedMatches?.[match.id] ? "Desbloquear Partido" : "Cerrar Partido en 90 Min"}
                >
                    {lockedMatches?.[match.id] ? '🔒' : '🔓'}
                </button>
            )}

            <div className="bg-background-offset px-4 py-2.5 flex justify-between items-center border-b border-border">
                <div className="flex items-center gap-2">
                    <span className="text-[9px] font-black text-background bg-primary px-2 py-0.5 rounded uppercase tracking-wider shadow-sm">
                        {match.group ? match.group.replace('GROUP_', 'Grupo ') : stageTranslations[match.stage] || match.stage.replace(/_/g, ' ')}
                    </span>
                    <span className="hidden sm:flex items-center gap-1.5 text-[9px] text-foreground-muted font-bold tracking-widest bg-background px-2.5 py-1 rounded border border-border/50">
                        <span>👨‍⚖️</span> {mainReferee ? mainReferee.name : 'Por Definir'}
                    </span>
                </div>
                <span className={`text-[10px] text-foreground-muted font-semibold uppercase tracking-wider ${isAdmin && isKnockout ? 'pr-8' : ''}`}>
                    {formatMatchDate(match.utcDate)}
                </span>
            </div>

            <div className="p-4 flex flex-col gap-3 relative z-10">
                <img src={logocopa} alt="" className="absolute right-2 top-1/2 -translate-y-1/2 w-28 opacity-[0.03] grayscale pointer-events-none" />
                
                {/* EQUIPO LOCAL */}
                <div className="flex items-center justify-between relative z-10">
                    <div className="flex items-center gap-2 sm:gap-4 overflow-hidden pr-2">
                        <div className="w-10 h-6 sm:w-14 sm:h-9 bg-background rounded-[4px] overflow-hidden shadow-sm border border-border/50 shrink-0 flex items-center justify-center">
                            {homeCrest ? <img src={homeCrest} className="w-full h-full object-cover" alt="" /> : <span className="text-xl opacity-30">🛡️</span>}
                        </div>
                        <div className="flex flex-col">
                            <span className={`font-bold text-sm sm:text-base truncate ${!displayHome ? 'text-foreground-muted italic' : 'text-foreground'}`}>
                                {displayHome ? translateTeam(displayHome) : 'Por Definir'}
                            </span>
                            {/* Pequeño aviso visual si la API ya trajo el equipo oficial */}
                            {isAdmin && !isUnknownHome && isKnockout && (
                                <span className="text-[8px] font-bold text-green-500 uppercase opacity-90 tracking-widest mt-0.5">Dato API Oficial</span>
                            )}
                        </div>
                    </div>
                    <input 
                        type="number" className="w-12 h-12 sm:w-14 sm:h-14 text-center bg-background border border-card-border rounded-xl text-xl sm:text-2xl font-black text-foreground focus:ring-2 focus:ring-primary shadow-inner disabled:opacity-50" 
                        placeholder="-" disabled={isLocked || (!displayHome && !allowTbdInput)}
                        value={predictions[match.id]?.home ?? ''} onChange={(e) => handleScoreChange(match.id, 'home', e.target.value)} 
                    />
                </div>

                {/* EQUIPO VISITANTE */}
                <div className="flex items-center justify-between relative z-10">
                    <div className="flex items-center gap-2 sm:gap-4 overflow-hidden pr-2">
                        <div className="w-10 h-6 sm:w-14 sm:h-9 bg-background rounded-[4px] overflow-hidden shadow-sm border border-border/50 shrink-0 flex items-center justify-center">
                            {awayCrest ? <img src={awayCrest} className="w-full h-full object-cover" alt="" /> : <span className="text-xl opacity-30">🛡️</span>}
                        </div>
                        <div className="flex flex-col">
                            <span className={`font-bold text-sm sm:text-base truncate ${!displayAway ? 'text-foreground-muted italic' : 'text-foreground'}`}>
                                {displayAway ? translateTeam(displayAway) : 'Por Definir'}
                            </span>
                            {/* Pequeño aviso visual si la API ya trajo el equipo oficial */}
                            {isAdmin && !isUnknownAway && isKnockout && (
                                <span className="text-[8px] font-bold text-green-500 uppercase opacity-90 tracking-widest mt-0.5">Dato API Oficial</span>
                            )}
                        </div>
                    </div>
                    <input 
                        type="number" className="w-12 h-12 sm:w-14 sm:h-14 text-center bg-background border border-card-border rounded-xl text-xl sm:text-2xl font-black text-foreground focus:ring-2 focus:ring-primary shadow-inner disabled:opacity-50" 
                        placeholder="-" disabled={isLocked || (!displayAway && !allowTbdInput)}
                        value={predictions[match.id]?.away ?? ''} onChange={(e) => handleScoreChange(match.id, 'away', e.target.value)} 
                    />
                </div>

                <div className="mt-4 text-center sm:hidden">
                    <span className="inline-flex items-center gap-1.5 text-[9px] text-foreground-muted font-bold tracking-widest bg-background px-2.5 py-1 rounded border border-border/50">
                        <span>👨‍⚖️</span> Árbitro: {mainReferee ? mainReferee.name : 'Por Definir'}
                    </span>
                </div>
            </div>
        </div>
    );
};

export default MatchCard;