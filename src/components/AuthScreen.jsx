import React, { useState } from 'react';
import { auth, googleProvider, db } from '../firebase';
import { signInWithPopup, signOut } from 'firebase/auth';
import { doc, setDoc, getDoc, updateDoc } from 'firebase/firestore';
import { USERS_COLLECTION } from '../config';

const AuthScreen = ({ authReason, setAuthReason }) => {
    //const [authStatus, setAuthStatus] = useState('idle');

    const handleGoogleSignIn = async () => {
        try {
            const result = await signInWithPopup(auth, googleProvider);
            const user = result.user;

                       
            const userDocRef = doc(db, USERS_COLLECTION, user.uid);
            const userDocSnap = await getDoc(userDocRef);

            if (userDocSnap.exists()) {
                const userData = userDocSnap.data();
                
                // Si el usuario existe pero no tiene foto en la BD, la añadimos.
                if (!userData.photoURL && user.photoURL) {
                    await updateDoc(userDocRef, { photoURL: user.photoURL });
                }

                if (userData.isBlocked === true) {
                    await signOut(auth);
                    setAuthReason('blocked'); 
                    return;
                }
            } else {
                // GUARDAMOS LA FOTO PARA NUEVOS USUARIOS
                await setDoc(userDocRef, {
                    displayName: user.displayName,
                    email: user.email,
                    photoURL: user.photoURL, // <-- CAMBIO CLAVE
                    isBlocked: false,
                });
            }
        } catch (error) {
            console.error("Error durante el inicio de sesión con Google:", error);
        }
    };

    if (authReason === 'blocked') {
        return (
            <div className="min-h-screen flex items-center justify-center p-4">
                <div className="w-full max-w-xl mx-auto bg-uefa-dark-blue-secondary rounded-xl shadow-2xl p-8 border border-red-500/50">
                    <div className="max-w-md mx-auto text-center">
                        <h1 className="text-3xl font-bold text-red-500 mb-4">Acceso Denegado</h1>
                        <p className="text-uefa-text-secondary mb-6">
                            Tu cuenta ha sido bloqueada por un administrador. Si crees que esto es un error, por favor, contacta con el organizador.
                        </p>
                        <button 
                            onClick={() => setAuthStatus('idle')}
                            className="bg-uefa-primary-blue hover:bg-blue-500 text-white font-bold py-2 px-6 rounded-lg transition duration-300"
                        >
                            Entendido
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen flex items-center justify-center p-4">
             <div className="w-full max-w-xl mx-auto bg-uefa-dark-blue-secondary rounded-xl shadow-2xl p-8 border border-uefa-border">
                <div className="max-w-md mx-auto">
                    <h1 className="text-3xl font-bold text-center text-uefa-cyan mb-2">Bienvenido a PolliTamayo</h1>
                    <p className="text-center text-uefa-text-secondary mb-8">Inicia sesión con tu cuenta de Google para participar.</p>
                    <button onClick={handleGoogleSignIn} className="w-full bg-white text-slate-800 font-semibold py-3 px-4 rounded-lg border border-slate-300 hover:bg-slate-100 transition duration-300 flex items-center justify-center shadow-sm">
                        <svg className="w-5 h-5 mr-3" viewBox="0 0 48 48"><path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"></path><path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"></path><path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"></path><path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"></path><path fill="none" d="M0 0h48v48H0z"></path></svg>
                        Iniciar Sesión con Google
                    </button>
                </div>
                 {/* --- SECCIÓN DE PUNTUACIÓN INTACTA --- */}
                 <div className="max-w-lg mx-auto mt-12 p-6 border border-uefa-border/80 rounded-lg bg-uefa-dark-blue/60">
                     <h3 className="text-xl font-semibold text-center text-uefa-cyan mb-4">Nuestro Sistema de Puntuación</h3>
                     <div className="space-y-4 text-sm text-uefa-text-secondary">
                         <div>
                             <p className="font-bold text-white">🏆 Acierto Perfecto: 6 Puntos</p>
                             <p className="mt-1">
                                 Si aciertas el marcador exacto de un partido, obtienes la máxima puntuación.
                             </p>
                             <p className="mt-2 text-xs p-2 bg-uefa-dark-blue rounded-md font-mono">
                                 <span className="font-bold">Ejemplo:</span> Resultado Real <span className="text-uefa-cyan">2-1</span>, Tu Predicción <span className="text-uefa-cyan">2-1</span> ➜ Ganas <strong>6 Puntos</strong>.
                             </p>
                         </div>
                         <div>
                             <p className="font-bold text-white">👍 Acierto de Ganador o Empate: 2 Puntos</p>
                             <p className="mt-1">
                                 Si aciertas quién gana (o si hay empate) pero no el marcador exacto.
                             </p>
                             <p className="mt-2 text-xs p-2 bg-uefa-dark-blue rounded-md font-mono">
                                 <span className="font-bold">Ejemplo:</span> Resultado Real <span className="text-uefa-cyan">2-1</span>, Tu Predicción <span className="text-uefa-cyan">1-0</span> ➜ Ganas <strong>2 Puntos</strong>.
                             </p>
                         </div>
                         <div>
                             <p className="font-bold text-white">🎯 Acierto de Goles: 1 Punto por Gol</p>
                             <p className="mt-1">
                                 Ganas 1 punto por cada marcador individual que aciertes, incluso si no aciertas al ganador.
                             </p>
                              <p className="mt-2 text-xs p-2 bg-uefa-dark-blue rounded-md font-mono">
                                 <span className="font-bold">Ejemplo:</span> Resultado Real <span className="text-uefa-cyan">2-1</span>, Tu Predicción <span className="text-uefa-cyan">2-0</span> ➜ Ganas <strong>1 Punto</strong> (por el '2' del local).
                             </p>
                         </div>
                         <div>
                             <p className="font-bold text-white">⚠️ Importante: Los Puntos No Son Acumulativos</p>
                             <p className="mt-1">
                                 Si obtienes los 6 puntos por un Acierto Perfecto, no se suman los otros puntos por ese mismo partido. El máximo por partido siempre es 6.
                             </p>
                         </div>
                     </div>
                 </div>
             </div>
        </div>
    );
};

export default AuthScreen;