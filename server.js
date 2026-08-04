// ==============================================
// API DE TIENDA DE UTENSILIOS DE REPOSTERÍA
// ==============================================

const express = require('express');
const { Client } = require('pg');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const cloudinary = require('cloudinary').v2;
const { upload } = require('./config/cloudinary');
require('dotenv').config();

const app = express();

// ============ PUERTO DINÁMICO ============
const PORT = process.env.PORT || 3000;

// ============ CLAVE SECRETA PARA JWT ============
const SECRET_KEY = process.env.JWT_SECRET || 'mi_clave_secreta_para_jwt_2026';

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
        // Tabla de productos
        await client.query(`
            CREATE TABLE IF NOT EXISTS productos (
                id SERIAL PRIMARY KEY,
                nombre VARCHAR(200) NOT NULL,
                categoria VARCHAR(50) NOT NULL,
                precio DECIMAL(10,2) NOT NULL,
                stock INTEGER DEFAULT 0,
                imagen VARCHAR(500),
                descripcion TEXT,
                creado_en TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        `);
        console.log('✅ Tabla "productos" verificada');

        // Tabla de usuarios
        await client.query(`
            CREATE TABLE IF NOT EXISTS usuarios (
                id SERIAL PRIMARY KEY,
                nombre VARCHAR(100) NOT NULL,
                email VARCHAR(100) UNIQUE NOT NULL,
                password VARCHAR(255) NOT NULL,
                telefono VARCHAR(20),
                direccion TEXT,
                rol VARCHAR(20) DEFAULT 'cliente',
                creado_en TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        `);
        console.log('✅ Tabla "usuarios" verificada');

        // Tabla de pedidos (con usuario_id)
        await client.query(`
            CREATE TABLE IF NOT EXISTS pedidos (
                id SERIAL PRIMARY KEY,
                usuario_id INTEGER REFERENCES usuarios(id) ON DELETE SET NULL,
                cliente_nombre VARCHAR(100) NOT NULL,
                cliente_email VARCHAR(100) NOT NULL,
                cliente_telefono VARCHAR(20),
                total DECIMAL(10,2) NOT NULL,
                estado VARCHAR(20) DEFAULT 'pendiente',
                fecha TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        `);
        console.log('✅ Tabla "pedidos" verificada');

        // Tabla de detalles del pedido
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

        // Insertar productos de ejemplo si no hay
        const resultado = await client.query('SELECT COUNT(*) FROM productos');
        const count = parseInt(resultado.rows[0].count);
        
        if (count === 0) {
            console.log('📦 Insertando productos de ejemplo...');
            await client.query(`
                INSERT INTO productos (nombre, categoria, precio, stock, imagen, descripcion)
                VALUES 
                    ('Batidora Planetaria 5L', 'batidoras', 890.00, 10, 'https://res.cloudinary.com/demo/image/upload/v1/tienda-utensilios/batidora-planetaria.jpg', 'Ideal para masas pesadas. Incluye 3 accesorios.'),
                    ('Set de Moldes Desmontables', 'moldes', 120.00, 25, 'https://res.cloudinary.com/demo/image/upload/v1/tienda-utensilios/moldes-desmontables.jpg', 'Pack de 3 moldes de 20, 24 y 28 cm.'),
                    ('Manga Pastelera + 12 Boquillas', 'decoracion', 85.00, 15, 'https://res.cloudinary.com/demo/image/upload/v1/tienda-utensilios/manga-pastelera.jpg', 'Set completo para decoración profesional.'),
                    ('Batidora de Mano 600W', 'batidoras', 230.00, 8, 'https://res.cloudinary.com/demo/image/upload/v1/tienda-utensilios/batidora-mano.jpg', 'Turbo + 5 velocidades. Incluye batidores y gancho.')
            `);
            console.log('✅ Productos de ejemplo insertados');
        }

        // Insertar usuario administrador si no existe
        const adminCheck = await client.query('SELECT * FROM usuarios WHERE email = $1', ['admin@reposteriashop.com']);
        if (adminCheck.rows.length === 0) {
            const hashedPassword = await bcrypt.hash('admin123', 10);
            await client.query(`
                INSERT INTO usuarios (nombre, email, password, rol)
                VALUES ($1, $2, $3, $4)
            `, ['Administrador', 'admin@reposteriashop.com', hashedPassword, 'admin']);
            console.log('✅ Usuario administrador creado (admin@reposteriashop.com / admin123)');
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
        console.log(`📍 Host: ${process.env.DB_HOST || 'sakura.proxy.rlwy.net'}:${process.env.DB_PORT || 12125}`);
        await crearTablas();
    } catch (error) {
        console.error('❌ Error al conectar a PostgreSQL:', error.message);
        console.error('🔍 Detalles:', error.stack);
        process.exit(1);
    }
}

