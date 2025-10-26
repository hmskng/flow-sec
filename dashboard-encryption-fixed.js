// Modern FlowSec Dashboard Script - ENCRYPTION FIXED VERSION
// Version: 2025-10-04-FIXED

// Encryption key generation function for chat messages
async function getChatKey(chatId) {
    console.log('🔑 getChatKey called with chatId:', chatId);
    // If a per-session master key derived from the user's password exists, derive per-chat key from it
    const masterB64 = sessionStorage.getItem('masterKey');
    if (masterB64) {
        try {
            const masterRaw = Uint8Array.from(atob(masterB64), c => c.charCodeAt(0));
            const importedMaster = await window.crypto.subtle.importKey(
                'raw',
                masterRaw,
                { name: 'PBKDF2' },
                false,
                ['deriveKey']
            );

            const derivedKey = await window.crypto.subtle.deriveKey(
                {
                    name: 'PBKDF2',
                    salt: new TextEncoder().encode('FlowSecChatSalt' + chatId),
                    iterations: 100000,
                    hash: 'SHA-256'
                },
                importedMaster,
                { name: 'AES-GCM', length: 256 },
                false,
                ['encrypt', 'decrypt']
            );
            console.log('🔑 Derived chat key from session master for chat:', chatId);
            return derivedKey;
        } catch (err) {
            console.warn('Failed deriving chat key from master:', err);
            // fall through to legacy method
        }
    }

    // Legacy deterministic derivation (fallback)
    const keyMaterial = new TextEncoder().encode(chatId + 'FlowSecChatEncryption2025');
    const importedKey = await window.crypto.subtle.importKey(
        'raw',
        keyMaterial,
        { name: 'PBKDF2' },
        false,
        ['deriveKey']
    );
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
    console.log('🔑 Generated legacy encryption key for chat:', chatId);
    return derivedKey;
}

console.log('🚀 ENCRYPTION FIXED VERSION LOADED - getChatKey function available');

class FlowSecDashboard {
    constructor() {
        console.log('🚀 FlowSecDashboard constructor called - ENCRYPTION FIXED VERSION!');
    this.API_BASE = 'https://flowsec-kp3q.onrender.com/api';
        this.socket = null;
        this.currentChatId = null;
        this.chats = [];
        this.chatUsers = {};
        this.userEmail = null;
        this.myUsername = null;
        this.myProfileIcon = null;
        this.lastMessageCount = 0; // Track message count for smart polling
        this.currentMessages = []; // Cache current messages
        
        console.log('🔧 Calling this.init()...');
        this.init();
    }

    async init() {
        console.log('⚙️ Dashboard init() method called');
        await this.checkAuth();
        // Only enable demo mode if there's no network connection
        this.checkNetworkAndInitialize();
        await this.loadUserProfile();
        console.log('🔗 Calling bindEvents()...');
        this.bindEvents();
        this.loadChats();
        this.setupMobileMenu();
        
        // Start polling for new messages every 2 seconds
        this.startMessagePolling();
        console.log('✅ Dashboard initialization complete');
    }

    startMessagePolling() {
        // Poll for new messages every 2 seconds with smart updates
        setInterval(() => {
            if (this.currentChatId) {
                this.checkForNewMessages();
            }
        }, 2000);
    }

    async checkForNewMessages() {
        try {
            const response = await fetch(`${this.API_BASE}/messages?chatId=${this.currentChatId}`);
            if (response.ok) {
                const data = await response.json();
                const newMessages = data.messages || [];
                
                // Only update if we have more messages than before
                if (newMessages.length > this.lastMessageCount) {
                    this.lastMessageCount = newMessages.length;
                    // Only append the new messages, not all messages
                    const newMessagesToAdd = newMessages.slice(this.currentMessages.length);
                    
                    for (const message of newMessagesToAdd) {
                        this.currentMessages.push(message);
                        const messageEl = await this.createMessageElementAsync(message);
                        document.getElementById('messages').appendChild(messageEl);
                    }
                    
                    // Scroll to bottom
                    const messagesContainer = document.getElementById('messages');
                    messagesContainer.scrollTop = messagesContainer.scrollHeight;
                }
            }
        } catch (error) {
            console.error('Error checking for new messages:', error);
        }
    }

