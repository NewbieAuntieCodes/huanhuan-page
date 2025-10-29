
import { GoogleGenAI, GenerateContentResponse } from "@google/genai";
import { AiAnnotatedLine } from '../types';
import { ApiSettings, AiProvider } from '../store/slices/uiSlice';

const getOpenAICompatibleResponse = async (provider: AiProvider, settings: ApiSettings, prompt: string): Promise<any> => {
    // FIX: Add a type guard to ensure this function is not called for the 'gemini' provider.
    // This narrows the type of 'config' to one that is guaranteed to have a 'model' property, resolving the TypeScript error.
    if (provider === 'gemini') {
        throw new Error('getOpenAICompatibleResponse should not be called for the Gemini provider.');
    }
    const config = settings[provider];
    if (!config || !config.apiKey || !config.baseUrl || !config.model) {
      throw new Error(`Configuration for ${provider} is incomplete. Check settings.`);
    }
  
    const body: any = {
      model: config.model,
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.2,
    };
  
    // Add response_format only for providers that support it well (like OpenAI)
    if (provider === 'openai') {
      body.response_format = { type: "json_object" };
    }
  
    const response = await fetch(config.baseUrl.endsWith('/chat/completions') ? config.baseUrl : `${config.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${config.apiKey}`,
      },
      body: JSON.stringify(body),
    });
  
    if (!response.ok) {
      const errorBody = await response.text();
      throw new Error(`API request failed for ${provider}: ${response.statusText} - ${errorBody}`);
    }
  
    const data = await response.json();
    const jsonStr = data.choices[0].message.content;
    
    // Clean up potential markdown code fences from the response string
    const fenceRegex = /^```(\w*)?\s*\n?(.*?)\n?\s*```$/s;
    const match = jsonStr.match(fenceRegex);
    const cleanedJsonStr = match ? match[2].trim() : jsonStr.trim();
    
    return JSON.parse(cleanedJsonStr);
};

export const getAiAnnotatedScript = async (
  scriptText: string,
  provider: AiProvider,
  settings: ApiSettings
): Promise<AiAnnotatedLine[]> => {
  const prompt = `You are an assistant for a scriptwriting application. Your task is to analyze the provided script text (which may consist of concatenated content from multiple chapters of a novel) and break it down into distinct lines, assigning each to a speaker.

A critical requirement is to handle lines or paragraphs containing both narration (e.g., character actions, scene descriptions) and direct dialogue (speech enclosed in quotation marks like “...” or 「...」).
When such a mixed text block is encountered:
1. You MUST split this into separate output lines: one for the narration part and one for the dialogue part.
2. Assign the narration part to 'Narrator'.
3. Assign the dialogue part to the character who is speaking. The speaker might be indicated by a speech tag (e.g., '白瑶说：“你好。”' implies 白瑶 is speaking '你好。') or by context within the narration preceding the dialogue.

Example 1 (Narration followed by dialogue):
Input Text Block: "白瑶赶紧下床，可怜兮兮的说：“沈迹，我居然脱发！”"
Expected JSON Output:
[
  { "line_text": "白瑶赶紧下床，可怜兮兮的说：", "suggested_character_name": "Narrator" },
  { "line_text": "沈迹，我居然脱发！", "suggested_character_name": "白瑶" }
]
(Note: The AI should infer '白瑶' as the speaker of the dialogue from the preceding narrative context "白瑶...说:".)

Example 2 (Pure dialogue with speech tag as part of a larger text, or standalone):
Input Text Block: "白瑶：“你好！”"
Expected JSON Output:
[
  { "line_text": "你好！", "suggested_character_name": "白瑶" }
]
(Note: The speech tag '白瑶：' directly indicates the speaker, and the tag itself should not be part of the 'line_text' for the dialogue.)

Example 3 (Pure narration):
Input Text Block: "窗外下着雨。"
Expected JSON Output:
[
  { "line_text": "窗外下着雨。", "suggested_character_name": "Narrator" }
]

If a line is purely dialogue without an explicit character name in a tag (e.g., just “救命！”), try to infer the speaker from recent context or use 'Unknown Character' if the context is insufficient. If a line is purely narration, assign it to 'Narrator'.

Format your response as a JSON array of objects. Each object MUST have exactly two keys:
1. 'line_text': (string) The text of the narration or dialogue. For dialogue lines, 'line_text' should contain ONLY the spoken words, without any surrounding quotation marks (e.g., no "", 「」, '', etc.). The application will add appropriate quotation marks during display. For narration lines, 'line_text' should be the plain narration.
2. 'suggested_character_name': (string) The name of the character speaking (e.g., "白瑶", "沈迹"), or 'Narrator'.

Ensure valid JSON output. Prioritize accurate separation of narration and dialogue above all else. Each distinct piece of narration or dialogue should be its own object in the array. If you encounter chapter separators like '--- CHAPTER BREAK ---', continue processing the text as part of the continuous novel.

Here is the script text:
---
${scriptText}
---
`;

  try {
    let parsedData: any;
    switch (provider) {
      case 'gemini':
        const apiKey = settings.gemini.apiKey || process.env.API_KEY;
        if (!apiKey) throw new Error("Gemini API Key is not configured.");
        const ai = new GoogleGenAI({ apiKey });
        const response: GenerateContentResponse = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: prompt,
            config: {
                responseMimeType: "application/json",
                temperature: 0.2,
            },
        });
        const jsonStr = response.text.trim();
        const fenceRegex = /^```(\w*)?\s*\n?(.*?)\n?\s*```$/s;
        const match = jsonStr.match(fenceRegex);
        parsedData = JSON.parse(match ? match[2].trim() : jsonStr);
        break;
      
      case 'openai':
      case 'moonshot':
      case 'deepseek':
        parsedData = await getOpenAICompatibleResponse(provider, settings, prompt);
        break;

      default:
        throw new Error(`Unsupported AI provider: ${provider}`);
    }

    let rawItemsArray: any[] | null = null;
    if (Array.isArray(parsedData)) {
        rawItemsArray = parsedData;
    } else if (typeof parsedData === 'object' && parsedData !== null) {
        const keys = Object.keys(parsedData);
        if (keys.length > 0 && Array.isArray(parsedData[keys[0]])) {
            rawItemsArray = parsedData[keys[0]];
        }
    }

    if (rawItemsArray) {
        const correctedData = rawItemsArray.map((item: any): AiAnnotatedLine => {
            const lineText = item.line_text;
            const characterName = item.suggested_character_name || item.suggester_character_name;
            return {
                line_text: typeof lineText === 'string' ? lineText : "",
                suggested_character_name: typeof characterName === 'string' ? characterName : "Narrator"
            };
        });

        if (correctedData.every(item => typeof item.line_text === 'string' && typeof item.suggested_character_name === 'string')) {
            return correctedData;
        } else {
            throw new Error("Invalid response format from AI after corrections.");
        }
    } else {
        throw new Error("Invalid response format from AI. Expected a JSON array.");
    }

  } catch (error) {
    console.error(`Error with ${provider} API or parsing response:`, error);
    alert(`Error with AI Annotation: ${error instanceof Error ? error.message : String(error)}.`);
    throw error;
  }
};