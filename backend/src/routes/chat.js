const express = require('express');
const authenticateToken = require('../middleware/auth');

const router = express.Router();

router.post('/', authenticateToken, async (req, res) => {
  try {
    const { messages, document_content, document_name } = req.body;

    if (!Array.isArray(messages) || messages.length === 0) {
      return res.status(400).json({
        error: 'messages_required'
      });
    }

    if (!process.env.ANTHROPIC_API_KEY) {
      return res.status(503).json({
        error: 'claude_not_configured'
      });
    }

    const systemPrompt = `
You are Inventra, an AI inventory management assistant.

Help the user understand and manage inventory data.
Give practical, concise answers.
When document content is provided, use it as context for your answer.
Do not invent inventory data that is not present in the provided context.

${document_name ? `Document name: ${document_name}` : ''}
${document_content ? `Document content:\n${document_content}` : ''}
`.trim();

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: process.env.ANTHROPIC_MODEL || 'claude-sonnet-4-20250514',
        max_tokens: 1000,
        system: systemPrompt,
        messages
      })
    });

    const data = await response.json();

    if (!response.ok) {
      console.error('Claude API error:', data);

      return res.status(response.status).json({
        error: 'claude_api_error'
      });
    }

    const reply = Array.isArray(data.content)
      ? data.content
          .filter(item => item.type === 'text')
          .map(item => item.text)
          .join('\n')
      : '';

    res.json({
      reply
    });
  } catch (error) {
    console.error('Chat API error:', error);

    res.status(500).json({
      error: 'server_error'
    });
  }
});

module.exports = router;
