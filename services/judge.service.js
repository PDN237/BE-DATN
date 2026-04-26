const axios = require('axios');

// Judge0 CE API Configuration - Free, no API key required
// Using community edition which is free and open source
const JUDGE0_API_URL = process.env.JUDGE0_API_URL || 'https://ce.judge0.com';

// Alternative instances (in case primary is down)
const JUDGE0_INSTANCES = [
    'https://ce.judge0.com',
    'https://judge0-ce.p.rapidapi.com'
];

// Timeout configuration (in milliseconds)
const JUDGE0_TIMEOUT = parseInt(process.env.JUDGE0_TIMEOUT) || 30000;
const JUDGE0_MAX_RETRIES = parseInt(process.env.JUDGE0_MAX_RETRIES) || 3;

// Language ID mapping for Judge0
const LANGUAGE_IDS = {
    'csharp': 51,
    'c': 50,
    'cpp': 54,
    'cpp11': 54,
    'cpp17': 54,
    'java': 62,
    'javascript': 63,
    'js': 63,
    'python': 71,
    'python2': 71,
    'python3': 71,
    'py': 71,
    'ruby': 72,
    'go': 60,
    'rust': 73,
    'php': 68
};

/**
 * Get Judge0 language ID
 * @param {string} language - Programming language
 * @returns {number} - Judge0 language ID
 */
function getLanguageId(language) {
    const lang = language.toLowerCase();
    return LANGUAGE_IDS[lang] || 71; // Default to Python 3
}

/**
 * Sleep utility for retry delays
 * @param {number} ms - Milliseconds to sleep
 */
function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Handle different error types from Judge0 API
 * @param {Error} error - Axios error
 * @returns {Object} - Normalized error response
 */
function handleJudge0Error(error) {
    if (error.code === 'ECONNABORTED' || error.code === 'ETIMEDOUT') {
        return {
            success: false,
            error: 'Execution timeout - code took too long to run',
            errorType: 'timeout',
            status: 'Time Limit Exceeded'
        };
    }

    if (error.code === 'ENOTFOUND' || error.code === 'ECONNREFUSED' || error.code === 'Network Error') {
        return {
            success: false,
            error: 'Network error - unable to connect to execution service',
            errorType: 'network',
            status: 'System Error'
        };
    }

    if (error.response) {
        const status = error.response.status;
        
        // Rate limit error (429)
        if (status === 429) {
            return {
                success: false,
                error: 'Rate limit exceeded - too many requests',
                errorType: 'rate_limit',
                status: 'System Error',
                retryAfter: error.response.headers['retry-after']
            };
        }

        // Server errors (5xx)
        if (status >= 500) {
            return {
                success: false,
                error: 'Server error - execution service unavailable',
                errorType: 'server_error',
                status: 'System Error'
            };
        }

        // Authentication errors
        if (status === 401 || status === 403) {
            return {
                success: false,
                error: 'Authentication error - invalid API key',
                errorType: 'auth',
                status: 'System Error'
            };
        }

        // Bad request (400)
        if (status === 400) {
            const message = error.response.data?.message || error.response.data?.error || 'Invalid request';
            return {
                success: false,
                error: message,
                errorType: 'bad_request',
                status: 'Compilation Error'
            };
        }

        // Validation error (422) - often related to invalid parameters like time_limit
        if (status === 422) {
            const message = error.response.data?.message || error.response.data?.error || 'Invalid parameters';
            console.log('=== JUDGE0 422 ERROR ===');
            console.log('Response data:', error.response.data);
            console.log('========================');
            return {
                success: false,
                error: message,
                errorType: 'validation_error',
                status: 'System Error'
            };
        }
    }

    // Unknown error
    return {
        success: false,
        error: error.message || 'Unknown error occurred',
        errorType: 'unknown',
        status: 'System Error'
    };
}

/**
 * Execute code with Judge0 CE API
 * @param {string} code - User's source code
 * @param {string} input - Input for the code
 * @param {string} language - Programming language
 * @returns {Promise<Object>} - Execution result
 */
