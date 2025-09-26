import { useState, useEffect, useMemo } from 'react';
import './App.css';
import { auth, db } from './firebase';
import { onAuthStateChanged, signOut } from 'firebase/auth';
// --- ▼▼▼ 'doc' AÑADIDO A LAS IMPORTACIONES ▼▼▼ ---
import { collection, onSnapshot, query, orderBy, doc } from 'firebase/firestore';

// Componentes
import AuthScreen from './components/AuthScreen';
import QuinielaView from './components/QuinielaView';
import AdminDashboard from './components/AdminDashboard';
import Leaderboard from './components/Leaderboard';
import HistoryView from './components/HistoryView';
import ProfileView from './components/ProfileView';
import QuinielaSelector from './components/QuinielaSelector';
import LeagueChampionsView from './components/LeagueChampionsView';

// Config
import { ADMIN_EMAIL } from './config';

function App() {
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);
    const [isAdmin, setIsAdmin] = useState(false);
    const [viewingUserId, setViewingUserId] = useState(null);
    const [allQuinielas, setAllQuinielas] = useState([]);
    const [mainView, setMainView] = useState('active');
    const [selectedQuinielaId, setSelectedQuinielaId] = useState(null);

    const [authReason, setAuthReason] = useState(null);
    
    const activeQuinielas = useMemo(() => 
        allQuinielas.filter(q => q.isActive && !q.isClosed),
        [allQuinielas]
    );

    const closedQuinielas = useMemo(() =>
        allQuinielas.filter(q => q.isClosed),
        [allQuinielas]
    );

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
            setUser(currentUser);
            setIsAdmin(currentUser?.email === ADMIN_EMAIL);
            if (!currentUser) {
                setAuthReason(null);
            }
        });
        return () => unsubscribe();
    }, []);

    // --- ▼▼▼ NUEVO useEffect PARA LA EXPULSIÓN EN TIEMPO REAL ▼▼▼ ---
    useEffect(() => {
        // Si no hay un usuario logueado, no hacemos nada.
        if (!user) return;

        // Creamos una referencia al documento del usuario actual en la colección 'users'.
        const userDocRef = doc(db, 'users', user.uid);

        // onSnapshot crea un listener que se ejecuta cada vez que el documento cambia.
        const unsubscribe = onSnapshot(userDocRef, (docSnap) => {
            // Verificamos si el documento existe y si el campo 'isBlocked' es true.
            if (docSnap.exists() && docSnap.data().isBlocked === true) {
                console.log("Usuario bloqueado. Forzando cierre de sesión.");
                setAuthReason('blocked');
                signOut(auth); // Deslogueamos al usuario.
            }
        });

        // La función de limpieza se ejecuta cuando el usuario se desloguea o el componente se desmonta.
        return () => unsubscribe();

    }, [user]); // Este efecto depende del objeto 'user'. Se activa cuando el usuario cambia.


    useEffect(() => {
        if (!user) {
            setLoading(false);
            return;
        }
        setLoading(true);
        const q = query(collection(db, 'quinielas'), orderBy('createdAt', 'desc'));
        const unsubscribe = onSnapshot(q, (snapshot) => {
            const quinielasData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            setAllQuinielas(quinielasData);
            setLoading(false);
        });
        return () => unsubscribe();
    }, [user]);
    
    useEffect(() => {
        if (isAdmin) {
            const currentExists = allQuinielas.some(q => q.id === selectedQuinielaId);
            if (!currentExists && allQuinielas.length > 0) {
                setSelectedQuinielaId(allQuinielas[0].id);
            }
        } else {
            const currentIsValid = activeQuinielas.some(q => q.id === selectedQuinielaId);
            if (!currentIsValid && activeQuinielas.length > 0) {
                setSelectedQuinielaId(activeQuinielas[0].id);
            } else if (activeQuinielas.length === 0) {
                setSelectedQuinielaId(null);
            }
        }
    }, [allQuinielas, activeQuinielas, isAdmin, selectedQuinielaId]);

    const handleViewProfile = (userIdToView) => {
        setViewingUserId(userIdToView);
        setMainView('viewProfile');
    };
    const handleLogout = () => {
        signOut(auth);
    };

    if (loading) {
        return <div className="min-h-screen flex items-center justify-center bg-uefa-dark-blue"><p className="text-uefa-text-secondary">Cargando...</p></div>;
    }

    if (!user) {
        // --- ▼▼▼ 3. PASAMOS EL ESTADO Y LA FUNCIÓN A AUTHSCREEN ▼▼▼ ---
        return <AuthScreen authReason={authReason} setAuthReason={setAuthReason} />;
    }

    const quinielaToShowForPlayer = activeQuinielas.find(q => q.id === selectedQuinielaId);

    return (
        // El resto del JSX no necesita cambios
        <div className="min-h-screen p-2 sm:p-4 lg:p-8">
            <div className="w-full max-w-7xl mx-auto bg-uefa-dark-blue-secondary rounded-xl shadow-2xl p-4 sm:p-6 border border-uefa-border">
                <header className="flex flex-col sm:flex-row sm:justify-between sm:items-center mb-6 pb-6 border-b border-uefa-border">
                    <div>
                        <h1 className="text-2xl font-bold text-white">PolliTamayo</h1>
                        <p className="text-sm text-uefa-text-secondary mt-1">Usuario: <span className="font-semibold text-white">{user.displayName}</span></p>
                    </div>
                    <nav className="flex flex-wrap items-center space-x-2 sm:space-x-4 mt-4 sm:mt-0">
                        <button onClick={() => setMainView('active')} className={`px-4 py-2 text-sm font-semibold rounded-md transition-colors duration-200 ${mainView === 'active' ? 'bg-uefa-magenta text-white' : 'bg-transparent text-uefa-text-secondary hover:bg-white/10'}`}>Polla Activa</button>
                        <button onClick={() => setMainView('history')} className={`px-4 py-2 text-sm font-semibold rounded-md transition-colors duration-200 ${mainView === 'history' ? 'bg-uefa-magenta text-white' : 'bg-transparent text-uefa-text-secondary hover:bg-white/10'}`}>Historial</button>
                        <button onClick={() => setMainView('leaderboard')} className={`px-4 py-2 text-sm font-semibold rounded-md transition-colors duration-200 ${mainView === 'leaderboard' ? 'bg-uefa-magenta text-white' : 'bg-transparent text-uefa-text-secondary hover:bg-white/10'}`}>Leaderboard</button>
                        {!isAdmin && <button onClick={() => setMainView('profile')} className={`px-4 py-2 text-sm font-semibold rounded-md transition-colors duration-200 ${mainView === 'profile' ? 'bg-uefa-magenta text-white' : 'bg-transparent text-uefa-text-secondary hover:bg-white/10'}`}>Mi Perfil</button>}
                    </nav>
                    <div className="flex flex-col items-stretch gap-y-2 mt-4 sm:mt-0">
                        <button onClick={handleLogout} className="bg-red-600 hover:bg-red-500 text-white font-bold py-2 px-4 rounded-md text-sm transition-colors duration-200">Cerrar Sesión</button>
                        <button onClick={() => setMainView('leagueChampions')} className={`text-center py-2 px-4 text-sm font-semibold rounded-md transition-colors duration-200 ${mainView === 'leagueChampions' ? 'bg-uefa-magenta text-white' : 'bg-transparent text-uefa-text-secondary hover:bg-white/10'}`}>
                            Polla Campeones
                        </button>
                    </div>
                </header>

                <main>
                    {mainView === 'leagueChampions' && <LeagueChampionsView isAdmin={isAdmin} />}
                    {mainView === 'leaderboard' && <Leaderboard isAdmin={isAdmin} onViewProfile={handleViewProfile} />}
                    {mainView === 'history' && <HistoryView closedQuinielas={closedQuinielas} user={user} />}
                    {mainView === 'profile' && <ProfileView userId={user.uid} currentUser={user} />}
                    {mainView === 'viewProfile' && (
                        <div>
                            <button onClick={() => setMainView('leaderboard')} className="text-uefa-primary-blue hover:text-blue-400 font-semibold text-sm mb-4">&larr; Volver al Leaderboard</button>
                            <ProfileView userId={viewingUserId} currentUser={user} />
                        </div>
                    )}
                    {mainView === 'active' && (
                        isAdmin 
                        ? <AdminDashboard user={user} allQuinielas={allQuinielas} />
                        : (
                            activeQuinielas.length > 0 ? (
                                <>
                                    {activeQuinielas.length > 1 && (
                                        <div className="flex justify-center mb-6">
                                            <QuinielaSelector quinielas={activeQuinielas} selectedId={selectedQuinielaId} setSelectedId={setSelectedQuinielaId}/>
                                        </div>
                                    )}
                                    {quinielaToShowForPlayer && <QuinielaView user={user} quiniela={quinielaToShowForPlayer} />}
                                </>
                            ) : (
                                <div className="text-center py-16">
                                    <h2 className="text-2xl font-bold text-white">No hay quinielas activas</h2>
                                    <p className="text-uefa-text-secondary mt-2">Espera a que el administrador publique una nueva quiniela.</p>
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