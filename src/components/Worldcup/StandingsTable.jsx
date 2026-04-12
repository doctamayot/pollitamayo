import React from 'react';
import { translateTeam } from './constantes';

const StandingsTable = ({ currentGroupStandings, hasTiesInGroup, manualTiebreakers, selectedSubTab, handleManualTiebreaker }) => {
    return (
        <div className="bg-card border border-card-border rounded-3xl p-3 sm:p-6 shadow-sm sticky top-48">
            <div className="flex items-center justify-between mb-4">
                <h3 className="text-xl font-black text-foreground ml-2 sm:ml-0">Tabla Proyectada</h3>
            </div>
            
            {hasTiesInGroup && (
                <div className="bg-amber-500/10 border border-amber-500/20 p-3 rounded-xl mb-4 flex items-start gap-2 animate-fade-in mx-2 sm:mx-0">
                    <span className="text-amber-500 text-lg">⚖️</span>
                    <p className="text-[11px] sm:text-xs text-amber-500 font-bold leading-tight">
                        Hay un empate total en puntos y goles. Elige explícitamente en el <strong className="text-amber-400">selector de desempate</strong> la posición de cada equipo (1º, 2º...) para romper el empate.
                    </p>
                </div>
            )}

            <div className="overflow-x-auto px-2 sm:px-0">
                <table className="w-full text-sm">
                    <thead>
                        <tr className="border-b border-border text-foreground-muted text-[10px]">
                            <th className="pb-2 text-left">Equipo</th>
                            <th className="pb-2 text-center">PJ</th>
                            <th className="pb-2 text-center">GF</th>
                            <th className="pb-2 text-center">DG</th>
                            <th className="pb-2 text-center font-black text-primary">PTS</th>
                            <th className="pb-2 text-center w-8 sm:w-12"></th> 
                        </tr>
                    </thead>
                    <tbody>
                        {currentGroupStandings.map((team, idx) => (
                            <tr key={team.name} className="border-b border-border/50 last:border-0 h-12">
                                <td className="flex items-center gap-1.5 sm:gap-2 h-12 overflow-hidden pr-1">
                                    <div className="w-5 h-3.5 sm:w-6 sm:h-4 bg-background rounded-sm overflow-hidden border border-border/50 shrink-0">
                                        <img src={team.crest} className="w-full h-full object-cover" alt="" />
                                    </div>
                                    <span className="font-bold truncate text-[11px] sm:text-sm">{translateTeam(team.name)}</span>
                                </td>
                                <td className="text-center font-medium text-foreground-muted text-xs">{team.pj}</td>
                                <td className="text-center font-medium text-foreground-muted text-xs">{team.gf}</td>
                                <td className="text-center font-medium text-foreground-muted text-xs">{team.dg > 0 ? `+${team.dg}` : team.dg}</td>
                                <td className="text-center font-black text-primary text-xs sm:text-sm">{team.pts}</td>
                                
                                <td className="text-center">
                                    {team.isTied ? (
                                        <select 
                                            value={manualTiebreakers[selectedSubTab]?.[team.name] || ''} 
                                            onChange={(e) => handleManualTiebreaker(selectedSubTab, team.name, e.target.value, team.tiedTeamNames, team.tieOptions)} 
                                            className="bg-background-offset border border-amber-500/50 rounded-md px-1 py-0.5 text-[9px] sm:text-[10px] font-black text-amber-500 shadow-sm"
                                        >
                                            <option value="">-</option>
                                            {team.tieOptions.map(o => <option key={o} value={o}>{o}º</option>)}
                                        </select>
                                    ) : (
                                        <span className="font-bold text-foreground-muted opacity-30 text-[9px] sm:text-[10px]">{idx + 1}º</span>
                                    )}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {/* --- NOTA INFORMATIVA REGLA FIFA 2026 --- */}
            <div className="mt-4 flex items-start gap-2 px-2 sm:px-0 opacity-80 bg-background-offset/50 p-3 rounded-xl border border-border">
                <span className="text-sm">ℹ️</span>
                <p className="text-[9px] sm:text-[10px] text-foreground-muted leading-tight">
                    <strong className="text-foreground font-bold uppercase tracking-wider">Regla FIFA 2026:</strong> En caso de empate en puntos, el primer criterio de desempate es el resultado del <strong>enfrentamiento directo (Cara a Cara)</strong> en el mini-torneo entre las selecciones empatadas, por encima de la diferencia de goles general.
                </p>
            </div>

        </div>
    );
};

export default StandingsTable;