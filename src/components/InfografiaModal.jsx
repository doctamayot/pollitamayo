import React, { useRef } from 'react';
import { toPng } from 'html-to-image';
import toast from 'react-hot-toast';

// 🟢 DICCIONARIO DE TRADUCCIONES OFICIALES
const teamTranslations = {
    "Albania": "Albania", "Algeria": "Argelia", "Argentina": "Argentina", "Australia": "Australia", 
    "Austria": "Austria", "Belgium": "Bélgica", "Bolivia": "Bolivia", "Bosnia and Herzegovina": "Bosnia y Herzegovina",
    "Brazil": "Brasil", "Bulgaria": "Bulgaria", "Cameroon": "Camerún", "Canada": "Canadá", "Cape Verde Islands": "Cabo Verde",
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
    "Poland": "Polonia", "Portugal": "Portugal", "Catar": "Catar", "Qatar": "Catar", "Republic of Ireland": "República de Irlanda", 
    "Romania": "Rumania", "Russia": "Rusia", "Saudi Arabia": "Arabia Saudita", "Scotland": "Escocia", 
    "Senegal": "Senegal", "Serbia": "Serbia", "Slovakia": "Eslovaquia", "Slovenia": "Eslovenia", 
    "South Africa": "Sudáfrica", "South Korea": "Corea del Sur", "Spain": "España", "Sweden": "Suecia", 
    "Switzerland": "Suiza", "Tunisia": "Túnez", "Turkey": "Turquía", "Ukraine": "Ucrania", 
    "United Arab Emirates": "Emiratos Árabes Unidos", "United States": "Estados Unidos", 
    "Uruguay": "Uruguay", "Venezuela": "Venezuela", "Wales": "Gales", "Por definir": "Por definir", "TBD": "Por definir"
};

const translateTeam = (name) => teamTranslations[name] || name;

// 🟢 PUENTE MÁGICO EN ALTA RESOLUCIÓN
const getProxyUrl = (url) => {
    if (!url) return null;
    return `https://wsrv.nl/?url=${encodeURIComponent(url)}&output=png&w=256&h=256&fit=contain`;
};

// 🟢 DETECTOR INTELIGENTE DE PUNTAJE GLOBAL ACUMULADO
const getGlobalPoints = (u) => {
    if (u.points !== undefined && u.points !== null) return Number(u.points);
    if (u.totalPoints !== undefined && u.totalPoints !== null) return Number(u.totalPoints);
    if (u.totalPts !== undefined && u.totalPts !== null) return Number(u.totalPts);
    if (u.score !== undefined && u.score !== null) return Number(u.score);
    if (u.acumulado !== undefined && u.acumulado !== null) return Number(u.acumulado);
    return 0;
};

// 🟢 RENDERIZADOR DE ETIQUETAS ALINEADO A LA IZQUIERDA
const renderPlayerBadges = (arr) => {
    if (arr.length === 0) return <span className="text-slate-400 font-medium italic text-[10px] mt-1 block">Ninguno</span>;
    return (
        <div className="flex flex-wrap justify-start gap-1 w-full mt-1.5">
            {arr.map((u, i) => (
                <span key={i} className="bg-white border border-slate-200 text-slate-800 text-[9px] font-black px-1.5 py-0.5 rounded shadow-sm whitespace-nowrap">
                    {u.name.split(' ')[0]}
                </span>
            ))}
        </div>
    );
};

