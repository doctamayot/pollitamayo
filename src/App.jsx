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
import HistoryView from './components/HistoryView';
import QuinielaSelector from './components/QuinielaSelector'; // Importar el selector

// Config
import { ADMIN_EMAIL } from './config';

function App() {
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);
    const [isAdmin, setIsAdmin] = useState(false);
    
    // Estados para los datos
    const [activeQuinielas, setActiveQuinielas] = useState([]); // <-- Nuevo estado para múltiples quinielas activas
    const [closedQuinielas, setClosedQuinielas] = useState([]);
    const [allQuinielasForAdmin, setAllQuinielasForAdmin] = useState([]);

    // Estado para la navegación y selección
    const [mainView, setMainView] = useState('active');
    const [selectedQuinielaId, setSelectedQuinielaId] = useState(null); // <-- Ahora lo usarán también los jugadores

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
            setUser(currentUser);
            setIsAdmin(currentUser?.email === ADMIN_EMAIL);
            setLoading(false);
        });
        return () => unsubscribe();
    }, []);

    useEffect(() => {
        if (!user) return;

        const q = query(collection(db, 'quinielas'), orderBy('createdAt', 'desc'));
        const unsubscribe = onSnapshot(q, (snapshot) => {
            const quinielasData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            
            // Lógica de filtrado
            const active = quinielasData.filter(q => q.isActive && !q.isClosed);
            const closed = quinielasData.filter(q => q.isClosed);

            setActiveQuinielas(active);
            setClosedQuinielas(closed);
            
            if (isAdmin) {
                setAllQuinielasForAdmin(quinielasData);
            }

            // Lógica para seleccionar la quiniela por defecto para el jugador
            if (!isAdmin && active.length > 0) {
                // Si la quiniela seleccionada actualmente ya no está activa, o si no hay ninguna seleccionada,
                // se selecciona la más reciente de las activas.
                const currentSelectionIsActive = active.some(q => q.id === selectedQuinielaId);
                if (!currentSelectionIsActive) {
                    setSelectedQuinielaId(active[0].id);
                }
            }

        });
        return () => unsubscribe();
    }, [user, isAdmin, selectedQuinielaId]);
    
    const handleLogout = () => {
        signOut(auth);
    };

    if (loading) {
        return <div className="min-h-screen flex items-center justify-center bg-slate-900"><p className="text-slate-400">Cargando...</p></div>;
    }

    if (!user) {
        return <AuthScreen />;
    }

    const quinielaToShow = activeQuinielas.find(q => q.id === selectedQuinielaId);

    return (
        <div className="min-h-screen p-2 sm:p-4 lg:p-8">
            <div className="w-full max-w-7xl mx-auto bg-gray-800 rounded-xl shadow-2xl p-4 sm:p-6">
                <header className="flex flex-col sm:flex-row sm:justify-between sm:items-center mb-6 pb-6 border-b border-slate-700">
                    <div>
                        <h1 className="text-2xl font-bold text-white">Plataforma de Quinielas</h1>
                        <p className="text-sm text-slate-400 mt-1">Usuario: <span className="font-semibold text-slate-200">{user.displayName}</span></p>
                    </div>
                     <nav className="flex items-center space-x-2 sm:space-x-4 mt-4 sm:mt-0">
                        <button onClick={() => setMainView('active')} className={`px-4 py-2 text-sm font-semibold rounded-md transition-colors duration-200 ${mainView === 'active' ? 'bg-blue-600 text-white' : 'bg-slate-700/50 text-slate-300 hover:bg-slate-700'}`}>Quiniela Activa</button>
                        <button onClick={() => setMainView('history')} className={`px-4 py-2 text-sm font-semibold rounded-md transition-colors duration-200 ${mainView === 'history' ? 'bg-blue-600 text-white' : 'bg-slate-700/50 text-slate-300 hover:bg-slate-700'}`}>Historial</button>
                        <button onClick={() => setMainView('leaderboard')} className={`px-4 py-2 text-sm font-semibold rounded-md transition-colors duration-200 ${mainView === 'leaderboard' ? 'bg-blue-600 text-white' : 'bg-slate-700/50 text-slate-300 hover:bg-slate-700'}`}>Leaderboard</button>
                    </nav>
                    <button onClick={handleLogout} className="bg-slate-600 hover:bg-red-600 text-white font-bold py-2 px-4 rounded-md text-sm transition-colors duration-200 mt-4 sm:mt-0">Cerrar Sesión</button>
                </header>

                <main>
                    {mainView === 'leaderboard' && <Leaderboard isAdmin={isAdmin} />}
                    {mainView === 'history' && <HistoryView closedQuinielas={closedQuinielas} user={user} />}
                    
                    {mainView === 'active' && (
                         isAdmin 
                         ? <AdminDashboard user={user} allQuinielas={allQuinielasForAdmin} />
                         : (
                            quinielaToShow ? (
                                <>
                                    {/* El selector para jugadores solo aparece si hay más de una quiniela activa */}
                                    {activeQuinielas.length > 1 && (
                                        <div className="flex justify-center mb-6">
                                            <QuinielaSelector
                                                quinielas={activeQuinielas}
                                                selectedId={selectedQuinielaId}
                                                setSelectedId={setSelectedQuinielaId}
                                            />
                                        </div>
                                    )}
                                    <QuinielaView user={user} quiniela={quinielaToShow} />
                                </>
                            ) : (
                                <div className="text-center py-16">
                                    <h2 className="text-2xl font-bold text-slate-300">No hay quinielas activas</h2>
                                    <p className="text-slate-400 mt-2">Espera a que el administrador publique una nueva quiniela.</p>
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