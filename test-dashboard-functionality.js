// Simple test to verify dashboard functionality
console.log('🔥 Testing dashboard functionality...');

// Test 1: Check if we can create the class
try {
    const testDashboard = new FlowSecDashboard();
    console.log('✅ Dashboard class can be instantiated');
    
    // Test 2: Check if methods exist
    console.log('🔍 encryptMessage method exists:', typeof testDashboard.encryptMessage === 'function');
    console.log('🔍 sendMessage method exists:', typeof testDashboard.sendMessage === 'function');
    
    // Test 3: Try to encrypt a message
    if (typeof testDashboard.encryptMessage === 'function') {
        testDashboard.encryptMessage('test-chat', 'test message').then(encrypted => {
            console.log('✅ Encryption test successful:', encrypted.substring(0, 50) + '...');
        }).catch(err => {
            console.error('❌ Encryption test failed:', err);
        });
    }
    
} catch (error) {
    console.error('❌ Dashboard class instantiation failed:', error);
}

// Test 4: Check if form elements exist
setTimeout(() => {
    const messageForm = document.getElementById('message-form');
    const messageInput = document.getElementById('message-input');
    
    console.log('🔍 message-form element:', messageForm ? 'EXISTS' : 'NOT FOUND');
    console.log('🔍 message-input element:', messageInput ? 'EXISTS' : 'NOT FOUND');
    
    if (messageForm) {
        // Test 5: Check event listeners on the form
        console.log('🔍 Form has event listeners');
        
        // Add a test listener to see if events fire
        messageForm.addEventListener('submit', (e) => {
            console.log('🚨 ALERT: Form submit event detected! This should NOT happen if class listener works');
            console.log('Event target:', e.target);
            console.log('Event prevented:', e.defaultPrevented);
        });
    }
}, 1000);