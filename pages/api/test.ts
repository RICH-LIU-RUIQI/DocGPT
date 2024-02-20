import { error } from 'console';
import type { NextApiRequest, NextApiResponse } from 'next';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
    const arr = ['我', '爱', '写', '代', '码', '爱', '吃', '小', '鱼', '干', '小', '鱼', '干', '小', '鱼', '干', 'DONE']
    const len = arr.length
    res.writeHead(200, {
        'Content-Type': 'text/event-stream;charset=utf-8',
        'Cache-Control': 'no-cache',
        'Access-Control-Allow-Origin': '*', 
      });
  try {
    let index = 0;
    const timer = setInterval(() => {
      if (index < arr.length) {
        res.write(`event: customEvent\n`);
        res.write(`data: ${JSON.stringify(arr[index])}\n\n`);
        index++;
      } else {
        console.log('End');
        clearInterval(timer);
        res.end();
      }
    }, 500);
  } catch (error) {
    console.log(error);
  }
}
