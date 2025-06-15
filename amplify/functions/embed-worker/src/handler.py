import os
import json
import tempfile
import uuid
from pathlib import Path
import boto3
import cohere
import faiss
import numpy as np
from PIL import Image
import io

s3_client = boto3.client('s3')
cohere_client = cohere.ClientV2(api_key=os.environ.get('COHERE_API_KEY', ''))

def handler(event, context):
    """
    Generate embeddings for images and store in Faiss index
    Triggered by S3 ObjectCreated events on images bucket
    """
    print(f"Event: {json.dumps(event)}")
    
    # Get S3 event details
    record = event['Records'][0]['s3']
    source_bucket = record['bucket']['name']
    source_key = record['object']['key']
    
    # Extract user ID and document info
    parts = source_key.split('/')
    
    # Handle session-based paths: sessions/{sessionId}/images/{docId}-pageXXXX.png
    if parts[0] == 'sessions' and len(parts) >= 4:
        user_id = parts[1]  # session ID
        # Extract doc_id from filename (e.g., "docId-page0001.png")
        filename = parts[3]
        doc_id = filename.split('-page')[0]
    # Legacy paths: images/public/{documentId}/page_XXXX.png or images/private/{userId}/{documentId}/page_XXXX.png
    else:
        print(f"Invalid key format: {source_key}")
        return
    
    # Check if this is a new document (first page)
    if not (source_key.endswith('page0001.png') or source_key.endswith('page_0001.png')):
        print(f"Skipping non-first page: {source_key}")
        return
    
    # Process all images for this document
    with tempfile.TemporaryDirectory() as temp_dir:
        temp_path = Path(temp_dir)
        
        # List all images for this document
        # For session-based storage, images are in same folder with doc_id prefix
        prefix = f"sessions/{user_id}/images/{doc_id}-page"
        response = s3_client.list_objects_v2(
            Bucket=source_bucket,
            Prefix=prefix
        )
        
        if 'Contents' not in response:
            print(f"No images found for document {doc_id}")
            return
        
        # Create Faiss index for all pages in document
        dimension = 1536  # Cohere embed-v4.0 dimension
        index = faiss.IndexFlatL2(dimension)
        
        # Metadata for all images in document
        metadata = {
            'document_id': doc_id,
            'user_id': user_id,
            'images': []
        }
        
        # Process each image in document
        for obj in response['Contents']:
            image_key = obj['Key']
            if not image_key.endswith('.png'):
                continue
            
            # Download image
            image_path = temp_path / Path(image_key).name
            s3_client.download_file(source_bucket, image_key, str(image_path))
            
            # Generate embedding
            embedding = generate_image_embedding(image_path)
            
            if embedding is not None:
                # Print embedding dimension for debugging
                print(f"Embedding dimension: {len(embedding)}")
                print(f"Faiss index dimension: {index.d}")
                print(f"Embedding shape: {np.array([embedding]).shape}")
                
                # Add to Faiss index
                index.add(np.array([embedding]).astype('float32'))
                
                # Add to metadata
                metadata['images'].append({
                    'key': image_key,
                    'bucket': source_bucket,
                    'index': len(metadata['images']),
                    'page_file': Path(image_key).name
                })
                
                print(f"Added embedding for {image_key}")
        
        # Save Faiss index and metadata
        if index.ntotal > 0:
            # Generate index ID for document
            index_id = doc_id
            
            # Save Faiss index
            index_path = temp_path / 'index.index'
            faiss.write_index(index, str(index_path))
            
            # Save metadata
            meta_path = temp_path / 'meta.json'
            with open(meta_path, 'w') as f:
                json.dump(metadata, f)
            
            # Upload to vector-files bucket
            vector_bucket = os.environ.get('VECTOR_BUCKET_NAME', os.environ.get('VECTOR_BUCKET', 'vector-files'))
            
            # For session-based storage, we'll maintain a single index per session
            # Load existing session index if exists
            session_index_key = f"sessions/{user_id}/index.faiss"
            session_meta_key = f"sessions/{user_id}/metadata.json"
            
            try:
                # Try to download existing index
                existing_index_path = temp_path / 'existing_index.faiss'
                existing_meta_path = temp_path / 'existing_meta.json'
                
                # Use source bucket for session data
                s3_client.download_file(source_bucket, session_index_key, str(existing_index_path))
                s3_client.download_file(source_bucket, session_meta_key, str(existing_meta_path))
                
                # Load and merge with existing index
                existing_index = faiss.read_index(str(existing_index_path))
                existing_index.add(index.reconstruct_n(0, index.ntotal))
                index = existing_index
                
                # Load and merge metadata
                with open(existing_meta_path, 'r') as f:
                    existing_meta = json.load(f)
                # Update metadata with new document
                existing_meta['documents'][doc_id] = metadata
                metadata = existing_meta
            except:
                # First document in session, create new metadata structure
                metadata = {
                    'session_id': user_id,
                    'documents': {
                        doc_id: metadata
                    }
                }
            
            # Save updated index and metadata
            faiss.write_index(index, str(index_path))
            with open(meta_path, 'w') as f:
                json.dump(metadata, f)
            
            # Upload unified session index to source bucket
            s3_client.upload_file(
                str(index_path),
                source_bucket,
                session_index_key
            )
            s3_client.upload_file(
                str(meta_path),
                source_bucket,
                session_meta_key,
                ExtraArgs={'ContentType': 'application/json'}
            )
            
            print(f"Successfully created document index {index_id} with {index.ntotal} vectors")
            
            return {
                'statusCode': 200,
                'body': json.dumps({
                    'indexId': index_id,
                    'documentId': doc_id,
                    'vectorCount': index.ntotal,
                    'pageCount': len(metadata['documents'][doc_id]['images']) if 'documents' in metadata else len(metadata['images']),
                    'indexLocation': {
                        'bucket': source_bucket,
                        'indexKey': session_index_key,
                        'metaKey': session_meta_key
                    }
                })
            }
    
    return {
        'statusCode': 400,
        'body': json.dumps({'error': 'No embeddings generated'})
    }

