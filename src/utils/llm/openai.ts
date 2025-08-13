import { OpenAI } from 'langchain/llms/openai';
import { ModelType } from 'src/types/chat';
import { KeyConfiguration } from 'src/types/keyConfiguration';
import { ChatOpenAI } from 'langchain/chat_models/openai';

type GetModelType = 'openAi' | 'chatOpenAi';

export const getModel = async (
  keyConfiguration: KeyConfiguration,
  type: GetModelType = 'openAi'
) => {
  const {
    apiType,
    azureApiKey,
    azureInstanceName,
    azureDeploymentName,
    azureApiVersion,
    apiModel,
    apiKey,
    basePath,
  } = keyConfiguration;

  const commonConfig = {
    temperature: 0,
    maxTokens: 400
    // streaming: true,
  };

  const azureConfig = {
    azureOpenAIApiKey: azureApiKey,
    azureOpenAIApiInstanceName: azureInstanceName,
    azureOpenAIApiDeploymentName: azureDeploymentName,
    azureOpenAIApiVersion: azureApiVersion,
  };
  const openAIConfig = {
    modelName: apiModel,
    openAIApiKey: apiKey,
  };

  const getConfiguration = (apiType: ModelType) => {
    switch (apiType) {
      case ModelType.OPENAI:
        return {
          ...commonConfig,
          ...openAIConfig,
        };
      case ModelType.AZURE_OPENAI:
        return {
          ...commonConfig,
          ...azureConfig,
        };
    }
  };

  return type === 'chatOpenAi'
    ? new ChatOpenAI(getConfiguration(apiType), { basePath })
    : new OpenAI(getConfiguration(apiType), { basePath });
};
