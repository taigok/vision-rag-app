#!/bin/bash

# S3 Event Notification Setup Script
# This script configures S3 event triggers for Lambda functions

set -e  # Exit on any error

echo "🔧 Setting up S3 event notifications for Lambda triggers..."

# Variables from amplify_outputs.json
REGION="ap-northeast-1"
ACCOUNT_ID="401379601677"

# Extract values from amplify_outputs.json
RAW_FILES_BUCKET=$(jq -r '.custom.rawFilesBucketName' amplify_outputs.json)
IMAGES_BUCKET=$(jq -r '.custom.imagesBucketName' amplify_outputs.json)
VECTOR_FILES_BUCKET=$(jq -r '.custom.vectorFilesBucketName' amplify_outputs.json)
CONVERT_WORKER_FUNCTION=$(jq -r '.custom.convertWorkerFunctionName' amplify_outputs.json)
EMBED_WORKER_FUNCTION=$(jq -r '.custom.embedWorkerFunctionName' amplify_outputs.json)

echo "📋 Configuration:"
echo "  Raw Files Bucket: $RAW_FILES_BUCKET"
echo "  Images Bucket: $IMAGES_BUCKET"
echo "  Convert Worker Function: $CONVERT_WORKER_FUNCTION"
echo "  Embed Worker Function: $EMBED_WORKER_FUNCTION"

# Step 1: Add Lambda permissions for S3 to invoke functions
echo "🔐 Adding Lambda permissions for S3 invocation..."

# Permission for convert-worker
aws lambda add-permission \
    --function-name "$CONVERT_WORKER_FUNCTION" \
    --principal "s3.amazonaws.com" \
    --statement-id "s3-convert-permission-pdf" \
    --action "lambda:InvokeFunction" \
    --source-arn "arn:aws:s3:::$RAW_FILES_BUCKET" \
    --region "$REGION" || echo "Permission may already exist for PDF"

aws lambda add-permission \
    --function-name "$CONVERT_WORKER_FUNCTION" \
    --principal "s3.amazonaws.com" \
    --statement-id "s3-convert-permission-pptx" \
    --action "lambda:InvokeFunction" \
    --source-arn "arn:aws:s3:::$RAW_FILES_BUCKET" \
    --region "$REGION" || echo "Permission may already exist for PPTX"

# Permission for embed-worker
aws lambda add-permission \
    --function-name "$EMBED_WORKER_FUNCTION" \
    --principal "s3.amazonaws.com" \
    --statement-id "s3-embed-permission" \
    --action "lambda:InvokeFunction" \
    --source-arn "arn:aws:s3:::$IMAGES_BUCKET" \
    --region "$REGION" || echo "Permission may already exist"

# Step 2: Configure S3 event notifications for raw-files bucket (convert-worker)
echo "📤 Configuring raw-files bucket notifications for convert-worker..."

RAW_FILES_NOTIFICATION='{
  "LambdaConfigurations": [
    {
      "Id": "convert-worker-pdf-trigger",
      "LambdaFunctionArn": "arn:aws:lambda:'$REGION':'$ACCOUNT_ID':function:'$CONVERT_WORKER_FUNCTION'",
      "Events": ["s3:ObjectCreated:*"],
      "Filter": {
        "Key": {
          "FilterRules": [
            {"Name": "prefix", "Value": "public/"},
            {"Name": "suffix", "Value": ".pdf"}
          ]
        }
      }
    },
    {
      "Id": "convert-worker-pptx-trigger",
      "LambdaFunctionArn": "arn:aws:lambda:'$REGION':'$ACCOUNT_ID':function:'$CONVERT_WORKER_FUNCTION'",
      "Events": ["s3:ObjectCreated:*"],
      "Filter": {
        "Key": {
          "FilterRules": [
            {"Name": "prefix", "Value": "public/"},
            {"Name": "suffix", "Value": ".pptx"}
          ]
        }
      }
    }
  ]
}'

aws s3api put-bucket-notification-configuration \
    --bucket "$RAW_FILES_BUCKET" \
    --notification-configuration "$RAW_FILES_NOTIFICATION" \
    --region "$REGION"

# Step 3: Configure S3 event notifications for images bucket (embed-worker)
echo "🖼️  Configuring images bucket notifications for embed-worker..."

IMAGES_NOTIFICATION='{
  "LambdaConfigurations": [
    {
      "Id": "embed-worker-png-trigger",
      "LambdaFunctionArn": "arn:aws:lambda:'$REGION':'$ACCOUNT_ID':function:'$EMBED_WORKER_FUNCTION'",
      "Events": ["s3:ObjectCreated:*"],
      "Filter": {
        "Key": {
          "FilterRules": [
            {"Name": "prefix", "Value": "public/"},
            {"Name": "suffix", "Value": ".png"}
          ]
        }
      }
    }
  ]
}'

aws s3api put-bucket-notification-configuration \
    --bucket "$IMAGES_BUCKET" \
    --notification-configuration "$IMAGES_NOTIFICATION" \
    --region "$REGION"

echo "✅ S3 event notifications configured successfully!"
echo ""
echo "📋 Configured triggers:"
echo "  1. $RAW_FILES_BUCKET → $CONVERT_WORKER_FUNCTION (PDF/PPTX files in public/)"
echo "  2. $IMAGES_BUCKET → $EMBED_WORKER_FUNCTION (PNG files in public/)"
echo ""
echo "🧪 Test by uploading a PDF or PPTX file to the raw-files bucket public/ folder"