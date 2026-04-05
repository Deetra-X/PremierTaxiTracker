'use strict';

const request = require('supertest');
const app = require('../src/app');
const { setupTestDb } = require('./testHelper');

setupTestDb();

async function getToken() {
  await request(app).post('/api/v1/auth/register').send({
    badge_no: 'ALT_OFF', name: 'Alert Officer', password: 'pass',
  });
  const res = await request(app).post('/api/v1/auth/login').send({
    badge_no: 'ALT_OFF', password: 'pass',
  });
  return res.body.token;
}

async function createVehicle(token, plate = 'ALT-VEH1') {
  const res = await request(app).post('/api/v1/vehicles')
    .set('Authorization', `Bearer ${token}`).send({ plate_no: plate });
  return res.body.id;
}

describe('Alert endpoints', () => {
  let token;
  let vehicleId;

  beforeEach(async () => {
    token = await getToken();
    vehicleId = await createVehicle(token);
  });

  describe('POST /api/v1/alerts', () => {
    it('creates an alert and returns 201', async () => {
      const res = await request(app)
        .post('/api/v1/alerts')
        .set('Authorization', `Bearer ${token}`)
        .send({ type: 'stolen', vehicle_id: vehicleId, description: 'Vehicle stolen near Colombo' });
      expect(res.status).toBe(201);
      expect(res.body).toMatchObject({ type: 'stolen', status: 'open', vehicle_id: vehicleId });
      expect(res.body).toHaveProperty('id');
    });

    it('returns 400 when type is missing', async () => {
      const res = await request(app)
        .post('/api/v1/alerts')
        .set('Authorization', `Bearer ${token}`)
        .send({ vehicle_id: vehicleId });
      expect(res.status).toBe(400);
    });

    it('returns 400 for invalid alert type', async () => {
      const res = await request(app)
        .post('/api/v1/alerts')
        .set('Authorization', `Bearer ${token}`)
        .send({ type: 'invalid_type', vehicle_id: vehicleId });
      expect(res.status).toBe(400);
    });

    it('returns 400 for non-existent vehicle_id', async () => {
      const res = await request(app)
        .post('/api/v1/alerts')
        .set('Authorization', `Bearer ${token}`)
        .send({ type: 'suspicious', vehicle_id: 'nonexistent' });
      expect(res.status).toBe(400);
    });

    it('creates alert with GPS coordinates', async () => {
      const res = await request(app)
        .post('/api/v1/alerts')
        .set('Authorization', `Bearer ${token}`)
        .send({ type: 'traffic_violation', vehicle_id: vehicleId, latitude: 6.92, longitude: 79.86 });
      expect(res.status).toBe(201);
      expect(res.body.latitude).toBe(6.92);
    });

    it('creates an alert without a vehicle (general incident)', async () => {
      const res = await request(app)
        .post('/api/v1/alerts')
        .set('Authorization', `Bearer ${token}`)
        .send({ type: 'other', description: 'Unregistered vehicle spotted' });
      expect(res.status).toBe(201);
      expect(res.body.vehicle_id).toBeNull();
    });
  });

  describe('GET /api/v1/alerts', () => {
    beforeEach(async () => {
      await request(app).post('/api/v1/alerts')
        .set('Authorization', `Bearer ${token}`)
        .send({ type: 'stolen', vehicle_id: vehicleId });
      await request(app).post('/api/v1/alerts')
        .set('Authorization', `Bearer ${token}`)
        .send({ type: 'suspicious' });
    });

    it('returns alert list', async () => {
      const res = await request(app).get('/api/v1/alerts')
        .set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(200);
      expect(res.body.data.length).toBeGreaterThanOrEqual(2);
    });

    it('filters by type', async () => {
      const res = await request(app).get('/api/v1/alerts?type=stolen')
        .set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(200);
      expect(res.body.data.every(a => a.type === 'stolen')).toBe(true);
    });

    it('filters by status', async () => {
      const res = await request(app).get('/api/v1/alerts?status=open')
        .set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(200);
      expect(res.body.data.every(a => a.status === 'open')).toBe(true);
    });
  });

  describe('GET /api/v1/alerts/:id', () => {
    it('returns a single alert', async () => {
      const create = await request(app).post('/api/v1/alerts')
        .set('Authorization', `Bearer ${token}`)
        .send({ type: 'other', description: 'Test alert' });
      const { id } = create.body;

      const res = await request(app).get(`/api/v1/alerts/${id}`)
        .set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(200);
      expect(res.body.id).toBe(id);
    });

    it('returns 404 for unknown id', async () => {
      const res = await request(app).get('/api/v1/alerts/nonexistent')
        .set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(404);
    });
  });

  describe('PUT /api/v1/alerts/:id/resolve', () => {
    it('resolves an open alert', async () => {
      const create = await request(app).post('/api/v1/alerts')
        .set('Authorization', `Bearer ${token}`)
        .send({ type: 'stolen', vehicle_id: vehicleId });
      const { id } = create.body;

      const res = await request(app).put(`/api/v1/alerts/${id}/resolve`)
        .set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(200);
      expect(res.body.status).toBe('resolved');
      expect(res.body.resolved_at).not.toBeNull();
    });

    it('returns 409 when already resolved', async () => {
      const create = await request(app).post('/api/v1/alerts')
        .set('Authorization', `Bearer ${token}`)
        .send({ type: 'stolen', vehicle_id: vehicleId });
      const { id } = create.body;

      await request(app).put(`/api/v1/alerts/${id}/resolve`)
        .set('Authorization', `Bearer ${token}`);
      const res = await request(app).put(`/api/v1/alerts/${id}/resolve`)
        .set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(409);
    });

    it('returns 404 for unknown id', async () => {
      const res = await request(app).put('/api/v1/alerts/nonexistent/resolve')
        .set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(404);
    });
  });
});
