# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a Vision RAG (Retrieval-Augmented Generation) application built with AWS Amplify Gen 2. The system processes PDF/PPTX documents by converting them to images, generating vector embeddings, and enabling semantic search with AI-powered responses using a session-based architecture.

## Architecture

The application follows a serverless pipeline architecture with session-based isolation:

1. **Document Upload** → `sessions/{sessionId}/documents/` in S3 bucket
2. **Image Conversion** → `convert-worker` Lambda (PDF/PPTX → PNG images)
3. **Vector Generation** → `embed-worker` Lambda (Images → unified session Faiss index)
4. **Search & Response** → `search-router` Lambda (Query → AI response via REST API)

### Storage Structure (Session-Based)
- `rawFiles` (default bucket): Session-isolated document processing
  - `sessions/{sessionId}/documents/` - PDF/PPTX files uploaded by users
  - `sessions/{sessionId}/images/` - Converted PNG images from documents
  - `sessions/{sessionId}/index.faiss` - Unified Faiss index per session
  - `sessions/{sessionId}/metadata.json` - Session metadata with document mapping
- `vectorFiles`: Legacy storage (no longer used in current architecture)

### Lambda Functions (Python 3.12)
Convert-worker and embed-worker are in the `storage` resourceGroup to enable S3 triggers; search-router is in the `functions` resourceGroup:

- **convert-worker**: Converts documents to images using PyMuPDF, triggers on `sessions/` prefix
- **embed-worker**: Generates embeddings with Cohere, maintains unified session indexes
- **search-router**: Handles search queries via REST API, uses Gemini Vision Pro for responses

### Frontend Technology Stack
- **Next.js 15** with App Router and Turbopack for development
- **React 19** with TypeScript
- **Tailwind CSS 4** for styling with shadcn/ui components
- **AWS Amplify Gen 2** client libraries for storage and authentication
- **Session-based state management** with React Context and sessionStorage

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

Note: Scripts use dynamic AWS account ID detection for portability across environments.

### Debugging and Monitoring
```bash
# View Lambda function logs (replace with actual function name)
aws logs tail /aws/lambda/amplify-visionragapp-node-sa-EmbedWorkerV9* --since 10m

# List all Lambda log groups
aws logs describe-log-groups --query 'logGroups[?contains(logGroupName, `ConvertWorker`) || contains(logGroupName, `EmbedWorker`) || contains(logGroupName, `SearchRouter`)].logGroupName'

# Test search API directly
curl -X POST "https://{api-id}.execute-api.ap-northeast-1.amazonaws.com/prod/search" \
  -H "Content-Type: application/json" \
  -d '{"query":"test","sessionId":"test-session","topK":5}'
```

### Force Deployment
To force Lambda function redeployment when code changes aren't detected:
1. Update `CODE_VERSION` in respective resource files
2. Update function name version (e.g., `V8` → `V9`)
3. Commit changes to trigger Amplify sandbox deployment

## Key Implementation Notes

### Function Definitions
All Lambda functions use custom CDK definitions with `defineFunction((scope) => ...)` pattern and `resourceGroupName: 'storage'` to prevent CloudFormation circular dependencies.

### S3 Triggers and Permissions (Session-Based)
S3 event triggers are configured in `amplify/backend.ts` for session-based architecture:
- PDF/PPTX files in `sessions/` folder trigger convert-worker
- PNG files in `sessions/` folder trigger embed-worker  
- All functions use the same bucket with session-based organization

### Container Image Deployment
Both convert-worker and embed-worker functions use ECR container images instead of ZIP packages due to system dependencies (PIL, PyMuPDF, poppler, Cohere, Faiss). Use respective rebuild scripts to update images.

**Important**: Lambda functions do not use hardcoded bucket names in environment variables - they rely on dynamic bucket resolution at runtime for portability.

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

### Session-Based Architecture
The system uses session-based isolation to avoid conflicts between different user sessions:
- Each browser session gets a unique ID: `{timestamp}-{randomUUID}`
- All files are stored under `sessions/{sessionId}/` prefix
- Each session maintains its own unified Faiss index and metadata
- Search queries are isolated to the specific session

### REST API Architecture
Search functionality is exposed via API Gateway REST API (`/search` endpoint):
- CORS configured for specific domains (production-ready, no wildcard origins)
- POST requests with JSON body: `{query, sessionId, topK}`
- Returns AI-generated responses with source image references

### Function Version Management
Lambda functions use versioned deployments with `CODE_VERSION` environment variable:
- Increment version numbers to force redeployment
- Function names include version suffixes (e.g., `SearchRouterV4`, `EmbedWorkerV9`)
- Used for debugging and ensuring latest code is deployed

### Error Handling Strategy
Functions fail fast without fallback behavior for production reliability:
- No random embedding generation when APIs fail (removed demo fallbacks)
- No placeholder image generation when document processing fails
- Proper error propagation to frontend with specific error messages
- Authentication required for all storage and data access (no guest permissions)

### Frontend Session Management
- Session IDs stored in browser sessionStorage (tab-specific)
- UI components handle session context via React Context
- Upload and search operations include sessionId parameter