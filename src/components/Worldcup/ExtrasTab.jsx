import React from 'react';
import { extraQuestions, translateTeam } from './constantes';

const ExtrasTab = ({ extraPicks, handleExtraChange, isCurrentMainTabLocked, allTeams, matchesByGroup }) => {
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
                        <select 
                            value={extraPicks[q.id] || ''} 
                            disabled={isCurrentMainTabLocked} 
                            onChange={(e) => handleExtraChange(q.id, e.target.value)} 
                            className="w-full bg-card border rounded-xl py-3 px-4 text-sm font-semibold disabled:opacity-50"
                        >
                            <option value="">Selecciona...</option>
                            {q.type === 'team' 
                                ? allTeams.map(t => <option key={t.name} value={t.name}>{translateTeam(t.name)}</option>) 
                                : Object.keys(matchesByGroup).map(g => <option key={g} value={g}>{g}</option>)}
                        </select>
                    )}
                </div>
            ))}
        </div>
    );
};

export default ExtrasTab;