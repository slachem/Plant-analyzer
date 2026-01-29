const express = require('express');
const cors = require('cors');
const path = require('path');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.static('Public'));

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'Public', 'index.html'));


app.post('/api/analyze', async (req, res) => {
    try {
        const { imageData, imageType } = req.body;

        if (!imageData || !imageType) {
            return res.status(400).json({ error: 'Missing image data or type' });
        }

        if (!process.env.ANTHROPIC_API_KEY) {
            return res.status(500).json({ 
                error: 'Server configuration error: ANTHROPIC_API_KEY not set' 
            });
        }

        const response = await fetch('https://api.anthropic.com/v1/messages', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-api-key': process.env.ANTHROPIC_API_KEY,
                'anthropic-version': '2023-06-01'
            },
            body: JSON.stringify({
                model: 'claude-sonnet-4-20250514',
                max_tokens: 1000,
                messages: [{
                    role: 'user',
                    content: [
                        {
                            type: 'image',
                            source: {
                                type: 'base64',
                                media_type: imageType,
                                data: imageData
                            }
                        },
                        {
                            type: 'text',
                            text: `Analyze this plant photo for nutrient deficiencies. Provide your analysis in the following JSON format only, with no other text:

{
  "plantType": "estimated plant type or 'Unknown'",
  "overallHealth": "poor/fair/good/excellent",
  "deficiencies": [
    {
      "nutrient": "nutrient name",
      "severity": "mild/moderate/severe",
      "symptoms": "observed symptoms",
      "confidence": "low/medium/high"
    }
  ],
  "recommendations": [
    "specific recommendation 1",
    "specific recommendation 2"
  ],
  "additionalNotes": "any other relevant observations"
}`
                        }
                    ]
                }]
            })
        });

        if (!response.ok) {
            const errorData = await response.text();
            console.error('Anthropic API error:', errorData);
            return res.status(response.status).json({ 
                error: `API request failed: ${response.statusText}` 
            });
        }

        const data = await response.json();
        const textContent = data.content.find(c => c.type === 'text')?.text || '';
        
        const jsonMatch = textContent.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
            const analysis = JSON.parse(jsonMatch[0]);
            res.json(analysis);
        } else {
            res.status(500).json({ error: 'Could not parse analysis response' });
        }

    } catch (error) {
        console.error('Server error:', error);
        res.status(500).json({ 
            error: 'Internal server error',
            message: error.message 
        });
    }
});

app.get('/api/health', (req, res) => {
    res.json({ 
        status: 'ok',
        apiKeyConfigured: !!process.env.ANTHROPIC_API_KEY 
    });
});

app.listen(PORT, () => {
    console.log(`🌱 Plant Analyzer Server running on http://localhost:${PORT}`);
    console.log(`API Key configured: ${!!process.env.ANTHROPIC_API_KEY}`);
});
