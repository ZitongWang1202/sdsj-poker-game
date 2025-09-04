import React from 'react';
import { getCardImagePath } from '../utils/cardAssets';
import './HandCards.css';

/**
 * 手牌组件 - 实现卡牌重叠显示效果
 * @param {Object} props 
 * @param {Array} props.cards - 卡牌数组
 * @param {Array} props.selectedCards - 选中的卡牌索引数组
 * @param {Function} props.onCardClick - 卡牌点击回调
 * @param {boolean} props.isMyTurn - 是否是我的回合
 * @param {string} props.position - 手牌位置 ('bottom', 'top', 'left', 'right')
 */
const HandCards = ({ 
  cards = [], 
  selectedCards = [], 
  onCardClick = () => {}, 
  isMyTurn = false,
  position = 'bottom'
}) => {
  
  const handleCardClick = (cardIndex) => {
    if (isMyTurn && onCardClick) {
      onCardClick(cardIndex);
    }
  };

  const getCardStyle = (index, total) => {
    const baseOffset = 30; // 基础重叠偏移量
    const maxWidth = 800; // 最大宽度
    const cardWidth = 80; // 单张卡牌宽度
    
    // 如果卡牌太多，动态调整重叠偏移
    let offset = baseOffset;
    if (total > 15) {
      offset = Math.max(15, maxWidth / total);
    }

    const style = {
      position: 'absolute',
      zIndex: index,
      transition: 'all 0.3s ease',
      cursor: isMyTurn ? 'pointer' : 'default'
    };

    // 根据位置设置样式
    switch (position) {
      case 'bottom': // 底部玩家（自己）
        style.left = `${index * offset}px`;
        style.bottom = selectedCards.includes(index) ? '20px' : '0px';
        break;
      case 'top': // 顶部玩家
        style.left = `${index * offset}px`;
        style.top = '0px';
        break;
      case 'left': // 左侧玩家
        style.top = `${index * (offset * 0.8)}px`;
        style.left = '0px';
        style.transform = 'rotate(90deg)';
        style.transformOrigin = 'center';
        break;
      case 'right': // 右侧玩家
        style.top = `${index * (offset * 0.8)}px`;
        style.right = '0px';
        style.transform = 'rotate(-90deg)';
        style.transformOrigin = 'center';
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
          key={`${card.suit}-${card.rank}-${index}`}
          className={`hand-card-item ${selectedCards.includes(index) ? 'selected' : ''}`}
          style={getCardStyle(index, cards.length)}
          onClick={() => handleCardClick(index)}
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
