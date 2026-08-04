const cloudinary = require('cloudinary').v2;
const { CloudinaryStorage } = require('multer-storage-cloudinary');
const multer = require('multer');

cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME || 'n2yokjfa',
    api_key: process.env.CLOUDINARY_API_KEY || '993316894177997',
    api_secret: process.env.CLOUDINARY_API_SECRET || 'oXyq4WUersym4TXuZ4cKEB7b0NM'
});

const storage = new CloudinaryStorage({
    cloudinary: cloudinary,
    params: {
        folder: 'tienda-utensilios',
        allowed_formats: ['jpg', 'jpeg', 'png', 'webp', 'gif'],
        transformation: [
            { width: 500, height: 500, crop: 'limit' },
            { quality: 'auto' }
        ]
    }
});

const upload = multer({ 
    storage: storage,
    limits: { fileSize: 5 * 1024 * 1024 }
});

module.exports = { cloudinary, upload };