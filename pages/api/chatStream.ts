import type { NextApiRequest, NextApiResponse } from 'next';
import { useRouter } from 'next/router';
import type { Document } from 'langchain/document';
import { OpenAIEmbeddings } from '@langchain/openai';
import { PineconeStore } from '@langchain/pinecone';
import { makeChain } from '@/utils/makechain';
import { pinecone } from '@/utils/pinecone-client';
import { PINECONE_INDEX_NAME, PINECONE_NAME_SPACE } from '@/config/pinecone';
import { resolve } from 'path';
import { rejects } from 'assert';
import { RunnableSequence } from '@langchain/core/runnables';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  res.setHeader('Content-Type', 'text/event-stream;charset=utf-8');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  const params = JSON.parse(req.query.params as string);
  const { question, history, language } = params;
  console.log('question', question);
  console.log('history', history);
  console.log('language', language);

  //only accept post requests
  if (req.method !== 'GET') {
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
    const chain = makeChain(retriever, language);

    const pastMessages = history
      .map((message: [string, string]) => {
        return [`Human: ${message[0]}`, `Assistant: ${message[1]}`].join('\n');
      })
      .join('\n');

    try {
      const response = await Promise.race([
        await streaming({
          chain,
          question: sanitizedQuestion,
          chat_history: pastMessages,
          res,
          documentPromise,
        }),
        new Promise((resolve, reject) =>
          setTimeout(() => reject(new Error('Time Limit 300s')), 5 * 60 * 1000),
        ),
      ]);
    } catch (error) {
      throw error;
    }
  } catch (error: any) {
    console.log('error', error);
    if (error.message === 'AbortError') {
      res.status(500).json({ error: 'AbortError: Time Limit 300s' });
    }
    res.status(500).json({ error: error.message || 'Something went wrong' });
  }
}

const streaming = async (props: {
  chain: any;
  question: any;
  chat_history: string;
  res: NextApiResponse;
  documentPromise: Promise<Document[]>;
}) => {
  const { chain, question, chat_history, res, documentPromise } = props;
  const stream = await chain.stream({
    question,
    chat_history,
  });
  let infoId = 0;
  for await (const chunk of stream) {
    // console.log('chunk: ', chunk);
    res.write(`event: generateAns\n`);
    res.write(`id: ${infoId}\n`);
    res.write(`data: ${JSON.stringify(chunk)}\n\n`);
    infoId += 1;
  }
  const sourceDocuments = await documentPromise;
  res.write(`event: generateDocs\n`);
  res.write(`docs: ${JSON.stringify(sourceDocuments)}\n\n`);
  res.end();
};
