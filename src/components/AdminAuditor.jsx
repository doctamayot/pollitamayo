import React, { useState, useEffect, useMemo } from 'react';
import { db } from '../firebase';
import { collection, onSnapshot, doc, getDoc } from 'firebase/firestore';
import { extraQuestions, specialEvents } from './worldcupcomponents/constants';
import SearchBar from './SearchBar';
import toast from 'react-hot-toast'; 

const FILTERS = [
    { id: 'ALL', label: 'Todos los Faltantes', icon: '🚨' },
    { id: '16VOS', label: 'Faltan 16avos', icon: '🔥' },
    { id: 'OCTAVOS', label: 'Faltan Octavos', icon: '⚔️' },
    { id: 'CUARTOS', label: 'Faltan Cuartos', icon: '🛡️' },
    { id: 'SEMIS', label: 'Faltan Semis', icon: '🎯' },
    { id: 'FINALES', label: 'Falta Podio', icon: '👑' },
];

const AdminAuditor = () => {
    const [participants, setParticipants] = useState([]);
    const [matches, setMatches] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [activeFilter, setActiveFilter] = useState('ALL'); 

    useEffect(() => {
        const unsubUsers = onSnapshot(collection(db, 'worldCupPredictions'), (snapshot) => {
            const usersData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            setParticipants(usersData);
            setLoading(false);
        });

        const fetchMatches = async () => {
            const cacheDoc = await getDoc(doc(db, 'worldCupAdmin', 'apiCache'));
            if (cacheDoc.exists()) setMatches(cacheDoc.data().matches || []);
        };
        fetchMatches();

        return () => unsubUsers();
    }, []);

    const auditResults = useMemo(() => {
        const groupMatches = matches.filter(m => m.stage === 'GROUP_STAGE');
        
        const koMatches = {
            '16vos': matches.filter(m => m.stage === 'LAST_32' || m.stage === 'ROUND_OF_32'),
            'Octavos': matches.filter(m => m.stage === 'LAST_16'),
            'Cuartos': matches.filter(m => m.stage === 'QUARTER_FINALS'),
            'Semis': matches.filter(m => m.stage === 'SEMI_FINALS'),
            'Finales': matches.filter(m => m.stage === 'FINAL' || m.stage === 'THIRD_PLACE')
        };
        
        return participants.map(user => {
            const missing = { groups: {}, bracket: [], koScores: [], extras: [], events: [], totalCount: 0 };
            const preds = user.predictions || {};
            const ko = user.knockoutPicks || {};
            const ex = user.extraPicks || {};
            const ev = user.eventPicks || {};

            groupMatches.forEach(m => {
                const gName = (m.group || 'Fase de Grupos').replace('GROUP_', 'Grupo ');
                if (!preds[m.id] || preds[m.id].home === '' || preds[m.id].away === '') {
                    if (!missing.groups[gName]) missing.groups[gName] = 0;
                    missing.groups[gName]++;
                    missing.totalCount++;
                }
            });

            Object.keys(koMatches).forEach(roundName => {
                const roundMatches = koMatches[roundName];
                if (roundMatches.length > 0) {
                    const hasMissingScore = roundMatches.some(m => !preds[m.id] || preds[m.id].home === '' || preds[m.id].away === '');
                    if (hasMissingScore) {
                        missing.koScores.push(roundName);
                        missing.totalCount++;
                    }
                }
            });

            if ((ko.dieciseisavos?.length || 0) < 16) { missing.bracket.push('16vos'); missing.totalCount++; }
            if ((ko.octavos?.length || 0) < 8) { missing.bracket.push('Octavos'); missing.totalCount++; }
            if ((ko.cuartos?.length || 0) < 4) { missing.bracket.push('Cuartos'); missing.totalCount++; }
            if ((ko.semis?.length || 0) < 2) { missing.bracket.push('Semis'); missing.totalCount++; }
            if (!ko.campeon?.length) { missing.bracket.push('Campeón'); missing.totalCount++; }
            if (!ko.subcampeon?.length) { missing.bracket.push('Subcampeón'); missing.totalCount++; }
            if (!ko.tercero?.length) { missing.bracket.push('Tercer Puesto'); missing.totalCount++; }
            if (!ko.cuarto?.length) { missing.bracket.push('Cuarto Puesto'); missing.totalCount++; }

            extraQuestions.forEach(q => {
                if (!ex[q.id] || ex[q.id] === '') {
                    missing.extras.push(q.label);
                    missing.totalCount++;
                }
            });

            specialEvents.forEach(e => {
                if (!ev[e.id] || ev[e.id] === '') {
                    missing.events.push(e.label);
                    missing.totalCount++;
                }
            });

            return { ...user, audit: missing };
        }).filter(u => u.hasPaid); 
    }, [participants, matches]);

    const filteredAudit = auditResults.filter(u => {
        const matchesSearch = u.displayName?.toLowerCase().includes(searchTerm.toLowerCase()) || 
                              u.email?.toLowerCase().includes(searchTerm.toLowerCase());
        
        if (!matchesSearch) return false;

        if (activeFilter === 'ALL') return true;
        if (activeFilter === '16VOS') return u.audit.koScores.includes('16vos');
        if (activeFilter === 'OCTAVOS') return u.audit.koScores.includes('Octavos');
        if (activeFilter === 'CUARTOS') return u.audit.koScores.includes('Cuartos');
        if (activeFilter === 'SEMIS') return u.audit.koScores.includes('Semis');
        if (activeFilter === 'FINALES') return u.audit.koScores.includes('Finales');
        
        return true;
    }).sort((a, b) => b.audit.totalCount - a.audit.totalCount); 

    const handleCopyMessage = (userName, audit) => {
        let text = "";

        if (activeFilter === 'ALL') {
            text = `🚨 *¡Atención @${userName}!* El VAR detecta que tienes predicciones incompletas en la Polla:\n\n`;
            if (Object.keys(audit.groups).length > 0) {
                text += `⚽ *Fase de Grupos:* Te faltan llenar marcadores en: ${Object.keys(audit.groups).join(', ')}.\n`;
            }
            if (audit.koScores.length > 0) {
                text += `⚔️ *Cruces Directos:* Te faltan MARCADORES de los partidos de: ${audit.koScores.join(', ')}.\n`;
            }
            if (audit.bracket.length > 0) {
                text += `🏆 *Bracket de Clasificados:* Te falta armar el árbol en: ${audit.bracket.join(', ')}.\n`;
            }
            if (audit.extras.length > 0) {
                text += `⭐ *Extras:* Te faltan ${audit.extras.length} preguntas.\n`;
            }
            if (audit.events.length > 0) {
                text += `❓ *Eventos:* Te faltan responder ${audit.events.length} eventos del VAR.\n`;
            }
        } else {
            const phaseName = FILTERS.find(f => f.id === activeFilter).label.replace('Faltan ', '').replace('Falta ', '');
            text = `🚨 *¡Atención @${userName}!* Se acerca la hora cero y el VAR detecta que aún NO has puesto los *MARCADORES* de los partidos de: *${phaseName.toUpperCase()}*.\n\n`;
        }

        text += `\n⏳ ¡Entra ya y completa tu Polla antes de que ruede el balón!`;

        navigator.clipboard.writeText(text).then(() => {
            toast.success(`¡Regaño copiado! Pégalo en WhatsApp`, { icon: '📋' });
        }).catch(err => {
            console.error('Error al copiar: ', err);
            toast.error('Error al copiar el mensaje');
        });
    };

    // 🟢 FUNCIÓN DE AYUDA: Filtra visualmente solo lo que el Admin quiere ver
    const getActiveKoScores = (audit) => {
        if (activeFilter === 'ALL') return audit.koScores;
        const map = { '16VOS': '16vos', 'OCTAVOS': 'Octavos', 'CUARTOS': 'Cuartos', 'SEMIS': 'Semis', 'FINALES': 'Finales' };
        const target = map[activeFilter];
        return audit.koScores.includes(target) ? [target] : [];
    };

    if (loading) return <div className="text-center py-20 text-primary font-black animate-pulse">ESCANEANDO BASE DE DATOS...</div>;

    return (
        <div className="max-w-6xl mx-auto pb-20 animate-fade-in px-4">
            <div className="mb-4">
                <SearchBar value={searchTerm} onChange={setSearchTerm} placeholder="Buscar por nombre o correo..." />
            </div>

            <div className="flex overflow-x-auto hide-scrollbar gap-2 mb-6 pb-2">
                {FILTERS.map(filter => (
                    <button
                        key={filter.id}
                        onClick={() => setActiveFilter(filter.id)}
                        className={`flex items-center gap-1.5 px-4 py-2 rounded-full font-black text-[10px] sm:text-xs whitespace-nowrap transition-all shadow-sm border shrink-0 ${
                            activeFilter === filter.id 
                            ? 'bg-amber-500 text-white border-amber-400 shadow-[0_0_15px_rgba(245,158,11,0.4)] scale-105' 
                            : 'bg-background-offset text-foreground-muted border-border hover:bg-border/30 hover:text-foreground'
                        }`}
                    >
                        <span className="text-sm sm:text-base">{filter.icon}</span> {filter.label}
                    </button>
                ))}
            </div>

            <div className="space-y-4">
                {filteredAudit.length === 0 ? (
                    <div className="bg-green-500/10 border border-green-500/30 p-8 rounded-3xl text-center">
                        <span className="text-4xl block mb-2">✅</span>
                        <h4 className="font-black text-green-500 text-lg">¡Todo en Orden!</h4>
                        <p className="text-green-500/80 text-sm mt-1">
                            {activeFilter === 'ALL' 
                                ? 'Todos los jugadores han completado el 100% de la Polla.' 
                                : `Todos ya llenaron los marcadores para ${FILTERS.find(f => f.id === activeFilter).label.replace('Faltan ', '').replace('Falta ', '')}.`}
                        </p>
                    </div>
                ) : (
                    filteredAudit.map(u => {
                        // 🟢 MODO ENFOQUE: Decidimos qué secciones mostrar según el filtro
                        const showGroups = activeFilter === 'ALL' && Object.keys(u.audit.groups).length > 0;
                        const showBracket = activeFilter === 'ALL' && u.audit.bracket.length > 0;
                        const showExtras = activeFilter === 'ALL' && u.audit.extras.length > 0;
                        const showEvents = activeFilter === 'ALL' && u.audit.events.length > 0;
                        const activeKoScoresToDisplay = getActiveKoScores(u.audit);

                        return (
                            <div key={u.id} className={`bg-card border ${u.audit.totalCount > 0 ? 'border-red-500/30' : 'border-green-500/30'} p-5 rounded-3xl shadow-sm transition-all`}>
                                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                                    <div className="flex items-center gap-4">
                                        <div className="w-12 h-12 rounded-full overflow-hidden border-2 border-border">
                                            {u.photoURL ? <img src={u.photoURL} className="w-full h-full object-cover" alt="User" /> : <div className="w-full h-full flex items-center justify-center bg-background-offset text-xl">👤</div>}
                                        </div>
                                        <div>
                                            <h4 className="font-black text-foreground text-lg leading-none">{u.displayName}</h4>
                                            <p className="text-xs text-foreground-muted mt-1">{u.email}</p>
                                        </div>
                                    </div>

                                    {u.audit.totalCount === 0 ? (
                                        <span className="bg-green-500/10 text-green-500 text-[10px] font-black px-4 py-1.5 rounded-full border border-green-500/20 uppercase tracking-widest">✅ FICHA COMPLETADA</span>
                                    ) : (
                                        <button 
                                            onClick={() => handleCopyMessage(u.displayName, u.audit)}
                                            className="bg-[#25D366] hover:bg-[#20ba5c] text-white font-black px-6 py-2.5 rounded-full text-xs flex items-center gap-2 shadow-lg transition-transform active:scale-95 cursor-pointer shrink-0"
                                        >
                                            📋 COPIAR REGAÑO
                                        </button>
                                    )}
                                </div>

                                {u.audit.totalCount > 0 && (
                                    <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 pt-4 border-t border-border/50">
                                        
                                        {/* GRUPOS FALTANTES (Solo visible en TODOS) */}
                                        {showGroups && (
                                            <div className="bg-background-offset/50 p-3 rounded-2xl border border-border">
                                                <p className="text-[10px] font-black text-red-500 uppercase mb-2">⚽ Fase de Grupos</p>
                                                <ul className="text-[11px] space-y-1 font-bold">
                                                    {Object.entries(u.audit.groups).map(([group, count]) => (
                                                        <li key={group} className="flex justify-between">{group}: <span className="text-red-500">{count} faltan</span></li>
                                                    ))}
                                                </ul>
                                            </div>
                                        )}

                                        {/* MARCADORES ELIMINATORIAS (Se adapta a la pestaña) */}
                                        {activeKoScoresToDisplay.length > 0 && (
                                            <div className="bg-background-offset/50 p-3 rounded-2xl border border-border">
                                                <p className="text-[10px] font-black text-indigo-500 uppercase mb-2">⚔️ Cruces Directos</p>
                                                <div className="flex flex-wrap gap-1">
                                                    {activeKoScoresToDisplay.map(k => <span key={k} className="bg-indigo-500/10 text-indigo-500 px-2 py-0.5 rounded text-[9px] border border-indigo-500/20">Faltan goles en {k}</span>)}
                                                </div>
                                            </div>
                                        )}

                                        {/* BRACKETS FALTANTES (Solo visible en TODOS) */}
                                        {showBracket && (
                                            <div className="bg-background-offset/50 p-3 rounded-2xl border border-border">
                                                <p className="text-[10px] font-black text-amber-500 uppercase mb-2">🏆 Bracket Incompleto</p>
                                                <div className="flex flex-wrap gap-1">
                                                    {u.audit.bracket.map(k => <span key={k} className="bg-amber-500/10 text-amber-500 px-2 py-0.5 rounded text-[9px] border border-amber-500/20">{k}</span>)}
                                                </div>
                                            </div>
                                        )}

                                        {/* EXTRAS (Solo visible en TODOS) */}
                                        {showExtras && (
                                            <div className="bg-background-offset/50 p-3 rounded-2xl border border-border">
                                                <p className="text-[10px] font-black text-blue-500 uppercase mb-2">⭐ Extras sin responder</p>
                                                <ul className="text-[9px] text-foreground-muted space-y-0.5 font-medium leading-tight">
                                                    {u.audit.extras.map(e => <li key={e}>• {e}</li>)}
                                                </ul>
                                            </div>
                                        )}

                                        {/* EVENTOS (Solo visible en TODOS) */}
                                        {showEvents && (
                                            <div className="bg-background-offset/50 p-3 rounded-2xl border border-border">
                                                <p className="text-[10px] font-black text-purple-500 uppercase mb-2">❓ Eventos pendientes</p>
                                                <ul className="text-[9px] text-foreground-muted space-y-0.5 font-medium leading-tight">
                                                    {u.audit.events.map(ev => <li key={ev}>• {ev}</li>)}
                                                </ul>
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        );
                    })
                )}
            </div>
        </div>
    );
};

export default AdminAuditor;