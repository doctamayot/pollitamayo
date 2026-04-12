import React from 'react';
import { roundTabs, translateTeam } from '../tempFolder/constantes';

const KnockoutTab = ({
    activeRoundTab,
    setActiveRoundTab,
    handleRoundTabScroll,
    roundTabsRef,
    qualifiedRoundOf32,
    getAvailableTeamsForRound,
    knockoutPicks,
    toggleKnockoutPick,
    isCurrentMainTabLocked
}) => {
    return (
        <div className="animate-fade-in">
            {/* --- SUB-TABS CLASIFICADOS --- */}
            <div className="relative w-full mb-8 flex items-center group justify-center">
                <button onClick={() => handleRoundTabScroll('left')} className="absolute left-0 z-20 bg-card border border-border p-1.5 rounded-full shadow-lg md:hidden">
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-4 h-4"><path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" /></svg>
                </button>

                <div ref={roundTabsRef} className="flex overflow-x-auto md:overflow-visible hide-scrollbar gap-3 pb-4 pt-2 px-2 md:px-0 md:justify-center w-full md:w-auto snap-x scroll-smooth items-center">
                    {roundTabs.map(rt => {
                        const isSelected = activeRoundTab === rt.id;
                        const currentPicks = rt.id === 'dieciseisavos' ? 32 : (knockoutPicks[rt.id]?.length || 0);
                        return (
                            <button 
                                key={rt.id} 
                                onClick={() => setActiveRoundTab(rt.id)} 
                                className={`snap-center shrink-0 flex flex-col items-center justify-center min-w-[85px] h-16 rounded-2xl border transition-all ${
                                    isSelected 
                                    ? 'bg-gradient-to-b from-primary to-amber-600 text-white shadow-lg border-transparent scale-105 z-10' 
                                    : 'bg-card text-foreground-muted border-border hover:bg-background-offset'
                                }`}
                            >
                                <span className="text-[10px] font-black uppercase">{rt.label}</span>
                                <span className={`text-[9px] font-bold mt-1 px-2 py-0.5 rounded-full ${currentPicks === rt.limit ? 'bg-green-500/20 text-green-500' : 'bg-black/20 text-white/50'}`}>{currentPicks}/{rt.limit}</span>
                            </button>
                        );
                    })}
                </div>

                <button onClick={() => handleRoundTabScroll('right')} className="absolute right-0 z-20 bg-card border border-border p-1.5 rounded-full shadow-lg md:hidden">
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-4 h-4"><path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" /></svg>
                </button>
            </div>
            
            {/* --- AVISO INFORMATIVO --- */}
            <div className="mb-6 px-4">
                <div className="bg-primary/10 border border-primary/20 rounded-2xl p-4 flex items-center gap-4 shadow-sm animate-fade-in">
                    <div className="text-2xl shrink-0">
                        {activeRoundTab === 'dieciseisavos' ? '📋' : '🏆'}
                    </div>
                    <div>
                        <h4 className="text-primary font-black text-xs uppercase tracking-widest mb-0.5">
                            {activeRoundTab === 'dieciseisavos' ? 'Información' : 'Predicción de Podio'}
                        </h4>
                        <p className="text-foreground-muted text-[11px] sm:text-xs leading-tight font-medium">
                            {(() => {
                                switch (activeRoundTab) {
                                    case 'dieciseisavos': return 'Estos son tus 32 clasificados automáticos según los marcadores que pusiste en la Fase de Grupos.';
                                    case 'campeon': return '¡El momento de la verdad! Selecciona al equipo que se coronará Campeón del Mundo.';
                                    case 'subcampeon': return 'Selecciona al equipo que crees que perderá la final y quedará en segundo lugar.';
                                    case 'tercero': return 'Selecciona al equipo que ganará el partido por el tercer puesto.';
                                    case 'cuarto': return 'Selecciona al equipo que perderá el partido por el tercer puesto.';
                                    default:
                                        const limit = roundTabs.find(r => r.id === activeRoundTab)?.limit;
                                        return `Selecciona a los ${limit} equipos que crees que avanzarán a la ronda de ${activeRoundTab}.`;
                                }
                            })()}
                        </p>
                    </div>
                </div>
            </div>

            <div className="bg-background-offset border border-border p-6 sm:p-10 rounded-3xl shadow-sm">
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-4">
                    {activeRoundTab === 'dieciseisavos' ? (
                        qualifiedRoundOf32.all32.map((team, idx) => (
                            <div key={idx} className="bg-card border border-card-border p-3 sm:p-4 rounded-xl flex flex-col items-center text-center shadow-sm relative overflow-hidden h-full">
                                <div className="w-12 h-8 bg-background rounded-[4px] overflow-hidden border border-border/50 mb-2 shrink-0"><img src={team.crest} className="w-full h-full object-cover" alt="" /></div>
                                <span className="font-bold text-[11px] sm:text-xs text-foreground mb-3 flex-grow">{translateTeam(team.name)}</span>
                                <span className="text-[8px] font-black uppercase bg-primary/10 text-primary px-1.5 py-0.5 rounded">{team.qualReason} {team.group ? team.group.replace('Grupo ', '') : ''}</span>
                            </div>
                        ))
                    ) : (
                        getAvailableTeamsForRound(activeRoundTab).map((team, idx) => {
                            const limit = roundTabs.find(t => t.id === activeRoundTab).limit;
                            const isSelected = knockoutPicks[activeRoundTab].some(t => t.name === team.name);
                            return (
                                <button key={idx} onClick={() => toggleKnockoutPick(activeRoundTab, team, limit)} disabled={isCurrentMainTabLocked} className={`p-3 sm:p-4 rounded-2xl flex flex-col items-center text-center transition-all border-2 h-full disabled:opacity-50 ${isSelected ? 'bg-primary/10 border-primary scale-105 shadow-md' : 'bg-card border-card-border hover:border-primary/50'}`}>
                                    <div className="w-12 h-8 bg-background rounded-[4px] overflow-hidden border border-border/50 mb-2 sm:mb-3 shrink-0"><img src={team.crest} className="w-full h-full object-cover" alt="" /></div>
                                    <span className={`font-bold text-[11px] sm:text-sm flex-grow ${isSelected ? 'text-primary' : 'text-foreground'}`}>{translateTeam(team.name)}</span>
                                </button>
                            );
                        })
                    )}
                </div>
            </div>
        </div>
    );
};

export default KnockoutTab;