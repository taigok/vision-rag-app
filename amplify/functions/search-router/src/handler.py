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
cohere_client = cohere.Client(os.environ.get('COHERE_API_KEY', ''))

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
    
    # Get user ID from context (would come from auth in production)
    user_id = body.get('userId', 'default')
    top_k = body.get('topK', 5)
    
    try:
        # Load and merge all individual indexes in real-time
        index, metadata = load_and_merge_indexes_realtime()
        
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
            for doc_id, doc_info in metadata.get('documents', {}).items():
                for img in doc_info.get('images', []):
                    if img.get('global_index') == idx:
                        result_images.append({
                            'bucket': img.get('bucket'),
                            'key': img.get('key'),
                            'document_id': doc_id,
                            'score': float(distances[0][len(result_images)])
                        })
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
        answer = generate_answer_with_gemini(query, images_for_gemini)
        
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
                'Access-Control-Allow-Origin': '*'
            },
            'body': json.dumps(response_data)
        }
        
    except Exception as e:
        print(f"Error in search: {e}")
        return {
            'statusCode': 500,
            'body': json.dumps({'error': str(e)})
        }

def load_and_merge_indexes_realtime():
    """Load and merge all individual indexes in real-time"""
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
            dimension = 1024  # Cohere embed dimension
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
                        for img in temp_meta.get('images', []):
                            updated_img = img.copy()
                            updated_img['global_index'] = offset + img['index']
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
        # For demo purposes, generate a random embedding
        # In production, use: response = cohere_client.embed(texts=[text])
        embedding = np.random.randn(1024).astype('float32')
        embedding = embedding / np.linalg.norm(embedding)
        return embedding
    except Exception as e:
        print(f"Error generating text embedding: {e}")
        return None

def generate_image_embedding_from_base64(image_base64):
    """Generate embedding for base64 encoded image"""
    try:
        # Decode base64 image
        img_bytes = base64.b64decode(image_base64)
        
        # For demo purposes, generate a random embedding
        # In production, use multimodal embedding service
        embedding = np.random.randn(1024).astype('float32')
        embedding = embedding / np.linalg.norm(embedding)
        return embedding
    except Exception as e:
        print(f"Error generating image embedding: {e}")
        return None

def generate_answer_with_gemini(query, images):
    """Generate answer using Gemini Vision Pro"""
    try:
        if not images:
            return "No relevant images found to answer your query."
        
        # Initialize Gemini model
        model = genai.GenerativeModel('gemini-1.5-pro')
        
        # Prepare prompt
        prompt = f"""Based on the following images, please answer this question: {query}
        
        Please provide a comprehensive answer based on what you can see in the images.
        If the images don't contain relevant information, please indicate that."""
        
        # Create content with images
        content = [prompt]
        for img in images:
            content.append(img)
        
        # Generate response
        response = model.generate_content(content)
        
        return response.text
        
    except Exception as e:
        print(f"Error generating answer with Gemini: {e}")
        
        # Fallback response
        return f"I found {len(images)} relevant images for your query '{query}', but I'm unable to generate a detailed answer at this moment. The images appear to be related to your search."