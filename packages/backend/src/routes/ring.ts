import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { AuthUser } from '../middleware/auth.js';
import { ringService } from '../services/ring.js';
import { credentialQueries } from '../db/queries.js';

const authSchema = z.object({
  email: z.string().email(),
  password: z.string(),
  twoFactorCode: z.string().optional(),
});

export async function ringRoutes(fastify: FastifyInstance) {
  // Require auth for all routes
  fastify.addHook('preHandler', fastify.authenticate);

  // Check connection status
  fastify.get('/status', async (request) => {
    const user = request.user as AuthUser;
    const connected = ringService.isConnected(user.id);
    const hasCredentials = !!credentialQueries.findByProvider.get(user.id, 'ring');
    
    return { connected, hasCredentials };
  });

  // Authenticate with Ring
  fastify.post('/auth', async (request, reply) => {
    const user = request.user as AuthUser;
    
    try {
      const body = authSchema.parse(request.body);
      const result = await ringService.authenticate(
        user.id,
        body.email,
        body.password,
        body.twoFactorCode
      );
      
      if (!result.success) {
        if (result.requiresTwoFactor) {
          return reply.status(400).send({ 
            error: 'Two-factor authentication required',
            requiresTwoFactor: true 
          });
        }
        return reply.status(400).send({ error: result.error });
      }
      
      return { success: true };
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        return reply.status(400).send({ error: 'Validation failed', details: error.errors });
      }
      return reply.status(500).send({ error: 'Authentication failed' });
    }
  });

  // Connect with stored credentials
  fastify.post('/connect', async (request, reply) => {
    const user = request.user as AuthUser;
    
    const success = await ringService.connectWithStoredCredentials(user.id);
    if (!success) {
      return reply.status(400).send({ error: 'Failed to connect. Please re-authenticate.' });
    }
    
    return { success: true };
  });

  // Disconnect
  fastify.post('/disconnect', async (request) => {
    const user = request.user as AuthUser;
    ringService.disconnect(user.id);
    return { success: true };
  });

  // Get all Ring devices
  fastify.get('/devices', async (request, reply) => {
    const user = request.user as AuthUser;
    
    if (!ringService.isConnected(user.id)) {
      // Try to reconnect
      const connected = await ringService.connectWithStoredCredentials(user.id);
      if (!connected) {
        return reply.status(401).send({ error: 'Not connected to Ring' });
      }
    }
    
    const devices = await ringService.getDevices(user.id);
    return { devices };
  });

  // Get device snapshot
  fastify.get('/devices/:deviceId/snapshot', async (request, reply) => {
    const user = request.user as AuthUser;
    const { deviceId } = request.params as { deviceId: string };
    
    if (!ringService.isConnected(user.id)) {
      return reply.status(401).send({ error: 'Not connected to Ring' });
    }
    
    const snapshot = await ringService.getSnapshot(user.id, deviceId);
    if (!snapshot) {
      return reply.status(404).send({ error: 'Snapshot not available' });
    }
    
    reply.header('Content-Type', 'image/jpeg');
    reply.header('Cache-Control', 'no-cache');
    return reply.send(snapshot);
  });

  // Get live stream URL
  fastify.get('/devices/:deviceId/stream', async (request, reply) => {
    const user = request.user as AuthUser;
    const { deviceId } = request.params as { deviceId: string };
    
    if (!ringService.isConnected(user.id)) {
      return reply.status(401).send({ error: 'Not connected to Ring' });
    }
    
    const streamUrl = await ringService.getLiveStreamUrl(user.id, deviceId);
    if (!streamUrl) {
      return reply.status(404).send({ error: 'Stream not available' });
    }
    
    return { streamUrl };
  });

  // Get event history
  fastify.get('/devices/:deviceId/history', async (request, reply) => {
    const user = request.user as AuthUser;
    const { deviceId } = request.params as { deviceId: string };
    const { limit = 20 } = request.query as { limit?: number };
    
    if (!ringService.isConnected(user.id)) {
      return reply.status(401).send({ error: 'Not connected to Ring' });
    }
    
    const history = await ringService.getHistory(user.id, deviceId, Math.min(limit, 100));
    return { history };
  });

  // Toggle light
  fastify.post('/devices/:deviceId/light', async (request, reply) => {
    const user = request.user as AuthUser;
    const { deviceId } = request.params as { deviceId: string };
    const { on } = request.body as { on: boolean };
    
    if (user.role !== 'admin') {
      return reply.status(403).send({ error: 'Admin access required' });
    }
    
    if (!ringService.isConnected(user.id)) {
      return reply.status(401).send({ error: 'Not connected to Ring' });
    }
    
    const success = await ringService.toggleLight(user.id, deviceId, on);
    if (!success) {
      return reply.status(500).send({ error: 'Failed to toggle light' });
    }
    
    return { success: true };
  });

  // Trigger siren
  fastify.post('/devices/:deviceId/siren', async (request, reply) => {
    const user = request.user as AuthUser;
    const { deviceId } = request.params as { deviceId: string };
    
    if (user.role !== 'admin') {
      return reply.status(403).send({ error: 'Admin access required' });
    }
    
    if (!ringService.isConnected(user.id)) {
      return reply.status(401).send({ error: 'Not connected to Ring' });
    }
    
    const success = await ringService.triggerSiren(user.id, deviceId);
    if (!success) {
      return reply.status(500).send({ error: 'Failed to trigger siren' });
    }
    
    return { success: true };
  });
}
