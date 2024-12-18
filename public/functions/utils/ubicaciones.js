const ubicaciones = [
    // Estantes
    ...Array.from({ length: 12 }, (_, i) => `ESTANTE ${i + 1}`),
    // Paredes
    ...Array.from({ length: 4 }, (_, i) => `PARED ${i + 1}`),
    // Vitrinas
    ...Array.from({ length: 5 }, (_, i) => `VITRINA ${i + 1}`),

    ...Array.from({ length: 1 }, (_, i) => `TABLA ACANALADA ESCOLAR`),
    ...Array.from({ length: 1 }, (_, i) => `TABLA ACANALADA MAQUILLAJE`),
    ...Array.from({ length: 1 }, (_, i) => `BISUTERIA`),
];

// Función para obtener todas las ubicaciones
const getAllUbicaciones = () => {
    return ubicaciones;
};

// Función para validar si una ubicación existe
const isValidUbicacion = (ubicacion) => {
    return ubicaciones.includes(ubicacion);
};

module.exports = {
    ubicaciones,
    getAllUbicaciones,
    isValidUbicacion
}; 