import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { deviceQueries, eventQueries, Device, Event } from '../db/queries.js';
import { AuthUser } from '../middleware/auth.js';
import { roborockService } from '../services/roborock.js';
import { ringService } from '../services/ring.js';

export async function deviceRoutes(fastify: FastifyInstance) {
  // Require auth for all routes
  fastify.addHook('preHandler', fastify.authenticate);

  // Get all devices
  fastify.get('/', async (request) => {
    const user = request.user as AuthUser;
    const devices = deviceQueries.findByUserId.all(user.id);
    
    // Enrich with live status
    const enriched = await Promise.all(devices.map(async (device) => {
      let liveState = null;
      
      if (device.type === 'roborock') {
        const states = await roborockService.getDevices(user.id);
        liveState = states.find(s => s.id === device.device_id);
      } else if (device.type === 'ring') {
        const states = await ringService.getDevices(user.id);
        liveState = states.find(s => s.id === device.device_id);
      }
      
      return {
        ...device,
        config: JSON.parse(device.config || '{}'),
        liveState,
      };
    }));

    return { devices: enriched };
  });

  // Get device by ID
  fastify.get('/:id', async (request, reply) => {
    const user = request.user as AuthUser;
    const { id } = request.params as { id: string };
    
    const device = deviceQueries.findById.get(id);
    if (!device || device.user_id !== user.id) {
      return reply.status(404).send({ error: 'Device not found' });
    }

    let liveState = null;
    if (device.type === 'roborock') {
      const states = await roborockService.getDevices(user.id);
      liveState = states.find(s => s.id === device.device_id);
    } else if (device.type === 'ring') {
      const states = await ringService.getDevices(user.id);
      liveState = states.find(s => s.id === device.device_id);
    }

    return {
      ...device,
      config: JSON.parse(device.config || '{}'),
      liveState,
    };
  });

  // Get device events
  fastify.get('/:id/events', async (request, reply) => {
    const user = request.user as AuthUser;
    const { id } = request.params as { id: string };
    const { limit = 50, type } = request.query as { limit?: number; type?: string };
    
    const device = deviceQueries.findById.get(id);
    if (!device || device.user_id !== user.id) {
      return reply.status(404).send({ error: 'Device not found' });
    }

    let events: Event[];
    if (type) {
      events = eventQueries.findByType.all(id, type, Math.min(limit, 100));
    } else {
      events = eventQueries.findByDevice.all(id, Math.min(limit, 100));
    }

    return {
      events: events.map(e => ({
        ...e,
        data: JSON.parse(e.data || '{}'),
      })),
    };
  });

  // Update device name
  fastify.patch('/:id', async (request, reply) => {
    const user = request.user as AuthUser;
    const { id } = request.params as { id: string };
    const { name } = request.body as { name?: string };
    
    const device = deviceQueries.findById.get(id);
    if (!device || device.user_id !== user.id) {
      return reply.status(404).send({ error: 'Device not found' });
    }

    if (user.role !== 'admin') {
      return reply.status(403).send({ error: 'Admin access required' });
    }

    if (name) {
      // Would need to add update name query
    }

    return { success: true };
  });

  // Delete device
  fastify.delete('/:id', async (request, reply) => {
    const user = request.user as AuthUser;
    const { id } = request.params as { id: string };
    
    if (user.role !== 'admin') {
      return reply.status(403).send({ error: 'Admin access required' });
    }

    const device = deviceQueries.findById.get(id);
    if (!device || device.user_id !== user.id) {
      return reply.status(404).send({ error: 'Device not found' });
    }

    deviceQueries.delete.run(id);
    return { success: true };
  });

  // Get recent events across all devices
  fastify.get('/events/recent', async (request) => {
    const user = request.user as AuthUser;
    const { limit = 20 } = request.query as { limit?: number };
    
    const events = eventQueries.findRecent.all(user.id, Math.min(limit, 100));
    
    return {
      events: events.map(e => ({
        ...e,
        data: JSON.parse(e.data || '{}'),
      })),
    };
  });
}
