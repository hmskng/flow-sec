const mongoose = require('mongoose');
require('dotenv').config();

// Message model
const messageSchema = new mongoose.Schema({
    chatId: { type: mongoose.Schema.Types.ObjectId, required: true },
    sender: { type: String, required: true },
    encrypted: { type: String, required: true },
    vaultFileId: { type: mongoose.Schema.Types.ObjectId, default: null },
    createdAt: { type: Date, default: Date.now }
});

const Message = mongoose.model('Message', messageSchema);

async function sendTestMessage() {
    try {
        // Connect to MongoDB
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('Connected to MongoDB');
        
        // Create a test encrypted message
        const testMessage = new Message({
            chatId: '68bd4cffc321263ac78219bd',
            sender: 'test@flowsec.com',
            encrypted: 'DIRECT_DB_TEST_ENCRYPTED_' + Date.now()
        });
        
        const saved = await testMessage.save();
        console.log('Test message saved to database:', saved);
        
        // Check latest messages
        const latest = await Message.find()
            .sort({ createdAt: -1 })
            .limit(3)
            .exec();
            
        console.log('\nLatest 3 messages:');
        latest.forEach((msg, i) => {
            console.log(`${i+1}. ID: ${msg._id}`);
            console.log(`   Sender: ${msg.sender}`);
            console.log(`   Encrypted: ${msg.encrypted.substring(0, 50)}...`);
            console.log(`   Time: ${msg.createdAt}`);
            console.log('');
        });
        
        await mongoose.connection.close();
        console.log('Database connection closed');
        
    } catch (error) {
        console.error('Error:', error);
        process.exit(1);
    }
}

sendTestMessage();