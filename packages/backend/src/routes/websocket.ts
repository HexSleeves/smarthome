import { FastifyInstance } from 'fastify';
import { WebSocket } from '@fastify/websocket';
import { roborockService } from '../services/roborock.js';
import { ringService } from '../services/ring.js';

interface WsClient {
  ws: WebSocket;
  userId: string;
  unsubscribers: (() => void)[];
}

const clients: Map<WebSocket, WsClient> = new Map();

export async function websocketRoutes(fastify: FastifyInstance) {
  // Setup Roborock event forwarding
  roborockService.on('statusUpdate', ({ userId, deviceId, state }) => {
    broadcastToUser(userId, {
      type: 'roborock:status',
      deviceId,
      state,
    });
  });

  fastify.get('/events', { websocket: true }, async (connection, request) => {
    const ws = connection.socket;
    
    // Verify auth token from query string
    const url = new URL(request.url, `http://${request.headers.host}`);
    const token = url.searchParams.get('token');
    
    if (!token) {
      ws.send(JSON.stringify({ type: 'error', message: 'Token required' }));
      ws.close();
      return;
    }

    try {
      const decoded = fastify.jwt.verify(token) as { id: string; email: string; role: string };
      
      const client: WsClient = {
        ws,
        userId: decoded.id,
        unsubscribers: [],
      };
      
      clients.set(ws, client);
      
      // Subscribe to Ring events
      if (ringService.isConnected(decoded.id)) {
        const unsubscribe = ringService.subscribeToEvents(decoded.id, (event) => {
          ws.send(JSON.stringify({
            type: `ring:${event.type}`,
            ...event,
          }));
        });
        client.unsubscribers.push(unsubscribe);
      }

      ws.send(JSON.stringify({ type: 'connected', userId: decoded.id }));

      // Handle incoming messages
      ws.on('message', async (data) => {
        try {
          const message = JSON.parse(data.toString());
          await handleMessage(client, message);
        } catch (error) {
          console.error('WS message error:', error);
        }
      });

      ws.on('close', () => {
        // Cleanup subscriptions
        const client = clients.get(ws);
        if (client) {
          client.unsubscribers.forEach(unsub => unsub());
          clients.delete(ws);
        }
      });

      ws.on('error', (error) => {
        console.error('WebSocket error:', error);
        clients.delete(ws);
      });
      
    } catch (error) {
      ws.send(JSON.stringify({ type: 'error', message: 'Invalid token' }));
      ws.close();
    }
  });
}

async function handleMessage(client: WsClient, message: any) {
  switch (message.type) {
    case 'ping':
      client.ws.send(JSON.stringify({ type: 'pong' }));
      break;
      
    case 'subscribe:ring':
      // Re-subscribe to Ring events
      if (ringService.isConnected(client.userId)) {
        const unsubscribe = ringService.subscribeToEvents(client.userId, (event) => {
          client.ws.send(JSON.stringify({
            type: `ring:${event.type}`,
            ...event,
          }));
        });
        client.unsubscribers.push(unsubscribe);
        client.ws.send(JSON.stringify({ type: 'subscribed', service: 'ring' }));
      }
      break;
      
    case 'unsubscribe:ring':
      // Would need to track which unsubscribers are for which service
      break;
      
    default:
      client.ws.send(JSON.stringify({ type: 'error', message: 'Unknown message type' }));
  }
}

function broadcastToUser(userId: string, message: object) {
  const payload = JSON.stringify(message);
  
  for (const [ws, client] of clients) {
    if (client.userId === userId && ws.readyState === ws.OPEN) {
      ws.send(payload);
    }
  }
}

export function broadcast(message: object) {
  const payload = JSON.stringify(message);
  
  for (const [ws] of clients) {
    if (ws.readyState === ws.OPEN) {
      ws.send(payload);
    }
  }
}
