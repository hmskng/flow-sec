import express from 'express';
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import cors from 'cors';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import User from './models/User.js';
import bcrypt from 'bcryptjs';
import Chat from './models/Chat.js';
import Message from './models/Message.js';
import VaultFile from './models/VaultFile.js';
import VaultLink from './models/VaultLink.js';
import FileModel from './models/File.js';
import KeyModel from './models/Key.js';
import FriendModel from './models/Friend.js';
import SecurityScanner from './SecurityScanner.js';
import BackupModel from './models/Backup.js';

// Load env variables
dotenv.config();

// Configure allowed origins for CORS. Can be a single URL or comma-separated list.
// Examples:
// FRONTEND_URL=https://flowsec-1-y6q0.onrender.com
// ALLOWED_ORIGINS=https://a.example.com,https://b.example.com
const allowedOriginsRaw = process.env.ALLOWED_ORIGINS || process.env.FRONTEND_URL || '';
const allowedOrigins = allowedOriginsRaw.split(',').map(s => s.trim()).filter(Boolean);

// Initialize Security Scanner
const securityScanner = new SecurityScanner(process.env.VIRUSTOTAL_API_KEY);

const app = express();
app.use(express.json({ limit: '10mb' }));

// Dynamic CORS configuration: allow requests from origins listed in ALLOWED_ORIGINS or FRONTEND_URL.
// If none configured, fall back to allowing all origins (useful for local/testing).
const corsOptions = {
    origin: (origin, callback) => {
        // Allow non-browser requests like curl or server-side calls when origin is undefined
        if (!origin) return callback(null, true);
        if (allowedOrigins.length === 0) return callback(null, true);
        if (allowedOrigins.includes(origin)) return callback(null, true);
        return callback(new Error('CORS: Origin not allowed'));
    },
    credentials: true,
    methods: ['GET', 'HEAD', 'PUT', 'PATCH', 'POST', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept']
};

app.use((req, res, next) => {
    // Set a permissive Access-Control-Allow-Origin header when no allowed origins are configured
    const origin = req.get('Origin');
    if (allowedOrigins.length === 0) {
        res.setHeader('Access-Control-Allow-Origin', '*');
    } else if (origin && allowedOrigins.includes(origin)) {
        res.setHeader('Access-Control-Allow-Origin', origin);
    }
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Access-Control-Allow-Methods', 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
    // For preflight requests, immediately respond
    if (req.method === 'OPTIONS') return res.sendStatus(204);
    next();
});

app.use(cors(corsOptions));

// Request logging middleware
app.use((req, res, next) => {
    console.log(`${new Date().toISOString()} ${req.method} ${req.path}`);
    next();
});

app.use('/uploads', express.static(path.join(process.cwd(), 'uploads')));

// Multer setup for file uploads
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const uploadsDir = path.join(process.cwd(), 'uploads');
        // Ensure uploads directory exists
        if (!fs.existsSync(uploadsDir)) {
            fs.mkdirSync(uploadsDir, { recursive: true });
        }
        cb(null, uploadsDir);
    },
    filename: (req, file, cb) => {
        const unique = Date.now() + '-' + Math.round(Math.random() * 1e9);
        cb(null, unique + '-' + file.originalname);
    }
});
const upload = multer({ storage });

// MongoDB connection
mongoose.connect(process.env.MONGODB_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true
}).then(() => console.log('MongoDB connected'))
  .catch(err => console.error('MongoDB error:', err));

// NOTE: OTP/email-based signup/login removed. Authentication now uses email + password only.

// Login endpoint (email + password)
app.post('/api/login', async (req, res) => {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ message: 'Email and password required' });
    try {
        const user = await User.findOne({ email });
        if (!user || !user.passwordHash) return res.status(400).json({ message: 'Invalid credentials' });
        const match = await bcrypt.compare(password, user.passwordHash);
        if (!match) return res.status(400).json({ message: 'Invalid credentials' });
        // Sanitize user before returning to client
        const safeUser = {
            _id: user._id,
            email: user.email,
            username: user.username,
            profileIcon: user.profileIcon,
            publicKey: user.publicKey
        };
        res.json({ message: 'Login successful', user: safeUser });
    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ message: 'Login failed' });
    }
});

