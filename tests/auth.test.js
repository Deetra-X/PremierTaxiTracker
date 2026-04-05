'use strict';

const request = require('supertest');
const app = require('../src/app');
const { setupTestDb } = require('./testHelper');

setupTestDb();

describe('Auth endpoints', () => {
  describe('POST /api/v1/auth/register', () => {
    it('registers a new officer and returns 201', async () => {
      const res = await request(app).post('/api/v1/auth/register').send({
        badge_no: 'SLP001',
        name: 'Officer Silva',
        password: 'Secret123!',
      });
      expect(res.status).toBe(201);
      expect(res.body).toMatchObject({ badge_no: 'SLP001', name: 'Officer Silva', role: 'officer' });
      expect(res.body).not.toHaveProperty('password');
    });

    it('returns 400 when required fields are missing', async () => {
      const res = await request(app).post('/api/v1/auth/register').send({ badge_no: 'SLP002' });
      expect(res.status).toBe(400);
    });

    it('returns 409 on duplicate badge number', async () => {
      const payload = { badge_no: 'SLP003', name: 'Test', password: 'pass' };
      await request(app).post('/api/v1/auth/register').send(payload);
      const res = await request(app).post('/api/v1/auth/register').send(payload);
      expect(res.status).toBe(409);
    });

    it('sets role to admin when specified', async () => {
      const res = await request(app).post('/api/v1/auth/register').send({
        badge_no: 'ADM001', name: 'Admin User', password: 'pass', role: 'admin',
      });
      expect(res.status).toBe(201);
      expect(res.body.role).toBe('admin');
    });
  });

  describe('POST /api/v1/auth/login', () => {
    beforeEach(async () => {
      await request(app).post('/api/v1/auth/register').send({
        badge_no: 'SLP010', name: 'Login Test', password: 'MyPass99',
      });
    });

    it('returns JWT on valid credentials', async () => {
      const res = await request(app).post('/api/v1/auth/login').send({
        badge_no: 'SLP010', password: 'MyPass99',
      });
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('token');
      expect(res.body.officer).toMatchObject({ badge_no: 'SLP010' });
    });

    it('returns 401 on wrong password', async () => {
      const res = await request(app).post('/api/v1/auth/login').send({
        badge_no: 'SLP010', password: 'wrong',
      });
      expect(res.status).toBe(401);
    });

    it('returns 401 for unknown badge number', async () => {
      const res = await request(app).post('/api/v1/auth/login').send({
        badge_no: 'UNKNOWN', password: 'pass',
      });
      expect(res.status).toBe(401);
    });

    it('returns 400 when fields are missing', async () => {
      const res = await request(app).post('/api/v1/auth/login').send({ badge_no: 'SLP010' });
      expect(res.status).toBe(400);
    });
  });

  describe('GET /api/v1/auth/me', () => {
    let token;
    beforeEach(async () => {
      await request(app).post('/api/v1/auth/register').send({
        badge_no: 'SLP020', name: 'Me Test', password: 'pass',
      });
      const res = await request(app).post('/api/v1/auth/login').send({
        badge_no: 'SLP020', password: 'pass',
      });
      token = res.body.token;
    });

    it('returns current officer profile', async () => {
      const res = await request(app)
        .get('/api/v1/auth/me')
        .set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({ badge_no: 'SLP020' });
      expect(res.body).not.toHaveProperty('password');
    });

    it('returns 401 without token', async () => {
      const res = await request(app).get('/api/v1/auth/me');
      expect(res.status).toBe(401);
    });
  });
});
