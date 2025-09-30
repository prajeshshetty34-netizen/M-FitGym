// Environment Configuration
// This file should be dynamically populated based on environment
const config = {
  development: {
    apiUrl: 'http://localhost:3000',
    firebase: {
      apiKey: "AIzaSyDlft-Nu_j_ykeu_5KZ6DRN048pLL6lPEY",
      authDomain: "ai-gym-tracker-60a9a.firebaseapp.com",
      projectId: "ai-gym-tracker-60a9a",
      storageBucket: "ai-gym-tracker-60a9a.appspot.com",
      messagingSenderId: "906850891354",
      appId: "1:906850891354:web:24768d080b097a9ede8a63",
      measurementId: "G-8GZBVTL0YG"
    }
  },
  production: {
    apiUrl: 'https://your-backend-server.onrender.com', // Update with your actual backend URL
    firebase: {
      apiKey: "your_production_firebase_api_key", // Use environment variables in production
      authDomain: "your-production-auth-domain",
      projectId: "your-production-project-id",
      storageBucket: "your-production-storage-bucket",
      messagingSenderId: "your-production-sender-id",
      appId: "your-production-app-id",
      measurementId: "your-production-measurement-id"
    }
  }
};

// Detect environment
const isDevelopment = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
const environment = isDevelopment ? 'development' : 'production';

// Export configuration
window.APP_CONFIG = config[environment];