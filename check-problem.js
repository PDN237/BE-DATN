const axios = require('axios');

async function checkProblem(problemId) {
    try {
        const response = await axios.get(`https://be-datn-6gb6.onrender.com/api/problems/${problemId}`);
        
        console.log('=== PROBLEM INFO ===');
        console.log('ID:', response.data.data.id);
        console.log('Title:', response.data.data.title);
        console.log('Time Limit:', response.data.data.time_limit);
        console.log('Difficulty:', response.data.data.difficulty);
        console.log('================');
        
    } catch (error) {
        console.error('Error:', error.message);
    }
}

checkProblem(3);
