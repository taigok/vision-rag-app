#!/bin/bash

# Embed Worker Docker Image Rebuild Script
# This script rebuilds and pushes the embed-worker Lambda container image

set -e  # Exit on any error

echo "🔧 Starting embed-worker Docker image rebuild..."

# Variables
REGION="ap-northeast-1"
ACCOUNT_ID="401379601677"
REPO_NAME="embed-worker"
ECR_URI="${ACCOUNT_ID}.dkr.ecr.${REGION}.amazonaws.com/${REPO_NAME}"

echo "📍 Working directory: $(pwd)"

# Step 1: Login to ECR
echo "🔐 Logging in to ECR..."
aws ecr get-login-password --region ${REGION} | docker login --username AWS --password-stdin ${ECR_URI%/*}

# Step 2: Create ECR repository if it doesn't exist
echo "📦 Creating ECR repository if it doesn't exist..."
aws ecr create-repository --repository-name ${REPO_NAME} --region ${REGION} 2>/dev/null || echo "Repository already exists"

# Step 3: Navigate to embed-worker directory
echo "📁 Changing to embed-worker directory..."
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
cd "${PROJECT_ROOT}/amplify/functions/embed-worker"

# Step 4: Build the Docker image for linux/amd64
echo "🏗️  Building Docker image for linux/amd64..."
docker buildx build --platform linux/amd64 --provenance=false -t ${REPO_NAME}:latest --load .

# Step 5: Tag the image for ECR
echo "🏷️  Tagging image for ECR..."
docker tag ${REPO_NAME}:latest ${ECR_URI}:latest

# Step 6: Push to ECR
echo "📤 Pushing image to ECR..."
docker push ${ECR_URI}:latest

echo "✅ Embed-worker Docker image rebuild completed successfully!"
echo "📋 Image URI: ${ECR_URI}:latest"
echo ""
echo "Next steps:"
echo "1. Deploy with: npx ampx sandbox"
echo "2. Test image upload to verify embed-worker triggers correctly"