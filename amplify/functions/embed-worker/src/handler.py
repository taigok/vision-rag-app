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
cohere_client = cohere.Client(os.environ.get('COHERE_API_KEY', ''))

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
    # Expected format: private/{userId}/{documentId}/page_XXXX.png
    parts = source_key.split('/')
    if len(parts) < 4 or parts[0] != 'private':
        print(f"Invalid key format: {source_key}")
        return
    
    user_id = parts[1]
    doc_id = parts[2]
    
    # Check if this is a new document (first page)
    if not source_key.endswith('page_0001.png'):
        print(f"Skipping non-first page: {source_key}")
        return
    
    # Process all images for this document
    with tempfile.TemporaryDirectory() as temp_dir:
        temp_path = Path(temp_dir)
        
        # List all images for this document
        prefix = f"private/{user_id}/{doc_id}/"
        response = s3_client.list_objects_v2(
            Bucket=source_bucket,
            Prefix=prefix
        )
        
        if 'Contents' not in response:
            print(f"No images found for document {doc_id}")
            return
        
        # Create Faiss index
        dimension = 1024  # Cohere embed dimension
        index = faiss.IndexFlatL2(dimension)
        
        # Metadata for images
        metadata = {
            'document_id': doc_id,
            'user_id': user_id,
            'images': []
        }
        
        # Process each image
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
                # Add to Faiss index
                index.add(np.array([embedding]).astype('float32'))
                
                # Add to metadata
                metadata['images'].append({
                    'key': image_key,
                    'bucket': source_bucket,
                    'index': len(metadata['images'])
                })
                
                print(f"Added embedding for {image_key}")
        
        # Save Faiss index and metadata
        if index.ntotal > 0:
            # Generate unique index ID
            index_id = str(uuid.uuid4())
            
            # Save Faiss index
            index_path = temp_path / 'index.index'
            faiss.write_index(index, str(index_path))
            
            # Save metadata
            meta_path = temp_path / 'meta.json'
            with open(meta_path, 'w') as f:
                json.dump(metadata, f)
            
            # Upload to vector-files bucket
            vector_bucket = os.environ.get('VECTOR_BUCKET_NAME', os.environ.get('VECTOR_BUCKET', 'vector-files'))
            
            # Upload index
            index_key = f"private/{user_id}/{index_id}/index.index"
            s3_client.upload_file(
                str(index_path),
                vector_bucket,
                index_key
            )
            
            # Upload metadata
            meta_key = f"private/{user_id}/{index_id}/meta.json"
            s3_client.upload_file(
                str(meta_path),
                vector_bucket,
                meta_key,
                ExtraArgs={'ContentType': 'application/json'}
            )
            
            print(f"Successfully created index {index_id} with {index.ntotal} vectors")
            
            return {
                'statusCode': 200,
                'body': json.dumps({
                    'indexId': index_id,
                    'documentId': doc_id,
                    'vectorCount': index.ntotal,
                    'indexLocation': {
                        'bucket': vector_bucket,
                        'indexKey': index_key,
                        'metaKey': meta_key
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
        # Load and preprocess image
        with Image.open(image_path) as img:
            # Convert to RGB if necessary
            if img.mode != 'RGB':
                img = img.convert('RGB')
            
            # Resize to reasonable size for embedding
            # Cohere multimodal models typically expect smaller images
            max_size = (512, 512)
            img.thumbnail(max_size, Image.Resampling.LANCZOS)
            
            # Convert to bytes
            img_byte_arr = io.BytesIO()
            img.save(img_byte_arr, format='PNG')
            img_bytes = img_byte_arr.getvalue()
        
        # For this demo, we'll use a placeholder embedding
        # In production, you would use Cohere's multimodal embedding API
        # when it becomes available, or another vision embedding service
        
        # Generate a random embedding as placeholder
        # Real implementation would call: cohere_client.embed(images=[img_bytes])
        embedding = np.random.randn(1024).astype('float32')
        
        # Normalize the embedding
        embedding = embedding / np.linalg.norm(embedding)
        
        return embedding
        
    except Exception as e:
        print(f"Error generating embedding: {e}")
        return None