import { lazy, Suspense } from 'react';
import Footer from './components/Footer/Footer';
import { BrowserRouter as Router, Routes, Route, useLocation, Link } from 'react-router-dom';
import ScrollToTop from './utilities/ScrollToTop';
import Nav from './components/Nav/Nav';
import Home from './pages/Home/Home';
import { AuthProvider } from './contexts/AuthContext';
import { FavoritesProvider } from './hooks/useFavorites';

const About = lazy(() => import('./pages/About/About'));
const Help = lazy(() => import('./pages/Help/Help'));
const Shop = lazy(() => import('./pages/Shop/Shop'));
const Map = lazy(() => import('./pages/Map/Map'));
const Place = lazy(() => import('./pages/Place/Place'));
const FavoritesList = lazy(() => import('./components/FavoritesList/FavoritesList'));
const TheLittleGarden = lazy(() => import('./pages/TheLittleGarden/TheLittleGarden'));
const SproutSignup = lazy(() => import('./pages/TheLittleGarden/SproutSignup'));
const AuthCallback = lazy(() => import('./pages/Auth/AuthCallback'));
const Login = lazy(() => import('./pages/Auth/Login'));
const Register = lazy(() => import('./pages/Auth/Register'));

const routes = [
  { path: '/', element: <Home /> },
  { path: '/map', element: <Map /> },
  { path: '/shop', element: <Shop /> },
  { path: '/about', element: <About /> },
  { path: '/help', element: <Help /> },
  { path: '/the-little-garden', element: <TheLittleGarden /> },
  { path: '/the-little-garden/sprout', element: <SproutSignup /> },
  { path: '/place/:slug', element: <Place /> },
  { path: '/login', element: <Login /> },
  { path: '/register', element: <Register /> },
  { path: '/favorites', element: <FavoritesList /> },
  { path: '/auth/callback', element: <AuthCallback /> },
];

function AppContent() {
  const { pathname } = useLocation();
  const currentRoute = routes.find(route => route.path.includes(':') ? pathname.startsWith(route.path.split(':')[0]) : route.path === pathname);
  return <>
    <Nav variant={currentRoute?.navVariant || 'garden'} />
    <ScrollToTop />
    <Suspense fallback={<div className="route-loading" role="status">Finding your little place…</div>}>
      <Routes>
        {routes.map(route => <Route key={route.path} path={route.path} element={route.element} />)}
        <Route path="*" element={<main id="main-content" className="container" style={{ paddingBottom: 80 }}><h1>A little off the beaten path.</h1><p>We couldn’t find that page. <Link to="/">Head back home</Link> or <Link to="/map">explore the directory</Link>.</p></main>} />
      </Routes>
    </Suspense>
    <Footer />
  </>;
}

export default function App() {
  return <Router><AuthProvider><FavoritesProvider><AppContent /></FavoritesProvider></AuthProvider></Router>;
}
