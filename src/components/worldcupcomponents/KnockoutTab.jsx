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
    replaceKnockoutPick, 
    isCurrentMainTabLocked,
    isGroupStageComplete,
    // 🟢 MODO DIOS
    predictions,
    handleCustomTeamChange,
    allTeams,
    isAdmin
}) => {
    const [isCleaning, setIsCleaning] = useState(false);

    const fullBracket = useMemo(() => {
        let teams = qualifiedRoundOf32?.all32 || [];
        
        if (!isGroupStageComplete && teams.length < 32) {
            const tempTeams = [...teams];
            for (let i = tempTeams.length; i < 32; i++) {
                tempTeams.push({ name: `Por Definir`, isPlaceholder: true, group: 'Grupo TBD', qualReason: '-' });
            }
            try { return generateFullBracket(tempTeams, knockoutPicks); } 
            catch(e) { console.error(e); }
        }
        
        return generateFullBracket(teams, knockoutPicks);
    }, [qualifiedRoundOf32, knockoutPicks, isGroupStageComplete]);

    const getLimitForTab = (tabId) => roundTabs.find(r => r.id === tabId)?.limit || 1;

    const bracketMap = {
        'dieciseisavos': 'dieciseisavos', 'octavos': 'octavos', 'cuartos': 'cuartos',
        'semis': 'semis', 'campeon': 'final', 'subcampeon': 'final', 'tercero': 'tercero', 'cuarto': 'tercero'      
    };

    const getTabInfo = (tabId) => {
        switch(tabId) {
            case 'dieciseisavos': return { title: '16vos de Final', desc: 'Estos son los enfrentamientos. Elige a los 16 equipos que avanzarán.' };
            case 'octavos': return { title: 'Octavos de Final', desc: 'Haz clic en el equipo ganador de cada llave para enviarlo a Cuartos.' };
            case 'cuartos': return { title: 'Cuartos de Final', desc: 'Selecciona a los 4 equipos que llegarán a las Semifinales.' };
            case 'semis': return { title: 'Semifinales', desc: 'Elige a los 2 equipos que disputarán la Gran Final.' };
            case 'campeon': return { title: 'La Gran Final', desc: 'Selecciona al Campeón. ¡El perdedor será asignado como Subcampeón!' };
            case 'tercero': return { title: 'Tercer Puesto', desc: 'Selecciona al ganador del bronce.' };
            default: return { title: 'Automático', desc: 'Posición asignada automáticamente.' };
        }
    };

    const invalidPicks = useMemo(() => {
        const currentBracket = fullBracket?.[bracketMap[activeRoundTab]];
        if (!currentBracket) return [];

        const picks = knockoutPicks[activeRoundTab] || [];
        const validNames = new Set();
        
        Object.values(currentBracket).forEach(match => {
            // Evaluamos si el admin forzó un equipo
            const customHome = predictions?.[match.id]?.customHomeTeam;
            const customAway = predictions?.[match.id]?.customAwayTeam;
            
            const hName = customHome || (match.home && !match.home.isPlaceholder ? match.home.name : null);
            const aName = customAway || (match.away && !match.away.isPlaceholder ? match.away.name : null);
            
            if (hName) validNames.add(hName);
            if (aName) validNames.add(aName);
        });

        return picks.filter(p => !validNames.has(p.name));
    }, [fullBracket, knockoutPicks, activeRoundTab, predictions]);

    const handleCleanInvalidPicks = () => {
        if (isCleaning) return;
        setIsCleaning(true);
        const limit = getLimitForTab(activeRoundTab);
        invalidPicks.forEach((invalidTeam, index) => {
            setTimeout(() => {
                toggleKnockoutPick(activeRoundTab, invalidTeam, limit);
                if (index === invalidPicks.length - 1) setTimeout(() => setIsCleaning(false), 200);
            }, index * 100);
        });
    };

    const renderMatchups = (matchesObj, currentTabId) => {
        let safeMatchesObj = matchesObj;
        if (!safeMatchesObj || Object.keys(safeMatchesObj).length === 0) {
            safeMatchesObj = {};
            const count = { 'dieciseisavos': 16, 'octavos': 8, 'cuartos': 4, 'semis': 2, 'campeon': 1, 'tercero': 1 }[currentTabId] || 1;
            for(let i=1; i<=count; i++) safeMatchesObj[`M_TEMP_${i}`] = { home: { isPlaceholder: true }, away: { isPlaceholder: true }, label: `Llave ${i}` };
        }

        const limit = getLimitForTab(currentTabId);

        return Object.entries(safeMatchesObj).map(([matchId, match]) => {
            
            // 🟢 LEY DE HIERRO: El Admin manda. Si forzó un equipo, pisa al bracketEngine.
            const customHome = predictions?.[matchId]?.customHomeTeam;
            const customAway = predictions?.[matchId]?.customAwayTeam;

            const homeName = customHome || (match.home && !match.home.isPlaceholder ? match.home.name : null);
            const awayName = customAway || (match.away && !match.away.isPlaceholder ? match.away.name : null);

            const homeValid = !!homeName;
            const awayValid = !!awayName;

            // Reconstruimos los objetos de equipo en base a la decisión final
            const finalHomeObj = homeValid ? (allTeams.find(t => t.name === homeName) || { name: homeName, crest: match.home?.crest, qualReason: match.home?.qualReason, group: match.home?.group }) : null;
            const finalAwayObj = awayValid ? (allTeams.find(t => t.name === awayName) || { name: awayName, crest: match.away?.crest, qualReason: match.away?.qualReason, group: match.away?.group }) : null;

            const homeIsSelected = homeValid && knockoutPicks[currentTabId]?.some(t => t.name === homeName);
            const awayIsSelected = awayValid && knockoutPicks[currentTabId]?.some(t => t.name === awayName);

            const handlePick = (teamToSelect, isThisTeamSelected, isOpponentSelected, opponentTeam) => {
                if (isThisTeamSelected || currentTabId === 'campeon' || currentTabId === 'tercero') {
                    toggleKnockoutPick(currentTabId, teamToSelect, limit, opponentTeam);
                } else if (isOpponentSelected) {
                    replaceKnockoutPick(currentTabId, opponentTeam, teamToSelect);
                } else {
                    toggleKnockoutPick(currentTabId, teamToSelect, limit);
                }
            };

            return (
                <div key={matchId} className="bg-card border border-card-border p-4 rounded-2xl flex flex-col justify-between shadow-sm relative overflow-hidden">
                    <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-primary to-amber-500"></div>
                    <span className="absolute top-2 left-3 text-[9px] font-black text-primary/70 uppercase tracking-widest">
                        {match.label || `Partido ${matchId.replace('M', '')}`}
                    </span>
                    
                    <div className="flex items-center justify-between mt-5 w-full gap-2 relative z-10">
                        {/* EQUIPO LOCAL */}
                        <div className="flex flex-col items-center w-[42%]">
                            <button 
                                onClick={() => homeValid && handlePick(finalHomeObj, homeIsSelected, awayIsSelected, finalAwayObj)}
                                disabled={isCurrentMainTabLocked || !homeValid}
                                className={`flex flex-col items-center w-full text-center p-2 rounded-xl transition-all border-2 disabled:opacity-50 disabled:cursor-not-allowed ${homeIsSelected ? 'bg-primary/10 border-primary scale-105' : 'bg-background-offset border-transparent hover:border-primary/50'}`}
                            >
                                <div className="w-10 h-7 bg-background rounded shrink-0 overflow-hidden border border-border/50 mb-1.5 shadow-sm flex items-center justify-center">
                                    {homeValid && finalHomeObj?.crest ? <img src={finalHomeObj.crest} className="w-full h-full object-cover" alt=""/> : <span className="text-[10px] opacity-30">❓</span>}
                                </div>
                                <span className={`font-bold text-[10px] sm:text-xs leading-tight mb-1 ${homeIsSelected ? 'text-primary' : 'text-foreground'}`}>
                                    {homeValid ? translateTeam(homeName) : match.placeholderHome || 'Por Definir'}
                                </span>
                            </button>
                            {/* 🔮 SELECTOR MODO DIOS */}
                            {isAdmin && (
                                <select
                                    className="mt-2 bg-background border border-purple-500/50 text-[9px] text-purple-400 font-bold p-1 rounded outline-none w-full shadow-sm text-center"
                                    value={customHome || ''}
                                    onChange={(e) => handleCustomTeamChange(matchId, 'home', e.target.value)}
                                >
                                    <option value="">⚙️ Lógica Auto</option>
                                    {allTeams.map(t => <option key={t.name} value={t.name}>{translateTeam(t.name)}</option>)}
                                </select>
                            )}
                        </div>

                        <div className="w-[10%] flex justify-center mb-6">
                            <span className="text-[9px] font-black text-primary bg-primary/10 px-1.5 py-0.5 rounded-full">VS</span>
                        </div>

                        {/* EQUIPO VISITANTE */}
                        <div className="flex flex-col items-center w-[42%]">
                            <button 
                                onClick={() => awayValid && handlePick(finalAwayObj, awayIsSelected, homeIsSelected, finalHomeObj)}
                                disabled={isCurrentMainTabLocked || !awayValid}
                                className={`flex flex-col items-center w-full text-center p-2 rounded-xl transition-all border-2 disabled:opacity-50 disabled:cursor-not-allowed ${awayIsSelected ? 'bg-primary/10 border-primary scale-105' : 'bg-background-offset border-transparent hover:border-primary/50'}`}
                            >
                                <div className="w-10 h-7 bg-background rounded shrink-0 overflow-hidden border border-border/50 mb-1.5 shadow-sm flex items-center justify-center">
                                    {awayValid && finalAwayObj?.crest ? <img src={finalAwayObj.crest} className="w-full h-full object-cover" alt=""/> : <span className="text-[10px] opacity-30">❓</span>}
                                </div>
                                <span className={`font-bold text-[10px] sm:text-xs leading-tight mb-1 ${awayIsSelected ? 'text-primary' : 'text-foreground'}`}>
                                    {awayValid ? translateTeam(awayName) : match.placeholderAway || 'Por Definir'}
                                </span>
                            </button>
                            {/* 🔮 SELECTOR MODO DIOS */}
                            {isAdmin && (
                                <select
                                    className="mt-2 bg-background border border-purple-500/50 text-[9px] text-purple-400 font-bold p-1 rounded outline-none w-full shadow-sm text-center"
                                    value={customAway || ''}
                                    onChange={(e) => handleCustomTeamChange(matchId, 'away', e.target.value)}
                                >
                                    <option value="">⚙️ Lógica Auto</option>
                                    {allTeams.map(t => <option key={t.name} value={t.name}>{translateTeam(t.name)}</option>)}
                                </select>
                            )}
                        </div>
                    </div>
                </div>
            );
        });
    };

    const tabInfo = getTabInfo(activeRoundTab);

    return (
        <div className="animate-fade-in">
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

                {isAdmin && (
                    <div className="bg-purple-900/10 border border-purple-500/30 p-3 rounded-xl shadow-inner animate-fade-in flex items-center gap-2 mx-auto w-fit">
                        <span className="text-lg drop-shadow-md">🔮</span>
                        <p className="text-purple-400 font-bold text-[10px] sm:text-xs tracking-widest uppercase">
                            MODO DIOS: Usa los selectores debajo de cada equipo para forzar las llaves si difieren de la realidad.
                        </p>
                    </div>
                )}
            </div>

            {invalidPicks.length > 0 && isGroupStageComplete && (
                <div className="mx-4 mb-6 bg-red-500/10 border border-red-500/30 p-4 sm:p-5 rounded-2xl flex flex-col sm:flex-row items-center justify-between gap-4 animate-fade-in shadow-sm">
                    <div className="flex items-center gap-3 w-full sm:w-auto">
                        <span className="text-3xl shrink-0">👻</span>
                        <div>
                            <h4 className="text-red-500 font-black text-xs sm:text-sm uppercase tracking-widest mb-0.5">
                                Equipos Fantasma Detectados
                            </h4>
                            <p className="text-[10px] sm:text-xs text-foreground-muted leading-tight">
                                Tienes <strong>{invalidPicks.length}</strong> selección(es) que <strong>ya no coinciden</strong> con las llaves reales.<br className="hidden sm:block" />
                                Presiona limpiar para volver a sincronizar tu cuadro con la realidad.
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

            <div className="bg-background-offset border border-border p-6 sm:p-10 rounded-3xl shadow-sm">
                <div className={`grid gap-4 grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4`}>
                    {activeRoundTab === 'subcampeon' || activeRoundTab === 'cuarto' ? (
                        knockoutPicks[activeRoundTab] && knockoutPicks[activeRoundTab].length > 0 ? (
                            <div className="col-span-full flex flex-col items-center justify-center py-8 animate-fade-in">
                                <span className="text-4xl mb-3 drop-shadow-md">{activeRoundTab === 'subcampeon' ? '🥈' : '🎖️'}</span>
                                <div className="bg-primary/10 border-2 border-primary p-6 rounded-3xl flex flex-col items-center text-center shadow-[0_0_20px_rgba(245,158,11,0.15)] sm:scale-110">
                                    <div className="w-20 h-14 bg-background rounded shrink-0 overflow-hidden border border-border/50 mb-3">
                                        <img src={knockoutPicks[activeRoundTab][0].crest} className="w-full h-full object-cover" alt=""/>
                                    </div>
                                    <span className="font-black text-xl text-primary">{translateTeam(knockoutPicks[activeRoundTab][0].name)}</span>
                                    <span className="text-[10px] font-bold text-foreground-muted uppercase mt-3 bg-background px-3 py-1 rounded-full border border-border/50">
                                        Automático
                                    </span>
                                </div>
                            </div>
                        ) : (
                            <div className="col-span-full text-center py-10 text-foreground-muted animate-fade-in">
                                <span className="text-4xl mb-4 block">🤖</span>
                                Esta posición se llena <strong>automáticamente</strong>.<br/>
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