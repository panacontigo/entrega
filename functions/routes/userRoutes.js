// routes/userRoutes.js
const express = require('express');
const router = express.Router();
const userController = require('../controllers/userController');

// Definir las rutas y enlazarlas con los métodos del controlador
router.get('/users', userController.index);
router.post('/users', userController.create);
router.put('/users/:id', userController.update);
router.delete('/users/:id', userController.delete);

module.exports = router;
