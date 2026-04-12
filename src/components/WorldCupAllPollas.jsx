import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { db } from '../firebase';
import { collection, onSnapshot } from 'firebase/firestore';
import { getWorldCupMatches } from '../services/apiFootball';
import html2pdf from 'html2pdf.js';

const teamTranslations = {
    "Albania": "Albania", "Algeria": "Argelia", "Argentina": "Argentina", "Australia": "Australia", 
    "Austria": "Austria", "Belgium": "Bélgica", "Bolivia": "Bolivia", "Bosnia and Herzegovina": "Bosnia y Herzegovina",
    "Brazil": "Brasil", "Bulgaria": "Bulgaria", "Cameroon": "Camerún", "Canada": "Canadá", 
    "Chile": "Chile", "China": "China", "Colombia": "Colombia", "Costa Rica": "Costa Rica", 
    "Croatia": "Croacia", "Czechia": "República Checa", "Czech Republic": "República Checa", 
    "Denmark": "Dinamarca", "Ecuador": "Ecuador", "Egypt": "Egipto", "El Salvador": "El Salvador", 
    "England": "Inglaterra", "France": "Francia", "Germany": "Alemania", "Ghana": "Ghana", 
    "Greece": "Grecia", "Guatemala": "Guatemala", "Honduras": "Honduras", "Hungary": "Hungría", 
    "Iceland": "Islandia", "Iran": "Irán", "Ireland": "Irlanda", "Italy": "Italia", 
    "Ivory Coast": "Costa de Marfil", "Cote d'Ivoire": "Costa de Marfil", "Jamaica": "Jamaica", 
    "Japan": "Japón", "Mexico": "México", "Morocco": "Marruecos", "Netherlands": "Países Bajos", 
    "New Zealand": "Nueva Zelanda", "Nigeria": "Nigeria", "North Korea": "Corea del Norte", 
    "Norway": "Noruega", "Panama": "Panamá", "Paraguay": "Paraguay", "Peru": "Perú", 
    "Poland": "Polonia", "Portugal": "Portugal", "Qatar": "Catar", "Republic of Ireland": "República de Irlanda", 
    "Romania": "Rumania", "Russia": "Rusia", "Saudi Arabia": "Arabia Saudita", "Scotland": "Escocia", 
    "Senegal": "Senegal", "Serbia": "Serbia", "Slovakia": "Eslovaquia", "Slovenia": "Eslovaquia", 
    "South Africa": "Sudáfrica", "South Korea": "Corea del Sur", "Spain": "España", "Sweden": "Suecia", 
    "Switzerland": "Suiza", "Tunisia": "Túnez", "Turkey": "Turquía", "Ukraine": "Ucrania", 
    "United Arab Emirates": "Emiratos Árabes Unidos", "United States": "Estados Unidos", 
    "Uruguay": "Uruguay", "Venezuela": "Venezuela", "Wales": "Gales", "Por definir": "Por definir", "TBD": "Por definir"
};

const translateTeam = (name) => teamTranslations[name] || name;

const roundTranslations = {
    'LAST_32': '16vos de Final',
    'LAST_16': 'Octavos de Final',
    'QUARTER_FINALS': 'Cuartos de Final',
    'SEMI_FINALS': 'Semifinales',
    'FINALS': 'Gran Final / 3er Puesto',
    'octavos': 'Clasificados a Octavos',
    'cuartos': 'Clasificados a Cuartos',
    'semis': 'Clasificados a Semis',
    'campeon': 'Campeón',
    'subcampeon': 'Subcampeón',
    'tercero': 'Tercer Puesto',
    'cuarto': 'Cuarto Puesto'
};

