import 'dotenv/config';

const BEDROCK_MODEL_ID = process.env.BEDROCK_MODEL_ID;
const BEDROCK_API_KEY = process.env.BEDROCK_API_KEY;
const AWS_REGION = process.env.AWS_REGION || 'us-east-1';
const AWS_ACCESS_KEY_ID = process.env.AWS_ACCESS_KEY_ID;
const AWS_SECRET_ACCESS_KEY = process.env.AWS_SECRET_ACCESS_KEY;

console.log('Testing AWS Bedrock Configuration...\n');
console.log('Configuration:');
console.log('- AWS Region:', AWS_REGION);
console.log('- Bedrock Model ID:', BEDROCK_MODEL_ID || 'NOT SET');
console.log('- Bedrock API Key:', BEDROCK_API_KEY ? 'SET' : 'NOT SET');
console.log('- AWS Access Key ID:', AWS_ACCESS_KEY_ID ? 'SET' : 'NOT SET');
console.log('- AWS Secret Access Key:', AWS_SECRET_ACCESS_KEY ? 'SET' : 'NOT SET');
console.log();

if (!AWS_ACCESS_KEY_ID || !AWS_SECRET_ACCESS_KEY) {
  console.error('ERROR: AWS credentials (AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY) are not set');
  console.log('Note: Bedrock uses AWS credentials, not a separate API key');
  process.exit(1);
}

if (!BEDROCK_MODEL_ID) {
  console.error('ERROR: BEDROCK_MODEL_ID is not set');
  console.log('Example: BEDROCK_MODEL_ID=anthropic.claude-3-haiku-20240307-v1:0');
  process.exit(1);
}

async function testBedrockAPI() {
  try {
    console.log('Testing AWS Bedrock API...');
    
    // Import Bedrock client
    const { BedrockRuntimeClient, InvokeModelCommand } = await import('@aws-sdk/client-bedrock-runtime');
    
    const client = new BedrockRuntimeClient({
      region: AWS_REGION,
      credentials: {
        accessKeyId: AWS_ACCESS_KEY_ID,
        secretAccessKey: AWS_SECRET_ACCESS_KEY,
      },
    });

    console.log('Bedrock client created successfully');
    
    // Test with a simple prompt
    const prompt = 'Hello, this is a test message. Please respond with "Bedrock is working".';
    
    let body;
    let contentType = 'application/json';
    
    // Different models have different request formats
    if (BEDROCK_MODEL_ID.includes('anthropic') || BEDROCK_MODEL_ID.includes('claude')) {
      // Anthropic Claude format
      body = JSON.stringify({
        anthropic_version: 'bedrock-2023-05-31',
        max_tokens: 100,
        messages: [
          {
            role: 'user',
            content: prompt
          }
        ]
      });
    } else if (BEDROCK_MODEL_ID.includes('amazon') || BEDROCK_MODEL_ID.includes('titan')) {
      // Amazon Titan format
      body = JSON.stringify({
        inputText: prompt,
        textGenerationConfig: {
          maxTokenCount: 100,
          temperature: 0.7,
        }
      });
    } else {
      // Generic format
      body = JSON.stringify({
        prompt: prompt,
        max_tokens: 100
      });
    }
    
    const command = new InvokeModelCommand({
      modelId: BEDROCK_MODEL_ID,
      contentType: contentType,
      body: body,
    });
    
    console.log('Sending test request to Bedrock...');
    const response = await client.send(command);
    
    console.log('Response Status:', response.$metadata.httpStatusCode);
    console.log('Response Headers:', Object.fromEntries(Object.entries(response.$metadata.headers || {}).slice(0, 5)));
    
    const responseBody = new TextDecoder().decode(response.body);
    console.log('Response Body:', responseBody);
    
    if (response.$metadata.httpStatusCode === 200) {
      try {
        const parsed = JSON.parse(responseBody);
        console.log('\n✓ Bedrock API Test PASSED');
        console.log('Parsed Response:', parsed);
        
        // Extract text based on model format
        let extractedText = '';
        if (parsed.completion) {
          extractedText = parsed.completion;
        } else if (parsed.outputText) {
          extractedText = parsed.outputText;
        } else if (parsed.content && Array.isArray(parsed.content)) {
          extractedText = parsed.content.map(c => c.text).join('');
        } else if (parsed.message && parsed.message.content) {
          extractedText = parsed.message.content;
        }
        
        if (extractedText) {
          console.log('Extracted Text:', extractedText);
        }
      } catch (error) {
        console.log('✓ Bedrock API responded successfully (non-JSON response)');
      }
    } else {
      console.error('\n✗ Bedrock API Test FAILED');
      console.error('Status:', response.$metadata.httpStatusCode);
    }
    
  } catch (error) {
    console.error('\n✗ Bedrock API Test FAILED with error:', error instanceof Error ? error.message : 'Unknown error');
    console.error('Error details:', error);
  }
}

testBedrockAPI();
