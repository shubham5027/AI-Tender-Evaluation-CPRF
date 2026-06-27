import 'dotenv/config';
import FormData from 'form-data';
import fs from 'fs';
import fetch from 'node-fetch';

const API_URL = 'http://localhost:8787';
const API_TOKEN = process.env.API_AUTH_TOKEN;

async function testTextractOCR() {
  console.log('Testing AWS Textract OCR Integration...\n');
  
  try {
    // Create a simple test file
    const testContent = 'This is a test document for AWS Textract OCR integration.';
    fs.writeFileSync('test-ocr.txt', testContent);
    
    // Upload the file first
    console.log('Step 1: Uploading test file to S3...');
    const form = new FormData();
    form.append('file', fs.createReadStream('test-ocr.txt'));
    form.append('scope', 'tender');
    form.append('tender_id', 'test-textract-001');
    
    const uploadResponse = await fetch(`${API_URL}/api/files/upload`, {
      method: 'POST',
      headers: {
        'x-api-token': API_TOKEN,
        ...form.getHeaders(),
      },
      body: form,
    });
    
    const uploadResult = await uploadResponse.json();
    console.log('✓ File Upload Result:', uploadResult);
    
    if (!uploadResult.success) {
      throw new Error('File upload failed');
    }
    
    // Test OCR with the uploaded file using base64
    console.log('\nStep 2: Testing OCR with Textract (using base64)...');
    
    // Read the file and convert to base64
    const fileBuffer = fs.readFileSync('test-ocr.txt');
    const fileBase64 = fileBuffer.toString('base64');
    
    const ocrResponse = await fetch(`${API_URL}/api/ocr`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-token': API_TOKEN,
      },
      body: JSON.stringify({
        file_base64: fileBase64,
        language: 'en',
        file_id: 'test-file-textract',
        tender_id: 'test-textract-001',
        source_scope: 'tender_policy',
      }),
    });
    
    const ocrResult = await ocrResponse.json();
    console.log('✓ OCR Result:', ocrResult);
    
    if (ocrResult.success) {
      console.log('\n✓ Textract OCR Integration Test PASSED');
      console.log('Provider:', ocrResult.provider);
      console.log('Extracted Text:', ocrResult.text);
    } else {
      console.log('\n✗ OCR Test Failed:', ocrResult.error);
    }
    
    // Clean up
    fs.unlinkSync('test-ocr.txt');
    console.log('\n✓ Test file cleaned up');
    
  } catch (error) {
    console.error('\n✗ Textract OCR Test FAILED:', error.message);
  }
}

testTextractOCR();