// ============ MIDDLEWARE DE AUTENTICACIÓN ============

function verificarToken(req, res, next) {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    
    if (!token) {
        return res.status(401).json({
            exito: false,
            mensaje: 'Acceso denegado. Token no proporcionado.'
        });
    }
    
    try {
        const decoded = jwt.verify(token, SECRET_KEY);
        req.usuario = decoded;
        next();
    } catch (error) {
        return res.status(403).json({
            exito: false,
            mensaje: 'Token inválido o expirado'
        });
    }
}

// ============ ENDPOINTS DE AUTENTICACIÓN ============

// 1. Registro de usuario
app.post('/api/auth/registro', async (req, res) => {
    try {
        const { nombre, email, password, telefono, direccion } = req.body;
        
        if (!nombre || !email || !password) {
            return res.status(400).json({
                exito: false,
                mensaje: 'Faltan campos obligatorios: nombre, email, password'
            });
        }
        
        const existingUser = await client.query('SELECT * FROM usuarios WHERE email = $1', [email]);
        if (existingUser.rows.length > 0) {
            return res.status(400).json({
                exito: false,
                mensaje: 'Este email ya está registrado'
            });
        }
        
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);
        
        const result = await client.query(`
            INSERT INTO usuarios (nombre, email, password, telefono, direccion)
            VALUES ($1, $2, $3, $4, $5)
            RETURNING id, nombre, email, telefono, direccion, rol, creado_en
        `, [nombre, email, hashedPassword, telefono || '', direccion || '']);
        
        const usuario = result.rows[0];
        
        const token = jwt.sign(
            { id: usuario.id, email: usuario.email, rol: usuario.rol },
            SECRET_KEY,
            { expiresIn: '7d' }
        );
        
        res.status(201).json({
            exito: true,
            mensaje: 'Usuario registrado exitosamente',
            token: token,
            usuario: {
                id: usuario.id,
                nombre: usuario.nombre,
                email: usuario.email,
                telefono: usuario.telefono,
                direccion: usuario.direccion,
                rol: usuario.rol
            }
        });
    } catch (error) {
        console.error('Error al registrar usuario:', error);
        res.status(500).json({ exito: false, mensaje: 'Error al registrar usuario' });
    }
});

// 2. Inicio de sesión
app.post('/api/auth/login', async (req, res) => {
    try {
        const { email, password } = req.body;
        
        if (!email || !password) {
            return res.status(400).json({
                exito: false,
                mensaje: 'Email y contraseña son obligatorios'
            });
        }
        
        const result = await client.query('SELECT * FROM usuarios WHERE email = $1', [email]);
        if (result.rows.length === 0) {
            return res.status(401).json({
                exito: false,
                mensaje: 'Credenciales incorrectas'
            });
        }
        
        const usuario = result.rows[0];
        
        const passwordValido = await bcrypt.compare(password, usuario.password);
        if (!passwordValido) {
            return res.status(401).json({
                exito: false,
                mensaje: 'Credenciales incorrectas'
            });
        }
        
        const token = jwt.sign(
            { id: usuario.id, email: usuario.email, rol: usuario.rol },
            SECRET_KEY,
            { expiresIn: '7d' }
        );
        
        res.json({
            exito: true,
            mensaje: 'Inicio de sesión exitoso',
            token: token,
            usuario: {
                id: usuario.id,
                nombre: usuario.nombre,
                email: usuario.email,
                telefono: usuario.telefono,
                direccion: usuario.direccion,
                rol: usuario.rol
            }
        });
    } catch (error) {
        console.error('Error al iniciar sesión:', error);
        res.status(500).json({ exito: false, mensaje: 'Error al iniciar sesión' });
    }
});

