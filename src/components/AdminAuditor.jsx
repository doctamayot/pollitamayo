import React, { useState, useEffect, useMemo } from 'react';
import { db } from '../firebase';
import { collection, onSnapshot, doc, getDoc } from 'firebase/firestore';
import { extraQuestions, specialEvents } from './worldcupcomponents/constants';
import SearchBar from './SearchBar';
import toast from 'react-hot-toast'; // Importamos toast para la alerta visual

const AdminAuditor = () => {
    const [participants, setParticipants] = useState([]);
    const [matches, setMatches] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');

    useEffect(() => {
        // 1. Escuchar participantes
        const unsubUsers = onSnapshot(collection(db, 'worldCupPredictions'), (snapshot) => {
            const usersData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            setParticipants(usersData);
            setLoading(false);
        });

        // 2. Traer partidos de la caché para saber qué auditar
        const fetchMatches = async () => {
            const cacheDoc = await getDoc(doc(db, 'worldCupAdmin', 'apiCache'));
            if (cacheDoc.exists()) setMatches(cacheDoc.data().matches || []);
        };
        fetchMatches();

        return () => unsubUsers();
    }, []);

    // 🟢 LÓGICA DE AUDITORÍA QUIRÚRGICA
    const auditResults = useMemo(() => {
        const groupMatches = matches.filter(m => m.stage === 'GROUP_STAGE');
        
        return participants.map(user => {
            const missing = { groups: {}, knockouts: [], extras: [], events: [], totalCount: 0 };
            const preds = user.predictions || {};
            const ko = user.knockoutPicks || {};
            const ex = user.extraPicks || {};
            const ev = user.eventPicks || {};

            // Auditar Grupos (Partido por partido)
            groupMatches.forEach(m => {
                const gName = (m.group || 'Fase de Grupos').replace('GROUP_', 'Grupo ');
                if (!preds[m.id] || preds[m.id].home === '' || preds[m.id].away === '') {
                    if (!missing.groups[gName]) missing.groups[gName] = 0;
                    missing.groups[gName]++;
                    missing.totalCount++;
                }
            });

            // Auditar Clasificados (Brackets)
            if ((ko.dieciseisavos?.length || 0) < 16) { missing.knockouts.push('16vos'); missing.totalCount++; }
            if ((ko.octavos?.length || 0) < 8) { missing.knockouts.push('Octavos'); missing.totalCount++; }
            if ((ko.cuartos?.length || 0) < 4) { missing.knockouts.push('Cuartos'); missing.totalCount++; }
            if ((ko.semis?.length || 0) < 2) { missing.knockouts.push('Semis'); missing.totalCount++; }
            if (!ko.campeon?.length) { missing.knockouts.push('Campeón'); missing.totalCount++; }

            // Auditar Extras (Pregunta por pregunta)
            extraQuestions.forEach(q => {
                if (!ex[q.id] || ex[q.id] === '') {
                    missing.extras.push(q.label);
                    missing.totalCount++;
                }
            });

            // Auditar Eventos
            specialEvents.forEach(e => {
                if (!ev[e.id] || ev[e.id] === '') {
                    missing.events.push(e.label);
                    missing.totalCount++;
                }
            });

            return { ...user, audit: missing };
        }).filter(u => u.hasPaid); // Solo auditamos a los que ya pagaron
    }, [participants, matches]);

    const filteredAudit = auditResults.filter(u => 
        u.displayName?.toLowerCase().includes(searchTerm.toLowerCase()) || 
        u.email?.toLowerCase().includes(searchTerm.toLowerCase())
    ).sort((a, b) => b.audit.totalCount - a.audit.totalCount); // Los más incompletos arriba

    // 🟢 CREADOR DE REGAÑOS AUTOMÁTICO
    const handleCopyMessage = (userName, audit) => {
        let text = `🚨 *¡Atención @${userName}!* El VAR detecta que tienes predicciones incompletas en la Polla:\n\n`;

        if (Object.keys(audit.groups).length > 0) {
            text += `⚽ *Grupos:* Te faltan llenar marcadores en: ${Object.keys(audit.groups).join(', ')}.\n`;
        }
        if (audit.knockouts.length > 0) {
            text += `🏆 *Bracket:* Te falta completar: ${audit.knockouts.join(', ')}.\n`;
        }
        if (audit.extras.length > 0) {
            text += `⭐ *Extras:* Te faltan ${audit.extras.length} preguntas (Ej: ${audit.extras[0]}).\n`;
        }
        if (audit.events.length > 0) {
            text += `❓ *Eventos:* Te faltan responder ${audit.events.length} eventos del VAR.\n`;
        }

        text += `\n⏳ ¡Entra ya y completa tu Polla antes de que ruede el balón!`;

        // Copiar al portapapeles
        navigator.clipboard.writeText(text).then(() => {
            toast.success('¡Regaño copiado! Pégalo en WhatsApp', { icon: '📋' });
        }).catch(err => {
            console.error('Error al copiar: ', err);
            toast.error('Error al copiar el mensaje');
        });
    };

    if (loading) return <div className="text-center py-20 text-primary font-black animate-pulse">ESCANEANDO BASE DE DATOS...</div>;

    return (
        <div className="max-w-6xl mx-auto pb-20 animate-fade-in px-4">
            <div className="mb-6">
                <SearchBar value={searchTerm} onChange={setSearchTerm} placeholder="Buscar por nombre o correo..." />
            </div>

            <div className="space-y-4">
                {filteredAudit.map(u => (
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
                                    className="bg-[#25D366] hover:bg-[#20ba5c] text-white font-black px-6 py-2.5 rounded-full text-xs flex items-center gap-2 shadow-lg transition-transform active:scale-95 cursor-pointer"
                                >
                                    📋 COPIAR REGAÑO
                                </button>
                            )}
                        </div>

                        {u.audit.totalCount > 0 && (
                            <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 pt-4 border-t border-border/50">
                                {/* GRUPOS */}
                                {Object.keys(u.audit.groups).length > 0 && (
                                    <div className="bg-background-offset/50 p-3 rounded-2xl border border-border">
                                        <p className="text-[10px] font-black text-red-500 uppercase mb-2">⚽ Partidos Faltantes</p>
                                        <ul className="text-[11px] space-y-1 font-bold">
                                            {Object.entries(u.audit.groups).map(([group, count]) => (
                                                <li key={group} className="flex justify-between">{group}: <span className="text-red-500">{count}</span></li>
                                            ))}
                                        </ul>
                                    </div>
                                )}

                                {/* BRACKETS */}
                                {u.audit.knockouts.length > 0 && (
                                    <div className="bg-background-offset/50 p-3 rounded-2xl border border-border">
                                        <p className="text-[10px] font-black text-amber-500 uppercase mb-2">🏆 Bracket Incompleto</p>
                                        <div className="flex flex-wrap gap-1">
                                            {u.audit.knockouts.map(k => <span key={k} className="bg-amber-500/10 text-amber-500 px-2 py-0.5 rounded text-[9px] border border-amber-500/20">{k}</span>)}
                                        </div>
                                    </div>
                                )}

                                {/* EXTRAS */}
                                {u.audit.extras.length > 0 && (
                                    <div className="bg-background-offset/50 p-3 rounded-2xl border border-border">
                                        <p className="text-[10px] font-black text-blue-500 uppercase mb-2">⭐ Extras sin responder</p>
                                        <ul className="text-[9px] text-foreground-muted space-y-0.5 font-medium leading-tight">
                                            {u.audit.extras.map(e => <li key={e}>• {e}</li>)}
                                        </ul>
                                    </div>
                                )}

                                {/* EVENTOS */}
                                {u.audit.events.length > 0 && (
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
                ))}
            </div>
        </div>
    );
};

export default AdminAuditor;