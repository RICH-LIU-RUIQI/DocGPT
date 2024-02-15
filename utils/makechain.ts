import { ChatOpenAI } from '@langchain/openai';
import { ChatPromptTemplate } from '@langchain/core/prompts';
import { RunnableSequence } from '@langchain/core/runnables';
import { StringOutputParser } from '@langchain/core/output_parsers';
import type { Document } from 'langchain/document';
import type { VectorStoreRetriever } from 'langchain/vectorstores/base';
import { PineconeStore } from '@langchain/pinecone';

const CONDENSE_TEMPLATE = `Given the following conversation and a follow up question, rephrase the follow up question to be a standalone question.

<chat_history>
  {chat_history}
</chat_history>

Follow Up Input: {question}
Standalone question:`;
const CONDENSE_TEMPLATE_CH = `给定下面的对话和一个后续问题，将后续问题改写成一个独立的问题。

<chat_history>
  {chat_history}
</chat_history>

后续输入： {question}
独立问题：`;

const QA_TEMPLATE = ` Use the following pieces of context to answer the question at the end.
DO NOT try to make up an answer.

<context>
  {context}
</context>

<chat_history>
  {chat_history}
</chat_history>

Question: {question}
Helpful answer in markdown:`;

const QA_TEMPLATE_CH = ` 根据以下上下文回答最后的问题。
不要试图编造答案。

<context>
  {context}
</context>

<chat_history>
  {chat_history}
</chat_history>

Question: {question}
用markdown给出你的答案:`;

const SYS_TEMPLATE = `
Your task is to answer the question using only the provided document and to cite the passage(s) of the document used to answer the question.
If an answer to the question is provided, it must be annotated with in-text citations. 
`
const SYS_TEMPLATE_CH = `
您的任务是仅使用所提供的文件回答问题，并引用用于回答问题的文件段落。
如果提供了问题的答案，则必须用文中引文加以注释。
`

const combineDocumentsFn = (docs: Document[], separator = '\n\n') => {
  const serializedDocs = docs.map((doc) => doc.pageContent);
  return serializedDocs.join(separator);
};

export const makeChain = (retriever:any, language:number) => {
  const condenseQuestionPrompt = language === 0 ? ChatPromptTemplate.fromTemplate(CONDENSE_TEMPLATE) : ChatPromptTemplate.fromTemplate(CONDENSE_TEMPLATE_CH);
  const answerPrompt = language === 0 ? ChatPromptTemplate.fromTemplate(QA_TEMPLATE) : ChatPromptTemplate.fromTemplate(QA_TEMPLATE_CH);
  const finalPrompt = language === 0 ? ChatPromptTemplate.fromMessages([
    ['system', SYS_TEMPLATE],
    answerPrompt,
  ]) : ChatPromptTemplate.fromMessages([
    ['system', SYS_TEMPLATE_CH],
    answerPrompt,
  ])

  const model = new ChatOpenAI({
    temperature: 0.4, // increase temperature to get more creative answers
    // modelName: 'gpt-4',
    modelName: 'gpt-3.5-turbo', //change this to gpt-4 if you have access
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
  const answerChain = RunnableSequence.from([
    {
      context: RunnableSequence.from([
        (input) => input.question,
        retrievalChain,
      ]),
      chat_history: (input) => input.chat_history,
      question: (input) => input.question,
    },
    finalPrompt,
    model,
    new StringOutputParser(),
  ]);

  // First generate a standalone question, then answer it based on
  // chat history and retrieved context documents.
  const conversationalRetrievalQAChain = RunnableSequence.from([
    {
      question: standaloneQuestionChain,
      chat_history: (input) => input.chat_history,
    },
    answerChain,
  ]);

  return conversationalRetrievalQAChain;
};
