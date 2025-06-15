#!/bin/bash

# Convert Worker Docker Image Rebuild Script
# This script rebuilds and pushes the convert-worker Lambda container image

set -e  # Exit on any error

echo "🔧 Starting convert-worker Docker image rebuild..."

# Variables
REGION="ap-northeast-1"
ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
REPO_NAME="convert-worker"
ECR_URI="${ACCOUNT_ID}.dkr.ecr.${REGION}.amazonaws.com/${REPO_NAME}"
TAG=$(date +%Y%m%d-%H%M%S)

echo "📍 Working directory: $(pwd)"

# Step 1: Login to ECR
echo "🔐 Logging in to ECR..."
aws ecr get-login-password --region ${REGION} | docker login --username AWS --password-stdin ${ECR_URI%/*}

# Step 2: Navigate to convert-worker directory
echo "📁 Changing to convert-worker directory..."
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
cd "${PROJECT_ROOT}/amplify/functions/convert-worker"

# Step 3: Build the Docker image for linux/amd64 with cache
echo "🏗️  Building Docker image for linux/amd64 (with cache)..."
docker buildx build --platform linux/amd64 --provenance=false -t ${REPO_NAME}:${TAG} --load .

# Step 4: Tag the image for ECR
echo "🏷️  Tagging image for ECR with tag: ${TAG}..."
docker tag ${REPO_NAME}:${TAG} ${ECR_URI}:${TAG}
docker tag ${REPO_NAME}:${TAG} ${ECR_URI}:latest

# Step 5: Push to ECR
echo "📤 Pushing image to ECR..."
docker push ${ECR_URI}:${TAG}
docker push ${ECR_URI}:latest

# Step 6: Save tag to file for CDK
echo "💾 Saving tag to file..."
TAG_FILE="${PROJECT_ROOT}/amplify/functions/convert-worker/.ecr-tag"
echo ${TAG} > ${TAG_FILE}

echo "✅ Convert-worker Docker image rebuild completed successfully!"
echo "📋 Image URI: ${ECR_URI}:${TAG}"
echo "🏷️  Tag: ${TAG}"
echo ""
echo "Next steps:"
echo "1. Update amplify/storage/resource.ts with the new tag"
echo "2. Deploy with 'npx ampx sandbox'"
echo "3. Check Lambda logs to verify deployment"