import os
import json
import tempfile
from pathlib import Path
import boto3
import cohere
import faiss
import numpy as np
from PIL import Image
import io
import base64
import google.generativeai as genai

s3_client = boto3.client('s3')
cohere_client = cohere.ClientV2(api_key=os.environ.get('COHERE_API_KEY', ''))

# Configure Gemini
genai.configure(api_key=os.environ.get('GEMINI_API_KEY', ''))

# Global variables for caching (disabled for real-time search)
cached_index = None
cached_metadata = None

def handler(event, context):
    """
    Search for similar images and generate answers using Gemini Vision Pro
    Expects POST request with JSON body containing 'query' (text or image)
    """
    print(f"Event: {json.dumps(event)}")
    
    # Handle CORS preflight request
    if event.get('httpMethod') == 'OPTIONS':
        return {
            'statusCode': 200,
            'headers': {
                'Access-Control-Allow-Origin': 'http://localhost:3000',
                'Access-Control-Allow-Methods': 'POST, OPTIONS',
                'Access-Control-Allow-Headers': 'Content-Type, Authorization, Accept',
                'Access-Control-Allow-Credentials': 'false'
            },
            'body': ''
        }
    
    # Parse request body
    try:
        body = json.loads(event.get('body', '{}'))
    except json.JSONDecodeError:
        return {
            'statusCode': 400,
            'body': json.dumps({'error': 'Invalid JSON in request body'})
        }
    
    query = body.get('query')
    if not query:
        return {
            'statusCode': 400,
            'body': json.dumps({'error': 'Query is required'})
        }
    
    # Get session ID from request
    session_id = body.get('sessionId')
    if not session_id:
        return {
            'statusCode': 400,
            'body': json.dumps({'error': 'sessionId is required'})
        }
    
    top_k = body.get('topK', 5)
    
    try:
        # Load session-specific index
        index, metadata = load_session_index(session_id)
        
        if index is None or index.ntotal == 0:
            return {
                'statusCode': 404,
                'body': json.dumps({'error': 'No documents indexed yet'})
            }
        
        # Generate query embedding
        if isinstance(query, str):
            # Text query
            query_embedding = generate_text_embedding(query)
        else:
            # Image query (base64 encoded)
            query_embedding = generate_image_embedding_from_base64(query.get('image'))
        
        if query_embedding is None:
            return {
                'statusCode': 500,
                'body': json.dumps({'error': 'Failed to generate query embedding'})
            }
        
        # Search for similar vectors
        distances, indices = index.search(
            np.array([query_embedding]).astype('float32'),
            min(top_k, index.ntotal)
        )
        
        # Get image information for top results
        result_images = []
        for idx in indices[0]:
            if idx < 0:  # Invalid index
                continue
            
            # Find the image in metadata
            # For session-based storage, metadata structure is different
            documents = metadata.get('documents', {})
            found = False
            
            for doc_id, doc_data in documents.items():
                # Handle nested document structure from session metadata
                images = doc_data.get('images', [])
                for img in images:
                    # Check if this is the image at the current index
                    if img.get('index') == idx:
                        result_images.append({
                            'bucket': img.get('bucket'),
                            'key': img.get('key'),
                            'document_id': doc_id,
                            'score': float(distances[0][len(result_images) - 1])
                        })
                        found = True
                        break
                
                if found:
                    break
            
            if len(result_images) >= top_k:
                break
        
        # Download images for Gemini
        images_for_gemini = []
        for img_info in result_images[:3]:  # Use top 3 images for Gemini
            try:
                # Download image from S3
                response = s3_client.get_object(
                    Bucket=img_info['bucket'],
                    Key=img_info['key']
                )
                img_bytes = response['Body'].read()
                
                # Convert to PIL Image
                pil_image = Image.open(io.BytesIO(img_bytes))
                images_for_gemini.append(pil_image)
                
            except Exception as e:
                print(f"Error downloading image {img_info['key']}: {e}")
                continue
        
        # Generate answer using Gemini Vision Pro
        if isinstance(query, str):
            query_text = query
        else:
            query_text = query.get('text', 'What is in this image?')
            
        answer = generate_answer_with_gemini(query_text, images_for_gemini)
        
        # Prepare response
        response_data = {
            'answer': answer,
            'sources': result_images,
            'totalResults': len(result_images)
        }
        
        return {
            'statusCode': 200,
            'headers': {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': 'http://localhost:3000',
                'Access-Control-Allow-Methods': 'POST, OPTIONS',
                'Access-Control-Allow-Headers': 'Content-Type, Authorization, Accept'
            },
            'body': json.dumps(response_data)
        }
        
    except Exception as e:
        print(f"Error in search: {e}")
        return {
            'statusCode': 500,
            'headers': {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': 'http://localhost:3000',
                'Access-Control-Allow-Methods': 'POST, OPTIONS',
                'Access-Control-Allow-Headers': 'Content-Type, Authorization, Accept'
            },
            'body': json.dumps({'error': str(e)})
        }

