import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import Nav from './components/Nav';
import About from "./pages/About";
import HerbMap from "./components/Map";

function App() {

  return (
    <Router>
      <Nav />
      <Routes>
        <Route path="/herbplaces/about" element={<About />} />
      </Routes>
      <HerbMap />
    </Router>
  )
}

export default App
