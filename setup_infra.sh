#!/bin/bash
# ==============================================================
#  Secure Setup Script for Payroll Voice Project
#  Creates GCP project, enables APIs, initializes Firebase,
#  and runs Terraform (with Secret Manager integration)
# ==============================================================

set -e

# ---------- CONFIG LOADING ----------
CONFIG_FILE="config.env"

# Check if config file exists
if [ ! -f "$CONFIG_FILE" ]; then
    echo "❌ Configuration file '$CONFIG_FILE' not found!"
    echo "📋 Please copy 'config.env.template' to '$CONFIG_FILE' and fill in your values:"
    echo "   cp config.env.template $CONFIG_FILE"
    echo "   # Then edit $CONFIG_FILE with your actual values"
    exit 1
fi

# Load configuration from file
echo "📖 Loading configuration from $CONFIG_FILE..."
source "$CONFIG_FILE"

# Validate required variables
if [ -z "$BILLING_ACCOUNT" ] || [ -z "$PROJECT_NAME" ] || [ -z "$REGION" ] || [ -z "$FIREBASE_APP_NAME" ] || [ -z "$OPENAI_API_KEY" ] || [ -z "$TARGET_API" ] || [ -z "$SHEET_URL" ]; then
    echo "❌ Missing required configuration variables!"
    echo "Please ensure the following are set in $CONFIG_FILE:"
    echo "  - BILLING_ACCOUNT"
    echo "  - PROJECT_NAME"
    echo "  - REGION"
    echo "  - FIREBASE_APP_NAME"
    echo "  - OPENAI_API_KEY"
    echo "  - TARGET_API"
    echo "  - SHEET_URL"
    exit 1
fi

echo "✅ Configuration loaded successfully"

echo "🔹 Authenticating with Google..."
gcloud auth login
gcloud auth application-default login

# ---------- CREATE PROJECT ----------
PROJECT_ID="${PROJECT_NAME}-$(date +%s)"
echo "📦 Creating project: $PROJECT_ID"
if [ -n "$ORG_ID" ]; then
    gcloud projects create "$PROJECT_ID" --organization="$ORG_ID"
else
    gcloud projects create "$PROJECT_ID"
fi

if [ -n "$BILLING_ACCOUNT" ]; then
  gcloud beta billing projects link "$PROJECT_ID" \
    --billing-account "$BILLING_ACCOUNT"
fi

gcloud config set project "$PROJECT_ID"

# ---------- ENABLE REQUIRED APIS ----------
echo "⚙️ Enabling APIs..."
gcloud services enable \
  cloudfunctions.googleapis.com \
  cloudbuild.googleapis.com \
  storage.googleapis.com \
  artifactregistry.googleapis.com \
  secretmanager.googleapis.com \
  firebase.googleapis.com \
  firestore.googleapis.com

# ---------- PREPARE TERRAFORM ----------
echo "🧱 Preparing Terraform configuration..."
cd terraform

mkdir -p function_source
cd ../cloud_function
zip -r ../terraform/function_source/extractDates.zip . > /dev/null
cd ../terraform

# Create terraform.tfvars
cat > terraform.tfvars <<EOF
project_id = "$PROJECT_ID"
region     = "$REGION"
openai_api_key = "$OPENAI_API_KEY"
EOF

# ---------- DEPLOY WITH TERRAFORM ----------
echo "🚀 Deploying Cloud Function with Secret Manager..."
terraform init -input=false
terraform apply -auto-approve

# Get Cloud Function URL
FUNCTION_URL=$(terraform output -raw function_url)
echo "📡 Cloud Function URL: $FUNCTION_URL"

# ---------- FIREBASE SETUP ----------
echo "🔥 Setting up Firebase Hosting..."
cd frontend

# Update frontend .env with Cloud Function URL
cat > .env <<EOF
VITE_API_URL=$FUNCTION_URL
VITE_TARGET_API=$TARGET_API
VITE_SHEET_URL=$SHEET_URL
EOF

firebase login
firebase projects:create "$PROJECT_ID" --display-name "$FIREBASE_APP_NAME" || true
firebase use "$PROJECT_ID"

# Initialize hosting (only if not already initialized)
if [ ! -f "../firebase.json" ]; then
    echo "📝 Initializing Firebase hosting configuration..."
    firebase init hosting --project "$PROJECT_ID" --force
else
    echo "✅ Firebase hosting already configured"
fi

# Build and deploy frontend
echo "🏗️ Building frontend..."
if ! npm run build; then
    echo "❌ Frontend build failed!"
    exit 1
fi

echo "🚀 Deploying frontend to Firebase..."
cd ..
if ! firebase deploy --only hosting; then
    echo "❌ Firebase deployment failed!"
    exit 1
fi

# ---------- OUTPUT ----------
echo "✅ Done! Full deployment complete."
echo "📡 Cloud Function: $FUNCTION_URL"
echo "🌍 Frontend: https://$PROJECT_ID.web.app"
echo "🔐 OpenAI key stored in Secret Manager as 'openai-api-key'"
