'use strict';

const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/locationsController');
const { authenticate } = require('../middleware/auth');

router.use(authenticate);

router.post('/', ctrl.create);
router.get('/vehicle/:vehicleId/latest', ctrl.latestByVehicle);
router.get('/vehicle/:vehicleId', ctrl.listByVehicle);

module.exports = router;
