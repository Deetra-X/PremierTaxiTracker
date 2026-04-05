'use strict';

const request = require('supertest');
const app = require('../src/app');
const { setupTestDb } = require('./testHelper');

setupTestDb();

async function getToken() {
  await request(app).post('/api/v1/auth/register').send({
    badge_no: 'DRV_OFF', name: 'Driver Officer', password: 'pass',
  });
  const res = await request(app).post('/api/v1/auth/login').send({
    badge_no: 'DRV_OFF', password: 'pass',
  });
  return res.body.token;
}

async function createVehicle(token, plate = 'VEH-DRV1') {
  const res = await request(app).post('/api/v1/vehicles')
    .set('Authorization', `Bearer ${token}`).send({ plate_no: plate });
  return res.body.id;
}

describe('Driver endpoints', () => {
  let token;
  beforeEach(async () => { token = await getToken(); });

  describe('POST /api/v1/drivers', () => {
    it('creates a driver and returns 201', async () => {
      const res = await request(app)
        .post('/api/v1/drivers')
        .set('Authorization', `Bearer ${token}`)
        .send({ nic: '199012345678', name: 'Kamal Perera', licence_no: 'LIC-001' });
      expect(res.status).toBe(201);
      expect(res.body).toMatchObject({ nic: '199012345678', name: 'Kamal Perera', status: 'active' });
    });

    it('returns 400 when required fields are missing', async () => {
      const res = await request(app)
        .post('/api/v1/drivers')
        .set('Authorization', `Bearer ${token}`)
        .send({ name: 'No NIC' });
      expect(res.status).toBe(400);
    });

    it('returns 409 on duplicate NIC', async () => {
      const payload = { nic: '200000000001', name: 'Dup', licence_no: 'LIC-DUP1' };
      await request(app).post('/api/v1/drivers')
        .set('Authorization', `Bearer ${token}`).send(payload);
      const res = await request(app).post('/api/v1/drivers')
        .set('Authorization', `Bearer ${token}`).send({ ...payload, licence_no: 'LIC-DUP2' });
      expect(res.status).toBe(409);
    });

    it('links driver to a vehicle', async () => {
      const vehicleId = await createVehicle(token, 'VH-LINK1');
      const res = await request(app).post('/api/v1/drivers')
        .set('Authorization', `Bearer ${token}`)
        .send({ nic: '199099999999', name: 'Linked Driver', licence_no: 'LIC-L01', vehicle_id: vehicleId });
      expect(res.status).toBe(201);
      expect(res.body.vehicle_id).toBe(vehicleId);
    });

    it('returns 400 for invalid vehicle_id', async () => {
      const res = await request(app).post('/api/v1/drivers')
        .set('Authorization', `Bearer ${token}`)
        .send({ nic: '200111111111', name: 'Bad Vehicle', licence_no: 'LIC-BV1', vehicle_id: 'nonexistent' });
      expect(res.status).toBe(400);
    });
  });

  describe('GET /api/v1/drivers', () => {
    beforeEach(async () => {
      await request(app).post('/api/v1/drivers')
        .set('Authorization', `Bearer ${token}`)
        .send({ nic: '200200000001', name: 'List Driver A', licence_no: 'LIC-A1' });
      await request(app).post('/api/v1/drivers')
        .set('Authorization', `Bearer ${token}`)
        .send({ nic: '200200000002', name: 'List Driver B', licence_no: 'LIC-B2', status: 'suspended' });
    });

    it('returns driver list', async () => {
      const res = await request(app).get('/api/v1/drivers')
        .set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(200);
      expect(res.body.data.length).toBeGreaterThanOrEqual(2);
    });

    it('filters by status', async () => {
      const res = await request(app).get('/api/v1/drivers?status=suspended')
        .set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(200);
      expect(res.body.data.every(d => d.status === 'suspended')).toBe(true);
    });
  });

  describe('GET /api/v1/drivers/:id', () => {
    it('returns 404 for unknown id', async () => {
      const res = await request(app).get('/api/v1/drivers/nonexistent')
        .set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(404);
    });
  });

  describe('PUT /api/v1/drivers/:id', () => {
    it('updates driver status', async () => {
      const create = await request(app).post('/api/v1/drivers')
        .set('Authorization', `Bearer ${token}`)
        .send({ nic: '200300000001', name: 'Update Me', licence_no: 'LIC-UP1' });
      const { id } = create.body;

      const res = await request(app).put(`/api/v1/drivers/${id}`)
        .set('Authorization', `Bearer ${token}`)
        .send({ status: 'suspended' });
      expect(res.status).toBe(200);
      expect(res.body.status).toBe('suspended');
    });
  });

  describe('DELETE /api/v1/drivers/:id', () => {
    it('deletes a driver and returns 204', async () => {
      const create = await request(app).post('/api/v1/drivers')
        .set('Authorization', `Bearer ${token}`)
        .send({ nic: '200400000001', name: 'Delete Me', licence_no: 'LIC-DL1' });
      const { id } = create.body;

      const res = await request(app).delete(`/api/v1/drivers/${id}`)
        .set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(204);
    });
  });
});
