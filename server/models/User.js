
import mongoose from 'mongoose';

const userSchema = new mongoose.Schema({
    email: { type: String, required: true, unique: true },
    username: { type: String, required: true, unique: true },
    passwordHash: { type: String, required: false },
    profileIcon: { type: String, default: '' }, // URL or base64
    publicKey: { type: String, default: '' }, // base64 encoded public key for encryption
    createdAt: { type: Date, default: Date.now }
});

export default mongoose.model('User', userSchema);
