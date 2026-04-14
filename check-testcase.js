const pool = require('./db');

async function checkTestCase(problemId) {
    try {
        const result = await pool.query(`
            SELECT id, input_data, expected_output, is_hidden, time_limit
            FROM TestCases
            WHERE problem_id = $1
            ORDER BY id
        `, [parseInt(problemId)]);

        console.log('=== TEST CASES FOR PROBLEM', problemId, '===');
        result.rows.forEach((tc, i) => {
            console.log(`Test Case ${i + 1} (ID: ${tc.id}):`);
            console.log('  Input:', tc.input_data);
            console.log('  Expected Output:', tc.expected_output);
            console.log('  Hidden:', tc.is_hidden);
            console.log('  Time Limit:', tc.time_limit);
            console.log('---');
        });
        
        process.exit(0);
    } catch (error) {
        console.error('Error:', error);
        process.exit(1);
    }
}

const problemId = process.argv[2] || '1';
checkTestCase(problemId);
