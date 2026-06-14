import 'dotenv/config';

const SARVAM_API_KEY = process.env.SARVAM_API_KEY;

console.log('Testing Sarvam Vision API (New Document Intelligence API)...\n');
console.log('Configuration:');
console.log('- API Key:', SARVAM_API_KEY ? 'SET' : 'NOT SET');
console.log();

if (!SARVAM_API_KEY) {
  console.error('ERROR: SARVAM_API_KEY is not set in .env file');
  process.exit(1);
}

async function testSarvamVisionAPI() {
  try {
    console.log('Step 1: Creating document intelligence job...');
    
    const createJobResponse = await fetch('https://api.sarvam.ai/document-intelligence/create-job', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'api-subscription-key': SARVAM_API_KEY,
      },
      body: JSON.stringify({
        language: 'en-IN',
        output_format: 'md',
      }),
    });

    console.log('Create Job Status:', createJobResponse.status);
    const createJobRaw = await createJobResponse.text();
    console.log('Create Job Response:', createJobRaw);

    if (!createJobResponse.ok) {
      console.error('\n✗ Failed to create job');
      return;
    }

    const jobData = JSON.parse(createJobRaw);
    const jobId = jobData.job_id;
    console.log('\n✓ Job created successfully');
    console.log('Job ID:', jobId);

    console.log('\nStep 2: The new Sarvam Vision API requires file upload via a different mechanism.');
    console.log('This is a job-based API that requires:');
    console.log('1. Create job (completed)');
    console.log('2. Upload file to the job');
    console.log('3. Start processing');
    console.log('4. Wait for completion');
    console.log('5. Download results');
    console.log('\nThe old simple OCR endpoint (https://api.sarvam.ai/v1/ocr) is no longer available.');
    console.log('You need to update the server code to use the new Sarvam Vision API structure.');

    console.log('\n✓ Sarvam Vision API is accessible (job creation works)');
    console.log('⚠ Server code needs to be updated to use the new job-based API structure');

  } catch (error) {
    console.error('\n✗ Sarvam Vision API Test FAILED with error:', error.message);
  }
}

testSarvamVisionAPI();