// Register endpoint (signup with password and file upload)
app.post('/api/register', upload.single('icon'), async (req, res) => {
    const { email, username, publicKey, password } = req.body;
    if (!email || !username || !password) return res.status(400).json({ message: 'Email, username, and password required' });

    try {
        // Check if user already exists
        let user = await User.findOne({ $or: [ { email }, { username } ] });
        if (user) {
            if (user.email === email) {
                return res.status(400).json({ message: 'An account with this email already exists. Please use the login option.' });
            } else {
                return res.status(400).json({ message: 'Username already taken. Please choose a different username.' });
            }
        }

        // Handle profile icon upload
        let profileIcon = null;
        if (req.file) {
            profileIcon = req.file.filename; // Store the filename
        }

        // Create user with optional publicKey and required password
        const userData = { email, username, profileIcon };
        if (publicKey) {
            userData.publicKey = publicKey;
        }
        const salt = await bcrypt.genSalt(10);
        userData.passwordHash = await bcrypt.hash(password, salt);

        user = await User.create(userData);

        const safeUser = {
            _id: user._id,
            email: user.email,
            username: user.username,
            profileIcon: user.profileIcon,
            publicKey: user.publicKey
        };
        res.json({ user: safeUser, message: 'Account created successfully' });
    } catch (error) {
        console.error('Registration error:', error);

        // Handle MongoDB duplicate key errors
        if (error.code === 11000) {
            if (error.keyValue && error.keyValue.email) {
                return res.status(400).json({ message: 'An account with this email already exists. Please use the login option.' });
            } else if (error.keyValue && error.keyValue.username) {
                return res.status(400).json({ message: 'Username already taken. Please choose a different username.' });
            }
        }

        res.status(500).json({ message: 'Registration failed. Please try again.' });
    }
});


// --- Vault Security API ---

// Get all vault files for user
app.get('/api/vault/files', async (req, res) => {
    try {
        const { userId } = req.query;
        if (!userId) return res.status(400).json({ message: 'User ID required' });
        
        const files = await VaultFile.findByUser(userId);
        res.json({ files });
    } catch (error) {
        res.status(500).json({ message: 'Error fetching vault files', error: error.message });
    }
});

// Get all vault links for user
app.get('/api/vault/links', async (req, res) => {
    try {
        const { userId } = req.query;
        if (!userId) return res.status(400).json({ message: 'User ID required' });
        
        const links = await VaultLink.findByUser(userId);
        res.json({ links });
    } catch (error) {
        res.status(500).json({ message: 'Error fetching vault links', error: error.message });
    }
});

// Get vault statistics
app.get('/api/vault/stats', async (req, res) => {
    try {
        const { userId } = req.query;
        if (!userId) return res.status(400).json({ message: 'User ID required' });
        
        const [fileStats, linkStats] = await Promise.all([
            VaultFile.getStats(userId),
            VaultLink.getStats(userId)
        ]);
        
        res.json({ 
            files: fileStats,
            links: linkStats
        });
    } catch (error) {
        res.status(500).json({ message: 'Error fetching vault stats', error: error.message });
    }
});

// Scan file endpoint
app.post('/api/vault/scan-file', async (req, res) => {
    try {
        const { fileId } = req.body;
        if (!fileId) return res.status(400).json({ message: 'File ID required' });
        
        const vaultFile = await VaultFile.findById(fileId);
        if (!vaultFile) return res.status(404).json({ message: 'File not found' });
        
        // Update status to scanning
        vaultFile.scanStatus = 'scanning';
        await vaultFile.save();
        
        // Perform scan
        const filePath = path.join(process.cwd(), 'uploads', vaultFile.filename);
        const scanResult = await securityScanner.scanFile(filePath);
        
        // Update with results
        await vaultFile.updateScanResults(scanResult);
        
        res.json({ message: 'File scanned successfully', result: scanResult });
    } catch (error) {
        res.status(500).json({ message: 'Error scanning file', error: error.message });
    }
});

