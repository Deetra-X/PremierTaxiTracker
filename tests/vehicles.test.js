'use strict';

const request = require('supertest');
const app = require('../src/app');
const { setupTestDb } = require('./testHelper');

setupTestDb();

async function getToken() {
  await request(app).post('/api/v1/auth/register').send({
    badge_no: 'VEH_OFF', name: 'Vehicle Officer', password: 'pass',
  });
  const res = await request(app).post('/api/v1/auth/login').send({
    badge_no: 'VEH_OFF', password: 'pass',
  });
  return res.body.token;
}

describe('Vehicle endpoints', () => {
  let token;
  beforeEach(async () => { token = await getToken(); });

  describe('POST /api/v1/vehicles', () => {
    it('creates a vehicle and returns 201', async () => {
      const res = await request(app)
        .post('/api/v1/vehicles')
        .set('Authorization', `Bearer ${token}`)
        .send({ plate_no: 'ABC-1234', colour: 'Yellow' });
      expect(res.status).toBe(201);
      expect(res.body).toMatchObject({ plate_no: 'ABC-1234', colour: 'Yellow', status: 'active' });
      expect(res.body).toHaveProperty('id');
    });

    it('returns 400 when plate_no is missing', async () => {
      const res = await request(app)
        .post('/api/v1/vehicles')
        .set('Authorization', `Bearer ${token}`)
        .send({ colour: 'Blue' });
      expect(res.status).toBe(400);
    });

    it('returns 409 on duplicate plate_no', async () => {
      await request(app).post('/api/v1/vehicles')
        .set('Authorization', `Bearer ${token}`).send({ plate_no: 'DUP-1111' });
      const res = await request(app).post('/api/v1/vehicles')
        .set('Authorization', `Bearer ${token}`).send({ plate_no: 'DUP-1111' });
      expect(res.status).toBe(409);
    });

    it('returns 400 for invalid status', async () => {
      const res = await request(app)
        .post('/api/v1/vehicles')
        .set('Authorization', `Bearer ${token}`)
        .send({ plate_no: 'XYZ-9999', status: 'unknown' });
      expect(res.status).toBe(400);
    });

    it('returns 401 without auth token', async () => {
      const res = await request(app).post('/api/v1/vehicles').send({ plate_no: 'NO-AUTH' });
      expect(res.status).toBe(401);
    });
  });

  describe('GET /api/v1/vehicles', () => {
    beforeEach(async () => {
      await request(app).post('/api/v1/vehicles')
        .set('Authorization', `Bearer ${token}`).send({ plate_no: 'LIST-001' });
      await request(app).post('/api/v1/vehicles')
        .set('Authorization', `Bearer ${token}`).send({ plate_no: 'LIST-002', status: 'stolen' });
    });

    it('returns paginated vehicle list', async () => {
      const res = await request(app).get('/api/v1/vehicles')
        .set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(200);
      expect(res.body.data.length).toBeGreaterThanOrEqual(2);
    });

    it('filters by status', async () => {
      const res = await request(app).get('/api/v1/vehicles?status=stolen')
        .set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(200);
      expect(res.body.data.every(v => v.status === 'stolen')).toBe(true);
    });
  });

  describe('GET /api/v1/vehicles/:id', () => {
    it('returns a single vehicle', async () => {
      const create = await request(app).post('/api/v1/vehicles')
        .set('Authorization', `Bearer ${token}`).send({ plate_no: 'GET-001' });
      const { id } = create.body;

      const res = await request(app).get(`/api/v1/vehicles/${id}`)
        .set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(200);
      expect(res.body.id).toBe(id);
    });

    it('returns 404 for unknown id', async () => {
      const res = await request(app).get('/api/v1/vehicles/nonexistent')
        .set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(404);
    });
  });

  describe('PUT /api/v1/vehicles/:id', () => {
    it('updates vehicle fields', async () => {
      const create = await request(app).post('/api/v1/vehicles')
        .set('Authorization', `Bearer ${token}`).send({ plate_no: 'UPD-001' });
      const { id } = create.body;

      const res = await request(app).put(`/api/v1/vehicles/${id}`)
        .set('Authorization', `Bearer ${token}`)
        .send({ status: 'stolen', colour: 'Red' });
      expect(res.status).toBe(200);
      expect(res.body.status).toBe('stolen');
      expect(res.body.colour).toBe('Red');
    });

    it('returns 404 for unknown id', async () => {
      const res = await request(app).put('/api/v1/vehicles/nonexistent')
        .set('Authorization', `Bearer ${token}`).send({ colour: 'Blue' });
      expect(res.status).toBe(404);
    });
  });

  describe('DELETE /api/v1/vehicles/:id', () => {
    it('deletes a vehicle and returns 204', async () => {
      const create = await request(app).post('/api/v1/vehicles')
        .set('Authorization', `Bearer ${token}`).send({ plate_no: 'DEL-001' });
      const { id } = create.body;

      const res = await request(app).delete(`/api/v1/vehicles/${id}`)
        .set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(204);
    });

    it('returns 404 after deletion', async () => {
      const create = await request(app).post('/api/v1/vehicles')
        .set('Authorization', `Bearer ${token}`).send({ plate_no: 'DEL-002' });
      const { id } = create.body;

      await request(app).delete(`/api/v1/vehicles/${id}`)
        .set('Authorization', `Bearer ${token}`);
      const res = await request(app).get(`/api/v1/vehicles/${id}`)
        .set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(404);
    });
  });
});
