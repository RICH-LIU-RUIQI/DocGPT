export default async function handler(req, res) {
  let id = 0;
  // Set headers for Server-Sent Events
  res.setHeader('Content-Type', 'text/event-stream;charset-utf-8');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('X-Accel-Buffering', 'no');
  res.setHeader('Cache-Control', 'no-cache, no-transform');

  // Send an initial event to establish connection
  // res.write('data: connected\n\n');

  // Function to send SSE message
  const sendMessage = (data) => {
    res.write(`data: ${JSON.stringify('Count: ' + id)}\n\n`);
  };

  // Set up a loop to send SSE messages
  const interval = setInterval(() => {
    if (id > 15) {
      clearInterval(interval); // Stop sending messages
      res.end();
    }
    const message = { timestamp: Date.now() };
    sendMessage(message);
    id += 1;
  }, 1000); // Send a message every second

  // Listen for the connection close and clean up
  req.on('close', () => {
    clearInterval(interval); // Stop sending messages
    res.end(); // End the response
  });
}
