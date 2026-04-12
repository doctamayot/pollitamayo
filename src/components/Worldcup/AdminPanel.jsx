import React from 'react';
import { TOURNAMENT_PHASES } from '../tempFolder/constantes';

const AdminPanel = ({ activePhase, handleAdminSetPhase, handleClearData, handleSimulateData }) => {
    return (
        <div className="bg-gradient-to-r from-purple-900 to-indigo-900 p-5 rounded-3xl mb-8 border border-purple-500/30 shadow-xl relative overflow-hidden animate-fade-in">
            <div className="absolute right-0 top-0 h-full w-32 bg-white/5 skew-x-12 pointer-events-none"></div>
            <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <div className="flex items-center gap-3 mb-2">
                        <span className="text-3xl drop-shadow-md">🕹️</span>
                        <div>
                            <h3 className="text-white font-black text-lg uppercase tracking-widest leading-none">Panel Maestro</h3>
                            <p className="text-purple-200 text-xs">Fase Activa: Los jugadores solo pueden guardar datos en la fase seleccionada.</p>
                        </div>
                    </div>
                    <div className="flex flex-wrap gap-2 mt-4">
                        {TOURNAMENT_PHASES.map(phase => (
                            <button
                                key={phase.id}
                                onClick={() => handleAdminSetPhase(phase.id)}
                                className={`px-4 py-2 rounded-xl font-bold text-xs transition-all shadow-sm ${activePhase === phase.id ? 'bg-purple-500 text-white ring-2 ring-purple-300 ring-offset-2 ring-offset-indigo-900' : 'bg-background/20 text-purple-100 hover:bg-background/40 border border-white/10'}`}
                            >
                                {phase.id === 'ALL_OPEN' ? '🔓' : '🔒'} {phase.label}
                            </button>
                        ))}
                    </div>
                </div>
                
                <div className="flex md:flex-col gap-2 shrink-0 border-t md:border-t-0 md:border-l border-white/10 pt-4 md:pt-0 md:pl-4">
                    <button onClick={handleClearData} type="button" className="bg-red-600 text-white font-black py-2 px-4 rounded-xl shadow-lg hover:scale-105 active:scale-95 transition-transform flex items-center justify-center gap-2 flex-1">
                        <span>🧹</span><span className="text-[10px] uppercase tracking-wider">Limpiar</span>
                    </button>
                    <button onClick={handleSimulateData} type="button" className="bg-fuchsia-600 text-white font-black py-2 px-4 rounded-xl shadow-lg hover:scale-105 active:scale-95 transition-transform flex items-center justify-center gap-2 flex-1">
                        <span>🎲</span><span className="text-[10px] uppercase tracking-wider">Random</span>
                    </button>
                </div>
            </div>
        </div>
    );
};

export default AdminPanel;