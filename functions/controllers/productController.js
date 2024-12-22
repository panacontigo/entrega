const ejs = require('ejs');
const path = require('path');
const Product = require('../models/product');
const cloudinary = require('../config/cloudinary');
const { getAllUbicaciones } = require('../utils/ubicaciones');
const Configuracion = require('../models/configuracion'); // Asegúrate de importar el modelo de configuración





const productsData = require('../utils/actfile'); // Importar el archivo JSON

exports.import = async (event) => {
    try {

        const configuracion = await Configuracion.findOne();
        const precioDolar = configuracion ? configuracion.precio_dolar : 0;
        for (const productData of productsData) {
            // Validar que el campo code no exista en la colección
            const existingProduct = await Product.findOne({ code: productData.codigo });
            if (!existingProduct) {
                // Si no existe, crear un nuevo producto
                const newProduct = new Product({
                    code: productData.codigo,
                    name: productData.descripcion,
                    stock: productData.cantidad,
                    price: productData.venta,
                    location: productData.ubicacion,
                    cost:productData.costo
                });
                // Calcular y actualizar el precio en bolívares
                await newProduct.calculatePrecioBolivares(precioDolar);
                // await newProduct.save();
            }


            /*else {
                // Si el producto ya existe, actualizar el stock y el precio
                existingProduct.stock = productData.cantidad;
                existingProduct.price = productData.venta;
                // Calcular y actualizar el precio en bolívares
                await existingProduct.calculatePrecioBolivares(productData.venta);
                //await existingProduct.save();
                console.log(`El producto con code ${productData.code} ha sido actualizado.`);
            }*/
        }

        return {
            statusCode: 200,
            body: JSON.stringify({ message: 'Productos importados exitosamente.' })
        };
    } catch (error) {
        console.error('Error al importar productos:', error);
        return { statusCode: 500, body: JSON.stringify({ error: error.message }) };
    }
};




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

        // Filtro por nombre
        if (queryParams.name && queryParams.name.trim()) {
            filter.$or = [
                { name: { $regex: new RegExp(queryParams.name.trim(), 'i') } },
                { description: { $regex: new RegExp(queryParams.name.trim(), 'i') } }
            ];
            debugInfo.appliedFilters.name = queryParams.name.trim();
        }

        // Filtro por categoría
        if (queryParams.category && queryParams.category.trim()) {
            filter.category = queryParams.category.trim();
            debugInfo.appliedFilters.category = queryParams.category.trim();
        }

        // Filtro por rango de precio
        if (queryParams.minPrice || queryParams.maxPrice) {
            filter.price = {};
            if (queryParams.minPrice) {
                filter.price.$gte = parseFloat(queryParams.minPrice);
                debugInfo.appliedFilters.minPrice = queryParams.minPrice;
            }
            if (queryParams.maxPrice) {
                filter.price.$lte = parseFloat(queryParams.maxPrice);
                debugInfo.appliedFilters.maxPrice = queryParams.maxPrice;
            }
        }

        // Filtro por stock
        if (queryParams.stock === 'true') {
            filter.stock = { $gt: 0 };
            debugInfo.appliedFilters.stock = true;
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

        // Ejecutar consulta
        const [total, products] = await Promise.all([
            Product.countDocuments(filter),
            Product.find(filter)
                .sort(sort)
                .skip(skip)
                .limit(limit)
                .lean()
        ]);

        debugInfo.appliedMongoFilter = filter;
        debugInfo.totalResults = total;

        const totalPages = Math.ceil(total / limit);

        const html = await ejs.renderFile(
            path.join(process.env.LAMBDA_TASK_ROOT, './functions/views/productos/index.ejs'),
            {
                products,
                title: 'Lista de Productos',
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
        if (event.httpMethod === 'GET') {
            const html = await ejs.renderFile(
                path.join(process.env.LAMBDA_TASK_ROOT, './functions/views/productos/create.ejs'),
                {
                    title: 'Crear Producto',
                    getAllUbicaciones: getAllUbicaciones
                }
            );
            return {
                statusCode: 200,
                headers: { 'Content-Type': 'text/html' },
                body: html
            };
        }

        if (event.httpMethod === 'POST') {
            const data = JSON.parse(event.body);


            const existingProduct = await Product.findOne({ code: data.code });
            if (existingProduct) {
                return {
                    statusCode: 400,
                    body: JSON.stringify({ error: 'El código del producto ya existe.' })
                };
            }



            // Si hay una imagen en base64
            if (data.image && data.image.startsWith('data:image')) {
                try {
                    const result = await cloudinary.uploader.upload(data.image, {
                        folder: 'productos',
                        use_filename: true,
                        unique_filename: true
                    });

                    // Reemplazar el base64 con la URL de Cloudinary
                    data.image = result.secure_url;
                } catch (error) {
                    console.error('Error al subir imagen:', error);
                    data.image = JSON.stringify(error); // Imagen por defecto
                }
            }
            const configuracion = await Configuracion.findOne();
            const precioDolar = configuracion ? configuracion.precio_dolar : 0;
            const product = new Product(data);
            await product.calculatePrecioBolivares(precioDolar);

            return {
                statusCode: 201,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    message: 'Producto creado exitosamente',
                    product
                })
            };
        }
    } catch (error) {
        return { statusCode: 500, body: JSON.stringify({ error: error.message }) };
    }
};

