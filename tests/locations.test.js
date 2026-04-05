'use strict';

const request = require('supertest');
const app = require('../src/app');
const { setupTestDb } = require('./testHelper');

setupTestDb();

async function getToken() {
  await request(app).post('/api/v1/auth/register').send({
    badge_no: 'LOC_OFF', name: 'Location Officer', password: 'pass',
  });
  const res = await request(app).post('/api/v1/auth/login').send({
    badge_no: 'LOC_OFF', password: 'pass',
  });
  return res.body.token;
}

async function createVehicle(token) {
  const res = await request(app).post('/api/v1/vehicles')
    .set('Authorization', `Bearer ${token}`).send({ plate_no: 'LOC-VEH1' });
  return res.body.id;
}

describe('Location endpoints', () => {
  let token;
  let vehicleId;

  beforeEach(async () => {
    token = await getToken();
    vehicleId = await createVehicle(token);
  });

  describe('POST /api/v1/locations', () => {
    it('records a location event and returns 201', async () => {
      const res = await request(app)
        .post('/api/v1/locations')
        .set('Authorization', `Bearer ${token}`)
        .send({ vehicle_id: vehicleId, latitude: 6.927079, longitude: 79.861244 });
      expect(res.status).toBe(201);
      expect(res.body).toMatchObject({ vehicle_id: vehicleId, latitude: 6.927079, longitude: 79.861244 });
    });

    it('accepts optional speed and heading', async () => {
      const res = await request(app)
        .post('/api/v1/locations')
        .set('Authorization', `Bearer ${token}`)
        .send({ vehicle_id: vehicleId, latitude: 6.9, longitude: 79.8, speed: 40, heading: 90 });
      expect(res.status).toBe(201);
      expect(res.body.speed).toBe(40);
      expect(res.body.heading).toBe(90);
    });

    it('returns 400 when required fields are missing', async () => {
      const res = await request(app)
        .post('/api/v1/locations')
        .set('Authorization', `Bearer ${token}`)
        .send({ vehicle_id: vehicleId });
      expect(res.status).toBe(400);
    });

    it('returns 400 for out-of-range coordinates', async () => {
      const res = await request(app)
        .post('/api/v1/locations')
        .set('Authorization', `Bearer ${token}`)
        .send({ vehicle_id: vehicleId, latitude: 999, longitude: 79.8 });
      expect(res.status).toBe(400);
    });

    it('returns 404 for non-existent vehicle', async () => {
      const res = await request(app)
        .post('/api/v1/locations')
        .set('Authorization', `Bearer ${token}`)
        .send({ vehicle_id: 'nonexistent', latitude: 6.9, longitude: 79.8 });
      expect(res.status).toBe(404);
    });
  });

  describe('GET /api/v1/locations/vehicle/:vehicleId', () => {
    beforeEach(async () => {
      await request(app).post('/api/v1/locations')
        .set('Authorization', `Bearer ${token}`)
        .send({ vehicle_id: vehicleId, latitude: 6.1, longitude: 79.1 });
      await request(app).post('/api/v1/locations')
        .set('Authorization', `Bearer ${token}`)
        .send({ vehicle_id: vehicleId, latitude: 6.2, longitude: 79.2 });
    });

    it('returns movement history', async () => {
      const res = await request(app)
        .get(`/api/v1/locations/vehicle/${vehicleId}`)
        .set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(200);
      expect(res.body.data.length).toBe(2);
    });

    it('returns 404 for non-existent vehicle', async () => {
      const res = await request(app)
        .get('/api/v1/locations/vehicle/nonexistent')
        .set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(404);
    });
  });

  describe('GET /api/v1/locations/vehicle/:vehicleId/latest', () => {
    it('returns most recent location', async () => {
      await request(app).post('/api/v1/locations')
        .set('Authorization', `Bearer ${token}`)
        .send({ vehicle_id: vehicleId, latitude: 7.0, longitude: 80.0 });
      await request(app).post('/api/v1/locations')
        .set('Authorization', `Bearer ${token}`)
        .send({ vehicle_id: vehicleId, latitude: 7.1, longitude: 80.1 });

      const res = await request(app)
        .get(`/api/v1/locations/vehicle/${vehicleId}/latest`)
        .set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(200);
      expect(res.body.vehicle_id).toBe(vehicleId);
    });

    it('returns 404 when no location data exists', async () => {
      const vRes = await request(app).post('/api/v1/vehicles')
        .set('Authorization', `Bearer ${token}`).send({ plate_no: 'LOC-EMPTY' });
      const emptyId = vRes.body.id;

      const res = await request(app)
        .get(`/api/v1/locations/vehicle/${emptyId}/latest`)
        .set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(404);
    });
  });
});
