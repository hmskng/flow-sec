import mongoose from 'mongoose';

const keySchema = new mongoose.Schema({
    fileId: { type: mongoose.Schema.Types.ObjectId, ref: 'File', required: true },
    ownerEmail: { type: String, required: true }, // who can decrypt
    encryptedAESKey: { type: String, required: true }, // base64
    encryptedFor: { type: String, required: true }, // email (recipient)
    iv: { type: String, required: true }, // initialization vector for encryption
});

export default mongoose.model('Key', keySchema);
