package chat

import (
	"bufio"
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strings"
)

const groqModel = "llama-3.3-70b-versatile"
const groqURL = "https://api.groq.com/openai/v1/chat/completions"

type groqMessage struct {
	Role    string `json:"role"`
	Content string `json:"content"`
}

type groqRequest struct {
	Model    string        `json:"model"`
	Messages []groqMessage `json:"messages"`
	Stream   bool          `json:"stream"`
}

type GroqClient struct {
	apiKey     string
	httpClient *http.Client
}

func NewGroqClient(apiKey string) *GroqClient {
	return &GroqClient{apiKey: apiKey, httpClient: &http.Client{}}
}

// Stream sends messages to Groq and writes SSE chunks to w.
// Returns the full assembled response text.
func (c *GroqClient) Stream(w io.Writer, flusher http.Flusher, systemPrompt string, messages []groqMessage) (string, error) {
	payload := groqRequest{
		Model:    groqModel,
		Stream:   true,
		Messages: append([]groqMessage{{Role: "system", Content: systemPrompt}}, messages...),
	}

	body, err := json.Marshal(payload)
	if err != nil {
		return "", err
	}

	req, err := http.NewRequest("POST", groqURL, bytes.NewReader(body))
	if err != nil {
		return "", err
	}
	req.Header.Set("Authorization", "Bearer "+c.apiKey)
	req.Header.Set("Content-Type", "application/json")

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return "", err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		b, _ := io.ReadAll(resp.Body)
		return "", fmt.Errorf("groq error %d: %s", resp.StatusCode, string(b))
	}

	var fullText strings.Builder
	scanner := bufio.NewScanner(resp.Body)
	for scanner.Scan() {
		line := scanner.Text()
		if !strings.HasPrefix(line, "data: ") {
			continue
		}
		data := strings.TrimPrefix(line, "data: ")
		if data == "[DONE]" {
			break
		}

		var chunk struct {
			Choices []struct {
				Delta struct {
					Content string `json:"content"`
				} `json:"delta"`
			} `json:"choices"`
		}
		if err := json.Unmarshal([]byte(data), &chunk); err != nil {
			continue
		}

		if len(chunk.Choices) > 0 {
			token := stripCJK(chunk.Choices[0].Delta.Content)
			if token != "" {
				fullText.WriteString(token)
				fmt.Fprintf(w, "data: %s\n\n", jsonEscape(token))
				flusher.Flush()
			}
		}
	}

	return fullText.String(), scanner.Err()
}

func jsonEscape(s string) string {
	b, _ := json.Marshal(s)
	return string(b[1 : len(b)-1])
}

// stripCJK removes CJK and other non-Cyrillic/Latin ideographic characters
// that occasionally appear as LLM tokenizer artifacts.
func stripCJK(s string) string {
	var b strings.Builder
	for _, r := range s {
		if (r >= 0x3000 && r <= 0x303F) || // CJK Symbols & Punctuation
			(r >= 0x3040 && r <= 0x30FF) || // Hiragana & Katakana
			(r >= 0x4E00 && r <= 0x9FFF) || // CJK Unified Ideographs
			(r >= 0xF900 && r <= 0xFAFF) || // CJK Compatibility Ideographs
			(r >= 0xFF00 && r <= 0xFFEF) { // Halfwidth & Fullwidth Forms
			continue
		}
		b.WriteRune(r)
	}
	return b.String()
}
