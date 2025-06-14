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

# Global variables for caching
cached_index = None
cached_metadata = None
cached_index_path = '/tmp/latest.index'
cached_meta_path = '/tmp/latest-meta.json'

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
        # Load or download the index
        index, metadata = load_or_download_index()
        
        if index is None or index.ntotal == 0:
            return {
                'statusCode': 404,
                'body': json.dumps({'error': 'No index available for search'})
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

def load_or_download_index():
    """Load index from cache or download from S3"""
    global cached_index, cached_metadata
    
    # Check if cached files exist
    if os.path.exists(cached_index_path) and os.path.exists(cached_meta_path):
        try:
            # Load from cache
            cached_index = faiss.read_index(cached_index_path)
            with open(cached_meta_path, 'r') as f:
                cached_metadata = json.load(f)
            print("Loaded index from cache")
            return cached_index, cached_metadata
        except Exception as e:
            print(f"Error loading cached index: {e}")
    
    # Download from S3
    vector_bucket = os.environ['VECTOR_BUCKET']
    
    try:
        # Download index
        s3_client.download_file(
            vector_bucket,
            'private/master/latest.index',
            cached_index_path
        )
        
        # Download metadata
        s3_client.download_file(
            vector_bucket,
            'private/master/latest-meta.json',
            cached_meta_path
        )
        
        # Load index
        cached_index = faiss.read_index(cached_index_path)
        with open(cached_meta_path, 'r') as f:
            cached_metadata = json.load(f)
        
        print(f"Downloaded and loaded index with {cached_index.ntotal} vectors")
        return cached_index, cached_metadata
        
    except Exception as e:
        print(f"Error downloading index: {e}")
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