const WorldCupAllPollas = () => {
    const [participants, setParticipants] = useState([]);
    const [selectedUser, setSelectedUser] = useState(null);
    const [loading, setLoading] = useState(true);
    
    const [matchesByGroup, setMatchesByGroup] = useState({});
    const [knockoutMatches, setKnockoutMatches] = useState({
        LAST_32: [], LAST_16: [], QUARTER_FINALS: [], SEMI_FINALS: [], FINALS: []
    });

    useEffect(() => {
        const unsubscribe = onSnapshot(collection(db, 'worldCupPredictions'), (snapshot) => {
            const usersData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            setParticipants(usersData);
            setLoading(false);
        });

        const fetchMatches = async () => {
            try {
                const data = await getWorldCupMatches();
                if (data && data.matches) {
                    const grouped = {};
                    const ko = { LAST_32: [], LAST_16: [], QUARTER_FINALS: [], SEMI_FINALS: [], FINALS: [] };
                    data.matches.forEach(m => {
                        if (m.stage === 'GROUP_STAGE') {
                            let gName = m.group || 'Fase de Grupos';
                            gName = gName.replace('GROUP_', 'Grupo ');
                            if (!grouped[gName]) grouped[gName] = [];
                            grouped[gName].push(m);
                        } 
                        else if (m.stage === 'LAST_32' || m.stage === 'ROUND_OF_32') ko.LAST_32.push(m);
                        else if (m.stage === 'LAST_16') ko.LAST_16.push(m);
                        else if (m.stage === 'QUARTER_FINALS') ko.QUARTER_FINALS.push(m);
                        else if (m.stage === 'SEMI_FINALS') ko.SEMI_FINALS.push(m);
                        else if (m.stage === 'FINAL' || m.stage === 'THIRD_PLACE') ko.FINALS.push(m);
                    });
                    
                    Object.keys(grouped).forEach(k => grouped[k].sort((a, b) => new Date(a.utcDate) - new Date(b.utcDate)));
                    Object.keys(ko).forEach(k => ko[k].sort((a, b) => new Date(a.utcDate) - new Date(b.utcDate)));

                    setMatchesByGroup(grouped);
                    setKnockoutMatches(ko);
                }
            } catch (err) {
                console.error("Error al cargar partidos:", err);
            }
        };
        fetchMatches();

        return () => unsubscribe();
    }, []);

    const calculateUserStandings = useCallback((groupMatches, preds, manualTiebreakers, groupName) => {
        if (!groupMatches) return [];
        const teams = {};
        
        groupMatches.forEach(m => {
            const home = m.homeTeam?.name || 'TBD';
            const away = m.awayTeam?.name || 'TBD';
            if (!teams[home]) teams[home] = { name: home, pj: 0, gf: 0, gc: 0, dg: 0, pts: 0 };
            if (!teams[away]) teams[away] = { name: away, pj: 0, gf: 0, gc: 0, dg: 0, pts: 0 };
        });

        groupMatches.forEach(m => {
            const pred = preds[m.id];
            if (pred && pred.home !== '' && pred.home !== undefined && pred.away !== '' && pred.away !== undefined) {
                const hG = parseInt(pred.home, 10);
                const aG = parseInt(pred.away, 10);
                const home = m.homeTeam.name;
                const away = m.awayTeam.name;

                teams[home].pj++; teams[away].pj++;
                teams[home].gf += hG; teams[away].gf += aG;
                teams[home].gc += aG; teams[away].gc += hG;
                teams[home].dg = teams[home].gf - teams[home].gc;
                teams[away].dg = teams[away].gf - teams[away].gc;

                if (hG > aG) teams[home].pts += 3;
                else if (hG < aG) teams[away].pts += 3;
                else { teams[home].pts++; teams[away].pts++; }
            }
        });

        return Object.values(teams).sort((a, b) => {
            if (b.pts !== a.pts) return b.pts - a.pts;
            if (b.dg !== a.dg) return b.dg - a.dg;
            if (b.gf !== a.gf) return b.gf - a.gf;
            const tieA = manualTiebreakers?.[groupName]?.[a.name] || 99;
            const tieB = manualTiebreakers?.[groupName]?.[b.name] || 99;
            if (tieA !== tieB) return tieA - tieB;
            return translateTeam(a.name).localeCompare(translateTeam(b.name));
        });
    }, []);

    const qualifiedRoundOf32 = useMemo(() => {
        if (!selectedUser) return [];
        const preds = selectedUser.predictions || {};
        const manualTies = selectedUser.manualTiebreakers || {};
        let top2 = []; let thirds = [];
        
        Object.keys(matchesByGroup).forEach(gn => {
            const st = calculateUserStandings(matchesByGroup[gn], preds, manualTies, gn);
            if (st[0]) top2.push({ ...st[0], group: gn, qualReason: '1º' });
            if (st[1]) top2.push({ ...st[1], group: gn, qualReason: '2º' });
            if (st[2]) thirds.push({ ...st[2], group: gn, qualReason: 'Mejor 3º' });
        });
        thirds.sort((a, b) => b.pts - a.pts || b.dg - a.dg || b.gf - a.gf);
        return [...top2, ...thirds.slice(0, 8)];
    }, [matchesByGroup, selectedUser, calculateUserStandings]);

    const getTeamName = (match, side, preds) => {
        const original = match[side + 'Team']?.name;
        if (!original || original === 'TBD' || original.includes('Winner') || original.includes('Loser')) {
            return preds?.[match.id]?.[side === 'home' ? 'customHomeTeam' : 'customAwayTeam'] || 'TBD';
        }
        return original;
    };

    const handleDownloadPDF = () => {
        const element = document.getElementById('pdf-report');
        const opt = {
            margin: [0.4, 0.4], 
            filename: `Polla_Mundial_${selectedUser.displayName?.replace(/\s+/g, '_')}.pdf`,
            image: { type: 'jpeg', quality: 1 },
            html2canvas: { 
                scale: 2, 
                useCORS: true, 
                backgroundColor: '#0f172a',
                windowWidth: 1024 // Para que en PC y celular se dibuje grande y claro
            },
            jsPDF: { unit: 'in', format: 'a4', orientation: 'portrait' }
        };
        html2pdf().set(opt).from(element).save();
    };

    if (loading) return <div className="text-center py-20 font-black tracking-widest text-primary">CARGANDO POLLAS...</div>;

    if (selectedUser) {
        const preds = selectedUser.predictions || {};
        const ties = selectedUser.manualTiebreakers || {};

        return (
            <div className="animate-fade-in">
                <style dangerouslySetInnerHTML={{ __html: `
                    .avoid-break { page-break-inside: avoid; }
                `}} />

                <div className="flex flex-col sm:flex-row justify-between gap-4 mb-6">
                    <button onClick={() => setSelectedUser(null)} className="bg-background-offset text-foreground font-bold px-6 py-3 rounded-full hover:bg-border transition border border-border">⬅️ Volver a la lista</button>
                    <button onClick={handleDownloadPDF} className="bg-amber-500 hover:bg-amber-400 text-white font-black px-6 py-3 rounded-full shadow-lg transition transform hover:scale-105">📄 Descargar PDF</button>
                </div>

                {/* CONTENEDOR DEL PDF - Eliminadas todas las clases de Tailwind de bordes, sombras y colores de fondo. TODO ES INLINE. */}
                <div id="pdf-report" className="p-6 sm:p-10 rounded-2xl mx-auto w-full max-w-[1024px]" style={{ backgroundColor: '#0f172a', color: '#f8fafc', border: '1px solid #334155' }}>
                    
                    {/* ENCABEZADO RESPONSIVE */}
                    <div className="flex flex-col sm:flex-row items-center sm:items-start justify-center sm:justify-start gap-4 mb-6 pb-6 text-center sm:text-left" style={{ borderBottom: '1px solid #334155' }}>
                        <div className="w-20 h-20 rounded-full flex items-center justify-center text-4xl shrink-0" style={{ backgroundColor: '#1e293b', border: '3px solid #f59e0b' }}>
                            👤
                        </div>
                        <div>
                            <h2 className="text-3xl sm:text-4xl font-black uppercase tracking-widest leading-none mb-2" style={{ color: '#f59e0b' }}>
                                {selectedUser.displayName || 'Jugador'}
                            </h2>
                            <p className="text-base font-bold uppercase tracking-wider" style={{ color: '#94a3b8' }}>Reporte Oficial de Predicciones - Mundial 2026</p>
                        </div>
                    </div>

                    {/* SECCIÓN 1: FASE DE GRUPOS */}
                    <div className="mb-10">
                        <h3 className="text-lg sm:text-xl font-black p-3 rounded-xl text-center mb-6" style={{ backgroundColor: '#1e293b', color: '#f8fafc' }}>
                            Fase de Grupos: Tablas y Marcadores
                        </h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            {Object.keys(matchesByGroup).sort().map(group => {
                                const standings = calculateUserStandings(matchesByGroup[group], preds, ties, group);
                                return (
                                    <div key={group} className="avoid-break p-4 sm:p-5 rounded-2xl" style={{ backgroundColor: '#020617', border: '1px solid #334155' }}>
                                        <h4 className="text-sm sm:text-base font-black text-center mb-4 pb-2 uppercase tracking-widest" style={{ color: '#f59e0b', borderBottom: '1px solid #334155' }}>{group}</h4>
                                        
                                        <table className="w-full text-xs sm:text-sm mb-5">
                                            <thead>
                                                <tr>
                                                    <th className="text-left pb-2 font-bold" style={{ color: '#94a3b8', borderBottom: '1px solid #1e293b' }}>Equipo</th>
                                                    <th className="text-center pb-2 font-bold" style={{ color: '#94a3b8', borderBottom: '1px solid #1e293b' }}>PJ</th>
                                                    <th className="text-center pb-2 font-bold" style={{ color: '#94a3b8', borderBottom: '1px solid #1e293b' }}>DG</th>
                                                    <th className="text-center pb-2 font-black" style={{ color: '#f59e0b', borderBottom: '1px solid #1e293b' }}>PTS</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {standings.map((t, idx) => (
                                                    <tr key={t.name}>
                                                        <td className="text-left font-bold py-1.5" style={{ color: idx < 2 ? '#22c55e' : '#f8fafc', borderBottom: '1px solid #1e293b' }}>{translateTeam(t.name).substring(0, 15)}</td>
                                                        <td className="text-center py-1.5 font-medium" style={{ borderBottom: '1px solid #1e293b' }}>{t.pj}</td>
                                                        <td className="text-center py-1.5 font-medium" style={{ borderBottom: '1px solid #1e293b' }}>{t.dg > 0 ? `+${t.dg}` : t.dg}</td>
                                                        <td className="text-center font-black py-1.5 text-base" style={{ color: '#f59e0b', borderBottom: '1px solid #1e293b' }}>{t.pts}</td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>

                                        <div className="flex flex-col gap-1.5">
                                            {matchesByGroup[group].map(m => {
                                                const hScore = preds[m.id]?.home ?? '-';
                                                const aScore = preds[m.id]?.away ?? '-';
                                                return (
                                                    <div key={m.id} className="flex justify-between items-center text-xs sm:text-sm py-1.5" style={{ borderBottom: '1px dashed #1e293b' }}>
                                                        <span className="w-[40%] text-right font-bold truncate pr-2" style={{ color: '#f8fafc' }}>{translateTeam(m.homeTeam?.name)}</span>
                                                        <span className="w-[20%] text-center font-black rounded py-0.5" style={{ color: '#38bdf8', backgroundColor: '#1e293b' }}>{hScore} - {aScore}</span>
                                                        <span className="w-[40%] text-left font-bold truncate pl-2" style={{ color: '#f8fafc' }}>{translateTeam(m.awayTeam?.name)}</span>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>

                    {/* SECCIÓN 2: LOS 32 CLASIFICADOS A 16VOS */}
                    <div className="avoid-break mb-10">
                        <h3 className="text-lg sm:text-xl font-black p-3 rounded-xl text-center mb-6" style={{ backgroundColor: '#1e293b', color: '#f8fafc' }}>
                            Los 32 Clasificados (Cálculo Automático)
                        </h3>
                        <div className="flex flex-wrap justify-center gap-3 p-5 rounded-2xl" style={{ backgroundColor: '#020617', border: '1px solid #334155' }}>
                            {qualifiedRoundOf32.map((t, idx) => (
                                <div key={idx} className="px-3 py-1.5 rounded flex items-center gap-2" style={{ backgroundColor: '#1e293b', border: '1px solid #334155' }}>
                                    <span className="text-xs sm:text-sm font-bold" style={{ color: '#fff' }}>{translateTeam(t.name)}</span>
                                    <span className="text-[9px] sm:text-[10px] font-black uppercase px-1.5 rounded" style={{ color: '#f59e0b', backgroundColor: '#0f172a' }}>{t.qualReason} {t.group.replace('Grupo ', '')}</span>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* SECCIÓN 3: FASE ELIMINATORIA (MARCADORES) */}
                    <div className="mb-10">
                        <h3 className="text-lg sm:text-xl font-black p-3 rounded-xl text-center mb-6" style={{ backgroundColor: '#1e293b', color: '#f8fafc' }}>
                            Fase Eliminatoria: Marcadores
                        </h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            {['LAST_32', 'LAST_16', 'QUARTER_FINALS', 'SEMI_FINALS', 'FINALS'].map(stage => {
                                if (!knockoutMatches[stage] || knockoutMatches[stage].length === 0) return null;
                                return (
                                    <div key={stage} className="avoid-break p-4 sm:p-5 rounded-2xl" style={{ backgroundColor: '#020617', border: '1px solid #334155' }}>
                                        <h4 className="text-sm sm:text-base font-black text-center mb-4 pb-2 uppercase tracking-widest" style={{ color: '#f59e0b', borderBottom: '1px solid #334155' }}>{roundTranslations[stage]}</h4>
                                        <div className="flex flex-col gap-1.5">
                                            {knockoutMatches[stage].map(m => {
                                                const hTeam = getTeamName(m, 'home', preds);
                                                const aTeam = getTeamName(m, 'away', preds);
                                                const hScore = preds[m.id]?.home ?? '-';
                                                const aScore = preds[m.id]?.away ?? '-';
                                                return (
                                                    <div key={m.id} className="flex justify-between items-center text-xs sm:text-sm py-2" style={{ borderBottom: '1px dashed #1e293b' }}>
                                                        <span className="w-[40%] text-right font-bold truncate pr-2" style={{ color: '#f8fafc' }}>{translateTeam(hTeam)}</span>
                                                        <span className="w-[20%] text-center font-black rounded py-0.5" style={{ color: '#fbbf24', backgroundColor: '#1e293b' }}>{hScore} - {aScore}</span>
                                                        <span className="w-[40%] text-left font-bold truncate pl-2" style={{ color: '#f8fafc' }}>{translateTeam(aTeam)}</span>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>

                    {/* SECCIÓN 4: EQUIPOS SELECCIONADOS POR EL USUARIO */}
                    <div className="mb-10">
                        <h3 className="text-lg sm:text-xl font-black p-3 rounded-xl text-center mb-6" style={{ backgroundColor: '#1e293b', color: '#f8fafc' }}>
                            Equipos Seleccionados & Podio Final
                        </h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                            {['octavos', 'cuartos', 'semis', 'campeon', 'subcampeon', 'tercero', 'cuarto'].map(round => {
                                const teams = selectedUser.knockoutPicks?.[round];
                                if (!teams || teams.length === 0) return null;
                                return (
                                    <div key={round} className="avoid-break p-4 sm:p-5 rounded-2xl" style={{ backgroundColor: '#020617', border: '1px solid #334155' }}>
                                        <h4 className="text-sm font-black uppercase mb-3 text-center" style={{ color: '#38bdf8' }}>{roundTranslations[round]}</h4>
                                        <div className="flex flex-wrap justify-center gap-2">
                                            {teams.map(t => (
                                                <span key={t.name} className="px-3 py-1.5 rounded text-xs font-bold" style={{ backgroundColor: '#1e293b', border: '1px solid #334155', color: '#f8fafc' }}>
                                                    {translateTeam(t.name)}
                                                </span>
                                            ))}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>

                    {/* SECCIÓN 5: EXTRAS Y EVENTOS */}
                    <div className="avoid-break grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="p-5 rounded-2xl" style={{ backgroundColor: '#020617', border: '1px solid #334155' }}>
                            <h3 className="text-sm sm:text-base font-black mb-4 pb-2 uppercase tracking-widest text-center" style={{ color: '#f59e0b', borderBottom: '1px solid #334155' }}>Preguntas Extras</h3>
                            <div className="flex flex-col gap-3">
                                {Object.entries(selectedUser.extraPicks || {}).map(([key, val]) => (
                                    <div key={key} className="flex justify-between items-center text-xs sm:text-sm p-2 rounded" style={{ backgroundColor: '#1e293b' }}>
                                        <span className="font-bold uppercase" style={{ color: '#94a3b8' }}>{key.replace(/_/g, ' ')}</span>
                                        <span className="font-black text-right" style={{ color: '#fff' }}>{translateTeam(val) || '-'}</span>
                                    </div>
                                ))}
                            </div>
                        </div>

                        <div className="p-5 rounded-2xl" style={{ backgroundColor: '#020617', border: '1px solid #334155' }}>
                            <h3 className="text-sm sm:text-base font-black mb-4 pb-2 uppercase tracking-widest text-center" style={{ color: '#f59e0b', borderBottom: '1px solid #334155' }}>Eventos Especiales</h3>
                            <div className="flex flex-col gap-3">
                                {Object.entries(selectedUser.eventPicks || {}).map(([key, val]) => (
                                    <div key={key} className="flex justify-between items-center text-xs sm:text-sm p-2 rounded" style={{ backgroundColor: '#1e293b' }}>
                                        <span className="font-bold uppercase" style={{ color: '#94a3b8' }}>{key.replace(/_/g, ' ')}</span>
                                        <span className="font-black px-2 py-0.5 rounded" style={{ backgroundColor: val === 'SI' ? '#166534' : '#991b1b', color: '#fff' }}>{val || '-'}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>

                    {/* PIE DE PÁGINA DEL PDF */}
                    <div className="mt-10 text-center pt-6" style={{ borderTop: '1px solid #334155' }}>
                        <p className="text-xs font-bold uppercase tracking-widest" style={{ color: '#64748b' }}>Generado por PolliTamayo Premium Edition - 2026</p>
                    </div>

                </div>
            </div>
        );
    }

    return (
        <div className="animate-fade-in">
            <div className="mb-8 text-center">
                <h2 className="text-3xl font-black text-foreground uppercase tracking-tighter mb-2">Pollas Públicas</h2>
                <p className="text-foreground-muted text-sm">El administrador ha habilitado la vista pública. Revisa y descarga los pronósticos de tus rivales.</p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                {participants.map(p => (
                    <div key={p.id} className="bg-card border border-card-border p-5 rounded-3xl shadow-sm flex flex-col items-center text-center group hover:border-primary/50 transition-all">
                        <div className="w-16 h-16 rounded-full bg-background-offset border-2 border-border flex items-center justify-center text-2xl mb-3 group-hover:border-primary transition-colors">
                            👤
                        </div>
                        <h3 className="font-bold text-foreground text-sm truncate w-full">{p.displayName || 'Jugador'}</h3>
                        <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded-full mt-2 mb-4 ${p.hasPaid ? 'bg-green-500/10 text-green-500' : 'bg-red-500/10 text-red-500'}`}>
                            {p.hasPaid ? 'Habilitado' : 'Pendiente'}
                        </span>
                        
                        <button 
                            onClick={() => setSelectedUser(p)}
                            className="w-full bg-background-offset text-primary border border-primary/20 hover:bg-primary/10 font-bold py-2 rounded-xl text-xs transition-colors"
                        >
                            Ver Expediente 📂
                        </button>
                    </div>
                ))}
            </div>
        </div>
    );
};

export default WorldCupAllPollas;