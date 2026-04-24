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

**Algorithm-Specific Evaluation Criteria:**

For **Bubble Sort**: Check for nested loops comparing adjacent elements and swapping when out of order. Time complexity should be O(n²).

For **Selection Sort**: Check for finding minimum element in unsorted portion and swapping with current position. Time complexity should be O(n²).

For **Insertion Sort**: Check for building sorted array by inserting elements at correct positions. Time complexity should be O(n²) average, O(n) best case.

For **Merge Sort**: Check for divide-and-conquer approach with recursive splitting and merging. Time complexity should be O(n log n).

For **Quick Sort**: Check for pivot selection, partitioning, and recursive sorting. Time complexity should be O(n log n) average.

For **Heap Sort**: Check for heap construction (max-heap or min-heap) and repeated extraction. Time complexity should be O(n log n).

For **Radix Sort**: Check for digit-by-digit sorting using counting sort as subroutine. Time complexity should be O(d × (n + k)).

For **Shell Sort**: Check for gap-based insertion sort with decreasing gap sequence. Time complexity varies by gap sequence.

**Language-Specific Syntax Validation:**

For **JavaScript**: Check for proper function declarations, array methods, loop syntax, and variable declarations (let/const).

For **C++**: Check for proper function syntax, vector/array handling, loop syntax, and memory management if using pointers.

For **Python**: Check for proper function definitions, list operations, indentation, and loop syntax.

For **Java**: Check for proper class/method structure, array handling, loop syntax, and type declarations.

For **C#**: Check for proper method syntax, array/list handling, loop syntax, and type declarations.

For **Go**: Check for proper function syntax, slice handling, loop syntax, and package structure.

For **Rust**: Check for proper function syntax, vector handling, ownership/borrowing rules, and loop syntax.

For **PHP**: Check for proper function syntax, array handling, loop syntax, and variable naming ($ prefix).

For **Ruby**: Check for proper method syntax, array handling, loop syntax, and block usage.

For **Swift**: Check for proper function syntax, array handling, loop syntax, and type annotations.

For **Kotlin**: Check for proper function syntax, array/list handling, loop syntax, and type declarations.

For **TypeScript**: Check for proper function syntax, array handling, loop syntax, and type annotations.

**Your Task:**
1. Verify the code implements the CORRECT algorithm logic for "${algorithm}", not just any sorting method.
2. Check for language-specific syntax errors and proper language conventions.
3. Verify the code produces the correct sorted output.
4. If the code is **COMPLETELY CORRECT** (correct algorithm, correct language syntax, correct output): Set "isCorrect": true, provide empty "hints" array, and leave "annotatedCode" empty.
5. If the code is **INCORRECT OR HAS ERRORS**: Set "isCorrect": false. You MUST analyze the error and provide:
   - EXACTLY 3 hints in a JSON array:
     * Hint 1: Gentle reminder about the algorithm's core concept
     * Hint 2: Specific error location or language syntax issue
     * Hint 3: Detailed guidance on fixing the logic or syntax
   - "annotatedCode": The EXACT original source code WITHOUT corrections. Insert 1-2 small inline comments (using correct comment syntax for ${language}) BELOW problematic lines. Comments should be vague hints (e.g., "Check the loop condition here", "Consider the algorithm's logic for this step"), NOT explicit solutions.

CRITICAL REQUIREMENT: All text in "hints", "explanation", "solution", and inline comments in "annotatedCode" MUST be written in ENGLISH.

**Output Format Constraint:**
You MUST ONLY reply in valid JSON format. No markdown, no explanations outside JSON.
Schema:
{
  "isCorrect": boolean,
  "result": "Correct" or "Incorrect",
  "hints": [
    "Hint 1 (in English)",
    "Hint 2 (in English)",
    "Hint 3 (in English)"
  ],
  "annotatedCode": "Original code with 1-2 inline comments where errors occur (in English).",
  "explanation": "Brief explanation of the evaluation result (in English).",
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
        result: "Error",
        hints: [
          "The system could not analyze the error.",
          "Please check your syntax carefully.",
          "Try running the code in a local environment to see detailed errors."
        ],
        annotatedCode: "",
        explanation: "JSON format error from AI",
        solution: ""
      };
    }

    // Ensure hints is always an array
    if (!Array.isArray(parsed.hints)) {
      if (parsed.hint) {
        // Fallback catch-all if AI returns old format "hint" instead of "hints"
        parsed.hints = [parsed.hint];
      } else {
        parsed.hints = [parsed.hints || "Please review the algorithm."];
      }
    }

    res.json(parsed);

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

module.exports = router;
