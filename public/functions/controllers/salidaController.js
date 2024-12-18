const ejs = require('ejs');
const path = require('path');
const Salida = require('../models/salida'); // Cambiado a modelo de salida
const Product = require('../models/product');
const Configuracion = require('../models/configuracion');
exports.index = async (event) => {
    try {
        const queryParams = event.queryStringParameters || {};
        const page = parseInt(queryParams.page) || 1;
        const limit = parseInt(queryParams.limit) || 10;
        const skip = (page - 1) * limit;

        // Construir filtros
        const filter = {};
        const debugInfo = {
            receivedParams: queryParams,
            appliedFilters: {},
            appliedMongoFilter: {},
            totalResults: 0,
            timestamp: new Date().toISOString()
        };

        // Filtro por fecha de creación
        if (queryParams.createdAt) {
            const createdAt = new Date(queryParams.createdAt);
            filter.createdAt = { $gte: createdAt };
            debugInfo.appliedFilters.createdAt = queryParams.createdAt;
        }

        // Filtros para productos relacionados
        const productFilters = {};
        if (queryParams.name && queryParams.name.trim()) {
            productFilters.name = { $regex: new RegExp(queryParams.name.trim(), 'i') };
            debugInfo.appliedFilters.name = queryParams.name.trim();
        }

        if (queryParams.code && queryParams.code.trim()) {
            productFilters.code = { $regex: new RegExp(queryParams.code.trim(), 'i') };
            debugInfo.appliedFilters.code = queryParams.code.trim();
        }

        if (queryParams.description && queryParams.description.trim()) {
            productFilters.description = { $regex: new RegExp(queryParams.description.trim(), 'i') };
            debugInfo.appliedFilters.description = queryParams.description.trim();
        }

        // Obtener los IDs de los productos que coinciden con los filtros
        const matchingProducts = await Product.find(productFilters).select('_id');

        // Si hay productos coincidentes, agregar el filtro a las salidas
        if (matchingProducts.length > 0) {
            filter.id_producto = { $in: matchingProducts.map(product => product._id) };
        }

        // Configurar ordenamiento
        const sort = {};
        if (queryParams.sortBy) {
            sort[queryParams.sortBy] = queryParams.sortOrder === 'asc' ? 1 : -1;
            debugInfo.appliedFilters.sortBy = queryParams.sortBy;
            debugInfo.appliedFilters.sortOrder = queryParams.sortOrder;
        } else {
            sort.createdAt = -1;
        }

        // Ejecutar consulta para obtener salidas
        const [total, salidas] = await Promise.all([
            Salida.countDocuments(filter),
            Salida.find(filter)
                .populate('id_producto', 'name code description') // Población de datos del producto
                .sort(sort)
                .skip(skip)
                .limit(limit)
                .lean()
        ]);

        debugInfo.appliedMongoFilter = filter;
        debugInfo.totalResults = total;

        const totalPages = Math.ceil(total / limit);

        const html = await ejs.renderFile(
            path.join(process.env.LAMBDA_TASK_ROOT, './functions/views/salidas/index.ejs'), // Cambiado a la vista de salidas
            {
                salidas,
                title: 'Lista de Salidas',
                pagination: {
                    page,
                    limit,
                    totalPages,
                    total
                },
                filters: queryParams,
                debugInfo: debugInfo // Siempre enviamos debugInfo
            }
        );

        return {
            statusCode: 200,
            headers: { 
                'Content-Type': 'text/html',
                'Access-Control-Allow-Origin': '*'
            },
            body: html
        };

    } catch (error) {
        return { 
            statusCode: 500, 
            headers: {
                'Content-Type': 'text/html',
                'Access-Control-Allow-Origin': '*'
            },
            body: `
                <div class="alert alert-danger">
                    <h4>Error en la búsqueda:</h4>
                    <pre>${error.message}</pre>
                </div>
            `
        };
    }
};