// Accept encrypted JSON uploads (encryptedData base64 + encryptedKey)
app.post('/api/vault/upload-json', async (req, res) => {
    try {
        const { userId, chatId, sender, recipient, originalName, mimeType, encryptedData, encryptedKey } = req.body;
        if (!userId || !chatId || !sender || !recipient || !originalName || !encryptedData || !encryptedKey) {
            return res.status(400).json({ message: 'Missing required fields' });
        }

        // Ensure uploads dir exists
        const uploadsDir = path.join(process.cwd(), 'uploads');
        if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });

        // Save encryptedData to a file
        const buffer = Buffer.from(encryptedData, 'base64');
        const filename = `${Date.now()}-${Math.round(Math.random()*1e9)}-${originalName}.enc`;
        const filePath = path.join(uploadsDir, filename);
        fs.writeFileSync(filePath, buffer);

        // Calculate hash for scanning
        const fileHash = await securityScanner.calculateFileHash(filePath);

        // Create VaultFile document
        const vaultFile = await VaultFile.create({
            userId: sender,
            fileName: filename,
            originalPath: filePath,
            fileHash,
            fileSize: buffer.length,
            mimeType: mimeType || 'application/octet-stream',
            recipient: recipient || 'unknown',
            chatId,
            scanStatus: 'pending',
            encryptedDataPath: filename,
            encryptedKey
        });

        // Start background scan
        securityScanner.scanFile(filePath)
            .then(scanResult => vaultFile.updateScanResults(scanResult))
            .catch(err => {
                console.error('Background scan failed for upload-json:', err);
                vaultFile.scanStatus = 'error';
                vaultFile.save();
            });

        res.json({ message: 'Upload accepted', vaultFile });
    } catch (error) {
        console.error('upload-json error:', error);
        res.status(500).json({ message: 'Upload failed', error: error.message });
    }
});

// Scan URL endpoint
app.post('/api/vault/scan-url', async (req, res) => {
    try {
        const { url, userId, recipient, chatId } = req.body;
        if (!url || !userId) return res.status(400).json({ message: 'URL and user ID required' });
        
        // Create vault link entry
        const urlHash = await securityScanner.calculateHash(url);
        const domain = new URL(url).hostname;
        
        const vaultLink = await VaultLink.create({
            userId,
            url,
            urlHash,
            domain,
            recipient: recipient || 'unknown',
            chatId: chatId || 'unknown',
            scanStatus: 'scanning'
        });
        
        // Perform scan
        const scanResult = await securityScanner.scanURL(url);
        
        // Update with results
        await vaultLink.updateScanResults(scanResult);
        
        res.json({ message: 'URL scanned successfully', result: scanResult });
    } catch (error) {
        res.status(500).json({ message: 'Error scanning URL', error: error.message });
    }
});

// Quarantine file
app.post('/api/vault/quarantine', async (req, res) => {
    try {
        const { fileId } = req.body;
        if (!fileId) return res.status(400).json({ message: 'File ID required' });
        
        const vaultFile = await VaultFile.findById(fileId);
        if (!vaultFile) return res.status(404).json({ message: 'File not found' });
        
        await vaultFile.quarantine();
        
        res.json({ message: 'File quarantined successfully' });
    } catch (error) {
        res.status(500).json({ message: 'Error quarantining file', error: error.message });
    }
});

