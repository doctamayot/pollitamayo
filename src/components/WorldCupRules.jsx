import React from 'react';

const WorldCupRules = () => {
    return (
        <div className="max-w-5xl mx-auto space-y-10 pb-20">
            
            {/* ENCABEZADO PRINCIPAL */}
            <div className="text-center space-y-2">
                <h2 className="text-3xl sm:text-5xl font-black text-foreground tracking-tighter uppercase italic">
                    Reglamento Oficial
                </h2>
                <p className="text-primary font-bold tracking-[0.2em] text-sm sm:text-base">
                    POLLA TAMAYO | COPA MUNDIAL FIFA 2026™
                </p>
            </div>

            {/* REGLA DE ORO: 90 MINUTOS */}
            <section className="bg-red-500/5 border-2 border-red-500/20 rounded-3xl p-6 sm:p-8 relative overflow-hidden">
                <div className="absolute top-0 right-0 p-4 opacity-10 text-6xl">⏱️</div>
                <h3 className="text-xl font-black text-red-500 mb-4 flex items-center gap-2">
                    1. REGLA DE ORO: LEY DE LOS 90 MINUTOS
                </h3>
                <p className="text-foreground font-medium leading-relaxed">
                    Todos los marcadores se basan <span className="underline decoration-red-500 underline-offset-4">únicamente en el tiempo reglamentario</span> (incluyendo el tiempo de reposición añadido por el árbitro).
                </p>
                <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
                    <div className="bg-background/50 p-4 rounded-xl border border-red-500/10">
                        <strong className="text-foreground block mb-1">✅ QUÉ CUENTA:</strong>
                        Los goles anotados en los 90' + el tiempo añadido (ej. 90+5'). El empate es un resultado válido en todas las fases.
                    </div>
                    <div className="bg-background/50 p-4 rounded-xl border border-red-500/10">
                        <strong className="text-foreground block mb-1">❌ QUÉ NO CUENTA:</strong>
                        Goles en prórrogas (tiempos extra) ni definiciones por penales. Si el partido queda 1-1 en los 90' y alguien gana en penales, para la polla el resultado es 1-1.
                    </div>
                </div>
            </section>

            {/* SISTEMA Y TIEMPOS DE PREDICCIÓN (ACTUALIZADO Y MUY CLARO) */}
            <section className="bg-background-offset border border-border rounded-3xl p-6 sm:p-10 shadow-inner">
                <h3 className="text-2xl font-black text-foreground mb-6 text-center uppercase tracking-tight">
                    2. Tiempos de Predicción
                </h3>
                <p className="text-center text-foreground-muted mb-8 max-w-2xl mx-auto">
                    La Polla Mundialista es una maratón. Las predicciones se ingresan en diferentes momentos clave del torneo para mantener la emoción hasta la final.
                </p>
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    <div className="bg-card border border-card-border rounded-2xl p-6 shadow-sm flex flex-col">
                        <div className="text-4xl mb-4">🔒</div>
                        <h4 className="text-lg font-bold text-primary mb-2 uppercase">1. Fijos al Inicio</h4>
                        <p className="text-sm text-foreground-muted flex-grow">
                            Las predicciones de <strong className="text-foreground">Clasificados a finales, Extras, Eventos Especiales y Cuadro de Honor</strong>. Se eligen <strong className="text-foreground underline">una sola vez</strong> antes del partido inaugural y quedan bloqueadas para todo el torneo.
                        </p>
                    </div>
                    <div className="bg-card border border-card-border rounded-2xl p-6 shadow-sm flex flex-col">
                        <div className="text-4xl mb-4">📅</div>
                        <h4 className="text-lg font-bold text-primary mb-2 uppercase">2. Fase de Grupos</h4>
                        <p className="text-sm text-foreground-muted flex-grow">
                            Los marcadores de <strong className="text-foreground">TODOS los partidos de la primera fase</strong> (Grupos A a L). Se deben pronosticar en su totalidad antes de que ruede el balón en el mundial.
                        </p>
                    </div>
                    <div className="bg-card border border-card-border rounded-2xl p-6 shadow-sm flex flex-col">
                        <div className="text-4xl mb-4">🔄</div>
                        <h4 className="text-lg font-bold text-primary mb-2 uppercase">3. Ronda a Ronda</h4>
                        <p className="text-sm text-foreground-muted flex-grow">
                            Desde <strong className="text-foreground">Dieciseisavos de final en adelante</strong>, los marcadores se pronostican etapa por etapa, a medida que se van confirmando los cruces reales de las selecciones.
                        </p>
                    </div>
                </div>
            </section>

            {/* PUNTUACIÓN POR MARCADOR */}
            <section className="bg-card border border-card-border rounded-3xl p-6 sm:p-10 shadow-sm">
                <h3 className="text-2xl font-black text-foreground mb-8 text-center uppercase tracking-tight">
                    3. Puntuación por Marcador
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                    {[
                        { pts: 5, label: "PLENO", desc: "Marcador exacto.", sub: "Ganas el pleno absoluto." },
                        { pts: 3, label: "RESULTADO + DÍGITO", desc: "Aciertas ganador/empate y los goles de UN equipo.", sub: "Casi un pleno." },
                        { pts: 2, label: "RESULTADO", desc: "Aciertas ganador o empate solamente.", sub: "Acierto de tendencia." },
                        { pts: 1, label: "DÍGITO", desc: "Aciertas solo los goles de UN equipo.", sub: "Punto de consolación." }
                    ].map((item, idx) => (
                        <div key={idx} className="bg-background-offset border border-border p-6 rounded-2xl flex flex-col items-center text-center shadow-sm">
                            <div className="w-14 h-14 bg-primary text-primary-foreground rounded-full flex items-center justify-center text-2xl font-black mb-4 shadow-md">
                                {item.pts}
                            </div>
                            <h4 className="font-black text-sm text-primary mb-2 tracking-widest">{item.label}</h4>
                            <p className="text-foreground font-bold text-sm mb-1">{item.desc}</p>
                            <p className="text-foreground-muted text-xs italic">{item.sub}</p>
                        </div>
                    ))}
                </div>
            </section>

            {/* CLASIFICACIONES Y BONOS */}
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
                {/* Rondas de Clasificación */}
                <section className="bg-card border border-border rounded-3xl p-8 shadow-sm">
                    <h3 className="text-xl font-black text-foreground mb-6 uppercase tracking-tighter flex items-center gap-2">
                        <span className="text-2xl">📈</span> Puntos por Clasificación a Finales
                    </h3>
                    <span className="bg-primary text-primary-foreground font-black px-6 py-2  text-sm self-start">
                       Puntos por Equipo Acertado 
                    </span>
                    <div className="space-y-3">
                        {[
                            { round: "A Dieciseisavos", pts: 2 },
                            { round: "A Octavos", pts: 3 },
                            { round: "A Cuartos", pts: 4 },
                            { round: "A Semifinales", pts: 5 },
                            { round: "Al 3er Puesto", pts: 4 },
                            { round: "A la Gran Final", pts: 6 },
                        ].map((r, i) => (
                            <div key={i} className="flex justify-between items-center p-3 border-b border-border last:border-0 hover:bg-background-offset/50 transition-colors rounded-lg">
                                <span className="font-bold text-foreground-muted">{r.round}</span>
                                <span className="bg-primary/10 text-primary font-black px-4 py-1 rounded-full">{r.pts} PTS</span>
                            </div>
                        ))}
                    </div>
                </section>

                {/* Cuadro de Honor y Bonos */}
                <section className="bg-card border border-border rounded-3xl p-8 shadow-sm relative overflow-hidden">
                    <div className="absolute -bottom-10 -right-10 text-9xl opacity-5 rotate-12">⭐</div>
                    <h3 className="text-xl font-black text-foreground mb-6 uppercase tracking-tighter flex items-center gap-2">
                        <span className="text-2xl">🥇</span> Honor y Bonos
                    </h3>
                    <div className="grid grid-cols-2 gap-4 mb-6">
                        <div className="p-4 bg-background-offset rounded-2xl border border-border text-center">
                            <p className="text-xs font-bold text-primary mb-1">CAMPEÓN</p>
                            <p className="text-2xl font-black text-foreground">10 PTS</p>
                        </div>
                        <div className="p-4 bg-background-offset rounded-2xl border border-border text-center">
                            <p className="text-xs font-bold text-foreground-muted mb-1">TOP 2, 3 o 4</p>
                            <p className="text-2xl font-black text-foreground">6 PTS</p>
                        </div>
                    </div>
                    <div className="space-y-4">
                        <div className="p-4 bg-primary/5 border border-primary/20 rounded-2xl">
                            <h4 className="font-black text-primary text-sm flex items-center gap-2 mb-1">
                                ⭐ SÚPER BONO TOP 4: +10 PTS
                            </h4>
                            <p className="text-xs text-foreground-muted">Si aciertas el orden exacto del 1º al 4º puesto.</p>
                        </div>
                        <div className="p-4 bg-primary/5 border border-primary/20 rounded-2xl">
                            <h4 className="font-black text-primary text-sm flex items-center gap-2 mb-1">
                                ⭐ PLENO DE GRUPO: 8 PTS
                            </h4>
                            <p className="text-xs text-foreground-muted">Por cada grupo (A-L) donde aciertes el orden exacto del 1º al 4º.</p>
                        </div>
                    </div>
                </section>
            </div>

            {/* LOS 11 EXTRAS ESTADÍSTICOS */}
            <section className="bg-card border border-border rounded-3xl p-8 shadow-sm">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
                    <h3 className="text-2xl font-black text-foreground uppercase tracking-tighter">
                        6. Los 11 Extras Estadísticos
                    </h3>
                    <span className="bg-primary text-primary-foreground font-black px-6 py-2 rounded-full text-sm self-start">
                        6 PUNTOS C/U
                    </span>
                    <span className="bg-primary text-primary-foreground font-black px-6 py-2  text-sm self-start">
                       En caso de empate, todos suman el puntaje 
                    </span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {[
                        { t: "Goleador", d: "Jugador con más goles anotados. Se mide por goles no por el que declare la FIFA" },
                        { t: "Equipo Goleador", d: "Equipo con más goles a favor totales." },
                        { t: "Equipo Menos Goleador", d: "Equipo con menos goles a favor." },
                        { t: "Más Amarillas", d: "Equipo que reciba más tarjetas amarillas." },
                        { t: "Más Rojas", d: "Equipo que reciba más tarjetas rojas." },
                        { t: "Valla menos vencida", d: "Equipo con menos goles en contra." },
                        { t: "Valla más vencida", d: "Equipo con más goles en contra." },
                        { t: "Grupo con más goles", d: "Suma total de goles del grupo (A-L)." },
                        { t: "Grupo con menos goles", d: "Suma total de goles del grupo (A-L)." },
                        { t: "Máximo asistidor", d: "Jugador con más pases de gol." },
                        { t: "El Atajapenales", d: "Arquero con más penales tapados (90')." },
                    ].map((item, i) => (
                        <div key={i} className="p-4 bg-background-offset rounded-xl border border-border hover:border-primary/30 transition-colors group">
                            <span className="text-primary font-black text-xs mb-1 block uppercase tracking-widest">{i+1}. {item.t}</span>
                            <p className="text-foreground-muted text-xs leading-relaxed">{item.d}</p>
                        </div>
                    ))}
                </div>
            </section>

            {/* EVENTOS ESPECIALES SÍ/NO (ADAPTADO AL MODO CLARO Y OSCURO) */}
            <section className="bg-background-offset border border-border rounded-3xl p-8 sm:p-12 shadow-lg relative overflow-hidden">
                <div className="relative z-10">
                    <div className="flex flex-col md:flex-row md:items-start justify-between gap-6 mb-10">
                        <div className="max-w-2xl">
                            <h3 className="text-3xl font-black text-foreground uppercase tracking-tighter mb-3">
                                7. Eventos Especiales "SÍ/NO"
                            </h3>
                            <p className="text-sm font-medium text-foreground-muted leading-relaxed bg-card p-4 rounded-xl border border-card-border shadow-sm">
                                <strong className="text-primary">Puntuación Asimétrica:</strong> Premia el riesgo. Si predices <strong className="text-foreground">SÍ</strong> a un evento y aciertas, ganas 5 puntos. Si vas a la segura y predices <strong className="text-foreground">NO</strong> y aciertas, ganas 2 puntos. ¡Elige con sabiduría!
                            </p>
                        </div>
                        {/* BOTONES ADAPTADOS AL RESPONSIVE Y AL TEMA */}
                        <div className="flex flex-col sm:flex-row md:flex-col gap-3 shrink-0 w-full md:w-auto">
                            <div className="bg-primary text-primary-foreground font-black px-5 py-3 rounded-xl text-sm shadow-md flex items-center justify-between gap-4 w-full">
                                <span>Acierto SÍ:</span>
                                <span className="text-lg">5 PTS</span>
                            </div>
                            <div className="bg-card text-foreground font-black px-5 py-3 rounded-xl text-sm shadow-md border border-card-border flex items-center justify-between gap-4 w-full">
                                <span>Acierto NO:</span>
                                <span className="text-lg">2 PTS</span>
                            </div>
                        </div>
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {[
                            { q: "Gol Olímpico", d: "¿Habrá al menos un gol directo de tiro de esquina?" },
                            { q: "Remontada Épica", d: "¿Alguien ganará tras ir perdiendo por 2+ goles?" },
                            { q: "El Festival", d: "¿Habrá un partido con 8 o más goles (90 min)?" },
                            { q: "Muralla en la Final", d: "¿Se atajará algún penal en los 90' de la Gran Final?" },
                            { q: "Hat-Trick Hero", d: "¿Algún jugador anotará 3 o más goles en un partido?" },
                            { q: "Roja al Banquillo", d: "¿Un Director Técnico será expulsado con roja?" },
                            { q: "El Portero Goleador", d: "¿Algún arquero anotará (fuera de penales)?" },
                            { q: "Debut sin Red", d: "¿Al menos un equipo se irá con 0 goles anotados?" },
                            { q: "Leyenda Viva", d: "¿Messi o CR7 anotarán 3 o más goles totales?" },
                            { q: "Drama Final", d: "¿Habrá roja (jugador) en el partido de la Gran Final?" },
                            { q: "Final en Penales", d: "¿La final se decide en penales?" },
                        ].map((item, i) => (
                            <div key={i} className="flex items-start gap-4 p-4 bg-card rounded-2xl border border-card-border shadow-sm hover:border-primary/30 transition-colors">
                                <span className="bg-primary/10 text-primary w-8 h-8 rounded-lg flex items-center justify-center font-black text-sm shrink-0">
                                    ?
                                </span>
                                <div>
                                    <h4 className="font-black text-sm uppercase mb-1 text-foreground">{item.q}</h4>
                                    <p className="text-xs text-foreground-muted leading-relaxed font-medium">{item.d}</p>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

        </div>
    );
};

export default WorldCupRules;