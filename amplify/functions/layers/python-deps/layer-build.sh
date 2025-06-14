#!/usr/bin/env bash

# Clean up previous builds
rm -rf python python-deps.zip

echo "Building Python Layer using amazonlinux Docker image..."

# Use amazonlinux with Python 3.12 for better compatibility
docker run --rm -v "$PWD":/build -w /build \
  amazonlinux:2023 \
  sh -c "
    dnf install -y python3.12 python3.12-pip zip && \
    python3.12 -m pip install \
      faiss-cpu \
      pillow \
      pdf2image \
      cohere \
      google-generativeai \
      boto3 \
      --target python --no-cache-dir && \
    python3.12 -m pip install \
      pymupdf \
      --target python --no-cache-dir --timeout 300 --retries 3
  "

# Create the zip file if python directory exists
if [ -d "python" ]; then
    zip -r9 python-deps.zip python
    echo "✅ Layer build complete: python-deps.zip ($(du -h python-deps.zip | cut -f1))"
else
    echo "❌ Error: python directory not created"
    exit 1
fi

# Clean up
rm -rf python