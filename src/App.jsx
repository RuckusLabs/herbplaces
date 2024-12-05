import { HashRouter as Router, Routes, Route } from "react-router-dom";
import Nav from './components/Nav';
import Home from "./pages/Home"
import About from "./pages/About";

function App() {

  return (
    <Router>
      <Nav />
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/about" element={<About />} />
      </Routes>
    </Router>
  )
}

export default App
