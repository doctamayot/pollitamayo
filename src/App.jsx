import { useState, useEffect, useMemo } from 'react';
import './App.css';
import { auth, db } from './firebase';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { collection, onSnapshot, query, orderBy, doc, getDoc } from 'firebase/firestore';
import { Toaster } from 'react-hot-toast';

// Imágenes / Assets
import logoMundial from './assets/logomundial.png';
import logoQuinielas from './assets/logoquinielas.png';
import logoGeneral from './assets/logogeneral.png';

// Componentes
import AuthScreen from './components/AuthScreen';
import QuinielaView from './components/QuinielaView';
import AdminDashboard from './components/AdminDashboard';
import Leaderboard from './components/Leaderboard';
import HistoryView from './components/HistoryView';
import ProfileView from './components/ProfileView';
import QuinielaSelector from './components/QuinielaSelector';
import LeagueChampionsView from './components/LeagueChampionsView';
import WorldCupRules from './components/WorldCupRules'; 
import WorldCupPredictions from './components/WorldCupPredictions';
import WorldCupAdmin from './components/WorldCupAdmin'; 
import WorldCupPot from './components/WorldCupPot'; 

// Config
import { ADMIN_EMAIL, USERS_COLLECTION } from './config';

function App() {
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);
    const [isAdmin, setIsAdmin] = useState(false);
    const [viewingUserId, setViewingUserId] = useState(null);
    const [allQuinielas, setAllQuinielas] = useState([]);
    
    const [mainView, setMainView] = useState('selection'); 
    const [selectedQuinielaId, setSelectedQuinielaId] = useState(null);
    const [authReason, setAuthReason] = useState(null);

    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

    const activeQuinielas = useMemo(() => 
        allQuinielas.filter(q => q.isActive && !q.isClosed),
        [allQuinielas]
    );

    const closedQuinielas = useMemo(() =>
        allQuinielas.filter(q => q.isClosed),
        [allQuinielas]
    );

    const [theme, setTheme] = useState(localStorage.getItem('colorTheme') || 'dark');

    useEffect(() => {
        const root = window.document.documentElement;
        
        const applyTheme = (isDark) => {
            if (isDark) {
                root.classList.add('dark');
                root.style.colorScheme = 'dark';
            } else {
                root.classList.remove('dark');
                root.style.colorScheme = 'light';
            }
        };

        if (theme === 'dark') {
            applyTheme(true);
            localStorage.setItem('colorTheme', 'dark');
        } else if (theme === 'light') {
            applyTheme(false);
            localStorage.setItem('colorTheme', 'light');
        }
    }, [theme]);

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
            setUser(currentUser);
            if (currentUser) {
                setIsAdmin(currentUser.email === ADMIN_EMAIL || currentUser.email === 'doctamayot@gmail.com');
                const userDocRef = doc(db, USERS_COLLECTION, currentUser.uid);
                const docSnap = await getDoc(userDocRef);
                if (docSnap.exists() && docSnap.data().isBlocked === true) {
                    setAuthReason('blocked');
                    signOut(auth);
                }
            } else {
                setAuthReason(null);
                setMainView('selection');
                setIsAdmin(false);
            }
        });
        return () => unsubscribe();
    }, []);

    useEffect(() => {
        if (!user) return;
        const userDocRef = doc(db, USERS_COLLECTION, user.uid);
        const unsubscribe = onSnapshot(userDocRef, (docSnap) => {
            if (docSnap.exists() && docSnap.data().isBlocked === true) {
                setAuthReason('blocked');
                signOut(auth); 
            }
        });
        return () => unsubscribe();
    }, [user]);

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
        setIsMobileMenuOpen(false);
    };

    const handleLogout = () => {
        signOut(auth);
    };

    const navigateTo = (view) => {
        setMainView(view);
        setIsMobileMenuOpen(false);
    };

    if (loading) {
        return <div className="min-h-screen flex items-center justify-center bg-background"><p className="text-foreground-muted font-bold tracking-widest uppercase">Cargando PolliTamayo...</p></div>;
    }

    if (!user) {
        return <AuthScreen authReason={authReason} setAuthReason={setAuthReason} />;
    }

    const quinielaToShowForPlayer = activeQuinielas.find(q => q.id === selectedQuinielaId);

    const isSelectionHub = mainView === 'selection';
    const isQuinielaView = ['active', 'history', 'leaderboard', 'leagueChampions', 'profile', 'viewProfile'].includes(mainView);
    const isWorldCupView = mainView.startsWith('worldCup');

    const renderSelectionHub = () => (
        <div className="flex flex-col items-center justify-center pt-8 pb-16 px-4 md:px-6">
            <h2 className="text-3xl md:text-4xl font-extrabold text-foreground mb-12 text-center tracking-tighter">
                Arena de Competiciones
            </h2>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-10 w-full max-w-5xl">
                
                <div 
                    onClick={() => navigateTo('worldCup_predictions')}
                    className="bg-card border border-card-border hover:border-primary rounded-3xl p-8 lg:p-10 cursor-pointer transition-all duration-300 transform hover:-translate-y-2 group shadow-lg hover:shadow-[0_12px_40px_-10px_rgba(245,158,11,0.2)] flex flex-col items-center text-center relative overflow-hidden"
                >
                    <div className="w-[300px] h-[150px] md:w-[200px] md:h-[200px] lg:w-[250px] lg:h-[250px] mb-6 lg:mb-8 group-hover:scale-105 transition-transform duration-300 relative z-10 flex items-center justify-center">
                        <img src={logoMundial} alt="Mundial 2026" className="w-full h-full object-contain drop-shadow-[0_0_15px_rgba(245,158,11,0.3)]" />
                    </div>
                    
                    <h3 className="text-xl lg:text-2xl font-extrabold text-foreground mb-3 tracking-tight relative z-10">Polla Mundialista 2026</h3>
                    <p className="text-foreground-muted text-sm lg:text-base mb-8 leading-relaxed max-w-xs relative z-10">
                        El torneo definitivo. Reglas Premium, formato de llaves y la gloria mundial en juego. (5 pts por pleno)
                    </p>
                    <span className="bg-primary hover:bg-amber-600 text-primary-foreground font-bold py-3 px-8 rounded-full inline-block mt-auto shadow-[0_4px_12px_rgba(245,158,11,0.2)] transition relative z-10 text-sm lg:text-base">
                        Ir al Mundial
                    </span>
                    
                    <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-48 h-48 bg-primary rounded-full filter blur-[100px] opacity-0 group-hover:opacity-10 dark:group-hover:opacity-[0.05] transition-opacity duration-300 z-0"></div>
                </div>

                <div 
                    onClick={() => navigateTo('active')}
                    className="bg-card border border-card-border hover:border-border rounded-3xl p-8 lg:p-10 cursor-pointer transition-all duration-300 transform hover:-translate-y-2 group shadow-lg flex flex-col items-center text-center relative overflow-hidden"
                >
                    <div className="w-[300px] h-[150px] md:w-[200px] md:h-[200px] lg:w-[250px] lg:h-[250px] mb-6 lg:mb-8 group-hover:scale-105 transition-transform duration-300 relative z-10 flex items-center justify-center">
                        <img src={logoQuinielas} alt="Quinielas Ligas" className="w-full h-full object-contain drop-shadow-[0_0_15px_rgba(0,0,0,0.1)] dark:drop-shadow-[0_0_15px_rgba(255,255,255,0.05)]" />
                    </div>

                    <h3 className="text-xl lg:text-2xl font-extrabold text-foreground mb-3 tracking-tight">Quinielas Ligas</h3>
                    <p className="text-foreground-muted text-sm lg:text-base mb-8 leading-relaxed max-w-xs">
                        Pronostica las fechas de las principales ligas del mundo y compite por el ranking general semanal.
                    </p>
                    <span className="bg-slate-900 text-white dark:bg-slate-800 font-semibold py-3 px-8 rounded-full inline-block mt-auto border border-slate-800 dark:border-slate-600 group-hover:bg-slate-700 dark:group-hover:bg-slate-600 transition text-sm lg:text-base">
                        Entrar a la Liga
                    </span>
                </div>

            </div>
        </div>
    );

    const renderSidebar = () => (
        <aside className={`fixed inset-y-0 left-0 z-50 w-72 bg-background dark:bg-background-offset border-r border-border flex flex-col transform transition-transform duration-300 ease-in-out lg:translate-x-0 ${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full'}`}>
            <div className="p-6 flex-grow flex flex-col overflow-y-auto hide-scrollbar">
                <div className="mb-8 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="w-16 h-16 flex items-center justify-center drop-shadow-md shrink-0">
                            <img src={logoGeneral} alt="PolliTamayo" className="w-full h-full object-contain" />
                        </div>
                        <div>
                            <h1 className="text-xl font-extrabold text-foreground tracking-tighter leading-tight">PolliTamayo</h1>
                            <p className="text-[10px] text-primary font-bold tracking-widest uppercase">Premium Edition</p>
                        </div>
                    </div>
                    <button onClick={() => setIsMobileMenuOpen(false)} className="lg:hidden text-foreground-muted hover:text-foreground">
                        ✖️
                    </button>
                </div>

                {!isSelectionHub && (
                    <button 
                        onClick={() => navigateTo('selection')} 
                        className="w-full mb-6 flex items-center gap-3.5 px-4 py-3 rounded-xl text-sm font-semibold transition-colors duration-200 bg-background-offset dark:bg-card border border-border text-foreground hover:bg-border/30 hover:shadow-inner shadow-sm"
                    >
                        <span className="text-xl">🏠</span>
                        <span>Inicio / Selector</span>
                    </button>
                )}

                {isQuinielaView && (
                    <nav className="space-y-2">
                        <span className="text-xs text-foreground-muted font-bold tracking-wider uppercase px-4 block pb-1 border-b border-border mb-3 mt-2">Ligas Regulares</span>
                        <button onClick={() => navigateTo('active')} className={`w-full flex items-center gap-3.5 px-4 py-3 rounded-xl text-sm font-semibold transition ${mainView === 'active' ? 'bg-primary text-primary-foreground shadow-md font-bold' : 'text-foreground hover:bg-background-offset dark:hover:bg-card'}`}>
                            <span className="text-xl">⚽</span> Polla Activa
                        </button>
                        <button onClick={() => navigateTo('history')} className={`w-full flex items-center gap-3.5 px-4 py-3 rounded-xl text-sm font-semibold transition ${mainView === 'history' ? 'bg-primary text-primary-foreground shadow-md font-bold' : 'text-foreground hover:bg-background-offset dark:hover:bg-card'}`}>
                            <span className="text-xl">📅</span> Historial
                        </button>
                        <button onClick={() => navigateTo('leaderboard')} className={`w-full flex items-center gap-3.5 px-4 py-3 rounded-xl text-sm font-semibold transition ${mainView === 'leaderboard' ? 'bg-primary text-primary-foreground shadow-md font-bold' : 'text-foreground hover:bg-background-offset dark:hover:bg-card'}`}>
                            <span className="text-xl">📊</span> Leaderboard
                        </button>
                        <button onClick={() => navigateTo('leagueChampions')} className={`w-full flex items-center gap-3.5 px-4 py-3 rounded-xl text-sm font-semibold transition ${mainView === 'leagueChampions' ? 'bg-primary text-primary-foreground shadow-md font-bold' : 'text-foreground hover:bg-background-offset dark:hover:bg-card'}`}>
                            <span className="text-xl">🥇</span> Polla Campeones
                        </button>
                    </nav>
                )}

                {isWorldCupView && (
                    <nav className="space-y-2">
                        <span className="text-xs text-foreground-muted font-bold tracking-wider uppercase px-4 block pb-1 border-b border-border mb-3 mt-2">Copa Mundial</span>
                        
                        <button onClick={() => navigateTo('worldCup_predictions')} className={`w-full flex items-center gap-3.5 px-4 py-3 rounded-xl text-sm font-semibold transition ${mainView === 'worldCup_predictions' || mainView === 'worldCup' ? 'bg-primary text-primary-foreground shadow-md font-bold' : 'text-foreground hover:bg-background-offset dark:hover:bg-card'}`}>
                            <span className="text-xl">🎯</span> {user.email === 'doctamayot@gmail.com' ? 'Ajustar Resultados' : 'Mis predicciones'}
                        </button>
                        
                        <button onClick={() => navigateTo('worldCup_ranking')} className={`w-full flex items-center gap-3.5 px-4 py-3 rounded-xl text-sm font-semibold transition ${mainView === 'worldCup_ranking' ? 'bg-primary text-primary-foreground shadow-md font-bold' : 'text-foreground hover:bg-background-offset dark:hover:bg-card'}`}>
                            <span className="text-xl">🏆</span> Ranking
                        </button>
                        
                        <button onClick={() => navigateTo('worldCup_rules')} className={`w-full flex items-center gap-3.5 px-4 py-3 rounded-xl text-sm font-semibold transition ${mainView === 'worldCup_rules' ? 'bg-primary text-primary-foreground shadow-md font-bold' : 'text-foreground hover:bg-background-offset dark:hover:bg-card'}`}>
                            <span className="text-xl">📜</span> Reglamento
                        </button>
                        
                        <button onClick={() => navigateTo('worldCup_pot')} className={`w-full flex items-center gap-3.5 px-4 py-3 rounded-xl text-sm font-semibold transition ${mainView === 'worldCup_pot' ? 'bg-primary text-primary-foreground shadow-md font-bold' : 'text-foreground hover:bg-background-offset dark:hover:bg-card'}`}>
                            <span className="text-xl">💰</span> Pot
                        </button>

                        {/* BOTÓN EXCLUSIVO DEL ADMINISTRADOR MUNDIALISTA */}
                        {user.email === 'doctamayot@gmail.com' && (
                            <>
                                <span className="text-xs text-red-500 font-bold tracking-wider uppercase px-4 block pb-1 border-b border-red-500/20 mb-3 mt-6">Administración</span>
                                <button onClick={() => navigateTo('worldCup_admin')} className={`w-full flex items-center gap-3.5 px-4 py-3 rounded-xl text-sm font-semibold transition ${mainView === 'worldCup_admin' ? 'bg-red-500 text-white shadow-md font-bold' : 'text-foreground hover:bg-background-offset dark:hover:bg-card'}`}>
                                    <span className="text-xl">👑</span> Panel Usuarios
                                </button>
                            </>
                        )}
                    </nav>
                )}

                <div className="mt-auto pt-6 border-t border-border space-y-4">
                    <div className="flex items-center gap-3 bg-background-offset/80 dark:bg-card/50 p-3 rounded-2xl border border-card-border shadow-inner">
                        <img src={user.photoURL} alt={user.displayName} className="w-10 h-10 rounded-full border border-border flex-shrink-0" />
                        <div className="overflow-hidden">
                            <p className="text-sm font-bold text-foreground truncate">{user.displayName}</p>
                            {isAdmin && <p className="text-[10px] text-primary font-semibold truncate uppercase tracking-wider">Administrador</p>}
                        </div>
                    </div>

                    {isQuinielaView && !isAdmin && (
                        <button onClick={() => navigateTo('profile')} className={`w-full flex items-center gap-3.5 px-4 py-2 rounded-xl text-sm font-semibold transition ${mainView === 'profile' ? 'text-primary' : 'text-foreground hover:text-primary'}`}>
                            <span className="text-xl">👤</span> Mi Perfil
                        </button>
                    )}

                    <div className="flex items-center justify-center gap-4 bg-background-offset/80 p-2 rounded-full border border-border shadow-inner">
                        <button onClick={() => setTheme('light')} className={`flex items-center justify-center rounded-full w-10 h-10 transition-colors ${theme === 'light' ? 'bg-primary/20 text-primary font-bold ring-2 ring-primary/20' : 'text-foreground-muted hover:bg-border/20'}`} title="Modo Claro">☀️</button>
                        <div className="w-px h-6 bg-border"></div>
                        <button onClick={() => setTheme('dark')} className={`flex items-center justify-center rounded-full w-10 h-10 transition-colors ${theme === 'dark' ? 'bg-primary/20 text-primary font-bold ring-2 ring-primary/20' : 'text-foreground-muted hover:bg-border/20'}`} title="Modo Oscuro">🌙</button>
                    </div>

                    <button onClick={handleLogout} className="w-full flex items-center justify-center gap-3.5 px-4 py-3 rounded-xl text-sm font-semibold bg-red-500/10 hover:bg-red-500/20 text-red-500 transition-colors duration-200 border border-red-500/20 shadow-inner">
                        <span className="text-xl">🚪</span> Cerrar Sesión
                    </button>
                </div>
            </div>
        </aside>
    );

    // --- MENÚ INFERIOR DINÁMICO (BOTTOM NAV) ---
    const renderMobileBottomNav = () => {
        // Si estamos en el selector de inicio, no mostramos el menú de abajo
        if (!isWorldCupView && !isQuinielaView) return null;

        let navItems = [];

        // Definimos los botones dependiendo de dónde esté el usuario
        if (isWorldCupView) {
            navItems = [
                { id: 'worldCup_predictions', label: user.email === 'doctamayot@gmail.com' ? 'Resultados' : 'Predicciones', icon: '🎯' },
                { id: 'worldCup_ranking', label: 'Ranking', icon: '🏆' },
                { id: 'worldCup_rules', label: 'Reglamento', icon: '📜' },
                { id: 'worldCup_pot', label: 'Pot', icon: '💰' },
            ];
        } else if (isQuinielaView) {
            navItems = [
                { id: 'active', label: 'Activa', icon: '⚽' },
                { id: 'history', label: 'Historial', icon: '📅' },
                { id: 'leaderboard', label: 'Ranking', icon: '📊' },
                { id: 'leagueChampions', label: 'Campeones', icon: '🥇' },
            ];
        }

        return (
            <nav className="lg:hidden fixed bottom-0 left-0 w-full bg-card border-t border-card-border z-50 flex justify-around items-center h-16 px-2 shadow-[0_-4px_10px_rgba(0,0,0,0.05)]">
                {navItems.map(item => {
                    // Lógica para iluminar el botón correcto
                    const isActive = mainView === item.id || 
                                     (item.id === 'worldCup_predictions' && mainView === 'worldCup') ||
                                     (item.id === 'leaderboard' && mainView === 'viewProfile'); // Mantiene iluminado el ranking al ver un perfil
                    
                    return (
                        <button
                            key={item.id}
                            onClick={() => navigateTo(item.id)}
                            className={`flex flex-col items-center justify-center w-full h-full space-y-1 transition-all duration-200 ${
                                isActive ? 'text-foreground' : 'text-foreground-muted hover:text-foreground/80'
                            }`}
                        >
                            <div className={`px-4 py-1 rounded-full text-xl transition-colors ${isActive ? 'bg-primary/20 text-primary' : ''}`}>
                                {item.icon}
                            </div>
                            <span className={`text-[10px] font-semibold ${isActive ? 'font-bold text-primary' : ''}`}>
                                {item.label}
                            </span>
                        </button>
                    )
                })}
            </nav>
        );
    };

    return (
        <div className="min-h-screen bg-background flex flex-col lg:flex-row text-foreground relative">
            
            <header className="lg:hidden fixed top-0 w-full bg-background-offset dark:bg-card border-b border-border z-40 h-16 flex items-center justify-between px-4 shadow-sm">
                <div className="flex items-center gap-2">
                    <div className="w-12 h-12 flex items-center justify-center drop-shadow-sm shrink-0">
                        <img src={logoGeneral} alt="PolliTamayo" className="w-full h-full object-contain" />
                    </div>
                    <h1 className="text-lg font-extrabold tracking-tighter">PolliTamayo</h1>
                </div>
                <button 
                    onClick={() => setIsMobileMenuOpen(true)}
                    className="p-2 text-foreground-muted hover:text-foreground focus:outline-none"
                >
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16M4 18h16"></path></svg>
                </button>
            </header>

            {isMobileMenuOpen && (
                <div 
                    className="fixed inset-0 bg-black/50 z-40 lg:hidden backdrop-blur-sm"
                    onClick={() => setIsMobileMenuOpen(false)}
                ></div>
            )}

            {renderSidebar()}

            <main className="flex-grow pt-20 pb-20 lg:pb-0 lg:pt-0 lg:pl-72 p-4 sm:p-6 lg:p-10 w-full overflow-x-hidden">
                <div className="w-full max-w-[1400px] mx-auto">
                    
                    {mainView === 'selection' && renderSelectionHub()}
                    
                    {mainView === 'active' && (
                        <div className="bg-card p-4 sm:p-8 rounded-3xl border border-card-border shadow-lg overflow-hidden">
                            {isAdmin 
                                ? <AdminDashboard user={user} allQuinielas={allQuinielas} />
                                : (
                                    activeQuinielas.length > 0 ? (
                                        <>
                                            {activeQuinielas.length > 1 && (
                                                <div className="flex justify-center mb-6 sm:mb-8 bg-background-offset p-2 sm:p-4 rounded-3xl sm:rounded-full border border-border shadow-inner">
                                                    <QuinielaSelector quinielas={activeQuinielas} selectedId={selectedQuinielaId} setSelectedId={setSelectedQuinielaId}/>
                                                </div>
                                            )}
                                            {quinielaToShowForPlayer && <QuinielaView user={user} quiniela={quinielaToShowForPlayer} />}
                                        </>
                                    ) : (
                                        <div className="text-center py-16 sm:py-24 bg-card rounded-2xl border border-card-border shadow-inner flex flex-col items-center">
                                            <div className="w-16 h-16 sm:w-20 sm:h-20 bg-background-offset rounded-full flex items-center justify-center text-4xl sm:text-5xl mb-4 sm:mb-6">🚫</div>
                                            <h2 className="text-xl sm:text-2xl font-bold text-foreground tracking-tight">No hay quinielas activas</h2>
                                            <p className="text-foreground-muted mt-2 sm:mt-3 text-sm sm:text-base max-w-sm px-4">Espera a que el administrador publique una nueva quiniela para esta liga.</p>
                                        </div>
                                    )
                                )
                            }
                        </div>
                    )}

                    {mainView === 'leaderboard' && (
                        <Leaderboard isAdmin={isAdmin} onViewProfile={handleViewProfile} />
                    )}
                    {mainView === 'history' && (
                        <HistoryView closedQuinielas={closedQuinielas} user={user} />
                    )}
                    {mainView === 'leagueChampions' && (
                        <LeagueChampionsView isAdmin={isAdmin} />
                    )}
                    {mainView === 'profile' && (
                        <ProfileView userId={user.uid} currentUser={user} />
                    )}
                    {mainView === 'viewProfile' && (
                        <div className="relative w-full">
                            <button onClick={() => setMainView('leaderboard')} className="text-primary hover:text-amber-600 font-bold text-sm mb-4 flex items-center gap-1">
                                <span>&larr;</span> Volver al Leaderboard
                            </button>
                            <ProfileView userId={viewingUserId} currentUser={user} />
                        </div>
                    )}

                    {/* --- VISTAS DEL MOTOR MUNDIALISTA --- */}
                    
                    {(mainView === 'worldCup' || mainView === 'worldCup_predictions') && (
                        <div className="bg-card p-4 sm:p-8 rounded-3xl border border-card-border shadow-xl">
                            <WorldCupPredictions currentUser={user} />
                        </div>
                    )}

                    {mainView === 'worldCup_ranking' && (
                        <div className="bg-card p-6 sm:p-12 rounded-3xl border border-card-border shadow-xl flex flex-col items-center text-center relative">
                            <div className="w-20 h-20 bg-primary/10 rounded-full flex items-center justify-center text-primary text-4xl mb-6">🏆</div>
                            <h2 className="text-3xl sm:text-4xl font-extrabold text-foreground tracking-tighter mb-4">Ranking Oficial</h2>
                            <p className="text-foreground-muted">Próximamente: La tabla global de posiciones del Mundial.</p>
                        </div>
                    )}

                    {mainView === 'worldCup_rules' && (
                        <div className="bg-card p-4 sm:p-10 rounded-3xl border border-card-border shadow-xl">
                            <WorldCupRules />
                        </div>
                    )}

                    {mainView === 'worldCup_pot' && (
                        <div className="bg-card p-4 sm:p-8 rounded-3xl border border-card-border shadow-xl">
                            <WorldCupPot />
                        </div>
                    )}

                    {mainView === 'worldCup_admin' && user.email === 'doctamayot@gmail.com' && (
                        <div className="bg-card p-4 sm:p-8 rounded-3xl border border-card-border shadow-xl">
                            <WorldCupAdmin />
                        </div>
                    )}

                </div>
            </main>
<Toaster 
            position="top-center"
            toastOptions={{
                className: 'bg-card text-foreground border border-border rounded-2xl shadow-xl font-bold',
                duration: 4000,
            }}
        />
            {/* SE RENDERIZA EL NUEVO MENÚ DINÁMICO */}
            {renderMobileBottomNav()}
        </div>
    );
}

export default App;