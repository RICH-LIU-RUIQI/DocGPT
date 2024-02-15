import 'dotenv/config';
import { ConsoleCallbackHandler } from '@langchain/core/tracers/console';
import { ChatOpenAI } from '@langchain/openai';
import {
  ChatPromptTemplate,
  MessagesPlaceholder,
} from '@langchain/core/prompts';
import { RunnableSequence } from '@langchain/core/runnables';
import { StringOutputParser } from '@langchain/core/output_parsers';
import type { Document } from 'langchain/document';
import { formatToOpenAIFunctionMessages } from 'langchain/agents/format_scratchpad';
import { convertToOpenAIFunction } from '@langchain/core/utils/function_calling';
import { AgentExecutor } from 'langchain/agents';
import { OpenAIFunctionsAgentOutputParser } from 'langchain/agents/openai/output_parser';
import { renderTextDescription } from 'langchain/tools/render';
import allTools from './tools';
import { SYS_CITE, CONDENSE_TEMPLATE, QA_TEMPLATE } from './prompts.js';
import { BaseMessage } from '@langchain/core/messages';
import { ChatMessageHistory } from 'langchain/stores/message/in_memory';

const LAST_CONVERSATIONS = 2;
const combineDocumentsFn = (docs: Document[], separator = '\n\n') => {
  const serializedDocs = docs.map((doc) => doc.pageContent);
  return serializedDocs.join(separator);
};

export const makeAgentSearch = (retriever: any) => {

  const trimMsg = async (chatHistory: ChatMessageHistory) => {
    const storedMsg = await chatHistory.getMessages();
    console.log(storedMsg);
    if(storedMsg.length <= 2) return chatHistory.getMessages();
    await chatHistory.clear();
    for (const msg of storedMsg.slice(-2 * LAST_CONVERSATIONS)) {
      chatHistory.addMessage(msg);
    }
    return chatHistory.getMessages();
  };

  const summarizeMsg = async (input: any) => {
    const chatHistory = input.chat_history;
    const storedMsg = await chatHistory.getMessages();
    const summarizationPrompt = ChatPromptTemplate.fromMessages([
      new MessagesPlaceholder("chat_history"),
      [
        "user",
        "Distill the above chat messages into a single summary message. Include as many specific details as you can.",
      ],
    ]);
    const summarizationChain = summarizationPrompt.pipe(model);
    const summaryMessage = await summarizationChain.invoke({
      chat_history: storedMsg,
    });
    await chatHistory.clear();
    chatHistory.addMessage(summaryMessage);
    return chatHistory.getMessages();
  }

  const condenseQuestionPrompt =
    ChatPromptTemplate.fromTemplate(CONDENSE_TEMPLATE);
  const answerTemplate = ChatPromptTemplate.fromTemplate(QA_TEMPLATE);
  const finalPrompt = ChatPromptTemplate.fromMessages([
    ['system', SYS_CITE],
    new MessagesPlaceholder('agent_scratchpad'),
    answerTemplate,
  ]);
  const generatePrompt = ChatPromptTemplate.fromTemplate(
    `Turn the following user input into a search query for a search engine: {question}`,
  );

  const model = new ChatOpenAI({
    temperature: 0.1, // increase temperature to get more creative answers
    // modelName: 'gpt-4',
    modelName: 'gpt-3.5-turbo', //change this to gpt-4 if you have access
  });

  const answerModel = new ChatOpenAI({
    temperature: 0.3, // increase temperature to get more creative answers
    // modelName: 'gpt-4',
    modelName: 'gpt-3.5-turbo', //change this to gpt-4 if you have access
  });

  // Rephrase the initial question into a dereferenced standalone question based on
  // the chat history to allow effective vectorstore querying.
  const standaloneQuestionChain = RunnableSequence.from([
    {
      question: (input) => input.question,
      chat_history: (input) => input.chat_history.getMessages(),
    },
    condenseQuestionPrompt,
    model,
    new StringOutputParser(),
  ]);

  // Retrieve documents based on a query, then format them.
  const retrievalChain = retriever.pipe(combineDocumentsFn);

  const withAloneQuestion = {
    question: standaloneQuestionChain,
    chat_history: (input: any) => input.chat_history,
    steps: (input: any) => input.steps,
    tools: (input: any) => input.tools,
  };

  // Generate an answer to the standalone question based on the chat history
  // and retrieved documents. Additionally, we return the source documents directly.
  const answerAgent = RunnableSequence.from([
    {
      context: RunnableSequence.from([
        (input) => input.question,
        retrievalChain,
      ]),
      chat_history: (input) => trimMsg(input.chat_history),
      question: (input) => input.question,
      agent_scratchpad: (input) => formatToOpenAIFunctionMessages(input.steps),
      tools: (input) => renderTextDescription(input.tools),
      materials: RunnableSequence.from([
        { question: (input) => input.question },
        generatePrompt,
        model,
        new StringOutputParser(),
        allTools[0],
        new StringOutputParser(),
      ]),
    },
    finalPrompt,
    answerModel,
    new OpenAIFunctionsAgentOutputParser(),
  ]);

  // First generate a standalone question, then answer it based on
  // chat history and retrieved context documents.
  const conversationalRetrievalQAAgent = RunnableSequence.from([
    withAloneQuestion,
    answerAgent,
  ]);

  const executor = AgentExecutor.fromAgentAndTools({
    agent: conversationalRetrievalQAAgent,
    tools: allTools,
    verbose: false,
  });

  return executor;
};
