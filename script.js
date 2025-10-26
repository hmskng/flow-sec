// Modern FlowSec Authentication Script
class AuthUI {
    constructor() {
        this.loginCard = document.getElementById('login-card');
        this.signupCard = document.getElementById('signup-card');
        this.showSignup = document.getElementById('show-signup');
        this.showLogin = document.getElementById('show-login');
    this.API_BASE = 'https://flowsec-kp3q.onrender.com/api';
        
        this.init();
    }

    init() {
        this.bindEvents();
        this.setupFileUpload();
        // Remove automatic demo mode - let users login normally
        // this.enableDemoMode(); // Commented out to allow real user authentication
    }

    enableDemoMode() {
        // Set demo user data
        localStorage.setItem('userEmail', 'demo@flowsec.com');
        localStorage.setItem('user', JSON.stringify({
            email: 'demo@flowsec.com',
            username: 'DemoUser',
            profileIcon: null
        }));
        
        // Add demo mode indicator
        const demoIndicator = document.createElement('div');
        demoIndicator.innerHTML = '🔧 DEMO MODE - Network Required for Full Functionality';
        demoIndicator.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            background: #ff6b35;
            color: white;
            text-align: center;
            padding: 8px;
            font-size: 14px;
            z-index: 10000;
            font-weight: 500;
        `;
        document.body.prepend(demoIndicator);
        
        // Add navigation buttons to demo
        this.addDemoNavigation();
    }

    addDemoNavigation() {
        const navButtons = document.createElement('div');
        navButtons.innerHTML = `
            <div style="position: fixed; bottom: 20px; right: 20px; z-index: 9999;">
                <button onclick="window.location.href='dashboard.html'" style="margin: 5px; padding: 10px 20px; background: var(--primary-color); color: white; border: none; border-radius: 8px; cursor: pointer;">💬 Dashboard</button>
                <button onclick="window.location.href='file-share.html'" style="margin: 5px; padding: 10px 20px; background: var(--primary-color); color: white; border: none; border-radius: 8px; cursor: pointer;">📁 File Share</button>
                <button onclick="window.location.href='vault.html'" style="margin: 5px; padding: 10px 20px; background: var(--primary-color); color: white; border: none; border-radius: 8px; cursor: pointer;">🔐 Vault</button>
                <button onclick="window.location.href='index.html'" style="margin: 5px; padding: 10px 20px; background: var(--primary-color); color: white; border: none; border-radius: 8px; cursor: pointer;">🏠 Home</button>
            </div>
        `;
        document.body.appendChild(navButtons);
    }

    bindEvents() {
        // Form switching
        this.showSignup?.addEventListener('click', (e) => {
            e.preventDefault();
            this.switchToSignup();
        });

        this.showLogin?.addEventListener('click', (e) => {
            e.preventDefault();
            this.switchToLogin();
        });

    // No OTP flow: authentication is password-based

        // Form submissions
        document.getElementById('login-form')?.addEventListener('submit', (e) => this.handleLogin(e));
        document.getElementById('signup-form')?.addEventListener('submit', (e) => this.handleSignup(e));
    }

    setupFileUpload() {
        const fileInput = document.getElementById('signup-icon');
        const uploadArea = document.querySelector('.file-upload-area');
        const uploadText = document.querySelector('.file-upload-text');

        if (fileInput && uploadArea) {
            fileInput.addEventListener('change', (e) => {
                const file = e.target.files[0];
                if (file) {
                    uploadText.textContent = `Selected: ${file.name}`;
                    uploadArea.style.borderColor = 'var(--primary-color)';
                    uploadArea.style.background = 'var(--primary-light)';
                } else {
                    uploadText.textContent = 'Click to upload profile picture';
                    uploadArea.style.borderColor = 'var(--border-color)';
                    uploadArea.style.background = 'var(--bg-secondary)';
                }
            });
        }
    }

    switchToSignup() {
        this.loginCard.style.display = 'none';
        this.signupCard.style.display = 'block';
        this.signupCard.style.animation = 'slideUp 0.6s ease-out';
    }

    switchToLogin() {
        this.signupCard.style.display = 'none';
        this.loginCard.style.display = 'block';
        this.loginCard.style.animation = 'slideUp 0.6s ease-out';
    }

    showLoading(button) {
        const span = button.querySelector('span');
        const loader = button.querySelector('.btn-loader');
        if (span && loader) {
            span.style.display = 'none';
            loader.style.display = 'block';
            button.disabled = true;
        }
    }

    hideLoading(button) {
        const span = button.querySelector('span');
        const loader = button.querySelector('.btn-loader');
        if (span && loader) {
            span.style.display = 'block';
            loader.style.display = 'none';
            button.disabled = false;
        }
    }

    // OTP functions removed - password-based authentication only

    async handleLogin(e) {
        e.preventDefault();
        const email = document.getElementById('email').value;
        const password = document.getElementById('password').value;
        const button = document.getElementById('login-btn');
        // Password-based login
        if (!password) {
            this.showNotification('Please enter your password.', 'error');
            return;
        }

        this.showLoading(button);
        try {
            const res = await this.postData(`${this.API_BASE}/login`, { email, password });
            if (res.user) {
                this.showNotification('Login successful! Redirecting...', 'success');
                localStorage.setItem('userEmail', email);
                localStorage.setItem('user', JSON.stringify(res.user));
                setTimeout(() => { window.location.href = 'dashboard.html'; }, 1500);
            } else if (res.message) {
                this.showNotification(res.message, 'error');
            }
        } catch (error) {
            this.showNotification('Network error. Please try again.', 'error');
        } finally {
            this.hideLoading(button);
        }
        return;
    }

    async handleSignup(e) {
        e.preventDefault();
        const email = document.getElementById('signup-email').value;
        const username = document.getElementById('signup-username').value;
        const password = document.getElementById('signup-password')?.value;
        const iconFile = document.getElementById('signup-icon').files[0];
        const button = document.getElementById('signup-btn');

        if (!email || !username || !password) {
            this.showNotification('Please fill in all required fields.', 'error');
            return;
        }

        this.showLoading(button);

        try {
            const formData = new FormData();
            formData.append('email', email);
            formData.append('username', username);
            formData.append('password', password);
            if (iconFile) {
                formData.append('icon', iconFile);
            }

            const response = await fetch(`${this.API_BASE}/register`, {
                method: 'POST',
                body: formData
            });
            
            const res = await response.json();
            
            if (res.user) {
                this.showNotification('Account created successfully! Redirecting...', 'success');
                localStorage.setItem('userEmail', email);
                localStorage.setItem('user', JSON.stringify(res.user));
                setTimeout(() => {
                    window.location.href = 'dashboard.html';
                }, 1500);
            } else {
                this.showNotification(res.message || 'Registration failed. Please try again.', 'error');
            }
        } catch (error) {
            this.showNotification('Network error. Please try again.', 'error');
        } finally {
            this.hideLoading(button);
        }
    }

    async postData(url, data) {
        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });
        return response.json();
    }

    validateEmail(email) {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return emailRegex.test(email);
    }

    validateUsername(username) {
        const usernameRegex = /^[a-zA-Z0-9_]{3,20}$/;
        return usernameRegex.test(username);
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
            success: '✅',
            error: '❌',
            warning: '⚠️',
            info: 'ℹ️'
        };
        return icons[type] || icons.info;
    }

    addNotificationStyles() {
        if (document.querySelector('#notification-styles')) return;

        const styles = document.createElement('style');
        styles.id = 'notification-styles';
        styles.textContent = `
            .notification {
                position: fixed;
                top: 20px;
                right: 20px;
                z-index: 10000;
                min-width: 300px;
                background: white;
                border-radius: 12px;
                box-shadow: 0 10px 25px rgba(0,0,0,0.15);
                border-left: 4px solid var(--primary-color);
                animation: slideInRight 0.3s ease-out;
            }
            
            .notification-success {
                border-left-color: var(--success-color);
            }
            
            .notification-error {
                border-left-color: var(--error-color);
            }
            
            .notification-warning {
                border-left-color: var(--warning-color);
            }
            
            .notification-content {
                display: flex;
                align-items: center;
                gap: 12px;
                padding: 16px 20px;
            }
            
            .notification-icon {
                font-size: 18px;
                flex-shrink: 0;
            }
            
            .notification-message {
                flex: 1;
                font-size: 14px;
                color: var(--text-primary);
                font-weight: 500;
            }
            
            .notification-close {
                background: none;
                border: none;
                font-size: 20px;
                color: var(--text-muted);
                cursor: pointer;
                flex-shrink: 0;
                width: 24px;
                height: 24px;
                display: flex;
                align-items: center;
                justify-content: center;
                border-radius: 50%;
                transition: all 0.2s ease;
            }
            
            .notification-close:hover {
                background: var(--bg-secondary);
                color: var(--text-primary);
            }
            
            @keyframes slideInRight {
                from {
                    opacity: 0;
                    transform: translateX(100%);
                }
                to {
                    opacity: 1;
                    transform: translateX(0);
                }
            }
        `;
        document.head.appendChild(styles);
    }
}

// Initialize the authentication UI when the page loads
document.addEventListener('DOMContentLoaded', () => {
    new AuthUI();
});
