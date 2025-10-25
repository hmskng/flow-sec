// Direct test of dashboard encryption flow
import fetch from 'node-fetch';

const API_BASE = 'https://flowsec-kp3q.onrender.com/api';

async function sendRealEncryptedMessage() {
    try {
        console.log('Testing real AES-GCM encryption...');
        
        // Generate a real encryption key for testing
        const key = await generateTestKey();
        const testMessage = `REAL_ENCRYPTION_TEST_${Date.now()}`;
        const chatId = '68e0cda284a4497aca5f3a7e'; // Use existing chat
        
        // Encrypt using Web Crypto API (same as frontend should do)
        const iv = new Uint8Array(12);
        crypto.getRandomValues(iv);
        const encoder = new TextEncoder();
        const data = encoder.encode(testMessage);
        
        const encrypted = await crypto.subtle.encrypt(
            { name: 'AES-GCM', iv },
            key,
            data
        );
        
        // Convert to base64 format (same as frontend)
        const encryptedString = btoa(
            String.fromCharCode(...iv) + 
            String.fromCharCode(...new Uint8Array(encrypted))
        );
        
        console.log('Original message:', testMessage);
        console.log('Encrypted length:', encryptedString.length);
        console.log('Encrypted preview:', encryptedString.substring(0, 50) + '...');
        
        // Send to API
        const response = await fetch(`${API_BASE}/messages`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                chatId: chatId,
                sender: 'akashkalimuthu4@gmail.com',
                encrypted: encryptedString
            })
        });
        
        const result = await response.json();
        console.log('API Response:', result.message?._id);
        
        return result.message?._id;
        
    } catch (error) {
        console.error('Encryption test failed:', error);
    }
}

async function generateTestKey() {
    return await crypto.subtle.generateKey(
        { name: 'AES-GCM', length: 256 },
        true,
        ['encrypt', 'decrypt']
    );
}

// Use Node.js crypto if available
import { webcrypto } from 'crypto';
const crypto = webcrypto;

sendRealEncryptedMessage().then(messageId => {
    console.log('Test completed. Message ID:', messageId);
    process.exit(0);
}).catch(err => {
    console.error('Test failed:', err);
    process.exit(1);
});