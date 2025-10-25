// Quick script to check the latest messages in MongoDB to verify encryption
import mongoose from 'mongoose';

// Replace this with your actual MongoDB Atlas connection string  
const MONGODB_URI = 'mongodb+srv://akash:akash7538@cluster0.5g9eoqq.mongodb.net/flow?retryWrites=true&w=majority';

// Message schema (simplified)
const messageSchema = new mongoose.Schema({
    chatId: String,
    sender: String,
    content: String,
    encrypted: String,
    timestamp: { type: Date, default: Date.now },
    file: Object
});

const Message = mongoose.model('Message', messageSchema);

async function checkLatestMessages() {
    try {
        await mongoose.connect(MONGODB_URI);
        console.log('Connected to MongoDB Atlas');
        
        // Get the latest 5 messages
        const latestMessages = await Message.find()
            .sort({ createdAt: -1 })
            .limit(5);
        
        console.log('\nLatest 5 messages:');
        latestMessages.forEach((msg, index) => {
            console.log(`\n${index + 1}. Message ID: ${msg._id}`);
            console.log(`   Sender: ${msg.sender}`);
            console.log(`   Timestamp: ${msg.createdAt || msg.timestamp}`);
            console.log(`   Content: ${msg.content || 'undefined'}`);
            console.log(`   Encrypted: ${msg.encrypted ? msg.encrypted.substring(0, 50) + '...' : 'undefined'}`);
            console.log(`   Is encrypted: ${msg.encrypted && msg.encrypted.length > 50 ? 'YES' : 'NO'}`);
        });
        
        // Also search for our test messages
        const testMessages = await Message.find({ 
            encrypted: { $regex: /ENCRYPTED_ENCRYPTION_TEST/ } 
        }).sort({ createdAt: -1 });
        
        console.log('\n--- Test Messages Found ---');
        testMessages.forEach((msg, index) => {
            console.log(`\n${index + 1}. Test Message ID: ${msg._id}`);
            console.log(`   Sender: ${msg.sender}`);
            console.log(`   Timestamp: ${msg.createdAt || msg.timestamp}`);
            console.log(`   Encrypted: ${msg.encrypted}`);
            console.log(`   Contains ENCRYPTED_: ${msg.encrypted.includes('ENCRYPTED_') ? 'YES' : 'NO'}`);
        });
        
    } catch (error) {
        console.error('Error:', error);
    } finally {
        await mongoose.disconnect();
    }
}

checkLatestMessages();