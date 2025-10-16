/**
 * 测试执行脚本
 * 用于运行所有跟牌和甩牌相关的测试
 */

const FollowCardTester = require('./src/models/FollowCardTest');
const fs = require('fs');
const path = require('path');

console.clear();

// 运行测试
const tester = new FollowCardTester();
let results;

try {
  results = tester.runAllTests();
} catch (error) {
  console.error('\n❌ 测试执行失败:', error.message);
  console.error(error.stack);
  process.exit(1);
}

// 确保results存在
if (!results) {
  console.error('\n❌ 测试结果未定义');
  process.exit(1);
}

// 生成测试报告
const reportPath = path.join(__dirname, 'test-report.txt');
const timestamp = new Date().toLocaleString('zh-CN');

let report = '';
report += '╔════════════════════════════════════════════════╗\n';
report += '║  山东升级 - 跟牌和甩牌测试报告                ║\n';
report += '╚════════════════════════════════════════════════╝\n\n';
report += `测试时间: ${timestamp}\n`;
report += `测试环境: Node.js ${process.version}\n\n`;
report += '测试结果:\n';
report += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
report += `总测试数: ${results.total}\n`;
report += `✅ 通过: ${results.passed}\n`;
report += `❌ 失败: ${results.failed}\n`;
report += `通过率: ${((results.passed / results.total) * 100).toFixed(2)}%\n`;
report += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n`;

// 详细测试结果
report += '详细测试结果:\n\n';
results.results.forEach((result, index) => {
  const status = result.passed ? '✅' : '❌';
  report += `${index + 1}. ${status} ${result.name}\n`;
  if (!result.passed && result.message) {
    report += `   失败原因: ${result.message}\n`;
  }
  report += '\n';
});

// 如果有失败的测试，添加建议
if (results.failed > 0) {
  report += '\n建议修复的问题:\n';
  report += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
  
  const failedTests = results.results.filter(r => !r.passed);
  failedTests.forEach((test, index) => {
    report += `${index + 1}. ${test.name}\n`;
    report += `   问题: ${test.message}\n`;
    report += `   建议: 检查相关代码逻辑，确保符合游戏规则\n\n`;
  });
}

// 保存报告
fs.writeFileSync(reportPath, report, 'utf-8');
console.log(`\n📄 测试报告已保存至: ${reportPath}\n`);

// 退出码
process.exit(results.failed > 0 ? 1 : 0);

