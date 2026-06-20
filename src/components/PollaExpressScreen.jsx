import React, { useState, useEffect } from 'react';
import { db } from '../firebase';
import { doc, onSnapshot, setDoc } from 'firebase/firestore';
import toast from 'react-hot-toast';

// 🟢 DICCIONARIO DE TRADUCCIÓN Y PRIORIDADES
const teamTranslations = {
    "Algeria": "Argelia", "Argentina": "Argentina", "Australia": "Australia", "Austria": "Austria",
    "Belgium": "Bélgica", "Bosnia and Herzegovina": "Bosnia y Herzegovina", "Brazil": "Brasil", "Canada": "Canadá",
    "Ivory Coast": "Costa de Marfil", "Cote d'Ivoire": "Costa de Marfil", "DR Congo": "Rep. del Congo", 
    "Colombia": "Colombia", "Cape Verde": "Cabo Verde", "Croatia": "Croacia", "Czechia": "República Checa", 
    "Ecuador": "Ecuador", "Egypt": "Egipto", "England": "Inglaterra", "Spain": "España", "France": "Francia", 
    "Germany": "Alemania", "Ghana": "Ghana", "Iran": "Irán", "Japan": "Japón", "South Korea": "Corea del Sur", 
    "Saudi Arabia": "Arabia Saudita", "Morocco": "Marruecos", "Mexico": "México", "Netherlands": "Países Bajos", 
    "Norway": "Noruega", "New Zealand": "Nueva Zelanda", "Panama": "Panamá", "Paraguay": "Paraguay", 
    "Portugal": "Portugal", "Qatar": "Qatar", "South Africa": "Sudáfrica", "Scotland": "Escocia", 
    "Senegal": "Senegal", "Switzerland": "Suiza", "Sweden": "Suecia", "Tunisia": "Túnez", "Turkey": "Turquía",
    "United States": "Estados Unidos", "Uruguay": "Uruguay"
};
const translateTeam = (name) => teamTranslations[name] || name;

const PRIORITY_SCORES = [
    "0-0", "1-0", "0-1", "2-0", "0-2", "1-1", "2-1", "1-2", 
    "3-0", "0-3", "3-1", "1-3", "2-2", "4-0", "4-1", "4-2", "5-0", "6-0"
];

