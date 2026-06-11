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
    "Norway": "Panamá", "Panama": "Panamá", "Paraguay": "Paraguay", "Peru": "Perú", 
    "Poland": "Polonia", "Portugal": "Portugal", "Qatar": "Catar", "Republic of Ireland": "República de Irlanda", 
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

// 🟢 FILTRO MÁXIMO DE JUGADORES
const renderList = (arr, max = 5) => {
    if (arr.length === 0) return 'Ninguno';
    const names = arr.slice(0, max).map(u => u.name.split(' ')[0]).join(', ');
    return arr.length > max ? `${names} y ${arr.length - max} más` : names;
};

const InfografiaModal = ({ data, onClose }) => {
    const cardRef = useRef(null);

    if (!data) return null;

    const { ranking, adminPreds, homeCrest, awayCrest, finalHomeName, finalAwayName } = data;

    const localTraducido = translateTeam(finalHomeName);
    const visitanteTraducido = translateTeam(finalAwayName);

    const homeScore = parseInt(adminPreds?.home ?? 0);
    const awayScore = parseInt(adminPreds?.away ?? 0);

    // 🟢 CLASIFICACIÓN EXACTA DE PARTICIPANTES
    const perfectos = ranking.filter(u => u.pts === 5); 
    const ganadores = ranking.filter(u => u.pts === 2 || u.pts === 3); 
    const parciales = ranking.filter(u => u.pts === 1); 
    const perdedores = ranking.filter(u => u.pts === 0); 

    // Titular Central de Victoria / Empate Dinámico
    const renderVictoryText = () => {
        if (homeScore > awayScore) {
            return (
                <div className="flex items-center justify-center gap-2 flex-wrap text-slate-900 font-black">
                    VICTORIA DE {homeCrest && <img src={getProxyUrl(homeCrest)} crossOrigin="anonymous" className="w-5 h-5 object-contain drop-shadow-sm inline-block" alt=""/>} {localTraducido.toUpperCase()}
                </div>
            );
        }
        if (awayScore > homeScore) {
            return (
                <div className="flex items-center justify-center gap-2 flex-wrap text-slate-900 font-black">
                    VICTORIA DE {awayCrest && <img src={getProxyUrl(awayCrest)} crossOrigin="anonymous" className="w-5 h-5 object-contain drop-shadow-sm inline-block" alt=""/>} {visitanteTraducido.toUpperCase()}
                </div>
            );
        }
        return (
            <div className="flex items-center justify-center gap-2 flex-wrap text-slate-900 font-black">
                EMPATE ENTRE {homeCrest && <img src={getProxyUrl(homeCrest)} crossOrigin="anonymous" className="w-5 h-5 object-contain inline-block" alt=""/>} Y {awayCrest && <img src={getProxyUrl(awayCrest)} crossOrigin="anonymous" className="w-5 h-5 object-contain inline-block" alt=""/>}
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
            <div className="relative w-full max-w-[500px] my-auto pt-8 pb-6">
                
                {/* Botón Cerrar Superior (Se mantiene) */}
                <button onClick={onClose} className="absolute top-0 right-0 text-white/50 hover:text-white font-black text-xl z-50 flex items-center gap-2 transition-colors">
                    ✕ <span className="text-sm tracking-widest">CERRAR</span>
                </button>

                {/* 🟢 CONTENEDOR DE LA INFOGRAFÍA */}
                <div ref={cardRef} className="bg-[#f8fafc] overflow-hidden relative w-full rounded-none sm:rounded-3xl shadow-2xl" style={{ fontFamily: '"Inter", sans-serif' }}>
                    
                    {/* FONDO DE CANCHA TÁCTICA */}
                    <div className="absolute inset-0 opacity-[0.04] pointer-events-none" style={{ backgroundImage: 'radial-gradient(circle, #0f172a 1px, transparent 1px)', backgroundSize: '24px 24px' }}></div>
                    <div className="absolute inset-0 opacity-[0.03] pointer-events-none overflow-hidden">
                        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-64 h-64 border-[4px] border-slate-900 rounded-full"></div>
                        <div className="absolute top-1/2 left-0 w-full h-[4px] bg-slate-900 -translate-y-1/2"></div>
                        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-48 h-24 border-[4px] border-slate-900 border-t-0 rounded-b-[2rem]"></div>
                        <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-48 h-24 border-[4px] border-slate-900 border-b-0 rounded-t-[2rem]"></div>
                    </div>

                    {/* Cabecera Principal */}
                    <div className="pt-8 pb-4 px-6 text-center relative z-10">
                        <h2 className="text-[11px] sm:text-[13px] font-black text-slate-800 uppercase tracking-widest leading-tight">
                            RESULTADOS OFICIALES POLLITAMAYO
                        </h2>
                        <h1 className="text-[22px] sm:text-[30px] font-black text-slate-900 uppercase tracking-tighter leading-none mt-1">
                            {localTraducido} VS. {visitanteTraducido}
                        </h1>
                    </div>

                    {/* MARCADOR TIPO TABLERO */}
                    <div className="mx-4 sm:mx-10 bg-gradient-to-b from-[#c4f068] to-[#42c56a] p-1.5 rounded-2xl shadow-lg relative z-10 border-b-[4px] border-[#36a655]">
                        <div className="bg-[#112d26] rounded-xl py-5 px-2 sm:px-4 flex items-center justify-center gap-2 sm:gap-6 relative overflow-hidden">
                            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-32 h-3 bg-white/10 rounded-b-full"></div>

                            {/* Escudo Local */}
                            <div className="flex flex-col items-center w-[65px] sm:w-[80px]">
                                {homeCrest ? <img src={getProxyUrl(homeCrest)} crossOrigin="anonymous" className="w-10 h-10 sm:w-14 sm:h-14 object-contain drop-shadow-md" alt="" /> : <span className="text-3xl">🛡️</span>}
                                <span className="text-white font-black text-[9px] sm:text-xs uppercase text-center mt-2 leading-tight tracking-wide truncate w-full">
                                    {localTraducido}
                                </span>
                            </div>
                            
                            {/* Marcador Numeros */}
                            <div className="flex items-center gap-2">
                                <div className="bg-[#1e3639] w-12 h-16 sm:w-16 sm:h-20 rounded-lg flex items-center justify-center text-4xl sm:text-5xl font-black text-white shadow-inner relative overflow-hidden">
                                    <span className="relative z-10">{homeScore}</span>
                                </div>
                                <span className="text-white/30 text-2xl font-black">-</span>
                                <div className="bg-[#1e3639] w-12 h-16 sm:w-16 sm:h-20 rounded-lg flex items-center justify-center text-4xl sm:text-5xl font-black text-white shadow-inner relative overflow-hidden">
                                    <span className="relative z-10">{awayScore}</span>
                                </div>
                            </div>

                            {/* Escudo Visitante */}
                            <div className="flex flex-col items-center w-[65px] sm:w-[80px]">
                                {awayCrest ? <img src={getProxyUrl(awayCrest)} crossOrigin="anonymous" className="w-10 h-10 sm:w-14 sm:h-14 object-contain drop-shadow-md" alt="" /> : <span className="text-3xl">🛡️</span>}
                                <span className="text-white font-black text-[9px] sm:text-xs uppercase text-center mt-2 leading-tight tracking-wide truncate w-full">
                                    {visitanteTraducido}
                                </span>
                            </div>
                        </div>
                    </div>

                    {/* Crónica central breve */}
                    <div className="px-6 pt-5 pb-4 text-center relative z-10 border-b border-slate-200/60 mx-6">
                        <h3 className="font-black text-slate-800 text-[15px] sm:text-xl uppercase tracking-tight mb-2">
                            {renderVictoryText()}
                        </h3>
                        <p className="text-slate-600 text-[10px] sm:text-xs leading-relaxed font-medium">
                            La batalla ha concluido. Este es el balance oficial de puntos asignados en la arena de PolliTamayo 2026. ¡Revisa tu posición en el ranking general!
                        </p>
                    </div>

                    {/* Título de la Grilla */}
                    <div className="text-center pt-6 pb-6 relative z-10">
                        <h3 className="text-slate-800 font-black uppercase tracking-widest text-[12px] sm:text-[14px]">Desempeño de los Participantes</h3>
                    </div>

                    {/* CUADRÍCULA 2x2 */}
                    <div className="grid grid-cols-2 gap-3 px-4 sm:px-6 pb-8 relative z-10 items-stretch">
                        
                        {/* CÁPSULA 1: PLENO MÁXIMO (5 PUNTOS) */}
                        <div className="border-[3px] border-[#c0e6a3] bg-[#eefaf0] rounded-[2rem] pt-8 pb-4 px-2 flex flex-col items-center text-center relative shadow-sm">
                            <div className="absolute -top-6 w-12 h-12 bg-white border-[3px] border-[#81d471] rounded-t-full rounded-b-full flex flex-col items-center justify-center shadow-sm">
                                <span className="text-slate-800 font-black text-lg leading-none">5</span>
                            </div>
                            
                            <h4 className="text-[9px] font-black text-slate-800 uppercase leading-tight h-6 flex items-center justify-center mb-1">
                                {perfectos.length} PERFECTOS
                            </h4>
                            
                            <div className="my-1.5 text-3xl">🏆</div>
                            <span className="text-[8px] font-black text-slate-800 uppercase tracking-wide mt-1 mb-1.5">MARCADOR EXACTO</span>
                            
                            <p className="text-[8px] text-slate-700 font-medium leading-tight mb-2 px-1 flex-grow">
                                ¡Élite táctica! Clavaron con exactitud el resultado de {homeScore}-{awayScore} entre <MiniFlag crest={homeCrest} name={localTraducido} /> y <MiniFlag crest={awayCrest} name={visitanteTraducido} />.
                            </p>

                            <div className="text-[8px] font-bold text-slate-600 bg-white/80 px-2 py-1.5 rounded-xl w-full border border-white shadow-[inset_0_2px_4px_rgba(0,0,0,0.02)] overflow-hidden">
                                {renderList(perfectos)}
                            </div>
                        </div>

                        {/* CÁPSULA 2: TENDENCIA ACERTADA (2-3 PUNTOS) */}
                        <div className="border-[3px] border-[#8adfb8] bg-[#f0fcf7] rounded-[2rem] pt-8 pb-4 px-2 flex flex-col items-center text-center relative shadow-sm">
                            <div className="absolute -top-6 w-12 h-12 bg-white border-[3px] border-[#43c489] rounded-b-xl rounded-t-md flex flex-col items-center justify-center shadow-sm">
                                <span className="text-slate-800 font-black text-lg leading-none">2-3</span>
                            </div>
                            
                            <h4 className="text-[9px] font-black text-slate-800 uppercase leading-tight h-6 flex items-center justify-center mb-1">
                                {ganadores.length} ACIERTOS
                            </h4>
                            
                            <div className="my-1.5 text-3xl">✅</div>
                            <span className="text-[8px] font-black text-slate-800 uppercase tracking-wide mt-1 mb-1.5">SOLO TENDENCIA</span>
                            
                            <p className="text-[8px] text-slate-700 font-medium leading-tight mb-2 px-1 flex-grow">
                                Supieron anticipar el desenlace apoyando la tendencia a favor de {homeScore > awayScore ? <MiniFlag crest={homeCrest} name={localTraducido} /> : awayScore > homeScore ? <MiniFlag crest={awayCrest} name={visitanteTraducido} /> : <span className="font-bold text-slate-800">ambos (empate)</span>}.
                            </p>

                            <div className="text-[8px] font-bold text-slate-600 bg-white/80 px-2 py-1.5 rounded-xl w-full border border-white shadow-[inset_0_2px_4px_rgba(0,0,0,0.02)] overflow-hidden">
                                {renderList(ganadores)}
                            </div>
                        </div>

                        {/* CÁPSULA 3: RESCATE PARCIAL (1 PUNTO) */}
                        <div className="border-[3px] border-[#b3cce6] bg-[#f0f6fc] rounded-[2rem] pt-8 pb-4 px-2 flex flex-col items-center text-center relative shadow-sm mt-4">
                            <div className="absolute -top-6 w-12 h-12 bg-white border-[3px] border-[#7fb3eb] rounded-t-lg rounded-b-xl flex flex-col items-center justify-center shadow-sm">
                                <span className="text-slate-800 font-black text-lg leading-none">1</span>
                            </div>
                            
                            <h4 className="text-[9px] font-black text-slate-800 uppercase leading-tight h-6 flex items-center justify-center mb-1">
                                {parciales.length} PARCIALES
                            </h4>
                            
                            <div className="my-1.5 text-3xl">🎯</div>
                            <span className="text-[8px] font-black text-slate-800 uppercase tracking-wide mt-1 mb-1.5">RESCATE DE GOLES</span>
                            
                            <p className="text-[8px] text-slate-700 font-medium leading-tight mb-2 px-1 flex-grow">
                                ¡Salvados! Lograron rescatar una unidad de consolación al adivinar los goles exactos de <MiniFlag crest={homeCrest} name={localTraducido} /> o <MiniFlag crest={awayCrest} name={visitanteTraducido} />.
                            </p>

                            <div className="text-[8px] font-bold text-slate-600 bg-white/80 px-2 py-1.5 rounded-xl w-full border border-white shadow-[inset_0_2px_4px_rgba(0,0,0,0.02)] overflow-hidden">
                                {renderList(parciales)}
                            </div>
                        </div>

                        {/* CÁPSULA 4: CERO PUNTOS */}
                        <div className="border-[3px] border-slate-300 bg-slate-50 rounded-[2rem] pt-8 pb-4 px-2 flex flex-col items-center text-center relative shadow-sm mt-4">
                            <div className="absolute -top-6 w-12 h-12 bg-white border-[3px] border-slate-400 rounded-full flex flex-col items-center justify-center shadow-sm">
                                <span className="text-slate-800 font-black text-lg leading-none">0</span>
                            </div>
                            
                            <h4 className="text-[9px] font-black text-slate-800 uppercase leading-tight h-6 flex items-center justify-center mb-1">
                                {perdedores.length} SIN PUNTOS
                            </h4>
                            
                            <div className="my-1.5 text-3xl">🤦‍♂️</div>
                            <span className="text-[8px] font-black text-slate-800 uppercase tracking-wide mt-1 mb-1.5">SIN ACIERTOS</span>
                            
                            <p className="text-[8px] text-slate-600 font-medium leading-tight mb-2 px-1 flex-grow">
                                ¡Día negro! Fallaron por completo en su lectura del encuentro entre <MiniFlag crest={homeCrest} name={localTraducido} /> y <MiniFlag crest={awayCrest} name={visitanteTraducido} />.
                            </p>

                            <div className="text-[8px] font-bold text-slate-600 bg-white/80 px-2 py-1.5 rounded-xl w-full border border-white shadow-[inset_0_2px_4px_rgba(0,0,0,0.02)] overflow-hidden">
                                {renderList(perdedores)}
                            </div>
                        </div>

                    </div>
                    
                    {/* Pie de Imagen */}
                    <div className="text-center py-4 text-[10px] font-black text-slate-500 bg-white/50 uppercase tracking-[0.2em] relative z-10 border-t border-slate-200">
                        ⚽ PolliTamayo 2026
                    </div>
                </div>

                {/* BOTÓN MÁGICO DE ACCIÓN DESCARGAR */}
                <button 
                    onClick={descargarImagen}
                    className="w-full mt-5 bg-[#25D366] text-white font-black text-[13px] sm:text-sm py-4 rounded-xl shadow-lg hover:bg-[#20b958] transition-colors flex items-center justify-center gap-2 uppercase tracking-widest border-b-[4px] border-[#1ca851]"
                >
                    <span>📲</span> Descargar Infografía HD
                </button>

                {/* 🟢 NUEVO: BOTÓN CERRAR INFERIOR PARA MEJORAR LA UX */}
                <button 
                    onClick={onClose}
                    className="w-full mt-2 bg-slate-800 hover:bg-slate-700 text-white border border-slate-700/50 font-black text-[13px] sm:text-sm py-3 rounded-xl shadow-md transition-colors flex items-center justify-center gap-2 uppercase tracking-widest"
                >
                    ✕ Cerrar Ventana
                </button>

            </div>
        </div>
    );
};

export default InfografiaModal;