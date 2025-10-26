import mongoose from 'mongoose';

const BackupSchema = new mongoose.Schema({
    ownerEmail: { type: String, required: true, index: true, unique: true },
    backup: { type: mongoose.Schema.Types.Mixed, required: true },
    createdAt: { type: Date, default: Date.now }
});

export default mongoose.model('Backup', BackupSchema);
