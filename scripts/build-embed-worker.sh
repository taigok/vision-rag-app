#!/bin/bash

# Get script directory and project root
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

echo "🔧 Starting embed-worker Docker image build..."
echo "📍 Working directory: $PROJECT_ROOT"

# Change to embed-worker directory
cd "${PROJECT_ROOT}/amplify/functions/embed-worker"

echo "🔐 Logging in to ECR..."
aws ecr get-login-password --region ap-northeast-1 | docker login --username AWS --password-stdin 401379601677.dkr.ecr.ap-northeast-1.amazonaws.com

echo "📦 Creating ECR repository if it doesn't exist..."
aws ecr create-repository --repository-name embed-worker --region ap-northeast-1 2>/dev/null || echo "Repository already exists"

echo "🔨 Building Docker image for Lambda (linux/amd64)..."
docker build --platform linux/amd64 -t embed-worker .

echo "🏷️ Tagging image..."
docker tag embed-worker:latest 401379601677.dkr.ecr.ap-northeast-1.amazonaws.com/embed-worker:latest

echo "📤 Pushing to ECR..."
docker push 401379601677.dkr.ecr.ap-northeast-1.amazonaws.com/embed-worker:latest

echo "✅ embed-worker Docker image build and push completed!"
echo "🔍 You can now deploy with: npx ampx sandbox"