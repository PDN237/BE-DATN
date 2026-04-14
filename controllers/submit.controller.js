const pool = require('../db');
const judgeService = require('../services/judge.service');

const submitCode = async (req, res) => {
    const { problemId } = req.params;
    const { code, testCaseId, inputData, expectedOutput, language = 'python', userId } = req.body;

    if (!code || !code.trim()) {
        return res.status(400).json({
            success: false,
            message: 'Code is required'
        });
    }

    if (!problemId) {
        return res.status(400).json({
            success: false,
            message: 'Problem ID is required'
        });
    }

    if (testCaseId !== undefined && inputData !== undefined && expectedOutput !== undefined) {
        try {
            const fixedInput = inputData.replace(/\\n/g, '\n').replace(/\\r/g, '\r');
            const fixedExpected = expectedOutput.replace(/\\n/g, '\n').replace(/\\r/g, '\r');
            
            const result = await judgeService.runSingleTestCase(
                code,
                fixedInput,
                fixedExpected,
                language,
                { timeLimit: 2 }
            );
            
            return res.json({
                success: true,
                data: {
                    testCaseId: testCaseId,
                    status: result.status,
                    output: result.output,
                    runtime: result.runtime,
                    memory: result.memory
                }
            });
        } catch (error) {
            console.error('Error running single test case:', error);
            return res.status(500).json({
                success: false,
                message: 'Error running test case',
                error: error.message
            });
        }
    }

    const client = await pool.connect();
    
    try {
        await client.query('BEGIN');
        
        const problemResult = await client.query(`
            SELECT id, title, time_limit
            FROM Problems 
            WHERE id = $1
        `, [parseInt(problemId)]);

        if (problemResult.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Problem not found'
            });
        }

        const testCasesResult = await client.query(`
             SELECT id, input_data, expected_output, is_hidden, time_limit
            FROM TestCases 
            WHERE problem_id = $1
            ORDER BY id
        `, [parseInt(problemId)]);

        const testCases = testCasesResult.rows;
        const problem = problemResult.rows[0];

        if (testCases.length === 0) {
            return res.status(400).json({
                success: false,
                message: 'No test cases found for this problem'
            });
        }

        const pUserId = userId ? parseInt(userId) : null;
        const submissionResult = await client.query(`
            INSERT INTO Submissions (problem_id, userId, code, status, execution_time, memory_used)
            VALUES ($1, $2, $3, 'Pending', 0, 0)
            RETURNING id
        `, [parseInt(problemId), pUserId, code]);

        const submissionId = submissionResult.rows[0].id;

        const testResults = [];
        let finalStatus = 'Accepted';
        let totalExecutionTime = 0;
        let totalMemoryUsed = 0;

        for (const testCase of testCases) {
            let input = (testCase.input_data || '').replace(/\\n/g, '\n').replace(/\\r/g, '\r');
            const expected = (testCase.expected_output || '').replace(/\\n/g, '\n').replace(/\\r/g, '\r').trim();
            
            const testCaseTimeLimit = testCase.time_limit !== null && testCase.time_limit !== undefined 
                ? testCase.time_limit 
                : (problem.time_limit || 2);
    
            const judgeResult = await judgeService.runWithYepCode(
                code,
                input,
                language,
                { timeLimit: testCaseTimeLimit }
            );

            let testStatus = 'Wrong Answer';
            let output = '';
            let executionTime = 0;
            let memoryUsed = 0;

            if (judgeResult.success) {
                output = (judgeResult.stdout || '').trim();
                executionTime = judgeResult.executionTime || 0;
                memoryUsed = judgeResult.memory || 0;

                testStatus = judgeResult.status || 'Accepted';
                
                if (judgeResult.stderr && judgeResult.stderr.trim()) {
                    testStatus = 'Runtime Error';
                    output = judgeResult.stderr;
                }

                if (testStatus === 'Accepted') {
                    if (!judgeService.compareOutput(output, expected)) {
                        testStatus = 'Wrong Answer';
                    }
                }
            } else {
                testStatus = judgeResult.status || 'System Error';
                output = judgeResult.error || 'Unknown error';
            }

            await client.query(`
                INSERT INTO Results (submission_id, testcase_id, status, output, execution_time)
                VALUES ($1, $2, $3, $4, $5)
            `, [
                submissionId,
                testCase.id,
                testStatus,
                output,
                executionTime
            ]);

            testResults.push({
                id: testCase.id,
                status: testStatus,
                input: testCase.is_hidden ? '[Hidden]' : input,
                expectedOutput: testCase.is_hidden ? '[Hidden]' : expected,
                actualOutput: testCase.is_hidden ? '[Hidden]' : output,
                executionTime: executionTime,
                memory: memoryUsed
            });

            totalExecutionTime += executionTime;
            totalMemoryUsed = Math.max(totalMemoryUsed, memoryUsed);

            if (testStatus !== 'Accepted' && finalStatus === 'Accepted') {
                finalStatus = testStatus;
            }
            
            if (testStatus === 'Time Limit Exceeded' || testStatus === 'System Error') {
                for (let j = testCases.indexOf(testCase) + 1; j < testCases.length; j++) {
                    const remainingTC = testCases[j];
                    testResults.push({
                        id: remainingTC.id,
                        status: 'Not Executed',
                        input: remainingTC.is_hidden ? '[Hidden]' : remainingTC.input_data,
                        expectedOutput: remainingTC.is_hidden ? '[Hidden]' : remainingTC.expected_output,
                        actualOutput: '[Not Executed]',
                        executionTime: 0,
                        memory: 0
                    });
                }
                break;
            }
        }

        await client.query(`
            UPDATE Submissions 
            SET status = $1, 
                execution_time = $2, 
                memory_used = $3
            WHERE id = $4
        `, [finalStatus, totalExecutionTime, totalMemoryUsed, submissionId]);

        await client.query('COMMIT');

        let pointsEarned = 0;
        
        // If submission is accepted and userId is provided, award points
        if (finalStatus === 'Accepted' && pUserId) {
            try {
                const profileController = require('./profile');
                const pointsResult = await profileController.addProblemPoints({
                    body: { userId: pUserId, problemId: parseInt(problemId) }
                }, { json: (data) => data, status: (code) => ({ status: code }) });
                
                if (pointsResult.success && pointsResult.pointsEarned > 0) {
                    pointsEarned = pointsResult.pointsEarned;
                }
            } catch (pointsError) {
                console.error('Error adding problem points:', pointsError);
                // Don't fail the submission if points awarding fails
            }
        }

        res.json({
            success: true,
            data: {
                submissionId: submissionId,
                status: finalStatus,
                runtime: totalExecutionTime,
                memory: totalMemoryUsed,
                pointsEarned: pointsEarned,
                testcases: testResults.map(tc => ({
                    id: tc.id,
                    status: tc.status
                }))
            }
        });

    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Error submitting code:', error);
        res.status(500).json({
            success: false,
            message: 'Error submitting code',
            error: error.message
        });
    } finally {
        client.release();
    }
};

const getSubmissionById = async (req, res) => {
    try {
        const { submissionId } = req.params;

        const submissionResult = await pool.query(`
            SELECT 
                s.id, s.problem_id, s.code, s.status, 
                s.execution_time, s.memory_used, s.created_at,
                p.title as problem_title
            FROM Submissions s
            JOIN Problems p ON s.problem_id = p.id
            WHERE s.id = $1
        `, [parseInt(submissionId)]);

        if (submissionResult.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Submission not found'
            });
        }

        const resultsResult = await pool.query(`
            SELECT 
                r.id, r.testcase_id, r.status, r.output, r.execution_time,
                t.input_data, t.expected_output, t.is_hidden
            FROM Results r
            JOIN TestCases t ON r.testcase_id = t.id
            WHERE r.submission_id = $1
            ORDER BY t.id
        `, [parseInt(submissionId)]);

        res.json({
            success: true,
            data: {
                ...submissionResult.rows[0],
                results: resultsResult.rows
            }
        });

    } catch (error) {
        console.error('Error fetching submission:', error);
        res.status(500).json({
            success: false,
            message: 'Error fetching submission',
            error: error.message
        });
    }
};

module.exports = {
    submitCode,
    getSubmissionById
};