// Block domain
app.post('/api/vault/block-domain', async (req, res) => {
    try {
        const { linkId } = req.body;
        if (!linkId) return res.status(400).json({ message: 'Link ID required' });
        
        const vaultLink = await VaultLink.findById(linkId);
        if (!vaultLink) return res.status(404).json({ message: 'Link not found' });
        
        await vaultLink.blockDomain();
        
        res.json({ message: 'Domain blocked successfully' });
    } catch (error) {
        res.status(500).json({ message: 'Error blocking domain', error: error.message });
    }
});


// --- Encrypted File Transfer API ---

// Get user's public key for encryption
app.get('/api/public-key', async (req, res) => {
    const { email } = req.query;
    if (!email) return res.status(400).json({ message: 'Email required.' });
    const user = await User.findOne({ email });
    if (!user || !user.publicKey) return res.status(404).json({ message: 'Public key not found.' });
    res.json({ publicKey: user.publicKey });
});

// Add or search friends
app.post('/api/friends', async (req, res) => {
    try {
        const { userId, friendId } = req.body;
        if (!userId || !friendId) {
            return res.status(400).json({ message: 'Both userId and friendId are required' });
        }

        const [user, friend] = await Promise.all([
            User.findById(userId),
            User.findById(friendId)
        ]);

        if (!user || !friend) {
            return res.status(404).json({ message: 'User or friend not found' });
        }

        const existingFriendship = await FriendModel.findOne({
            $or: [
                { userId, friendId },
                { userId: friendId, friendId: userId }
            ]
        });

        if (existingFriendship) {
            if (existingFriendship.status === 'pending') {
                existingFriendship.status = 'accepted';
                await existingFriendship.save();
                return res.json({ success: true, message: 'Friend request accepted.' });
            }
            return res.status(400).json({ message: 'Friendship already exists' });
        }

        await FriendModel.create({ userId, friendId, status: 'accepted' });

        res.json({ success: true, message: 'Friend added successfully' });
    } catch (error) {
        console.error('Add friend error:', error);
        res.status(500).json({ success: false, message: 'Failed to add friend' });
    }
});