async function runWithJudge0(code, input, language = 'python', options = {}) {
    const languageId = getLanguageId(language);
    
    // Lấy timeLimit từ options (hỗ trợ giới hạn động từ testcase)
    // Chuyển từ milliseconds sang seconds cho Judge0 API (max 20s)
    const timeLimit = options.timeLimit !== undefined ? options.timeLimit / 1000 : 2;
    
    // Chỉ set memory_limit khi được truyền vào, không dùng default
    const payload = {
        source_code: code,
        language_id: languageId,
        stdin: input || '',
        expected_output: null,
        cpu_time_limit: timeLimit,     // <-- ĐỘNG
        cpu_extra_time: 1
    };
    
    // Chỉ thêm memory_limit khi options.memoryLimit được truyền
    if (options.memoryLimit !== undefined) {
        payload.memory_limit = options.memoryLimit;
    }

    let lastError = null;

    // Retry loop for handling transient errors
    for (let attempt = 1; attempt <= JUDGE0_MAX_RETRIES; attempt++) {
        try {
            // Submit and wait for result (synchronous)
            console.log('=== DEBUG JUDGE0 ===');
            console.log('Input:', input);
            console.log('Input repr:', JSON.stringify(input));
            console.log('Input length:', input.length);
            console.log('Language ID:', languageId);
            console.log('==================');
            
            const response = await axios({
                method: 'POST',
                url: `${JUDGE0_API_URL}/submissions?base64_encoded=false&wait=true`,
                headers: {
                    'Content-Type': 'application/json'
                },
                data: payload,
                timeout: JUDGE0_TIMEOUT
            });

            // Parse Judge0 response
            const data = response.data;
            
            console.log('=== JUDGE0 RESPONSE ===');
            console.log('Status ID:', data.status?.id);
            console.log('Status Desc:', data.status?.description);
            console.log('stdout:', data.stdout);
            console.log('stderr:', data.stderr);
            console.log('compile_output:', data.compile_output);
            console.log('time:', data.time);
            console.log('========================');
            
            let stdout = '';
            let stderr = '';
            let compileOutput = '';
            let executionTime = 0;
            let memoryUsed = 0;

            // Get outputs
            stdout = data.stdout || '';
            stderr = data.stderr || '';
            compileOutput = data.compile_output || '';
            
            // Get execution metrics
            executionTime = parseFloat(data.time) * 1000; // Convert to milliseconds
            memoryUsed = data.memory || 0;

            // Determine status
            const statusId = data.status?.id || 0;
            const statusDescription = data.status?.description || 'Unknown';
            
            let resultStatus = 'Accepted';
            let resultDescription = statusDescription;
            let resultError = null;

            // Check for compilation error
            if (compileOutput && compileOutput.trim()) {
                return {
                    success: true,
                    stdout: '',
                    stderr: compileOutput,
                    status: 'Compilation Error',
                    statusDescription: compileOutput,
                    executionTime: 0,
                    memory: memoryUsed,
                    compileOutput: compileOutput
                };
            }

            // Check status codes
            // 1: In Queue
            // 2: Processing
            // 3: Accepted
            // 4: Wrong Answer
            // 5: Time Limit Exceeded
            // 6: Runtime Error
            // 7: Runtime Error (Memory Limit)
            // 8: Runtime Error (Illegal Function)
            // 9: Runtime Error (Timed Out)
            // 10: Internal Error
            // 11: Memory Limit Exceeded
            // 12: System Error

            switch (statusId) {
                case 3:
                    resultStatus = 'Accepted';
                    break;
                case 4:
                    resultStatus = 'Wrong Answer';
                    break;
                case 5:
                case 9:
                    resultStatus = 'Time Limit Exceeded';
                    resultError = 'Code took too long to execute';
                    break;
                case 6:
                case 7:
                case 8:
                    resultStatus = 'Runtime Error';
                    resultError = stderr || 'Runtime error occurred';
                    break;
                case 10:
                case 12:
                    resultStatus = 'System Error';
                    resultError = 'Internal error in execution service';
                    break;
                case 11:
                    resultStatus = 'Memory Limit Exceeded';
                    resultError = 'Code used too much memory';
                    break;
                default:
                    if (statusId <= 2) {
                        // Still processing, treat as timeout
                        resultStatus = 'Time Limit Exceeded';
                    } else {
                        resultStatus = statusDescription;
                    }
            }

            return {
                success: true,
                stdout: stdout,
                stderr: stderr,
                status: resultStatus,
                statusDescription: resultDescription,
                executionTime: executionTime,
                memory: memoryUsed,
                statusId: statusId
            };

        } catch (error) {
            lastError = handleJudge0Error(error);
            
            // If rate limited, wait and retry
            if (lastError.errorType === 'rate_limit') {
                const retryAfter = parseInt(lastError.retryAfter) || 5;
                console.log(`Rate limited, retrying after ${retryAfter} seconds...`);
                await sleep(retryAfter * 1000);
                continue;
            }

            // If network error or timeout, retry
            if (lastError.errorType === 'network' || lastError.errorType === 'timeout') {
                if (attempt < JUDGE0_MAX_RETRIES) {
                    const delay = attempt * 2000; // Exponential backoff
                    console.log(`Attempt ${attempt} failed, retrying in ${delay}ms...`);
                    await sleep(delay);
                    continue;
                }
            }

            // For other errors, don't retry
            break;
        }
    }

    // Return the last error if all retries failed
    return lastError || {
        success: false,
        error: 'Unknown error occurred',
        errorType: 'unknown',
        status: 'System Error'
    };
}

