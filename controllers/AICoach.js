const express = require("express");
const Groq = require("groq-sdk");

const router = express.Router();

const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY
});

// 🔥 API CHÍNH
router.post("/analyze", async (req, res) => {
  try {
    const { code, input, expected, language } = req.body;

    const prompt = `
You are an expert programming mentor evaluating student code for a sorting algorithm.

**Task Requirements:**
Sort the given array in ascending order. The student must implement the sorting algorithm logic manually.

**Evaluation Data:**
- Programming Language: ${language}
- Input Array: ${JSON.stringify(input)}
- Expected Output (Sorted Array): ${JSON.stringify(expected)}

**Student's Source Code:**
\`\`\`${language}
${code}
\`\`\`

**Your Task:**
1. Check the correctness of the student's code. Does it correctly sort the array and produce the Expected Output? Are there any syntax or logic errors?
2. If the code is **COMPLETELY CORRECT**: Set "isCorrect": true, provide an empty array for "hints", and leave "annotatedCode" empty strings.
3. If the code is **INCORRECT OR HAS ERRORS**: Set "isCorrect": false. You MUST analyze the error and provide:
   - EXACTLY 3 hints in a JSON array. (Hint 1: gentle reminder, Hint 2: specific error line, Hint 3: detailed fix)
   - "annotatedCode": The EXACT original source code from the student WITHOUT any corrections or modifications to their logic. You MUST ONLY insert 1 or 2 small inline comments (using the correct comment syntax for ${language}, like // or #) strictly BELOW the problematic lines. The comments must be vague and gentle hints (e.g., "Hãy kiểm tra lại điều kiện ở đây nhé", "Có vẻ logic lặp chưa tối ưu"), DO NOT explicitly state what is missing or wrong, and DO NOT fix the code.

CRITICAL REQUIREMENT: All the text inside "hints", "explanation", "solution", and the inline comments inside "annotatedCode" MUST be written in Vietnamese (Tiếng Việt).

**Output Format Constraint:**
You MUST ONLY reply in valid JSON format. Do NOT include any markdown formatting, do NOT write any explanations outside the JSON object.
Schema:
{
  "isCorrect": boolean,
  "result": "Đúng" or "Sai",
  "hints": [
    "Gợi ý 1 (in Vietnamese)",
    "Gợi ý 2 (in Vietnamese)",
    "Gợi ý 3 (in Vietnamese)"
  ],
  "annotatedCode": "The original code augmented with 1-2 small inline comments directly where the error is (in Vietnamese).",
  "explanation": "Brief explanation of condition (in Vietnamese)",
  "solution": "Complete correct code reference if wrong, otherwise empty."
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

    // Đảm bảo hints luôn là một mảng
    if (!Array.isArray(parsed.hints)) {
      if (parsed.hint) {
        // Fallback catch-all nếu AI lỡ trả về format cũ "hint" thay vì "hints"
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