// Get user's friends list
app.get('/api/friends', async (req, res) => {
    try {
        const { email } = req.query;
        if (!email) return res.status(400).json({ message: 'Email required.' });
        
        const user = await User.findOne({email});
        if (!user) return res.status(404).json({message: "User not found"});

        const friendships = await FriendModel.find({
            $or: [{ userId: user._id }, { friendId: user._id }]
        }).populate('userId').populate('friendId');

        const friends = friendships.map(friendship => {
            if (friendship.userId._id.toString() === user._id.toString()) {
                return friendship.friendId;
            } else {
                return friendship.userId;
            }
        });

        res.json({ friends });
    } catch (error) {
        console.error('Error fetching friends:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

// Search users for adding as friends
app.get('/api/search-users', async (req, res) => {
    try {
        const { query } = req.query;
        if (!query) return res.json({ users: [] });

        const users = await User.find({
            $or: [
                { username: { $regex: query, $options: 'i' } },
                { email: { $regex: query, $options: 'i' } }
            ]
        }).select('username email profileIcon _id');

        res.json({ users });
    } catch (error) {
        console.error('Error searching users:', error);
        res.status(500).json({ message: 'Error searching users' });
    }
});

// Share encrypted file with friend
app.post('/api/share-file', upload.single('file'), async (req, res) => {
    const { email, friend, iv, encryptedAesKey } = req.body;
    console.log('Received share-file request:');
    console.log('  req.file:', req.file ? 'Received' : 'Missing');
    console.log('  email:', email);
    console.log('  friend:', friend);
    console.log('  iv:', iv ? 'Received' : 'Missing');
    console.log('  encryptedAesKey:', encryptedAesKey ? 'Received' : 'Missing');

    if (!req.file || !email || !friend || !iv || !encryptedAesKey) {
        console.error('Missing data in share-file request. Sending 400.');
        return res.status(400).json({ success: false, message: 'Missing data.' });
    }
    try {
        const fileDoc = await FileModel.create({
            userEmail: email,
            originalName: req.file.originalname,
            storedName: req.file.filename,
            size: req.file.size,
            mimetype: req.file.mimetype,
            path: req.file.path,
        });
        await KeyModel.create({
            fileId: fileDoc._id,
            ownerEmail: friend,
            encryptedAESKey: encryptedAesKey,
            iv: iv,
            encryptedFor: friend
        });
        res.json({ success: true, file: fileDoc });
    } catch (err) {
        console.error('Error in /api/share-file:', err);
        res.status(500).json({ success: false, message: 'Error sharing file.' });
    }
});

// Get shared files for user
app.get('/api/shared-files', async (req, res) => {
    const { email } = req.query;
    if (!email) return res.status(400).json({ files: [], message: 'Email required.' });
    try {
        const keys = await KeyModel.find({ ownerEmail: email }).populate('fileId');
        const files = keys.map(k => ({
            _id: k.fileId._id,
            storedName: k.fileId.storedName,
            originalName: k.fileId.originalName,
            size: k.fileId.size,
            mimetype: k.fileId.mimetype,
            uploadedAt: k.fileId.uploadedAt,
            sharedWith: k.encryptedFor,
            encryptedAESKey: k.encryptedAESKey,
            iv: k.iv
        }));
        res.json({ files });
    } catch (error) {
        console.error('Error fetching shared files:', error);
        res.status(500).json({ files: [], message: 'Error fetching files.' });
    }
});

// Upload file (for personal storage)
app.post('/api/upload', upload.single('file'), async (req, res) => {
    if (!req.file) {
        return res.status(400).json({ success: false, message: 'No file uploaded.' });
    }
    try {
        const fileDoc = await FileModel.create({
            userEmail: req.body.email,
            originalName: req.file.originalname,
            storedName: req.file.filename,
            size: req.file.size,
            mimetype: req.file.mimetype,
            path: req.file.path,
        });
        res.json({ success: true, filename: req.file.filename, message: 'File uploaded.', file: fileDoc });
    } catch (err) {
        res.status(500).json({ success: false, message: 'Error saving file metadata.' });
    }
});

// List user's files
app.get('/api/list-files', async (req, res) => {
    const { email } = req.query;
    if (!email) return res.status(400).json({ files: [], message: 'Email required.' });
    try {
        const files = await FileModel.find({ userEmail: email }).sort({ uploadedAt: -1 });
        res.json({ files });
    } catch (err) {
        res.status(500).json({ files: [], message: 'Error reading files.' });
    }
});

// Download file by filename
app.get('/api/files/:filename', (req, res) => {
    const filePath = path.join(process.cwd(), 'uploads', req.params.filename);
    if (!fs.existsSync(filePath)) return res.status(404).send('File not found');
    res.download(filePath);
});

// --- Messenger API ---



// Create user (signup)
app.post('/api/user', async (req, res) => {
    const { email, username, profileIcon } = req.body;
    if (!email || !username) return res.status(400).json({ message: 'Email and username required' });
    let user = await User.findOne({ $or: [ { email }, { username } ] });
    if (user) return res.status(400).json({ message: 'Email or username already exists' });
    user = await User.create({ email, username, profileIcon });
    res.json({ user });
});

// Get user by email with stats
app.get('/api/user', async (req, res) => {
    try {
        const { email } = req.query;
        if (!email) return res.status(400).json({ message: 'Email required' });

        const user = await User.findOne({ email });
        if (!user) return res.status(404).json({ message: 'User not found' });

        // Get file and friend counts for user stats
        const [fileCount, friendCount] = await Promise.all([
            FileModel.countDocuments({ userEmail: email }),
            FriendModel.countDocuments({
                $or: [
                    { userId: user._id, status: 'accepted' },
                    { friendId: user._id, status: 'accepted' }
                ]
            })
        ]);

        res.json({
            user: {
                _id: user._id,
                email: user.email,
                username: user.username,
                profileIcon: user.profileIcon,
                publicKey: user.publicKey,
                stats: {
                    files: fileCount,
                    friends: friendCount
                }
            }
        });
    } catch (error) {
        console.error('Error fetching user:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

// Update user's public key
app.post('/api/update-public-key', async (req, res) => {
    try {
        const { email, publicKey } = req.body;
        if (!email || !publicKey) {
            return res.status(400).json({ message: 'Email and publicKey required' });
        }

        const user = await User.findOneAndUpdate(
            { email },
            { publicKey },
            { new: true }
        );

        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        res.json({ 
            message: 'Public key updated successfully',
            user: {
                _id: user._id,
                email: user.email,
                username: user.username,
                profileIcon: user.profileIcon,
                publicKey: user.publicKey
            }
        });
    } catch (error) {
        console.error('Error updating public key:', error);
        res.status(500).json({ message: 'Failed to update public key' });
    }
});

// Store encrypted backup (optional): body { email, backup }
app.post('/api/store-backup', async (req, res) => {
    try {
        const { email, backup } = req.body;
        if (!email || !backup) return res.status(400).json({ message: 'Email and backup required' });

        // Ensure user exists
        const user = await User.findOne({ email });
        if (!user) return res.status(404).json({ message: 'User not found' });

        // Upsert the backup for this ownerEmail (store latest)
        const doc = await BackupModel.findOneAndUpdate(
            { ownerEmail: email },
            { backup, createdAt: Date.now() },
            { upsert: true, new: true }
        );

        res.json({ message: 'Backup stored successfully', backupId: doc._id });
    } catch (error) {
        console.error('Error storing backup:', error);
        res.status(500).json({ message: 'Failed to store backup' });
    }
});

// Retrieve encrypted backup for a user
app.get('/api/get-backup', async (req, res) => {
    try {
        const { email } = req.query;
        if (!email) return res.status(400).json({ message: 'Email required' });

        const doc = await BackupModel.findOne({ ownerEmail: email });
        if (!doc) return res.status(404).json({ message: 'Backup not found' });

        res.json({ backup: doc.backup, createdAt: doc.createdAt });
    } catch (error) {
        console.error('Error fetching backup:', error);
        res.status(500).json({ message: 'Failed to fetch backup' });
    }
});

// Search user by username
app.get('/api/user-by-username', async (req, res) => {
    const { username } = req.query;
    if (!username) return res.status(400).json({ message: 'username required' });
    const user = await User.findOne({ username });
    if (!user) return res.status(404).json({ message: 'User not found' });
    res.json({ user });
});

// Search user by messageId
app.get('/api/user-by-messageid', async (req, res) => {
    const { messageId } = req.query;
    if (!messageId) return res.status(400).json({ message: 'messageId required' });
    const user = await User.findOne({ messageId });
    if (!user) return res.status(404).json({ message: 'User not found' });
    res.json({ user });
});

// List chats for user
app.get('/api/chats', async (req, res) => {
    const { email } = req.query;
    if (!email) return res.status(400).json({ message: 'Email required' });
    const chats = await Chat.find({ users: email });
    res.json({ chats });
});

// Create new chat
app.post('/api/chats', async (req, res) => {
    const { users } = req.body; // array of emails
    if (!users || users.length < 2) return res.status(400).json({ message: 'At least 2 users required' });
    const chat = await Chat.create({ users });
    res.json({ chat });
});

// Start chat with username (search user and create chat)
app.post('/api/start-chat', async (req, res) => {
    try {
        const { myEmail, targetUsername } = req.body;
        if (!myEmail || !targetUsername) {
            return res.status(400).json({ message: 'Email and target username required' });
        }

        // Find target user by username
        const targetUser = await User.findOne({ username: targetUsername });
        if (!targetUser) {
            return res.status(404).json({ message: 'User not found' });
        }

        // Check if chat already exists
        const existingChat = await Chat.findOne({
            users: { $all: [myEmail, targetUser.email] }
        });

        if (existingChat) {
            return res.json({ chat: existingChat, message: 'Chat already exists' });
        }

        // Create new chat
        const newChat = await Chat.create({
            users: [myEmail, targetUser.email]
        });

        res.json({ chat: newChat, message: 'Chat created successfully' });
    } catch (error) {
        console.error('Start chat error:', error);
        res.status(500).json({ message: 'Failed to start chat' });
    }
});

// List messages in chat
app.get('/api/messages', async (req, res) => {
    const { chatId } = req.query;
    if (!chatId) return res.status(400).json({ message: 'chatId required' });
    const messages = await Message.find({ chatId }).sort({ createdAt: 1 });
    res.json({ messages });
});

// Send message (with optional file)
app.post('/api/messages', upload.single('file'), async (req, res) => {
    const { chatId, sender, encrypted } = req.body;
    if (!chatId || !sender || !encrypted) return res.status(400).json({ message: 'chatId, sender, encrypted required' });
    
    let file = undefined;
    let vaultFileId = null;
    
    if (req.file) {
        file = {
            filename: req.file.filename,
            originalname: req.file.originalname,
            mimetype: req.file.mimetype,
            size: req.file.size
        };
        
        // Create vault file entry for security scanning
        try {
            const filePath = path.join(process.cwd(), 'uploads', req.file.filename);
            const fileHash = await securityScanner.calculateFileHash(filePath);
            
            const vaultFile = await VaultFile.create({
                userId: sender,
                filename: req.file.filename,
                originalName: req.file.originalname,
                fileType: req.file.mimetype,
                fileSize: req.file.size,
                fileHash,
                recipient: 'chat-recipient', // You can extract this from chat participants
                chatId,
                scanStatus: 'pending'
            });
            
            vaultFileId = vaultFile._id;
            
            // Start background scan (don't wait for completion)
            securityScanner.scanFile(filePath)
                .then(scanResult => vaultFile.updateScanResults(scanResult))
                .catch(error => {
                    console.error('Background file scan failed:', error);
                    vaultFile.scanStatus = 'error';
                    vaultFile.save();
                });
                
        } catch (error) {
            console.error('Error creating vault file entry:', error);
        }
    }
    
    // Check for URLs in the encrypted message and scan them
    try {
        // Note: This is a basic URL detection - in real implementation,
        // you might want to decrypt the message first or scan after decryption
        const urlRegex = /(https?:\/\/[^\s]+)/g;
        const urls = encrypted.match(urlRegex);
        
        if (urls && urls.length > 0) {
            // Scan URLs in background
            urls.forEach(async (url) => {
                try {
                    const urlHash = await securityScanner.calculateHash(url);
                    const domain = new URL(url).hostname;
                    
                    const vaultLink = await VaultLink.create({
                        userId: sender,
                        url,
                        urlHash,
                        domain,
                        recipient: 'chat-recipient',
                        chatId,
                        scanStatus: 'scanning'
                    });
                    
                    const scanResult = await securityScanner.scanURL(url);
                    await vaultLink.updateScanResults(scanResult);
                } catch (error) {
                    console.error('Background URL scan failed:', error);
                }
            });
        }
    } catch (error) {
        console.error('Error scanning URLs in message:', error);
    }
    
    const message = await Message.create({ chatId, sender, encrypted, file, vaultFileId });
    res.json({ message });
});

// Download file
app.get('/api/files/:filename', (req, res) => {
    const filePath = path.join(process.cwd(), 'uploads', req.params.filename);
    if (!fs.existsSync(filePath)) return res.status(404).send('File not found');
    res.download(filePath);
});

// Health check endpoint for dashboard
app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', message: 'Server is running' });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
