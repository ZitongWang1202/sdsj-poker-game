import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import socketService from '../services/socketService';
import './GameLobby.css';

const GameLobby = () => {
  const navigate = useNavigate();
  const [playerName, setPlayerName] = useState('');
  const [roomId, setRoomId] = useState('');
  const [currentRoom, setCurrentRoom] = useState(null);
  const [availableRooms, setAvailableRooms] = useState([]);
  const [connectionStatus, setConnectionStatus] = useState('disconnected');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    console.log('🎮 GameLobby组件开始连接Socket服务器');
    
    // 连接到服务器
    const connectSocket = async () => {
      try {
        console.log('🎯 开始连接Socket服务器:', process.env.REACT_APP_SERVER_URL || 'http://localhost:3001');
        
        const socket = socketService.connect();
        console.log('🔗 GameLobby获取到Socket实例:', socket?.connected);
        console.log('🔗 Socket实例详情:', {
          connected: socket?.connected,
          id: socket?.id,
          transport: socket?.io?.engine?.transport?.name
        });
        
        // 添加连接状态检查
        setTimeout(() => {
          console.log('📊 连接状态检查:', {
            connected: socket?.connected,
            id: socket?.id,
            readyState: socket?.io?.readyState
          });
          
          // 如果已连接但UI状态未更新，手动更新
          if (socket?.connected && connectionStatus !== 'connected') {
            console.log('🔄 手动更新连接状态');
            setConnectionStatus('connected');
            setMessage('✅ 已连接到服务器');
            setLoading(false);
          }
        }, 3000);
        
      } catch (error) {
        console.error('❌ GameLobby连接失败:', error);
        setConnectionStatus('error');
        setMessage('❌ 连接失败，请检查网络');
      }
    };
    
    connectSocket();
    
    // 监听连接状态
    socketService.on('connect', () => {
      console.log('🟢 GameLobby收到connect事件，更新UI状态');
      setConnectionStatus('connected');
      setMessage('✅ 已连接到服务器');
      setLoading(false);
      // 获取房间列表
      socketService.getRooms();
    }, 'GameLobby');

    socketService.on('disconnect', () => {
      setConnectionStatus('disconnected');
      setMessage('❌ 与服务器断开连接');
      setLoading(false);
    }, 'GameLobby');

    socketService.on('connect_error', (error) => {
      setConnectionStatus('error');
      setMessage('❌ 连接服务器失败，请检查后端是否启动');
      setLoading(false);
    }, 'GameLobby');

    // 监听房间相关事件
    socketService.on('roomCreated', (room) => {
      setCurrentRoom(room);
      setMessage(`🎉 房间创建成功！房间ID: ${room.id}`);
      setLoading(false);
    }, 'GameLobby');

    socketService.on('joinedRoom', (room) => {
      setCurrentRoom(room);
      setMessage(`✅ 成功加入房间: ${room.id}`);
      setLoading(false);
    }, 'GameLobby');

    socketService.on('playerJoined', (room) => {
      setCurrentRoom(room);
      setMessage(`👋 新玩家加入房间`);
    }, 'GameLobby');

    socketService.on('gameStarted', (data) => {
      console.log('🎮 GameLobby收到游戏开始事件:', data);
      
      setMessage(data.message || `🎮 游戏开始！正在进入游戏...`);
      
      // 优先使用事件数据中的room信息
      const roomIdToNavigate = data.room?.id || currentRoom?.id;
      console.log('🎯 准备跳转到房间:', roomIdToNavigate);
      
      if (roomIdToNavigate) {
        // 清理当前组件的事件监听并跳转
        setTimeout(() => {
          console.log('🚀 执行页面跳转到:', `/game/${roomIdToNavigate}`);
          socketService.offComponent('GameLobby'); // 清理事件监听
          navigate(`/game/${roomIdToNavigate}`);
        }, 1000); // 缩短延迟时间
      } else {
        console.log('❌ 没有找到房间ID，跳过导航');
      }
    }, 'GameLobby');

    socketService.on('joinError', (error) => {
      setMessage(`❌ 加入房间失败: ${error}`);
      setLoading(false);
    }, 'GameLobby');

    socketService.on('roomsList', (rooms) => {
      setAvailableRooms(rooms);
    }, 'GameLobby');

    // 设置初始连接状态
    setLoading(true);
    setMessage('🔄 正在连接服务器...');

    // 清理函数
    return () => {
      console.log('🧹 GameLobby组件卸载，清理事件监听');
      socketService.offComponent('GameLobby');
    };
  }, []);

  const handleCreateRoom = () => {
    if (!playerName.trim()) {
      setMessage('❌ 请输入玩家名称');
      return;
    }
    if (connectionStatus !== 'connected') {
      setMessage('❌ 请等待连接到服务器');
      return;
    }
    setLoading(true);
    setMessage('🔄 正在创建房间...');
    socketService.createRoom(playerName.trim());
  };

  const handleJoinRoom = (targetRoomId = null) => {
    if (!playerName.trim()) {
      setMessage('❌ 请输入玩家名称');
      return;
    }
    
    const targetId = targetRoomId || roomId.trim();
    if (!targetId) {
      setMessage('❌ 请输入房间ID');
      return;
    }

    if (connectionStatus !== 'connected') {
      setMessage('❌ 请等待连接到服务器');
      return;
    }
    
    setLoading(true);
    setMessage('🔄 正在加入房间...');
    socketService.joinRoom(targetId, playerName.trim());
  };

  const handleRefreshRooms = () => {
    if (connectionStatus === 'connected') {
      socketService.getRooms();
      setMessage('🔄 刷新房间列表');
    }
  };

  const getConnectionStatusClass = () => {
    switch (connectionStatus) {
      case 'connected': return 'status-connected';
      case 'disconnected': return 'status-disconnected';
      case 'error': return 'status-error';
      default: return 'status-connecting';
    }
  };

  const getConnectionStatusText = () => {
    switch (connectionStatus) {
      case 'connected': return '已连接';
      case 'disconnected': return '未连接';
      case 'error': return '连接错误';
      default: return '连接中...';
    }
  };

  return (
    <div className="game-lobby">
      <div className="lobby-header">
        <h1>🃏 山东升级扑克游戏</h1>
        <div className={`connection-status ${getConnectionStatusClass()}`}>
          {loading && <span className="loading"></span>}
          连接状态: {getConnectionStatusText()}
        </div>
      </div>

      {message && (
        <div className="message-box">
          {message}
        </div>
      )}

      {!currentRoom ? (
        <div className="lobby-content">
          <div className="card">
            <div className="player-input-section">
              <label htmlFor="playerName">玩家名称:</label>
              <input
                id="playerName"
                type="text"
                className="form-input"
                value={playerName}
                onChange={(e) => setPlayerName(e.target.value)}
                placeholder="输入你的名称"
                maxLength={20}
                disabled={loading}
              />
            </div>

            <div className="room-actions">
              <div className="create-room-section">
                <button 
                  onClick={handleCreateRoom}
                  disabled={loading || connectionStatus !== 'connected'}
                  className="btn btn-primary"
                >
                  {loading ? <span className="loading"></span> : ''} 创建房间
                </button>
              </div>

              <div className="join-room-section">
                <input
                  type="text"
                  className="form-input room-id-input"
                  value={roomId}
                  onChange={(e) => setRoomId(e.target.value.toUpperCase())}
                  placeholder="输入房间ID"
                  maxLength={6}
                  disabled={loading}
                />
                <button 
                  onClick={() => handleJoinRoom()}
                  disabled={loading || connectionStatus !== 'connected'}
                  className="btn btn-secondary"
                >
                  {loading ? <span className="loading"></span> : ''} 加入房间
                </button>
              </div>
            </div>
          </div>

          <div className="card">
            <div className="available-rooms">
              <div className="rooms-header">
                <h3>可用房间</h3>
                <button 
                  onClick={handleRefreshRooms} 
                  className="btn btn-success btn-small"
                  disabled={connectionStatus !== 'connected'}
                >
                  🔄 刷新
                </button>
              </div>
              
              {availableRooms.length === 0 ? (
                <p className="no-rooms">暂无可用房间</p>
              ) : (
                <div className="rooms-list">
                  {availableRooms.map(room => (
                    <div key={room.id} className="room-item">
                      <div className="room-info">
                        <div className="room-id">{room.id}</div>
                        <div className="room-name">{room.name}</div>
                        <div className="room-players">{room.players}/{room.maxPlayers}人</div>
                        <div className="room-host">房主: {room.hostName}</div>
                      </div>
                      <button 
                        onClick={() => handleJoinRoom(room.id)}
                        className="btn btn-primary btn-small"
                        disabled={loading || connectionStatus !== 'connected'}
                      >
                        加入
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      ) : (
        <div className="room-view card">
          <h2>房间: {currentRoom.id} - {currentRoom.name}</h2>
          
          <div className="players-section">
            <h3>玩家列表 ({currentRoom.players.length}/4)</h3>
            <div className="players-grid">
              {currentRoom.players.map((player, index) => (
                <div key={player.socketId} className="player-item">
                  <div className="player-avatar">👤</div>
                  <div className="player-info">
                    <div className="player-name">{player.name}</div>
                    <div className="player-badges">
                      {player.isDealer && <span className="badge dealer-badge">庄家</span>}
                      {index === 0 && <span className="badge host-badge">房主</span>}
                    </div>
                  </div>
                  <div className="player-position">位置 {index + 1}</div>
                </div>
              ))}
              
              {/* 空位显示 */}
              {Array.from({ length: 4 - currentRoom.players.length }, (_, i) => (
                <div key={`empty-${i}`} className="player-item empty">
                  <div className="player-avatar">⭕</div>
                  <div className="player-info">
                    <div className="player-name">等待玩家...</div>
                  </div>
                  <div className="player-position">位置 {currentRoom.players.length + i + 1}</div>
                </div>
              ))}
            </div>
          </div>

          {currentRoom.gameStarted ? (
            <div className="game-status success-message">
              <p>🎮 游戏开始！</p>
              <p>💡 正在跳转到游戏桌...</p>
            </div>
          ) : (
            <div className="waiting-status info-message">
              <p>⏳ 等待玩家加入 (还需 {4 - currentRoom.players.length} 名玩家)</p>
              <p>游戏将在4名玩家加入后自动开始</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default GameLobby;
