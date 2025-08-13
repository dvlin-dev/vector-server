// k6 run src/modules/vector/test/vector-load-test.js
import http from 'k6/http';
import { sleep, check } from 'k6';
import { SharedArray } from 'k6/data';
import { randomString } from 'https://jslib.k6.io/k6-utils/1.2.0/index.js';

// 测试配置
export const options = {
  stages: [
    { duration: '30s', target: 20 }, // 逐步增加到20个虚拟用户
    { duration: '1m', target: 20 },  // 保持20个虚拟用户1分钟
    { duration: '30s', target: 0 },  // 逐步减少到0
  ],
  thresholds: {
    http_req_duration: ['p(95)<2000'], // 95%的请求在2秒内完成
    http_req_failed: ['rate<0.01'],    // 请求失败率低于1%
  },
};

// 基础URL
const BASE_URL = 'http://localhost:13000/api'; // 请根据实际情况修改
const AUTH_TOKEN = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiJhMzcwODNkZS1mNTg3LTRiMmEtYTZhMi01MDNmOTBhNzlkZjciLCJlbWFpbCI6IjE1NjEzMTQzMzRAcXEuY29tIiwidXNlcm5hbWUiOiIxNTYxMzE0MzM0XzAwMzg4IiwiaWF0IjoxNzQ1OTAwOTU5LCJleHAiOjE3NDg0OTI5NTl9.aqK2cG8fzAa7PjBm9xqdRJp8FM91Acyl8LcE5YA2gzY'; // 请替换为实际的授权令牌

// 生成指定长度的随机内容
function generateRandomContent(baseText, length) {
  let result = baseText;
  // 添加随机文本直到达到所需长度
  while (result.length < length) {
    result += " " + randomString(10);
  }
  return result.substring(0, length); // 确保不超过指定长度
}

// 创建一组测试数据
const testVectors = new SharedArray('test vectors', function() {
  const vectors = [];
  for (let i = 0; i < 50; i++) {
    // 生成约200字符的内容
    const content = generateRandomContent(`测试内容_${i}_${randomString(5)}`, 200);
    vectors.push({
      content: content
    });
  }
  return vectors;
});

// 保存创建的向量ID
let createdVectorIds = [];

// 测试函数
export default function() {
  const params = {
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${AUTH_TOKEN}`,
      'accept': '*/*'
    },
  };

  // 随机选择一个测试向量
  const testVector = testVectors[Math.floor(Math.random() * testVectors.length)];

  // 1. 创建向量
  const createResponse = http.post(
    `${BASE_URL}/vector`,
    JSON.stringify(testVector),
    params
  );
  
  check(createResponse, {
    'Create vector status is 201': (r) => r.status === 201,
  });

  if (createResponse.status === 201) {
    try {
      const vectorId = JSON.parse(createResponse.body).id;
      if (vectorId) {
        createdVectorIds.push(vectorId);

        // 2. 根据ID查询向量
        const getResponse = http.get(
          `${BASE_URL}/vector/${vectorId}/detail?id=${vectorId}`,
          params
        );
        
        check(getResponse, {
          'Get vector status is 200': (r) => r.status === 200,
        });

        // 3. 更新向量
        const updateData = {
          id: vectorId,
          content: generateRandomContent(`测试内容_updated_${randomString(5)}`, 200)
        };

        const updateResponse = http.patch(
          `${BASE_URL}/vector`,
          JSON.stringify(updateData),
          params
        );
        
        check(updateResponse, {
          'Update vector status is 200': (r) => r.status === 200,
        });
      }
    } catch (e) {
      console.error('解析响应失败:', e);
    }
  }

  // 4. 相似度搜索
  const searchTerm = `测试内容_${randomString(3)}`;
  const searchSize = 10;

  const searchResponse = http.get(
    `${BASE_URL}/vector/similarity_search?message=${encodeURIComponent(searchTerm)}&size=${searchSize}`,
    params
  );
  
  check(searchResponse, {
    'Search vector status is 200': (r) => r.status === 200,
  });

  sleep(1);
}

// 可选的清理函数
export function teardown() {
  // 清理创建的测试数据，防止数据库膨胀
  const params = {
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${AUTH_TOKEN}`,
      'accept': '*/*'
    },
  };

  // 只删除最多30个向量，避免过长时间
  const deleteCount = Math.min(createdVectorIds.length, 30);
  for (let i = 0; i < deleteCount; i++) {
    http.del(`${BASE_URL}/vector/${createdVectorIds[i]}`, null, params);
  }
} 