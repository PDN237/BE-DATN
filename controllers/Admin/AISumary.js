const Groq = require("groq-sdk");

const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY
});

const AISummaryController = {
  generateSummary: async (req, res) => {
    try {
      const { content } = req.body;

      if (!content || content.trim() === '') {
        return res.status(400).json({ error: "Nội dung mô tả không được để trống" });
      }

      const prompt = `
You are an expert technical writer and AI assistant for a high-tech educational platform.
Your task is to analyze the following detailed lesson description (Mô tả chi tiết) and generate a concise, highly professional summary (Tóm tắt nội dung) that highlights the core technical values and key takeaways.

**Input Content (Detailed Description):**
${content}

**Requirements:**
1. The summary must be written in Vietnamese (Tiếng Việt) with a professional and technical tone.
2. It should capture the most important technical concepts, methodologies, or objectives of the lesson.
3. Keep it concise but highly valuable (about 3-5 sentences or a short paragraph).
4. Do NOT use introductory or concluding conversational filler (like "Đây là bản tóm tắt...", "Hy vọng điều này giúp ích...").
5. Return ONLY the summarized output text directly. No markdown formatting like \`\`\` or bold markers unless strictly necessary for code syntax.

Summarize the input content based on the above rules:
`;

      const response = await groq.chat.completions.create({
        model: "llama-3.3-70b-versatile",
        messages: [
          { role: "system", content: "You are an expert technical writer and content summarizer." },
          { role: "user", content: prompt }
        ]
      });

      let aiText = response.choices[0].message.content.trim();

      res.status(200).json({ summary: aiText });

    } catch (error) {
      console.error("AI Summary generation error:", error);
      res.status(500).json({ error: "Lỗi máy chủ khi tạo tóm tắt AI: " + error.message });
    }
  }
};

module.exports = AISummaryController;
