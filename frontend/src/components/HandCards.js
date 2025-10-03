import React from 'react';
import { getCardImagePath } from '../utils/cardAssets';
import './HandCards.css';

/**
 * 手牌组件 - 实现卡牌重叠显示效果
 * @param {Object} props 
 * @param {Array} props.cards - 卡牌数组
 * @param {Array} props.selectedCardIds - 选中的卡牌ID数组
 * @param {Function} props.onCardClick - 卡牌点击回调（参数为cardId）
 * @param {boolean} props.isMyTurn - 是否是我的回合
 * @param {string} props.position - 手牌位置 ('bottom', 'top', 'left', 'right')
 * @param {boolean} props.canSelect - 是否可以选牌（用于亮主阶段）
 */
const HandCards = ({ 
  cards = [], 
  selectedCardIds = [], 
  onCardClick = () => {}, 
  isMyTurn = false,
  position = 'bottom',
  canSelect = false
}) => {
  
  const handleCardClick = (cardId) => {
    // 在亮主阶段，所有玩家都可以选牌；在出牌阶段，只有当前回合玩家可以选牌
    if ((canSelect || isMyTurn) && onCardClick) {
      onCardClick(cardId);
    }
  };

  const getCardStyle = (index, total) => {
    const baseOffset = 30; // 基础重叠偏移量
    const maxWidth = 900; // 最大宽度
    const cardWidth = 80; // 单张卡牌宽度
    
    // 如果卡牌太多，动态调整重叠偏移
    let offset = baseOffset;
    if (total > 26) {
      // 30张牌的特殊情况，使用更紧密的间距
      offset = Math.max(10, (maxWidth - cardWidth) / (total - 1));
    } else if (total > 15) {
      // 15-26张牌的情况
      offset = Math.max(15, (maxWidth - cardWidth) / (total - 1));
    }

    const style = {
      position: 'absolute',
      zIndex: index,
      transition: 'all 0.3s ease',
      cursor: (canSelect || isMyTurn) ? 'pointer' : 'default'
    };

    // 根据位置设置样式
    switch (position) {
      case 'bottom': // 底部玩家（自己）
        style.left = `${index * offset}px`;
        style.bottom = '0px';
        break;
      case 'top': // 顶部玩家
        style.left = `${index * offset}px`;
        style.top = '0px';
        break;
      case 'left': // 左侧玩家
        style.top = `${index * (offset * 0.8)}px`;
        style.left = '0px';
        // 取消旋转效果
        break;
      case 'right': // 右侧玩家
        style.top = `${index * (offset * 0.8)}px`;
        style.right = '0px';
        // 取消旋转效果
        break;
      default:
        style.left = `${index * offset}px`;
    }

    return style;
  };

  const getContainerClass = () => {
    return `hand-cards hand-cards-${position} ${isMyTurn ? 'my-turn' : ''}`;
  };

  return (
    <div className={getContainerClass()}>
      {cards.map((card, index) => (
        <div
          key={card.id}
          className={`hand-card-item ${selectedCardIds.includes(card.id) ? 'selected' : ''}`}
          style={{
            ...getCardStyle(index, cards.length),
            bottom: selectedCardIds.includes(card.id) ? '20px' : '0px'
          }}
          onClick={() => handleCardClick(card.id)}
          title={`${card.suit} ${card.rank}`}
        >
          <img
            src={getCardImagePath(card)}
            alt={`${card.suit} ${card.rank}`}
            className="hand-card-image"
            onError={(e) => {
              console.error('卡牌图片加载失败:', getCardImagePath(card));
              e.target.src = '/assets/cards/BACK.svg'; // 加载失败时显示背面
            }}
          />
        </div>
      ))}
    </div>
  );
};

export default HandCards;
