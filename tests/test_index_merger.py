import pytest
import json
import tempfile
from pathlib import Path
from unittest.mock import Mock, patch, MagicMock
import numpy as np
from datetime import datetime
import sys
import os

# Add src directory to path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '../amplify/functions/index-merger/src'))

from handler import handler

class TestIndexMerger:
    """Test cases for index-merger Lambda function"""
    
    @patch('handler.s3_client')
    @patch('handler.faiss')
    def test_handler_merge_multiple_indexes(self, mock_faiss, mock_s3):
        """Test merging multiple indexes successfully"""
        # Setup test event (EventBridge event)
        event = {
            'source': 'aws.events',
            'detail-type': 'Scheduled Event'
        }
        
        # Mock S3 paginator
        mock_paginator = Mock()
        mock_page = {
            'Contents': [
                {'Key': 'private/user1/idx1/index.index', 'LastModified': datetime.now()},
                {'Key': 'private/user1/idx1/meta.json', 'LastModified': datetime.now()},
                {'Key': 'private/user2/idx2/index.index', 'LastModified': datetime.now()},
                {'Key': 'private/master/latest.index', 'LastModified': datetime.now()},  # Should be skipped
            ]
        }
        mock_paginator.paginate.return_value = [mock_page]
        mock_s3.get_paginator.return_value = mock_paginator
        
        # Mock S3 download
        mock_s3.download_file = Mock()
        
        # Mock individual indexes
        mock_index1 = Mock()
        mock_index1.ntotal = 5
        mock_index1.reconstruct = Mock(side_effect=lambda i: np.random.randn(1024).astype('float32'))
        
        mock_index2 = Mock()
        mock_index2.ntotal = 3
        mock_index2.reconstruct = Mock(side_effect=lambda i: np.random.randn(1024).astype('float32'))
        
        # Mock master index
        mock_master_index = Mock()
        mock_master_index.ntotal = 0
        mock_master_index.add = Mock()
        
        # Mock Faiss operations
        mock_faiss.IndexFlatL2.return_value = mock_master_index
        mock_faiss.read_index.side_effect = [mock_index1, mock_index2]
        mock_faiss.write_index = Mock()
        
        # Mock metadata files
        meta1 = {
            'document_id': 'doc1',
            'user_id': 'user1',
            'images': [{'index': 0, 'key': 'img1.png'}]
        }
        meta2 = {
            'document_id': 'doc2',
            'user_id': 'user2',
            'images': [{'index': 0, 'key': 'img2.png'}]
        }
        
        # Mock file operations
        with patch('builtins.open', create=True) as mock_open:
            mock_open.return_value.__enter__.return_value.read.side_effect = [
                json.dumps(meta1),
                json.dumps(meta2)
            ]
            
            # Mock S3 upload
            mock_s3.upload_file = Mock()
            
            # Set environment variable
            with patch.dict('os.environ', {'VECTOR_BUCKET': 'vector-files'}):
                # Call handler
                result = handler(event, {})
        
        # Assertions
        assert result['statusCode'] == 200
        body = json.loads(result['body'])
        assert body['totalVectors'] == 8  # 5 + 3
        assert body['totalDocuments'] == 2
        assert body['mergedIndexes'] == 2
        
        # Verify operations
        assert mock_s3.download_file.call_count == 4  # 2 indexes + 2 metadata
        assert mock_master_index.add.call_count == 2
        assert mock_s3.upload_file.call_count == 2  # Master index + metadata
    
    @patch('handler.s3_client')
    def test_handler_no_indexes_found(self, mock_s3):
        """Test handler when no indexes are found"""
        event = {
            'source': 'aws.events',
            'detail-type': 'Scheduled Event'
        }
        
        # Mock empty S3 response
        mock_paginator = Mock()
        mock_paginator.paginate.return_value = [{}]
        mock_s3.get_paginator.return_value = mock_paginator
        
        with patch.dict('os.environ', {'VECTOR_BUCKET': 'vector-files'}):
            result = handler(event, {})
        
        # Should return success with no indexes message
        assert result['statusCode'] == 200
        body = json.loads(result['body'])
        assert body['message'] == 'No indexes to merge'
    
    @patch('handler.s3_client')
    @patch('handler.faiss')
    def test_handler_skip_master_indexes(self, mock_faiss, mock_s3):
        """Test handler skips master index files"""
        event = {
            'source': 'aws.events',
            'detail-type': 'Scheduled Event'
        }
        
        # Mock S3 response with only master indexes
        mock_paginator = Mock()
        mock_page = {
            'Contents': [
                {'Key': 'private/master/latest.index', 'LastModified': datetime.now()},
                {'Key': 'private/master/latest-meta.json', 'LastModified': datetime.now()},
            ]
        }
        mock_paginator.paginate.return_value = [mock_page]
        mock_s3.get_paginator.return_value = mock_paginator
        
        with patch.dict('os.environ', {'VECTOR_BUCKET': 'vector-files'}):
            result = handler(event, {})
        
        # Should return success with no indexes message
        assert result['statusCode'] == 200
        body = json.loads(result['body'])
        assert body['message'] == 'No indexes to merge'
    
    @patch('handler.s3_client')
    @patch('handler.faiss')
    def test_handler_error_handling(self, mock_faiss, mock_s3):
        """Test error handling during index merge"""
        event = {
            'source': 'aws.events',
            'detail-type': 'Scheduled Event'
        }
        
        # Mock S3 paginator
        mock_paginator = Mock()
        mock_page = {
            'Contents': [
                {'Key': 'private/user1/idx1/index.index', 'LastModified': datetime.now()},
            ]
        }
        mock_paginator.paginate.return_value = [mock_page]
        mock_s3.get_paginator.return_value = mock_paginator
        
        # Make S3 download fail
        mock_s3.download_file.side_effect = Exception("S3 download failed")
        
        # Mock master index
        mock_master_index = Mock()
        mock_master_index.ntotal = 0
        mock_faiss.IndexFlatL2.return_value = mock_master_index
        
        with patch.dict('os.environ', {'VECTOR_BUCKET': 'vector-files'}):
            result = handler(event, {})
        
        # Should handle error and return 400
        assert result['statusCode'] == 400
        body = json.loads(result['body'])
        assert 'error' in body
    
    @patch('handler.s3_client')
    @patch('handler.faiss')
    def test_handler_metadata_update(self, mock_faiss, mock_s3):
        """Test metadata is correctly updated with global indices"""
        event = {
            'source': 'aws.events',
            'detail-type': 'Scheduled Event'
        }
        
        # Mock S3 paginator
        mock_paginator = Mock()
        mock_page = {
            'Contents': [
                {'Key': 'private/user1/idx1/index.index', 'LastModified': datetime.now()},
            ]
        }
        mock_paginator.paginate.return_value = [mock_page]
        mock_s3.get_paginator.return_value = mock_paginator
        
        # Mock S3 download
        mock_s3.download_file = Mock()
        
        # Mock index with multiple vectors
        mock_index = Mock()
        mock_index.ntotal = 3
        mock_index.reconstruct = Mock(side_effect=lambda i: np.random.randn(1024).astype('float32'))
        
        # Mock master index
        mock_master_index = Mock()
        mock_master_index.ntotal = 0
        mock_master_index.add = Mock()
        
        mock_faiss.IndexFlatL2.return_value = mock_master_index
        mock_faiss.read_index.return_value = mock_index
        mock_faiss.write_index = Mock()
        
        # Mock metadata with multiple images
        meta = {
            'document_id': 'doc1',
            'user_id': 'user1',
            'images': [
                {'index': 0, 'key': 'img1.png'},
                {'index': 1, 'key': 'img2.png'},
                {'index': 2, 'key': 'img3.png'}
            ]
        }
        
        saved_metadata = None
        
        def mock_upload(file_path, bucket, key, **kwargs):
            nonlocal saved_metadata
            if key.endswith('-meta.json'):
                with open(file_path, 'r') as f:
                    saved_metadata = json.load(f)
        
        mock_s3.upload_file = mock_upload
        
        with patch('builtins.open', create=True) as mock_open:
            # Setup read/write mocks
            mock_file = MagicMock()
            mock_file.read.return_value = json.dumps(meta)
            mock_file.write = Mock()
            mock_open.return_value.__enter__.return_value = mock_file
            
            with patch.dict('os.environ', {'VECTOR_BUCKET': 'vector-files'}):
                result = handler(event, {})
        
        # Verify metadata was updated with global indices
        assert saved_metadata is not None
        doc_meta = saved_metadata['documents']['doc1']
        assert len(doc_meta['images']) == 3
        assert doc_meta['images'][0]['global_index'] == 0
        assert doc_meta['images'][1]['global_index'] == 1
        assert doc_meta['images'][2]['global_index'] == 2