import React from "react";
import { BrowserRouter as Router, Routes, Route, Link } from "react-router-dom";
import Home from "./pages/Home";
import AdminPanel from "./components/AdminPanel";

const App = () => {
  return (
    <Router>
      <div className="bg-white dark:bg-slate-900 min-h-screen text-slate-900 dark:text-slate-100 flex flex-col">
        {/* Navigation Header */}
        <nav className="bg-slate-800 text-white p-4 shadow-md">
          <div className="container mx-auto flex justify-between items-center">
            <Link to="/" className="text-xl font-bold hover:text-blue-400">PDF Data Extractor</Link>
            <div className="space-x-4">
              <Link to="/" className="hover:text-blue-300">Home</Link>
              <Link to="/admin" className="hover:text-blue-300">Admin</Link>
            </div>
          </div>
        </nav>

        {/* Main Content */}
        <main className="flex-grow">
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/admin" element={<AdminPanel />} />
          </Routes>
        </main>
      </div>
    </Router>
  );
};

export default App;