def load_session_index(session_id):
    """Load unified index for a specific session"""
    # For session-based storage, indexes are in the raw files bucket
    # Get the bucket name from environment or use the bucket that triggered this
    raw_bucket = os.environ.get('AMPLIFY_STORAGE_BUCKET_NAME', 
                               os.environ.get('SOURCE_BUCKET', 'raw-files'))
    
    with tempfile.TemporaryDirectory() as temp_dir:
        temp_path = Path(temp_dir)
        
        try:
            # Download session index
            index_key = f"sessions/{session_id}/index.faiss"
            meta_key = f"sessions/{session_id}/metadata.json"
            
            index_path = temp_path / 'index.faiss'
            meta_path = temp_path / 'metadata.json'
            
            # Try to download the session index
            try:
                s3_client.download_file(raw_bucket, index_key, str(index_path))
                s3_client.download_file(raw_bucket, meta_key, str(meta_path))
                
                # Load index and metadata
                index = faiss.read_index(str(index_path))
                with open(meta_path, 'r') as f:
                    metadata = json.load(f)
                
                print(f"Loaded session index with {index.ntotal} vectors")
                return index, metadata
                
            except s3_client.exceptions.NoSuchKey:
                # Session index doesn't exist yet
                print(f"No index found for session {session_id}")
                return None, None
                
        except Exception as e:
            print(f"Error loading session index: {str(e)}")
            return None, None

def load_and_merge_indexes_realtime():
    """Legacy function - kept for backward compatibility"""
    vector_bucket = os.environ['VECTOR_BUCKET']
    
    with tempfile.TemporaryDirectory() as temp_dir:
        temp_path = Path(temp_dir)
        
        # List all individual index files
        all_indexes = []
        
        try:
            # Paginate through all objects in the vector bucket
            paginator = s3_client.get_paginator('list_objects_v2')
            pages = paginator.paginate(
                Bucket=vector_bucket,
                Prefix='private/'
            )
            
            for page in pages:
                if 'Contents' not in page:
                    continue
                
                for obj in page['Contents']:
                    key = obj['Key']
                    
                    # Skip master index files (if any exist)
                    if 'master/' in key:
                        continue
                    
                    # Look for index.index files
                    if key.endswith('/index.index'):
                        # Extract the corresponding meta.json path
                        meta_key = key.replace('/index.index', '/meta.json')
                        
                        all_indexes.append({
                            'index_key': key,
                            'meta_key': meta_key,
                            'last_modified': obj['LastModified']
                        })
            
            if not all_indexes:
                print("No indexes found")
                return None, None
            
            print(f"Found {len(all_indexes)} indexes to merge")
            
            # Create master index
            dimension = 1536  # Cohere embed-v4.0 dimension
            master_index = faiss.IndexFlatL2(dimension)
            master_metadata = {
                'documents': {},
                'merged_count': 0
            }
            
            # Download and merge each index
            for idx_info in all_indexes:
                try:
                    # Download index
                    index_path = temp_path / f"temp_{master_metadata['merged_count']}.index"
                    s3_client.download_file(vector_bucket, idx_info['index_key'], str(index_path))
                    
                    # Download metadata
                    meta_path = temp_path / f"temp_{master_metadata['merged_count']}.json"
                    s3_client.download_file(vector_bucket, idx_info['meta_key'], str(meta_path))
                    
                    # Load index
                    temp_index = faiss.read_index(str(index_path))
                    
                    # Load metadata
                    with open(meta_path, 'r') as f:
                        temp_meta = json.load(f)
                    
                    # Get current size of master index
                    offset = master_index.ntotal
                    
                    # Merge vectors
                    if temp_index.ntotal > 0:
                        # Extract vectors from temp index
                        vectors = np.zeros((temp_index.ntotal, dimension), dtype='float32')
                        for i in range(temp_index.ntotal):
                            vectors[i] = temp_index.reconstruct(i)
                        
                        # Add to master index
                        master_index.add(vectors)
                        
                        # Update metadata
                        doc_id = temp_meta.get('document_id', 'unknown')
                        
                        # Update image metadata with new index positions
                        updated_images = []
                        for i, img in enumerate(temp_meta.get('images', [])):
                            updated_img = img.copy()
                            updated_img['global_index'] = offset + i  # Use enumerate index
                            updated_images.append(updated_img)
                        
                        master_metadata['documents'][doc_id] = {
                            'user_id': temp_meta.get('user_id'),
                            'images': updated_images,
                            'original_index': idx_info['index_key']
                        }
                        
                        master_metadata['merged_count'] += 1
                        
                    print(f"Merged index from {idx_info['index_key']} ({temp_index.ntotal} vectors)")
                    
                except Exception as e:
                    print(f"Error merging index {idx_info['index_key']}: {e}")
                    continue
            
            print(f"Real-time merge complete: {master_index.ntotal} vectors from {master_metadata['merged_count']} documents")
            return master_index, master_metadata
            
        except Exception as e:
            print(f"Error during real-time merge: {e}")
            return None, None

