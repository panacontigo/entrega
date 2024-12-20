const ejs = require('ejs');
const path = require('path');
const Entrada = require('../models/entrada');
const Product = require('../models/product');
const Configuracion = require('../models/configuracion'); 
const moment = require('moment-timezone');

/*https://github.com/copilot/c/33eb6c5d-1f77-47a7-a777-83b7e1195d3c*/
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

        // Si hay productos coincidentes, agregar el filtro a las entradas
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

        // Ejecutar consulta para obtener entradas
        const [total, entradas] = await Promise.all([
            Entrada.countDocuments(filter),
            Entrada.find(filter)
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
            path.join(process.env.LAMBDA_TASK_ROOT, './functions/views/entradas/index.ejs'),
            {
                entradas,
                title: 'Lista de Entradas',
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
                path.join(process.env.LAMBDA_TASK_ROOT, './functions/views/entradas/create.ejs'),
                { 
                    title: 'Crear Entrada',
                    productos
                }
            );
            return {
                statusCode: 200,
                headers: { 'Content-Type': 'text/html' },
                body: html
            };
        }

        // Procesar creación de entrada
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

            // Preparar datos de entrada
            const entradaData = {
                ...data,
                precio_dolar: precioDolar // Agregar el precio del dólar
            };

            const entrada = new Entrada(entradaData);
            await entrada.save();

            // No se actualiza el stock del producto aquí

            return {
                statusCode: 201,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    message: 'Entrada creada exitosamente',
                    entrada
                })
            };
        }
    } catch (error) {
        console.error('Error en creación de entrada en el servidor:', error);
        return { 
            statusCode: 500, 
            body: JSON.stringify({ error: error.message }) 
        };
    }
};

// Método para mostrar detalles de una entrada específica
exports.show = async (event) => {
    try {
        const { id } = event.pathParameters;
        const entrada = await Entrada.findById(id)
            .populate('id_producto', 'name code')
            .populate('usuario_registro', 'name');

        if (!entrada) {
            return {
                statusCode: 404,
                body: JSON.stringify({ error: 'Entrada no encontrada' })
            };
        }

        const html = await ejs.renderFile(
            path.join(process.env.LAMBDA_TASK_ROOT, './functions/views/entradas/show.ejs'),
            {
                entrada,
                title: 'Detalles de la Entrada'
            }
        );

        return {
            statusCode: 200,
            headers: { 'Content-Type': 'text/html' },
            body: html
        };
    } catch (error) {
        console.error('Error al mostrar entrada:', error);
        return { 
            statusCode: 500, 
            body: JSON.stringify({ error: error.message }) 
        };
    }
};

