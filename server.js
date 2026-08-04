// ==============================================
// API DE TIENDA DE UTENSILIOS DE REPOSTERÍA
// ==============================================

const express = require('express');
const { Client } = require('pg');
require('dotenv').config();

const app = express();

// ============ PUERTO DINÁMICO ============
const PORT = process.env.PORT || 3000;

// Middleware para procesar JSON
app.use(express.json());

// ============ CORS MEJORADO ============
app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    if (req.method === 'OPTIONS') {
        return res.sendStatus(200);
    }
    next();
});

// ============ CONEXIÓN A POSTGRESQL ============

const client = new Client({
    host: process.env.DB_HOST || 'sakura.proxy.rlwy.net',
    port: process.env.DB_PORT || 12125,
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || 'pMNtzvpcNHcWaVdEDEZYBkNtCYQxiPMa',
    database: process.env.DB_NAME || 'railway',
    ssl: {
        rejectUnauthorized: false
    }
});

// ============ CREAR TABLAS ============

async function crearTablas() {
    try {
        await client.query(`
            CREATE TABLE IF NOT EXISTS productos (
                id SERIAL PRIMARY KEY,
                nombre VARCHAR(200) NOT NULL,
                categoria VARCHAR(50) NOT NULL,
                precio DECIMAL(10,2) NOT NULL,
                stock INTEGER DEFAULT 0,
                imagen VARCHAR(100),
                descripcion TEXT,
                creado_en TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        `);
        console.log('✅ Tabla "productos" verificada');

        await client.query(`
            CREATE TABLE IF NOT EXISTS pedidos (
                id SERIAL PRIMARY KEY,
                cliente_nombre VARCHAR(100) NOT NULL,
                cliente_email VARCHAR(100) NOT NULL,
                cliente_telefono VARCHAR(20),
                total DECIMAL(10,2) NOT NULL,
                estado VARCHAR(20) DEFAULT 'pendiente',
                fecha TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        `);
        console.log('✅ Tabla "pedidos" verificada');

        await client.query(`
            CREATE TABLE IF NOT EXISTS pedido_detalles (
                id SERIAL PRIMARY KEY,
                pedido_id INTEGER REFERENCES pedidos(id) ON DELETE CASCADE,
                producto_id INTEGER REFERENCES productos(id),
                cantidad INTEGER NOT NULL,
                precio_unitario DECIMAL(10,2) NOT NULL
            );
        `);
        console.log('✅ Tabla "pedido_detalles" verificada');

        const resultado = await client.query('SELECT COUNT(*) FROM productos');
        const count = parseInt(resultado.rows[0].count);
        
        if (count === 0) {
            console.log('📦 Insertando productos de ejemplo...');
            await client.query(`
                INSERT INTO productos (nombre, categoria, precio, stock, imagen, descripcion)
                VALUES 
                    ('Batidora Planetaria 5L', 'batidoras', 890.00, 10, 'batidora-planetaria.jpg', 'Ideal para masas pesadas. Incluye 3 accesorios.'),
                    ('Set de Moldes Desmontables', 'moldes', 120.00, 25, 'moldes-desmontables.jpg', 'Pack de 3 moldes de 20, 24 y 28 cm.'),
                    ('Manga Pastelera + 12 Boquillas', 'decoracion', 85.00, 15, 'manga-pastelera.jpg', 'Set completo para decoración profesional.'),
                    ('Batidora de Mano 600W', 'batidoras', 230.00, 8, 'batidora-mano.jpg', 'Turbo + 5 velocidades. Incluye batidores y gancho.')
            `);
            console.log('✅ Productos de ejemplo insertados');
        }

    } catch (error) {
        console.error('❌ Error al crear tablas:', error.message);
    }
}

// ============ CONECTAR A LA BASE DE DATOS ============

async function conectarDB() {
    try {
        await client.connect();
        console.log('✅ Conectado a PostgreSQL en Railway');
        
        // Mostrar información de conexión (versión corregida)
console.log(`📍 Host: ${process.env.DB_HOST || 'sakura.proxy.rlwy.net'}:${process.env.DB_PORT || 12125}`);
        
        await crearTablas();
    } catch (error) {
        console.error('❌ Error al conectar a PostgreSQL:', error.message);
        console.error('🔍 Detalles:', error.stack);
        process.exit(1);
    }
}

// ============ ENDPOINTS (RUTAS) ============

app.get('/', (req, res) => {
    res.json({
        mensaje: '🍰 API de Tienda de Utensilios - ReposteriaShop',
        version: '1.0.0',
        base_datos: 'PostgreSQL en Railway'
    });
});

app.get('/api/productos', async (req, res) => {
    try {
        const result = await client.query('SELECT * FROM productos ORDER BY id');
        res.json({
            exito: true,
            cantidad: result.rows.length,
            productos: result.rows
        });
    } catch (error) {
        console.error('Error al obtener productos:', error);
        res.status(500).json({ exito: false, mensaje: 'Error al obtener productos' });
    }
});

