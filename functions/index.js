const mongoose = require('mongoose');
const userController = require('./controllers/userController');
const serviceController = require('./controllers/serviceController');

const mongoUri = 'mongodb+srv://jorge4567:Raiyeris18..@cluster0.lqpe4.mongodb.net/viajes?retryWrites=true&w=majority&appName=Cluster0';

// Conectar a MongoDB
mongoose.connect(mongoUri, { 
  useNewUrlParser: true, 
  useUnifiedTopology: true 
}).then(() => console.log('MongoDB conectado'))
  .catch(err => console.error('Error de conexión MongoDB:', err));

const controllers = {
  users: userController,
  services: serviceController
};

exports.handler = async (event, context) => {
  context.callbackWaitsForEmptyEventLoop = false;

  try {
    const parts = event.path.split('/').filter(part => part);
    const controllerName = parts[1]; // 'users'
    const controller = controllers[controllerName];

    if (controller) {
      const nextPart = parts[2];    // 'edit'
      const id = parts[3];          // '674d1f5'
      
      const ctx = {
        ...event,
        method: event.httpMethod,
        pathParameters: id ? { id } : null,
        methodName: nextPart
      };

      // Si tenemos un método específico y un ID
      if (nextPart && id) {
        if (controller[nextPart]) {
          return await controller[nextPart](ctx);
        }
      }

      // Verificar si nextPart es un ID válido de MongoDB
      const isMongoId = /^[0-9a-fA-F]{24}$/.test(nextPart);

      if (isMongoId) {
        ctx.pathParameters = { id: nextPart };
        switch (event.httpMethod) {
          case 'GET': return await controller.show(ctx);
          case 'PUT': return await controller.update(ctx);
          case 'DELETE': return await controller.delete(ctx);
          default: break;
        }
      } else if (controller[nextPart]) {
        return await controller[nextPart](ctx);
      }

      // Si no hay método específico, usar los métodos por defecto
      if (event.httpMethod === 'GET') {
        return await controller.index(ctx);
      }
      if (event.httpMethod === 'POST') {
        return await controller.store(ctx);
      }
    }

    return {
      statusCode: 404,
      body: JSON.stringify({ 
        error: 'Ruta no encontrada',
        path: event.path,
        method: event.httpMethod 
      })
    };

  } catch (error) {
    console.error('Error en handler principal:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ 
        error: 'Error interno del servidor',
        message: error.message 
      })
    };
  }
};