    async checkNetworkAndInitialize() {
        try {
            console.log('🌐 Checking network connectivity...');
            const response = await fetch(`${this.API_BASE}/health`, { timeout: 3000 });
            if (response.ok) {
                console.log('✅ Network connection successful');
                this.networkAvailable = true;
            } else {
                throw new Error('Server not responding');
            }
        } catch (error) {
            console.log('❌ Network check failed, enabling demo mode:', error.message);
            this.networkAvailable = false;
            this.enableDemoMode();
        }
    }

    enableDemoMode() {
        console.log('🎭 Demo mode enabled');
        // Set demo user data if no user exists
        if (!localStorage.getItem('userEmail')) {
            localStorage.setItem('userEmail', 'demo@flowsec.com');
            localStorage.setItem('user', JSON.stringify({
                email: 'demo@flowsec.com',
                username: 'DemoUser',
                profileIcon: null
            }));
        }
        this.userEmail = localStorage.getItem('userEmail');
    }

    async checkAuth() {
        console.log('🔐 Checking authentication...');
        this.userEmail = localStorage.getItem('userEmail');
        
        if (!this.userEmail) {
            console.log('❌ No user email found, redirecting to login');
            window.location.href = 'index.html';
            return;
        }
        
        console.log('✅ User authenticated:', this.userEmail);
    }

    async loadUserProfile() {
        try {
            if (!this.networkAvailable) {
                // Use demo data
                this.user = JSON.parse(localStorage.getItem('user') || '{}');
                this.myUsername = this.user.username || 'Demo User';
                this.myProfileIcon = this.user.profileIcon || '👤';
                this.updateUserProfile();
                return;
            }

            console.log('👤 Loading user profile...');
            const response = await fetch(`${this.API_BASE}/user?email=${encodeURIComponent(this.userEmail)}`);
            
            if (response.ok) {
                const data = await response.json();
                this.user = data.user;
                this.myUsername = this.user.username;
                this.myProfileIcon = this.user.profileIcon;
                
                // Update UI
                this.updateUserProfile();
                
                console.log('✅ User profile loaded:', this.user);
            } else {
                console.error('❌ Failed to load user profile');
                this.enableDemoMode();
            }
        } catch (error) {
            console.error('❌ Error loading user profile:', error);
            this.enableDemoMode();
        }
    }

    updateUserProfile() {
        const usernameEl = document.getElementById('username');
        const userEmailEl = document.getElementById('user-email');
        const profileIconEl = document.getElementById('profile-icon');
        
        if (usernameEl) usernameEl.textContent = this.myUsername || 'User';
        if (userEmailEl) userEmailEl.textContent = this.userEmail || 'user@example.com';
        if (profileIconEl) profileIconEl.textContent = this.myProfileIcon || '👤';
    }

    async loadChats() {
        try {
            console.log('💬 Loading chats...');
            
            if (!this.networkAvailable) {
                this.loadDemoChats();
                return;
            }

            const response = await fetch(`${this.API_BASE}/chats?userEmail=${encodeURIComponent(this.userEmail)}`);
            
            if (response.ok) {
                const data = await response.json();
                this.chats = data.chats || [];
                console.log('✅ Chats loaded:', this.chats.length);
                this.renderChats();
            } else {
                console.error('❌ Failed to load chats');
                this.loadDemoChats();
            }
        } catch (error) {
            console.error('❌ Error loading chats:', error);
            this.loadDemoChats();
        }
    }

    loadDemoChats() {
        this.chats = [
            {
                _id: '68bd4cffc321263ac78219bd',
                name: 'Demo Chat',
                members: ['demo@flowsec.com', 'friend@flowsec.com'],
                lastMessage: 'Welcome to FlowSec demo!',
                lastMessageTime: new Date(),
                isActive: true
            }
        ];
        this.renderChats();
    }

