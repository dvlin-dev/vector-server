import OpenAI from "openai";

export const tools: OpenAI.Chat.Completions.ChatCompletionTool[] = [{
  type: 'function',
  function: {
    name: 'extract_unanswerable_question',
    description: '当背景信息不足以回答用户问题时，提取用户的核心问题',
    parameters: {
      type: 'object',
      properties: {
        question: {
          type: 'string',
          description: '用户的核心问题，精炼且清晰'
        },
        type: {
          type: 'string',
          description: '用户的问题类型，例如：产品咨询、售后服务、价格咨询、其他等'
        }
      },
      required: ['question', 'type']
    }
  }
}];