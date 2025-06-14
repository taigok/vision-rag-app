import os
import json
import tempfile
from pathlib import Path
from datetime import datetime
import boto3
import faiss
import numpy as np

s3_client = boto3.client('s3')

def handler(event, context):
    """
    Merge all individual Faiss indexes into a master index
    Triggered by EventBridge rule every 15 minutes
    """
    print(f"Event: {json.dumps(event)}")
    
    vector_bucket = os.environ['VECTOR_BUCKET']
    
    with tempfile.TemporaryDirectory() as temp_dir:
        temp_path = Path(temp_dir)
        
        # List all index files
        all_indexes = []
        all_metadata = []
        
        # Paginate through all objects in the bucket
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
                
                # Skip master index files
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
            print("No indexes found to merge")
            return {
                'statusCode': 200,
                'body': json.dumps({'message': 'No indexes to merge'})
            }
        
        print(f"Found {len(all_indexes)} indexes to merge")
        
        # Sort by last modified date
        all_indexes.sort(key=lambda x: x['last_modified'])
        
        # Create master index
        dimension = 1024  # Cohere embed dimension
        master_index = faiss.IndexFlatL2(dimension)
        master_metadata = {
            'merged_at': datetime.utcnow().isoformat(),
            'source_indexes': [],
            'documents': {}
        }
        
        # Download and merge each index
        for idx_info in all_indexes:
            try:
                # Download index
                index_path = temp_path / f"temp_{len(master_metadata['source_indexes'])}.index"
                s3_client.download_file(vector_bucket, idx_info['index_key'], str(index_path))
                
                # Download metadata
                meta_path = temp_path / f"temp_{len(master_metadata['source_indexes'])}.json"
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
                    
                    master_metadata['source_indexes'].append({
                        'key': idx_info['index_key'],
                        'vectors': temp_index.ntotal,
                        'document_id': doc_id
                    })
                    
                print(f"Merged index from {idx_info['index_key']} ({temp_index.ntotal} vectors)")
                
                # Clean up temp files
                index_path.unlink()
                meta_path.unlink()
                
            except Exception as e:
                print(f"Error merging index {idx_info['index_key']}: {e}")
                continue
        
        # Save master index
        if master_index.ntotal > 0:
            # Save Faiss index
            master_index_path = temp_path / 'latest.index'
            faiss.write_index(master_index, str(master_index_path))
            
            # Save metadata
            master_meta_path = temp_path / 'latest-meta.json'
            with open(master_meta_path, 'w') as f:
                json.dump(master_metadata, f, indent=2)
            
            # Upload to S3
            # Upload index
            s3_client.upload_file(
                str(master_index_path),
                vector_bucket,
                'private/master/latest.index'
            )
            
            # Upload metadata
            s3_client.upload_file(
                str(master_meta_path),
                vector_bucket,
                'private/master/latest-meta.json',
                ExtraArgs={'ContentType': 'application/json'}
            )
            
            print(f"Successfully created master index with {master_index.ntotal} vectors from {len(master_metadata['source_indexes'])} sources")
            
            return {
                'statusCode': 200,
                'body': json.dumps({
                    'totalVectors': master_index.ntotal,
                    'totalDocuments': len(master_metadata['documents']),
                    'mergedIndexes': len(master_metadata['source_indexes'])
                })
            }
        
    return {
        'statusCode': 400,
        'body': json.dumps({'error': 'No vectors merged'})
    }