// 3. Obtener perfil del usuario (protegido)
app.get('/api/auth/perfil', verificarToken, async (req, res) => {
    try {
        const result = await client.query(
            'SELECT id, nombre, email, telefono, direccion, rol, creado_en FROM usuarios WHERE id = $1',
            [req.usuario.id]
        );
        
        if (result.rows.length === 0) {
            return res.status(404).json({ exito: false, mensaje: 'Usuario no encontrado' });
        }
        
        res.json({ exito: true, usuario: result.rows[0] });
    } catch (error) {
        console.error('Error al obtener perfil:', error);
        res.status(500).json({ exito: false, mensaje: 'Error al obtener perfil' });
    }
});

// 4. Obtener pedidos del usuario (protegido)
app.get('/api/auth/mis-pedidos', verificarToken, async (req, res) => {
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
            WHERE p.usuario_id = $1
            GROUP BY p.id
            ORDER BY p.fecha DESC
        `, [req.usuario.id]);
        
        res.json({
            exito: true,
            cantidad: result.rows.length,
            pedidos: result.rows
        });
    } catch (error) {
        console.error('Error al obtener pedidos del usuario:', error);
        res.status(500).json({ exito: false, mensaje: 'Error al obtener pedidos' });
    }
});

// ============ ENDPOINTS DE PRODUCTOS ============

// Ruta principal
app.get('/', (req, res) => {
    res.json({
        mensaje: '🍰 API de Tienda de Utensilios - ReposteriaShop',
        version: '1.0.0',
        base_datos: 'PostgreSQL en Railway',
        imagenes: 'Cloudinary'
    });
});

// Obtener todos los productos
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

// Obtener un producto por ID
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

// Obtener productos por categoría
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

// Crear un nuevo producto (POST) - Solo admin
app.post('/api/productos', verificarToken, async (req, res) => {
    try {
        if (req.usuario.rol !== 'admin') {
            return res.status(403).json({
                exito: false,
                mensaje: 'No tienes permisos para crear productos'
            });
        }
        
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

// Actualizar producto (PUT) - Solo admin
app.put('/api/productos/:id', verificarToken, async (req, res) => {
    try {
        if (req.usuario.rol !== 'admin') {
            return res.status(403).json({
                exito: false,
                mensaje: 'No tienes permisos para actualizar productos'
            });
        }
        
        const id = parseInt(req.params.id);
        const { nombre, categoria, precio, stock, imagen, descripcion } = req.body;
        
        if (!nombre || !categoria || !precio) {
            return res.status(400).json({
                exito: false,
                mensaje: 'Faltan campos obligatorios: nombre, categoria, precio'
            });
        }
        
        const result = await client.query(`
            UPDATE productos 
            SET nombre = $1, 
                categoria = $2, 
                precio = $3, 
                stock = $4, 
                imagen = $5, 
                descripcion = $6
            WHERE id = $7
            RETURNING *
        `, [nombre, categoria, precio, stock || 0, imagen || 'default.jpg', descripcion || '', id]);
        
        if (result.rows.length === 0) {
            return res.status(404).json({
                exito: false,
                mensaje: `Producto con ID ${id} no encontrado`
            });
        }
        
        res.json({
            exito: true,
            mensaje: 'Producto actualizado correctamente',
            producto: result.rows[0]
        });
    } catch (error) {
        console.error('Error al actualizar producto:', error);
        res.status(500).json({
            exito: false,
            mensaje: 'Error al actualizar producto'
        });
    }
});

// Eliminar producto (DELETE) - Solo admin
app.delete('/api/productos/:id', verificarToken, async (req, res) => {
    try {
        if (req.usuario.rol !== 'admin') {
            return res.status(403).json({
                exito: false,
                mensaje: 'No tienes permisos para eliminar productos'
            });
        }
        
        const id = parseInt(req.params.id);
        
        const checkResult = await client.query('SELECT * FROM productos WHERE id = $1', [id]);
        if (checkResult.rows.length === 0) {
            return res.status(404).json({
                exito: false,
                mensaje: `Producto con ID ${id} no encontrado`
            });
        }
        
        await client.query('DELETE FROM productos WHERE id = $1', [id]);
        
        res.json({
            exito: true,
            mensaje: 'Producto eliminado correctamente'
        });
    } catch (error) {
        console.error('Error al eliminar producto:', error);
        res.status(500).json({
            exito: false,
            mensaje: 'Error al eliminar producto'
        });
    }
});

// ============ ENDPOINTS DE IMÁGENES (Cloudinary) ============

// Subir imagen a Cloudinary
app.post('/api/upload', verificarToken, upload.single('imagen'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({
                exito: false,
                mensaje: 'No se recibió ninguna imagen'
            });
        }
        
        if (req.usuario.rol !== 'admin') {
            return res.status(403).json({
                exito: false,
                mensaje: 'No tienes permisos para subir imágenes'
            });
        }
        
        res.json({
            exito: true,
            mensaje: 'Imagen subida exitosamente',
            imagen: {
                url: req.file.path,
                public_id: req.file.filename,
                secure_url: req.file.path
            }
        });
    } catch (error) {
        console.error('Error al subir imagen:', error);
        res.status(500).json({
            exito: false,
            mensaje: 'Error al subir la imagen: ' + error.message
        });
    }
});

// Eliminar imagen de Cloudinary
app.delete('/api/upload/:public_id', verificarToken, async (req, res) => {
    try {
        const public_id = req.params.public_id;
        
        if (req.usuario.rol !== 'admin') {
            return res.status(403).json({
                exito: false,
                mensaje: 'No tienes permisos para eliminar imágenes'
            });
        }
        
        const result = await cloudinary.uploader.destroy(public_id);
        
        if (result.result === 'ok') {
            res.json({
                exito: true,
                mensaje: 'Imagen eliminada correctamente'
            });
        } else {
            res.status(404).json({
                exito: false,
                mensaje: 'Imagen no encontrada'
            });
        }
    } catch (error) {
        console.error('Error al eliminar imagen:', error);
        res.status(500).json({
            exito: false,
            mensaje: 'Error al eliminar la imagen'
        });
    }
});

// ============ ENDPOINTS DE PEDIDOS ============

// Guardar un pedido (versión pública - sin autenticación)
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

// Guardar un pedido (versión autenticada - con usuario_id)
app.post('/api/pedidos/protegido', verificarToken, async (req, res) => {
    try {
        const { productos: productosPedido, total } = req.body;
        const usuarioId = req.usuario.id;
        
        const userResult = await client.query(
            'SELECT nombre, email, telefono FROM usuarios WHERE id = $1',
            [usuarioId]
        );
        
        if (userResult.rows.length === 0) {
            return res.status(404).json({ exito: false, mensaje: 'Usuario no encontrado' });
        }
        
        const usuario = userResult.rows[0];
        
        const pedidoResult = await client.query(`
            INSERT INTO pedidos (cliente_nombre, cliente_email, cliente_telefono, total, usuario_id)
            VALUES ($1, $2, $3, $4, $5)
            RETURNING *
        `, [usuario.nombre, usuario.email, usuario.telefono, total || 0, usuarioId]);
        
        const pedido = pedidoResult.rows[0];
        
        for (const item of productosPedido) {
            await client.query(`
                INSERT INTO pedido_detalles (pedido_id, producto_id, cantidad, precio_unitario)
                VALUES ($1, $2, $3, $4)
            `, [pedido.id, item.id, item.cantidad, item.precio]);
        }
        
        console.log('📦 Nuevo pedido guardado para usuario:', usuarioId);
        
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

// Obtener todos los pedidos (solo admin)
app.get('/api/pedidos', verificarToken, async (req, res) => {
    try {
        if (req.usuario.rol !== 'admin') {
            return res.status(403).json({
                exito: false,
                mensaje: 'No tienes permisos para ver pedidos'
            });
        }
        
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

// ============ RUTA 404 ============
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
        console.log('✅ Autenticación JWT activa');
        console.log('✅ Cloudinary configurado para imágenes');
        console.log('='.repeat(50));
    });
}).catch(error => {
    console.error('❌ No se pudo iniciar el servidor:', error);
    process.exit(1);
});