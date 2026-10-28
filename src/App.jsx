import { Suspense } from 'react';
import { lazyPage } from './utilities/lazyPage';
import PageErrorBoundary from './components/PageErrorBoundary/PageErrorBoundary';
import Footer from './components/Footer/Footer';
import { BrowserRouter as Router, Routes, Route, useLocation, Link, Navigate } from 'react-router-dom';
import ScrollToTop from './utilities/ScrollToTop';
import Nav from './components/Nav/Nav';
import Home from './pages/Home/Home';
import { AuthProvider } from './contexts/AuthContext';
import { FavoritesProvider } from './hooks/useFavorites';
import ManagementProvider from './contexts/ManagementProvider';
import Seo from './components/Seo/Seo';

const Settings = lazyPage(() => import('./pages/Settings/Settings'));
const About = lazyPage(() => import('./pages/About/About'));
const Help = lazyPage(() => import('./pages/Help/Help'));
const Shop = lazyPage(() => import('./pages/Shop/Shop'));
const Map = lazyPage(() => import('./pages/Map/Map'));
const Place = lazyPage(() => import('./pages/Place/Place'));
const FavoritesList = lazyPage(() => import('./components/FavoritesList/FavoritesList'));
const TheLittleGarden = lazyPage(() => import('./pages/TheLittleGarden/TheLittleGarden'));
const StartBusiness = lazyPage(() => import('./pages/TheLittleGarden/StartBusiness'));
const BusinessPlan = lazyPage(() => import('./pages/TheLittleGarden/BusinessPlan'));
const SproutSignup = lazyPage(() => import('./pages/TheLittleGarden/SproutSignup'));
const AuthCallback = lazyPage(() => import('./pages/Auth/AuthCallback'));
const Login = lazyPage(() => import('./pages/Auth/Login'));
const Register = lazyPage(() => import('./pages/Auth/Register'));
const AccountRecovery = lazyPage(() => import('./pages/Auth/AccountRecovery'));
const Admin = lazyPage(() => import('./pages/Management/Admin'));
const MyPlaces = lazyPage(() => import('./pages/Management/MyPlaces'));
const RequestPlace = lazyPage(() => import('./pages/Management/RequestPlace'));
const Policies = lazyPage(() => import('./pages/Help/Policies'));
const Browse = lazyPage(() => import('./pages/Browse/Browse'));
const Discover = lazyPage(() => import('./pages/Discover/Discover'));
const ReportUnsubscribe = lazyPage(() => import('./pages/Reports/ReportUnsubscribe'));

function SavedPlacesRoute() {
  const { search, hash } = useLocation();
  return hash === '#my-places' || new URLSearchParams(search).has('billing')
    ? <Navigate to={`/my-places${search}`} replace /> : <FavoritesList />;
}

const routes = [
  { path: '/', element: <Home /> },
  { path: '/map', element: <Map /> },
  { path: '/browse/*', element: <Browse /> },
  { path: '/discover/*', element: <Discover /> },
  { path: '/shop', element: <Shop /> },
  { path: '/about', element: <About /> },
  { path: '/help', element: <Help /> },
  { path: '/the-little-garden', element: <TheLittleGarden /> },
  { path: '/the-little-garden/start', element: <StartBusiness /> },
  { path: '/the-little-garden/bloom', element: <BusinessPlan plan="bloom" /> },
  { path: '/the-little-garden/thrive', element: <BusinessPlan plan="thrive" /> },
  { path: '/the-little-garden/sprout', element: <SproutSignup /> },
  { path: '/place/:slug', element: <Place /> },
  { path: '/login', element: <Login /> },
  { path: '/register', element: <Register /> },
  { path: '/settings', element: <Settings /> },
  { path: '/favorites', element: <SavedPlacesRoute /> },
  { path: '/auth/callback', element: <AuthCallback /> },
  { path: '/auth/forgot-password', element: <AccountRecovery mode="forgot" /> },
  { path: '/auth/reset-password', element: <AccountRecovery mode="reset" /> },
  { path: '/auth/resend-confirmation', element: <AccountRecovery mode="confirm" /> },
  { path: '/my-places', element: <MyPlaces /> },
  { path: '/reports/unsubscribe', element: <ReportUnsubscribe /> },
  { path: '/admin', element: <Admin /> },
  { path: '/request-place', element: <RequestPlace /> },
  { path: '/privacy', element: <Policies mode="privacy" /> },
  { path: '/membership-terms', element: <Policies mode="terms" /> },
];

function AppContent() {
  const { pathname } = useLocation();
  const ownerSetup = pathname.replace(/\/+$/, '') === '/the-little-garden/start';
  const currentRoute = routes.find(route => route.path.includes(':') ? pathname.startsWith(route.path.split(':')[0]) : route.path === pathname);
  return <>
    <Seo />
    <Nav variant={currentRoute?.navVariant || 'garden'} minimal={ownerSetup} />
    <ScrollToTop />
    <PageErrorBoundary key={pathname}>
    <Suspense fallback={<main id="main-content" className="route-loading" role="status">Finding your little place…</main>}>
      <Routes>
        {routes.map(route => <Route key={route.path} path={route.path} element={route.element} />)}
        <Route path="*" element={<main id="main-content" className="container" style={{ paddingBottom: 80 }}><h1>A little off the beaten path.</h1><p>We couldn’t find that page. <Link to="/">Head back home</Link> or <Link to="/map">explore the directory</Link>.</p></main>} />
      </Routes>
    </Suspense>
    </PageErrorBoundary>
    {!ownerSetup && <Footer />}
  </>;
}

export default function App() {
  return <Router><AuthProvider><ManagementProvider><FavoritesProvider><AppContent /></FavoritesProvider></ManagementProvider></AuthProvider></Router>;
}
