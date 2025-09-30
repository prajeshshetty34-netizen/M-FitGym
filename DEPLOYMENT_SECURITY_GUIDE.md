# 🚀 Secure Deployment Guide for AI Gym Website

## 🛡️ Security Fixes Applied

### 1. **Environment Configuration**
- ✅ Created environment-based configuration system
- ✅ Separated development and production configs
- ✅ Added `.gitignore` to exclude sensitive files
- ✅ Created `.env.example` template

### 2. **API Security**
- ✅ Enhanced CORS configuration
- ✅ Added input validation and sanitization
- ✅ Implemented rate limiting
- ✅ Enhanced security headers with Helmet
- ✅ JWT secret validation

### 3. **Client-Side Security**
- ✅ Environment-based API URL configuration
- ✅ Removed hardcoded localhost URLs
- ✅ Added config loading system

## 🚨 CRITICAL ACTIONS REQUIRED BEFORE DEPLOYMENT

### 1. **IMMEDIATELY Secure Your API Keys**

```bash
# 1. Generate a new Firebase project for production
# 2. Generate a new Gemini API key for production
# 3. Create a strong JWT secret (minimum 32 characters)
openssl rand -base64 32
```

### 2. **Update Environment Variables**

Create a new `.env` file in `gemini-proxy/` folder with:

```env
# Production Environment Variables
GEMINI_API_KEY=your_new_production_gemini_key
JWT_SECRET=your_super_secure_random_jwt_secret_here_minimum_32_characters
NODE_ENV=production
FRONTEND_ORIGIN=https://your-vercel-domain.vercel.app
```

### 3. **Update Production Config**

In `js/config.js`, update the production configuration:

```javascript
production: {
  apiUrl: 'https://your-backend-server.onrender.com', // Your actual backend URL
  firebase: {
    apiKey: "your_production_firebase_api_key",
    authDomain: "your-production-auth-domain",
    projectId: "your-production-project-id",
    storageBucket: "your-production-storage-bucket",
    messagingSenderId: "your-production-sender-id",
    appId: "your-production-app-id"
  }
}
```

## 📋 Deployment Steps

### Phase 1: Backend Deployment (Deploy First)

1. **Deploy to Render/Railway/Heroku:**
   ```bash
   # In gemini-proxy folder
   npm install
   
   # Set environment variables in your hosting platform:
   GEMINI_API_KEY=your_new_key
   JWT_SECRET=your_secure_secret
   NODE_ENV=production
   FRONTEND_ORIGIN=https://your-vercel-domain.vercel.app
   ```

2. **Test Backend:**
   - Test endpoints: `/api/signup`, `/api/login`, `/chat`
   - Verify CORS is working
   - Check rate limiting

   If you plan to host on Firebase, a recommended pattern is: Firebase Hosting (static frontend) + Cloud Run (containerized backend). Below are step-by-step instructions.

   Firebase + Cloud Run (recommended)

   1. Install Firebase and gcloud CLIs

   ```powershell
   npm i -g firebase-tools
   # Install Google Cloud SDK from https://cloud.google.com/sdk and run gcloud init
   gcloud init
   ```

   2. Build and push container to Google Cloud Artifact Registry (or use Cloud Build)

   ```powershell
   # From gemini-proxy/ folder
   gcloud builds submit --tag gcr.io/$(gcloud config get-value project)/gemini-proxy:latest

   # Deploy to Cloud Run
   gcloud run deploy gemini-proxy \
      --image gcr.io/$(gcloud config get-value project)/gemini-proxy:latest \
      --platform managed \
      --region us-central1 \
      --allow-unauthenticated \
      --set-env-vars "GEMINI_API_KEY=your_gemini_key,JWT_SECRET=your_jwt_secret,NODE_ENV=production,FRONTEND_ORIGIN=https://your-vercel-domain"
   ```

   3. Configure Firebase Hosting to rewrite API calls to Cloud Run (optional)

   ```json
   // firebase.json (snippet)
   {
      "hosting": {
         "public": "./",
         "rewrites": [
            {
               "source": "/api/**",
               "run": {
                  "serviceId": "gemini-proxy",
                  "region": "us-central1"
               }
            }
         ]
      }
   }
   ```

   4. Deploy frontend to Firebase Hosting

   ```powershell
   # From project root (where index.html exists)
   firebase login
   firebase init hosting
   firebase deploy --only hosting
   ```


### Phase 2: Frontend Deployment (Deploy Second)

1. **Update Config:**
   - Update `js/config.js` with your actual backend URL
   - Update Firebase config for production

2. **Deploy to Vercel:**
   ```bash
   # In main project folder
   vercel --prod
   ```

3. **Update Backend CORS:**
   - Add your Vercel domain to `FRONTEND_ORIGIN`

### Phase 3: Firebase Setup

1. **Create Production Firebase Project**
2. **Enable Authentication:**
   - Email/Password authentication
   - Configure authorized domains
3. **Set up Firestore Security Rules:**
   ```javascript
   rules_version = '2';
   service cloud.firestore {
     match /databases/{database}/documents {
       match /{document=**} {
         allow read, write: if request.auth != null;
       }
     }
   }
   ```

## 🔐 Security Checklist

- [ ] **New API Keys Generated** - Never reuse exposed keys
- [ ] **Strong JWT Secret** - Minimum 32 characters, randomly generated
- [ ] **Environment Variables Set** - All secrets in environment, not code
- [ ] **CORS Configured** - Only your domains allowed
- [ ] **Firebase Rules** - Proper authentication required
- [ ] **Rate Limiting Active** - API endpoints protected
- [ ] **HTTPS Enforced** - All traffic encrypted
- [ ] **Input Validation** - All user inputs sanitized

## 🚨 Post-Deployment Security

### 1. **Monitor Your APIs**
- Check logs for unusual activity
- Monitor API usage/costs
- Set up billing alerts

### 2. **Regular Updates**
```bash
# Update dependencies regularly
npm audit fix
npm update
```

### 3. **Backup Strategy**
- Regular database backups
- Environment variable backups
- Code repository backups

## ⚠️ Common Deployment Issues

1. **CORS Errors:** Update `FRONTEND_ORIGIN` with exact domain
2. **404 on API:** Check backend URL in config.js
3. **Auth Issues:** Verify Firebase config
4. **Rate Limiting:** Check if limits are too strict

## 🎯 Performance Optimizations

1. **Enable Compression:**
   ```javascript
   // Add to server.js
   const compression = require('compression');
   app.use(compression());
   ```

2. **Cache Static Assets:**
   ```javascript
   // Add cache headers
   app.use(express.static('public', {
     maxAge: '1d',
     etag: false
   }));
   ```

## 📞 Support

If you encounter issues:
1. Check browser console for errors
2. Check server logs
3. Verify all environment variables are set
4. Test API endpoints individually

---

**⚠️ REMEMBER: Never commit `.env` files or expose API keys in client code!**