import React, { useState, useMemo } from 'react';
import { roundTabs, translateTeam } from './constants';
import { generateFullBracket } from '../../services/bracketEngine';

const KnockoutTab = ({
    activeRoundTab,
    setActiveRoundTab,
    handleRoundTabScroll,
    roundTabsRef,
    qualifiedRoundOf32,
    getAvailableTeamsForRound,
    knockoutPicks,
    toggleKnockoutPick,
    isCurrentMainTabLocked,
    isGroupStageComplete // <--- Recibimos la validación
}) => {
    const [isCleaning, setIsCleaning] = useState(false);

    // --- 🔮 MOTOR DE SIMULACIÓN DE LLAVES ---
    // Solo se ejecuta si la fase de grupos está 100% completa
    const fullBracket = useMemo(() => {
        if (isGroupStageComplete && qualifiedRoundOf32?.all32?.length === 32) {
            return generateFullBracket(qualifiedRoundOf32.all32, knockoutPicks);
        }
        return null;
    }, [qualifiedRoundOf32, knockoutPicks, isGroupStageComplete]);

    const getLimitForTab = (tabId) => roundTabs.find(r => r.id === tabId)?.limit || 1;

    const bracketMap = {
        'dieciseisavos': 'dieciseisavos',
        'octavos': 'octavos',
        'cuartos': 'cuartos',
        'semis': 'semis',
        'campeon': 'final',
        'subcampeon': 'final',   
        'tercero': 'tercero',
        'cuarto': 'tercero'      
    };

    const getTabInfo = (tabId) => {
        switch(tabId) {
            case 'dieciseisavos': return { title: '16vos de Final', desc: 'Según tus marcadores en la fase de Grupos, estos son los enfrentamientos oficiales de los 32 equipos clasificados en 16avos por los cuales ganas puntos. Ahora Elige a los 16 equipos que avanzarán a Octavos.' };
            case 'octavos': return { title: 'Octavos de Final', desc: 'Haz clic en el equipo ganador de cada llave para enviarlo a Cuartos de Final.' };
            case 'cuartos': return { title: 'Cuartos de Final', desc: 'Selecciona a los 4 equipos que llegarán a las Semifinales.' };
            case 'semis': return { title: 'Semifinales', desc: 'Elige a los 2 equipos que disputarán la Gran Final.' };
            case 'campeon': return { title: 'La Gran Final', desc: 'Selecciona al Campeón. ¡El perdedor será asignado automáticamente como Subcampeón!' };
            case 'tercero': return { title: 'Tercer Puesto', desc: 'Selecciona al ganador del bronce. ¡El perdedor será asignado automáticamente como Cuarto Lugar!' };
            case 'subcampeon': return { title: 'Subcampeón', desc: 'Posición asignada automáticamente al elegir el ganador de la Final.' };
            case 'cuarto': return { title: 'Cuarto Lugar', desc: 'Posición asignada automáticamente al elegir el ganador del 3er puesto.' };
            default: return { title: 'Armado de Llaves', desc: 'Selecciona al ganador de la llave.' };
        }
    };

    const invalidPicks = useMemo(() => {
        const currentBracket = fullBracket?.[bracketMap[activeRoundTab]];
        if (!currentBracket) return [];

        const picks = knockoutPicks[activeRoundTab] || [];
        const validNames = new Set();
        
        Object.values(currentBracket).forEach(match => {
            if (match.home) validNames.add(match.home.name);
            if (match.away) validNames.add(match.away.name);
        });

        return picks.filter(p => !validNames.has(p.name));
    }, [fullBracket, knockoutPicks, activeRoundTab]);

    const handleCleanInvalidPicks = () => {
        if (isCleaning) return;
        setIsCleaning(true);
        const limit = getLimitForTab(activeRoundTab);
        
        invalidPicks.forEach((invalidTeam, index) => {
            setTimeout(() => {
                toggleKnockoutPick(activeRoundTab, invalidTeam, limit);
                if (index === invalidPicks.length - 1) {
                    setTimeout(() => setIsCleaning(false), 200);
                }
            }, index * 100);
        });
    };

    // --- ⚔️ RENDERIZADOR INTELIGENTE DE CRUCES ---
    const renderMatchups = (matchesObj, currentTabId) => {
        // 🛑 BLOQUEO DE PANTALLA: Si no ha terminado grupos
        if (!isGroupStageComplete) {
            return (
                <div className="col-span-full text-center py-16 text-foreground-muted animate-fade-in bg-background-offset border border-border rounded-3xl shadow-inner mt-4">
                    <span className="text-6xl mb-4 block opacity-50 drop-shadow-md">🛡️</span>
                    <h3 className="font-black text-foreground text-xl sm:text-2xl mb-2 uppercase tracking-widest text-primary">Equipos por Definir</h3>
                    <p className="text-xs sm:text-sm max-w-md mx-auto leading-relaxed">
                        Aún te faltan marcadores por predecir en la <strong>Fase de Grupos</strong>.<br/><br/> 
                        Complétalos todos para que el motor pueda calcular con exactitud a tus 32 clasificados y armar tu árbol de llaves.
                    </p>
                </div>
            );
        }

        if (!matchesObj) return null;

        const limit = getLimitForTab(currentTabId);

        return Object.entries(matchesObj).map(([matchId, match]) => {
            const homeIsSelected = match.home && knockoutPicks[currentTabId]?.some(t => t.name === match.home.name);
            const awayIsSelected = match.away && knockoutPicks[currentTabId]?.some(t => t.name === match.away.name);

            const handlePick = (teamToSelect, isOpponentSelected, opponentTeam) => {
                const isCurrentlySelected = knockoutPicks[currentTabId]?.some(t => t.name === teamToSelect.name);

                const executePick = () => {
                    toggleKnockoutPick(currentTabId, teamToSelect, limit);
                    
                    if (currentTabId === 'campeon' || currentTabId === 'tercero') {
                        const loserTabId = currentTabId === 'campeon' ? 'subcampeon' : 'cuarto';
                        const currentLoserPicks = knockoutPicks[loserTabId] || [];
                        
                        if (!isCurrentlySelected) {
                            if (currentLoserPicks.length > 0 && currentLoserPicks[0].name !== opponentTeam.name) {
                                toggleKnockoutPick(loserTabId, currentLoserPicks[0], 1); 
                            }
                            setTimeout(() => toggleKnockoutPick(loserTabId, opponentTeam, 1), 50);
                        } else {
                            if (currentLoserPicks.some(t => t.name === opponentTeam.name)) {
                                toggleKnockoutPick(loserTabId, opponentTeam, 1);
                            }
                        }
                    }
                };

                if (isOpponentSelected) {
                    toggleKnockoutPick(currentTabId, opponentTeam, limit); 
                    setTimeout(executePick, 50); 
                } else {
                    executePick();
                }
            };

            return (
                <div key={matchId} className="bg-card border border-card-border p-4 rounded-2xl flex flex-col justify-between shadow-sm relative overflow-hidden">
                    <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-primary to-amber-500"></div>
                    <span className="absolute top-2 left-3 text-[9px] font-black text-primary/70 uppercase tracking-widest">
                        {match.label || `Partido ${matchId.replace('M', '')}`}
                    </span>
                    
                    <div className="flex items-center justify-between mt-5 w-full gap-2">
                        {/* BOTÓN EQUIPO LOCAL */}
                        <button 
                            onClick={() => match.home && handlePick(match.home, awayIsSelected, match.away)}
                            disabled={isCurrentMainTabLocked || !match.home}
                            className={`flex flex-col items-center w-[42%] text-center p-2 rounded-xl transition-all border-2 disabled:opacity-50 ${homeIsSelected ? 'bg-primary/10 border-primary scale-105' : 'bg-background-offset border-transparent hover:border-primary/50'}`}
                        >
                            <div className="w-10 h-7 bg-background rounded shrink-0 overflow-hidden border border-border/50 mb-1.5 shadow-sm flex items-center justify-center">
                                {match.home?.crest ? <img src={match.home.crest} className="w-full h-full object-cover" alt=""/> : <span className="text-[10px] opacity-30">❓</span>}
                            </div>
                            <span className={`font-bold text-[10px] sm:text-xs leading-tight mb-1 ${homeIsSelected ? 'text-primary' : 'text-foreground'}`}>
                                {match.home ? translateTeam(match.home.name) : match.placeholderHome}
                            </span>
                            {match.home?.qualReason && (
                                <span className="text-[8px] font-black text-foreground-muted bg-background px-1.5 py-0.5 rounded uppercase">
                                    {match.home.qualReason} {match.home.group?.replace('Grupo ', '')}
                                </span>
                            )}
                        </button>

                        {/* VS Badge */}
                        <div className="w-[10%] flex justify-center">
                            <span className="text-[9px] font-black text-primary bg-primary/10 px-1.5 py-0.5 rounded-full">VS</span>
                        </div>

                        {/* BOTÓN EQUIPO VISITANTE */}
                        <button 
                            onClick={() => match.away && handlePick(match.away, homeIsSelected, match.home)}
                            disabled={isCurrentMainTabLocked || !match.away}
                            className={`flex flex-col items-center w-[42%] text-center p-2 rounded-xl transition-all border-2 disabled:opacity-50 ${awayIsSelected ? 'bg-primary/10 border-primary scale-105' : 'bg-background-offset border-transparent hover:border-primary/50'}`}
                        >
                            <div className="w-10 h-7 bg-background rounded shrink-0 overflow-hidden border border-border/50 mb-1.5 shadow-sm flex items-center justify-center">
                                {match.away?.crest ? <img src={match.away.crest} className="w-full h-full object-cover" alt=""/> : <span className="text-[10px] opacity-30">❓</span>}
                            </div>
                            <span className={`font-bold text-[10px] sm:text-xs leading-tight mb-1 ${awayIsSelected ? 'text-primary' : 'text-foreground'}`}>
                                {match.away ? translateTeam(match.away.name) : match.placeholderAway}
                            </span>
                            {match.away?.qualReason && (
                                <span className="text-[8px] font-black text-foreground-muted bg-background px-1.5 py-0.5 rounded uppercase">
                                    {match.away.qualReason} {match.away.group?.replace('Grupo ', '')}
                                </span>
                            )}
                        </button>
                    </div>
                </div>
            );
        });
    };

    const tabInfo = getTabInfo(activeRoundTab);

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
                        const limit = getLimitForTab(rt.id);
                        const currentPicks = knockoutPicks[rt.id]?.length || 0;
                        
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
                                <span className={`text-[9px] font-bold mt-1 px-2 py-0.5 rounded-full ${currentPicks === limit ? 'bg-green-500/20 text-green-500' : 'bg-black/20 text-white/50'}`}>
                                    {currentPicks}/{limit}
                                </span>
                            </button>
                        );
                    })}
                </div>

                <button onClick={() => handleRoundTabScroll('right')} className="absolute right-0 z-20 bg-card border border-border p-1.5 rounded-full shadow-lg md:hidden">
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-4 h-4"><path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" /></svg>
                </button>
            </div>
            
            {/* --- PANEL DE AVISOS INFORMATIVOS --- */}
            <div className="mb-6 px-4 flex flex-col gap-4">
                <div className="bg-primary/10 border border-primary/20 rounded-2xl p-4 flex items-center gap-4 shadow-sm animate-fade-in">
                    <div className="text-2xl shrink-0">
                        {activeRoundTab === 'dieciseisavos' ? '📋' : '🏆'}
                    </div>
                    <div>
                        <h4 className="text-primary font-black text-xs uppercase tracking-widest mb-0.5">
                            {tabInfo.title}
                        </h4>
                        <p className="text-foreground-muted text-[11px] sm:text-xs leading-tight font-medium">
                            {tabInfo.desc}
                        </p>
                    </div>
                </div>

                {activeRoundTab === 'dieciseisavos' && isGroupStageComplete && (
                    <div className="flex items-start gap-3 sm:gap-4 bg-blue-500/10 border border-blue-500/20 p-4 sm:p-5 rounded-2xl shadow-sm animate-fade-in">
                        <div className="text-2xl shrink-0 drop-shadow-md">⚖️</div>
                        <div>
                            <h4 className="text-xs sm:text-sm font-black text-blue-500 uppercase tracking-widest mb-1">
                                Criterio de Desempate: Mejores Terceros
                            </h4>
                            <p className="text-[10px] sm:text-xs text-foreground-muted leading-relaxed">
                                Según el reglamento de la FIFA (Art. 13), el desempate para los mejores terceros se define por: <strong className="text-foreground">1. Puntos, 2. Diferencia de Goles y 3. Goles a Favor</strong>. 
                                <br className="hidden sm:block" />
                                Como en esta Polla es imposible predecir el <em>Juego Limpio (Fair Play)</em>, si la igualdad persiste, el sistema ordenará a los equipos <strong>alfabéticamente</strong> como criterio final.
                            </p>
                        </div>
                    </div>
                )}
            </div>

            {/* --- ALERTA DE INCONSISTENCIA (FANTASMAS) --- */}
            {invalidPicks.length > 0 && isGroupStageComplete && (
                <div className="mx-4 mb-6 bg-red-500/10 border border-red-500/30 p-4 sm:p-5 rounded-2xl flex flex-col sm:flex-row items-center justify-between gap-4 animate-fade-in shadow-sm">
                    <div className="flex items-center gap-3 w-full sm:w-auto">
                        <span className="text-3xl shrink-0">👻</span>
                        <div>
                            <h4 className="text-red-500 font-black text-xs sm:text-sm uppercase tracking-widest mb-0.5">
                                Equipos Fantasma Detectados
                            </h4>
                            <p className="text-[10px] sm:text-xs text-foreground-muted leading-tight">
                                Tienes <strong>{invalidPicks.length}</strong> selección(es) antigua(s) que ya no coincide(n) con tus llaves actuales. Limpia este error para poder continuar.
                            </p>
                        </div>
                    </div>
                    <button 
                        onClick={handleCleanInvalidPicks}
                        disabled={isCleaning}
                        className="w-full sm:w-auto shrink-0 bg-red-500/20 text-red-500 border border-red-500/50 font-black px-5 py-2.5 rounded-xl text-xs hover:bg-red-500 hover:text-white transition-all shadow-sm disabled:opacity-50"
                    >
                        {isCleaning ? 'Limpiando...' : '🧹 Limpiar Fantasmas'}
                    </button>
                </div>
            )}

            {/* --- GRILLA DE ENFRENTAMIENTOS --- */}
            <div className="bg-background-offset border border-border p-6 sm:p-10 rounded-3xl shadow-sm">
                <div className={`grid gap-4 ${activeRoundTab === 'campeon' || activeRoundTab === 'tercero' ? 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4' : 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4'}`}>
                    
                    {activeRoundTab === 'subcampeon' || activeRoundTab === 'cuarto' ? (
                        knockoutPicks[activeRoundTab] && knockoutPicks[activeRoundTab].length > 0 && isGroupStageComplete ? (
                            <div className="col-span-full flex flex-col items-center justify-center py-8 animate-fade-in">
                                <span className="text-4xl mb-3 drop-shadow-md">{activeRoundTab === 'subcampeon' ? '🥈' : '🎖️'}</span>
                                <div className="bg-primary/10 border-2 border-primary p-6 rounded-3xl flex flex-col items-center text-center shadow-[0_0_20px_rgba(245,158,11,0.15)] sm:scale-110">
                                    <div className="w-20 h-14 bg-background rounded shrink-0 overflow-hidden border border-border/50 mb-3">
                                        <img src={knockoutPicks[activeRoundTab][0].crest} className="w-full h-full object-cover" alt=""/>
                                    </div>
                                    <span className="font-black text-xl text-primary">{translateTeam(knockoutPicks[activeRoundTab][0].name)}</span>
                                    <span className="text-[10px] font-bold text-foreground-muted uppercase mt-3 bg-background px-3 py-1 rounded-full border border-border/50">
                                        {activeRoundTab === 'subcampeon' ? 'Subcampeón Automático' : 'Cuarto Lugar Automático'}
                                    </span>
                                </div>
                                <p className="text-[10px] sm:text-xs text-foreground-muted mt-8 max-w-sm text-center">
                                    (Este equipo fue asignado automáticamente al elegir al ganador en la pestaña anterior. Si deseas cambiarlo, modifica el resultado allá).
                                </p>
                            </div>
                        ) : (
                            <div className="col-span-full text-center py-10 text-foreground-muted animate-fade-in">
                                <span className="text-4xl mb-4 block">🤖</span>
                                Esta posición se llena <strong>automáticamente</strong>.<br/>
                                Vuelve a la pestaña de <strong>{activeRoundTab === 'subcampeon' ? 'Campeón' : 'Tercer Puesto'}</strong> y selecciona al equipo ganador; el perdedor aparecerá aquí mágicamente.
                            </div>
                        )
                    ) : (
                        renderMatchups(fullBracket?.[bracketMap[activeRoundTab]], activeRoundTab)
                    )}

                </div>
            </div>
        </div>
    );
};

export default KnockoutTab;