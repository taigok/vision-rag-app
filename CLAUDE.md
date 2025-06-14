# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a Vision RAG (Retrieval-Augmented Generation) application built with AWS Amplify Gen 2. The system processes PDF/PPTX documents by converting them to images, generating vector embeddings, and enabling semantic search with AI-powered responses.

## Architecture

The application follows a serverless pipeline architecture:

1. **Document Upload** → `raw-files` S3 bucket
2. **Image Conversion** → `convert-worker` Lambda (PDF/PPTX → PNG images)
3. **Vector Generation** → `embed-worker` Lambda (Images → Faiss index)
4. **Index Consolidation** → `index-merger` Lambda (Periodic merge of indexes)
5. **Search & Response** → `search-router` Lambda (Query → AI response)

### Storage Structure
- `rawFiles` (default): Original PDF/PPTX uploads
- `images`: Converted PNG images from documents  
- `vectorFiles`: Faiss indexes and metadata (versioned)

### Lambda Functions (Python 3.12)
All functions are in the `functions` resource group to avoid circular dependencies:

- **convert-worker**: Converts documents to images using PyMuPDF/pdf2image
- **embed-worker**: Generates embeddings with Cohere, creates Faiss indexes
- **index-merger**: Merges individual indexes into master index (runs every 15 min)
- **search-router**: Handles search queries, uses Gemini Vision Pro for responses

## Development Commands

### Frontend Development
```bash
npm run dev          # Start Next.js dev server with Turbopack
npm run build        # Build production frontend
npm run lint         # Run ESLint
```

### Backend Development
```bash
npx ampx sandbox     # Deploy Amplify backend to personal sandbox
npx ampx generate    # Generate client code for frontend
```

### Python Testing
```bash
# Install test dependencies
pip install -r tests/requirements.txt

# Run all tests
pytest tests/

# Run specific test file
pytest tests/test_convert_worker.py

# Run with coverage
pytest --cov=amplify/functions --cov-report=html tests/
```

### Docker Container Management
```bash
# Rebuild and push convert-worker Lambda container image
./scripts/rebuild-convert-worker.sh

# Setup S3 event triggers for automatic processing
./scripts/setup-s3-triggers.sh
```

### Python Layer Building
```bash
cd amplify/functions/layers/python-deps
./layer-build.sh     # Builds dependencies with Docker (requires faiss-cpu, cohere, etc.)
```

## Key Implementation Notes

### Function Definitions
All Lambda functions use custom CDK definitions with `defineFunction((scope) => ...)` pattern and `resourceGroupName: 'functions'` to prevent CloudFormation circular dependencies.

### S3 Triggers and Permissions
S3 event triggers are configured via `./scripts/setup-s3-triggers.sh` script to avoid CloudFormation circular dependencies. The script:
- Adds Lambda permissions for S3 to invoke functions
- Configures bucket notifications for PDF/PPTX → convert-worker
- Configures bucket notifications for PNG → embed-worker

### Container Image Deployment
The convert-worker function uses ECR container images instead of ZIP packages due to system dependencies (PIL, PyMuPDF, poppler). Use `./scripts/rebuild-convert-worker.sh` to rebuild and push updated images.

### Environment Variables Required
- `COHERE_API_KEY`: For embedding generation
- `GEMINI_API_KEY`: For AI response generation

### File Paths in Tests
Test files include path manipulation to import Lambda handlers:
```python
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '../amplify/functions/[function-name]/src'))
```

### Asset References
Lambda code assets use absolute paths: `'amplify/functions/[function-name]/src'` from project root.