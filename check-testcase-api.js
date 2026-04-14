const axios = require('axios');

async function checkTestCaseViaAPI(problemId) {
    try {
        console.log('Fetching test cases for problem', problemId, '...');
        
        const response = await axios.get(`https://be-datn-6gb6.onrender.com/api/problems/${problemId}/testcases`);
        
        console.log('=== TEST CASES ===');
        response.data.data.forEach((tc, i) => {
            console.log(`Test Case ${i + 1} (ID: ${tc.id}):`);
            console.log('  Input:', tc.input_data);
            console.log('  Expected Output:', tc.expected_output);
            console.log('  Hidden:', tc.is_hidden);
            console.log('---');
        });
        
    } catch (error) {
        console.error('Error:', error.message);
        if (error.response) {
            console.error('Status:', error.response.status);
            console.error('Data:', error.response.data);
        }
    }
}

const problemId = process.argv[2] || '3';
checkTestCaseViaAPI(problemId);
