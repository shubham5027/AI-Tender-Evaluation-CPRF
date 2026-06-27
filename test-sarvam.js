import 'dotenv/config';

const SARVAM_API_KEY = process.env.SARVAM_API_KEY;
const SARVAM_API_URL = process.env.SARVAM_API_URL || 'https://api.sarvam.ai/v1/ocr';

console.log('Testing Sarvam AI API Connection...\n');
console.log('Configuration:');
console.log('- API URL:', SARVAM_API_URL);
console.log('- API Key:', SARVAM_API_KEY ? 'SET' : 'NOT SET');
console.log();

if (!SARVAM_API_KEY) {
  console.error('ERROR: SARVAM_API_KEY is not set in .env file');
  process.exit(1);
}

async function testSarvamAPI() {
  try {
    console.log('Testing Sarvam OCR API...');
    
    // Test with a simple text-based OCR request
    const response = await fetch(SARVAM_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'api-subscription-key': SARVAM_API_KEY,
      },
      body: JSON.stringify({
        model: 'dococr',
        language: 'en',
        file_url: 'https://www.africau.edu/images/default/sample.pdf',
      }),
    });

    console.log('Response Status:', response.status);
    console.log('Response Headers:', Object.fromEntries(response.headers.entries()));

    const raw = await response.text();
    console.log('Response Body:', raw);

    if (response.ok) {
      try {
        const parsed = JSON.parse(raw);
        console.log('\n✓ Sarvam API Test PASSED');
        console.log('Parsed Response:', parsed);
      } catch {
        console.log('\n✓ Sarvam API responded successfully (non-JSON response)');
      }
    } else {
      console.error('\n✗ Sarvam API Test FAILED');
      console.error('Status:', response.status);
      console.error('Response:', raw);
      
      // Try alternative endpoints
      console.log('\nTrying alternative endpoints...');
      const alternatives = [
        'https://api.sarvam.ai/v1/ocr',
        'https://api.sarvam.ai/v1/ocr/process',
        'https://api.sarvam.ai/ocr/v1/process',
      ];
      
      for (const altUrl of alternatives) {
        if (altUrl === SARVAM_API_URL) continue;
        console.log(`\nTrying: ${altUrl}`);
        try {
          const altResponse = await fetch(altUrl, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'api-subscription-key': SARVAM_API_KEY,
            },
            body: JSON.stringify({
              model: 'dococr',
              language: 'en',
              file_url: 'https://www.africau.edu/images/default/sample.pdf',
            }),
          });
          console.log(`Status: ${altResponse.status}`);
          if (altResponse.ok) {
            console.log(`✓ Alternative endpoint ${altUrl} works!`);
            console.log('Consider updating SARVAM_API_URL in .env');
          }
        } catch (error) {
          console.log(`Failed: ${error.message}`);
        }
      }
    }
  } catch (error) {
    console.error('\n✗ Sarvam API Test FAILED with error:', error.message);
  }
}

testSarvamAPI();
