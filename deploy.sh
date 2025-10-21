#!/bin/bash
# ==============================================================
#  Consolidated Deployment Script for Payroll Voice Project
#  Handles different deployment scenarios
# ==============================================================

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${BLUE}$1${NC}"
}

print_success() {
    echo -e "${GREEN}✅ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠️ $1${NC}"
}

print_error() {
    echo -e "${RED}❌ $1${NC}"
}

# Function to show usage
show_usage() {
    echo "Usage: $0 [COMMAND]"
    echo ""
    echo "Commands:"
    echo "  full        - Complete setup (GCP project, APIs, Terraform, Firebase)"
    echo "  frontend    - Deploy frontend only (assumes infrastructure exists)"
    echo "  update      - Update frontend with new Cloud Function URL and redeploy"
    echo "  help        - Show this help message"
    echo ""
    echo "Examples:"
    echo "  $0 full      # First-time setup"
    echo "  $0 frontend  # Deploy frontend to existing infrastructure"
    echo "  $0 update    # Update and redeploy frontend"
}

# Function for complete setup
deploy_full() {
    print_status "🚀 Starting complete deployment..."
    
    # Check if config.env exists
    if [ ! -f "config.env" ]; then
        print_error "config.env not found! Please create it from config.env.template"
        echo "  cp config.env.template config.env"
        echo "  # Then edit config.env with your values"
        exit 1
    fi
    
    # Run the main setup script
    ./setup_infra.sh
}

# Function for frontend-only deployment
deploy_frontend() {
    print_status "🔥 Deploying frontend only..."
    
    # Get current project ID
    PROJECT_ID=$(gcloud config get-value project 2>/dev/null || echo "")
    
    if [ -z "$PROJECT_ID" ]; then
        print_error "No GCP project selected. Please run 'gcloud config set project YOUR_PROJECT_ID' first"
        exit 1
    fi
    
    print_status "Using project: $PROJECT_ID"
    
    # Check if Firebase is initialized
    if [ ! -f "firebase.json" ]; then
        print_status "Initializing Firebase..."
        firebase login
        
        # Create firebase.json
        cat > firebase.json << EOF
{
  "hosting": {
    "public": "frontend/dist",
    "ignore": [
      "firebase.json",
      "**/.*",
      "**/node_modules/**"
    ],
    "rewrites": [
      {
        "source": "**",
        "destination": "/index.html"
      }
    ]
  }
}
EOF
        
        # Create .firebaserc
        cat > .firebaserc << EOF
{
  "projects": {
    "default": "$PROJECT_ID"
  }
}
EOF
        
        firebase use "$PROJECT_ID"
    else
        print_status "Firebase already initialized"
        firebase use "$PROJECT_ID"
    fi
    
    # Build and deploy frontend
    print_status "Building frontend..."
    cd frontend
    npm run build
    
    print_status "Deploying to Firebase Hosting..."
    cd ..
    firebase deploy --only hosting
    
    print_success "Frontend deployed successfully!"
    print_success "🌍 Your app is live at: https://$PROJECT_ID.web.app"
}

# Function for updating frontend
deploy_update() {
    print_status "🔄 Updating frontend with latest Cloud Function URL..."
    
    # Check if config.env exists
    if [ ! -f "config.env" ]; then
        print_error "config.env not found! Please create it from config.env.template"
        exit 1
    fi
    
    # Get Cloud Function URL from Terraform
    print_status "Getting Cloud Function URL from Terraform..."
    cd terraform
    FUNCTION_URL=$(terraform output -raw function_url)
    cd ..
    
    print_status "Cloud Function URL: $FUNCTION_URL"
    
    # Load configuration and update frontend .env
    source config.env
    cd frontend
    cat > .env << EOF
VITE_API_URL=$FUNCTION_URL
VITE_TARGET_API=$TARGET_API
VITE_SHEET_URL=$SHEET_URL
EOF
    
    print_status "Updated frontend .env with Cloud Function URL"
    
    # Rebuild frontend
    print_status "Building frontend..."
    npm run build
    
    # Redeploy to Firebase
    print_status "Redeploying to Firebase..."
    cd ..
    firebase deploy --only hosting
    
    print_success "Frontend updated and redeployed!"
    print_success "🌍 Your app is live at: https://$(gcloud config get-value project).web.app"
}

# Main script logic
case "${1:-help}" in
    "full")
        deploy_full
        ;;
    "frontend")
        deploy_frontend
        ;;
    "update")
        deploy_update
        ;;
    "help"|*)
        show_usage
        ;;
esac
