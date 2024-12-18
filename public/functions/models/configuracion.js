const mongoose = require('mongoose');

const configuracionSchema = new mongoose.Schema({
    precio_dolar: {
        type: Number,
        required: false
    },
    fecha_act_dolar: {
        type: Date,
        required: false
    }
});

// Asegurarse de que solo haya un documento en la colección
configuracionSchema.index({ unique: true });

const Configuracion = mongoose.model('configuracion', configuracionSchema);

module.exports = Configuracion; 