    renderChats() {
        const chatList = document.getElementById('chat-list');
        if (!chatList) return;

        if (this.chats.length === 0) {
            chatList.innerHTML = '<div class="no-chats">No chats available</div>';
            return;
        }

        chatList.innerHTML = this.chats.map(chat => {
            const time = this.formatTime(new Date(chat.lastMessageTime));
            const isActive = chat._id === this.currentChatId ? 'active' : '';
            
            return `
                <div class="chat-item ${isActive}" data-chat-id="${chat._id}">
                    <div class="chat-avatar">${this.getChatAvatar(chat)}</div>
                    <div class="chat-info">
                        <div class="chat-name">${this.escapeHtml(chat.name || 'Unknown Chat')}</div>
                        <div class="chat-last-message">${this.escapeHtml(chat.lastMessage || 'No messages')}</div>
                    </div>
                    <div class="chat-time">${time}</div>
                </div>
            `;
        }).join('');

        // Add click listeners
        document.querySelectorAll('.chat-item').forEach(item => {
            item.addEventListener('click', (e) => {
                const chatId = e.currentTarget.getAttribute('data-chat-id');
                this.selectChat(chatId);
            });
        });
    }

    getChatAvatar(chat) {
        // Return first letter of chat name or a default icon
        return chat.name ? chat.name.charAt(0).toUpperCase() : '👥';
    }

    async selectChat(chatId) {
        console.log('💬 Selecting chat:', chatId);
        
        // Update active chat in UI
        document.querySelectorAll('.chat-item').forEach(item => {
            item.classList.remove('active');
        });
        document.querySelector(`[data-chat-id="${chatId}"]`)?.classList.add('active');
        
        this.currentChatId = chatId;
        
        // Update chat header
        const selectedChat = this.chats.find(c => c._id === chatId);
        if (selectedChat) {
            document.getElementById('chat-title').textContent = selectedChat.name || 'Chat';
            document.getElementById('chat-members').textContent = `${selectedChat.members?.length || 0} members`;
        }
        
        // Show message input
        document.getElementById('message-input-container').style.display = 'block';
        
        // Load messages for this chat
        await this.loadMessages(chatId);
    }

    async loadMessages(chatId) {
        try {
            console.log('📨 Loading messages for chat:', chatId);
            
            if (!this.networkAvailable) {
                this.loadDemoMessages();
                return;
            }

            const response = await fetch(`${this.API_BASE}/messages?chatId=${chatId}`);
            
            if (response.ok) {
                const data = await response.json();
                this.currentMessages = data.messages || [];
                this.lastMessageCount = this.currentMessages.length;
                console.log('✅ Messages loaded:', this.currentMessages.length);
                await this.renderMessages();
            } else {
                console.error('❌ Failed to load messages');
                this.loadDemoMessages();
            }
        } catch (error) {
            console.error('❌ Error loading messages:', error);
            this.loadDemoMessages();
        }
    }

    loadDemoMessages() {
        this.currentMessages = [
            {
                _id: 'demo1',
                sender: 'friend@flowsec.com',
                encrypted: 'Hello! Welcome to FlowSec!',
                createdAt: new Date(Date.now() - 60000).toISOString()
            },
            {
                _id: 'demo2',
                sender: 'demo@flowsec.com',
                encrypted: 'Thanks! This is a secure messaging demo.',
                createdAt: new Date().toISOString()
            }
        ];
        this.renderMessages();
    }

    async renderMessages() {
        const messagesContainer = document.getElementById('messages');
        if (!messagesContainer) return;

        if (this.currentMessages.length === 0) {
            messagesContainer.innerHTML = '<div class="no-messages">No messages in this chat</div>';
            return;
        }

        messagesContainer.innerHTML = '';
        
        for (const message of this.currentMessages) {
            const messageEl = await this.createMessageElementAsync(message);
            messagesContainer.appendChild(messageEl);
        }

        // Scroll to bottom
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
    }

