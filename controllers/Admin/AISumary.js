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
2. Formatted as BEAUTIFUL, structural HTML. You MUST use appropriate HTML tags (like <h3>, <ul>, <li>, <strong>, <em>, <p>, <blockquote>) to structure the summary nicely.
3. The content should be comprehensive rather than extremely brief. It must include:
   - A short introductory paragraph summarizing the main objective.
   - Main points (Các mục chính) formatted as clear headings.
   - Sub-points and critical technical details under each main point.
   - Concrete examples (Ví dụ thực tế) or applications if they appear in the original text (or add relevant concise ones).
4. Even though it is comprehensive, keep it focused and structured like an executive summary without unnecessary storytelling.
5. Return ONLY the raw HTML string without any markdown wrappers (like \`\`\`html) around it.

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
      aiText = aiText.replace(/```(?:html)?\n?/i, "").replace(/```/g, "").trim();

      res.status(200).json({ summary: aiText });

    } catch (error) {
      console.error("AI Summary generation error:", error);
      res.status(500).json({ error: "Lỗi máy chủ khi tạo tóm tắt AI: " + error.message });
    }
  }
};

module.exports = AISummaryController;
