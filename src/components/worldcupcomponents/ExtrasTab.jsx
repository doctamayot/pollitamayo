import React from 'react';
import { extraQuestions, translateTeam } from './constants';

const ExtrasTab = ({ extraPicks, handleExtraChange, isCurrentMainTabLocked, allTeams, matchesByGroup, isAdmin }) => {
    return (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 animate-fade-in">
            {extraQuestions.map(q => (
                <div key={q.id} className="bg-background-offset border border-border rounded-2xl p-5 shadow-sm">
                    <h4 className="text-base font-black text-foreground mb-1">{q.label}</h4>
                    <p className="text-xs text-foreground-muted mb-4">{q.desc}</p>
                    {q.type === 'player' ? (
                        <input 
                            type="text" 
                            placeholder="Nombre..." 
                            disabled={isCurrentMainTabLocked} 
                            value={extraPicks[q.id] || ''} 
                            onChange={(e) => handleExtraChange(q.id, e.target.value)} 
                            className="w-full bg-card border rounded-xl py-3 px-4 text-sm font-semibold disabled:opacity-50" 
                        />
                    ) : (
                        <>
                            <select 
                                // 🟢 EL TRUCO: Si hay empate, lo anclamos a la opción fantasma "MULTIPLE"
                                value={extraPicks[q.id] && !extraPicks[q.id].includes(',') ? extraPicks[q.id] : (extraPicks[q.id]?.includes(',') ? 'MULTIPLE' : '')} 
                                disabled={isCurrentMainTabLocked} 
                                onChange={(e) => handleExtraChange(q.id, e.target.value)} 
                                className="w-full bg-card border rounded-xl py-3 px-4 text-sm font-semibold disabled:opacity-50"
                            >
                                <option value="">Selecciona...</option>
                                
                                {/* Opción fantasma para que no se quede pegado el menú */}
                                {isAdmin && extraPicks[q.id] && extraPicks[q.id].includes(',') && (
                                    <option value="MULTIPLE" disabled>✨ Múltiples guardados (Ver abajo)</option>
                                )}

                                {q.type === 'team' 
                                    ? allTeams.map(t => <option key={t.name} value={t.name}>{translateTeam(t.name)}</option>) 
                                    : Object.keys(matchesByGroup).map(g => <option key={g} value={g}>{g}</option>)}
                            </select>
                            
                            {/* 🟢 EL TRUCO VISUAL PARA EL ADMIN (Ahora con botón de borrar rápido) */}
                            {isAdmin && extraPicks[q.id] && extraPicks[q.id].includes(',') && (
                                <div className="text-[11px] text-green-400 font-bold mt-2 bg-green-500/10 p-2 rounded-lg border border-green-500/20 flex justify-between items-center gap-2">
                                    <div>
                                        ✅ Empate Guardado:<br/> 
                                        <span className="text-white">{extraPicks[q.id]}</span>
                                    </div>
                                    <button 
                                        onClick={() => handleExtraChange(q.id, '')} 
                                        className="bg-red-500/20 text-red-400 p-1.5 rounded-md hover:bg-red-500/40 text-base"
                                        title="Borrar empate"
                                    >
                                        🗑️
                                    </button>
                                </div>
                            )}
                        </>
                    )}
                </div>
            ))}
        </div>
    );
};

export default ExtrasTab;