const PollaExpressScreen = ({ match, rH, rA, matchStatus, onClose }) => {
    const matchId = String(match.id);
    const [pollaData, setPollaData] = useState({ phase: 'REGISTRATION', players: [], availableScores: [], cardPool: [], entryFee: 0 });
    const [newPlayerName, setNewPlayerName] = useState('');
    const [customScore, setCustomScore] = useState('');
    const [loading, setLoading] = useState(true);
    
    const [activePickerId, setActivePickerId] = useState(null);

    const [liveScore, setLiveScore] = useState({ home: rH, away: rA, status: matchStatus });
    
    const isLocked = liveScore.status === 'IN_PLAY' || liveScore.status === 'PAUSED' || liveScore.status === 'FINISHED';
    const showLiveScore = liveScore.status === 'IN_PLAY' || liveScore.status === 'PAUSED' || liveScore.status === 'FINISHED' || (liveScore.home !== undefined && liveScore.home !== '' && liveScore.home !== null);

    useEffect(() => {
        const unsubResults = onSnapshot(doc(db, 'worldCupAdmin', 'results'), (docSnap) => {
            if (docSnap.exists()) {
                const data = docSnap.data();
                const adminPred = data.predictions?.[matchId];
                const simStatus = data.simulation?.matchStatuses?.[matchId];
                const apiStatus = data.apiStatuses?.[matchId];
                
                const currentH = adminPred?.home !== undefined && adminPred?.home !== '' ? adminPred.home : rH;
                const currentA = adminPred?.away !== undefined && adminPred?.away !== '' ? adminPred.away : rA;
                const currentStatus = simStatus || apiStatus || matchStatus;
                
                setLiveScore({ home: currentH, away: currentA, status: currentStatus });
            }
        });
        return () => unsubResults();
    }, [matchId, rH, rA, matchStatus]);

    useEffect(() => {
        const unsub = onSnapshot(doc(db, 'matchPollas', matchId), (docSnap) => {
            if (docSnap.exists()) {
                const data = docSnap.data();
                setPollaData({
                    phase: data.phase || 'REGISTRATION',
                    players: data.players || [],
                    availableScores: data.availableScores || [],
                    cardPool: data.cardPool || [],
                    entryFee: data.entryFee || 0
                });
            } else {
                setPollaData({ phase: 'REGISTRATION', players: [], availableScores: [], cardPool: [], entryFee: 0 });
            }
            setLoading(false);
        });
        return () => unsub();
    }, [matchId]);

    const updateFirebase = async (newData) => {
        if (isLocked && newData.entryFee === undefined) return toast.error("El partido ya comenzó. Tablero bloqueado.");
        try {
            await setDoc(doc(db, 'matchPollas', matchId), newData, { merge: true });
        } catch (error) {
            toast.error("Error al guardar en la nube.");
        }
    };

    const handleResetPolla = async () => {
        if (window.confirm("¿Seguro que deseas borrar esta polla y empezar desde cero?")) {
            try {
                await setDoc(doc(db, 'matchPollas', matchId), { phase: 'REGISTRATION', players: [], availableScores: [], cardPool: [], entryFee: 0 });
                toast.success("Polla reseteada.");
            } catch (error) {
                toast.error("Error al resetear.");
            }
        }
    };

    // 🟢 NUEVA LÓGICA INTELIGENTE PARA AGREGAR REZAGADOS
    const handleAddPlayer = (e) => {
        e.preventDefault();
        if (isLocked) return;
        if (!newPlayerName.trim()) return;

        let assignedTurn = null;
        let assignedHidden = null;

        // Si la fase ya pasó, le damos el último turno automáticamente y se salta el sorteo
        if (pollaData.phase !== 'REGISTRATION') {
            const currentMaxTurn = Math.max(0, ...pollaData.players.map(p => p.turn || p.hiddenTurn || 0));
            assignedTurn = currentMaxTurn + 1;
            assignedHidden = currentMaxTurn + 1;
            toast.success(`${newPlayerName.toUpperCase()} agregado de último (Turno ${assignedTurn})`, { icon: '🏃‍♂️' });
        }

        const newPlayers = [...pollaData.players, { 
            id: Date.now().toString(), 
            name: newPlayerName.trim(), 
            turn: assignedTurn, 
            hiddenTurn: assignedHidden,
            score: null 
        }];
        
        updateFirebase({ players: newPlayers });
        setNewPlayerName('');
    };

    const handleRemovePlayer = (id) => {
        if (isLocked) return;
        const newPlayers = pollaData.players.filter(p => p.id !== id);
        updateFirebase({ players: newPlayers });
    };

    const startDrawPhase = () => {
        if (isLocked) return;
        if (pollaData.players.length < 2) return toast.error("Mínimo 2 jugadores.");
        if (pollaData.entryFee <= 0) return toast.error("Debes fijar un valor por jugador antes de sortear.");
        
        const turns = Array.from({ length: pollaData.players.length }, (_, i) => i + 1);
        
        for (let i = turns.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [turns[i], turns[j]] = [turns[j], turns[i]];
        }
        
        const pool = turns.map((t, index) => ({ id: index, turn: t, assignedTo: null }));
        
        const playersWithHiddenTurns = pollaData.players.map((p, index) => ({
            ...p, hiddenTurn: turns[index] // Guardamos el turno oculto por si queremos revelarlo luego
        }));

        updateFirebase({ phase: 'DRAW', cardPool: pool, players: playersWithHiddenTurns });
    };

    const handlePickCard = (cardId) => {
        if (isLocked) return;
        if (!activePickerId) return toast.error("👆 Primero selecciona a un jugador para que elija carta.");

        const card = pollaData.cardPool.find(c => c.id === cardId);
        if (card.assignedTo) return;

        const newPool = pollaData.cardPool.map(c => c.id === cardId ? { ...c, assignedTo: activePickerId } : c);
        const newPlayers = pollaData.players.map(p => p.id === activePickerId ? { ...p, turn: card.turn } : p);

        updateFirebase({ cardPool: newPool, players: newPlayers });
        setActivePickerId(null);
    };

    const startPickingPhase = () => {
        if (isLocked) return;
        const allRevealed = pollaData.players.every(p => p.turn !== null);
        if (!allRevealed) return toast.error("Todos deben tener un turno asignado.");

        const scores = [];
        for (let i = 0; i <= 7; i++) {
            for (let j = 0; j <= 7; j++) {
                scores.push(`${i}-${j}`);
            }
        }
        updateFirebase({ phase: 'PICKING', availableScores: scores });
    };

    const handleAddCustomScore = (e) => {
        e.preventDefault();
        if (isLocked) return;
        if (!customScore.includes('-')) return toast.error("Formato inválido. Usa un guión (ej: 8-1)");
        
        const newScores = [...pollaData.availableScores, customScore];
        updateFirebase({ availableScores: newScores });
        setCustomScore('');
    };

    const handleDragStart = (e, score) => {
        if (isLocked) { e.preventDefault(); return; }
        e.dataTransfer.setData('score', score);
    };

    const handleDrop = (e, playerId) => {
        e.preventDefault();
        if (isLocked) return;
        
        const scoreAssigned = e.dataTransfer.getData('score');
        if (!scoreAssigned) return;

        const newPlayers = pollaData.players.map(p => {
            if (p.id === playerId) return { ...p, score: scoreAssigned };
            return p;
        });

        const newAvailableScores = pollaData.availableScores.filter(s => s !== scoreAssigned);
        const oldPlayer = pollaData.players.find(p => p.id === playerId);
        if (oldPlayer.score) newAvailableScores.push(oldPlayer.score);

        updateFirebase({ players: newPlayers, availableScores: newAvailableScores });
    };

    const getSurvivalStatus = (predScoreStr) => {
        if (!predScoreStr) return { category: 'PENDING', priority: 4, message: 'Esperando marcador', color: 'text-slate-400 border-slate-700 bg-slate-800/80' };
        
        const [pH, pA] = predScoreStr.split('-').map(Number);
        const realH = parseInt(liveScore.home);
        const realA = parseInt(liveScore.away);
        
        if (isNaN(realH) || isNaN(realA)) return { category: 'PENDING', priority: 4, message: 'LISTO PARA LA BATALLA', color: 'text-slate-400 border-slate-700 bg-slate-800/80' };
        
        if (liveScore.status === 'FINISHED') {
            if (pH === realH && pA === realA) return { category: 'EXACT', priority: 1, message: '¡GANADOR! 🏆', color: 'text-green-500 bg-green-900/40 border-green-500 shadow-[0_0_20px_rgba(34,197,94,0.4)]' };
            return { category: 'DEAD', priority: 5, message: 'ELIMINADO ☠️', color: 'text-red-400 bg-slate-900 border-red-900/80' };
        }

        if (realH > pH || realA > pA) {
            return { category: 'DEAD', priority: 5, message: 'ELIMINADO ☠️', color: 'text-red-400 bg-slate-900 border-red-900/80' };
        }

        if (realH === pH && realA === pA) {
            return { category: 'EXACT', priority: 1, message: '¡ACERTANDO! 🎯', color: 'text-green-400 bg-green-900/30 border-green-400 shadow-[0_0_15px_rgba(34,197,94,0.2)]' };
        }

        const diffTotal = (pH - realH) + (pA - realA);
        if (diffTotal === 1) {
            return { category: 'ONE_AWAY', priority: 2, message: 'A 1 GOL ⚽', color: 'text-cyan-400 bg-cyan-900/20 border-cyan-500/50' };
        }
        
        return { category: 'ALIVE', priority: 3, message: 'VIVO 🔥', color: 'text-amber-400 border-amber-500/30 bg-slate-800/80' };
    };

    if (loading) return null;

    const playersWithStatus = pollaData.players.map(p => ({
        ...p,
        status: getSurvivalStatus(p.score)
    }));

    const sortedPlayers = playersWithStatus.sort((a, b) => {
        if (a.status.priority !== b.status.priority) return a.status.priority - b.status.priority;
        return (a.turn || 99) - (b.turn || 99); 
    });

    const totalPot = pollaData.players.length * (pollaData.entryFee || 0);

    const sortedAvailableScores = [...pollaData.availableScores].sort((a, b) => {
        const indexA = PRIORITY_SCORES.indexOf(a);
        const indexB = PRIORITY_SCORES.indexOf(b);
        if (indexA !== -1 && indexB !== -1) return indexA - indexB;
        if (indexA !== -1) return -1;
        if (indexB !== -1) return 1;
        const [aH, aA] = a.split('-').map(Number);
        const [bH, bA] = b.split('-').map(Number);
        if (aH !== bH) return aH - bH;
        return aA - bA;
    });

    return (
        <div className="fixed inset-0 z-[99999] bg-slate-950 overflow-y-auto animate-fade-in flex justify-center">
            <div className="w-full max-w-6xl p-4 sm:p-8 min-h-screen flex flex-col">
                
                {/* CABECERA Y MARCADOR GIGANTE */}
                <div className="bg-gradient-to-r from-amber-600 to-orange-700 p-6 rounded-3xl mb-8 flex flex-col items-center gap-4 shadow-2xl shrink-0 border border-orange-400/50 relative overflow-hidden">
                    
                    <div className="absolute top-4 left-4 z-20">
                        {totalPot > 0 && (
                            <span className="bg-green-600 text-white px-4 py-2.5 rounded-xl font-black text-[11px] sm:text-sm uppercase tracking-widest flex items-center gap-2 shadow-lg border border-green-400/50">
                                <span className="text-lg">💰</span> POT: ${totalPot.toLocaleString('es-CO')}
                            </span>
                        )}
                    </div>

                    <div className="absolute top-4 right-4 flex gap-2 z-20">
                        <button onClick={handleResetPolla} className="bg-red-500 hover:bg-red-400 text-white px-3 py-2 rounded-xl font-black uppercase tracking-widest transition-colors text-[9px] sm:text-xs shadow-md">
                            🗑️ Resetear
                        </button>
                        <button onClick={onClose} className="bg-black/30 hover:bg-black/50 text-white px-4 py-2 rounded-xl font-black uppercase tracking-widest transition-colors text-[9px] sm:text-xs border border-white/20">
                            Volver a Grilla
                        </button>
                    </div>
                    
                    <h2 className="text-white font-black text-xl sm:text-2xl uppercase tracking-widest flex items-center gap-2 drop-shadow-md z-10 mt-6 sm:mt-0">
                        <span>🎲</span> POLLA PARTIDO
                    </h2>

                    <div className="flex items-center gap-4 sm:gap-8 z-10 mt-2">
                        <span className="text-2xl sm:text-4xl font-black text-white uppercase text-right w-32 sm:w-48 drop-shadow-md">{translateTeam(match.homeTeam?.name)}</span>
                        
                        <div className="bg-slate-950 px-6 sm:px-8 py-3 rounded-2xl border-4 border-slate-800 flex items-center gap-4 shadow-2xl">
                            <span className={`text-4xl sm:text-6xl font-black ${showLiveScore ? 'text-amber-500' : 'text-slate-700'}`}>
                                {showLiveScore ? liveScore.home : '-'}
                            </span>
                            <span className="text-3xl text-slate-600 font-black">-</span>
                            <span className={`text-4xl sm:text-6xl font-black ${showLiveScore ? 'text-amber-500' : 'text-slate-700'}`}>
                                {showLiveScore ? liveScore.away : '-'}
                            </span>
                        </div>
                        
                        <span className="text-2xl sm:text-4xl font-black text-white uppercase text-left w-32 sm:w-48 drop-shadow-md">{translateTeam(match.awayTeam?.name)}</span>
                    </div>

                    {isLocked && (
                        <span className="bg-slate-900 text-white px-4 py-1.5 mt-2 rounded-full font-black text-[10px] sm:text-xs uppercase tracking-widest flex items-center gap-2 border border-slate-700 z-10">
                            <span>🔒</span> Partido Bloqueado
                        </span>
                    )}
                </div>

                {/* ÁREA DE JUEGO */}
                <div className="bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl p-6 flex-1 flex flex-col">
                    
                    {/* FASE 1: REGISTRO */}
                    {pollaData.phase === 'REGISTRATION' && (
                        <div className="text-center space-y-6 max-w-2xl mx-auto my-auto w-full">
                            <h3 className="text-3xl font-black text-amber-500 uppercase mb-8">1. Inscribir Jugadores</h3>
                            
                            {!isLocked ? (
                                <>
                                    <div className="flex justify-center mb-8">
                                        <div className="bg-slate-800 border-2 border-green-500/50 p-3 rounded-2xl flex items-center gap-3 shadow-inner">
                                            <span className="text-green-500 font-black uppercase tracking-widest pl-2">💰 Valor Apuesta: $</span>
                                            <input
                                                type="number"
                                                defaultValue={pollaData.entryFee || ''}
                                                onBlur={(e) => updateFirebase({ entryFee: Number(e.target.value) })}
                                                placeholder="Ej: 10000"
                                                className="bg-slate-950 text-white font-black text-xl outline-none w-32 text-center py-2 rounded-xl border border-slate-700 focus:border-green-500 transition-colors"
                                            />
                                        </div>
                                    </div>

                                    <form onSubmit={handleAddPlayer} className="flex justify-center gap-2">
                                        <input 
                                            type="text" value={newPlayerName} onChange={e => setNewPlayerName(e.target.value)}
                                            placeholder="Nombre del jugador..." className="flex-1 bg-slate-800 text-white px-6 py-4 rounded-xl outline-none focus:ring-2 ring-amber-500 text-lg font-bold uppercase"
                                        />
                                        <button type="submit" className="bg-amber-500 text-white font-black px-6 rounded-xl hover:bg-amber-400 text-2xl shadow-lg">+</button>
                                    </form>

                                    <div className="flex flex-wrap justify-center gap-3 mt-8">
                                        {pollaData.players.map(p => (
                                            <div key={p.id} className="bg-slate-800 border border-slate-700 px-6 py-3 rounded-xl flex items-center gap-4 text-lg shadow-md">
                                                <span className="font-bold text-white uppercase">{p.name}</span>
                                                <button onClick={() => handleRemovePlayer(p.id)} className="text-red-500 font-black hover:scale-125 transition-transform">X</button>
                                            </div>
                                        ))}
                                    </div>
                                    
                                    {pollaData.players.length >= 2 && (
                                        <button onClick={startDrawPhase} className="mt-10 bg-green-500 text-white font-black px-10 py-4 rounded-full text-xl shadow-lg hover:scale-105 transition-transform uppercase tracking-widest w-full">
                                            Ir al Sorteo de Turnos
                                        </button>
                                    )}
                                </>
                            ) : (
                                <div className="text-red-500 font-black text-xl bg-red-500/10 p-6 rounded-2xl border border-red-500/20">
                                    El partido ya comenzó. No se pueden inscribir más jugadores.
                                </div>
                            )}
                        </div>
                    )}

                    {/* FASE 2: SORTEO DE CARTAS INTELIGENTE */}
                    {pollaData.phase === 'DRAW' && (
                        <div className="flex flex-col h-full gap-8">
                            <div className="text-center">
                                <h3 className="text-3xl font-black text-amber-500 uppercase mb-2">2. Mesa de Sorteo</h3>
                                <p className="text-slate-400 text-sm">Selecciona al jugador y luego haz clic en una carta de la mesa.</p>
                            </div>
                            
                            <div className="flex flex-col lg:flex-row gap-8 flex-1">
                                
                                <div className="w-full lg:w-72 bg-slate-800/50 rounded-3xl p-4 border border-slate-700 shrink-0 h-fit flex flex-col">
                                    <h4 className="text-sm font-black text-slate-400 uppercase tracking-widest mb-4 text-center border-b border-slate-700 pb-2">Pendientes por Carta</h4>
                                    <div className="flex flex-col gap-2 flex-1">
                                        {pollaData.players.map(p => {
                                            const hasTurn = p.turn !== null;
                                            return (
                                                <button 
                                                    key={p.id}
                                                    disabled={hasTurn}
                                                    onClick={() => setActivePickerId(p.id)}
                                                    className={`px-4 py-3 rounded-xl font-bold uppercase transition-all flex justify-between items-center ${
                                                        hasTurn ? 'bg-slate-900 border border-slate-800 text-amber-500 opacity-50 cursor-not-allowed' :
                                                        activePickerId === p.id ? 'bg-amber-500 text-slate-900 shadow-[0_0_15px_rgba(245,158,11,0.5)] scale-105' : 'bg-slate-700 text-white hover:bg-slate-600'
                                                    }`}
                                                >
                                                    <span>{p.name}</span>
                                                    {hasTurn && <span className="text-xl font-black">{p.turn}</span>}
                                                </button>
                                            )
                                        })}
                                    </div>
                                    
                                    {/* 🟢 CAJA PARA AGREGAR REZAGADOS EN EL SORTEO */}
                                    {!isLocked && (
                                        <form onSubmit={handleAddPlayer} className="flex gap-2 mt-6 pt-4 border-t border-slate-700 shrink-0">
                                            <input 
                                                type="text" value={newPlayerName} onChange={e => setNewPlayerName(e.target.value)}
                                                placeholder="➕ Agregar tarde..." className="flex-1 bg-slate-900 text-white px-3 py-2 rounded-xl outline-none focus:ring-2 ring-amber-500 text-xs font-bold uppercase border border-slate-700"
                                            />
                                            <button type="submit" className="bg-amber-500 text-slate-900 font-black px-3 rounded-xl hover:bg-amber-400 shadow-md">+</button>
                                        </form>
                                    )}
                                </div>

                                <div className="flex-1 flex flex-wrap justify-center content-start gap-4">
                                    {pollaData.cardPool.map(card => {
                                        const isRevealed = card.assignedTo !== null;
                                        const assignedPlayer = pollaData.players.find(p => p.id === card.assignedTo);
                                        
                                        return (
                                            <div 
                                                key={card.id} 
                                                className="relative w-24 h-36 sm:w-32 sm:h-44 cursor-pointer [perspective:1000px]"
                                                onClick={() => !isRevealed && handlePickCard(card.id)}
                                            >
                                                <div 
                                                    className={`w-full h-full transition-transform duration-700 rounded-2xl ${isRevealed ? '[transform:rotateY(180deg)]' : 'hover:scale-105 hover:-translate-y-2'}`}
                                                    style={{ transformStyle: 'preserve-3d' }}
                                                >
                                                    <div 
                                                        className="absolute inset-0 bg-gradient-to-br from-indigo-600 to-purple-800 border-4 border-indigo-400 rounded-2xl flex items-center justify-center shadow-2xl"
                                                        style={{ backfaceVisibility: 'hidden' }}
                                                    >
                                                        <span className="text-5xl drop-shadow-md">❓</span>
                                                    </div>
                                                    
                                                    <div 
                                                        className="absolute inset-0 bg-slate-800 border-4 border-amber-500 rounded-2xl flex flex-col items-center justify-center shadow-2xl [transform:rotateY(180deg)]"
                                                        style={{ backfaceVisibility: 'hidden' }}
                                                    >
                                                        <span className="text-5xl font-black text-amber-500">{card.turn}</span>
                                                        {assignedPlayer && (
                                                            <span className="text-white text-[10px] sm:text-xs font-bold mt-2 px-1 text-center truncate w-full uppercase bg-slate-900 py-1 rounded w-10/12">
                                                                {assignedPlayer.name}
                                                            </span>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                        )
                                    })}
                                </div>
                            </div>

                            {pollaData.players.every(p => p.turn !== null) && !isLocked && (
                                <div className="text-center pt-8">
                                    <button onClick={startPickingPhase} className="bg-green-500 text-white font-black px-10 py-4 rounded-full text-xl shadow-lg hover:scale-105 transition-transform uppercase tracking-widest">
                                        Ir a la Mesa de Marcadores
                                    </button>
                                </div>
                            )}
                        </div>
                    )}

                    {/* FASE 3: PICKING Y LIVE SUPERVIVAL */}
                    {pollaData.phase === 'PICKING' && (
                        <div className="flex flex-col lg:flex-row gap-8 flex-1 min-h-0">
                            
                            {/* TABLA DE JUGADORES (SUPERVIVENCIA ORDENADA E INTELIGENTE) */}
                            <div className="flex-1 space-y-3 overflow-y-auto pr-2 hide-scrollbar flex flex-col">
                                <h3 className="text-2xl font-black text-amber-500 uppercase border-b border-slate-800 pb-4 mb-4 sticky top-0 bg-slate-900 z-10 shrink-0">
                                    🛡️ POLLEROS
                                </h3>
                                
                                <div className="flex-1 space-y-3">
                                    {sortedPlayers.map(p => {
                                        const isDead = p.status.category === 'DEAD';
                                        const isExact = p.status.category === 'EXACT';
                                        const isOneAway = p.status.category === 'ONE_AWAY';
                                        
                                        return (
                                            <div 
                                                key={p.id} 
                                                onDragOver={e => e.preventDefault()}
                                                onDrop={e => handleDrop(e, p.id)}
                                                className={`flex items-center gap-4 border-2 p-3 sm:p-4 rounded-2xl transition-all duration-300 ${!p.score ? 'border-dashed border-amber-500/50 bg-slate-800/80' : p.status.color}`}
                                            >
                                                <div className={`w-10 h-10 rounded-full flex items-center justify-center font-black border shrink-0 text-xl shadow-sm ${
                                                    isDead ? 'bg-slate-950 border-red-900/50 text-red-500/50' :
                                                    isExact ? 'bg-green-500 text-slate-900 border-green-400' :
                                                    isOneAway ? 'bg-cyan-950 border-cyan-500 text-cyan-400' :
                                                    'bg-slate-950 border-slate-700 text-amber-500'
                                                }`}>
                                                    {p.turn}
                                                </div>
                                                
                                                <div className="flex-1 min-w-0">
                                                    <h4 className={`font-bold text-xl truncate uppercase ${isDead ? 'text-red-400/80 line-through decoration-red-600 decoration-2' : 'text-white'}`}>
                                                        {p.name}
                                                    </h4>
                                                    <p className={`text-[10px] font-black tracking-widest uppercase mt-0.5 ${p.status.color.split(' ')[0]}`}>{p.status.message}</p>
                                                </div>

                                                <div className={`w-24 h-14 rounded-xl border flex items-center justify-center font-black text-3xl shadow-inner shrink-0 transition-transform duration-300 ${
                                                    isDead ? 'bg-slate-950 border-red-900/50 text-red-500/60 line-through decoration-red-600 decoration-4' : 
                                                    isExact ? 'bg-green-950 border-green-500 text-green-400 scale-105' :
                                                    isOneAway ? 'bg-cyan-950 border-cyan-500/50 text-cyan-200' :
                                                    'bg-slate-950 border-slate-700 text-white'
                                                }`}>
                                                    {p.score || '...'}
                                                </div>
                                            </div>
                                        )
                                    })}
                                </div>

                                {/* 🟢 CAJA PARA AGREGAR REZAGADOS EN LA MESA */}
                                {!isLocked && (
                                    <form onSubmit={handleAddPlayer} className="flex gap-2 mt-4 pt-4 border-t border-slate-800 shrink-0">
                                        <input 
                                            type="text" value={newPlayerName} onChange={e => setNewPlayerName(e.target.value)}
                                            placeholder="➕ Agregar jugador tarde..." className="flex-1 bg-slate-950 text-white px-4 py-3 rounded-xl outline-none focus:ring-2 ring-amber-500 text-sm font-bold uppercase border border-slate-700"
                                        />
                                        <button type="submit" className="bg-amber-500 text-slate-900 font-black px-6 rounded-xl hover:bg-amber-400 text-xl shadow-md">+</button>
                                    </form>
                                )}
                            </div>

                            {/* MESA DE MARCADORES MANUAL */}
                            {!isLocked && (
                                <div className="w-full lg:w-[420px] bg-slate-800/30 rounded-3xl p-6 border border-slate-700 flex flex-col shrink-0">
                                    <h3 className="text-lg font-black text-slate-400 uppercase tracking-widest mb-2 text-center">Mesa de Marcadores</h3>
                                    <p className="text-xs text-center text-slate-500 mb-6 leading-tight">Arrastra el marcador hacia la tarjeta del jugador.</p>
                                    
                                    <form onSubmit={handleAddCustomScore} className="flex gap-2 mb-6 border-b border-slate-700 pb-6 shrink-0">
                                        <input 
                                            type="text" value={customScore} onChange={e => setCustomScore(e.target.value)}
                                            placeholder="Goles ej: 8-1" className="w-full bg-slate-900 text-white px-4 py-2 rounded-xl outline-none text-center font-bold tracking-widest border border-slate-700 text-xl"
                                        />
                                        <button type="submit" className="bg-indigo-600 text-white font-black px-6 rounded-xl hover:bg-indigo-500 text-2xl shrink-0 shadow-md transition-transform active:scale-95">+</button>
                                    </form>

                                    <div className="flex flex-wrap gap-2 justify-center overflow-y-auto hide-scrollbar content-start flex-1 pr-2">
                                        {sortedAvailableScores.map(score => {
                                            const isPriority = PRIORITY_SCORES.includes(score);
                                            return (
                                                <div 
                                                    key={score}
                                                    draggable
                                                    onDragStart={e => handleDragStart(e, score)}
                                                    className={`font-black text-xl px-4 py-3 rounded-xl cursor-grab active:cursor-grabbing border shadow-md transition-colors w-[70px] text-center ${
                                                        isPriority 
                                                        ? 'bg-slate-700 hover:bg-amber-500 hover:text-slate-900 text-white border-slate-600' 
                                                        : 'bg-slate-800/50 hover:bg-slate-700 text-slate-400 border-slate-800/50'
                                                    }`}
                                                >
                                                    {score}
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default PollaExpressScreen;