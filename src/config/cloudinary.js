const fs = require('fs');
const path = require('path');
const { v2: cloudinary } = require('cloudinary');

const isProduction = process.env.NODE_ENV === 'production';

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

function uploadToCloudinary(fileBuffer, folder = 'forum-posts') {
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        folder,
        resource_type: 'image'
      },
      (error, result) => {
        if (error) {
          reject(error);
          return;
        }
        resolve(result.secure_url);
      }
    );

    stream.end(fileBuffer);
  });
}

function uploadToLocal(fileBuffer, originalname) {
  return new Promise((resolve, reject) => {
    const uploadsDir = path.join(__dirname, '../../uploads');
    if (!fs.existsSync(uploadsDir)) {
      fs.mkdirSync(uploadsDir, { recursive: true });
    }

    const ext = path.extname(originalname) || '.jpg';
    const filename = `${Date.now()}-${Math.random().toString(36).substring(2, 15)}${ext}`;
    const filepath = path.join(uploadsDir, filename);

    fs.writeFile(filepath, fileBuffer, (error) => {
      if (error) {
        reject(error);
        return;
      }
      const baseURL = process.env.API_BASE_URL || 'http://localhost:3000';
      resolve(`${baseURL}/uploads/${filename}`);
    });
  });
}

function uploadBuffer(fileBuffer, options = {}) {
  if (isProduction) {
    return uploadToCloudinary(fileBuffer, options.folder || 'forum-posts');
  }
  return uploadToLocal(fileBuffer, options.originalname || 'image.jpg');
}

module.exports = { cloudinary, uploadBuffer };
