class AjaxHandler {
    constructor(containerId) {
        this.containerId = containerId;
        this.container = document.getElementById(containerId);
    }

    // Cargar lista de elementos
    async loadList(endpoint, page = 1, limit = 10) {
        try {
            const response = await fetch(`${endpoint}?page=${page}&limit=${limit}`);
            const html = await response.text();
            this.container.innerHTML = html;
        } catch (error) {
            console.error('Error cargando lista:', error);
            this.showError('Error al cargar la lista de elementos');
        }
    }

    // Cargar formulario
    async loadForm(endpoint) {
        try {
            const response = await fetch(endpoint);
            const html = await response.text();
            this.container.innerHTML = html;
        } catch (error) {
            console.error('Error cargando formulario:', error);
            this.showError('Error al cargar el formulario');
        }
    }

    // Manejar envío de formularios (crear/actualizar)
    async handleSubmit(event, endpoint, method = 'POST') {
        event.preventDefault();

        try {
            const formData = new FormData(event.target);
            const data = Object.fromEntries(formData.entries());

            console.log('Enviando datos:', data); // Para debugging

            const response = await fetch(endpoint, {
                method: method,
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(data)
            });

            const result = await response.json();

            if (!response.ok) {
                throw new Error(result.error || 'Error en la operación');
            }

            this.showSuccess(result.message);
            return result;
        } catch (error) {
            console.error('Error en operación:', error);
            this.showError('Error en la operación: ' + (error.message || 'Error desconocido'));
            throw error;
        }
    }

    // Ver detalles de un elemento
    async viewDetails(endpoint) {
        try {
            const response = await fetch(endpoint);
            const data = await response.json();
            this.showInfo(JSON.stringify(data, null, 2));
        } catch (error) {
            console.error('Error al ver detalles:', error);
            this.showError('Error al ver detalles');
        }
    }

    // Eliminar un elemento
    async deleteItem(endpoint, confirmMessage = '¿Estás seguro de que deseas eliminar este elemento?') {
        if (confirm(confirmMessage)) {
            try {
                const response = await fetch(endpoint, {
                    method: 'DELETE',
                    headers: {
                        'Content-Type': 'application/json'
                    }
                });

                if (response.ok) {
                    const result = await response.json();
                    this.showSuccess(result.message);
                    return result;
                } else {
                    const error = await response.json();
                    throw new Error(error.message);
                }
            } catch (error) {
                console.error('Error al eliminar:', error);
                this.showError('Error al eliminar: ' + error.message);
                throw error;
            }
        }
    }
    async  mostrarDialogoFecha() {
        const { value: fecha } = await Swal.fire({
            title: 'Selecciona una fecha',
            input: 'date', // Tipo de entrada para fecha
            inputAttributes: {
                'aria-label': 'Selecciona una fecha'
            },
            showCancelButton: true,
            confirmButtonText: 'Exportar',
            cancelButtonText: 'Cancelar',
            inputValidator: (value) => {
                if (!value) {
                    return '¡Debes seleccionar una fecha!';
                }
            }
        });
    
        return fecha;
    }
    // Función para mostrar mensajes de éxito
    showSuccess(message) {
        Swal.fire({
            icon: 'success',
            title: '¡Éxito!',
            text: message,
            timer: 2000,
            showConfirmButton: false
        });
    }

    // Función para mostrar errores
    showError(message) {
        Swal.fire({
            icon: 'error',
            title: 'Error',
            text: message,
            confirmButtonText: 'Entendido'
        });
    }

    // Función para mostrar confirmaciones
    async showConfirm(title, text) {
        const result = await Swal.fire({
            icon: 'warning',
            title: title,
            text: text,
            showCancelButton: true,
            confirmButtonText: 'Sí, continuar',
            cancelButtonText: 'Cancelar',
            confirmButtonColor: '#3085d6',
            cancelButtonColor: '#d33'
        });
        return result.isConfirmed;
    }

    // Función para mostrar carga
    showLoading(message = 'Procesando...') {
        Swal.fire({
            title: message,
            allowOutsideClick: false,
            showConfirmButton: false,
            willOpen: () => {
                Swal.showLoading();
            }
        });
    }

    showInfo(message) {
        alert(message);
    }
} 