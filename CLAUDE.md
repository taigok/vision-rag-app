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
- `rawFiles` (default): Original PDF/PPTX uploads and converted images in single bucket
  - `public/` - PDF/PPTX files uploaded by users
  - `private/{userId}/` - User-specific uploads
  - `images/{userId}/{docId}/` - Converted PNG images from documents
- `vectorFiles`: Faiss indexes and metadata (versioned)

### Lambda Functions (Python 3.12)
Convert-worker and embed-worker are in the `storage` resourceGroup to enable S3 triggers; other functions are in the `functions` resourceGroup:

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

# Rebuild and push embed-worker Lambda container image
./scripts/rebuild-embed-worker.sh
```

## Key Implementation Notes

### Function Definitions
All Lambda functions use custom CDK definitions with `defineFunction((scope) => ...)` pattern and `resourceGroupName: 'storage'` to prevent CloudFormation circular dependencies.

### S3 Triggers and Permissions
S3 event triggers are configured natively in Amplify using path-specific triggers in `amplify/storage/resource.ts`:
- PDF/PPTX files in `public/` and `private/` folders trigger convert-worker
- PNG files in `images/` folder trigger embed-worker
- All functions use the same bucket with folder-based organization

### Container Image Deployment
Both convert-worker and embed-worker functions use ECR container images instead of ZIP packages due to system dependencies (PIL, PyMuPDF, poppler, Cohere, Faiss). Use respective rebuild scripts to update images.

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

## Important Implementation Patterns

### Single Bucket Architecture
The system uses a single S3 bucket (`rawFiles`) with folder-based organization instead of separate buckets to avoid circular dependencies:
- Original files: `public/` and `private/{userId}/`
- Generated images: `images/{userId}/{docId}/`
- This allows convert-worker to write images to the same bucket it reads from

### Circular Dependency Resolution
Three patterns identified for avoiding CloudFormation circular dependencies:
- **Pattern A**: Move all related functions to same resourceGroup (`storage`)
- **Pattern B**: Use EventBridge for loose coupling
- **Pattern C**: Manual CLI configuration post-deployment

Current implementation uses Pattern A with convert-worker and embed-worker in `storage` resourceGroup.

### Image Processing Flow Control
Convert-worker includes filtering logic to prevent recursive processing:
```python
if parts[0] == 'images':
    print(f"Skipping image file: {source_key}")
    return
```
This prevents convert-worker from processing its own generated images.