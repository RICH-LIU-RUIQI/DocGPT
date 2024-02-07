import { ChatOpenAI } from 'langchain/chat_models/openai';
import { ChatPromptTemplate, MessagesPlaceholder } from 'langchain/prompts';
import { RunnableSequence } from 'langchain/schema/runnable';
import { StringOutputParser } from 'langchain/schema/output_parser';
import type { Document } from 'langchain/document';
import type { VectorStoreRetriever } from 'langchain/vectorstores/base';
import { formatForOpenAIFunctions } from 'langchain/agents/format_scratchpad';
// import { TavilySearchResults } from '@langchain/community/tools/tavily_search';
import { SearchApi } from '@langchain/community/tools/searchapi';
import { convertToOpenAIFunction } from '@langchain/core/utils/function_calling';
import { AgentExecutor } from 'langchain/agents';
import { OpenAIFunctionsAgentOutputParser } from 'langchain/agents/openai/output_parser'
// import { createRetrieverTool } from "langchain/agents/toolkits";
import 'dotenv/config';

const CONDENSE_TEMPLATE = `Given the following conversation and a follow up question, rephrase the follow up question to be a standalone question.

<chat_history>
  {chat_history}
</chat_history>

Follow Up Input: {question}
Standalone question:`;

// ntc
const QA_TEMPLATE = `You are an expert researcher. Use the following pieces of context to answer the question at the end.
If you don't know the answer, just say you don't know. DO NOT try to make up an answer.
If the question is not related to the context or chat history, politely respond that you are tuned to only answer questions that are related to the context.

<context>
  {context}
</context>

<chat_history>
  {chat_history}
</chat_history>

Question: {question}
Helpful answer in markdown:`;

const searchTool = new SearchApi(process.env.SEARCHAPI_API_KEY, {
    engine: 'google',
});

const allTools = [searchTool];

const combineDocumentsFn = (docs: Document[], separator = '\n\n') => {
  const serializedDocs = docs.map((doc) => doc.pageContent);
  return serializedDocs.join(separator);
};

export const makeChain = (retriever: VectorStoreRetriever) => {
  const condenseQuestionPrompt =
    ChatPromptTemplate.fromTemplate(CONDENSE_TEMPLATE);
  const answerTemplate = ChatPromptTemplate.fromTemplate(QA_TEMPLATE);
  const finalPrompt = ChatPromptTemplate.fromMessages([
    new MessagesPlaceholder("agent_scratchpad"),
    answerTemplate,
  ])

  const model = new ChatOpenAI({
    temperature: 0.5, // increase temperature to get more creative answers
    // modelName: 'gpt-4',
    modelName: 'gpt-3.5-turbo', //change this to gpt-4 if you have access
  });

  const answerModel = new ChatOpenAI({
    temperature: 0, // increase temperature to get more creative answers
    // modelName: 'gpt-4',
    modelName: 'gpt-3.5-turbo', //change this to gpt-4 if you have access
  });

  const modelWithFunc = answerModel.bind({
    functions: allTools.map((val) => convertToOpenAIFunction(val)),
  });

  // Rephrase the initial question into a dereferenced standalone question based on
  // the chat history to allow effective vectorstore querying.
  const standaloneQuestionChain = RunnableSequence.from([
    condenseQuestionPrompt,
    model,
    new StringOutputParser(),
  ]);

  // Retrieve documents based on a query, then format them.
  const retrievalChain = retriever.pipe(combineDocumentsFn);

  // Generate an answer to the standalone question based on the chat history
  // and retrieved documents. Additionally, we return the source documents directly.
  const answerAgent = RunnableSequence.from([
    {
      context: RunnableSequence.from([
        (input) => input.question,
        retrievalChain,
      ]),
      chat_history: (input) => input.chat_history,
      question: (input) => standaloneQuestionChain,
      agent_scratchpad: (input) => formatForOpenAIFunctions(input.step),
    },
    finalPrompt,
    modelWithFunc,
    new OpenAIFunctionsAgentOutputParser(),
  ]);

  // First generate a standalone question, then answer it based on
  // chat history and retrieved context documents.
  const conversationalRetrievalQAAgent = RunnableSequence.from([
    {
      question: standaloneQuestionChain,
      chat_history: (input) => input.chat_history,
    },
    answerAgent,
  ]);

  const executor = AgentExecutor.fromAgentAndTools({
    agent: answerAgent,
    tools: allTools,
  })
  return executor;

//   return conversationalRetrievalQAChain;
};
