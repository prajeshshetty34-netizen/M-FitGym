#!/bin/bash
# Helper to build and deploy the gemini-proxy container to Cloud Run

if [ -z "$GOOGLE_PROJECT" ]; then
  echo "Set GOOGLE_PROJECT env var or run: gcloud config set project <PROJECT_ID>"; exit 1
fi

IMAGE=gcr.io/$(gcloud config get-value project)/gemini-proxy:latest

echo "Building and submitting container..."
gcloud builds submit --tag $IMAGE

echo "Deploying to Cloud Run..."
gcloud run deploy gemini-proxy \
  --image $IMAGE \
  --platform managed \
  --region us-central1 \
  --allow-unauthenticated \
  --set-env-vars "GEMINI_API_KEY=${GEMINI_API_KEY},JWT_SECRET=${JWT_SECRET},NODE_ENV=production,FRONTEND_ORIGIN=${FRONTEND_ORIGIN}"

echo "Done. Run 'gcloud run services list' to see the URL."
