const multer = require('multer');
const path = require('path');


const storage = multer.diskStorage({
    destination: 'Uploads/', 
    filename: (req, file, cb) => {
        cb(null, Date.now() + path.extname(file.originalname)); 
    }
});


const uploads = multer({
    storage,
    limits: { fileSize: 5 * 1024 * 1024 }, 
});

module.exports = uploads;