const InfografiaModal = ({ data, onClose }) => {
    const cardRef = useRef(null);

    if (!data) return null;

    const { ranking, adminPreds, homeCrest, awayCrest, finalHomeName, finalAwayName } = data;

    const localTraducido = translateTeam(finalHomeName);
    const visitanteTraducido = translateTeam(finalAwayName);

    const homeScore = parseInt(adminPreds?.home ?? 0);
    const awayScore = parseInt(adminPreds?.away ?? 0);

    // 🟢 CLASIFICACIÓN DE PARTICIPANTES EN ESTE PARTIDO
    const perfectos = ranking.filter(u => u.pts === 5); 
    const ganadores = ranking.filter(u => u.pts === 2 || u.pts === 3); 
    const parciales = ranking.filter(u => u.pts === 1); 
    const perdedores = ranking.filter(u => u.pts === 0); 

    // 🟢 ENCONTRAR LÍDERES DE LA GENERAL
    const maxGlobalPoints = ranking.length > 0 ? Math.max(...ranking.map(getGlobalPoints)) : 0;
    const globalLeaders = ranking.filter(u => getGlobalPoints(u) === maxGlobalPoints);

    const renderVictoryText = () => {
        if (homeScore > awayScore) {
            return (
                <div className="flex items-center justify-center gap-1.5 flex-wrap text-slate-900 font-black text-sm sm:text-base">
                    VICTORIA DE {homeCrest && <img src={getProxyUrl(homeCrest)} crossOrigin="anonymous" className="w-[18px] h-[18px] object-contain inline-block" alt=""/>} {localTraducido.toUpperCase()}
                </div>
            );
        }
        if (awayScore > homeScore) {
            return (
                <div className="flex items-center justify-center gap-1.5 flex-wrap text-slate-900 font-black text-sm sm:text-base">
                    VICTORIA DE {awayCrest && <img src={getProxyUrl(awayCrest)} crossOrigin="anonymous" className="w-[18px] h-[18px] object-contain inline-block" alt=""/>} {visitanteTraducido.toUpperCase()}
                </div>
            );
        }
        return (
            <div className="flex items-center justify-center gap-1.5 flex-wrap text-slate-900 font-black text-sm sm:text-base">
                EMPATE ENTRE {homeCrest && <img src={getProxyUrl(homeCrest)} crossOrigin="anonymous" className="w-[18px] h-[18px] object-contain inline-block" alt=""/>} Y {awayCrest && <img src={getProxyUrl(awayCrest)} crossOrigin="anonymous" className="w-[18px] h-[18px] object-contain inline-block" alt=""/>}
            </div>
        );
    };

    const MiniFlag = ({ crest, name }) => (
        <span className="inline-flex items-center gap-0.5 bg-slate-200/60 px-1 py-0.5 rounded text-slate-900 font-black mx-0.5 align-middle">
            {crest && <img src={getProxyUrl(crest)} crossOrigin="anonymous" className="w-3 h-3 object-contain shrink-0" alt=""/>}
            <span>{name}</span>
        </span>
    );

    const descargarImagen = () => {
        if (cardRef.current === null) return;
        toast.loading("Procesando infografía HD...", { id: 'img-toast' });
        
        toPng(cardRef.current, { cacheBust: true, useCORS: true, quality: 1, pixelRatio: 2 })
            .then((dataUrl) => {
                const link = document.createElement('a');
                link.download = `PolliTamayo_${localTraducido}_vs_${visitanteTraducido}.png`;
                link.href = dataUrl;
                link.click();
                toast.success("¡Infografía guardada! Lista para WhatsApp 🚀", { id: 'img-toast' });
            })
            .catch((err) => {
                console.error(err);
                toast.error("Error al exportar la imagen", { id: 'img-toast' });
            });
    };

    return (
        <div className="fixed inset-0 z-[100] bg-slate-900/90 backdrop-blur-md flex items-center justify-center p-2 sm:p-4 overflow-y-auto">
            <div className="relative w-full max-w-[460px] my-auto pt-6 pb-4">
                
                <button onClick={onClose} className="absolute top-0 right-0 text-white/50 hover:text-white font-black text-xs z-50 flex items-center gap-1 transition-colors tracking-widest">
                    ✕ CERRAR
                </button>

                {/* CONTENEDOR DE LA INFOGRAFÍA */}
                <div ref={cardRef} className="bg-[#f8fafc] overflow-hidden relative w-full rounded-3xl shadow-2xl" style={{ fontFamily: '"Inter", sans-serif' }}>
                    
                    {/* FONDO DE CANCHA TÁCTICA */}
                    <div className="absolute inset-0 opacity-[0.03] pointer-events-none" style={{ backgroundImage: 'radial-gradient(circle, #0f172a 1px, transparent 1px)', backgroundSize: '20px 24px' }}></div>
                    <div className="absolute inset-0 opacity-[0.02] pointer-events-none overflow-hidden">
                        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-48 h-48 border-[3px] border-slate-900 rounded-full"></div>
                        <div className="absolute top-1/2 left-0 w-full h-[3px] bg-slate-900 -translate-y-1/2"></div>
                    </div>

                    {/* Cabecera Principal */}
                    <div className="pt-5 pb-2 px-4 text-center relative z-10">
                        <h2 className="text-[10px] font-black text-slate-500 uppercase tracking-widest leading-none">
                            RESULTADOS OFICIALES POLLITAMAYO
                        </h2>
                        <h1 className="text-[20px] sm:text-[24px] font-black text-slate-900 uppercase tracking-tighter leading-none mt-1">
                            {localTraducido} VS. {visitanteTraducido}
                        </h1>
                    </div>

                    {/* MARCADOR TIPO TABLERO (SOLO BANDERAS) */}
                    <div className="mx-4 sm:mx-8 bg-gradient-to-b from-[#c4f068] to-[#42c56a] p-1 rounded-xl shadow-md relative z-10 border-b-[3px] border-[#36a655]">
                        <div className="bg-[#112d26] rounded-lg py-4 px-6 flex items-center justify-center gap-6 relative overflow-hidden">
                            
                            {/* Bandera Local */}
                            <div className="w-12 h-12 sm:w-14 sm:h-14 flex items-center justify-center shrink-0">
                                {homeCrest ? <img src={getProxyUrl(homeCrest)} crossOrigin="anonymous" className="w-full h-full object-contain filter drop-shadow-md" alt="" /> : <span className="text-3xl">🛡️</span>}
                            </div>
                            
                            {/* Marcador Números */}
                            <div className="flex items-center gap-2">
                                <div className="bg-[#1e3639] w-12 h-16 rounded-md flex items-center justify-center text-3xl sm:text-4xl font-black text-white shadow-inner">
                                    <span>{homeScore}</span>
                                </div>
                                <span className="text-white/30 text-xl font-black">-</span>
                                <div className="bg-[#1e3639] w-12 h-16 rounded-md flex items-center justify-center text-3xl sm:text-4xl font-black text-white shadow-inner">
                                    <span>{awayScore}</span>
                                </div>
                            </div>

                            {/* Bandera Visitante */}
                            <div className="w-12 h-12 sm:w-14 sm:h-14 flex items-center justify-center shrink-0">
                                {awayCrest ? <img src={getProxyUrl(awayCrest)} crossOrigin="anonymous" className="w-full h-full object-contain filter drop-shadow-md" alt="" /> : <span className="text-3xl">🛡️</span>}
                            </div>
                        </div>
                    </div>

                    {/* Crónica central breve */}
                    <div className="px-6 pt-3 pb-1 text-center relative z-10">
                        {renderVictoryText()}
                    </div>

                    {/* 👑 TABLERO: LÍDERES EN VIVO DE LA GENERAL */}
                    <div className="mx-4 sm:mx-6 mb-3 bg-slate-900 border border-slate-800 text-white rounded-xl p-3 shadow-sm relative overflow-hidden z-10 text-center">
                        <h4 className="text-[9px] font-black text-amber-400 uppercase tracking-widest mb-1 flex items-center justify-center gap-1">
                            👑 LÍDER(ES) DE LA GENERAL
                        </h4>
                        <div className="flex flex-wrap justify-center gap-1 mt-0.5">
                            {globalLeaders.length > 0 ? (
                                globalLeaders.map((leader, idx) => (
                                    <span key={idx} className="bg-amber-500/10 border border-amber-500/20 text-amber-300 font-black text-[9px] px-2 py-0.5 rounded-md shadow-sm">
                                        🥇 {leader.name.split(' ')[0]} <span className="text-white font-normal">({maxGlobalPoints} pts)</span>
                                    </span>
                                ))
                            ) : (
                                <span className="text-slate-500 text-[9px] italic">No hay puntajes registrados.</span>
                            )}
                        </div>
                    </div>

                    {/* 📋 SECCIÓN: INFOGRAFÍAS EN FILAS CON IMÁGENES TEMÁTICAS REPOTENCIADAS */}
                    <div className="flex flex-col gap-3 px-4 sm:px-6 pb-5 relative z-10">
                        
                        {/* FILA 1: PERFECTOS (5 PUNTOS) */}
                        <div className="border-2 border-[#c0e6a3] bg-[#eefaf0] rounded-2xl p-3 flex gap-3 items-start text-left shadow-sm">
                            {/* Ícono Alusivo con Medalla de Puntos */}
                            <div className="w-12 h-12 bg-gradient-to-br from-amber-400 to-amber-600 rounded-full flex items-center justify-center shrink-0 shadow-md mt-0.5 relative text-2xl border border-white/20">
                                🏆
                                <span className="absolute -bottom-1 -right-1 bg-slate-950 text-white text-[7px] font-black px-1 py-0.5 rounded-md border border-white leading-none shadow-sm">5 PTS</span>
                            </div>
                            <div className="flex-1 min-w-0">
                                <h4 className="text-[10px] font-black text-slate-800 uppercase leading-none mb-0.5">
                                    {perfectos.length} PERFECTOS <span className="text-emerald-700 text-[8px] font-medium tracking-wide ml-1">— MARCADOR EXACTO</span>
                                </h4>
                                <p className="text-[9px] text-slate-700 font-medium leading-tight">
                                    ¡Élite táctica! Clavaron con exactitud el resultado de {homeScore}-{awayScore} entre <MiniFlag crest={homeCrest} name={localTraducido} /> y <MiniFlag crest={awayCrest} name={visitanteTraducido} />.
                                </p>
                                {renderPlayerBadges(perfectos)}
                            </div>
                        </div>

                        {/* FILA 2: TENDENCIA (2-3 PUNTOS) */}
                        <div className="border-2 border-[#8adfb8] bg-[#f0fcf7] rounded-2xl p-3 flex gap-3 items-start text-left shadow-sm">
                            {/* Ícono Alusivo con Medalla de Puntos */}
                            <div className="w-12 h-12 bg-gradient-to-br from-emerald-400 to-teal-600 rounded-full flex items-center justify-center shrink-0 shadow-md mt-0.5 relative text-2xl border border-white/20">
                                🎯
                                <span className="absolute -bottom-1 -right-1 bg-slate-950 text-white text-[7px] font-black px-1 py-0.5 rounded-md border border-white leading-none shadow-sm">2-3 PTS</span>
                            </div>
                            <div className="flex-1 min-w-0">
                                <h4 className="text-[10px] font-black text-slate-800 uppercase leading-none mb-0.5">
                                    {ganadores.length} ACIERTOS <span className="text-teal-700 text-[8px] font-medium tracking-wide ml-1">— TENDENCIA</span>
                                </h4>
                                <p className="text-[9px] text-slate-700 font-medium leading-tight">
                                    Supieron anticipar el desenlace apoyando la tendencia a favor de {homeScore > awayScore ? <MiniFlag crest={homeCrest} name={localTraducido} /> : awayScore > homeScore ? <MiniFlag crest={awayCrest} name={visitanteTraducido} /> : <span className="font-bold text-slate-800">un empate</span>}.
                                </p>
                                {renderPlayerBadges(ganadores)}
                            </div>
                        </div>

                        {/* FILA 3: PARCIALES (1 PUNTO) */}
                        <div className="border-2 border-[#b3cce6] bg-[#f0f6fc] rounded-2xl p-3 flex gap-3 items-start text-left shadow-sm">
                            {/* Ícono Alusivo con Medalla de Puntos */}
                            <div className="w-12 h-12 bg-gradient-to-br from-blue-400 to-indigo-600 rounded-full flex items-center justify-center shrink-0 shadow-md mt-0.5 relative text-2xl border border-white/20">
                                ⚽
                                <span className="absolute -bottom-1 -right-1 bg-slate-950 text-white text-[7px] font-black px-1 py-0.5 rounded-md border border-white leading-none shadow-sm">1 PT</span>
                            </div>
                            <div className="flex-1 min-w-0">
                                <h4 className="text-[10px] font-black text-slate-800 uppercase leading-none mb-0.5">
                                    {parciales.length} PARCIALES <span className="text-blue-700 text-[8px] font-medium tracking-wide ml-1">— RESCATE DE GOLES</span>
                                </h4>
                                <p className="text-[9px] text-slate-700 font-medium leading-tight">
                                    ¡Salvados! Lograron rescatar una unidad de consolación al adivinar los goles exactos de <MiniFlag crest={homeCrest} name={localTraducido} /> o <MiniFlag crest={awayCrest} name={visitanteTraducido} />.
                                </p>
                                {renderPlayerBadges(parciales)}
                            </div>
                        </div>

                        {/* FILA 4: SIN PUNTOS (0 PUNTOS) */}
                        <div className="border-2 border-slate-300 bg-slate-50 rounded-2xl p-3 flex gap-3 items-start text-left shadow-sm">
                            {/* Ícono Alusivo con Medalla de Puntos */}
                            <div className="w-12 h-12 bg-gradient-to-br from-slate-400 to-slate-500 rounded-full flex items-center justify-center shrink-0 shadow-md mt-0.5 relative text-2xl border border-white/20">
                                🥶
                                <span className="absolute -bottom-1 -right-1 bg-slate-950 text-white text-[7px] font-black px-1 py-0.5 rounded-md border border-white leading-none shadow-sm">0 PTS</span>
                            </div>
                            <div className="flex-1 min-w-0">
                                <h4 className="text-[10px] font-black text-slate-800 uppercase leading-none mb-0.5">
                                    {perdedores.length} SIN PUNTOS <span className="text-slate-500 text-[8px] font-medium tracking-wide ml-1">— SIN ACIERTOS</span>
                                </h4>
                                <p className="text-[9px] text-slate-600 font-medium leading-tight">
                                    ¡Día negro! Fallaron por completo en su lectura del encuentro entre <MiniFlag crest={homeCrest} name={localTraducido} /> y <MiniFlag crest={awayCrest} name={visitanteTraducido} />.
                                </p>
                                {renderPlayerBadges(perdedores)}
                            </div>
                        </div>

                    </div>
                    
                    {/* Pie de Imagen */}
                    <div className="text-center py-2 text-[9px] font-black text-slate-400 bg-white/50 uppercase tracking-[0.2em] relative z-10 border-t border-slate-100">
                        ⚽ PolliTamayo 2026
                    </div>
                </div>

                {/* BOTÓN DE DESCARGAR */}
                <button 
                    onClick={descargarImagen}
                    className="w-full mt-4 bg-[#25D366] text-white font-black text-xs py-3.5 rounded-xl shadow-md hover:bg-[#20b958] transition-colors flex items-center justify-center gap-2 uppercase tracking-widest border-b-[3px] border-[#1ca851]"
                >
                    <span>📲</span> Descargar Infografía HD
                </button>

                {/* BOTÓN CERRAR INFERIOR */}
                <button 
                    onClick={onClose}
                    className="w-full mt-2 bg-slate-800 hover:bg-slate-700 text-white border border-slate-700/50 font-black text-xs py-2.5 rounded-xl shadow-sm transition-colors flex items-center justify-center gap-2 uppercase tracking-widest"
                >
                    ✕ Cerrar Ventana
                </button>

            </div>
        </div>
    );
};

export default InfografiaModal;