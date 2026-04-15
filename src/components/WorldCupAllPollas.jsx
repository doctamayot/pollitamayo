import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { db } from '../firebase';
import { collection, onSnapshot, doc } from 'firebase/firestore';
import { getWorldCupMatches } from '../services/apiFootball';
import html2pdf from 'html2pdf.js';
import SearchBar from './SearchBar'; // Asegúrate de que la ruta sea correcta

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
    const [searchTerm, setSearchTerm] = useState(''); 
    
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

    const filteredParticipants = useMemo(() => {
        if (!searchTerm) return participants;
        return participants.filter(p => 
            p.displayName?.toLowerCase().includes(searchTerm.toLowerCase())
        );
    }, [participants, searchTerm]);

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

    // 🟢 NUEVO CANDADO: ¿Este usuario específico ya llenó todos sus grupos?
    const isUserGroupStageComplete = useMemo(() => {
        if (!selectedUser) return false;
        const allGroupMatches = Object.values(matchesByGroup).flat();
        if (allGroupMatches.length === 0) return false;
        
        return allGroupMatches.every(m => 
            selectedUser.predictions?.[m.id]?.home !== undefined && 
            selectedUser.predictions?.[m.id]?.home !== '' && 
            selectedUser.predictions?.[m.id]?.away !== undefined && 
            selectedUser.predictions?.[m.id]?.away !== ''
        );
    }, [matchesByGroup, selectedUser]);

    const qualifiedRoundOf32 = useMemo(() => {
        if (!selectedUser) return [];
        // 🟢 FIREWALL: Si no ha llenado sus grupos, no calcules nada (evita la "inercia" alfabética)
        if (!isUserGroupStageComplete) return [];

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
    }, [matchesByGroup, selectedUser, calculateUserStandings, isUserGroupStageComplete]);

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
            margin: [0.5, 0.4], 
            filename: `Dossier_Predicciones_${selectedUser.displayName?.replace(/\s+/g, '_')}.pdf`,
            image: { type: 'jpeg', quality: 1 },
            html2canvas: { 
                scale: 2, 
                useCORS: true, 
                backgroundColor: '#ffffff', 
                windowWidth: 1024,
                scrollY: 0,
                logging: false
            },
            jsPDF: { unit: 'in', format: 'a4', orientation: 'portrait' },
            pagebreak: { mode: ['avoid-all', 'css', 'legacy'] }
        };
        html2pdf().set(opt).from(element).save();
    };

    if (loading) return <div className="text-center py-20 font-black tracking-widest text-primary animate-pulse">CARGANDO EXPEDIENTES...</div>;

    if (selectedUser) {
        const preds = selectedUser.predictions || {};
        const ties = selectedUser.manualTiebreakers || {};

        return (
            <div className="animate-fade-in">
                <style dangerouslySetInnerHTML={{ __html: `
                    .avoid-break { page-break-inside: avoid; break-inside: avoid; }
                    .pdf-table th { border-bottom: 2px solid #e2e8f0; color: #64748b; text-transform: uppercase; font-size: 10px; padding-bottom: 8px; }
                    .pdf-table td { border-bottom: 1px solid #f1f5f9; padding: 8px 0; color: #0f172a; }
                    .pdf-table tr:last-child td { border-bottom: none; }
                    .match-table { width: 100%; border-collapse: collapse; margin-top: 12px; }
                    .match-table td { padding: 8px 4px; vertical-align: middle; border-bottom: 1px dashed #e2e8f0; }
                    .match-table tr:last-child td { border-bottom: none; }
                `}} />

                <div className="flex flex-col sm:flex-row justify-between gap-4 mb-6">
                    <button onClick={() => setSelectedUser(null)} className="bg-background-offset text-foreground font-bold px-6 py-3 rounded-full hover:bg-border transition border border-border">⬅️ Volver a la lista</button>
                    <button onClick={handleDownloadPDF} className="bg-amber-500 hover:bg-amber-400 text-white font-black px-6 py-3 rounded-full shadow-lg transition transform hover:scale-105">📄 Descargar PDF Oficial</button>
                </div>

                <div id="pdf-report" className="p-8 sm:p-12 mx-auto w-full max-w-[1024px]" style={{ backgroundColor: '#ffffff', color: '#0f172a', fontFamily: "'Inter', system-ui, sans-serif" }}>
                    
                    {/* ENCABEZADO DOSSIER */}
                    <div className="flex items-center gap-6 mb-8 pb-6" style={{ borderBottom: '3px solid #d97706' }}>
                        {selectedUser.photoURL ? (
                            <img src={selectedUser.photoURL} alt="Avatar" className="w-20 h-20 rounded-full object-cover shadow-md" style={{ border: '3px solid #d97706' }} />
                        ) : (
                            <div className="w-20 h-20 rounded-full flex items-center justify-center text-4xl shadow-md" style={{ backgroundColor: '#f1f5f9', border: '3px solid #d97706' }}>👤</div>
                        )}
                        <div>
                            <h2 className="text-3xl sm:text-4xl font-black uppercase tracking-tighter leading-none mb-1" style={{ color: '#0f172a' }}>
                                {selectedUser.displayName || 'Jugador Anónimo'}
                            </h2>
                            <p className="text-sm font-black uppercase tracking-widest" style={{ color: '#d97706' }}>Dossier Oficial de Predicciones • Mundial 2026</p>
                        </div>
                    </div>

                    {/* SECCIÓN 1: FASE DE GRUPOS */}
                    <div className="mb-10">
                        <h3 className="text-lg font-black uppercase tracking-widest mb-6" style={{ color: '#334155', borderBottom: '1px solid #e2e8f0', paddingBottom: '8px' }}>
                            1. Fase de Grupos
                        </h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            {Object.keys(matchesByGroup).sort().map(group => {
                                const standings = calculateUserStandings(matchesByGroup[group], preds, ties, group);
                                return (
                                    <div key={group} className="avoid-break p-5 rounded-2xl" style={{ backgroundColor: '#f8fafc', border: '1px solid #e2e8f0' }}>
                                        <h4 className="text-sm font-black text-center mb-4 uppercase tracking-widest" style={{ color: '#d97706' }}>{group}</h4>
                                        
                                        <table className="w-full text-xs pdf-table mb-2">
                                            <thead>
                                                <tr>
                                                    <th className="text-left font-black">Equipo</th>
                                                    <th className="text-center font-black">PJ</th>
                                                    <th className="text-center font-black">DG</th>
                                                    <th className="text-center font-black" style={{ color: '#d97706' }}>PTS</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {standings.map((t, idx) => (
                                                    <tr key={t.name}>
                                                        <td className="text-left font-bold" style={{ color: idx < 2 ? '#166534' : '#334155' }}>
                                                            {idx + 1}. {translateTeam(t.name)}
                                                        </td>
                                                        <td className="text-center font-medium">{t.pj}</td>
                                                        <td className="text-center font-medium">{t.dg > 0 ? `+${t.dg}` : t.dg}</td>
                                                        <td className="text-center font-black text-sm" style={{ color: '#d97706' }}>{t.pts}</td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>

                                        <table className="match-table text-xs font-bold" style={{ color: '#475569' }}>
                                            <tbody>
                                                {matchesByGroup[group].map(m => {
                                                    const hScore = preds[m.id]?.home ?? '-';
                                                    const aScore = preds[m.id]?.away ?? '-';
                                                    return (
                                                        <tr key={m.id}>
                                                            <td className="w-[40%] text-right pr-2 leading-tight" style={{ wordBreak: 'break-word' }}>
                                                                {translateTeam(m.homeTeam?.name)}
                                                            </td>
                                                            <td className="w-[20%] text-center">
                                                                <span className="inline-block px-1.5 py-1 rounded" style={{ backgroundColor: '#f1f5f9', border: '1px solid #cbd5e1', color: '#0f172a', fontWeight: '900', whiteSpace: 'nowrap' }}>
                                                                    {hScore} - {aScore}
                                                                </span>
                                                            </td>
                                                            <td className="w-[40%] text-left pl-2 leading-tight" style={{ wordBreak: 'break-word' }}>
                                                                {translateTeam(m.awayTeam?.name)}
                                                            </td>
                                                        </tr>
                                                    );
                                                })}
                                            </tbody>
                                        </table>
                                    </div>
                                );
                            })}
                        </div>
                    </div>

                    {/* SECCIÓN 2: LOS 32 CLASIFICADOS */}
                    <div className="avoid-break mb-10">
                        <h3 className="text-lg font-black uppercase tracking-widest mb-6" style={{ color: '#334155', borderBottom: '1px solid #e2e8f0', paddingBottom: '8px' }}>
                            2. Clasificados a 16vos
                        </h3>
                        {isUserGroupStageComplete ? (
                            <div className="flex flex-wrap gap-3 p-5 rounded-2xl" style={{ backgroundColor: '#f8fafc', border: '1px solid #e2e8f0' }}>
                                {qualifiedRoundOf32.map((t, idx) => (
                                    <div key={idx} className="px-3 py-1.5 rounded-lg flex items-center gap-2 shadow-sm" style={{ backgroundColor: '#ffffff', border: '1px solid #cbd5e1' }}>
                                        <span className="text-xs font-bold" style={{ color: '#0f172a' }}>{translateTeam(t.name)}</span>
                                        <span className="text-[9px] font-black uppercase px-1.5 py-0.5 rounded" style={{ color: '#b45309', backgroundColor: '#fef3c7' }}>{t.qualReason} {t.group.replace('Grupo ', '')}</span>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div className="text-center p-6 rounded-2xl" style={{ backgroundColor: '#f8fafc', border: '1px dashed #cbd5e1', color: '#64748b' }}>
                                <span className="text-2xl block mb-2">🚧</span>
                                <p className="text-sm font-bold">El jugador aún no ha terminado de pronosticar su Fase de Grupos.</p>
                            </div>
                        )}
                    </div>

                    {/* SECCIÓN 3: FASE ELIMINATORIA */}
                    <div className="mb-10">
                        <h3 className="text-lg font-black uppercase tracking-widest mb-6" style={{ color: '#334155', borderBottom: '1px solid #e2e8f0', paddingBottom: '8px' }}>
                            3. Fase Eliminatoria
                        </h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            {['LAST_32', 'LAST_16', 'QUARTER_FINALS', 'SEMI_FINALS', 'FINALS'].map(stage => {
                                if (!knockoutMatches[stage] || knockoutMatches[stage].length === 0) return null;
                                return (
                                    <div key={stage} className="avoid-break p-5 rounded-2xl" style={{ backgroundColor: '#ffffff', border: '1px solid #e2e8f0', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
                                        <h4 className="text-sm font-black text-center mb-4 uppercase tracking-widest" style={{ color: '#d97706' }}>{roundTranslations[stage]}</h4>
                                        
                                        <table className="match-table text-xs font-bold" style={{ color: '#334155' }}>
                                            <tbody>
                                                {knockoutMatches[stage].map(m => {
                                                    const hTeam = getTeamName(m, 'home', preds);
                                                    const aTeam = getTeamName(m, 'away', preds);
                                                    const hScore = preds[m.id]?.home ?? '-';
                                                    const aScore = preds[m.id]?.away ?? '-';
                                                    return (
                                                        <tr key={m.id}>
                                                            <td className="w-[40%] text-right pr-2 leading-tight" style={{ wordBreak: 'break-word' }}>
                                                                {translateTeam(hTeam)}
                                                            </td>
                                                            <td className="w-[20%] text-center">
                                                                <span className="inline-block px-1.5 py-1 rounded" style={{ backgroundColor: '#f1f5f9', border: '1px solid #cbd5e1', color: '#0f172a', fontWeight: '900', whiteSpace: 'nowrap' }}>
                                                                    {hScore} - {aScore}
                                                                </span>
                                                            </td>
                                                            <td className="w-[40%] text-left pl-2 leading-tight" style={{ wordBreak: 'break-word' }}>
                                                                {translateTeam(aTeam)}
                                                            </td>
                                                        </tr>
                                                    );
                                                })}
                                            </tbody>
                                        </table>
                                    </div>
                                );
                            })}
                        </div>
                    </div>

                    {/* SECCIÓN 4: PODIO Y AVANCES */}
                    <div className="mb-10">
                        <h3 className="text-lg font-black uppercase tracking-widest mb-6" style={{ color: '#334155', borderBottom: '1px solid #e2e8f0', paddingBottom: '8px' }}>
                            4. Predicción de Podio & Avances
                        </h3>
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                            {['campeon', 'subcampeon', 'tercero', 'cuarto', 'semis', 'cuartos', 'octavos'].map(round => {
                                const teams = selectedUser.knockoutPicks?.[round];
                                if (!teams || teams.length === 0) return null;
                                return (
                                    <div key={round} className="avoid-break p-4 rounded-xl" style={{ backgroundColor: '#f8fafc', border: '1px solid #e2e8f0' }}>
                                        <h4 className="text-xs font-black uppercase mb-3 text-center" style={{ color: '#475569' }}>{roundTranslations[round]}</h4>
                                        <div className="flex flex-wrap justify-center gap-2">
                                            {teams.map(t => (
                                                <span key={t.name} className="px-2.5 py-1 rounded text-[11px] font-bold shadow-sm" style={{ backgroundColor: '#ffffff', border: '1px solid #cbd5e1', color: '#0f172a' }}>
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
                        <div>
                            <h3 className="text-lg font-black uppercase tracking-widest mb-4" style={{ color: '#334155', borderBottom: '1px solid #e2e8f0', paddingBottom: '8px' }}>
                                5. Extras
                            </h3>
                            <div className="flex flex-col gap-2 p-5 rounded-2xl" style={{ backgroundColor: '#f8fafc', border: '1px solid #e2e8f0' }}>
                                {Object.entries(selectedUser.extraPicks || {}).map(([key, val]) => (
                                    <div key={key} className="flex justify-between items-center text-xs pb-2" style={{ borderBottom: '1px dashed #e2e8f0' }}>
                                        <span className="font-bold uppercase" style={{ color: '#64748b' }}>{key.replace(/_/g, ' ')}</span>
                                        <span className="font-black text-right" style={{ color: '#0f172a' }}>{translateTeam(val) || '-'}</span>
                                    </div>
                                ))}
                            </div>
                        </div>

                        <div>
                            <h3 className="text-lg font-black uppercase tracking-widest mb-4" style={{ color: '#334155', borderBottom: '1px solid #e2e8f0', paddingBottom: '8px' }}>
                                6. Eventos Especiales
                            </h3>
                            <div className="flex flex-col gap-2 p-5 rounded-2xl" style={{ backgroundColor: '#f8fafc', border: '1px solid #e2e8f0' }}>
                                {Object.entries(selectedUser.eventPicks || {}).map(([key, val]) => (
                                    <div key={key} className="flex justify-between items-center text-xs pb-2" style={{ borderBottom: '1px dashed #e2e8f0' }}>
                                        <span className="font-bold uppercase" style={{ color: '#64748b' }}>{key.replace(/_/g, ' ')}</span>
                                        <span className="font-black px-2 py-0.5 rounded shadow-sm text-[10px]" style={{ backgroundColor: val === 'SI' ? '#dcfce7' : '#fee2e2', color: val === 'SI' ? '#166534' : '#991b1b', border: val === 'SI' ? '1px solid #bbf7d0' : '1px solid #fecaca' }}>
                                            {val || '-'}
                                        </span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>

                    {/* PIE DE PÁGINA */}
                    <div className="mt-12 text-center pt-6" style={{ borderTop: '2px solid #e2e8f0' }}>
                        <p className="text-[10px] font-black uppercase tracking-widest" style={{ color: '#94a3b8' }}>Generado por PolliTamayo Premium Edition</p>
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

            {/* AQUÍ INYECTAMOS EL BUSCADOR INTELIGENTE */}
            <SearchBar 
                value={searchTerm} 
                onChange={setSearchTerm} 
                placeholder="Buscar por nombre de jugador..." 
            />

            {/* MOSTRAMOS MENSAJE SI NO HAY RESULTADOS */}
            {filteredParticipants.length === 0 && searchTerm !== '' ? (
                <div className="text-center py-10 bg-background-offset border border-border rounded-3xl shadow-inner mt-4">
                    <span className="text-4xl block mb-3">👻</span>
                    <h3 className="font-bold text-foreground">No encontramos a nadie</h3>
                    <p className="text-foreground-muted text-sm">Nadie coincide con "{searchTerm}"</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                    {filteredParticipants.map(p => (
                        <div key={p.id} className="bg-card border border-card-border p-5 rounded-3xl shadow-sm flex flex-col items-center text-center group hover:border-primary/50 transition-all">
                            <div className="w-16 h-16 rounded-full bg-background-offset border-2 border-border flex items-center justify-center text-2xl mb-3 group-hover:border-primary transition-colors overflow-hidden">
                                {p.photoURL ? <img src={p.photoURL} alt="" className="w-full h-full object-cover" /> : '👤'}
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
            )}
        </div>
    );
};

export default WorldCupAllPollas;