app.get('/api/productos/:id', async (req, res) => {
    try {
        const id = parseInt(req.params.id);
        const result = await client.query('SELECT * FROM productos WHERE id = $1', [id]);
        
        if (result.rows.length === 0) {
            return res.status(404).json({ exito: false, mensaje: `Producto con ID ${id} no encontrado` });
        }
        
        res.json({ exito: true, producto: result.rows[0] });
    } catch (error) {
        console.error('Error al obtener producto:', error);
        res.status(500).json({ exito: false, mensaje: 'Error al obtener producto' });
    }
});

app.get('/api/productos/categoria/:categoria', async (req, res) => {
    try {
        const categoria = req.params.categoria;
        const result = await client.query(
            'SELECT * FROM productos WHERE categoria = $1 ORDER BY id',
            [categoria]
        );
        
        if (result.rows.length === 0) {
            return res.status(404).json({
                exito: false,
                mensaje: `No hay productos en la categoría "${categoria}"`
            });
        }
        
        res.json({
            exito: true,
            categoria: categoria,
            cantidad: result.rows.length,
            productos: result.rows
        });
    } catch (error) {
        console.error('Error al obtener productos por categoría:', error);
        res.status(500).json({ exito: false, mensaje: 'Error al obtener productos' });
    }
});

app.post('/api/productos', async (req, res) => {
    try {
        const { nombre, categoria, precio, stock, imagen, descripcion } = req.body;
        
        if (!nombre || !categoria || !precio) {
            return res.status(400).json({
                exito: false,
                mensaje: 'Faltan campos obligatorios: nombre, categoria, precio'
            });
        }
        
        const result = await client.query(`
            INSERT INTO productos (nombre, categoria, precio, stock, imagen, descripcion)
            VALUES ($1, $2, $3, $4, $5, $6)
            RETURNING *
        `, [nombre, categoria, precio, stock || 0, imagen || 'default.jpg', descripcion || '']);
        
        res.status(201).json({
            exito: true,
            mensaje: 'Producto agregado exitosamente',
            producto: result.rows[0]
        });
    } catch (error) {
        console.error('Error al crear producto:', error);
        res.status(500).json({ exito: false, mensaje: 'Error al crear producto' });
    }
});

app.post('/api/pedidos', async (req, res) => {
    try {
        const { cliente, productos: productosPedido, total } = req.body;
        
        if (!cliente || !productosPedido || productosPedido.length === 0) {
            return res.status(400).json({
                exito: false,
                mensaje: 'Faltan datos del pedido: cliente y productos son obligatorios'
            });
        }
        
        const pedidoResult = await client.query(`
            INSERT INTO pedidos (cliente_nombre, cliente_email, cliente_telefono, total)
            VALUES ($1, $2, $3, $4)
            RETURNING *
        `, [cliente.nombre, cliente.email, cliente.telefono, total || 0]);
        
        const pedido = pedidoResult.rows[0];
        
        for (const item of productosPedido) {
            await client.query(`
                INSERT INTO pedido_detalles (pedido_id, producto_id, cantidad, precio_unitario)
                VALUES ($1, $2, $3, $4)
            `, [pedido.id, item.id, item.cantidad, item.precio]);
        }
        
        console.log('📦 Nuevo pedido guardado en BD:', pedido);
        
        res.status(201).json({
            exito: true,
            mensaje: 'Pedido guardado exitosamente',
            pedido: pedido
        });
    } catch (error) {
        console.error('Error al guardar pedido:', error);
        res.status(500).json({ exito: false, mensaje: 'Error al guardar pedido' });
    }
});

app.get('/api/pedidos', async (req, res) => {
    try {
        const result = await client.query(`
            SELECT p.*, 
                   COALESCE(json_agg(
                       json_build_object(
                           'producto_id', pd.producto_id,
                           'cantidad', pd.cantidad,
                           'precio_unitario', pd.precio_unitario
                       )
                   ) FILTER (WHERE pd.producto_id IS NOT NULL), '[]') as detalles
            FROM pedidos p
            LEFT JOIN pedido_detalles pd ON p.id = pd.pedido_id
            GROUP BY p.id
            ORDER BY p.fecha DESC
        `);
        
        res.json({
            exito: true,
            cantidad: result.rows.length,
            pedidos: result.rows
        });
    } catch (error) {
        console.error('Error al obtener pedidos:', error);
        res.status(500).json({ exito: false, mensaje: 'Error al obtener pedidos' });
    }
});

app.use((req, res) => {
    res.status(404).json({
        exito: false,
        mensaje: `La ruta ${req.url} no existe en esta API`
    });
});

// ============ INICIAR EL SERVIDOR ============

conectarDB().then(() => {
    app.listen(PORT, () => {
        console.log('='.repeat(50));
        console.log('🍰 TIENDA DE UTENSILIOS - BACKEND');
        console.log('='.repeat(50));
        console.log(`✅ Servidor corriendo en puerto: ${PORT}`);
        console.log('✅ PostgreSQL conectado');
        console.log('='.repeat(50));
    });
}).catch(error => {
    console.error('❌ No se pudo iniciar el servidor:', error);
    process.exit(1);
});