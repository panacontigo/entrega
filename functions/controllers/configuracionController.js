const Configuracion = require('../models/configuracion');
const Product = require('../models/product');
const Entrada = require('../models/entrada');
const Salida = require('../models/salida');
const ejs = require('ejs');
const path = require('path');
const fs = require('fs');
const pathToFile = '/tmp/backup.json';

exports.index = async (event) => {
    try {
        let configuracion = await Configuracion.findOne();
        
        // Si no existe, crear un nuevo registro con campos vacíos
        if (!configuracion) {
            configuracion = new Configuracion({
                precio_dolar: null,
                fecha_act_dolar: null
            });
            await configuracion.save(); // Guardar el nuevo registro
        }

        const html = await ejs.renderFile(
            path.join(process.env.LAMBDA_TASK_ROOT, './functions/views/configuracion/index.ejs'),
            {
                configuracion,
                title: 'Configuración'
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
        console.error('Error al obtener configuración:', error);
        return {
            statusCode: 500,
            body: JSON.stringify({ message: error.message })
        };
    }
};

exports.update = async (event) => {
    try {
        const { precio_dolar, fecha_act_dolar } = JSON.parse(event.body);

        // Actualizar o crear la configuración
        const configuracion = await Configuracion.findOneAndUpdate(
            {},
            { precio_dolar, fecha_act_dolar },
            { new: true, upsert: true } // upsert crea un nuevo documento si no existe
        );

        // Obtener todos los productos para recalcular el precio en bolívares
        const productos = await Product.find({});

        // Recalcular el precio en bolívares para cada producto
        for (const producto of productos) {
            await producto.calculatePrecioBolivares(precio_dolar);
            await producto.save(); // Guardar los cambios en el producto
        }

        return {
            statusCode: 200,
            body: JSON.stringify({
                message: 'Configuración actualizada correctamente y precios recalculados',
                configuracion
            })
        };
    } catch (error) {
        console.error('Error al actualizar configuración:', error);
        return {
            statusCode: 500,
            body: JSON.stringify({ message: error.message })
        };
    }
};

exports.deleteAllProducts = async (event) => {
    try {
        // Obtener datos de las colecciones
        const productos = await Product.find({});
        const entradas = await Entrada.find({});
        const salidas = await Salida.find({});

        // Crear un objeto con los datos
        const backupData = {
            productos,
            entradas,
            salidas
        };

        // Guardar el objeto en un archivo JSON en el directorio temporal
        fs.writeFileSync(pathToFile, JSON.stringify(backupData, null, 2));

        // Eliminar todos los registros
        await Product.deleteMany({});
        await Entrada.deleteMany({});
        await Salida.deleteMany({});

        // Leer el archivo y devolverlo como respuesta
        const fileContent = fs.readFileSync(pathToFile);
        
        return {
            statusCode: 200,
            headers: {
                'Content-Type': 'application/json',
                'Content-Disposition': 'attachment; filename="backup.json"', // Indica que es un archivo para descargar
            },
            body: fileContent.toString('utf-8') // Convertir el buffer a string
        };
    } catch (error) {
        console.error('Error al crear respaldo y eliminar productos, entradas y salidas:', error);
        return {
            statusCode: 500,
            body: JSON.stringify({ message: error.message })
        };
    }
}; 
exports.getpreciodolar = async (event) => {
    try {
        const configuracion = await Configuracion.findOne();

        if (!configuracion) {
            return {
                statusCode: 404,
                body: JSON.stringify({ message: 'Configuración no encontrada' })
            };
        }

        return {
            statusCode: 200,
            body: JSON.stringify({ precio_dolar: configuracion.precio_dolar })
        };
    } catch (error) {
        console.error('Error al obtener el precio del dólar:', error);
        return {
            statusCode: 500,
            body: JSON.stringify({ message: error.message })
        };
    }
};