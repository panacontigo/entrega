const mongoose = require('mongoose');
const moment = require('moment-timezone');
const { isValidCategory } = require('../utils/categories');
const { isValidUbicacion } = require('../utils/ubicaciones');

const productSchema = new mongoose.Schema({
    code: {  // Nuevo campo código
        type: String,
        required: true,
        unique: true,  // Asegura que no haya códigos duplicados
        trim: true,    // Elimina espacios en blanco al inicio y final
        index: true    // Indexado para búsquedas más rápidas
    },
    name: { 
        type: String, 
        required: true,
        index: true 
    },
    description: { 
        type: String, 
        required: false 
    },
    price: { 
        type: Number, 
        required: true,
        index: true 
    },
    cost: {  // Nuevo campo costo
        type: Number,
        default: 0,
        index: true
    },
    location: { 
        type: String,
        required: false,
        default: 'POR DEFINIR',
        validate: {
            validator: function(v) {
                return isValidUbicacion(v);
            },
            message: props => `${props.value} no es una ubicación válida!`
        }
    },
    stock: { 
        type: Number, 
        default: 0,
        index: true 
    },
    image: { 
        type: String, 
        default: 'default-product.jpg' 
    },
    status: { 
        type: String, 
        default: 'active',
        index: true 
    },
    category: { 
        type: String, 
        required: false,
        default:'generica',
        validate: {
            validator: function(v) {
                return isValidCategory(v);
            },
            message: props => `${props.value} no es una categoría válida!`
        },
        index: true 
    },
    createdAt: { 
        type: Date, 
        default: () => moment.tz(Date.now(), "America/Caracas").toDate(),
        index: true 
    },
    updatedAt: { 
        type: Date, 
        default: () => moment.tz(Date.now(), "America/Caracas").toDate(),
        index: true 
    },
    precio_bolivares: {  // Nuevo campo para el precio en bolívares
        type: Number,
        default: 0
    }
});

// Índice compuesto para búsquedas comunes
productSchema.index({ name: 'text', description: 'text' });

// Virtual para calcular el margen de ganancia
productSchema.virtual('profit').get(function() {
    return this.price - this.cost;
});

// Virtual para calcular el porcentaje de margen
productSchema.virtual('profitPercentage').get(function() {
    if (this.cost === 0) return 0;
    return ((this.price - this.cost) / this.cost) * 100;
});

// Método para calcular el precio en bolívares
productSchema.methods.calculatePrecioBolivares = async function(precioDolar) {
    // Calcular el precio en bolívares
    let precioCalculado = this.price * precioDolar;

    // Redondear según las reglas especificadas
    if (precioCalculado % 1 > 0.50) {
        // Si el decimal es mayor a 0.50, redondear hacia arriba
        this.precio_bolivares = Math.ceil(precioCalculado);
    } else if (precioCalculado % 1 >= 0.01 && precioCalculado % 1 <= 0.50) {
        // Si el decimal está entre 0.01 y 0.50, redondear a 0.50
        this.precio_bolivares = Math.floor(precioCalculado) + 0.50;
    } else {
        // Si es un número entero, mantenerlo
        this.precio_bolivares = Math.floor(precioCalculado);
    }

    await this.save();
};

// Middleware para ajustar la fecha de actualización antes de guardar
productSchema.pre('save', function(next) {
    this.updatedAt = moment.tz(new Date(), "America/Caracas").toDate();
    next();
});

const Product = mongoose.model('productos', productSchema);

module.exports = Product;