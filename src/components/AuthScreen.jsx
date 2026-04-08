import React from 'react';
import { auth, googleProvider } from '../firebase';
import { signInWithPopup } from 'firebase/auth';
import logoGeneral from '../assets/logogeneral.png';

const AuthScreen = ({ authReason, setAuthReason }) => {
    
    const handleLogin = async () => {
        try {
            await signInWithPopup(auth, googleProvider);
        } catch (error) {
            console.error("Error al iniciar sesión:", error);
        }
    };

    return (
        <div className="min-h-screen w-full flex items-center justify-center bg-[#0f172a] relative overflow-hidden font-sans">
            
            {/* --- ELEMENTOS DE FONDO (DECORACIÓN) --- */}
            <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-primary/20 rounded-full blur-[120px] animate-pulse"></div>
            <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-blue-600/10 rounded-full blur-[120px]"></div>
            
            {/* --- PATRÓN DE MALLA SUTIL --- */}
            <div className="absolute inset-0 opacity-[0.03] pointer-events-none" 
                 style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='1'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")` }}>
            </div>

            <div className="relative z-10 w-full max-w-[440px] px-6">
                
                {/* --- MENSAJE DE BLOQUEO O ERROR --- */}
                {authReason === 'blocked' && (
                    <div className="mb-6 bg-red-500/10 border border-red-500/20 p-4 rounded-2xl animate-bounce">
                        <p className="text-red-500 text-center font-bold text-sm">
                            🚫 Tu acceso ha sido restringido por el administrador.
                        </p>
                    </div>
                )}

                {/* --- TARJETA PRINCIPAL --- */}
                <div className="bg-slate-900/40 backdrop-blur-xl border border-white/10 rounded-[40px] p-8 md:p-12 shadow-[0_20px_50px_rgba(0,0,0,0.5)] text-center animate-fade-in-up">
                    
                    {/* LOGO CON GLOW */}
                    <div className="relative inline-block mb-8 group">
                        <div className="absolute inset-0 bg-primary/30 rounded-full blur-2xl group-hover:blur-3xl transition-all duration-500"></div>
                        <img 
                            src={logoGeneral} 
                            alt="PolliTamayo" 
                            className="relative w-70 h-32 md:w-40 md:h-40 object-contain drop-shadow-2xl transform transition-transform duration-700 hover:rotate-[10deg]"
                        />
                    </div>

                    <h1 className="text-4xl md:text-5xl font-black text-white tracking-tighter mb-2 italic uppercase">
                        Polli<span className="text-primary">Tamayo</span>
                    </h1>
                    <p className="text-slate-400 font-bold tracking-[0.2em] uppercase text-[10px] mb-10">
                        La Mejor Experiencia en Pollas Premium
                    </p>

                    {/* BOTÓN DE GOOGLE PRO */}
                    <button 
                        onClick={handleLogin}
                        className="group w-full bg-white hover:bg-slate-100 text-slate-900 font-black py-4 px-6 rounded-2xl flex items-center justify-center gap-4 transition-all duration-300 shadow-[0_10px_20px_rgba(255,255,255,0.1)] hover:shadow-[0_15px_30px_rgba(255,255,255,0.2)] hover:-translate-y-1 active:scale-95"
                    >
                        <svg className="w-6 h-6" viewBox="0 0 48 48">
                            <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
                            <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
                            <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24s.92 7.54 2.56 10.78l7.97-6.19z"/>
                            <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
                        </svg>
                        <span className="text-base">Continuar con Google</span>
                    </button>

                    <div className="mt-12 pt-8 border-t border-white/5">
                        <p className="text-slate-500 text-[11px] leading-relaxed font-medium">
                            Únete a la comunidad de apuestas más grande de la familia.<br/>
                            <span className="text-slate-400">Copa Mundial 2026 • Ligas Top • Premios Especiales</span>
                        </p>
                    </div>

                </div>

                <p className="text-center mt-8 text-slate-600 text-[10px] font-bold uppercase tracking-widest">
                    PolliTamayo Platform © 2026
                </p>
            </div>
        </div>
    );
};

export default AuthScreen;