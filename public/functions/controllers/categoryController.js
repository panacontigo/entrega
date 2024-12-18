const { getAllCategories } = require('../utils/categories');

exports.list = async (event) => {
    try {
        const categories = getAllCategories();
        return {
            statusCode: 200,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(categories)
        };
    } catch (error) {
        return { statusCode: 500, body: JSON.stringify({ error: error.message }) };
    }
}; 