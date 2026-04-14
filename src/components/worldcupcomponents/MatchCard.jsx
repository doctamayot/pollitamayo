import React from 'react';
import { stageTranslations, translateTeam } from './constants';
import logocopa from '../../assets/logocopa.png'; 

const MatchCard = ({ 
    match, 
    isLocked, 
    allowTbdInput, 
    predictions, 
    adminResults, 
    allTeams, 
    isAdmin, 
    handleScoreChange, 
    handleCustomTeamChange,
    lockedMatches, 
    handleToggleLockMatch 
}) => {
    const homeOriginal = match.homeTeam?.name;
    const awayOriginal = match.awayTeam?.name;
    
    const isUnknownHome = !homeOriginal || homeOriginal === 'TBD' || homeOriginal.includes('Winner') || homeOriginal.includes('Loser');
    const isUnknownAway = !awayOriginal || awayOriginal === 'TBD' || awayOriginal.includes('Winner') || awayOriginal.includes('Loser');
    
    const customHome = predictions[match.id]?.customHomeTeam || '';
    const customAway = predictions[match.id]?.customAwayTeam || '';
    
    const displayHome = isUnknownHome ? (isAdmin ? customHome : (adminResults?.predictions?.[match.id]?.customHomeTeam || '')) : homeOriginal;
    const displayAway = isUnknownAway ? (isAdmin ? customAway : (adminResults?.predictions?.[match.id]?.customAwayTeam || '')) : awayOriginal;
    
    const homeCrest = isUnknownHome && displayHome ? allTeams.find(t=>t.name === displayHome)?.crest : match.homeTeam?.crest;
    const awayCrest = isUnknownAway && displayAway ? allTeams.find(t=>t.name === displayAway)?.crest : match.awayTeam?.crest;

    // 🟢 FORMATO DE HORA Y FECHA: Convierte UTC a hora local en formato 12h (AM/PM)
    const formatMatchDate = (utcStr) => {
        if (!utcStr) return '';
        const d = new Date(utcStr);
        const day = d.toLocaleDateString('es-ES', { weekday: 'short', day: '2-digit', month: 'short' }).replace('.', '');
        const time = d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
        return `${day} - ${time}`;
    };

    // 🟢 ÁRBITRO: Extrae el árbitro principal si la API lo manda
    const mainReferee = match.referees && match.referees.length > 0 
        ? match.referees.find(r => r.type === 'REFEREE' || r.role === 'REFEREE') || match.referees[0] 
        : null;

    return (
        <div className={`bg-card border ${isLocked ? 'border-border/50 opacity-80' : 'border-card-border hover:border-primary/50'} rounded-2xl shadow-sm relative overflow-hidden flex flex-col transition-all`}>
            
            {/* 🔒 BOTÓN DE CANDADO (SOLO ADMIN Y DESDE 16VOS) */}
            {isAdmin && match.stage !== 'GROUP_STAGE' && (
                <button
                    onClick={(e) => { e.preventDefault(); handleToggleLockMatch(match.id); }}
                    className={`absolute top-2 right-2 z-20 flex items-center justify-center w-7 h-7 rounded-full border shadow-sm transition-all ${
                        lockedMatches?.[match.id] 
                            ? 'bg-red-500 text-white border-red-600 hover:bg-red-600 shadow-[0_0_10px_rgba(239,68,68,0.5)]' 
                            : 'bg-background-offset text-foreground-muted border-border hover:bg-foreground hover:text-background'
                    }`}
                    title={lockedMatches?.[match.id] ? "Desbloquear Partido (Permitir Auto-Sync)" : "Cerrar Partido en 90 Min (Ignorar Auto-Sync)"}
                >
                    {lockedMatches?.[match.id] ? '🔒' : '🔓'}
                </button>
            )}

            <div className="bg-background-offset px-4 py-2.5 flex justify-between items-center border-b border-border">
                <div className="flex items-center gap-2">
                    <span className="text-[9px] font-black text-background bg-primary px-2 py-0.5 rounded uppercase tracking-wider shadow-sm">
                        {match.group ? match.group.replace('GROUP_', 'Grupo ') : stageTranslations[match.stage] || match.stage.replace(/_/g, ' ')}
                    </span>
                    
                    {/* 🟢 INFO DE ÁRBITRO EN ESCRITORIO (Se oculta en móviles para ahorrar espacio) */}
                    <span className="hidden sm:flex items-center gap-1.5 text-[9px] text-foreground-muted font-bold tracking-widest bg-background px-2 py-0.5 rounded border border-border/50">
                        <span>👨‍⚖️</span> {mainReferee ? mainReferee.name : 'Por Definir'}
                    </span>
                </div>
                
                {/* 🟢 LA HORA LOCAL AQUÍ */}
                <span className={`text-[10px] text-foreground-muted font-semibold uppercase tracking-wider ${isAdmin && match.stage !== 'GROUP_STAGE' ? 'pr-8' : ''}`}>
                    {formatMatchDate(match.utcDate)}
                </span>
            </div>

            <div className="p-4 flex flex-col gap-3 relative z-10">
                <img src={logocopa} alt="" className="absolute right-2 top-1/2 -translate-y-1/2 w-28 opacity-[0.03] grayscale pointer-events-none" />
                
                {/* EQUIPO LOCAL */}
                <div className="flex items-center justify-between relative z-10">
                    <div className="flex items-center gap-2 sm:gap-4 overflow-hidden pr-2">
                        <div className="w-10 h-6 sm:w-14 sm:h-9 bg-background rounded-[4px] overflow-hidden shadow-[0_2px_5px_rgba(0,0,0,0.1)] border border-border/50 shrink-0 relative flex items-center justify-center">
                            {homeCrest ? <img src={homeCrest} className="w-full h-full object-cover" alt="" /> : <span className="text-xl opacity-30">🛡️</span>}
                        </div>
                        {isAdmin && isUnknownHome ? (
                            <select 
                                value={displayHome} onChange={(e) => handleCustomTeamChange(match.id, 'home', e.target.value)} disabled={isLocked}
                                className="bg-background-offset border border-border/50 text-[10px] sm:text-xs font-bold rounded p-1 truncate w-24 sm:w-32 focus:ring-1 focus:ring-primary disabled:opacity-50"
                            >
                                <option value="">Definir...</option>
                                {allTeams.map((t, i) => <option key={`home-${t.name}-${i}`} value={t.name}>{translateTeam(t.name)}</option>)}
                            </select>
                        ) : (
                            <span className={`font-bold text-sm sm:text-base truncate drop-shadow-sm ${!displayHome ? 'text-foreground-muted italic' : 'text-foreground'}`}>
                                {displayHome ? translateTeam(displayHome) : 'Por Definir'}
                            </span>
                        )}
                    </div>
                    <input 
                        type="number" className="w-12 h-12 sm:w-14 sm:h-14 text-center bg-background border border-card-border rounded-xl text-xl sm:text-2xl font-black text-foreground focus:ring-2 focus:ring-primary shadow-inner shrink-0 transition-all disabled:opacity-50 disabled:bg-background-offset" 
                        placeholder="-" disabled={isLocked || (!displayHome && !allowTbdInput)}
                        value={predictions[match.id]?.home ?? ''} onChange={(e) => handleScoreChange(match.id, 'home', e.target.value)} 
                    />
                </div>

                {/* EQUIPO VISITANTE */}
                <div className="flex items-center justify-between relative z-10">
                    <div className="flex items-center gap-2 sm:gap-4 overflow-hidden pr-2">
                        <div className="w-10 h-6 sm:w-14 sm:h-9 bg-background rounded-[4px] overflow-hidden shadow-[0_2px_5px_rgba(0,0,0,0.1)] border border-border/50 shrink-0 relative flex items-center justify-center">
                            {awayCrest ? <img src={awayCrest} className="w-full h-full object-cover" alt="" /> : <span className="text-xl opacity-30">🛡️</span>}
                        </div>
                        {isAdmin && isUnknownAway ? (
                            <select 
                                value={displayAway} onChange={(e) => handleCustomTeamChange(match.id, 'away', e.target.value)} disabled={isLocked}
                                className="bg-background-offset border border-border/50 text-[10px] sm:text-xs font-bold rounded p-1 truncate w-24 sm:w-32 focus:ring-1 focus:ring-primary disabled:opacity-50"
                            >
                                <option value="">Definir...</option>
                                {allTeams.map((t, i) => <option key={`away-${t.name}-${i}`} value={t.name}>{translateTeam(t.name)}</option>)}
                            </select>
                        ) : (
                            <span className={`font-bold text-sm sm:text-base truncate drop-shadow-sm ${!displayAway ? 'text-foreground-muted italic' : 'text-foreground'}`}>
                                {displayAway ? translateTeam(displayAway) : 'Por Definir'}
                            </span>
                        )}
                    </div>
                    <input 
                        type="number" className="w-12 h-12 sm:w-14 sm:h-14 text-center bg-background border border-card-border rounded-xl text-xl sm:text-2xl font-black text-foreground focus:ring-2 focus:ring-primary shadow-inner shrink-0 transition-all disabled:opacity-50 disabled:bg-background-offset" 
                        placeholder="-" disabled={isLocked || (!displayAway && !allowTbdInput)}
                        value={predictions[match.id]?.away ?? ''} onChange={(e) => handleScoreChange(match.id, 'away', e.target.value)} 
                    />
                </div>

                {/* 🟢 INFO DE ÁRBITRO EN MÓVIL (Aparece abajo para que quepa bien) */}
                <div className="mt-1 text-center sm:hidden">
                    <span className="inline-flex items-center gap-1.5 text-[9px] text-foreground-muted font-bold tracking-widest bg-background px-2.5 py-1 rounded border border-border/50">
                        <span>👨‍⚖️</span> {mainReferee ? mainReferee.name : 'Árbitro por Definir'}
                    </span>
                </div>
            </div>
        </div>
    );
};

export default MatchCard;