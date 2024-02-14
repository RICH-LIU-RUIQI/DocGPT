import { ChatOpenAI } from '@langchain/openai';
import { ChatPromptTemplate, MessagesPlaceholder } from '@langchain/core/prompts';
import { RunnableSequence } from '@langchain/core/runnables';
import { StringOutputParser } from '@langchain/core/output_parsers';
import type { Document } from 'langchain/document';
import type { VectorStoreRetriever } from 'langchain/vectorstores/base';
import { formatToOpenAIFunctionMessages } from 'langchain/agents/format_scratchpad';
// import { TavilySearchResults } from '@langchain/community/tools/tavily_search';
import { SearchApi } from '@langchain/community/tools/searchapi';
import { convertToOpenAIFunction } from '@langchain/core/utils/function_calling';
import { AgentExecutor } from 'langchain/agents';
import { OpenAIFunctionsAgentOutputParser } from 'langchain/agents/openai/output_parser'
// import { createRetrieverTool } from "langchain/agents/toolkits";
import 'dotenv/config';
import { Calculator } from 'langchain/tools/calculator';
import { TavilySearchResults } from "@langchain/community/tools/tavily_search";

const CONDENSE_TEMPLATE = `Given the following conversation and a follow up question, rephrase the follow up question to be a standalone question.

<chat_history>
  {chat_history}
</chat_history>

Follow Up Input: {question}
Standalone question:`;

// ntc
const QA_TEMPLATE = `You are an expert researcher. You can Use the following pieces of context to answer the question at the end.
If the context is of no use, consider the tools given to you.

<context>
  {context}
</context>

<chat_history>
  {chat_history}
</chat_history>

Question: {question}
Helpful answer in markdown:`;

const searchTool = new TavilySearchResults({
  apiKey: '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',
});

const allTools = [searchTool, new Calculator()];

const combineDocumentsFn = (docs: Document[], separator = '\n\n') => {
  const serializedDocs = docs.map((doc) => doc.pageContent);
  return serializedDocs.join(separator);
};

export const makeAgent = (retriever: any) => {
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
      question: (input) => input.question,
      agent_scratchpad: (input) => formatToOpenAIFunctionMessages(input.steps),
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
      // @ts-ignore
      chat_history: (input) => input.chat_history,
      // @ts-ignore
      steps: (input) => input.steps,
    },
    answerAgent,
  ]);

  const executor = AgentExecutor.fromAgentAndTools({
    agent: conversationalRetrievalQAAgent,
    tools: allTools,
    verbose: true,
    returnIntermediateSteps: false,
  })

  return executor;
};
