// server.ts
import express, { Request, Response } from 'express';
import {
  ClientConfig,
  MessageAPIResponseBase,
  messagingApi,
  middleware,
  MiddlewareConfig,
  webhook,
  HTTPFetchError,
  TextMessage,
} from '@line/bot-sdk';
import dotenv from 'dotenv';
import cors from 'cors';
import rateLimit, { RateLimitRequestHandler } from 'express-rate-limit';

// Load environment variables
dotenv.config();

// Setup all LINE client and Express configurations.
const clientConfig: ClientConfig = {
    channelAccessToken: process.env.CHANNEL_ACCESS_TOKEN || '',
};

const middlewareConfig: MiddlewareConfig = {
    channelSecret: process.env.CHANNEL_SECRET || '',
};

const PORT = process.env.PORT || 8080;

const limiter: RateLimitRequestHandler = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // limit each IP to 100 requests per windowMs
    message: 'Too many requests from this IP, please try again later.'
});

const client = new messagingApi.MessagingApiClient(clientConfig);

const app = express();

// Start the server
// Middleware
app.use(cors()); // Enable CORS for all routes
app.use(express.json()); // To parse JSON bodies
app.use(limiter);

app.get(
  '/test',
  async (_: Request, res: Response): Promise<Response> => {
    return res.status(200).json({
      status: 'success',
      message: 'Connected successfully!',
    });
  }
);

// Function handler to receive the text.
const textEventHandler = async (event: webhook.Event): Promise<MessageAPIResponseBase | undefined> => {
  // Process all variables here.

  // Check if for a text message
  if (event.type !== 'message' || event.message.type !== 'text') {
    return;
  }

  // Process all message related variables here.

  // Check if message is repliable
  if (!event.replyToken) return;
  
  // Create a new message.
  // Reply to the user.
  await client.replyMessage({
    replyToken:event.replyToken,
    messages: [{
      type: 'text',
      text: event.message.text,
    }],
  });
};

// This route is used for the Webhook.
app.post(
  '/callback',
  middleware(middlewareConfig),
  async (req: Request, res: Response): Promise<Response> => {
    const callbackRequest: webhook.CallbackRequest = req.body;
    const events: webhook.Event[] = callbackRequest.events!;

    // Process all the received events asynchronously.
    const results = await Promise.all(
      events.map(async (event: webhook.Event) => {
        try {
          await textEventHandler(event);
        } catch (err: unknown) {
          if (err instanceof HTTPFetchError) {
            console.error(err.status);
            console.error(err.headers.get('x-line-request-id'));
            console.error(err.body);
          } else if (err instanceof Error) {
            console.error(err);
          }

          // Return an error message.
          return res.status(500).json({
            status: 'error',
          });
        }
      })
    );

    // Return a successful message.
    return res.status(200).json({
      status: 'success',
      results,
    });
  }
);

// Define the API endpoint to send a message
app.post('/api/send-message', async (req: Request, res: Response) => {
    const { message } = req.body;
    const userId = process.env.YOUR_USER_ID;
    console.log(`message: ${message}`);
    console.log(`userId: ${userId}`);
    if (!message || !userId) {
        return res.status(400).json({ error: 'Message and User ID are required.' });
    }

    try {
        const textMessage: TextMessage = {
            type: 'text',
            text: message,
        };

        // Use the 'pushMessage' method to send a message to a specific user
        await client.pushMessage({
            to: userId,
            messages: [textMessage],
        });

        res.status(200).json({ success: true, message: 'Message sent successfully!' });
    } catch (error) {
        console.error('Failed to send message:', error);
        res.status(500).json({ success: false, error: 'Failed to send message.' });
    }
});

app.listen(PORT, () => {
    console.log(`🚀 Server is running on http://localhost:${PORT}`);
});