/**
 * Execute code - alias for runWithJudge0 (backward compatibility)
 * @param {string} code - User's source code
 * @param {string} input - Input for the code
 * @param {string} language - Programming language
 * @param {Object} options - Options including timeLimit and memoryLimit
 * @returns {Promise<Object>} - Execution result
 */
async function runWithYepCode(code, input, language = 'python', options = {}) {
    return runWithJudge0(code, input, language, options);
}

/**
 * Compare two outputs with normalization
 * @param {string} actual - Actual output
 * @param {string} expected - Expected output
 * @returns {boolean} - True if outputs match
 */
function compareOutput(actual, expected) {
    if (!actual && !expected) return true;
    if (!actual || !expected) return false;

    // Normalize: trim, remove extra whitespace, normalize newlines
    const normalize = (str) => str
        .trim()
        .replace(/\r\n/g, '\n')
        .replace(/\r/g, '\n')
        .replace(/ +/g, ' ')
        .replace(/\n+/g, '\n')
        .trim();

    return normalize(actual) === normalize(expected);
}

/**
 * Judge a problem by running all test cases
 * @param {number} problemId - Problem ID
 * @param {string} code - User's source code
 * @param {string} userId - User ID (optional, for logging)
 * @param {Object} options - Additional options
 * @returns {Promise<Object>} - Final judgment result
 */