exports.show = async (event) => {
    try {
        const { id } = event.pathParameters;
        const product = await Product.findById(id);

        if (!product) {
            return {
                statusCode: 404,
                body: JSON.stringify({ error: 'Producto no encontrado' })
            };
        }

        return {
            statusCode: 200,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(product)
        };
    } catch (error) {
        return { statusCode: 500, body: JSON.stringify({ error: error.message }) };
    }
};

exports.edit = async (event) => {
    try {
        const { id } = event.pathParameters;

        if (event.httpMethod === 'GET') {
            const product = await Product.findById(id);

            if (!product) {
                return {
                    statusCode: 404,
                    body: JSON.stringify({ error: 'Producto no encontrado' })
                };
            }

            const html = await ejs.renderFile(
                path.join(process.env.LAMBDA_TASK_ROOT, './functions/views/productos/edit.ejs'),
                {
                    product,
                    title: 'Editar Producto'
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

            // Si hay una nueva imagen en base64
            if (data.image && data.image.startsWith('data:image')) {
                try {
                    const result = await cloudinary.uploader.upload(data.image, {
                        folder: 'productos',
                        use_filename: true,
                        unique_filename: true
                    });
                    data.image = result.secure_url;
                } catch (error) {
                    console.error('Error al subir imagen:', error);
                    delete data.image; // Mantener la imagen anterior
                }
            }
            const configuracion = await Configuracion.findOne();
            const precioDolar = configuracion ? configuracion.precio_dolar : 0;
            const product = await Product.findByIdAndUpdate(
                id,
                data,
                { new: true, runValidators: true }
            );

            await product.calculatePrecioBolivares(precioDolar);

            if (!product) {
                return {
                    statusCode: 404,
                    body: JSON.stringify({ error: 'Producto no encontrado' })
                };
            }

            return {
                statusCode: 200,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    message: 'Producto actualizado exitosamente',
                    product
                })
            };
        }
    } catch (error) {
        console.error('Error en edit:', error);
        return { statusCode: 500, body: JSON.stringify({ error: error.message }) };
    }
};

exports.delete = async (event) => {
    try {
        const { id } = event.pathParameters;
        const product = await Product.findByIdAndDelete(id);

        if (!product) {
            return {
                statusCode: 404,
                body: JSON.stringify({ error: 'Producto no encontrado' })
            };
        }

        return {
            statusCode: 200,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                message: 'Producto eliminado exitosamente',
                product
            })
        };
    } catch (error) {
        return { statusCode: 500, body: JSON.stringify({ error: error.message }) };
    }
};

exports.list = async (event) => {
    try {
        const queryParams = event.queryStringParameters || {};
        const filter = {};

        // Filtro por nombre o descripción
        if (queryParams.search && queryParams.search.trim()) {
            const searchValue = queryParams.search.trim();
            filter.$or = [
                { name: { $regex: new RegExp(searchValue, 'i') } },
                { description: { $regex: new RegExp(searchValue, 'i') } },
                { code: { $regex: new RegExp(searchValue.toString(), 'i') } } // Asegúrate de que se busque como cadena
            ];
        }

        // Ejecutar consulta
        const products = await Product.find(filter)
            .select('name _id code cost price precio_bolivares ') // Seleccionar solo los campos necesarios
            .lean();

        return {
            statusCode: 200,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(products)
        };
    } catch (error) {
        console.error('Error al listar productos:', error);
        return {
            statusCode: 500,
            body: JSON.stringify({ error: error.message })
        };
    }
}; 
exports.procesarlistadocompra = async (event) => {
    try {
        const data = JSON.parse(event.body);
        const { codigos } = data;

        if (!Array.isArray(codigos) || codigos.length === 0) {
            return {
                statusCode: 400,
                body: JSON.stringify({ error: 'No se proporcionaron códigos de productos' })
            };
        }

        const productos = await Product.find({ code: { $in: codigos } }, 'code name cost _id').lean();

        return {
            statusCode: 200,
            body: JSON.stringify(productos)
        };
    } catch (error) {
        console.error('Error al procesar el listado de productos:', error);
        return {
            statusCode: 500,
            body: JSON.stringify({ error: 'Error al procesar el listado de productos' })
        };
    }
};