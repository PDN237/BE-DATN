const axios = require('axios');

async function testJudge0() {
    try {
        console.log('Testing Judge0 API...');
        
        const response = await axios({
            method: 'POST',
            url: 'https://ce.judge0.com/submissions?base64_encoded=false&wait=true',
            headers: {
                'Content-Type': 'application/json'
            },
            data: {
                source_code: 'print("hello")',
                language_id: 71,
                stdin: ''
            },
            timeout: 30000
        });

        console.log('=== SUCCESS ===');
        console.log('Status ID:', response.data.status?.id);
        console.log('Status Description:', response.data.status?.description);
        console.log('stdout:', response.data.stdout);
        console.log('stderr:', response.data.stderr);
        console.log('time:', response.data.time);
        console.log('================');
        
    } catch (error) {
        console.log('=== ERROR ===');
        console.log('Error:', error.message);
        if (error.response) {
            console.log('Status:', error.response.status);
            console.log('Data:', error.response.data);
        }
        console.log('================');
    }
}

testJudge0();
