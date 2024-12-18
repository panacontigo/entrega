const ejs = require('ejs');
const path = require('path');
const User = require('../models/user');

exports.index = async (event) => {
  try {
    // Obtener parámetros de paginación
    const page = parseInt(event.queryStringParameters?.page) || 1;
    const limit = parseInt(event.queryStringParameters?.limit) || 10;
    const skip = (page - 1) * limit;

    // Obtener total de documentos para calcular páginas
    const total = await User.countDocuments();
    const totalPages = Math.ceil(total / limit);

    // Obtener usuarios con paginación
    const users = await User.find({})
      .skip(skip)
      .limit(limit)
      .sort({ createdAt: -1 });

    const html = await ejs.renderFile(
      path.join(process.env.LAMBDA_TASK_ROOT, './functions/views/usuarios/index.ejs'),
      { 
        users,
        title: 'Lista de Usuarios',
        pagination: {
          page,
          limit,
          totalPages,
          total
        }
      }
    );

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'text/html' },
      body: html
    };
  } catch (error) {
    return { statusCode: 500, body: JSON.stringify({ error: error.message }) };
  }
};

exports.create = async (event) => {
  try {
    // Si es GET, mostrar el formulario
    if (event.httpMethod === 'GET') {
      const html = await ejs.renderFile(
        path.join(process.env.LAMBDA_TASK_ROOT, './functions/views/usuarios/create.ejs'),
        {
          title: 'Crear Usuario'
        }
      );
      return {
        statusCode: 200,
        headers: { 'Content-Type': 'text/html' },
        body: html
      };
    }
    
    // Si es POST, procesar los datos
    if (event.httpMethod === 'POST') {
      const data = JSON.parse(event.body);
      const user = new User(data);
      await user.save();
      return {
        statusCode: 201,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          message: 'Usuario creado exitosamente',
          user 
        })
      };
    }

  } catch (error) {
    return { 
      statusCode: 500, 
      body: JSON.stringify({ error: error.message }) 
    };
  }
};

exports.show = async (event) => {
  try {
    const { id } = event.pathParameters;
    const user = await User.findById(id);
    
    if (!user) {
      return {
        statusCode: 404,
        body: JSON.stringify({ error: 'Usuario no encontrado' })
      };
    }

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(user)
    };
  } catch (error) {
    return { statusCode: 500, body: JSON.stringify({ error: error.message }) };
  }
};

exports.update = async (event) => {
  try {
    const { id } = event.pathParameters;
    const data = JSON.parse(event.body);
    
    const user = await User.findByIdAndUpdate(id, data, { new: true });
    
    if (!user) {
      return {
        statusCode: 404,
        body: JSON.stringify({ error: 'Usuario no encontrado' })
      };
    }

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: 'Usuario actualizado exitosamente',
        user
      })
    };
  } catch (error) {
    return { statusCode: 500, body: JSON.stringify({ error: error.message }) };
  }
};

exports.delete = async (event) => {
  try {
    const { id } = event.pathParameters;
    const user = await User.findByIdAndDelete(id);
    
    if (!user) {
      return {
        statusCode: 404,
        body: JSON.stringify({ error: 'Usuario no encontrado' })
      };
    }

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: 'Usuario eliminado exitosamente',
        user
      })
    };
  } catch (error) {
    return { statusCode: 500, body: JSON.stringify({ error: error.message }) };
  }
};

exports.edit = async (event) => {
    try {
        const { id } = event.pathParameters;
        console.log('ID recibido:', id); // Para debugging

        // GET: Mostrar formulario de edición
        if (event.httpMethod === 'GET') {
            const user = await User.findById(id);
            
            if (!user) {
                return {
                    statusCode: 404,
                    body: JSON.stringify({ error: 'Usuario no encontrado' })
                };
            }

            const html = await ejs.renderFile(
                path.join(process.env.LAMBDA_TASK_ROOT, './functions/views/usuarios/edit.ejs'),
                { 
                    user,
                    title: 'Editar Usuario'
                }
            );

            return {
                statusCode: 200,
                headers: { 'Content-Type': 'text/html' },
                body: html
            };
        }

        // PUT: Procesar la actualización
        if (event.httpMethod === 'PUT') {
            const data = JSON.parse(event.body);
            
            const user = await User.findByIdAndUpdate(
                id,
                data,
                { new: true, runValidators: true }
            );
            
            if (!user) {
                return {
                    statusCode: 404,
                    body: JSON.stringify({ error: 'Usuario no encontrado' })
                };
            }

            return {
                statusCode: 200,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    message: 'Usuario actualizado exitosamente',
                    user
                })
            };
        }

    } catch (error) {
        console.error('Error en edit:', error);
        return { 
            statusCode: 500, 
            body: JSON.stringify({ error: error.message }) 
        };
    }
};