// Método para confirmar una entrada
exports.confirmar = async (event) => {
    try {
        const { id } = event.pathParameters;

        // Encontrar la entrada
        const entrada = await Entrada.findById(id);

        if (!entrada) {
            return {
                statusCode: 404,
                body: JSON.stringify({ error: 'Entrada no encontrada' })
            };
        }

        // Cambiar el estado de la entrada a "COMPLETADA"
        entrada.status = 'COMPLETADA';
        await entrada.save();

        // Actualizar stock del producto
        await Product.findByIdAndUpdate(
            entrada.id_producto, 
            { $inc: { stock: entrada.cantidad } } // Disminuir el stock solo al confirmar
        );

        return {
            statusCode: 200,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                message: 'Entrada confirmada exitosamente',
                entrada
            })
        };
    } catch (error) {
        console.error('Error al confirmar entrada:', error);
        return { 
            statusCode: 500, 
            body: JSON.stringify({ error: error.message }) 
        };
    }
};
// Método para confirmar todas las entradas pendientes
exports.confirmartodas = async (event) => {
    try {
        // Obtener todas las entradas en estado PENDIENTE
        const entradasPendientes = await Entrada.find({ status: 'PENDIENTE' });

        if (entradasPendientes.length === 0) {
            return {
                statusCode: 404,
                body: JSON.stringify({ message: 'No hay entradas pendientes para confirmar' })
            };
        }

        // Confirmar cada entrada y actualizar el stock
        for (const entrada of entradasPendientes) {
            entrada.status = 'COMPLETADA';
            await entrada.save();

            // Actualizar stock del producto
            await Product.findByIdAndUpdate(
                entrada.id_producto, 
                { $inc: { stock: entrada.cantidad } }
            );
        }

        return {
            statusCode: 200,
            body: JSON.stringify({ message: 'Todas las entradas pendientes han sido confirmadas' })
        };
    } catch (error) {
        console.error('Error al confirmar todas las entradasVVV:', error);
        return { 
            statusCode: 500, 
            body: JSON.stringify({ error: error.message }) 
        };
    }
};
// Método para eliminar una entrada
exports.delete = async (event) => {
    try {
        const { id } = event.pathParameters;
        
        // Encontrar la entrada para obtener detalles antes de eliminar
        const entrada = await Entrada.findById(id);

        if (!entrada) {
            return {
                statusCode: 404,
                body: JSON.stringify({ error: 'Entrada no encontrada' })
            };
        }

        // Si el estado de la entrada es "COMPLETADA", revertir el stock del producto
        if (entrada.status === 'COMPLETADA') {
            await Product.findByIdAndUpdate(
                entrada.id_producto, 
                { $inc: { stock: -entrada.cantidad } }
            );
        }

        // Eliminar la entrada
        await Entrada.findByIdAndDelete(id);

        return {
            statusCode: 200,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                message: 'Entrada eliminada exitosamente',
                entrada
            })
        };
    } catch (error) {
        console.error('Error al eliminar entrada:', error);
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
            const entrada = await Entrada.findById(id).populate('id_producto', 'name code price');

            if (!entrada) {
                return {
                    statusCode: 404,
                    body: JSON.stringify({ error: 'Entrada no encontrada' })
                };
            }

            const html = await ejs.renderFile(
                path.join(process.env.LAMBDA_TASK_ROOT, './functions/views/entradas/edit.ejs'),
                {
                    entrada,
                    title: 'Editar Entrada'
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
            const entrada = await Entrada.findByIdAndUpdate(
                id,
                { cantidad: data.cantidad },
                { new: true, runValidators: true }
            );

            if (!entrada) {
                return {
                    statusCode: 404,
                    body: JSON.stringify({ error: 'Entrada no encontrada' })
                };
            }

            return {
                statusCode: 200,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    message: 'Entrada actualizada exitosamente',
                    entrada
                })
            };
        }
    } catch (error) {
        console.error('Error en edit:', error);
        return { statusCode: 500, body: JSON.stringify({ error: error.message }) };
    }
}; 