def generate_text_embedding(text):
    """Generate embedding for text query using Cohere"""
    try:
        # Use Cohere's embed API for text
        response = cohere_client.embed(
            model="embed-v4.0",
            texts=[text],
            input_type="search_query",
            embedding_types=["float"]
        )
        
        # Extract embedding from response
        embedding = np.array(response.embeddings.float[0], dtype='float32')
        
        # Normalize the embedding
        embedding = embedding / np.linalg.norm(embedding)
        
        print(f"Generated text embedding with dimension: {len(embedding)}")
        return embedding
    except Exception as e:
        print(f"Error generating text embedding: {e}")
        raise e

def generate_image_embedding_from_base64(image_base64):
    """Generate embedding for base64 encoded image"""
    try:
        # If already a data URI, use it directly
        if image_base64.startswith('data:image/'):
            img_data_uri = image_base64
        else:
            # Decode base64 and create data URI
            img_data_uri = f"data:image/png;base64,{image_base64}"
        
        # Use Cohere's multimodal embedding API
        api_input_document = {
            "content": [
                {"type": "image", "image": img_data_uri}
            ]
        }
        
        response = cohere_client.embed(
            model="embed-v4.0",
            inputs=[api_input_document],
            input_type="search_query",
            embedding_types=["float"]
        )
        
        # Extract embedding from response
        embedding = np.array(response.embeddings.float[0], dtype='float32')
        
        # Normalize the embedding
        embedding = embedding / np.linalg.norm(embedding)
        
        print(f"Generated image embedding with dimension: {len(embedding)}")
        return embedding
    except Exception as e:
        print(f"Error generating image embedding: {e}")
        raise e

def generate_answer_with_gemini(query, images):
    """Generate answer using Gemini Vision Pro"""
    try:
        if not images:
            return "No relevant images found to answer your query."
        
        # Initialize Gemini model (using vision model)
        model = genai.GenerativeModel('gemini-1.5-flash')
        
        # Prepare prompt
        prompt = f"""あなたは文書ページを分析してユーザーの質問に答えるAIアシスタントです。

ユーザーの質問: {query}

指示事項:
1. 提供されたすべての文書ページを注意深く確認してください
2. ユーザーの質問に関連する情報を抽出してください
3. 文書から具体的な詳細を含む、明確で構造化された回答を提供してください
4. グラフ、表、図がある場合は、関連性があればその内容を説明してください
5. 明確性のために、適切な場合は箇条書きや番号付きリストを使用してください
6. 文書に関連情報が含まれていない場合は、その旨を明確に述べてください

重要事項:
- 文書に直接表示されている情報を具体的に引用してください
- 画像に表示されている以上の推測は避けてください
- テキストが不明瞭または部分的にしか見えない場合は、その制限について言及してください
- プロフェッショナルで親切な口調を保ってください
- 必ず日本語で回答してください

以下に表示される文書ページに基づいて回答してください:"""
        
        # Create content with images
        content = [prompt]
        for img in images:
            content.append(img)
        
        # Generate response
        response = model.generate_content(content)
        
        return response.text
        
    except Exception as e:
        print(f"Error generating answer with Gemini: {e}")
        raise e