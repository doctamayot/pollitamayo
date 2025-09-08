import React from 'react';
import { auth, googleProvider, db } from '../firebase';
import { signInWithPopup } from 'firebase/auth';
import { doc, setDoc, getDoc } from 'firebase/firestore';
import { USERS_COLLECTION } from '../config';

const AuthScreen = () => {
    
    const handleGoogleSignIn = async () => {
        try {
            const result = await signInWithPopup(auth, googleProvider);
            const user = result.user;
            
            // Guardar info del usuario en Firestore si es la primera vez
            const userDocRef = doc(db, USERS_COLLECTION, user.uid);
            const userDocSnap = await getDoc(userDocRef);
            
            if (!userDocSnap.exists()) {
                await setDoc(userDocRef, {
                    displayName: user.displayName,
                    email: user.email,
                });
            }
        } catch (error) {
            console.error("Error durante el inicio de sesión con Google:", error);
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center p-4">
             <div className="w-full max-w-5xl mx-auto bg-gray-800 rounded-lg shadow-2xl p-4 sm:p-6 md:p-8">
                <div className="max-w-md mx-auto">
                    <h1 className="text-2xl sm:text-3xl font-bold text-center text-blue-400 mb-2">Bienvenido a PolliTamayo</h1>
                    <p className="text-center text-gray-400 mb-8 text-sm sm:text-base">Inicia sesión con tu cuenta de Google para participar.</p>
                    <button onClick={handleGoogleSignIn} className="w-full bg-white text-gray-800 font-semibold py-2 px-4 rounded-md border border-gray-300 hover:bg-gray-100 transition duration-300 flex items-center justify-center">
                        <svg className="w-5 h-5 mr-2" viewBox="0 0 48 48"><path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"></path><path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"></path><path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"></path><path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"></path><path fill="none" d="M0 0h48v48H0z"></path></svg>
                        Iniciar Sesión con Google
                    </button>
                </div>
                 <div className="max-w-md mx-auto mt-10 p-4 border border-gray-700 rounded-lg bg-gray-800/50">
                    <h3 className="text-lg font-semibold text-center text-blue-300 mb-4">Sistema de Puntuación</h3>
                    <ul className="space-y-3 text-sm text-gray-300">
                        <li className="flex items-start">
                            <span className="text-green-400 font-bold mr-2">✔</span>
                            <div><strong className="text-white">6 Puntos:</strong> Por acertar el marcador exacto del partido.</div>
                        </li>
                        <li className="flex items-start">
                            <span className="text-green-400 font-bold mr-2">✔</span>
                            <div><strong className="text-white">2 Puntos:</strong> Por acertar el ganador del partido o el empate (sin acertar el marcador).</div>
                        </li>
                        <li className="flex items-start">
                            <span className="text-green-400 font-bold mr-2">✔</span>
                            <div><strong className="text-white">1 Punto:</strong> Por cada marcador individual que aciertes. (Ej: Si el resultado es 2-1 y pones 2-0, ganas 1 punto por el '2').</div>
                        </li>
                        <li className="flex items-start">
                            <span className="text-gray-400 font-bold mr-2">ⓘ</span>
                            <div className="text-gray-400">Los puntos no son acumulativos si aciertas el marcador exacto. Si obtienes 6 puntos, no sumas los otros.</div>
                        </li>
                    </ul>
                </div>
            </div>
        </div>
    );
};

export default AuthScreen;