const mongoose = require('mongoose');
const userController = require('./controllers/userController');
const serviceController = require('./controllers/serviceController');
const productController = require('./controllers/productController');
const categoryController = require('./controllers/categoryController');
const configuracionController = require('./controllers/configuracionController');
const entradaController = require('./controllers/entradaController');
const salidaController = require('./controllers/salidaController');
const mongoUri = 'mongodb+srv://jorge4567:Raiyeris18..@cluster0.lqpe4.mongodb.net/viajes?retryWrites=true&w=majority&appName=Cluster0';

// Conectar a MongoDB con configuración mejorada
mongoose.connect(mongoUri, { 
    useNewUrlParser: true, 
    useUnifiedTopology: true,
    serverSelectionTimeoutMS: 15000,    // Aumentar el timeout a 15 segundos
    socketTimeoutMS: 45000,             // Timeout para operaciones
    maxPoolSize: 50,                    // Máximo de conexiones simultáneas
    wtimeoutMS: 2500,                  // Timeout para operaciones de escritura
    connectTimeoutMS: 15000            // Timeout para la conexión inicial
}).then(() => console.log('MongoDB conectado'))
  .catch(err => console.error('Error de conexión MongoDB:', err));

// Manejar eventos de conexión
mongoose.connection.on('error', err => {
    console.error('MongoDB connection error:', err);
});

mongoose.connection.on('disconnected', () => {
    console.log('MongoDB disconnected');
});

mongoose.connection.on('reconnected', () => {
    console.log('MongoDB reconnected');
});
const controllers = {
  users: userController,
  services: serviceController,
  products: productController,
  categories: categoryController,
  configuracion:configuracionController,
  entradas: entradaController,
  salidas: salidaController
};

// Agregar headers CORS a la respuesta
const addCorsHeaders = (response) => {
    return {
        ...response,
        headers: {
            ...response.headers,
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Headers': 'Content-Type',
            'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS'
        }
    };
};

exports.handler = async (event, context) => {
  context.callbackWaitsForEmptyEventLoop = false;

  // Manejar preflight OPTIONS request
  if (event.httpMethod === 'OPTIONS') {
      return addCorsHeaders({
          statusCode: 200,
          body: ''
      });
  }

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
    const errorResponse = {
        statusCode: 500,
        body: JSON.stringify({ error: error.message })
    };
    return addCorsHeaders(errorResponse);
  }
};
