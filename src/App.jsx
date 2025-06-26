import Footer from "./components/Footer/Footer";
import { BrowserRouter as Router, Routes, Route, useLocation } from "react-router-dom";
import ScrollToTop from "./utilities/ScrollToTop";
import Nav from './components/Nav/Nav';
import Home from "./pages/Home/Home";
import About from "./pages/About/About";
import Help from "./pages/Help/Help";
import Shop from "./pages/Shop/Shop";
import Map from "./pages/Map/Map";
import Place from "./pages/Place/Place";
import FavoritesList from "./components/FavoritesList/FavoritesList";
import TheLittleGarden from "./pages/TheLittleGarden/TheLittleGarden";
import SproutSignup from "./pages/TheLittleGarden/SproutSignup";
import { AuthProvider } from './contexts/AuthContext';
import AuthCallback from './pages/Auth/AuthCallback';
import Login from "./pages/Auth/Login";
import Register from "./pages/Auth/Register";

const defaultConfig = {
  navVariant: 'garden'
};

const routes = [
  { path: '/', element: <Home />, navVariant: 'bleed' },
  { path: '/map', element: <Map /> },
  { path: '/shop', element: <Shop /> },
  { path: '/about', element: <About /> },
  { path: '/help', element: <Help /> },
  { path: '/the-little-garden', element: <TheLittleGarden />, navVariant: 'bleed' },
  { path: '/the-little-garden/sprout', element: <SproutSignup />},
  { path: '/place/:slug', element: <Place /> },
  { path: '/login', element: <Login /> },
  { path: '/register', element: <Register /> },
  { path: '/favorites', element: <FavoritesList /> },
  { path: '/auth/callback', element: <AuthCallback /> },
].map(route => ({ ...defaultConfig, ...route }));

function AppContent() {
  const location = useLocation();
  const currentRoute = routes.find(route => {
    // Handle dynamic routes like /place/:slug
    if (route.path.includes(':')) {
      return location.pathname.startsWith(route.path.split(':')[0]);
    }
    return route.path === location.pathname;
  });
  const navVariant = currentRoute?.navVariant || defaultConfig.navVariant;

  return (
    <>
      <Nav variant={navVariant} />
      <ScrollToTop />
      <Routes>
        {routes.map(route => (
          <Route key={route.path} path={route.path} element={route.element} />
        ))}
      </Routes>
      <Footer />
    </>
  );
}

function App() {
  return (
    <Router>
      <AuthProvider>
        <AppContent />
      </AuthProvider>
    </Router>
  );
}

export default App