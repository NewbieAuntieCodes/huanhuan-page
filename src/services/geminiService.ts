


import { GoogleGenAI, GenerateContentResponse } from "@google/genai";
import { AiAnnotatedLine } from '../types';

// @google/genai-api-guideline-fix: Initialize GoogleGenAI with API key from environment variables as required by the guidelines.
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
// FIX: Updated model to a more stable, general-purpose version as per guidelines.
const model = 'gemini-2.5-flash';

export const getAiAnnotatedScript = async (scriptText: string): Promise<AiAnnotatedLine[]> => {
  // @google/genai-api-guideline-fix: Removed API key check and simulation logic. The application must assume the API_KEY is correctly configured in the environment.
  
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
    // FIX: Simplified the `contents` parameter for a single text prompt, as per @google/genai guidelines.
    const response: GenerateContentResponse = await ai.models.generateContent({
      model: model,
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        temperature: 0.2, // Lower temperature for more deterministic and structured output
      },
    });

    // @google/genai-api-guideline-fix: Use `response.text` directly to get the generated text content.
    let jsonStr = response.text.trim();
    const fenceRegex = /^```(\w*)?\s*\n?(.*?)\n?\s*```$/s;
    const match = jsonStr.match(fenceRegex);
    if (match && match[2]) {
      jsonStr = match[2].trim();
    }
    
    const parsedData = JSON.parse(jsonStr);
    
    let rawItemsArray: any[] | null = null;

    if (Array.isArray(parsedData)) {
        rawItemsArray = parsedData;
    } else if (typeof parsedData === 'object' && parsedData !== null) {
        // Attempt to recover if the response is an object with a key that is an array
        const keys = Object.keys(parsedData);
        if (keys.length === 1 && Array.isArray(parsedData[keys[0]])) {
            console.warn("Recovered array from nested object in Gemini response.");
            rawItemsArray = parsedData[keys[0]];
        }
    }

    if (rawItemsArray) {
        const correctedData = rawItemsArray.map((item: any): AiAnnotatedLine => {
            const lineText = item.line_text;
            // Handle the typo: check for suggested_character_name or suggester_character_name
            const characterName = item.suggested_character_name || item.suggester_character_name;
            
            return {
                line_text: typeof lineText === 'string' ? lineText : "", // Ensure line_text is a string
                suggested_character_name: typeof characterName === 'string' ? characterName : "Narrator" // Ensure char name is string, default to Narrator
            };
        });

        // Validate the corrected data structure
        if (correctedData.every(item => typeof item.line_text === 'string' && typeof item.suggested_character_name === 'string')) {
            return correctedData;
        } else {
            const invalidItems = correctedData.filter(item => !(typeof item.line_text === 'string' && typeof item.suggested_character_name === 'string'));
            console.error("Gemini response, after attempting typo correction, still contains malformed items:", invalidItems);
            throw new Error("Invalid response format from AI after corrections. Malformed items found: " + JSON.stringify(invalidItems));
        }
    } else {
        console.error("Gemini response is not an array and not a recognized recoverable structure:", parsedData);
        throw new Error("Invalid response format from AI. Expected array of {line_text, suggested_character_name}. Got: " + JSON.stringify(parsedData));
    }

  } catch (error) {
    console.error("Error calling Gemini API or parsing response:", error);
    // @google/genai-api-guideline-fix: Removed fallback simulation. The application should handle API errors gracefully.
    alert(`Error with AI Annotation: ${error instanceof Error ? error.message : String(error)}. Please check your API key and network connection.`);
    throw error; // Re-throw the error to be handled by the caller.
  }
};

// Simulated AI Voice Generation (Gemini is text-to-text, this is a placeholder)
export const simulateGenerateVoice = async (text: string): Promise<{ audioSrc: string }> => {
  return new Promise(resolve => {
    setTimeout(() => {
      // In a real app, this would call a TTS API and return an actual audio URL/blob
      resolve({ audioSrc: `simulated_audio_for_${text.substring(0, 15).replace(/\s/g, '_')}.mp3` });
    }, 1500 + Math.random() * 1000); // Simulate network delay
  });
};