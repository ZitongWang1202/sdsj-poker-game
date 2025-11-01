import React from 'react';
import { getCardImagePath } from '../utils/cardAssets';
import { isCardTrump } from '../utils/cardUtils';
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
 * @param {number} props.currentLevel - 当前级别
 * @param {string} props.trumpSuit - 主牌花色
 * @param {boolean} props.showTrumpIndicator - 是否显示主牌标识
 * @param {string} props.gamePhase - 游戏阶段
 */
const HandCards = ({ 
  cards = [], 
  selectedCardIds = [], 
  onCardClick = () => {}, 
  isMyTurn = false,
  position = 'bottom',
  canSelect = false,
  currentLevel = 2,
  trumpSuit = null,
  showTrumpIndicator = false,
  gamePhase = null
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
    
    // 使用固定的偏移量，避免发牌过程中的布局变化
    // 预设26张牌的布局参数，确保发牌过程中布局稳定
    let offset = baseOffset;
    if (total > 15) {
      // 使用固定的紧密间距，避免发牌过程中的突然撑开
      offset = Math.max(15, (maxWidth - cardWidth) / 25); // 使用25而不是total-1
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
      {cards.map((card, index) => {
        const isTrump = showTrumpIndicator && isCardTrump(card, currentLevel, trumpSuit);
        const isBottomCard = gamePhase === 'bottom' && card.isBottomCard === true;
        
        // 调试：检查底牌标识显示
        if (gamePhase === 'bottom' && card.isBottomCard === true) {
          console.log('🃏 HandCards检测到底牌标记:', {
            gamePhase,
            cardId: card.id,
            cardSuit: card.suit,
            cardRank: card.rank,
            isBottomCard: card.isBottomCard,
            shouldShow: isBottomCard
          });
        }
        
        return (
          <div
            key={card.id}
            className={`hand-card-item ${selectedCardIds.includes(card.id) ? 'selected' : ''} ${isTrump ? 'trump-card' : ''}`}
            style={{
              ...getCardStyle(index, cards.length),
              bottom: selectedCardIds.includes(card.id) ? '20px' : '0px'
            }}
            onClick={() => handleCardClick(card.id)}
            title={`${card.suit} ${card.rank}${isTrump ? ' (主牌)' : ''}${isBottomCard ? ' (底牌)' : ''}`}
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
            {isTrump && (
              <div className="trump-indicator">
                <span className="trump-star">★</span>
              </div>
            )}
            {isBottomCard && (
              <div className="bottom-card-indicator">
                <span className="bottom-card-label">底</span>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};

export default HandCards;
