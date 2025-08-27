# 📋 User Stories & Backlog

## Format
As a [role], I want [feature] so that [benefit].

## Sprint 1 - 已完成 ✅

### Must Have (MVP) - 已实现
- ✅ **房间系统**: As a player, I want to create/join a room so I can play with friends.
  - 实现状态: 完成 - 玩家可以创建6位数房间ID，其他玩家可通过ID加入
  - 功能: 创建房间、加入房间、查看可用房间列表、实时房间状态更新

- ✅ **多人连接**: As a player, I want to see other players in real-time so I know who I'm playing with.
  - 实现状态: 完成 - 支持4人实时连接，显示玩家列表和连接状态
  - 功能: 实时玩家加入/离开通知、房间满员自动开始游戏准备

- ✅ **用户界面**: As a player, I want a clear and intuitive interface so I can easily navigate the game.
  - 实现状态: 完成 - 响应式React界面，清晰的房间管理界面
  - 功能: 连接状态显示、玩家名称输入、房间创建/加入界面

## Sprint 2 - 开发中 🚧

### Must Have (MVP) - 待实现
- 🔄 **发牌系统**: As a player, I want to receive my cards in real-time so I can see my hand.
  - 目标: 实现山东升级双副牌发牌（每人26张，留4张底牌）
  - 状态: 后端逻辑已建立，需要前端界面集成

- 🔄 **亮主系统**: As a player, I want to declare trump suit so I can influence the game direction.
  - 目标: 实现山东升级特色的"一王带一对"亮主规则
  - 包含: 亮主、反主、加固等机制

- 🔄 **出牌系统**: As a player, I want to take actions when my cards meet certain requirements so the game can proceed properly.
  - 目标: 实现完整的出牌逻辑（单张、对子、连对、闪、雨等）
  - 包含: 跟牌规则、主杀、超吃等机制

- 🔄 **计分升级**: As a player, I want to see scoring and level progression so I understand game progress.
  - 目标: 实现山东升级的计分和升级规则
  - 包含: 分牌统计、抠底倍数、升级判定

## Should Have
- 🔄 **重连功能**: As a player, I want to reconnect if disconnected so I don't lose my game progress.
- 🔄 **游戏历史**: As a player, I want to see game history so I can track my performance.

## Could Have
- 🔄 **聊天功能**: As a player, I want to chat with others in the room so we can communicate.
- 🔄 **观战模式**: As a spectator, I want to watch ongoing games so I can learn and enjoy.
- 🔄 **自定义规则**: As a room creator, I want to set custom rules so we can play variations.

## Won't Have (for now)
- AI bots - 专注多人在线体验
- Mobile app (native) - 先完成Web版本
- Themed table designs - 功能优先
- Leaderboards - MVP后考虑

## 技术债务和改进
- 🔄 **错误处理**: 改善网络错误和异常情况处理
- 🔄 **性能优化**: 优化实时数据传输和渲染性能
- 🔄 **测试覆盖**: 添加单元测试和集成测试
- 🔄 **代码文档**: 完善API文档和代码注释
