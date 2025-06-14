#!/usr/bin/env bash

# Clean up previous builds
rm -rf python python-deps.zip

# Build the layer using AWS Lambda Python 3.12 runtime container
docker run --rm -v "$PWD":/var/task public.ecr.aws/lambda/python:3.12 \
  bash -c "
    pip install \
      faiss-cpu \
      pillow \
      pymupdf \
      pdf2image \
      cohere \
      google-generativeai \
      boto3 \
      --target python && \
    exit
  "

# Create the zip file
zip -r9 python-deps.zip python

# Clean up
rm -rf python

echo "Layer build complete: python-deps.zip"