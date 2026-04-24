const express = require("express");
const Groq = require("groq-sdk");

const router = express.Router();

const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY
});

// 🔥 API CHÍNH
router.post("/analyze", async (req, res) => {
  try {
    const { code, input, expected, language, algorithm } = req.body;

    const prompt = `
You are an expert programming mentor evaluating student code for a sorting algorithm implementation.

**Task Requirements:**
The student must implement the "${algorithm}" sorting algorithm to sort the given array in ascending order. The implementation must follow the specific logic and characteristics of the selected algorithm, not just produce the correct output.

**Evaluation Data:**
- Selected Algorithm: ${algorithm}
- Programming Language: ${language}
- Input Array: ${JSON.stringify(input)}
- Expected Output (Sorted Array): ${JSON.stringify(expected)}

**Student's Source Code:**
\`\`\`${language}
${code}
\`\`\`

**CRITICAL LANGUAGE VALIDATION:**
FIRST AND FOREMOST: You MUST verify that the code is written in the CORRECT programming language "${language}". If the student wrote code in a different language than selected, mark it as INCORRECT immediately and provide a hint about using the correct language.

**Language-Specific Validation Rules:**

For **JavaScript**: Must use function/const/let, array methods like push/pop/shift, for/while loops, NO semicolons at end of lines (optional), NO type declarations like int/string, NO $ prefix for variables.

For **C++**: Must use int main(), std::vector or arrays, for/while loops with semicolons, semicolons at end of statements, NO var/let/const, NO def keyword, NO $ prefix.

For **Python**: Must use def for functions, lists (not arrays), for/while loops with colons, indentation for blocks, NO semicolons at end of lines, NO curly braces {}, NO type declarations.

For **Java**: Must use public class, public static void main, int[] or ArrayList, for/while loops with semicolons, semicolons at end of statements, type declarations required, NO def keyword.

For **C#**: Must use public class, static void Main, int[] or List<T>, for/while loops with semicolons, semicolons at end of statements, type declarations required, NO def keyword.

For **Go**: Must use func keyword, slices, for range loops, NO semicolons at end of lines, NO curly braces after if/for (only for body), NO type declarations in parameters (only after variable).

For **Rust**: Must use fn keyword, Vec<T> or arrays, for loops, semicolons at end of statements, ownership/borrowing with & and mut, NO def keyword, NO $ prefix.

For **PHP**: Must use function keyword, arrays with array() or [], for/foreach loops, $ prefix for ALL variables, semicolons at end of statements, NO def keyword.

For **Ruby**: Must use def keyword, arrays with [], each/for loops, NO semicolons at end of lines, NO type declarations, NO curly braces for blocks (use end), NO $ prefix for variables.

For **Swift**: Must use func keyword, arrays with [], for-in loops, type annotations optional but common, NO semicolons at end of lines, NO def keyword, NO $ prefix.

For **Kotlin**: Must use fun keyword, arrays with arrayOf() or listOf(), for loops, NO semicolons at end of statements, type annotations optional, NO def keyword, NO $ prefix.

For **TypeScript**: Must use function/const/let, type annotations optional but common, array methods, for/while loops, NO semicolons at end of lines (optional), NO def keyword, NO $ prefix.

**Algorithm-Specific Evaluation Criteria:**

For **Bubble Sort**: Must have nested loops comparing adjacent elements and swapping when out of order. Outer loop runs n-1 times, inner loop compares arr[j] with arr[j+1]. Time complexity O(n²).

For **Selection Sort**: Must find minimum element in unsorted portion and swap with current position. Outer loop runs n-1 times, inner loop finds min index. Time complexity O(n²).

For **Insertion Sort**: Must build sorted array by inserting elements at correct positions. Outer loop from index 1 to end, inner loop shifts elements. Time complexity O(n²) average, O(n) best case.

For **Merge Sort**: Must use divide-and-conquer with recursive splitting and merging. Base case when array length <= 1. Merge function combines two sorted arrays. Time complexity O(n log n).

For **Quick Sort**: Must select pivot, partition array around pivot, recursively sort partitions. Common pivot strategies: first, last, middle, or random. Time complexity O(n log n) average.

For **Heap Sort**: Must build max-heap or min-heap, then repeatedly extract root and heapify. Heapify function maintains heap property. Time complexity O(n log n).

For **Radix Sort**: Must sort digit by digit using counting sort as subroutine. Process from least significant digit to most significant. Time complexity O(d × (n + k)).

For **Shell Sort**: Must use gap sequence (commonly n/2, n/4, ... 1) and perform insertion sort on elements spaced by gap. Time complexity varies by gap sequence.

**Your Task:**
1. **FIRST**: Check if code is written in the CORRECT language "${language}". If wrong language, mark as incorrect and hint about language.
2. Verify the code implements the CORRECT algorithm logic for "${algorithm}", not just any sorting method.
3. Check for language-specific syntax errors and proper language conventions.
4. Verify the code produces the correct sorted output.
5. If the code is **COMPLETELY CORRECT** (correct language, correct algorithm, correct syntax, correct output): Set "isCorrect": true, provide empty "hints" array, and leave "annotatedCode" empty.
6. If the code is **INCORRECT OR HAS ERRORS**: Set "isCorrect": false. You MUST analyze the error and provide:
   - EXACTLY 3 hints in a JSON array - Hints must be GENERAL and VAGUE, NOT detailed or specific:
     * Hint 1: Very general reminder about the algorithm's core concept (e.g., "Hãy nhớ nguyên lý cơ bản của thuật toán", "Cần phân chia mảng thành các phần nhỏ")
     * Hint 2: General guidance about what to check (e.g., "Kiểm tra lại cách duyệt mảng", "Xem xét điều kiện dừng của vòng lặp")
     * Hint 3: Broad suggestion without giving away solution (e.g., "Cân nhắc lại cách hoán đổi phần tử", "Tìm hiểu thêm về cách gộp mảng")
     **DO NOT** provide specific line numbers, exact fixes, or detailed step-by-step solutions.
   - "annotatedCode": The EXACT original source code WITHOUT ANY modifications to the logic or structure. You may ONLY add inline comments (using correct comment syntax for ${language}) to provide general guidance. Comments must be vague and general (e.g., "// Kiểm tra lại logic ở đây", "// Cần xem xét kỹ hơn", "// Phân chia chưa đúng cách"). DO NOT modify any existing code, DO NOT add or remove any code lines, DO NOT fix errors directly.

CRITICAL REQUIREMENTS:
- All text in "hints", "explanation", "solution", and inline comments in "annotatedCode" MUST be written in VIETNAMESE (Tiếng Việt).
- Hints must be GENERAL and VAGUE to avoid making the exercise too easy.
- annotatedCode MUST NOT modify any actual code - only add comments.
- Language validation is MANDATORY and must be checked first.

**Output Format Constraint:**
You MUST ONLY reply in valid JSON format. No markdown, no explanations outside JSON.
Schema:
{
  "isCorrect": boolean,
  "result": "Đúng" or "Sai",
  "hints": [
    "Gợi ý 1 (general, vague, in Vietnamese)",
    "Gợi ý 2 (general, vague, in Vietnamese)",
    "Gợi ý 3 (general, vague, in Vietnamese)"
  ],
  "annotatedCode": "Original code with ONLY inline comments added (no code modifications, in Vietnamese).",
  "explanation": "Brief explanation of the evaluation result (in Vietnamese).",
  "solution": "Complete correct implementation reference if wrong, otherwise empty string."
}
`;

    const response = await groq.chat.completions.create({
      model: "llama-3.3-70b-versatile",
      messages: [
        { role: "system", content: "You are an expert programming mentor. You must ALWAYS output ONLY valid JSON without any markdown code blocks." },
        { role: "user", content: prompt }
      ],
      response_format: { type: "json_object" }
    });

    let aiText = response.choices[0].message.content;

    // Xóa markdown block nếu model vẫn lỡ trả về (phòng hờ)
    aiText = aiText.replace(/```json|```/g, "").trim();

    let parsed;
    try {
      parsed = JSON.parse(aiText);
    } catch (err) {
      console.error("JSON parse error:", err, "Raw AI Text:", aiText);
      // Fallback
      parsed = {
        isCorrect: false,
        result: "Lỗi",
        hints: [
          "Hệ thống không thể phân tích được lỗi.",
          "Vui lòng kiểm tra lại cú pháp của bạn.",
          "Chạy thử code trên môi trường local để xem lỗi chi tiết."
        ],
        annotatedCode: "",
        explanation: "Lỗi định dạng JSON từ AI",
        solution: ""
      };
    }

    // Ensure hints is always an array
    if (!Array.isArray(parsed.hints)) {
      if (parsed.hint) {
        // Fallback catch-all if AI returns old format "hint" instead of "hints"
        parsed.hints = [parsed.hint];
      } else {
        parsed.hints = [parsed.hints || "Vui lòng xem lại thuật toán."];
      }
    }

    res.json(parsed);

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Lỗi server" });
  }
});

module.exports = router;
