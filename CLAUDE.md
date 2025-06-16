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
  - `samples/{documentId}/` - Pre-processed sample documents (permanent)
    - Same structure as sessions but not auto-deleted

### Lambda Functions (Python 3.12)
Convert-worker and embed-worker are in the `storage` resourceGroup to enable S3 triggers; search-router is in the `functions` resourceGroup:

- **convert-worker**: Converts documents to images using PyMuPDF, triggers on `sessions/` and `samples/` prefixes
- **embed-worker**: Generates embeddings with Cohere, maintains unified session indexes
- **search-router**: Handles search queries via REST API, uses Gemini Vision Pro for responses
  - Supports both regular sessions and sample documents (via `sample-{documentId}` session IDs)

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

# Rebuild and push search-router Lambda container image
./scripts/rebuild-search-router.sh
```

Note: Scripts use dynamic AWS account ID detection and timestamp-based tagging for portability across environments.

### Debugging and Monitoring
```bash
# View Lambda function logs (replace with actual function name)
aws logs tail /aws/lambda/amplify-visionragapp-node-sa-EmbedWorkerV10* --since 10m

# List all Lambda log groups
aws logs describe-log-groups --query 'logGroups[?contains(logGroupName, `ConvertWorker`) || contains(logGroupName, `EmbedWorker`) || contains(logGroupName, `SearchRouter`)].logGroupName'

# Test search API directly
curl -X POST "https://{api-id}.execute-api.ap-northeast-1.amazonaws.com/prod/search" \
  -H "Content-Type: application/json" \
  -d '{"query":"test","sessionId":"test-session","topK":5}'
```

### Deployment Workflow
**Standard Deployment**:
```bash
npx ampx sandbox     # Deploy backend changes
npm run dev          # Start frontend (separate terminal)
```

**Lambda Function Code Updates**:
1. Rebuild container image: `./scripts/rebuild-[function-name].sh` (builds & pushes to ECR)
2. Deploy Lambda updates: `npx ampx sandbox` (reads `.ecr-tag` and deploys)

**Force Redeployment** (when changes aren't detected):
- Update `CODE_VERSION` in respective resource files (`amplify/functions/*/resource.ts`)
- Follow container update process above

**Container Update Process**:
- Scripts build Docker images and push to ECR with timestamp tags
- `.ecr-tag` files store current image tags for CDK deployment
- `npx ampx sandbox` reads tag files and updates Lambda functions
- **Both steps required**: rebuild script + sandbox deployment

## Key Implementation Notes

### Function Definitions
All Lambda functions use custom CDK definitions with `defineFunction((scope) => ...)` pattern and `resourceGroupName: 'storage'` to prevent CloudFormation circular dependencies.

### S3 Triggers and Permissions
S3 event triggers are configured in `amplify/backend.ts`:
- PDF/PPTX files in `sessions/` and `samples/` folders trigger convert-worker
- PNG files in `sessions/` and `samples/` folders trigger embed-worker  
- All functions use the same bucket with session-based organization
- S3 lifecycle rule auto-deletes `sessions/` files after 1 day (samples are permanent)

### Container Image Deployment
All Lambda functions use ECR container images instead of ZIP packages due to system dependencies:
- **convert-worker**: PyMuPDF, poppler-utils, PIL
- **embed-worker**: Cohere, Faiss, PIL, numpy
- **search-router**: Faiss, google-generativeai, PIL

**Environment Variable Pattern**: Lambda functions use Amplify Gen 2's standard pattern for resource access:
```typescript
// In amplify/backend.ts
(backend.searchRouter.resources.lambda as any).addEnvironment(
  'STORAGE_BUCKET_NAME', 
  rawFilesBucket.bucketName
);
```

### ECR Tag Management
Scripts now generate timestamp-based tags (format: `YYYYMMDD-HHMMSS`) instead of using `latest`:
- Tags are saved to `.ecr-tag` files in respective function directories
- CDK automatically reads these tag files during deployment
- Both timestamp tag and `latest` are pushed to ECR

### Environment Variables Required
Stored in `.env` file at project root:
- `COHERE_API_KEY`: For embedding generation (Cohere API)
- `GEMINI_API_KEY`: For AI response generation (Google Gemini Vision Pro)

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
- Function names include version suffixes (e.g., `SearchRouterV8`, `EmbedWorkerV10`)
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
- Tabbed interface separates user uploads from sample documents

### Sample Documents Feature
- Pre-processed documents available for immediate testing
- Located in `sample-documents/` directory locally
- Deployed to `samples/{documentId}/` in S3
- Accessed via `sample-{documentId}` session IDs in search API
- Currently includes: 大和証券中期経営計画 (Daiwa Securities Medium-term Management Plan)