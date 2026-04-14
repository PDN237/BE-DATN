const axios = require('axios');

async function testUserCode() {
    const code = `def sp_xp_trn_merge_sort():
    n = int(input())
    arr = list(map(int, input().split()))
    
    def merge_sort(arr):
        if len(arr) <= 1:
            return arr
        
        mid = len(arr) // 2
        left = merge_sort(arr[:mid])
        right = merge_sort(arr[mid:])
        
        return merge(left, right)
    
    def merge(left, right):
        result = []
        i = j = 0
        
        while i < len(left) and j < len(right):
            if left[i] < right[j]:
                result.append(left[i])
                i += 1
            else:
                result.append(right[j])
                j += 1
        
        # Thêm phần còn lại
        result.extend(left[i:])
        result.extend(right[j:])
        
        return result
    
    sorted_arr = merge_sort(arr)
    print(*sorted_arr)


# Main
if __name__ == "__main__":
    sp_xp_trn_merge_sort()`;

    const input = '5\n12 11 13 5 6';
    const expected = '5 6 11 12 13';

    try {
        console.log('Testing user code with Judge0...');
        console.log('Input:', input);
        console.log('Expected:', expected);
        
        const response = await axios({
            method: 'POST',
            url: 'https://ce.judge0.com/submissions?base64_encoded=false&wait=true',
            headers: {
                'Content-Type': 'application/json'
            },
            data: {
                source_code: code,
                language_id: 71,
                stdin: input,
                cpu_time_limit: 2
            },
            timeout: 30000
        });

        console.log('=== RESULT ===');
        console.log('Status ID:', response.data.status?.id);
        console.log('Status Description:', response.data.status?.description);
        console.log('stdout:', response.data.stdout);
        console.log('stderr:', response.data.stderr);
        console.log('compile_output:', response.data.compile_output);
        console.log('time:', response.data.time);
        console.log('================');
        
        if (response.data.stdout && response.data.stdout.trim() === expected) {
            console.log('✅ PASS - Output matches expected');
        } else {
            console.log('❌ FAIL - Output does not match');
            console.log('Expected:', expected);
            console.log('Got:', response.data.stdout);
        }
        
    } catch (error) {
        console.log('=== ERROR ===');
        console.log('Error:', error.message);
        if (error.response) {
            console.log('Status:', error.response.status);
            console.log('Data:', error.response.data);
        }
    }
}

testUserCode();
