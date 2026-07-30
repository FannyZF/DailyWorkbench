const axios = require('axios');

const DEEPSEEK_BASE_URL = process.env.DEEPSEEK_BASE_URL || 'https://api.deepseek.com';

function getApiKey() {
  try {
    const { getDb } = require('../db/database');
    const db = getDb();
    if (db) {
      const row = db.prepare("SELECT value FROM settings WHERE key = 'deepseekApiKey'").get();
      if (row && row.value) return row.value;
    }
  } catch (e) { /* fallback to env */ }
  return process.env.DEEPSEEK_API_KEY || '';
}

async function callDeepseek(messages, options = {}) {
  const apiKey = getApiKey();
  if (!apiKey) {
    console.warn('[Deepseek] API Key 未配置，AI 功能不可用。请在系统设置页面或 .env 文件中配置。');
    return null;
  }

  const { maxTokens = 200, temperature = 0.3 } = options;
  try {
    const response = await axios.post(
      `${DEEPSEEK_BASE_URL}/v1/chat/completions`,
      {
        model: 'deepseek-chat',
        messages,
        max_tokens: maxTokens,
        temperature,
      },
      {
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        timeout: 30000,
      }
    );
    return response.data.choices[0].message.content.trim();
  } catch (err) {
    console.error('[Deepseek API Error]', err.message);
    return null;
  }
}

async function categorizeEntry(description) {
  const { getDb } = require('../db/database');
  const db = getDb();
  const categories = db.prepare('SELECT name FROM categories ORDER BY sort_order').all();
  const categoryList = categories.map(c => c.name).join('、');

  const truncated = description.length > 300 ? description.substring(0, 300) : description;

  const result = await callDeepseek([
    {
      role: 'system',
      content: `你是一名党建工作内容分类助手。请阅读以下工作内容描述，从提供的分类标签列表中选出最匹配的一个标签，仅返回标签名称，不要添加任何解释。分类标签列表：${categoryList}。`,
    },
    { role: 'user', content: truncated },
  ], { maxTokens: 20, temperature: 0.1 });

  if (!result) return '未分类';

  const validCategories = categories.map(c => c.name);
  if (validCategories.includes(result)) return result;

  return '未分类';
}

async function generateSummary(stats, summaries, startDate, endDate) {
  const summaryText = summaries.map((s, i) => `${i + 1}. [${s.category}] ${s.description}`).join('\n');
  const statsText = Object.entries(stats).map(([k, v]) => `${k}: ${v}次`).join('，');

  const result = await callDeepseek([
    {
      role: 'system',
      content: '你是一名党建工作汇报秘书。请根据以下信息撰写一段正式的工作汇总报告，语气客观务实、适合向领导汇报。要求200至500字。',
    },
    {
      role: 'user',
      content: `数据为：在 ${startDate} 至 ${endDate} 期间，各类工作统计如下：${statsText}。以下为各工作的摘要内容：\n${summaryText}`,
    },
  ], { maxTokens: 800, temperature: 0.5 });

  return result || 'AI 总结生成失败，请稍后重试。';
}

async function expandContent(description) {
  const result = await callDeepseek([
    {
      role: 'system',
      content: '你是一名党政信息稿撰写员。请将以下工作记录扩写为一段正式的信息稿段落，语气庄重务实、用词规范，适当丰富背景和成效描述，但不得虚构事实。控制在200至400字。',
    },
    { role: 'user', content: description },
  ], { maxTokens: 600, temperature: 0.5 });

  return result || description;
}

module.exports = { callDeepseek, categorizeEntry, generateSummary, expandContent };
