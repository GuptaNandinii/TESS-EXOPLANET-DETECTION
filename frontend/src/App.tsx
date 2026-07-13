import React, { useState } from 'react';
import { Navbar } from './components/Navbar';
import { Home } from './views/Home';
import { Dashboard } from './views/Dashboard';
import { Learn } from './views/Learn';
import { About } from './views/About';

const App: React.FC = () => {
  const [currentView, setView] = useState<string>('home');
  const [backendOnline, setBackendOnline] = useState<boolean>(false);

  const renderView = () => {
    switch (currentView) {
      case 'home':
        return <Home setView={setView} />;
      case 'dashboard':
        return <Dashboard setBackendOnline={setBackendOnline} />;
      case 'pipeline':
        return <Learn />;
      case 'about':
        return <About />;
      default:
        return <Home setView={setView} />;
    }
  };

  return (
    <div className="min-h-screen bg-space-950 font-sans text-slate-200 antialiased overflow-x-hidden selection:bg-indigo-500/20 selection:text-indigo-300">
      <Navbar currentView={currentView} setView={setView} backendOnline={backendOnline} />
      <main className="pb-12">
        {renderView()}
      </main>
    </div>
  );
};

export default App;
