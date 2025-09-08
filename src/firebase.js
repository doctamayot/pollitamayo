import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

// TODO: Reemplaza esto con tu propia configuración de Firebase
// ¡IMPORTANTE! Para un proyecto real, utiliza variables de entorno.
const firebaseConfig = {
    apiKey: "AIzaSyDFD0luSbrQrEaiYyD6tIveSVYvS5A5zR8",
    authDomain: "pollasep-1170e.firebaseapp.com",
    projectId: "pollasep-1170e",
    storageBucket: "pollasep-1170e.appspot.com",
    messagingSenderId: "52223032196",
    appId: "1:52223032196:web:a6019ed1c6ad680840bbd1"
};

// Inicializa Firebase
const app = initializeApp(firebaseConfig);

// Exporta los servicios que necesitas
export const auth = getAuth(app);
export const db = getFirestore(app);
export const googleProvider = new GoogleAuthProvider();