    async createMessageElementAsync(message) {
        const messageDiv = document.createElement('div');
        const isOwn = message.sender === this.userEmail;
        
        messageDiv.className = `message ${isOwn ? 'own' : 'other'}`;
        
        // Decrypt message if needed
        let displayText = message.encrypted;
        try {
            if (this.currentChatId && message.encrypted) {
                displayText = await this.decryptMessage(this.currentChatId, message.encrypted);
            }
        } catch (error) {
            console.warn('Failed to decrypt message, showing as-is:', error);
            displayText = message.encrypted;
        }
        
        const time = this.formatTime(new Date(message.createdAt));
        const senderName = isOwn ? 'You' : this.getSenderName(message.sender);
        
        messageDiv.innerHTML = `
            <div class="message-content">
                <div class="message-sender">${this.escapeHtml(senderName)}</div>
                <div class="message-text">${this.escapeHtml(displayText)}</div>
                <div class="message-time">${time}</div>
            </div>
        `;
        
        return messageDiv;
    }

    getSenderName(email) {
        // Try to get username from chat users or use email
        return this.chatUsers[email] || email.split('@')[0];
    }

    bindEvents() {
        console.log('🔗 Binding events...');
        
        // Message form submission
        const messageForm = document.getElementById('message-form');
        if (messageForm) {
            console.log('📝 Binding sendMessage to message form');
            messageForm.addEventListener('submit', (e) => {
                console.log('📨 Form submit event triggered, calling this.sendMessage');
                return this.sendMessage(e);
            });
        }

        // Logout functionality
        const logoutBtn = document.getElementById('logout-btn');
        if (logoutBtn) {
            logoutBtn.addEventListener('click', () => this.logout());
        }

        // Mobile menu toggle
        const menuToggle = document.getElementById('menu-toggle');
        if (menuToggle) {
            menuToggle.addEventListener('click', () => this.toggleMobileMenu());
        }

        console.log('✅ Events bound successfully');
    }

    setupMobileMenu() {
        // Add mobile menu functionality if needed
        const sidebar = document.querySelector('.sidebar');
        const mainContent = document.querySelector('.main-content');
        
        // Add mobile responsiveness
        if (window.innerWidth <= 768) {
            sidebar?.classList.add('mobile-hidden');
        }
        
        window.addEventListener('resize', () => {
            if (window.innerWidth <= 768) {
                sidebar?.classList.add('mobile-hidden');
            } else {
                sidebar?.classList.remove('mobile-hidden');
            }
        });
    }

    toggleMobileMenu() {
        const sidebar = document.querySelector('.sidebar');
        sidebar?.classList.toggle('mobile-hidden');
    }

