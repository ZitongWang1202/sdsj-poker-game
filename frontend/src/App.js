import React, { useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import GameLobby from './components/GameLobby';
import PokerTable from './components/PokerTable';
import socketService from './services/socketService';
import './App.css';

function App() {
  useEffect(() => {
    // 应用启动时不立即连接，让组件自己管理连接
    if (process.env.NODE_ENV === 'development') console.log('🚀 应用启动完成');
    
    // 应用卸载时断开连接
    return () => {
      if (process.env.NODE_ENV === 'development') console.log('📱 应用卸载，断开Socket连接');
      socketService.disconnect();
    };
  }, []);

  return (
    <Router basename={process.env.NODE_ENV === 'production' ? '/sdsj-poker-game' : '/'}>
      <div className="App">
        <Routes>
          <Route path="/" element={<GameLobby />} />
          <Route path="/game/:roomId" element={<PokerTable />} />
        </Routes>
      </div>
    </Router>
  );
}

export default App;
