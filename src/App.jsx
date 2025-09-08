import { useState, useEffect } from 'react';
import './App.css';
import { auth, db } from './firebase';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { collection, onSnapshot, query, orderBy } from 'firebase/firestore';

// Componentes
import AuthScreen from './components/AuthScreen';
import QuinielaView from './components/QuinielaView';
import AdminDashboard from './components/AdminDashboard';
import Leaderboard from './components/Leaderboard';
import HistoryView from './components/HistoryView'; // Importar nuevo componente

// Config
import { ADMIN_EMAIL } from './config';

function App() {
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);
    const [isAdmin, setIsAdmin] = useState(false);
    
    // Estados para los datos
    const [activeQuiniela, setActiveQuiniela] = useState(null);
    const [closedQuinielas, setClosedQuinielas] = useState([]);
    const [allQuinielasForAdmin, setAllQuinielasForAdmin] = useState([]);

    // Estado para la navegación
    const [mainView, setMainView] = useState('active'); // 'active', 'history', 'leaderboard'

    // 1. Manejar autenticación
    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
            setUser(currentUser);
            setIsAdmin(currentUser?.email === ADMIN_EMAIL);
            setLoading(false);
        });
        return () => unsubscribe();
    }, []);

    // 2. Cargar y filtrar todas las quinielas
    useEffect(() => {
        if (!user) return;

        const q = query(collection(db, 'quinielas'), orderBy('createdAt', 'desc'));
        const unsubscribe = onSnapshot(q, (snapshot) => {
            const quinielasData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            
            // Lógica de filtrado
            const active = quinielasData.find(q => q.isActive && !q.isClosed) || null;
            const closed = quinielasData.filter(q => q.isClosed);

            setActiveQuiniela(active);
            setClosedQuinielas(closed);
            
            // El admin necesita ver todas para su selector
            if (isAdmin) {
                setAllQuinielasForAdmin(quinielasData);
            }
        });
        return () => unsubscribe();
    }, [user, isAdmin]);
    
    const handleLogout = () => {
        signOut(auth);
    };

    if (loading) {
        return <div className="min-h-screen flex items-center justify-center"><p>Cargando...</p></div>;
    }

    if (!user) {
        return <AuthScreen />;
    }

    return (
        <div className="min-h-screen flex items-start justify-center p-2 sm:p-4">
            <div className="w-full max-w-6xl mx-auto bg-gray-800 rounded-lg shadow-2xl p-4 sm:p-6 md:p-8 mt-4">
                <header className="flex flex-col sm:flex-row sm:justify-between sm:items-center mb-6 pb-4 border-b border-gray-700">
                    <div>
                        <h1 className="text-xl sm:text-2xl font-bold text-blue-400">PolliTamayo</h1>
                        <p className="text-gray-400 mt-1">Usuario: <span className="font-semibold text-white">{user.displayName}</span></p>
                    </div>
                     <nav className="flex items-center space-x-2 sm:space-x-4 mt-4 sm:mt-0">
                        <button onClick={() => setMainView('active')} className={`px-3 py-2 text-sm font-semibold rounded-md ${mainView === 'active' ? 'bg-blue-600 text-white' : 'bg-gray-600/50 text-gray-300'}`}>Quiniela Activa</button>
                        <button onClick={() => setMainView('history')} className={`px-3 py-2 text-sm font-semibold rounded-md ${mainView === 'history' ? 'bg-blue-600 text-white' : 'bg-gray-600/50 text-gray-300'}`}>Historial</button>
                        <button onClick={() => setMainView('leaderboard')} className={`px-3 py-2 text-sm font-semibold rounded-md ${mainView === 'leaderboard' ? 'bg-blue-600 text-white' : 'bg-gray-600/50 text-gray-300'}`}>Leaderboard</button>
                    </nav>
                    <button onClick={handleLogout} className="bg-gray-600 hover:bg-gray-700 text-white font-bold py-2 px-4 rounded-md text-sm transition mt-4 sm:mt-0">Cerrar Sesión</button>
                </header>

                <main>
                    {/* --- RENDERIZADO CONDICIONAL DE LA VISTA PRINCIPAL --- */}
                    {mainView === 'leaderboard' && <Leaderboard />}
                    {mainView === 'history' && <HistoryView closedQuinielas={closedQuinielas} user={user} />}
                    
                    {mainView === 'active' && (
                         isAdmin 
                         ? <AdminDashboard user={user} allQuinielas={allQuinielasForAdmin} />
                         : (
                            activeQuiniela ? (
                                <QuinielaView user={user} quiniela={activeQuiniela} />
                            ) : (
                                <div className="text-center py-10">
                                    <h2 className="text-2xl font-bold text-blue-300">No hay quinielas activas</h2>
                                    <p className="text-gray-400 mt-2">Espera a que el administrador publique una nueva quiniela.</p>
                                </div>
                            )
                        )
                    )}
                </main>
            </div>
        </div>
    );
}

export default App;