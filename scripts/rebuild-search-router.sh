#!/bin/bash

# Search Router Docker Image Rebuild Script
# This script rebuilds and pushes the search-router Lambda container image

set -e  # Exit on any error

echo "🔧 Starting search-router Docker image rebuild..."

# Variables
REGION="ap-northeast-1"
ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
REPO_NAME="search-router"
ECR_URI="${ACCOUNT_ID}.dkr.ecr.${REGION}.amazonaws.com/${REPO_NAME}"
TAG=$(date +%Y%m%d-%H%M%S)

echo "📍 Working directory: $(pwd)"

# Step 1: Login to ECR
echo "🔐 Logging in to ECR..."
aws ecr get-login-password --region ${REGION} | docker login --username AWS --password-stdin ${ECR_URI%/*}

# Step 2: Create ECR repository if it doesn't exist
echo "📦 Creating ECR repository if it doesn't exist..."
aws ecr create-repository --repository-name ${REPO_NAME} --region ${REGION} 2>/dev/null || echo "Repository already exists"

# Step 3: Navigate to search-router directory
echo "📁 Changing to search-router directory..."
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
cd "${PROJECT_ROOT}/amplify/functions/search-router"

# Step 4: Build the Docker image for linux/amd64
echo "🏗️  Building Docker image for linux/amd64..."
# Load environment variables from .env file
if [ -f "${PROJECT_ROOT}/.env" ]; then
    export $(grep -v '^#' "${PROJECT_ROOT}/.env" | xargs)
fi
docker buildx build --platform linux/amd64 --provenance=false \
    --build-arg GEMINI_API_KEY="${GEMINI_API_KEY}" \
    -t ${REPO_NAME}:${TAG} --load .

# Step 5: Tag the image for ECR
echo "🏷️  Tagging image for ECR with tag: ${TAG}..."
docker tag ${REPO_NAME}:${TAG} ${ECR_URI}:${TAG}
docker tag ${REPO_NAME}:${TAG} ${ECR_URI}:latest

# Step 6: Push to ECR
echo "📤 Pushing image to ECR..."
docker push ${ECR_URI}:${TAG}
docker push ${ECR_URI}:latest

# Step 7: Save tag to file for CDK
echo "💾 Saving tag to file..."
TAG_FILE="${PROJECT_ROOT}/amplify/functions/search-router/.ecr-tag"
echo ${TAG} > ${TAG_FILE}

echo "✅ Search-router Docker image rebuild completed successfully!"
echo "📋 Image URI: ${ECR_URI}:${TAG}"
echo "🏷️  Tag: ${TAG}"
echo ""
echo "Next steps:"
echo "1. Update amplify/functions/search-router/resource.ts with the new tag"
echo "2. Deploy with 'npx ampx sandbox'"
echo "3. Test search API to verify deployment"