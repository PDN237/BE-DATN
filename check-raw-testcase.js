const axios = require('axios');

async function checkRawTestCase(problemId) {
    try {
        const response = await axios.get(`https://be-datn-6gb6.onrender.com/api/problems/${problemId}/testcases`);
        
        console.log('=== RAW TEST CASE DATA ===');
        response.data.data.forEach((tc, i) => {
            console.log(`Test Case ${i + 1} (ID: ${tc.id}):`);
            console.log('Raw input:', JSON.stringify(tc.input_data));
            console.log('Raw expected:', JSON.stringify(tc.expected_output));
            console.log('Has escaped newline (\\n)?', tc.input_data.includes('\\n'));
            console.log('Has actual newline?', tc.input_data.includes('\n'));
            console.log('---');
        });
        
    } catch (error) {
        console.error('Error:', error.message);
    }
}

checkRawTestCase(3);
