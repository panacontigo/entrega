const mongoose = require('mongoose');

const salidaSchema = new mongoose.Schema({
    id_salida: {
        type: String,
        required: true,
        unique: true,
        trim: true,
        index: true,
        default: () => `SAL-${Date.now()}`  // Genera un ID único basado en timestamp
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
            'Ajuste de Inventario',
            'Otro',
            'Desincorporación',
            'Cambio'
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
        default: Date.now,
        index: true
    },
    usuario_registro: {
        type: String,
        default: 'Admin',
        required: true
    },
    precio_dolar: {  // Nuevo campo para el precio del dólar
        type: Number,
        required: true,
        min: [0, 'El precio del dólar no puede ser negativo']
    }
}, {
    timestamps: true,  // Añade createdAt y updatedAt automáticamente
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
});

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