exports.create = async (event) => {
    try {
        // Renderizar formulario de creación
        if (event.httpMethod === 'GET') {
            // Obtener lista de productos para el selector
            const productos = await Product.find({}, 'name code');

            const html = await ejs.renderFile(
                path.join(process.env.LAMBDA_TASK_ROOT, './functions/views/salidas/create.ejs'), // Cambiado a la vista de salidas
                { 
                    title: 'Crear Salida',
                    productos
                }
            );
            return {
                statusCode: 200,
                headers: { 'Content-Type': 'text/html' },
                body: html
            };
        }

        // Procesar creación de salida
        if (event.httpMethod === 'POST') {
            const data = JSON.parse(event.body);
            
            // Validaciones adicionales
            if (!data.id_producto) {
                return {
                    statusCode: 400,
                    body: JSON.stringify({ error: 'Producto es requerido' })
                };
            }

            // Obtener el valor del dólar desde la configuración
            const configuracion = await Configuracion.findOne(); // Asegúrate de que solo haya un documento de configuración
            const precioDolar = configuracion ? configuracion.precio_dolar : 0; // Valor por defecto si no existe

            // Preparar datos de salida
            const salidaData = {
                ...data,
                precio_dolar: precioDolar // Agregar el precio del dólar
            };

            const salida = new Salida(salidaData);
            await salida.save();

            // Actualizar stock del producto
            await Product.findByIdAndUpdate(
                data.id_producto, 
                { $inc: { stock: -data.cantidad } } // Decrementar el stock
            );

            return {
                statusCode: 201,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    message: 'Salida creada exitosamente',
                    salida
                })
            };
        }
    } catch (error) {
        console.error('Error en creación de salida en el servidor:', error);
        return { 
            statusCode: 500, 
            body: JSON.stringify({ error: error.message }) 
        };
    }
};

// Método para mostrar detalles de una salida específica
exports.show = async (event) => {
    try {
        const { id } = event.pathParameters;
        const salida = await Salida.findById(id)
            .populate('id_producto', 'name code')
            .populate('usuario_registro', 'name');

        if (!salida) {
            return {
                statusCode: 404,
                body: JSON.stringify({ error: 'Salida no encontrada' })
            };
        }

        const html = await ejs.renderFile(
            path.join(process.env.LAMBDA_TASK_ROOT, './functions/views/salidas/show.ejs'), // Cambiado a la vista de salidas
            {
                salida,
                title: 'Detalles de la Salida'
            }
        );

        return {
            statusCode: 200,
            headers: { 'Content-Type': 'text/html' },
            body: html
        };
    } catch (error) {
        console.error('Error al mostrar salida:', error);
        return { 
            statusCode: 500, 
            body: JSON.stringify({ error: error.message }) 
        };
    }
};

// Método para eliminar una salida
exports.delete = async (event) => {
    try {
        const { id } = event.pathParameters;
        
        // Encontrar la salida para obtener detalles antes de eliminar
        const salida = await Salida.findById(id);

        if (!salida) {
            return {
                statusCode: 404,
                body: JSON.stringify({ error: 'Salida no encontrada' })
            };
        }

        // Revertir el stock del producto
        await Product.findByIdAndUpdate(
            salida.id_producto, 
            { $inc: { stock: salida.cantidad } } // Decrementar el stock
        );

        // Eliminar la salida
        await Salida.findByIdAndDelete(id);

        return {
            statusCode: 200,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                message: 'Salida eliminada exitosamente',
                salida
            })
        };
    } catch (error) {
        console.error('Error al eliminar salida:', error);
        return { 
            statusCode: 500, 
            body: JSON.stringify({ error: error.message }) 
        };
    }
};

exports.edit = async (event) => {
    try {
        const { id } = event.pathParameters;

        if (event.httpMethod === 'GET') {
            const salida = await Salida.findById(id).populate('id_producto', 'name code price');

            if (!salida) {
                return {
                    statusCode: 404,
                    body: JSON.stringify({ error: 'Salida no encontrada' })
                };
            }

            const html = await ejs.renderFile(
                path.join(process.env.LAMBDA_TASK_ROOT, './functions/views/salidas/edit.ejs'), // Cambiado a la vista de salidas
                {
                    salida,
                    title: 'Editar Salida'
                }
            );

            return {
                statusCode: 200,
                headers: { 'Content-Type': 'text/html' },
                body: html
            };
        }

        if (event.httpMethod === 'PUT') {
            const data = JSON.parse(event.body);

            // Solo se actualiza la cantidad
            const salida = await Salida.findByIdAndUpdate(
                id,
                { cantidad: data.cantidad },
                { new: true, runValidators: true }
            );

            if (!salida) {
                return {
                    statusCode: 404,
                    body: JSON.stringify({ error: 'Salida no encontrada' })
                };
            }

            return {
                statusCode: 200,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    message: 'Salida actualizada exitosamente',
                    salida
                })
            };
        }
    } catch (error) {
        console.error('Error en edit:', error);
        return { statusCode: 500, body: JSON.stringify({ error: error.message }) };
    }
};