# 🃏 山东升级扑克游戏 (Shandongshengji Poker Game)

一个基于 React + Node.js 的多人在线山东升级扑克游戏。

## 🎯 项目概述

这是一个实时多人扑克游戏，支持4人同时在线游戏，具有流畅的实时更新和简洁的用户界面。

## 🚀 技术栈

- **前端**: React.js
- **后端**: Node.js + Express
- **实时通信**: Socket.io
- **包管理**: npm

## 📁 项目结构

```
sdsj/
├── frontend/          # React 前端应用
│   ├── src/
│   ├── public/
│   └── package.json
├── backend/           # Node.js 后端服务
│   ├── src/
│   └── package.json
├── docs/              # 项目文档
│   ├── VISION.md
│   ├── USER_STORIES.md
│   ├── GAME_RULES.md
│   └── AGILE_NOTES.md
└── README.md
```

## 🛠️ 安装和运行

### 前端 (React)
```bash
cd frontend
npm install
npm start  # 开发服务器运行在 http://localhost:3000
```

### 后端 (Node.js)
```bash
cd backend
npm install
npm run dev  # 开发服务器
# 或
npm start    # 生产环境
```

## 🎮 游戏规则

详细的游戏规则请查看 [GAME_RULES.md](docs/GAME_RULES.md)

## 📋 开发计划

- [x] 项目初始化
- [ ] 后端 API 开发
- [ ] Socket.io 实时通信
- [ ] 前端游戏界面
- [ ] 游戏逻辑实现
- [ ] 测试和优化

## 🤝 贡献

欢迎提交 Issues 和 Pull Requests！

## 📄 许可证

MIT License
