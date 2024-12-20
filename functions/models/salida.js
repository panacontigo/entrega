const mongoose = require('mongoose');
const moment = require('moment-timezone');

// Definir el schema
const salidaSchema = new mongoose.Schema({
    id_salida: {
        type: String,
        required: true,
        unique: true,
        trim: true,
        index: true,
        default: () => `SAL-${Date.now()}`
    },
    id_producto: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'productos',  // Referencia al modelo de productos
        required: true,
        index: true
    },
    cantidad: {
        type: Number,
        required: true,
        min: [1, 'La cantidad debe ser mayor a 0']
    },
    tipo_salida: {
        type: String,
        required: true,
        enum: [
            'Venta',
            'Devolución',
            'Transferencia',
            'Ajuste de Inventario',
            'Consumo Interno',
            'Otro'
        ],
        index: true
    },
    precio_unitario: {
        type: Number,
        required: true,
        min: [0, 'El precio unitario no puede ser negativo']
    },
    precio_venta: {
        type: Number,
        required: true,
        min: [0, 'El precio de venta no puede ser negativo']
    },
    cliente: {
        type: String,
        trim: true,
        default: 'Genérico'
    },
    observaciones: {
        type: String,
        trim: true
    },
    fecha_registro: {
        type: Date,
        default: () => moment.tz(Date.now(), "America/Caracas").toDate(),
        index: true
    },
    usuario_registro: {
        type: String,
        default: 'Admin',
        required: true
    },
    precio_dolar: {
        type: Number,
        required: true,
        min: [0, 'El precio del dólar no puede ser negativo']
    },
    status: {
        type: String,
        default: 'PENDIENTE',
        enum: ['PENDIENTE', 'COMPLETADA', 'CANCELADA']
    }
}, {
    timestamps: {
        createdAt: 'createdAt',
        updatedAt: 'updatedAt'
    },
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
});

// Middleware para ajustar la zona horaria antes de guardar
salidaSchema.pre('save', function(next) {
    this.createdAt = moment.tz(this.createdAt || new Date(), "America/Caracas").toDate();
    this.updatedAt = moment.tz(new Date(), "America/Caracas").toDate();
    next();
});

// Método para obtener fechas formateadas
salidaSchema.methods.getFormattedDates = function() {
    return {
        createdAt: moment.tz(this.createdAt, "America/Caracas").format('DD/MM/YYYY'),
        updatedAt: moment.tz(this.updatedAt, "America/Caracas").format('DD/MM/YYYY')
    };
};

// Índice para búsquedas comunes
salidaSchema.index({
    id_salida: 'text',
    cliente: 'text'
});

// Virtual para calcular el valor total de la salida
salidaSchema.virtual('valor_total').get(function() {
    return this.cantidad * this.precio_unitario;
});

const Salida = mongoose.model('salidas', salidaSchema);

module.exports = Salida;