import type { NextApiRequest, NextApiResponse } from 'next';
import type { Document } from 'langchain/document';
import { OpenAIEmbeddings } from '@langchain/openai';
import { PineconeStore } from '@langchain/pinecone';
import { makeAgent } from '@/utils/makeAgent';
import { makeAgentSearch } from '@/utils/makeAgentSearch'; 
import { pinecone } from '@/utils/pinecone-client';
import { PINECONE_INDEX_NAME, PINECONE_NAME_SPACE } from '@/config/pinecone';
import allTools from '@/utils/tools';
import { ChatMessageHistory } from 'langchain/stores/message/in_memory';
import { AIMessage, HumanMessage } from '@langchain/core/messages';
import { resolve } from 'path';


export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  const { question, history, language } = req.body;

  const chatHistory = new ChatMessageHistory();

  console.log('question', question);
  console.log('history', history);

  //only accept post requests
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  if (!question) {
    return res.status(400).json({ message: 'No question in the request' });
  }
  // OpenAI recommends replacing newlines with spaces for best results
  const sanitizedQuestion = question.trim().replaceAll('\n', ' ');

  try {
    const index = pinecone.Index(PINECONE_INDEX_NAME);

    /* create vectorstore*/
    const vectorStore = await PineconeStore.fromExistingIndex(
      new OpenAIEmbeddings({}),
      {
        pineconeIndex: index,
        textKey: 'text',
        namespace: PINECONE_NAME_SPACE, //namespace comes from your config folder
      },
    );

    // Use a callback to get intermediate sources from the middle of the chain
    let resolveWithDocuments: (value: Document[]) => void;
    const documentPromise = new Promise<Document[]>((resolve) => {
      resolveWithDocuments = resolve;
    });
    const retriever = vectorStore.asRetriever({
      callbacks: [
        {
          handleRetrieverEnd(documents) {
            resolveWithDocuments(documents);
          },
        },
      ],
    });

    //create chain
    // const agent = makeAgent(retriever);
    const agentExecutor = makeAgentSearch(retriever, language);

    const passPastMsg = (history: [string, string][], chatHistory: ChatMessageHistory) => {
      history.forEach((message: [string, string], idx: number) => {
        chatHistory.addMessage(new HumanMessage(message[0]));
        chatHistory.addMessage(new AIMessage(message[1]));
      });
    };
    passPastMsg(history, chatHistory);

    chatHistory.getMessages();
    // let response;

    // const task1 = async () => {
    //   response = await agentExecutor.invoke({
    //     question: sanitizedQuestion,
    //     chat_history: chatHistory,
    //     tools: allTools,
    //     // timeout: 5*60*1000,
    //   });
    //   const sourceDocuments = await documentPromise;
    //   res.status(200).json({ text: response.output, sourceDocuments });
    // };

    // const task2 = async () => {
    //   setTimeout(()=> {
    //     console.log('Time limit');
    //   }, 5*1000);
    //  throw {message: 'Time limit 300s'};
    // }

    // Promise.race([task1, task2]);
    const response = await agentExecutor.invoke({
      question: sanitizedQuestion,
      chat_history: chatHistory,
      tools: allTools,
      timeout: 5*60*1000,
    });

    const sourceDocuments = await documentPromise;

    // console.log('response ===', response);
    res.status(200).json({ text: response.output, sourceDocuments });
  } catch (error: any) {
    console.log('error ===', error);
    if(error.message === 'AbortError') {
      res.status(500).json({ error: 'AbortError: Time Limit 300s' });
    }
    res.status(500).json({ error: error.message || 'Something went wrong' });
  }
}
