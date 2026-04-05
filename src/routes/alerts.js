'use strict';

const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/alertsController');
const { authenticate } = require('../middleware/auth');

router.use(authenticate);

router.get('/', ctrl.list);
router.post('/', ctrl.create);
router.get('/:id', ctrl.getById);
router.put('/:id/resolve', ctrl.resolve);
router.put('/:id', ctrl.update);

module.exports = router;
