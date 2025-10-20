class Card {
  constructor(suit, rank, deckNumber = 0) {
    this.suit = suit; // 'spades', 'hearts', 'diamonds', 'clubs', 'joker'
    this.rank = rank; // 2-10, 'J', 'Q', 'K', 'A', 'small', 'big'
    this.deckNumber = deckNumber; // 0 or 1 (用于区分两副牌)
    this.id = `${suit}_${rank}_${deckNumber}`;
  }

  // 获取牌的显示名称
  getDisplayName() {
    if (this.suit === 'joker') {
      return this.rank === 'small' ? '小王' : '大王';
    }
    
    const suitNames = {
      'spades': '♠',
      'hearts': '♥',
      'diamonds': '♦',
      'clubs': '♣'
    };
    
    const rankNames = {
      'J': 'J',
      'Q': 'Q', 
      'K': 'K',
      'A': 'A'
    };
    
    const suitSymbol = suitNames[this.suit];
    const rankDisplay = rankNames[this.rank] || this.rank;
    
    return `${suitSymbol}${rankDisplay}`;
  }

  // 获取牌的数值（用于排序和比较）
  getNumericValue(currentLevel = 2, trumpSuit = null) {
    // 山东升级特殊规则：2,3,5为常主
    const permanentTrumps = [2, 3, 5];
    
    if (this.suit === 'joker') {
      return this.rank === 'small' ? 16 : 17; // 小王16，大王17
    }
    
    // 如果是当前级牌
    if (this.rank === currentLevel) {
      if (this.suit === trumpSuit) {
        return 15; // 主级牌
      } else {
        return 14; // 副级牌
      }
    }
    
    // 常主牌
    if (permanentTrumps.includes(this.rank)) {
      if (this.suit === trumpSuit) {
        // 主牌中的常主
        if (this.rank === 2) return 11;
        if (this.rank === 3) return 12;
        if (this.rank === 5) return 13;
      } else {
        // 副牌中的常主
        if (this.rank === 2) return 8;
        if (this.rank === 3) return 9;
        if (this.rank === 5) return 10;
      }
    }
    
    // 普通牌
    const rankValues = {
      4: 1, 6: 2, 7: 3, 8: 4, 9: 5,
      'J': 6, 'Q': 7, 'K': 8, 'A': 9
    };
    
    return rankValues[this.rank] || 0;
  }

  // 判断是否为主牌
  isTrump(currentLevel = 2, trumpSuit = null) {
    // 大小王总是主牌
    if (this.suit === 'joker') return true;
    
    // 级牌总是主牌
    if (this.rank === currentLevel) return true;
    
    // 常主总是主牌
    if ([2, 3, 5].includes(this.rank)) return true;
    
    // 主花色的牌
    if (this.suit === trumpSuit) return true;
    
    return false;
  }

  // 判断是否为分牌
  isScoreCard() {
    return this.rank === '5' || this.rank === '10' || this.rank === 'K';
  }

  // 获取分值
  getPoints() {
    if (this.rank === '5') return 5;
    if (this.rank === '10' || this.rank === 'K') return 10;
    return 0;
  }

  // 转换为JSON
  toJSON() {
    return {
      id: this.id,
      suit: this.suit,
      rank: this.rank,
      deckNumber: this.deckNumber,
      displayName: this.getDisplayName()
    };
  }
}

module.exports = Card;