def generate_image_embedding(image_path):
    """Generate embedding for an image using Cohere"""
    try:
        # Load and preprocess image (following Colab implementation)
        with Image.open(image_path) as img:
            # Get original format or default to PNG
            img_format = img.format if img.format else "PNG"
            
            # Convert to RGB if necessary
            if img.mode != 'RGB':
                img = img.convert('RGB')
            
            # Resize to reasonable size for embedding (Colab uses max_pixels limit)
            max_pixels = 1568 * 1568  # Following Colab implementation
            org_width, org_height = img.size
            
            if org_width * org_height > max_pixels:
                scale_factor = (max_pixels / (org_width * org_height)) ** 0.5
                new_width = int(org_width * scale_factor)
                new_height = int(org_height * scale_factor)
                img.thumbnail((new_width, new_height))
            
            # Convert to bytes using the same format as Colab
            img_byte_arr = io.BytesIO()
            img.save(img_byte_arr, format=img_format)
            img_byte_arr.seek(0)
            img_bytes = img_byte_arr.getvalue()
        
        # Convert to base64 data URI for Cohere API (exactly like Colab)
        import base64
        img_base64 = base64.b64encode(img_bytes).decode('utf-8')
        img_data_uri = f"data:image/{img_format.lower()};base64,{img_base64}"
        
        # Debug: Check data URI format
        print(f"Data URI length: {len(img_data_uri)}")
        print(f"Data URI prefix: {img_data_uri[:50]}...")
        print(f"Base64 length: {len(img_base64)}")
        
        # Validate data URI format
        if not img_data_uri.startswith('data:image/'):
            print("ERROR: Invalid data URI prefix")
        if ';base64,' not in img_data_uri:
            print("ERROR: Missing base64 marker")
        
        # Use Cohere's multimodal embedding API (official format from Colab notebook)
        try:
            # Create image input in the correct format for ClientV2
            api_input_document = {
                "content": [
                    {"type": "image", "image": img_data_uri}
                ]
            }
            
            response = cohere_client.embed(
                model="embed-v4.0",
                inputs=[api_input_document],
                input_type="search_document",
                embedding_types=["float"]
            )
            
            # Extract embedding from ClientV2 response (correct format from Colab)
            embedding = np.array(response.embeddings.float[0], dtype='float32')
            
            # Normalize the embedding
            embedding = embedding / np.linalg.norm(embedding)
            
            print(f"Generated real Cohere embedding with dimension: {len(embedding)}")
            return embedding
            
        except Exception as cohere_error:
            print(f"Cohere API error: {cohere_error}")
            print(f"Error type: {type(cohere_error)}")
            if hasattr(cohere_error, 'response'):
                print(f"Response status: {cohere_error.response.status_code}")
                print(f"Response content: {cohere_error.response.text}")
            
            # Raise error instead of using random embedding in production
            raise Exception(f"Embedding generation failed: {cohere_error}")
        
    except Exception as e:
        print(f"Error generating embedding: {e}")
        return None