// Test encryption by sending message directly to server
const API_BASE = 'https://flowsec-kp3q.onrender.com/api';

async function getChatKey(chatId) {
    console.log('getChatKey called with chatId:', chatId);
    
    // Create a consistent key for each chat using the chatId
    const keyMaterial = new TextEncoder().encode(chatId + 'FlowSecChatEncryption2025');
    
    // Import key material
    const importedKey = await window.crypto.subtle.importKey(
        'raw',
        keyMaterial,
        { name: 'PBKDF2' },
        false,
        ['deriveKey']
    );
    
    // Derive AES-GCM key
    const derivedKey = await window.crypto.subtle.deriveKey(
        {
            name: 'PBKDF2',
            salt: new TextEncoder().encode('FlowSecSalt' + chatId),
            iterations: 100000,
            hash: 'SHA-256'
        },
        importedKey,
        { name: 'AES-GCM', length: 256 },
        false,
        ['encrypt', 'decrypt']
    );
    
    console.log('Generated encryption key for chat:', chatId);
    return derivedKey;
}

async function encryptMessage(chatId, text) {
    console.log('encryptMessage called with:', { chatId, text });
    try {
        const key = await getChatKey(chatId);
        console.log('Got encryption key:', key);
        const iv = window.crypto.getRandomValues(new Uint8Array(12));
        const enc = new TextEncoder().encode(text);
        const ciphertext = await window.crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, enc);
        const result = btoa(String.fromCharCode(...iv) + String.fromCharCode(...new Uint8Array(ciphertext)));
        console.log('Encryption successful, result:', result);
        return result;
    } catch (error) {
        console.error('Encryption failed:', error);
        throw new Error('Failed to encrypt message: ' + error.message);
    }
}

async function testSendMessage() {
    try {
        const chatId = '68bd4cffc321263ac78219bd';
        const messageText = 'ENCRYPTION_FIXED_TEST_' + Date.now();
        
        console.log('Testing message sending with:', messageText);
        
        // Encrypt the message
        const encryptedContent = await encryptMessage(chatId, messageText);
        console.log('Encrypted content:', encryptedContent);
        
        // Send to server
        const response = await fetch(`${API_BASE}/messages`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                chatId: chatId,
                sender: 'test@flowsec.com',
                encrypted: encryptedContent
            })
        });
        
        if (response.ok) {
            const data = await response.json();
            console.log('Message sent successfully:', data);
            document.getElementById('test-results').innerHTML = `
                <h3>✅ Message Sent Successfully!</h3>
                <p><strong>Original:</strong> ${messageText}</p>
                <p><strong>Encrypted:</strong> ${encryptedContent}</p>
                <p><strong>Length:</strong> ${encryptedContent.length} chars</p>
                <p><strong>Message ID:</strong> ${data.message._id}</p>
            `;
        } else {
            throw new Error('Server returned error: ' + response.status);
        }
        
    } catch (error) {
        console.error('Test failed:', error);
        document.getElementById('test-results').innerHTML = `
            <h3>❌ Test Failed</h3>
            <p><strong>Error:</strong> ${error.message}</p>
        `;
    }
}

// Auto-run the test when page loads
document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('test-btn').addEventListener('click', testSendMessage);
});