exports.obtenerentradasporfecha = async (event) => {
    try {
        const queryParams = event.queryStringParameters || {};
        const fecha = queryParams.fecha;

        if (!fecha) {
            return {
                statusCode: 400,
                body: JSON.stringify({ error: 'La fecha es requerida' })
            };
        }

        const fechaInicio = new Date(fecha);
        const fechaFin = new Date(fechaInicio);
        fechaFin.setDate(fechaFin.getDate() + 1); // Sumar un día para incluir todo el día

        // Obtener las entradas que caen dentro del rango de fechas
        const entradas = await Entrada.find({
            fecha_registro: {
                $gte: fechaInicio,
                $lt: fechaFin
            }
        })
        .populate('id_producto', 'code name') // Poblar solo los campos code y name
        .lean();

        if (entradas.length === 0) {
            return {
                statusCode: 404,
                body: JSON.stringify({ message: 'No hay entradas para la fecha seleccionada' })
            };
        }

        // Estructurar los datos para el Excel y calcular totales
        let totalDolares = 0;
        let totalBs = 0;

        const entradasConDatos = entradas.map(entrada => {
            const precioVenta = entrada.precio_venta;
            const cantidad = entrada.cantidad;
            const total = precioVenta * cantidad; // Total en precio de venta
            const totalBolivares = total * entrada.precio_dolar; // Total en bolívares

            totalDolares += total;
            totalBs += totalBolivares;

            return {
                'Fecha': entrada.fecha_registro.toISOString().split('T')[0], // Formato YYYY-MM-DD
                'Código': entrada.id_producto.code,
                'Descripción': entrada.id_producto.name,
                'Precio Venta': precioVenta,
                'Cantidad': cantidad,
                'Total': total,
                'Precio Dólar': entrada.precio_dolar,
                'Total BS': totalBolivares
            };
        });

        // Agregar la fila de totales
       /* entradasConDatos.push({
            'Fecha': 'Total',
            'Código': '',
            'Descripción': '',
            'Precio Venta': '',
            'Cantidad': '',
            'Total': totalDolares,
            'Precio Dólar': '',
            'Total BS': totalBs
        });*/

        return {
            statusCode: 200,
            body: JSON.stringify(entradasConDatos)
        };
    } catch (error) {
        console.error('Error al obtener entradas por fecha:', error);
        return {
            statusCode: 500,
            body: JSON.stringify({ error: error.message })
        };
    }

};
exports.registrarcompra = async (event) => {
    try {
        const data = JSON.parse(event.body);

        if (!Array.isArray(data.entries) || data.entries.length === 0) {
            return {
                statusCode: 400,
                body: JSON.stringify({ error: 'No hay entradas para registrar' })
            };
        }

        if (!data.precioDolar) {
            return {
                statusCode: 400,
                body: JSON.stringify({ error: 'El precio del dólar es requerido' })
            };
        }

        const precioDolar = data.precioDolar; // Obtener el precio del dólar desde la solicitud

        const entradasRegistradas = [];
        for (const item of data.entries) {
            const { productId, quantity } = item;

            if (!productId || !quantity || quantity <= 0) {
                continue;
            }

            const producto = await Product.findById(productId);
            if (!producto) {
                continue;
            }

            const entradaData = {
                id_producto: productId,
                cantidad: quantity,
                tipo_entrada: 'Compra',
                precio_unitario: producto.cost,
                precio_venta: producto.price,
                precio_dolar: precioDolar, // Usar el precio del dólar proporcionado
                usuario_registro: 'Admin', // Ajustar según sea necesario
                fecha_registro: data.fechaCompra ? moment.tz(data.fechaCompra, "America/Caracas").toDate() : moment.tz(new Date(), "America/Caracas").toDate()
            };

            const entrada = new Entrada(entradaData);
            await entrada.save();
            entradasRegistradas.push(entrada);
        }

        return {
            statusCode: 201,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                message: 'Entradas registradas exitosamente',
                entradas: entradasRegistradas
            })
        };
    } catch (error) {
        console.error('Error al registrar entradas de compra:', error);
        return {
            statusCode: 500,
            body: JSON.stringify({ error: error.message })
        };
    }
};
exports.pendientes = async (event) => {
    try {
        const queryParams = event.queryStringParameters || {};
        const page = parseInt(queryParams.page) || 1;
        const limit = parseInt(queryParams.limit) || 10;
        const skip = (page - 1) * limit;

        // Filtro para entradas pendientes
        const filter = { status: 'PENDIENTE' };
        const sort = { fecha_registro: -1 }; // Ordenar por fecha de registro descendente

        // Ejecutar consulta para obtener entradas pendientes
        const [total, entradas] = await Promise.all([
            Entrada.countDocuments(filter),
            Entrada.find(filter)
                .populate('id_producto', 'name code description') // Poblar datos del producto
                .sort(sort)
                .skip(skip)
                .limit(limit)
                .lean()
        ]);

        const totalPages = Math.ceil(total / limit);

        const html = await ejs.renderFile(
            path.join(process.env.LAMBDA_TASK_ROOT, './functions/views/entradas/pendientes.ejs'),
            {
                entradas,
                title: 'Entradas Pendientes',
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
                    <h4>Error al cargar las entradas pendientes:</h4>
                    <pre>${error.message}</pre>
                </div>
            `
        };
    }
};