# 🔧 技术进度文档

## 项目概述
山东升级扑克游戏 - 基于React + Node.js的实时多人在线游戏

## 当前架构

### 后端架构 (Node.js)
```
backend/
├── src/
│   ├── server.js              # 主服务器文件，Socket.io配置
│   ├── controllers/
│   │   └── GameManager.js     # 游戏管理器，房间和玩家管理
│   └── models/
│       ├── Player.js          # 玩家模型
│       ├── Room.js            # 房间模型  
│       ├── Card.js            # 扑克牌模型
│       └── ShandongUpgradeGame.js  # 山东升级游戏逻辑
├── package.json               # 依赖管理
└── .env.example              # 环境变量示例
```

**已实现功能**:
- ✅ Express服务器 + Socket.io实时通信
- ✅ 房间创建/加入/管理系统
- ✅ 玩家连接管理和状态追踪
- ✅ 双副牌系统 (108张牌)
- ✅ 山东升级特殊规则 (2,3,5常主)
- ✅ 基础游戏状态管理

**核心API端点**:
- `GET /` - 服务器状态检查
- `GET /health` - 健康检查

**Socket事件**:
- `createRoom` - 创建房间
- `joinRoom` - 加入房间  
- `getRooms` - 获取房间列表
- `playCards` - 出牌 (待实现)
- `declareTrump` - 亮主 (待实现)

### 前端架构 (React)
```
frontend/src/
├── components/
│   ├── GameLobby.js          # 游戏大厅主组件
│   └── GameLobby.css         # 样式文件
├── services/
│   └── socketService.js      # Socket.io客户端服务
├── utils/
│   └── cardUtils.js          # 扑克牌工具函数
├── assets/
│   └── cards/                # SVG扑克牌资源
│       ├── SPADES/           # 黑桃 (13张)
│       ├── HEARTS/           # 红桃 (13张)
│       ├── DIAMONDS/         # 方块 (13张)
│       ├── CLUBS/            # 梅花 (13张)
│       ├── JOKER/            # 大小王 (2张)
│       └── BACK.svg          # 牌背
├── App.js                    # 主应用组件
└── App.css                   # 全局样式
```

**已实现功能**:
- ✅ 实时Socket.io连接管理
- ✅ 房间创建/加入界面
- ✅ 玩家列表和状态显示  
- ✅ 响应式UI设计
- ✅ 完整的扑克牌SVG资源集成
- ✅ 扑克牌工具函数 (排序、判断主副牌等)

## 技术栈

### 依赖包
**后端**:
- `express` ^5.1.0 - Web服务器框架
- `socket.io` ^4.8.1 - 实时通信
- `cors` ^2.8.5 - 跨域处理
- `dotenv` ^17.2.1 - 环境变量
- `nodemon` ^3.1.10 - 开发热重载

**前端**:
- `react` ^19.1.1 - UI框架
- `socket.io-client` - Socket客户端
- `react-scripts` 5.0.1 - 构建工具

### 开发环境
- **后端端口**: 3001
- **前端端口**: 3000  
- **通信协议**: WebSocket + HTTP polling fallback
- **数据格式**: JSON

## 数据模型

### Player (玩家)
```javascript
{
  socketId: String,      // Socket连接ID
  name: String,          // 玩家名称
  position: Number,      // 座位位置 (0-3)
  cards: Array,          // 手牌
  score: Number,         // 当前得分
  level: Number,         // 当前级别 (默认2)
  isDealer: Boolean,     // 是否为庄家
  isConnected: Boolean   // 连接状态
}
```

### Room (房间)
```javascript
{
  id: String,            // 6位房间ID
  name: String,          // 房间名称
  players: Array,        // 玩家列表 (最多4人)
  maxPlayers: Number,    // 最大玩家数 (4)
  gameStarted: Boolean,  // 游戏是否开始
  game: Object,          // 游戏实例
  createdAt: Date        // 创建时间
}
```

### Card (扑克牌)
```javascript
{
  suit: String,          // 花色: spades/hearts/diamonds/clubs/joker
  rank: String/Number,   // 点数: 2-10/J/Q/K/A/small/big
  deckNumber: Number,    // 牌副编号 (0或1)
  id: String            // 唯一标识
}
```

## 山东升级特殊规则

### 常主系统
- **常主牌**: 2, 3, 5 永远是主牌
- **级牌**: 当前打的级别 (如打10时，所有10都是级牌)
- **主花色**: 亮主确定的花色

### 牌张大小顺序 (以打10为例)
**主牌**: 4 < 6 < 7 < 8 < 9 < J < Q < K < A < 副2 < 主2 < 副3 < 主3 < 副5 < 主5 < 副10 < 主10 < 小王 < 大王

**副牌**: 2 < 3 < 4 < 5 < 6 < 7 < 8 < 9 < J < Q < K < A (但2,3,5实际上是主牌)

### 特殊牌型
- **闪/震**: 四张不同花色的主牌
- **雨(顺子)**: 同花色连续5张以上
- **连对**: 相邻级别的两个或多个对子

## 下一步开发计划

### Sprint 2 - 游戏核心逻辑
1. **发牌界面**: 前端显示玩家手牌
2. **亮主系统**: 实现"一王带一对"亮主机制
3. **出牌逻辑**: 实现各种牌型的出牌和跟牌
4. **计分系统**: 实现分牌统计和抠底计算
5. **升级判定**: 根据得分确定升级情况

### 技术改进
- 添加单元测试覆盖
- 完善错误处理和重连机制
- 优化实时数据传输性能
- 添加游戏状态持久化

## 部署说明

### 开发环境启动
```bash
# 后端
cd backend && npm run dev

# 前端  
cd frontend && npm start
```

### 生产环境部署
```bash
# 后端
cd backend && npm start

# 前端
cd frontend && npm run build
```

## 测试状态
- ✅ 房间创建/加入功能测试
- ✅ 多人实时连接测试
- ✅ UI响应式测试
- 🔄 游戏逻辑单元测试 (待添加)
- 🔄 端到端测试 (待添加)
