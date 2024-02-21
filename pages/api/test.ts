import { error } from 'console';
import type { NextApiRequest, NextApiResponse } from 'next';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  const arr = [
    '我',
    '爱',
    '写',
    '代',
    '码',
    '爱',
    '吃',
    '小',
    '鱼',
    '干',
    '小',
    '鱼',
    '干',
    '小',
    '鱼',
    '干',
    'DONE',
  ];
  const len = arr.length;
  res.setHeader('Content-Type', 'text/event-stream;charset-utf-8');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('X-Accel-Buffering', 'no');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  let index = 0;
  const interval = setInterval(() => {
    if (index < arr.length) {
      // res.write(`event: customEvent\n`);
      res.write(`data: ${JSON.stringify(arr[index])}\n\n`);
      index++;
    } else {
      console.log('End');
      clearInterval(interval);
      res.end();
    }
  }, 1000); // Send a message every second

  // Listen for the connection close and clean up
  req.on('close', () => {
    clearInterval(interval); // Stop sending messages
    res.end(); // End the response
  });
}
