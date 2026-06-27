import 'dotenv/config';
import FormData from 'form-data';
import fs from 'fs';
import fetch from 'node-fetch';

const API_URL = 'http://localhost:8787';
const API_TOKEN = process.env.API_AUTH_TOKEN;

async function testFileUpload() {
  console.log('Testing File Upload to S3...\n');
  
  try {
    const form = new FormData();
    form.append('file', fs.createReadStream('test-upload.txt'));
    form.append('scope', 'tender');
    form.append('tender_id', 'test-tender-001');
    
    const response = await fetch(`${API_URL}/api/files/upload`, {
      method: 'POST',
      headers: {
        'x-api-token': API_TOKEN,
        ...form.getHeaders(),
      },
      body: form,
    });
    
    const result = await response.json();
    console.log('✓ File Upload Result:', result);
    return result;
  } catch (error) {
    console.error('✗ File Upload Failed:', error.message);
    return null;
  }
}

async function testOCR() {
  console.log('\nTesting OCR with Sarvam AI...\n');
  
  try {
    const response = await fetch(`${API_URL}/api/ocr`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-token': API_TOKEN,
      },
      body: JSON.stringify({
        file_url: 'https://www.africau.edu/images/default/sample.pdf',
        language: 'en',
        file_id: 'test-file-001',
        tender_id: 'test-tender-001',
        source_scope: 'tender_policy',
      }),
    });
    
    const result = await response.json();
    console.log('✓ OCR Result:', result);
    return result;
  } catch (error) {
    console.error('✗ OCR Failed:', error.message);
    return null;
  }
}

async function testEvaluation() {
  console.log('\nTesting AI Evaluation...\n');
  
  try {
    const response = await fetch(`${API_URL}/api/evaluate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-token': API_TOKEN,
      },
      body: JSON.stringify({
        tender_id: 'test-tender-001',
        bidder_id: 'test-bidder-001',
        bidder_name: 'Test Company Inc',
        criterion_id: 'criterion-001',
        criterion_name: 'ISO Certification',
        criterion_category: 'Technical',
        criterion_weight: 'Mandatory',
        criterion_description: 'Bidder must have valid ISO 9001:2015 certification',
        criterion_threshold: 'Valid certificate required',
        ocr_text: 'The company holds ISO 9001:2015 certification issued on January 15, 2024. Certificate number: ISO-2024-001. Valid until December 31, 2026.',
        source_document: 'test-document.pdf',
      }),
    });
    
    const result = await response.json();
    console.log('✓ Evaluation Result:', result);
    return result;
  } catch (error) {
    console.error('✗ Evaluation Failed:', error.message);
    return null;
  }
}

async function testStateManagement() {
  console.log('\nTesting State Management...\n');
  
  try {
    // Read current state
    const getResponse = await fetch(`${API_URL}/api/state`, {
      headers: {
        'x-api-token': API_TOKEN,
      },
    });
    const getState = await getResponse.json();
    console.log('Current State:', getState);
    
    // Update state
    const putResponse = await fetch(`${API_URL}/api/state`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'x-api-token': API_TOKEN,
      },
      body: JSON.stringify({
        expected_version: getState.version || 0,
        state: {
          test: 'data',
          timestamp: new Date().toISOString(),
        },
      }),
    });
    const putState = await putResponse.json();
    console.log('✓ State Update Result:', putState);
    
    return putState;
  } catch (error) {
    console.error('✗ State Management Failed:', error.message);
    return null;
  }
}

async function testObservability() {
  console.log('\nTesting Observability Endpoints...\n');
  
  try {
    const response = await fetch(`${API_URL}/api/observability/summary`, {
      headers: {
        'x-api-token': API_TOKEN,
      },
    });
    const result = await response.json();
    console.log('✓ Observability Summary:', result);
    return result;
  } catch (error) {
    console.error('✗ Observability Failed:', error.message);
    return null;
  }
}

async function runAllTests() {
  console.log('=== AI Tender Evaluation - Full System Test ===\n');
  
  await testFileUpload();
  await testOCR();
  await testEvaluation();
  await testStateManagement();
  await testObservability();
  
  console.log('\n=== Test Suite Complete ===');
}

runAllTests();
