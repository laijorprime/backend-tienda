// ==============================================
// API DE TIENDA DE UTENSILIOS DE REPOSTERÍA
// ==============================================

const express = require('express');
const app = express();

// ============ CAMBIO 1: PUERTO DINÁMICO ============
// Railway asigna un puerto automáticamente, usamos process.env.PORT
const PORT = process.env.PORT || 3000;

// Middleware para procesar JSON
app.use(express.json());

// ============ CAMBIO 2: CORS MEJORADO ============
// Este middleware debe ir ANTES de las rutas
app.use((req, res, next) => {
    // Permitir cualquier origen (en producción, puedes limitarlo a tu dominio)
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    
    // Responder a las peticiones OPTIONS (pre-flight)
    if (req.method === 'OPTIONS') {
        return res.sendStatus(200);
    }
    next();
});

// ============ BASE DE DATOS SIMULADA ============
// (Más adelante la reemplazarás con MongoDB o MySQL)

const productos = [
    { 
        id: 1, 
        nombre: 'Batidora Planetaria 5L', 
        categoria: 'batidoras', 
        precio: 890.00,
        stock: 10,
        imagen: 'batidora-planetaria.jpg'
    },
    { 
        id: 2, 
        nombre: 'Set de Moldes Desmontables', 
        categoria: 'moldes', 
        precio: 120.00,
        stock: 25,
        imagen: 'moldes-desmontables.jpg'
    },
    { 
        id: 3, 
        nombre: 'Manga Pastelera + 12 Boquillas', 
        categoria: 'decoracion', 
        precio: 85.00,
        stock: 15,
        imagen: 'manga-pastelera.jpg'
    },
    { 
        id: 4, 
        nombre: 'Batidora de Mano 600W', 
        categoria: 'batidoras', 
        precio: 230.00,
        stock: 8,
        imagen: 'batidora-mano.jpg'
    }
];

let pedidos = [];
let nextPedidoId = 1;

// ============ ENDPOINTS (RUTAS) ============

// 1. Ruta principal
app.get('/', (req, res) => {
    res.send('🍰 API de Tienda de Utensilios - ReposteriaShop');
});

// 2. Obtener todos los productos
app.get('/api/productos', (req, res) => {
    res.json({
        exito: true,
        cantidad: productos.length,
        productos: productos
    });
});

// 3. Obtener un producto por ID
app.get('/api/productos/:id', (req, res) => {
    const id = parseInt(req.params.id);
    const producto = productos.find(p => p.id === id);
    
    if (!producto) {
        return res.status(404).json({
            exito: false,
            mensaje: `Producto con ID ${id} no encontrado`
        });
    }
    
    res.json({
        exito: true,
        producto: producto
    });
});

// 4. Obtener productos por categoría
app.get('/api/productos/categoria/:categoria', (req, res) => {
    const categoria = req.params.categoria;
    const filtrados = productos.filter(p => p.categoria === categoria);
    
    if (filtrados.length === 0) {
        return res.status(404).json({
            exito: false,
            mensaje: `No hay productos en la categoría "${categoria}"`
        });
    }
    
    res.json({
        exito: true,
        categoria: categoria,
        cantidad: filtrados.length,
        productos: filtrados
    });
});

// 5. Crear un nuevo producto (POST)
app.post('/api/productos', (req, res) => {
    const { nombre, categoria, precio, stock, imagen } = req.body;
    
    // Validar que todos los campos estén presentes
    if (!nombre || !categoria || !precio) {
        return res.status(400).json({
            exito: false,
            mensaje: 'Faltan campos obligatorios: nombre, categoria, precio'
        });
    }
    
    const nuevoProducto = {
        id: productos.length + 1,
        nombre,
        categoria,
        precio: parseFloat(precio),
        stock: stock || 0,
        imagen: imagen || 'default.jpg'
    };
    
    productos.push(nuevoProducto);
    
    res.status(201).json({
        exito: true,
        mensaje: 'Producto agregado exitosamente',
        producto: nuevoProducto
    });
});

// 6. Guardar un pedido
app.post('/api/pedidos', (req, res) => {
    const { cliente, productos: productosPedido, total } = req.body;
    
    if (!cliente || !productosPedido || productosPedido.length === 0) {
        return res.status(400).json({
            exito: false,
            mensaje: 'Faltan datos del pedido: cliente y productos son obligatorios'
        });
    }
    
    const nuevoPedido = {
        id: nextPedidoId++,
        cliente: cliente,
        productos: productosPedido,
        total: total || 0,
        fecha: new Date().toISOString(),
        estado: 'pendiente'
    };
    
    pedidos.push(nuevoPedido);
    
    console.log('📦 Nuevo pedido recibido:', nuevoPedido);
    
    res.status(201).json({
        exito: true,
        mensaje: 'Pedido guardado exitosamente',
        pedido: nuevoPedido
    });
});

// 7. Obtener todos los pedidos (solo para administración)
app.get('/api/pedidos', (req, res) => {
    res.json({
        exito: true,
        cantidad: pedidos.length,
        pedidos: pedidos
    });
});

// 8. Ruta para probar que todo funciona (404 - Not Found)
app.use((req, res) => {
    res.status(404).json({
        exito: false,
        mensaje: `La ruta ${req.url} no existe en esta API`
    });
});

// ============ INICIAR EL SERVIDOR ============

app.listen(PORT, () => {
    console.log('='.repeat(50));
    console.log('🍰 TIENDA DE UTENSILIOS - BACKEND');
    console.log('='.repeat(50));
    console.log(`✅ Servidor corriendo en el puerto: ${PORT}`);
    console.log(`📦 ${productos.length} productos disponibles`);
    console.log('='.repeat(50));
});