#!/bin/bash

# Transport Management System Deployment Script
# This script automates the deployment process

echo "🚀 Starting Transport Management System Deployment..."

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check if we're in the right directory
if [ ! -f "package.json" ]; then
    print_error "package.json not found. Please run this script from the project root."
    exit 1
fi

# Step 1: Install dependencies
print_status "Installing dependencies..."
npm install
if [ $? -eq 0 ]; then
    print_success "Dependencies installed successfully"
else
    print_error "Failed to install dependencies"
    exit 1
fi

# Step 2: Run linting
print_status "Running linting checks..."
npm run lint
if [ $? -eq 0 ]; then
    print_success "Linting passed"
else
    print_warning "Linting issues found, but continuing with deployment"
fi

# Step 3: TypeScript compilation check
print_status "Checking TypeScript compilation..."
npx tsc --noEmit
if [ $? -eq 0 ]; then
    print_success "TypeScript compilation check passed"
else
    print_error "TypeScript compilation failed"
    exit 1
fi

# Step 4: Build the project
print_status "Building the project..."
npm run build
if [ $? -eq 0 ]; then
    print_success "Build completed successfully"
else
    print_error "Build failed"
    exit 1
fi

# Step 5: Check build output
if [ -d "dist" ]; then
    print_success "Build output directory created"
    echo "Build files:"
    ls -la dist/
else
    print_error "Build output directory not found"
    exit 1
fi

# Step 6: Git operations
print_status "Preparing for deployment..."

# Check if git is available
if ! command -v git &> /dev/null; then
    print_error "Git is not installed or not in PATH"
    exit 1
fi

# Check git status
git status --porcelain
if [ $? -eq 0 ]; then
    print_status "Git status checked"
else
    print_error "Git status check failed"
    exit 1
fi

# Ask user if they want to commit and push
read -p "Do you want to commit and push changes to trigger deployment? (y/n): " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    # Get commit message
    read -p "Enter commit message: " commit_message
    if [ -z "$commit_message" ]; then
        commit_message="Deploy updates - $(date)"
    fi
    
    # Add all changes
    print_status "Adding changes to git..."
    git add .
    
    # Commit changes
    print_status "Committing changes..."
    git commit -m "$commit_message"
    
    # Push to trigger deployment
    print_status "Pushing to trigger deployment..."
    git push origin main
    
    if [ $? -eq 0 ]; then
        print_success "Changes pushed successfully!"
        echo ""
        echo "🌐 Deployment URLs:"
        echo "   Frontend: https://brcmanagement.netlify.app/memo"
        echo "   Backend:  https://brcproject.onrender.com"
        echo ""
        echo "📊 Monitor deployment:"
        echo "   Netlify: https://app.netlify.com/"
        echo "   Render:  https://dashboard.render.com/"
        echo ""
        print_status "Deployment triggered! Check the platforms for build status."
    else
        print_error "Failed to push changes"
        exit 1
    fi
else
    print_status "Skipping git operations. Build is ready for manual deployment."
fi

# Step 7: Health check
print_status "Performing health check..."
sleep 5  # Wait a bit for deployment to start

# Check backend health
backend_health=$(curl -s https://brcproject.onrender.com/api/health)
if [ $? -eq 0 ]; then
    print_success "Backend health check passed"
    echo "Backend status: $backend_health"
else
    print_warning "Backend health check failed (may still be deploying)"
fi

echo ""
print_success "Deployment script completed!"
echo ""
echo "📋 Next steps:"
echo "   1. Monitor deployment progress on Netlify and Render"
echo "   2. Test the application once deployed"
echo "   3. Check the Debug Ledger panel for any sync issues"
echo "   4. Verify real-time functionality across devices"
echo ""
echo "🔗 Useful links:"
echo "   - Application: https://brcmanagement.netlify.app/memo"
echo "   - Debug Guide: SYNC_DEBUG_GUIDE.md"
echo "   - Deployment Guide: DEPLOYMENT_GUIDE.md"