    async sendMessage(e) {
        console.log('🔥 sendMessage method called - ENCRYPTION FIXED VERSION!');
        e.preventDefault();
        
        const messageInput = document.getElementById('message-input');
        const content = messageInput.value.trim();
        
        if (!content || !this.currentChatId) return;

        try {
            // Debug logging
            console.log('🔤 Original message:', content);
            console.log('🆔 Chat ID:', this.currentChatId);
            
            // Test encryption function availability
            if (typeof getChatKey !== 'function') {
                throw new Error('getChatKey function is not available!');
            }
            
            console.log('🔑 getChatKey function confirmed available');
            
            // Encrypt the message using AES-GCM before sending
            console.log('🔐 Starting encryption process...');
            const encryptedContent = await this.encryptMessage(this.currentChatId, content);
            console.log('🔐 Encrypted message:', encryptedContent);
            console.log('📏 Encrypted length:', encryptedContent.length, 'characters');
            
            if (!this.networkAvailable) {
                // Demo mode - just add to local messages
                const demoMessage = {
                    _id: 'demo_' + Date.now(),
                    chatId: this.currentChatId,
                    sender: this.userEmail,
                    encrypted: encryptedContent,
                    createdAt: new Date().toISOString()
                };
                
                this.currentMessages.push(demoMessage);
                const messageEl = await this.createMessageElementAsync(demoMessage);
                document.getElementById('messages').appendChild(messageEl);
                document.getElementById('messages').scrollTop = document.getElementById('messages').scrollHeight;
                messageInput.value = '';
                return;
            }
            
            // Send encrypted message to server
            console.log('📤 Sending encrypted message to server...');
            const response = await fetch(`${this.API_BASE}/messages`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    chatId: this.currentChatId,
                    sender: this.userEmail,
                    encrypted: encryptedContent // Now properly encrypted
                })
            });

            if (response.ok) {
                const data = await response.json();
                console.log('✅ Message sent successfully:', data);
                
                // Create message object
                const message = {
                    _id: data.message._id,
                    chatId: this.currentChatId,
                    sender: this.userEmail,
                    encrypted: encryptedContent, // Store encrypted content
                    createdAt: data.message.createdAt || new Date().toISOString()
                };

                // Add to local cache
                this.currentMessages.push(message);

                // Add to UI immediately (with decryption for display)
                const messageEl = await this.createMessageElementAsync(message);
                document.getElementById('messages').appendChild(messageEl);
                document.getElementById('messages').scrollTop = document.getElementById('messages').scrollHeight;

                // Clear input
                messageInput.value = '';

                // Update chat list with latest message (using original content for preview)
                this.updateChatLastMessage(this.currentChatId, content);
                
                console.log('✅ Message processing complete');
            } else {
                throw new Error('Server responded with status: ' + response.status);
            }

        } catch (error) {
            console.error('❌ Failed to send message:', error);
            this.showNotification('Failed to send message: ' + error.message, 'error');
        }
    }

    updateChatLastMessage(chatId, content) {
        const chat = this.chats.find(c => c._id === chatId);
        if (chat) {
            chat.lastMessage = content.substring(0, 50) + (content.length > 50 ? '...' : '');
            chat.lastMessageTime = new Date();
            this.renderChats();
        }
    }

    async encryptMessage(chatId, text) {
        console.log('🔐 encryptMessage called with:', { chatId, text });
        console.log('🔍 Checking getChatKey function availability...');
        
        if (typeof getChatKey !== 'function') {
            console.error('❌ getChatKey function is not defined!');
            throw new Error('Encryption function getChatKey is not available');
        }
        
        try {
            console.log('🔑 Calling getChatKey...');
            const key = await getChatKey(chatId);
            console.log('✅ Got encryption key:', key);
            
            console.log('🎲 Generating IV...');
            const iv = window.crypto.getRandomValues(new Uint8Array(12));
            
            console.log('📝 Encoding text...');
            const enc = new TextEncoder().encode(text);
            
            console.log('🔐 Encrypting with AES-GCM...');
            const ciphertext = await window.crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, enc);
            
            console.log('📦 Creating base64 result...');
            const result = btoa(String.fromCharCode(...iv) + String.fromCharCode(...new Uint8Array(ciphertext)));
            
            console.log('✅ Encryption successful!');
            console.log('📏 Result length:', result.length, 'characters');
            console.log('🔤 Result preview:', result.substring(0, 50) + '...');
            
            return result;
        } catch (error) {
            console.error('❌ Encryption failed:', error);
            throw new Error('Failed to encrypt message: ' + error.message);
        }
    }

    async decryptMessage(chatId, encrypted) {
        try {
            // Try to decode base64; if invalid, treat as plaintext and return it
            let data;
            try {
                data = atob(encrypted);
            } catch (e) {
                // Not base64 / not our encrypted format — return as-is
                return encrypted;
            }

            const key = await getChatKey(chatId);
            const iv = Uint8Array.from(data.slice(0, 12), c => c.charCodeAt(0));
            const ct = Uint8Array.from(data.slice(12), c => c.charCodeAt(0));
            const dec = await window.crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, ct);
            return new TextDecoder().decode(dec);
        } catch (error) {
            console.log('Decryption failed, returning as plain text:', error);
            return encrypted; // Fallback for old messages
        }
    }

    showNotification(message, type = 'info') {
        // Remove existing notifications
        const existing = document.querySelector('.notification');
        if (existing) existing.remove();

        const notification = document.createElement('div');
        notification.className = `notification notification-${type}`;
        notification.innerHTML = `
            <div class="notification-content">
                <span class="notification-icon">${this.getNotificationIcon(type)}</span>
                <span class="notification-message">${message}</span>
                <button class="notification-close" onclick="this.parentElement.parentElement.remove()">×</button>
            </div>
        `;

        // Add notification styles
        this.addNotificationStyles();

        document.body.appendChild(notification);

        // Auto remove after 5 seconds
        setTimeout(() => {
            if (notification.parentElement) {
                notification.remove();
            }
        }, 5000);
    }

    getNotificationIcon(type) {
        const icons = {
            info: 'ℹ️',
            success: '✅',
            warning: '⚠️',
            error: '❌'
        };
        return icons[type] || icons.info;
    }

    addNotificationStyles() {
        if (document.getElementById('notification-styles')) return;

        const styles = document.createElement('style');
        styles.id = 'notification-styles';
        styles.textContent = `
            .notification {
                position: fixed;
                top: 20px;
                right: 20px;
                z-index: 1000;
                max-width: 400px;
                padding: 15px;
                border-radius: 8px;
                box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                animation: slideIn 0.3s ease-out;
            }
            
            .notification-info { background: #e3f2fd; border-left: 4px solid #2196f3; color: #0d47a1; }
            .notification-success { background: #e8f5e8; border-left: 4px solid #4caf50; color: #1b5e20; }
            .notification-warning { background: #fff3e0; border-left: 4px solid #ff9800; color: #e65100; }
            .notification-error { background: #ffebee; border-left: 4px solid #f44336; color: #c62828; }
            
            .notification-content {
                display: flex;
                align-items: center;
                gap: 10px;
            }
            
            .notification-message {
                flex: 1;
                font-size: 14px;
                line-height: 1.4;
            }
            
            .notification-close {
                background: none;
                border: none;
                font-size: 18px;
                cursor: pointer;
                opacity: 0.7;
                transition: opacity 0.2s;
            }
            
            .notification-close:hover {
                opacity: 1;
            }
            
            @keyframes slideIn {
                from { transform: translateX(100%); opacity: 0; }
                to { transform: translateX(0); opacity: 1; }
            }
        `;
        document.head.appendChild(styles);
    }

    logout() {
        localStorage.removeItem('userEmail');
        localStorage.removeItem('user');
        window.location.href = 'index.html';
    }

    formatTime(date) {
        const now = new Date();
        const diffMs = now - date;
        const diffMins = Math.floor(diffMs / 60000);
        const diffHours = Math.floor(diffMs / 3600000);
        const diffDays = Math.floor(diffMs / 86400000);

        if (diffMins < 1) return 'Now';
        if (diffMins < 60) return `${diffMins}m`;
        if (diffHours < 24) return `${diffHours}h`;
        if (diffDays < 7) return `${diffDays}d`;
        
        return date.toLocaleDateString();
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
}

// Initialize the dashboard when the page loads
let dashboardInstance;
document.addEventListener('DOMContentLoaded', () => {
    console.log('🚀 DOM Content Loaded - Initializing FlowSecDashboard ENCRYPTION FIXED VERSION');
    dashboardInstance = new FlowSecDashboard();
    console.log('✅ Dashboard instance created:', dashboardInstance);
    
    // Verify the instance has the required methods
    console.log('🔍 Has encryptMessage method:', typeof dashboardInstance.encryptMessage === 'function');
    console.log('🔍 Has sendMessage method:', typeof dashboardInstance.sendMessage === 'function');
    console.log('🔍 getChatKey function available globally:', typeof getChatKey === 'function');
});

console.log('📜 ENCRYPTION FIXED dashboard.js loaded completely');