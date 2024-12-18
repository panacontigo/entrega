const Service = require('../models/service');

// Obtener todos los servicios
exports.index = async (event) => {
  try {
    const services = await Service.find({});
    return {
      statusCode: 200,
      body: JSON.stringify(services)
    };
  } catch (error) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: error.message })
    };
  }
};

// Crear un nuevo servicio
exports.create = async (event) => {
  try {
    const body = JSON.parse(event.body);
    const service = new Service(body);
    await service.save();
    return {
      statusCode: 201,
      body: JSON.stringify(service)
    };
  } catch (error) {
    return {
      statusCode: 400,
      body: JSON.stringify({ error: error.message })
    };
  }
};

// Actualizar un servicio
exports.update = async (event) => {
  try {
    const body = JSON.parse(event.body);
    const service = await Service.findByIdAndUpdate(event.pathParameters.id, body, { new: true });
    if (!service) {
      return {
        statusCode: 404,
        body: JSON.stringify({ error: 'Servicio no encontrado' })
      };
    }
    return {
      statusCode: 200,
      body: JSON.stringify(service)
    };
  } catch (error) {
    return {
      statusCode: 400,
      body: JSON.stringify({ error: error.message })
    };
  }
};

// Eliminar un servicio
exports.delete = async (event) => {
  try {
    const service = await Service.findByIdAndDelete(event.pathParameters.id);
    if (!service) {
      return {
        statusCode: 404,
        body: JSON.stringify({ error: 'Servicio no encontrado' })
      };
    }
    return {
      statusCode: 200,
      body: JSON.stringify({ message: 'Servicio eliminado' })
    };
  } catch (error) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: error.message })
    };
  }
};
