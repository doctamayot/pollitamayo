import React from 'react';

const StatusWarnings = ({ isAdmin, hasPaid, missingSections, isLocked }) => {
    if (isAdmin) return null;

    return (
        <div className="space-y-4 mb-8">
            {isLocked && (
                <div className="bg-red-500/10 border border-red-500/20 p-4 rounded-2xl flex items-center justify-center gap-3 animate-fade-in shadow-sm relative z-10">
                    <span className="text-2xl animate-pulse">🔒</span>
                    <p className="text-sm font-bold text-red-500 uppercase tracking-widest">Esta fase está cerrada para predicciones.</p>
                </div>
            )}

            {!hasPaid && (
                <div className="bg-amber-500/10 border border-amber-500/20 rounded-2xl p-4 sm:p-5 flex items-start sm:items-center gap-3 shadow-sm animate-fade-in">
                    <div className="text-2xl sm:text-3xl shrink-0">💳</div>
                    <div>
                        <h3 className="font-bold text-amber-500 mb-1 text-sm sm:text-base">Pago Pendiente</h3>
                        <p className="text-xs sm:text-sm text-foreground-muted leading-relaxed">
                            Aún no se ha confirmado el pago de tu inscripción. Recuerda que es requisito indispensable para participar.{' '}
                            <a href="https://wa.me/573144261190" target="_blank" rel="noopener noreferrer" className="text-amber-500 font-bold underline hover:text-amber-400 transition-colors">
                                Paga aquí vía WhatsApp.
                            </a>
                        </p>
                    </div>
                </div>
            )}
            
            {missingSections.length > 0 ? (
                <div className="bg-red-500/10 border border-red-500/20 rounded-2xl p-4 sm:p-5 flex items-start gap-3 shadow-sm animate-fade-in">
                    <div className="text-2xl shrink-0">⚠️</div>
                    <div>
                        <h3 className="font-bold text-red-500 mb-1 text-sm sm:text-base">Tu predicción está incompleta</h3>
                        <p className="text-xs sm:text-sm text-foreground-muted leading-relaxed">
                            Faltan predicciones en la fase activa. Te falta completar: <strong className="text-foreground">{missingSections.join(' • ')}</strong>
                        </p>
                    </div>
                </div>
            ) : (
                <div className="bg-green-500/10 border border-green-500/20 rounded-2xl p-4 sm:p-5 flex items-start sm:items-center gap-3 shadow-sm animate-fade-in">
                    <div className="text-2xl sm:text-3xl shrink-0">✅</div>
                    <div>
                        <h3 className="font-bold text-green-500 mb-1 text-sm sm:text-base">¡Todo listo en esta Fase!</h3>
                        <p className="text-xs sm:text-sm text-foreground-muted">Has completado todas las predicciones habilitadas. Recuerda presionar Guardar.</p>
                    </div>
                </div>
            )}
        </div>
    );
};

export default StatusWarnings;