async function judgeProblem(problemId, code, userId = null, options = {}) {
    const { testCases = [], language = 'python' } = options;
    
    const results = {
        success: true,
        problemId: problemId,
        userId: userId,
        testCases: [],
        finalStatus: 'Accepted',
        totalExecutionTime: 0,
        totalMemoryUsed: 0,
        passedCount: 0,
        failedCount: 0
    };

    for (let i = 0; i < testCases.length; i++) {
        const testCase = testCases[i];
        const input = testCase.input_data || '';
        const expected = (testCase.expected_output || '').trim();
        const isHidden = testCase.is_hidden || false;

        // Execute code with Judge0
        const executionResult = await runWithJudge0(code, input, language);

        let testStatus = 'Wrong Answer';
        let actualOutput = '';

        if (executionResult.success) {
            // If there's a compilation error or runtime error
            if (executionResult.status === 'Compilation Error' || 
                executionResult.status === 'Runtime Error') {
                testStatus = executionResult.status;
                actualOutput = executionResult.stderr || executionResult.compile_output || '';
                results.failedCount++;
            } 
            // If time limit exceeded
            else if (executionResult.status === 'Time Limit Exceeded') {
                testStatus = 'Time Limit Exceeded';
                actualOutput = '';
                results.failedCount++;
                results.success = false;
            }
            // Otherwise, compare output
            else {
                actualOutput = (executionResult.stdout || '').trim();
                
                if (compareOutput(actualOutput, expected)) {
                    testStatus = 'Accepted';
                    results.passedCount++;
                } else {
                    testStatus = 'Wrong Answer';
                    results.failedCount++;
                }
            }
        } else {
            // Handle execution errors
            testStatus = executionResult.status || 'System Error';
            actualOutput = executionResult.error || 'Unknown error';
            results.failedCount++;
            
            // Mark overall as failed if it's a system error
            if (testStatus === 'Time Limit Exceeded' || testStatus === 'System Error') {
                results.success = false;
            }
        }

        // Add to results
        results.testCases.push({
            id: testCase.id,
            index: i + 1,
            status: testStatus,
            input: isHidden ? '[Hidden]' : input,
            expectedOutput: isHidden ? '[Hidden]' : expected,
            actualOutput: isHidden ? '[Hidden]' : actualOutput,
            executionTime: executionResult.executionTime || 0,
            memory: executionResult.memory || 0,
            error: executionResult.stderr || null
        });

        // Update totals
        results.totalExecutionTime += executionResult.executionTime || 0;
        results.totalMemoryUsed = Math.max(results.totalMemoryUsed, executionResult.memory || 0);

        // Update final status
        if (testStatus !== 'Accepted') {
            if (results.finalStatus === 'Accepted') {
                results.finalStatus = testStatus;
            }
            // If system error, stop checking further test cases
            if (testStatus === 'Time Limit Exceeded' || testStatus === 'System Error') {
                // Mark remaining test cases as not executed
                for (let j = i + 1; j < testCases.length; j++) {
                    results.testCases.push({
                        id: testCases[j].id,
                        index: j + 1,
                        status: 'Not Executed',
                        input: testCases[j].is_hidden ? '[Hidden]' : testCases[j].input_data,
                        expectedOutput: testCases[j].is_hidden ? '[Hidden]' : testCases[j].expected_output,
                        actualOutput: '[Not Executed]',
                        executionTime: 0,
                        memory: 0,
                        error: null
                    });
                }
                break;
            }
        }
    }

    // Determine final status
    if (results.failedCount > 0) {
        // Find the first non-accepted status for final status
        const firstFailed = results.testCases.find(tc => tc.status !== 'Accepted');
        if (firstFailed) {
            results.finalStatus = firstFailed.status;
        }
    }

    return results;
}

/**
 * Run a single test case (for progressive display)
 * @param {string} code - User's source code
 * @param {string} input - Input for the code
 * @param {string} expected - Expected output
 * @param {string} language - Programming language
 * @param {Object} options - Options including timeLimit and memoryLimit
 * @returns {Promise<Object>} - Single test case result
 */
async function runSingleTestCase(code, input, expected, language = 'python', options = {}) {
    const executionResult = await runWithJudge0(code, input, language, options);

    let status = 'Wrong Answer';
    let actualOutput = '';

    if (executionResult.success) {
        // If there's an error status
        if (executionResult.status === 'Compilation Error' || 
            executionResult.status === 'Runtime Error') {
            status = executionResult.status;
            actualOutput = executionResult.stderr || '';
        } else if (executionResult.status === 'Time Limit Exceeded') {
            status = 'Time Limit Exceeded';
            actualOutput = '';
        } else {
            actualOutput = (executionResult.stdout || '').trim();
            
            if (compareOutput(actualOutput, expected)) {
                status = 'Accepted';
            } else {
                status = 'Wrong Answer';
            }
        }
    } else {
        status = executionResult.status || 'System Error';
        actualOutput = executionResult.error || 'Unknown error';
    }

    return {
        status: status,
        output: actualOutput,
        runtime: executionResult.executionTime || 0,
        memory: executionResult.memory || 0,
        error: executionResult.stderr || null
    };
}

module.exports = {
    runWithJudge0,
    runWithYepCode,
    judgeProblem,
    runSingleTestCase,
    compareOutput,
    getLanguageId,
    // Export config for testing
    config: {
        JUDGE0_API_URL,
        JUDGE0_TIMEOUT,
        JUDGE0_MAX_RETRIES,
        LANGUAGE_IDS
    }
};

