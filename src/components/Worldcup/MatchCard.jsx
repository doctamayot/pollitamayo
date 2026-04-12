import React from 'react';
import { stageTranslations, translateTeam } from './Constants';
import logocopa from '../../assets/logocopa.png'; // Ajustamos la ruta de la imagen

const MatchCard = ({ 
    match, 
    isLocked, 
    allowTbdInput, 
    predictions, 
    adminResults, 
    allTeams, 
    isAdmin, 
    handleScoreChange, 
    handleCustomTeamChange 
}) => {
    const homeOriginal = match.homeTeam?.name;
    const awayOriginal = match.awayTeam?.name;
    
    const isUnknownHome = !homeOriginal || homeOriginal === 'TBD' || homeOriginal.includes('Winner') || homeOriginal.includes('Loser');
    const isUnknownAway = !awayOriginal || awayOriginal === 'TBD' || awayOriginal.includes('Winner') || awayOriginal.includes('Loser');
    
    const customHome = predictions[match.id]?.customHomeTeam || '';
    const customAway = predictions[match.id]?.customAwayTeam || '';
    
    // JUGADORES VEN EL EQUIPO QUE PUSO EL ADMIN, ADMIN VE SU PROPIO SELECTOR
    const displayHome = isUnknownHome ? (isAdmin ? customHome : (adminResults?.predictions?.[match.id]?.customHomeTeam || '')) : homeOriginal;
    const displayAway = isUnknownAway ? (isAdmin ? customAway : (adminResults?.predictions?.[match.id]?.customAwayTeam || '')) : awayOriginal;
    
    const homeCrest = isUnknownHome && displayHome ? allTeams.find(t=>t.name === displayHome)?.crest : match.homeTeam?.crest;
    const awayCrest = isUnknownAway && displayAway ? allTeams.find(t=>t.name === displayAway)?.crest : match.awayTeam?.crest;

    return (
        <div className={`bg-card border ${isLocked ? 'border-border/50 opacity-80' : 'border-card-border hover:border-primary/50'} rounded-2xl shadow-sm relative overflow-hidden flex flex-col transition-all`}>
            <div className="bg-background-offset px-4 py-2.5 flex justify-between items-center border-b border-border">
                <div className="flex items-center gap-2">
                    <span className="text-[9px] font-black text-background bg-primary px-2 py-0.5 rounded uppercase tracking-wider shadow-sm">
                        {match.group ? match.group.replace('GROUP_', 'Grupo ') : stageTranslations[match.stage] || match.stage.replace(/_/g, ' ')}
                    </span>
                </div>
                <span className="text-[10px] text-foreground-muted font-semibold uppercase tracking-wider">
                    {new Date(match.utcDate).toLocaleDateString('es-ES', { weekday: 'short', day: '2-digit', month: 'short', hour:'2-digit', minute:'2-digit' }).replace('.', '')}
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
            </div>
        </div>
    );
};

export default MatchCard;