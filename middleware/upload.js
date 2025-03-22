
const multer = require('multer');
const path = require('path');
const fs = require('fs-extra');

// Configure storage for videos
const videoStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path.join(__dirname, '../uploads/videos');
    fs.ensureDirSync(uploadDir);
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const ext = path.extname(file.originalname);
    cb(null, uniqueSuffix + ext);
  }
});

// Configure storage for thumbnails
const thumbnailStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path.join(__dirname, '../uploads/thumbnails');
    fs.ensureDirSync(uploadDir);
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const ext = path.extname(file.originalname);
    cb(null, uniqueSuffix + ext);
  }
});

// Configure storage for avatars
const avatarStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path.join(__dirname, '../uploads/avatars');
    fs.ensureDirSync(uploadDir);
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const ext = path.extname(file.originalname);
    cb(null, uniqueSuffix + ext);
  }
});

// File filter for videos
const videoFilter = (req, file, cb) => {
  const allowedTypes = [
    'video/mp4', 
    'video/webm', 
    'video/ogg', 
    'video/quicktime'
  ];
  
  if (allowedTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Invalid file type. Only video files are allowed.'), false);
  }
};

// File filter for images (thumbnails and avatars)
const imageFilter = (req, file, cb) => {
  const allowedTypes = [
    'image/jpeg', 
    'image/png', 
    'image/gif', 
    'image/webp'
  ];
  
  if (allowedTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Invalid file type. Only image files are allowed.'), false);
  }
};

// Create multer upload instances
const uploadVideo = multer({
  storage: videoStorage,
  fileFilter: videoFilter,
  limits: { fileSize: 1024 * 1024 * 500 } // 500MB limit
});

const uploadThumbnail = multer({
  storage: thumbnailStorage,
  fileFilter: imageFilter,
  limits: { fileSize: 1024 * 1024 * 5 } // 5MB limit
});

const uploadAvatar = multer({
  storage: avatarStorage,
  fileFilter: imageFilter,
  limits: { fileSize: 1024 * 1024 * 2 } // 2MB limit
});

// Combined upload for video upload endpoint
const uploadVideoWithThumbnail = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => {
      let uploadDir;
      
      if (file.fieldname === 'video') {
        uploadDir = path.join(__dirname, '../uploads/videos');
      } else if (file.fieldname === 'thumbnail') {
        uploadDir = path.join(__dirname, '../uploads/thumbnails');
      }
      
      fs.ensureDirSync(uploadDir);
      cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
      const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
      const ext = path.extname(file.originalname);
      cb(null, uniqueSuffix + ext);
    }
  }),
  fileFilter: (req, file, cb) => {
    if (file.fieldname === 'video') {
      videoFilter(req, file, cb);
    } else if (file.fieldname === 'thumbnail') {
      imageFilter(req, file, cb);
    } else {
      cb(new Error('Unexpected field'), false);
    }
  },
  limits: {
    fileSize: file => {
      if (file.fieldname === 'video') {
        return 1024 * 1024 * 500; // 500MB for videos
      }
      return 1024 * 1024 * 5; // 5MB for thumbnails
    }
  }
});

// Handle multer errors
const handleUploadError = (err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({ message: 'File is too large' });
    }
    return res.status(400).json({ message: err.message });
  } else if (err) {
    return res.status(400).json({ message: err.message });
  }
  next();
};

module.exports = {
  uploadVideo,
  uploadThumbnail,
  uploadAvatar,
  uploadVideoWithThumbnail: uploadVideoWithThumbnail.fields([
    { name: 'video', maxCount: 1 },
    { name: 'thumbnail', maxCount: 1 }
  ]),
  handleUploadError
};
